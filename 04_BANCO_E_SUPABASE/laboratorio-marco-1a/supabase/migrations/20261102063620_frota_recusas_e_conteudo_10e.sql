-- R5 / 10E. Somente metallo-teste. Preserva contratos e regras instalados de 10A/10B.
-- Tentativas anteriores sem conteúdo integral não são confirmadas por aproximação.
begin;
alter table private.frota_checklists_10a add column request_payload jsonb;
alter table private.frota_viagens_10a add column request_saida jsonb, add column request_chegada jsonb;

CREATE OR REPLACE FUNCTION public.create_checklist_10a(p_veiculo bigint, p_local text, p_obs text, p_respostas jsonb, p_ciente boolean, p_key uuid)
 RETURNS TABLE(id bigint, resultado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_emp uuid := private.funcionario_do_app_3t(); v_cid bigint; v_res text; v_v private.frota_veiculos_10a%rowtype;
  v_ativos int; v_ok int; v_crit boolean; v_algum boolean; v_lista text; v_f record;
  v_request jsonb := jsonb_build_object('veiculo',p_veiculo,'local',p_local,'obs',p_obs,'respostas',p_respostas,'ciente',p_ciente);
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_key is null then raise exception 'chave_obrigatoria' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_emp::text || ':create_checklist_10a:' || p_key::text, 0));
  select c.id, c.resultado into v_cid, v_res from private.frota_checklists_10a c where c.idempotency_key = p_key and c.employee_id = v_emp;
  if v_cid is not null then
    if (select c.request_payload from private.frota_checklists_10a c where c.id=v_cid) is distinct from v_request then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return query select v_cid, v_res; return;
  end if;
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
  update private.frota_checklists_10a set request_payload=v_request where frota_checklists_10a.id=v_cid;
  return query select v_cid, v_res;
end $function$;

CREATE OR REPLACE FUNCTION public.create_saida_10a(p_veiculo bigint, p_destino text, p_acompanhantes text, p_km integer, p_obs text, p_key uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_emp uuid := private.funcionario_do_app_3t(); v_id bigint; v_v private.frota_veiculos_10a%rowtype; v_destino text := trim(coalesce(p_destino, ''));
  v_request jsonb := jsonb_build_object('veiculo',p_veiculo,'destino',p_destino,'acompanhantes',p_acompanhantes,'km',p_km,'obs',p_obs);
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_key is null then raise exception 'chave_obrigatoria' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_emp::text || ':create_saida_10a:' || p_key::text, 0));
  select t.id into v_id from private.frota_viagens_10a t where t.chave_saida = p_key and t.employee_id = v_emp;
  if v_id is not null then
    if (select t.request_saida from private.frota_viagens_10a t where t.id=v_id) is distinct from v_request then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return v_id;
  end if;
  select * into v_v from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo for update;
  if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if v_v.situacao = 'em_uso' then raise exception 'veiculo_em_uso' using errcode = '22023'; end if;
  if v_v.situacao = 'manutencao' then raise exception 'veiculo_em_manutencao' using errcode = '22023'; end if;
  if v_v.situacao = 'nao_liberado' then raise exception 'veiculo_nao_liberado' using errcode = '22023'; end if;
  if exists (select 1 from private.frota_viagens_10a t where t.employee_id = v_emp and t.chegada_em is null) then raise exception 'voce_ja_esta_com_um_caminhao' using errcode = '22023'; end if;
  if char_length(v_destino) < 2 or char_length(v_destino) > 120 then raise exception 'destino_invalido' using errcode = '22023'; end if;
  if p_km is null or p_km < v_v.km_atual or p_km > 3000000 then raise exception 'km_menor_que_atual' using errcode = '22023'; end if;
  if v_v.liberado_dia is distinct from private.frota_hoje_10a()
    and not exists (select 1 from private.frota_checklists_10a c where c.veiculo_id = p_veiculo and c.dia = private.frota_hoje_10a() and c.resultado in ('liberado', 'ressalvas')) then
    raise exception 'checklist_do_dia_necessario' using errcode = '22023';
  end if;
  insert into private.frota_viagens_10a(veiculo_id, employee_id, destino, acompanhantes, km_saida, obs_saida, chave_saida)
    values (p_veiculo, v_emp, v_destino, nullif(left(trim(coalesce(p_acompanhantes, '')), 120), ''), p_km, nullif(left(trim(coalesce(p_obs, '')), 200), ''), p_key)
    returning frota_viagens_10a.id into v_id;
  update private.frota_veiculos_10a v set situacao = 'em_uso', km_atual = p_km where v.id = p_veiculo;
  perform private.frota_evento_10a(p_veiculo, 'saida', 'Saiu para ' || v_destino || ' com ' || p_km || ' km.', v_emp, null);
  update private.frota_viagens_10a set request_saida=v_request where frota_viagens_10a.id=v_id;
  return v_id;
