-- Marco 4I (TESTE ONLINE): registros tipo 2 (empresa) e tipo 5 (funcionário) do AFD na MESMA numeração (NSR) das marcações.
-- Cada cadastro/alteração vira um registro imutável com CRC-16/KERMIT, gravado pelo mesmo escritor único do ponto.
-- Aplicado no teste em duas partes (sem DROP: o MCP do Supabase trava em comandos destrutivos).
alter table private.empregador_4f add column if not exists responsavel_cpf text check (responsavel_cpf is null or private.cpf_valido_4f(responsavel_cpf));

create table if not exists ponto.evento_afd (
  nsr bigint primary key,
  tipo smallint not null check (tipo in (2, 5)),
  recorded_at timestamptz not null,
  linha text not null,
  crc text not null check (crc ~ '^[0-9A-F]{4}$')
);
alter table ponto.evento_afd enable row level security;
revoke all on ponto.evento_afd from public, anon, authenticated, service_role;
create or replace trigger imutavel before delete or update on ponto.evento_afd for each row execute function ponto.imutavel();
create or replace trigger imutavel_truncate before truncate on ponto.evento_afd for each statement execute function ponto.imutavel();

-- Texto em ISO-8859-1 (caractere fora da tabela vira "?"), campos do leiaute.
create or replace function ponto.afd_latin1(t text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(t, ''), '[^' || chr(32) || '-' || chr(126) || chr(160) || '-' || chr(255) || ']', '?', 'g')
$$;
create or replace function ponto.afd_a(v text, n int) returns text language sql immutable set search_path = '' as $$ select rpad(ponto.afd_latin1(v), n, ' ') $$;
create or replace function ponto.afd_n(v text, n int) returns text language sql immutable set search_path = '' as $$
  select lpad(right(regexp_replace(coalesce(v, ''), '\D', '', 'g'), n), n, '0')
$$;
create or replace function ponto.crc16_kermit(t text) returns text language plpgsql immutable set search_path = '' as $$
declare b bytea := convert_to(ponto.afd_latin1(t), 'LATIN1'); crc int := 0; i int; j int;
begin
  for i in 0 .. length(b) - 1 loop
    crc := crc # get_byte(b, i);
    for j in 1 .. 8 loop
      if (crc & 1) = 1 then crc := (crc >> 1) # 33800; else crc := crc >> 1; end if;
    end loop;
  end loop;
  return upper(lpad(to_hex(crc), 4, '0'));
end $$;

-- Escritor único: mesmo travamento e mesmo contador das marcações.
create or replace function ponto.registrar_evento_afd(p_tipo smallint, p_resto text) returns bigint language plpgsql set search_path = '' as $$
declare c ponto.contador_nsr; v_nsr bigint; v_quando timestamptz; v_linha text;
begin
  select * into c from ponto.contador_nsr where singleton for update;
  v_nsr := c.ultimo_nsr + 1;
  v_quando := date_trunc('milliseconds', clock_timestamp());
  v_linha := lpad(v_nsr::text, 9, '0') || p_tipo::text || ponto.afd_dh(v_quando) || p_resto;
  insert into ponto.evento_afd(nsr, tipo, recorded_at, linha, crc) values (v_nsr, p_tipo, v_quando, v_linha, ponto.crc16_kermit(v_linha));
  update ponto.contador_nsr set ultimo_nsr = v_nsr where singleton;
  return v_nsr;
end $$;
revoke all on function ponto.registrar_evento_afd(smallint, text) from public, anon, authenticated, service_role;

create or replace function ponto.evento_empresa_4i() returns void language plpgsql set search_path = '' as $$
declare e private.empregador_4f;
begin
  select * into e from private.empregador_4f where singleton;
  if e.responsavel_cpf is null then raise exception 'responsavel_cpf_obrigatorio' using errcode = '22023'; end if;
  perform ponto.registrar_evento_afd(2::smallint, ponto.afd_n(e.responsavel_cpf, 14) || e.tipo_documento::text || ponto.afd_a(e.documento, 14)
    || case when e.cno_caepf is null then rpad('', 14, ' ') else ponto.afd_n(e.cno_caepf, 14) end
    || ponto.afd_a(e.razao_social, 150) || ponto.afd_a(e.local_prestacao, 100));
