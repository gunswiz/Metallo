-- Marco 10B (TESTE ONLINE): foto do defeito na frota. Balde PRIVADO; arquivo só pela Edge Function `fotos-frota-10b`.
-- Depende do 10A. Sem DROP/DELETE. A foto é enviada antes (fica "solta") e depois ligada ao item N do checklist ou à chegada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('frota-10b', 'frota-10b', false, 6291456, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists private.frota_fotos_10b (
  id uuid primary key default gen_random_uuid(),
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  employee_id uuid not null references public.epi_employees(id),
  caminho text,
  mime text check (mime is null or mime in ('image/jpeg', 'image/png')),
  tamanho integer check (tamanho is null or tamanho between 1 and 6291456),
  sha256 text,
  checklist_id bigint references private.frota_checklists_10a(id),
  codigo smallint,
  viagem_id bigint references private.frota_viagens_10a(id),
  created_at timestamptz not null default now(),
  check (checklist_id is null or viagem_id is null)
);
create unique index if not exists frota_fotos_10b_item on private.frota_fotos_10b(checklist_id, codigo) where checklist_id is not null;
create unique index if not exists frota_fotos_10b_viagem on private.frota_fotos_10b(viagem_id) where viagem_id is not null;
create index if not exists frota_fotos_10b_pessoa on private.frota_fotos_10b(employee_id, created_at);
alter table private.frota_fotos_10b enable row level security;
revoke all on private.frota_fotos_10b from public, anon, authenticated, service_role;

-- A pessoa pede para enviar uma foto: o banco confere quem é e devolve o número da foto (limite de 30 por dia).
create or replace function public.iniciar_foto_frota_10b(p_veiculo bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_id uuid;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if not exists (select 1 from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo) then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if (select count(*) from private.frota_fotos_10b f where f.employee_id = v_emp and f.created_at > now() - interval '1 day') >= 30 then raise exception 'muitos_envios' using errcode = '22023'; end if;
  insert into private.frota_fotos_10b(veiculo_id, employee_id) values (p_veiculo, v_emp) returning id into v_id;
  return v_id;
end $$;

-- Usada só pela Edge Function (conexão do servidor): marca a foto como gravada.
create or replace function private.concluir_foto_frota_10b(p_id uuid, p_caminho text, p_mime text, p_tamanho integer, p_sha text) returns void
language sql security definer set search_path = '' as $$
  update private.frota_fotos_10b f set caminho = p_caminho, mime = p_mime, tamanho = p_tamanho, sha256 = p_sha where f.id = p_id and f.caminho is null
$$;

-- Abrir: a Gestão (quem atende) ou a própria pessoa que enviou.
create or replace function public.abrir_foto_frota_10b(p_id uuid) returns table(caminho text, mime text)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  return query select f.caminho, f.mime from private.frota_fotos_10b f
    where f.id = p_id and f.caminho is not null and (private.pode_atender_3t() or (v_emp is not null and f.employee_id = v_emp));
  if not found then raise exception 'arquivo_indisponivel' using errcode = '42501'; end if;
end $$;

-- Foto do problema na chegada: até 30 minutos depois de registrar a chegada.
create or replace function public.anexar_foto_chegada_10b(p_viagem bigint, p_foto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_t private.frota_viagens_10a%rowtype;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select * into v_t from private.frota_viagens_10a t where t.id = p_viagem and t.employee_id = v_emp and t.chegada_em > now() - interval '30 minutes';
  if not found then raise exception 'viagem_nao_encontrada' using errcode = '22023'; end if;
  update private.frota_fotos_10b f set viagem_id = p_viagem
    where f.id = p_foto and f.employee_id = v_emp and f.veiculo_id = v_t.veiculo_id and f.caminho is not null and f.checklist_id is null and f.viagem_id is null;
  if not found then raise exception 'foto_invalida' using errcode = '22023'; end if;
  perform private.frota_evento_10a(v_t.veiculo_id, 'foto_chegada', 'Foto do problema anexada à chegada.', v_emp, null);
end $$;

-- Gestão: detalhe do checklist agora traz a foto de cada item (quando houver).
create or replace function public.admin_frota_checklist_10a(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c jsonb;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select jsonb_build_object('id', k.id, 'veiculo', v.nome, 'placa', v.placa, 'dia', k.dia, 'resultado', k.resultado, 'por', e.full_name, 'local', k.local, 'observacoes', k.observacoes, 'created_at', k.created_at)
    into v_c from private.frota_checklists_10a k join private.frota_veiculos_10a v on v.id = k.veiculo_id join public.epi_employees e on e.id = k.employee_id where k.id = p_id;
  if v_c is null then raise exception 'checklist_invalido' using errcode = '22023'; end if;
  return jsonb_build_object('checklist', v_c, 'itens', coalesce((select jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nome', i.nome, 'situacao', r.situacao, 'obs', r.obs, 'critico', r.critico,
      'foto', (select f.id from private.frota_fotos_10b f where f.checklist_id = p_id and f.codigo = r.codigo and f.caminho is not null)) order by r.codigo)
    from private.frota_respostas_10a r join private.frota_itens_10a i on i.codigo = r.codigo where r.checklist_id = p_id), '[]'::jsonb));
end $$;

-- Gestão: fotos de chegada de um caminhão (uma por saída).
create or replace function public.admin_frota_fotos_chegada_10b(p_veiculo bigint) returns table(viagem_id bigint, foto_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select f.viagem_id, f.id from private.frota_fotos_10b f where f.veiculo_id = p_veiculo and f.viagem_id is not null and f.caminho is not null;
end $$;

revoke all on function public.iniciar_foto_frota_10b(bigint), public.abrir_foto_frota_10b(uuid), public.anexar_foto_chegada_10b(bigint, uuid),
  public.admin_frota_fotos_chegada_10b(bigint), public.admin_frota_checklist_10a(bigint) from public, anon;
grant execute on function public.iniciar_foto_frota_10b(bigint), public.abrir_foto_frota_10b(uuid), public.anexar_foto_chegada_10b(bigint, uuid),
  public.admin_frota_fotos_chegada_10b(bigint), public.admin_frota_checklist_10a(bigint) to authenticated;
revoke all on function private.concluir_foto_frota_10b(uuid, text, text, integer, text) from public, anon, authenticated, service_role;

-- Checklist (substitui a versão do 10A): cada resposta N pode levar "foto" (número devolvido por iniciar_foto_frota_10b).
create or replace function public.create_checklist_10a(p_veiculo bigint, p_local text, p_obs text, p_respostas jsonb, p_ciente boolean, p_key uuid)
returns table(id bigint, resultado text)
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_cid bigint; v_res text; v_v private.frota_veiculos_10a%rowtype;
  v_ativos int; v_ok int; v_crit boolean; v_algum boolean; v_lista text; v_f record;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select c.id, c.resultado into v_cid, v_res from private.frota_checklists_10a c where c.idempotency_key = p_key and c.employee_id = v_emp;
  if v_cid is not null then return query select v_cid, v_res; return; end if;
  select * into v_v from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo for update;
  if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if v_v.situacao in ('em_uso', 'manutencao') then raise exception 'veiculo_indisponivel' using errcode = '22023'; end if;
  if p_ciente is not true then raise exception 'ciencia_obrigatoria' using errcode = '22023'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'array' then raise exception 'itens_incompletos' using errcode = '22023'; end if;
  select count(*) into v_ativos from private.frota_itens_10a i where i.ativo;
  select count(*) into v_ok from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text)
    join private.frota_itens_10a i on i.codigo = r.codigo and i.ativo;
  if v_ok <> v_ativos or jsonb_array_length(p_respostas) <> v_ativos
    or (select count(distinct r.codigo) from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text)) <> v_ativos then
    raise exception 'itens_incompletos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) where r.situacao is null or r.situacao not in ('C', 'N', 'NA')) then
    raise exception 'resposta_invalida' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) where r.situacao = 'N' and char_length(trim(coalesce(r.obs, ''))) < 3) then
    raise exception 'descreva_o_problema' using errcode = '22023';
  end if;
  select coalesce(bool_or(r.situacao = 'N' and i.critico), false), coalesce(bool_or(r.situacao = 'N'), false),
    string_agg(i.nome, ', ' order by i.codigo) filter (where r.situacao = 'N')
    into v_crit, v_algum, v_lista
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join private.frota_itens_10a i on i.codigo = r.codigo;
  v_res := case when v_crit then 'nao_liberado' when v_algum then 'ressalvas' else 'liberado' end;
  insert into private.frota_checklists_10a(veiculo_id, employee_id, dia, local, observacoes, resultado, ciente, idempotency_key)
    values (p_veiculo, v_emp, private.frota_hoje_10a(), nullif(left(trim(coalesce(p_local, '')), 80), ''), nullif(left(trim(coalesce(p_obs, '')), 300), ''), v_res, true, p_key)
    returning frota_checklists_10a.id into v_cid;
  insert into private.frota_respostas_10a(checklist_id, codigo, situacao, obs, critico)
    select v_cid, r.codigo, r.situacao, nullif(left(trim(coalesce(r.obs, '')), 200), ''), i.critico
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join private.frota_itens_10a i on i.codigo = r.codigo;
  -- Fotos do defeito (10B): só do próprio funcionário, deste caminhão, ainda sem uso e só em item com N.
  for v_f in select r.codigo, r.foto from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text, foto uuid) where r.foto is not null and r.situacao = 'N' loop
    update private.frota_fotos_10b f set checklist_id = v_cid, codigo = v_f.codigo
      where f.id = v_f.foto and f.employee_id = v_emp and f.veiculo_id = p_veiculo and f.caminho is not null and f.checklist_id is null and f.viagem_id is null;
    if not found then raise exception 'foto_invalida' using errcode = '22023'; end if;
  end loop;
  if v_crit then
    update private.frota_veiculos_10a v set situacao = 'nao_liberado' where v.id = p_veiculo;
    perform private.frota_abrir_automatica_10a(p_veiculo, 'checklist', 'Checklist com item crítico não conforme: ' || v_lista, v_cid, true);
    perform private.frota_evento_10a(p_veiculo, 'checklist_bloqueio', 'Checklist com item crítico não conforme (' || v_lista || '). Caminhão não liberado.', v_emp, null);
  elsif v_algum then
    perform private.frota_abrir_automatica_10a(p_veiculo, 'checklist', 'Checklist com item não conforme: ' || v_lista, v_cid, false);
    perform private.frota_evento_10a(p_veiculo, 'checklist_ressalvas', 'Checklist com ressalvas (' || v_lista || ').', v_emp, null);
  else
    perform private.frota_evento_10a(p_veiculo, 'checklist_ok', 'Checklist sem problemas.', v_emp, null);
  end if;
  return query select v_cid, v_res;
end $$;


revoke all on function public.create_checklist_10a(bigint, text, text, jsonb, boolean, uuid) from public, anon;
grant execute on function public.create_checklist_10a(bigint, text, text, jsonb, boolean, uuid) to authenticated;

select '10B pronto' as status;