end $function$;


CREATE OR REPLACE FUNCTION public.create_chegada_10a(p_viagem bigint, p_km integer, p_problema text, p_obs text, p_key uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_emp uuid := private.funcionario_do_app_3t(); v_t private.frota_viagens_10a%rowtype; v_prob text := trim(coalesce(p_problema, ''));
  v_request jsonb := jsonb_build_object('viagem',p_viagem,'km',p_km,'problema',p_problema,'obs',p_obs);
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_key is null then raise exception 'chave_obrigatoria' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_emp::text || ':create_chegada_10a:' || p_key::text, 0));
  if exists (select 1 from private.frota_viagens_10a t where t.chave_chegada = p_key and t.employee_id = v_emp) then
    if (select t.request_chegada from private.frota_viagens_10a t where t.chave_chegada=p_key and t.employee_id=v_emp) is distinct from v_request then raise exception 'idempotency_conflict' using errcode='22023'; end if;
    return;
  end if;
  select * into v_t from private.frota_viagens_10a t where t.id = p_viagem and t.employee_id = v_emp and t.chegada_em is null for update;
  if not found then raise exception 'viagem_nao_encontrada' using errcode = '22023'; end if;
  if p_km is null or p_km < v_t.km_saida or p_km > 3000000 then raise exception 'km_menor_que_saida' using errcode = '22023'; end if;
  if v_prob <> '' and char_length(v_prob) < 3 then raise exception 'descreva_o_problema' using errcode = '22023'; end if;
  update private.frota_viagens_10a t set chegada_em = now(), km_chegada = p_km, obs_chegada = nullif(left(trim(coalesce(p_obs, '')), 200), ''), chave_chegada = p_key,
    problema = nullif(left(v_prob, 250), '') where t.id = p_viagem;
  update private.frota_veiculos_10a v set situacao = 'disponivel', km_atual = p_km where v.id = v_t.veiculo_id;
  perform private.frota_evento_10a(v_t.veiculo_id, 'chegada', 'Chegou de ' || v_t.destino || ' com ' || p_km || ' km.', v_emp, null);
  if v_prob <> '' then
    perform private.frota_abrir_automatica_10a(v_t.veiculo_id, 'chegada', 'Problema informado na chegada: ' || left(v_prob, 250), null, true);
    update private.frota_veiculos_10a v set situacao = 'nao_liberado' where v.id = v_t.veiculo_id;
    perform private.frota_evento_10a(v_t.veiculo_id, 'problema_chegada', 'Problema informado na chegada: ' || v_prob, v_emp, null);
  else
    perform private.frota_recalcula_10a(v_t.veiculo_id);
  end if;
  update private.frota_viagens_10a set request_chegada=v_request where frota_viagens_10a.id=p_viagem;
end $function$;

-- Um relato recusado é conservado para conferência, sem recriar checklist/manutenção.
create table private.frota_recusas_10e (
  employee_id uuid not null references public.epi_employees(id),
  chave uuid not null,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  relato jsonb not null check (jsonb_typeof(relato)='object' and octet_length(relato::text)<=24000),
  recebido_em timestamptz not null default now(),
  conferido_em timestamptz,
  conferido_por uuid references auth.users(id),
  motivo text,
  primary key(employee_id,chave),
  check ((conferido_em is null and conferido_por is null and motivo is null)
    or (conferido_em is not null and conferido_por is not null and char_length(motivo) between 5 and 300))
);
alter table private.frota_recusas_10e enable row level security;
revoke all on private.frota_recusas_10e from public, anon, authenticated;
create index frota_recusas_veiculo_10e on private.frota_recusas_10e(veiculo_id,recebido_em);