end $$;
create or replace function ponto.evento_funcionario_4i(p_operacao char, p_cpf text, p_nome text) returns void language plpgsql set search_path = '' as $$
declare v_resp text;
begin
  select responsavel_cpf into v_resp from private.empregador_4f where singleton;
  if v_resp is null then raise exception 'responsavel_cpf_obrigatorio' using errcode = '22023'; end if;
  perform ponto.registrar_evento_afd(5::smallint, p_operacao || ponto.afd_n(p_cpf, 12) || ponto.afd_a(p_nome, 52) || ponto.afd_a('', 4) || ponto.afd_n(v_resp, 11));
end $$;
revoke all on function ponto.evento_empresa_4i(), ponto.evento_funcionario_4i(char, text, text) from public, anon, authenticated, service_role;

-- Empresa: nova função com o CPF do responsável (em branco = mantém o salvo); só gera registro tipo 2 quando algo do registro muda.
create or replace function public.admin_set_employer_4i(p_tipo smallint, p_documento text, p_cno text, p_razao text, p_local text, p_inpi text, p_dev text, p_responsavel text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_antes text; v_depois text; v_resp text;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  select concat_ws('|', tipo_documento, documento, cno_caepf, razao_social, local_prestacao, responsavel_cpf), responsavel_cpf into v_antes, v_resp from private.empregador_4f where singleton;
  v_resp := coalesce(nullif(regexp_replace(coalesce(p_responsavel, ''), '\D', '', 'g'), ''), v_resp);
  if v_resp is null then raise exception 'responsavel_cpf_obrigatorio' using errcode = '22023'; end if;
  insert into private.empregador_4f(singleton, tipo_documento, documento, cno_caepf, razao_social, local_prestacao, inpi, desenvolvedor_documento, responsavel_cpf, updated_at, updated_by)
  values (true, p_tipo, p_documento, nullif(p_cno, ''), trim(p_razao), trim(p_local), nullif(p_inpi, ''), nullif(p_dev, ''), v_resp, now(), (select auth.uid()))
  on conflict (singleton) do update set tipo_documento = excluded.tipo_documento, documento = excluded.documento, cno_caepf = excluded.cno_caepf,
    razao_social = excluded.razao_social, local_prestacao = excluded.local_prestacao, inpi = excluded.inpi,
    desenvolvedor_documento = excluded.desenvolvedor_documento, responsavel_cpf = excluded.responsavel_cpf, updated_at = now(), updated_by = excluded.updated_by;
  select concat_ws('|', tipo_documento, documento, cno_caepf, razao_social, local_prestacao, responsavel_cpf) into v_depois from private.empregador_4f where singleton;
  if v_antes is distinct from v_depois then perform ponto.evento_empresa_4i(); end if;
end $$;
-- A versão antiga (sem o responsável) não grava mais: a empresa passa a ser salva só pela nova, que gera o registro tipo 2.
create or replace function public.admin_set_employer_4f(p_tipo smallint, p_documento text, p_cno text, p_razao text, p_local text, p_inpi text, p_dev text)
returns void language plpgsql security definer set search_path = '' as $$
begin raise exception 'use_admin_set_employer_4i' using errcode = '0A000'; end $$;
create or replace function public.admin_employer_4i()
returns table(tipo_documento smallint, documento text, cno_caepf text, razao_social text, local_prestacao text, inpi text, desenvolvedor_documento text, updated_at timestamptz, responsavel_mascarado text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query select e.tipo_documento, e.documento, e.cno_caepf, e.razao_social, e.local_prestacao, e.inpi, e.desenvolvedor_documento, e.updated_at,
    case when e.responsavel_cpf is null then null else '***.' || substr(e.responsavel_cpf, 4, 3) || '.' || substr(e.responsavel_cpf, 7, 3) || '-**' end
  from private.empregador_4f e;
end $$;
revoke all on function public.admin_set_employer_4i(smallint, text, text, text, text, text, text, text), public.admin_employer_4i() from public, anon;
grant execute on function public.admin_set_employer_4i(smallint, text, text, text, text, text, text, text), public.admin_employer_4i() to authenticated;

-- CPF do funcionário: agora também gera o registro tipo 5 (I = inclusão, A = alteração, E = exclusão).
create or replace function public.admin_set_employee_cpf_4f(p_employee_id uuid, p_cpf text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; v_new text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), ''); v_nome text;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  select full_name into v_nome from public.epi_employees where id = p_employee_id;
  if v_nome is null then raise exception 'employee_not_found' using errcode = '22023'; end if;
  if v_new is not null and not private.cpf_valido_4f(v_new) then raise exception 'cpf_invalido' using errcode = '22023'; end if;
  if v_new is not null and exists (select 1 from private.employee_cpf_4f where cpf = v_new and employee_id <> p_employee_id) then raise exception 'cpf_em_uso' using errcode = '23505'; end if;
  select cpf into v_old from private.employee_cpf_4f where employee_id = p_employee_id;
  if v_old is not distinct from v_new then return; end if;
  if v_new is null then
    delete from private.employee_cpf_4f where employee_id = p_employee_id;
    insert into private.employee_cpf_history_4f(employee_id, operacao, cpf_final, changed_by) values (p_employee_id, 'E', right(v_old, 2), (select auth.uid()));
    perform ponto.evento_funcionario_4i('E', v_old, v_nome);
  else
    insert into private.employee_cpf_4f(employee_id, cpf, updated_by) values (p_employee_id, v_new, (select auth.uid()))
      on conflict (employee_id) do update set cpf = excluded.cpf, updated_at = now(), updated_by = excluded.updated_by;
    insert into private.employee_cpf_history_4f(employee_id, operacao, cpf_final, changed_by)
      values (p_employee_id, case when v_old is null then 'I' else 'A' end, right(v_new, 2), (select auth.uid()));
    perform ponto.evento_funcionario_4i(case when v_old is null then 'I' else 'A' end, v_new, v_nome);
  end if;
end $$;

-- Verificação: NSR contínuo somando marcações e cadastros; correntes das marcações; CRC dos cadastros.
create or replace function ponto.verificar(out ok boolean, out total bigint, out motivo text) returns record language plpgsql stable set search_path to '' as $function$
declare r ponto.marcacao; ev ponto.evento_afd; anterior text := null; anterior_afd text := null; c ponto.contador_nsr; n bigint; maior bigint; distintos bigint;
begin
  ok := true; total := 0; motivo := null;
  select count(*), coalesce(max(x.nsr), 0), count(distinct x.nsr) into n, maior, distintos
    from (select m.nsr from ponto.marcacao m union all select e.nsr from ponto.evento_afd e) x;
  total := n;
  if distintos <> n then ok := false; motivo := 'NSR_REPETIDO'; return; end if;
  if maior <> n then ok := false; motivo := 'NSR_COM_BURACO'; return; end if;
  for r in select * from ponto.marcacao order by nsr loop
    if r.previous_hash is distinct from anterior then ok := false; motivo := 'CADEIA_QUEBRADA_NSR_' || r.nsr; return; end if;
    if ponto.hash(ponto.canonico(r)) <> r.payload_hash then ok := false; motivo := 'HASH_DIVERGENTE_NSR_' || r.nsr; return; end if;
    anterior := r.payload_hash;
    if r.afd_hash is null then
      if anterior_afd is not null then ok := false; motivo := 'AFD_SEM_HASH_NSR_' || r.nsr; return; end if;
    else
      if r.employee_cpf is null or ponto.hash(ponto.afd_linha7(r) || coalesce(anterior_afd, '')) <> r.afd_hash then
        ok := false; motivo := 'AFD_HASH_DIVERGENTE_NSR_' || r.nsr; return; end if;
      anterior_afd := r.afd_hash;
    end if;
  end loop;
  for ev in select * from ponto.evento_afd order by nsr loop
    if substr(ev.linha, 1, 9)::bigint <> ev.nsr or ponto.crc16_kermit(ev.linha) <> ev.crc then ok := false; motivo := 'CADASTRO_ALTERADO_NSR_' || ev.nsr; return; end if;
  end loop;
  select * into c from ponto.contador_nsr where singleton;
  if c.ultimo_nsr <> n or c.ultimo_hash is distinct from anterior or c.ultimo_afd_hash is distinct from anterior_afd then ok := false; motivo := 'CONTADOR_DIVERGENTE'; end if;
end $function$;

-- Teste online: responsável fictício e registros de início (empresa + funcionários já com CPF).
update private.empregador_4f set responsavel_cpf = '52601815906' where singleton and responsavel_cpf is null;
do $$
declare r record;
begin
  if not exists (select 1 from ponto.evento_afd) then
    perform ponto.evento_empresa_4i();
    for r in select e.full_name, c.cpf from private.employee_cpf_4f c join public.epi_employees e on e.id = c.employee_id order by e.full_name loop
      perform ponto.evento_funcionario_4i('I', r.cpf, r.full_name);
    end loop;
  end if;
end $$;
select '4I pronto' as status;
