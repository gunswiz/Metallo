begin;
create table private.frota_ativacoes_10j (
 id bigint generated always as identity primary key,
 categoria text not null, revisao integer not null,
 autor uuid not null references auth.users(id), em timestamptz not null default now(),
 motivo text not null check(char_length(trim(motivo)) between 10 and 600),
 foreign key(categoria,revisao) references private.frota_aprovacoes_10i(categoria,revisao),
 unique(categoria,revisao)
);
create index frota_ativacoes_autor_10j on private.frota_ativacoes_10j(autor);
alter table private.frota_ativacoes_10j enable row level security;
revoke all on private.frota_ativacoes_10j from public,anon,authenticated,service_role;
create trigger frota_ativacao_imutavel_10j before update or delete on private.frota_ativacoes_10j for each row execute function private.frota_modelo_imutavel_10g();

create function public.admin_ativar_modelo_10j(p_categoria text,p_revisao integer,p_anterior bigint,p_motivo text,p_ciente boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v private.frota_ativacoes_10j%rowtype;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='engineer') then raise exception 'engenheiro_required' using errcode='42501'; end if;
 if p_ciente is not true or p_motivo is null or char_length(trim(p_motivo)) not between 10 and 600 then raise exception 'parecer_obrigatorio' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('frota_modelo_10g:'||p_categoria,0));
 perform 1 from private.frota_categorias_10g where codigo=p_categoria for update;
 if not found then raise exception 'modelo_not_found' using errcode='22023'; end if;
 select * into v from private.frota_ativacoes_10j where categoria=p_categoria order by id desc limit 1;
 if v.revisao=p_revisao and v.autor=auth.uid() and v.motivo=trim(p_motivo) then return; end if;
 if p_anterior is distinct from coalesce(v.id,0) then raise exception 'modelo_revisao_conflito' using errcode='22023'; end if;
 if p_revisao is null or p_revisao is distinct from (select max(revisao) from private.frota_aprovacoes_10i where categoria=p_categoria)
  or p_revisao<=coalesce(v.revisao,0) then raise exception 'modelo_aprovado_necessario' using errcode='22023'; end if;
 insert into private.frota_ativacoes_10j(categoria,revisao,autor,motivo) values(p_categoria,p_revisao,auth.uid(),trim(p_motivo));
end $$;

