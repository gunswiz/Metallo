-- Marco 4F (TESTE ONLINE, dados fictícios): dados para o ponto oficial — empregador, CPF do funcionário e hash do AFD.
-- Portaria MTP 671/2021, leiaute AFD v004 (REP-P). Sem valor oficial: falta registro no INPI e assinatura ICP-Brasil.

-- CPF válido (11 dígitos, dígitos verificadores, não repetido).
create or replace function private.cpf_valido_4f(p text) returns boolean language plpgsql immutable set search_path = '' as $$
declare s int; d1 int; d2 int; i int;
begin
  if p is null or p !~ '^\d{11}$' or p ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(p, i, 1)::int * (11 - i); end loop;
  d1 := (s * 10) % 11; if d1 = 10 then d1 := 0; end if;
  s := 0; for i in 1..10 loop s := s + substr(p, i, 1)::int * (12 - i); end loop;
  d2 := (s * 10) % 11; if d2 = 10 then d2 := 0; end if;
  return d1 = substr(p, 10, 1)::int and d2 = substr(p, 11, 1)::int;
end $$;

create table if not exists private.empregador_4f (
  singleton boolean primary key default true check (singleton),
  tipo_documento smallint not null check (tipo_documento in (1, 2)),
  documento text not null check (documento ~ '^(\d{11}|\d{14})$'),
  cno_caepf text check (cno_caepf is null or cno_caepf ~ '^\d{1,14}$'),
  razao_social text not null check (char_length(razao_social) between 2 and 150),
  local_prestacao text not null check (char_length(local_prestacao) between 2 and 100),
  inpi text check (inpi is null or inpi ~ '^\d{1,17}$'),
  desenvolvedor_documento text check (desenvolvedor_documento is null or desenvolvedor_documento ~ '^(\d{11}|\d{14})$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists private.employee_cpf_4f (
  employee_id uuid primary key references public.epi_employees(id) on delete cascade,
  cpf text not null unique check (private.cpf_valido_4f(cpf)),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists private.employee_cpf_history_4f (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  operacao char(1) not null check (operacao in ('I', 'A', 'E')),
  cpf_final text not null check (cpf_final ~ '^\d{2}$'),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id)
);
alter table private.empregador_4f enable row level security;
alter table private.employee_cpf_4f enable row level security;
alter table private.employee_cpf_history_4f enable row level security;
revoke all on private.empregador_4f, private.employee_cpf_4f, private.employee_cpf_history_4f from public, anon, authenticated, service_role;

-- Gestão (só administrador): empresa e CPF. O CPF completo NUNCA volta para a tela (só mascarado).
create or replace function public.admin_employer_4f()
returns table(tipo_documento smallint, documento text, cno_caepf text, razao_social text, local_prestacao text, inpi text, desenvolvedor_documento text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query select e.tipo_documento, e.documento, e.cno_caepf, e.razao_social, e.local_prestacao, e.inpi, e.desenvolvedor_documento, e.updated_at from private.empregador_4f e;
end $$;

create or replace function public.admin_set_employer_4f(p_tipo smallint, p_documento text, p_cno text, p_razao text, p_local text, p_inpi text, p_dev text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  insert into private.empregador_4f(singleton, tipo_documento, documento, cno_caepf, razao_social, local_prestacao, inpi, desenvolvedor_documento, updated_at, updated_by)
  values (true, p_tipo, p_documento, nullif(p_cno, ''), trim(p_razao), trim(p_local), nullif(p_inpi, ''), nullif(p_dev, ''), now(), (select auth.uid()))
  on conflict (singleton) do update set tipo_documento = excluded.tipo_documento, documento = excluded.documento, cno_caepf = excluded.cno_caepf,
    razao_social = excluded.razao_social, local_prestacao = excluded.local_prestacao, inpi = excluded.inpi,
    desenvolvedor_documento = excluded.desenvolvedor_documento, updated_at = now(), updated_by = excluded.updated_by;
end $$;

create or replace function public.admin_employees_cpf_4f()
returns table(employee_id uuid, full_name text, registration_code text, cpf_mascarado text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return query select e.id, e.full_name, e.registration_code,
    case when c.cpf is null then null else '***.' || substr(c.cpf, 4, 3) || '.' || substr(c.cpf, 7, 3) || '-**' end
  from public.epi_employees e left join private.employee_cpf_4f c on c.employee_id = e.id
  where e.active order by e.full_name;
end $$;

create or replace function public.admin_set_employee_cpf_4f(p_employee_id uuid, p_cpf text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text; v_new text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.epi_employees where id = p_employee_id) then raise exception 'employee_not_found' using errcode = '22023'; end if;
  if v_new is not null and not private.cpf_valido_4f(v_new) then raise exception 'cpf_invalido' using errcode = '22023'; end if;
  if v_new is not null and exists (select 1 from private.employee_cpf_4f where cpf = v_new and employee_id <> p_employee_id) then raise exception 'cpf_em_uso' using errcode = '23505'; end if;
  select cpf into v_old from private.employee_cpf_4f where employee_id = p_employee_id;
  if v_old is not distinct from v_new then return; end if;
  if v_new is null then
    delete from private.employee_cpf_4f where employee_id = p_employee_id;
    insert into private.employee_cpf_history_4f(employee_id, operacao, cpf_final, changed_by) values (p_employee_id, 'E', right(v_old, 2), (select auth.uid()));
  else
    insert into private.employee_cpf_4f(employee_id, cpf, updated_by) values (p_employee_id, v_new, (select auth.uid()))
      on conflict (employee_id) do update set cpf = excluded.cpf, updated_at = now(), updated_by = excluded.updated_by;
    insert into private.employee_cpf_history_4f(employee_id, operacao, cpf_final, changed_by)
      values (p_employee_id, case when v_old is null then 'I' else 'A' end, right(v_new, 2), (select auth.uid()));
  end if;
end $$;
revoke all on function public.admin_employer_4f(), public.admin_set_employer_4f(smallint, text, text, text, text, text, text),
  public.admin_employees_cpf_4f(), public.admin_set_employee_cpf_4f(uuid, text) from public, anon;
grant execute on function public.admin_employer_4f(), public.admin_set_employer_4f(smallint, text, text, text, text, text, text),
  public.admin_employees_cpf_4f(), public.admin_set_employee_cpf_4f(uuid, text) to authenticated;
revoke all on function private.cpf_valido_4f(text) from public, anon, authenticated;

-- Ponto: CPF gravado NA HORA da marcação + hash do AFD (registro tipo 7), em corrente própria.
alter table ponto.marcacao add column if not exists employee_cpf text;
alter table ponto.marcacao add column if not exists afd_hash text;
alter table ponto.contador_nsr add column if not exists ultimo_afd_hash text;

-- DH do leiaute: "AAAA-MM-ddThh:mm:00-0300" (segundos sempre 00). Fortaleza não tem horário de verão.
create or replace function ponto.afd_dh(t timestamptz) returns text language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI":00-0300"')
$$;
-- Campos 1 a 7 do registro tipo 7, exatamente como saem no arquivo (73 posições).
create or replace function ponto.afd_linha7(m ponto.marcacao) returns text language sql immutable set search_path = '' as $$
  select lpad(m.nsr::text, 9, '0') || '7' || ponto.afd_dh(m.marking_at) || lpad(m.employee_cpf, 12, '0') || ponto.afd_dh(m.recorded_at)
    || case m.collector when 'BROWSER' then '02' when 'MOBILE_APP' then '01' else '05' end || case when m.online then '0' else '1' end
$$;

create or replace function ponto.registrar(p_user uuid, p_session uuid, p_key uuid, p_location jsonb)
 returns table(marcacao ponto.marcacao, duplicate boolean) language plpgsql set search_path to '' as $function$
declare a record; i ponto.intencao; m ponto.marcacao; c ponto.contador_nsr; loc jsonb := p_location; captured timestamptz; req text; v_cpf text;
begin
  a := ponto.ator(p_user, p_session);
  -- Escritor único: todas as gravações passam por este travamento, na ordem do NSR.
  select * into c from ponto.contador_nsr where singleton for update;
  select * into i from ponto.intencao x where x.idempotency_key = p_key;
  if i.idempotency_key is null or i.auth_user_id <> p_user or i.employee_id <> a.employee_id then
    raise exception 'INTENCAO_NAO_AUTORIZADA' using errcode = 'P0001'; end if;
  -- Revisão 4C: hora de captura informada pelo aparelho fora de [-10 min, +150 s] da intenção => localização não comprovada.
  if loc ? 'captured_at' and loc->>'captured_at' is not null then
    captured := (loc->>'captured_at')::timestamptz;
    if captured - i.marking_at > interval '150 seconds' or i.marking_at - captured > interval '10 minutes' then
      loc := jsonb_build_object('status','UNKNOWN','latitude',null,'longitude',null,'accuracy_meters',null,'captured_at',null,
        'provider','BROWSER_GEOLOCATION','mock_signal','NOT_EXPOSED');
    end if;
  end if;
  req := ponto.hash(loc::text);
  select * into m from ponto.marcacao x where x.idempotency_key = p_key;
  if m.nsr is not null then
    if m.request_hash <> req then raise exception 'INTENCAO_CONFLITANTE' using errcode = 'P0001'; end if;
    return query select m, true; return;
  end if;
  -- Marco 4F: sem CPF cadastrado não há marcação (o AFD exige o CPF do empregado).
  select x.cpf into v_cpf from private.employee_cpf_4f x where x.employee_id = a.employee_id;
  if v_cpf is null then raise exception 'CPF_NAO_CADASTRADO' using errcode = 'P0001'; end if;
  if clock_timestamp() < i.marking_at or clock_timestamp() - i.marking_at > interval '120 seconds' then
    raise exception 'INTENCAO_EXPIRADA' using errcode = 'P0001'; end if;
  m.nsr := c.ultimo_nsr + 1; m.event_id := gen_random_uuid(); m.idempotency_key := p_key;
  m.auth_user_id := p_user; m.employee_id := a.employee_id; m.employee_name := a.employee_name; m.employee_code := a.employee_code;
  m.marking_at := i.marking_at; m.recorded_at := date_trunc('milliseconds', clock_timestamp());
  m.timezone := 'America/Fortaleza'; m.collector := 'BROWSER'; m.online := true; m.location := loc; m.request_hash := req;
  m.previous_hash := c.ultimo_hash; m.hash_version := 1;
  m.payload_hash := ponto.hash(ponto.canonico(m));
  m.employee_cpf := v_cpf;
  m.afd_hash := ponto.hash(ponto.afd_linha7(m) || coalesce(c.ultimo_afd_hash, ''));
  insert into ponto.marcacao select m.*;
  update ponto.contador_nsr set ultimo_nsr = m.nsr, ultimo_hash = m.payload_hash, ultimo_afd_hash = m.afd_hash where singleton;
  return query select m, false;
end $function$;

-- Verificação: além da corrente interna, confere a corrente do AFD (a partir da primeira marcação com CPF).
create or replace function ponto.verificar(out ok boolean, out total bigint, out motivo text) returns record language plpgsql stable set search_path to '' as $function$
declare r ponto.marcacao; esperado bigint := 0; anterior text := null; anterior_afd text := null; c ponto.contador_nsr;
begin
  ok := true; total := 0; motivo := null;
  for r in select * from ponto.marcacao order by nsr loop
    esperado := esperado + 1; total := total + 1;
    if r.nsr <> esperado then ok := false; motivo := 'NSR_COM_BURACO_' || esperado; return; end if;
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
  select * into c from ponto.contador_nsr where singleton;
  if c.ultimo_nsr <> total or c.ultimo_hash is distinct from anterior or c.ultimo_afd_hash is distinct from anterior_afd then ok := false; motivo := 'CONTADOR_DIVERGENTE'; end if;
end $function$;

select '4F pronto' as status;