create function public.my_relato_recusado_10e(p_key uuid,p_veiculo bigint,p_relato jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_emp uuid:=private.funcionario_do_app_3t(); v_r private.frota_recusas_10e%rowtype;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode='42501'; end if;
  if p_key is null or p_relato is null or jsonb_typeof(p_relato)<>'object'
    or octet_length(p_relato::text)>24000 then raise exception 'relato_invalido' using errcode='22023'; end if;
  if jsonb_typeof(p_relato->'obs') is distinct from 'string' or length(p_relato->>'obs')>300 then raise exception 'relato_invalido'; end if;
  if p_relato->>'tipo'='checklist' then
    if jsonb_typeof(p_relato->'respostas') is distinct from 'array' then raise exception 'relato_invalido'; end if;
    if jsonb_typeof(p_relato->'local') is distinct from 'string' or length(p_relato->>'local')>80
      or jsonb_array_length(p_relato->'respostas')>99 then raise exception 'relato_invalido'; end if;
    if exists(select 1 from jsonb_array_elements(p_relato->'respostas') r where
      jsonb_typeof(r->'codigo') is distinct from 'number' or (r->>'codigo') !~ '^[0-9]{1,2}$'
      or coalesce(r->>'situacao','') not in ('C','N','NA') or jsonb_typeof(r->'obs') is distinct from 'string' or length(r->>'obs')>200)
      then raise exception 'relato_invalido'; end if;
    if not exists(select 1 from jsonb_array_elements(p_relato->'respostas') r where r->>'situacao'='N' and length(trim(r->>'obs'))>=3)
      then raise exception 'relato_invalido'; end if;
  elsif p_relato->>'tipo'='chegada' then
    if jsonb_typeof(p_relato->'problema') is distinct from 'string' or length(p_relato->>'problema')>250
      or jsonb_typeof(p_relato->'viagem') is distinct from 'number' then raise exception 'relato_invalido'; end if;
    if coalesce(length(trim(p_relato->>'problema')),0)<3 then raise exception 'relato_invalido'; end if;
    if not exists(select 1 from private.frota_viagens_10a t where t.id=(p_relato->>'viagem')::bigint and t.employee_id=v_emp and t.veiculo_id=p_veiculo)
      then raise exception 'viagem_nao_encontrada'; end if;
  else raise exception 'relato_invalido'; end if;
  if not exists(select 1 from private.frota_veiculos_10a v where v.id=p_veiculo) then raise exception 'veiculo_invalido'; end if;
  insert into private.frota_recusas_10e(employee_id,chave,veiculo_id,relato)
    values(v_emp,p_key,p_veiculo,p_relato) on conflict(employee_id,chave) do nothing;
  select * into strict v_r from private.frota_recusas_10e r where r.employee_id=v_emp and r.chave=p_key;
  if v_r.veiculo_id<>p_veiculo or v_r.relato is distinct from p_relato then raise exception 'idempotency_conflict' using errcode='22023'; end if;
  return jsonb_build_object('chave',v_r.chave,'veiculo',v_r.veiculo_id,'relato',v_r.relato,
    'recebido_em',v_r.recebido_em,'conferido_em',v_r.conferido_em,'motivo',v_r.motivo);
end $$;
revoke all on function public.my_relato_recusado_10e(uuid,bigint,jsonb) from public,anon;
grant execute on function public.my_relato_recusado_10e(uuid,bigint,jsonb) to authenticated;

create function public.admin_relatos_recusados_10e(p_veiculo bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('chave',r.chave,'employee_id',r.employee_id,
    'por',e.full_name,'relato',r.relato,'recebido_em',r.recebido_em,'conferido_em',r.conferido_em,'motivo',r.motivo)
    order by r.recebido_em desc) from private.frota_recusas_10e r join public.epi_employees e on e.id=r.employee_id
    where r.veiculo_id=p_veiculo),'[]'::jsonb);
end $$;
revoke all on function public.admin_relatos_recusados_10e(bigint) from public,anon;
grant execute on function public.admin_relatos_recusados_10e(bigint) to authenticated;

create function public.admin_conferir_recusa_10e(p_veiculo bigint,p_employee uuid,p_key uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v_r private.frota_recusas_10e%rowtype; v_situacao text;
begin
  if not private.frota_pode_cadastrar_10a() then raise exception 'gestao_required' using errcode='42501'; end if;
  if p_motivo is null or char_length(trim(p_motivo)) not between 5 and 300 then raise exception 'motivo_obrigatorio'; end if;
  select v.situacao into v_situacao from private.frota_veiculos_10a v where v.id=p_veiculo and v.ativo for update;
  if v_situacao is distinct from 'disponivel' then raise exception 'veiculo_nao_liberado'; end if;
  select * into v_r from private.frota_recusas_10e r where r.employee_id=p_employee and r.chave=p_key and r.veiculo_id=p_veiculo for update;
  if not found then raise exception 'relato_nao_encontrado'; end if;
  if v_r.conferido_em is not null then
    if v_r.motivo is distinct from trim(p_motivo) then raise exception 'idempotency_conflict'; end if;
    return;
  end if;
  update private.frota_recusas_10e set conferido_em=now(),conferido_por=auth.uid(),motivo=trim(p_motivo)
    where employee_id=p_employee and chave=p_key;
  perform private.frota_evento_10a(p_veiculo,'recusa_conferida','Relato recusado conferido ('||p_key||'): '||trim(p_motivo),p_employee,auth.uid());
end $$;
revoke all on function public.admin_conferir_recusa_10e(bigint,uuid,uuid,text) from public,anon;
grant execute on function public.admin_conferir_recusa_10e(bigint,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