create function public.admin_ativacao_modelo_10j(p_categoria text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.pode_atender_3t() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
 return jsonb_build_object('veiculos',(select count(*) from private.frota_veiculos_10a where categoria=p_categoria and ativo),
 'atual',(select jsonb_build_object('id',a.id,'revisao',a.revisao,'em',a.em,'motivo',a.motivo,'autor',coalesce(p.full_name,'Responsável registrado')) from private.frota_ativacoes_10j a left join public.profiles p on p.id=a.autor where a.categoria=p_categoria order by a.id desc limit 1));
end $$;

create function private.frota_modelo_veiculo_10j(p_veiculo bigint) returns jsonb
language plpgsql set search_path='' as $$
declare v_categoria text; v_revisao integer; v_itens jsonb;
begin
 select categoria into v_categoria from private.frota_veiculos_10a where id=p_veiculo;
 -- Compartilha a trava com a ativação; checklist/saída já travam o veículo antes.
 if v_categoria is not null then
  perform 1 from private.frota_categorias_10g where codigo=v_categoria for share;
  select revisao into v_revisao from private.frota_ativacoes_10j where categoria=v_categoria order by id desc limit 1;
 end if;
 if v_revisao is null then return private.frota_modelo_atual_10f(); end if;
 select itens into v_itens from private.frota_modelos_10g where categoria=v_categoria and revisao=v_revisao;
 return jsonb_build_object('modelo','categoria-10j','categoria',v_categoria,'revisao',v_revisao,'itens',v_itens,'regras',jsonb_build_object('observacao_problema_minima',3));
end $$;
revoke all on function private.frota_modelo_veiculo_10j(bigint) from public,anon,authenticated,service_role;

create function public.my_frota_itens_10j(p_veiculo bigint) returns table(codigo smallint,nome text,critico boolean,versao text,permite_na boolean,exige_foto boolean,etapa text)
language plpgsql security definer set search_path='' as $$
declare v_modelo jsonb;
begin
 if private.funcionario_do_app_3t() is null then raise exception 'portal_access_denied' using errcode='42501'; end if;
 perform 1 from private.frota_veiculos_10a where id=p_veiculo and ativo for share;
 if not found then raise exception 'veiculo_invalido' using errcode='22023'; end if;
 v_modelo:=private.frota_modelo_veiculo_10j(p_veiculo);
 return query select i.codigo,i.nome,i.critico,encode(sha256(convert_to(v_modelo::text,'UTF8')),'hex'),coalesce(i.permite_na,true),coalesce(i.exige_foto,false),i.etapa
 from jsonb_to_recordset(v_modelo->'itens') as i(codigo smallint,nome text,critico boolean,permite_na boolean,exige_foto boolean,etapa text) order by i.codigo;
end $$;
revoke all on function public.admin_ativar_modelo_10j(text,integer,bigint,text,boolean),public.admin_ativacao_modelo_10j(text),public.my_frota_itens_10j(bigint) from public,anon;
grant execute on function public.admin_ativar_modelo_10j(text,integer,bigint,text,boolean),public.admin_ativacao_modelo_10j(text),public.my_frota_itens_10j(bigint) to authenticated;

-- A validade do código passa a ser conferida contra o snapshot versionado na RPC.
-- Respostas existentes não são modificadas; o catálogo legado deixa de limitar novos modelos.
alter table private.frota_respostas_10a drop constraint frota_respostas_10a_codigo_fkey;

CREATE OR REPLACE FUNCTION public.create_checklist_10a(p_veiculo bigint, p_local text, p_obs text, p_respostas jsonb, p_ciente boolean, p_key uuid)
 RETURNS TABLE(id bigint, resultado text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_emp uuid := private.funcionario_do_app_3t(); v_cid bigint; v_res text; v_v private.frota_veiculos_10a%rowtype;
  v_ativos int; v_ok int; v_crit boolean; v_algum boolean; v_lista text; v_f record; v_modelo jsonb; v_versao text;
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
  -- SHARE impede que a configuração mude entre conferir a versão e gravar as respostas.
  lock table private.frota_itens_10a in share mode;
  v_modelo := private.frota_modelo_veiculo_10j(p_veiculo);
  v_versao := encode(sha256(convert_to(v_modelo::text, 'UTF8')), 'hex');
  if jsonb_array_length(p_respostas) = 0 or exists (
    select 1 from jsonb_array_elements(p_respostas) r where r->>'versao' is distinct from v_versao
  ) then raise exception 'checklist_versao_desatualizada' using errcode='22023'; end if;
  v_ativos := jsonb_array_length(v_modelo->'itens');
  select count(*) into v_ok from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text)
    join jsonb_to_recordset(v_modelo->'itens') as i(codigo smallint,nome text,critico boolean) on i.codigo = r.codigo;
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
  if exists(select 1 from jsonb_to_recordset(p_respostas) as r(codigo int,situacao text,foto uuid)
    join jsonb_to_recordset(v_modelo->'itens') as i(codigo int,permite_na boolean,exige_foto boolean) on i.codigo=r.codigo
    where (r.situacao='NA' and i.permite_na=false) or (r.situacao='N' and i.exige_foto=true and r.foto is null)) then
    raise exception 'regra_evidencia_checklist' using errcode='22023';
  end if;
  select coalesce(bool_or(r.situacao = 'N' and i.critico), false), coalesce(bool_or(r.situacao = 'N'), false),
    string_agg(i.nome, ', ' order by i.codigo) filter (where r.situacao = 'N')
    into v_crit, v_algum, v_lista
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join jsonb_to_recordset(v_modelo->'itens') as i(codigo smallint,nome text,critico boolean) on i.codigo = r.codigo;
  v_res := case when v_crit then 'nao_liberado' when v_algum then 'ressalvas' else 'liberado' end;
  insert into private.frota_checklists_10a(veiculo_id, employee_id, dia, local, observacoes, resultado, ciente, idempotency_key, modelo_snapshot, modelo_versao)
    values (p_veiculo, v_emp, private.frota_hoje_10a(), nullif(left(trim(coalesce(p_local, '')), 80), ''), nullif(left(trim(coalesce(p_obs, '')), 300), ''), v_res, true, p_key, v_modelo, v_versao)
    returning frota_checklists_10a.id into v_cid;
  insert into private.frota_respostas_10a(checklist_id, codigo, situacao, obs, critico)
    select v_cid, r.codigo, r.situacao, nullif(left(trim(coalesce(r.obs, '')), 200), ''), i.critico
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join jsonb_to_recordset(v_modelo->'itens') as i(codigo smallint,nome text,critico boolean) on i.codigo = r.codigo;
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

create or replace function public.admin_frota_checklist_10a(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c jsonb;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select jsonb_build_object('id', k.id, 'veiculo', v.nome, 'placa', v.placa, 'dia', k.dia, 'resultado', k.resultado, 'por', e.full_name, 'local', k.local, 'observacoes', k.observacoes, 'created_at', k.created_at, 'modelo_versao', k.modelo_versao)
    into v_c from private.frota_checklists_10a k join private.frota_veiculos_10a v on v.id = k.veiculo_id join public.epi_employees e on e.id = k.employee_id where k.id = p_id;
  if v_c is null then raise exception 'checklist_invalido' using errcode = '22023'; end if;
  return jsonb_build_object('checklist', v_c, 'itens', coalesce((select jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nome', private.frota_nome_historico_10f(p_id, r.codigo), 'situacao', r.situacao, 'obs', r.obs, 'critico', r.critico,
      'foto', (select f.id from private.frota_fotos_10b f where f.checklist_id = p_id and f.codigo = r.codigo and f.caminho is not null)) order by r.codigo)
    from private.frota_respostas_10a r where r.checklist_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.admin_frota_relatos_10c(p_veiculo bigint) returns table(manutencao_id bigint, relatos jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select m.id, coalesce((select jsonb_agg(to_jsonb(x) order by x.quando desc) from (
      select k.created_at as quando, 'checklist'::text as tipo, e.full_name as por,
        (select jsonb_agg(jsonb_build_object('item', private.frota_nome_historico_10f(k.id, rp.codigo), 'obs', rp.obs, 'critico', rp.critico,
            'foto', (select f.id from private.frota_fotos_10b f where f.checklist_id = k.id and f.codigo = rp.codigo and f.caminho is not null)) order by rp.codigo)
          from private.frota_respostas_10a rp where rp.checklist_id = k.id and rp.situacao = 'N') as itens,
        null::text as problema, null::uuid as foto
      from private.frota_checklists_10a k join public.epi_employees e on e.id = k.employee_id
      where k.veiculo_id = m.veiculo_id and k.resultado <> 'liberado' and k.created_at >= m.aberta_em and (m.concluida_em is null or k.created_at <= m.concluida_em)
      union all
      select t.chegada_em, 'chegada'::text, e.full_name, null::jsonb, t.problema,
        (select f.id from private.frota_fotos_10b f where f.viagem_id = t.id and f.caminho is not null)
      from private.frota_viagens_10a t join public.epi_employees e on e.id = t.employee_id
      where t.veiculo_id = m.veiculo_id and t.problema is not null and t.chegada_em >= m.aberta_em and (m.concluida_em is null or t.chegada_em <= m.concluida_em)
    ) x), '[]'::jsonb)
    from private.frota_manutencoes_10a m
    where m.veiculo_id = p_veiculo and m.origem in ('checklist', 'chegada');
end $$;

create or replace function public.avisar_defeito_frota_10c(p_veiculo bigint) returns table(veiculo text, quem text, resumo text, bloqueado boolean)
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_nome text; v_quem text; v_resumo text; v_bloq boolean;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select v.nome into v_nome from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo;
  if v_nome is null then return; end if;
  if exists (select 1 from private.frota_eventos_10a ev where ev.veiculo_id = p_veiculo and ev.employee_id = v_emp and ev.tipo = 'aviso_defeito' and ev.em > now() - interval '15 minutes') then return; end if;
  select e.full_name into v_quem from public.epi_employees e where e.id = v_emp;
  select string_agg(private.frota_nome_historico_10f(k.id, rp.codigo), ', ' order by rp.codigo), coalesce(bool_or(rp.critico), false) into v_resumo, v_bloq
    from private.frota_checklists_10a k join private.frota_respostas_10a rp on rp.checklist_id = k.id and rp.situacao = 'N'
    where k.veiculo_id = p_veiculo and k.employee_id = v_emp and k.created_at > now() - interval '15 minutes';
  if v_resumo is null then
    select t.problema, true into v_resumo, v_bloq from private.frota_viagens_10a t
      where t.veiculo_id = p_veiculo and t.employee_id = v_emp and t.problema is not null and t.chegada_em > now() - interval '15 minutes' order by t.chegada_em desc limit 1;
  end if;
  if v_resumo is null then return; end if;
  perform private.frota_evento_10a(p_veiculo, 'aviso_defeito', 'Gestão avisada do defeito informado.', v_emp, null);
  return query select v_nome, v_quem, left(v_resumo, 140), v_bloq;
end $$;



CREATE OR REPLACE FUNCTION public.create_saida_10a(p_veiculo bigint, p_destino text, p_acompanhantes text, p_km integer, p_obs text, p_key uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_modelo jsonb; v_versao text; v_emp uuid := private.funcionario_do_app_3t(); v_id bigint; v_v private.frota_veiculos_10a%rowtype; v_destino text := trim(coalesce(p_destino, ''));
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
  v_modelo:=private.frota_modelo_veiculo_10j(p_veiculo);
  v_versao:=encode(sha256(convert_to(v_modelo::text,'UTF8')),'hex');
  if v_modelo->>'modelo'='categoria-10j' and not exists(select 1 from private.frota_checklists_10a c
    where c.veiculo_id=p_veiculo and c.dia=private.frota_hoje_10a() and c.modelo_versao=v_versao and c.resultado in ('liberado','ressalvas')) then
    raise exception 'checklist_versao_atual_necessaria' using errcode='22023';
  end if;
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



create or replace function public.my_frota_10a() returns table(id bigint, nome text, placa text, modelo text, situacao text, km_atual integer,
  checklist_hoje text, motorista text, destino text, saida_em timestamptz, minha_viagem bigint)
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query
    select v.id, v.nome, v.placa, v.modelo, v.situacao, v.km_atual,
      (select c.resultado from private.frota_checklists_10a c where c.veiculo_id = v.id and c.dia = private.frota_hoje_10a() and (mm.modelo->>'modelo'<>'categoria-10j' or c.modelo_versao=encode(sha256(convert_to(mm.modelo::text,'UTF8')),'hex')) order by c.created_at desc limit 1),
      e.full_name, t.destino, t.saida_em, case when t.employee_id = v_emp then t.id end
    from private.frota_veiculos_10a v
      cross join lateral (select private.frota_modelo_veiculo_10j(v.id) as modelo) mm
      left join private.frota_viagens_10a t on t.veiculo_id = v.id and t.chegada_em is null
      left join public.epi_employees e on e.id = t.employee_id
    where v.ativo order by v.nome;
end $$;


commit;
