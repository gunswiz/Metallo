-- Marco 5A — Treinamentos (NR) e ASO com vencimento.
-- Aplicar no laboratório local e no TESTE ONLINE. NÃO aplicar na produção sem autorização.
-- Tudo em schema private (fora da API); acesso só por funções com checagem de permissão.
-- Vencimento: ASO vencido ou treinamento obrigatório vencido/ausente = funcionário NÃO apto para a atividade.

begin;

-- 1) Tipos de treinamento ------------------------------------------------------
create table if not exists private.training_types_5a (
  code text primary key check (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text not null check (length(btrim(name)) between 2 and 80),
  nr text check (nr is null or nr ~ '^NR-[0-9]{2}$'),
  -- null = sem vencimento fixo (a empresa define reciclagem quando houver mudança de função, equipamento etc.)
  validity_months integer check (validity_months is null or validity_months between 1 and 120),
  active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id)
);
-- Prazos de reciclagem conhecidos (conferir com o SESMT/engenheiro de segurança antes do uso real).
insert into private.training_types_5a(code,name,nr,validity_months) values
  ('NR35','Trabalho em altura','NR-35',24),
  ('NR33','Espaço confinado (trabalhador)','NR-33',12),
  ('NR10','Segurança em eletricidade (básico)','NR-10',24),
  ('NR12','Máquinas e equipamentos','NR-12',null),
  ('NR18','Construção (treinamento básico)','NR-18',null),
  ('NR06','Uso, guarda e conservação de EPI','NR-06',null),
  ('NR11','Movimentação de cargas (operador)','NR-11',null)
on conflict (code) do nothing;

-- 2) Treinamentos exigidos por função -----------------------------------------
create table if not exists private.profession_trainings_5a (
  profession text not null check (length(profession) between 1 and 60),
  type_code text not null references private.training_types_5a(code),
  primary key (profession, type_code)
);
create index if not exists profession_trainings_5a_type_idx on private.profession_trainings_5a(type_code);

-- 3) Treinamentos realizados (histórico imutável: novo registro substitui o anterior) ---
create table if not exists private.employee_trainings_5a (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  employee_id uuid not null references public.epi_employees(id),
  type_code text not null references private.training_types_5a(code),
  completed_on date not null,
  expires_on date,
  provider text check (provider is null or length(provider) <= 120),
  workload_hours numeric(5,1) check (workload_hours is null or workload_hours between 0.5 and 400),
  note text check (note is null or length(note) <= 240),
  status text not null default 'ATIVO' check (status in ('ATIVO','SUBSTITUIDO','CANCELADO')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references auth.users(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  cancel_reason text check (cancel_reason is null or length(cancel_reason) between 3 and 240),
  check (expires_on is null or expires_on > completed_on),
  check ((status = 'CANCELADO') = (cancel_reason is not null))
);
create unique index if not exists employee_trainings_5a_one_active on private.employee_trainings_5a(employee_id, type_code) where status = 'ATIVO';
create index if not exists employee_trainings_5a_expiry_idx on private.employee_trainings_5a(expires_on) where status = 'ATIVO';
create index if not exists employee_trainings_5a_type_idx on private.employee_trainings_5a(type_code);
create index if not exists employee_trainings_5a_created_by_idx on private.employee_trainings_5a(created_by);
create index if not exists employee_trainings_5a_closed_by_idx on private.employee_trainings_5a(closed_by);

-- Ninguém apaga histórico; dados do treinamento não mudam (só o estado ATIVO -> SUBSTITUIDO/CANCELADO).
create or replace function private.treinamento_imutavel_5a() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op = 'DELETE' then raise exception 'training_history_immutable'; end if;
  if old.status <> 'ATIVO' or new.employee_id <> old.employee_id or new.type_code <> old.type_code
    or new.completed_on <> old.completed_on or new.expires_on is distinct from old.expires_on
    or new.provider is distinct from old.provider or new.workload_hours is distinct from old.workload_hours
    or new.note is distinct from old.note or new.created_at <> old.created_at or new.created_by <> old.created_by
    or new.idempotency_key <> old.idempotency_key or new.status = 'ATIVO'
  then raise exception 'training_history_immutable'; end if;
  return new;
end $$;
drop trigger if exists treinamento_imutavel_5a on private.employee_trainings_5a;
create trigger treinamento_imutavel_5a before update or delete on private.employee_trainings_5a
  for each row execute function private.treinamento_imutavel_5a();

alter table private.training_types_5a enable row level security;
alter table private.profession_trainings_5a enable row level security;
alter table private.employee_trainings_5a enable row level security;
revoke all on private.training_types_5a, private.profession_trainings_5a, private.employee_trainings_5a
  from public, anon, authenticated, service_role;

-- 4) Regras comuns ----------------------------------------------------------------
create or replace function private.hoje_5a() returns date language sql stable set search_path='' as $$
  select (pg_catalog.now() at time zone 'America/Fortaleza')::date;
$$;
create or replace function private.situacao_5a(p_expires date) returns text language sql stable set search_path='' as $$
  select case when p_expires is null then 'SEM_VENCIMENTO'
    when p_expires < private.hoje_5a() then 'VENCIDO'
    when p_expires <= private.hoje_5a() + 30 then 'VENCE_EM_BREVE'
    else 'EM_DIA' end;
$$;
-- Gestão pode ver/registrar se tiver EPI na equipe do funcionário; sem equipe, só o administrador.
create or replace function private.gestao_pode_5a(p_team uuid) returns boolean language sql stable security definer set search_path='' as $$
  select case when p_team is not null then public.can_operate('epi:write', p_team)
    else exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin') end;
$$;

-- Ficha de treinamentos de um funcionário (usada pela Gestão e pelo próprio funcionário).
create or replace function private.ficha_5a(p_employee uuid) returns jsonb language sql stable security definer set search_path='' as $$
  with e as (select * from public.epi_employees where id = p_employee),
  ativos as (
    select t.id, t.type_code, ty.name, ty.nr, t.completed_on, t.expires_on, t.provider, t.workload_hours,
      private.situacao_5a(t.expires_on) situacao
    from private.employee_trainings_5a t join private.training_types_5a ty on ty.code = t.type_code
    where t.employee_id = p_employee and t.status = 'ATIVO'
  ),
  exigidos as (
    select pt.type_code, ty.name, ty.nr from e
    join private.profession_trainings_5a pt on pt.profession = e.profession
    join private.training_types_5a ty on ty.code = pt.type_code and ty.active
  ),
  faltando as (select x.* from exigidos x where not exists (select 1 from ativos a where a.type_code = x.type_code)),
  aso as (select e.aso_exam_date, e.aso_expiry_date,
    case when e.aso_expiry_date is null then 'NAO_INFORMADO' else private.situacao_5a(e.aso_expiry_date) end situacao from e)
  select jsonb_build_object(
    'employee_id', e.id, 'name', e.full_name, 'profession', e.profession, 'team_id', e.team_id,
    'aso', (select to_jsonb(aso) from aso),
    'trainings', coalesce((select jsonb_agg(to_jsonb(a) || jsonb_build_object('required',
        exists(select 1 from exigidos x where x.type_code = a.type_code)) order by a.expires_on nulls last, a.name) from ativos a), '[]'::jsonb),
    'missing', coalesce((select jsonb_agg(to_jsonb(f) order by f.name) from faltando f), '[]'::jsonb),
    'situacao', case
      when (select situacao from aso) = 'VENCIDO'
        or exists(select 1 from ativos a join exigidos x on x.type_code = a.type_code where a.situacao = 'VENCIDO') then 'VENCIDO'
      when (select situacao from aso) = 'NAO_INFORMADO' or exists(select 1 from faltando) then 'FALTANDO'
      when (select situacao from aso) = 'VENCE_EM_BREVE'
        or exists(select 1 from ativos a where a.situacao in ('VENCE_EM_BREVE','VENCIDO')) then 'VENCE_EM_BREVE'
      else 'EM_DIA' end)
  from e;
$$;
revoke all on function private.hoje_5a(), private.situacao_5a(date), private.gestao_pode_5a(uuid), private.ficha_5a(uuid),
  private.treinamento_imutavel_5a() from public, anon, authenticated, service_role;

-- 5) Gestão -----------------------------------------------------------------------
create or replace function public.admin_trainings_overview_5a() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  -- Só conta ativa da Gestão (conta do app do Funcionário tem perfil inativo na Gestão).
  if (select auth.uid()) is null or not exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
    then raise exception 'forbidden_training'; end if;
  return coalesce((select jsonb_agg(private.ficha_5a(e.id) || jsonb_build_object('team_name', t.name) order by e.full_name)
    from public.epi_employees e left join public.teams t on t.id = e.team_id
    where e.active and private.gestao_pode_5a(e.team_id)), '[]'::jsonb);
end $$;

create or replace function public.admin_training_catalog_5a() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
    and (p.role = 'admin' or public.can_operate('epi:write', null))) then raise exception 'forbidden_training'; end if;
  return jsonb_build_object(
    'types', coalesce((select jsonb_agg(to_jsonb(t) - 'updated_by' order by t.nr nulls last, t.name) from private.training_types_5a t), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(r) order by r.profession, r.type_code) from private.profession_trainings_5a r), '[]'::jsonb));
end $$;

create or replace function public.save_training_type_5a(p_code text, p_name text, p_nr text, p_validity_months integer, p_active boolean)
returns text language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.is_active_admin() then raise exception 'forbidden_training'; end if;
  p_code := upper(btrim(p_code)); p_name := btrim(p_name); p_nr := nullif(btrim(p_nr), '');
  if p_code !~ '^[A-Z0-9_-]{2,20}$' or p_name is null or length(p_name) not between 2 and 80 or p_name ~ '[<>[:cntrl:]]'
    or (p_nr is not null and p_nr !~ '^NR-[0-9]{2}$') or (p_validity_months is not null and p_validity_months not between 1 and 120)
  then raise exception 'invalid_training_type'; end if;
  insert into private.training_types_5a(code, name, nr, validity_months, active, updated_by)
  values (p_code, p_name, p_nr, p_validity_months, coalesce(p_active, true), (select auth.uid()))
  on conflict (code) do update set name = excluded.name, nr = excluded.nr, validity_months = excluded.validity_months,
    active = excluded.active, updated_at = clock_timestamp(), updated_by = excluded.updated_by;
  return p_code;
end $$;

create or replace function public.set_profession_trainings_5a(p_profession text, p_type_codes text[])
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if (select auth.uid()) is null or not public.is_active_admin() then raise exception 'forbidden_training'; end if;
  if not exists(select 1 from public.epi_professions where code = p_profession) then raise exception 'invalid_profession'; end if;
  if exists(select 1 from unnest(coalesce(p_type_codes, '{}')) c where not exists(select 1 from private.training_types_5a t where t.code = c))
    then raise exception 'invalid_training_type'; end if;
  delete from private.profession_trainings_5a where profession = p_profession;
  insert into private.profession_trainings_5a(profession, type_code)
    select distinct p_profession, c from unnest(coalesce(p_type_codes, '{}')) c;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.register_training_5a(p_employee_id uuid, p_type_code text, p_completed_on date, p_expires_on date,
  p_provider text, p_workload_hours numeric, p_note text, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid := (select auth.uid()); v_team uuid; v_type private.training_types_5a%rowtype;
  v_expires date; v_existing private.employee_trainings_5a%rowtype; v_id uuid;
begin
  if v_actor is null or p_employee_id is null or p_idempotency_key is null then raise exception 'invalid_training'; end if;
  select team_id into v_team from public.epi_employees where id = p_employee_id and active;
  if not found or not private.gestao_pode_5a(v_team) then raise exception 'forbidden_training'; end if;
  select * into v_type from private.training_types_5a where code = p_type_code and active;
  if not found then raise exception 'invalid_training_type'; end if;
  p_provider := nullif(btrim(p_provider), ''); p_note := nullif(btrim(p_note), '');
  if p_completed_on is null or p_completed_on > private.hoje_5a() or p_completed_on < date '1990-01-01'
    or (p_provider is not null and (length(p_provider) > 120 or p_provider ~ '[<>[:cntrl:]]'))
    or (p_note is not null and (length(p_note) > 240 or p_note ~ '[<>[:cntrl:]]'))
  then raise exception 'invalid_training'; end if;
  -- Sem data informada, a validade vem do tipo (meses de reciclagem).
  v_expires := coalesce(p_expires_on, case when v_type.validity_months is null then null
    else (p_completed_on + make_interval(months => v_type.validity_months))::date end);
  if v_expires is not null and v_expires <= p_completed_on then raise exception 'invalid_training'; end if;
  select * into v_existing from private.employee_trainings_5a where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.employee_id <> p_employee_id or v_existing.type_code <> p_type_code or v_existing.completed_on <> p_completed_on
      or v_existing.created_by <> v_actor then raise exception 'idempotency_conflict'; end if;
    return v_existing.id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_employee_id::text || p_type_code, 5051));
  update private.employee_trainings_5a set status = 'SUBSTITUIDO', closed_at = clock_timestamp(), closed_by = v_actor
    where employee_id = p_employee_id and type_code = p_type_code and status = 'ATIVO';
  insert into private.employee_trainings_5a(idempotency_key, employee_id, type_code, completed_on, expires_on, provider,
    workload_hours, note, created_by)
  values (p_idempotency_key, p_employee_id, p_type_code, p_completed_on, v_expires, p_provider, p_workload_hours, p_note, v_actor)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_training_5a(p_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_row private.employee_trainings_5a%rowtype; v_team uuid;
begin
  p_reason := btrim(p_reason);
  if (select auth.uid()) is null or p_reason is null or length(p_reason) not between 3 and 240 or p_reason ~ '[<>[:cntrl:]]'
    then raise exception 'invalid_training'; end if;
  select * into v_row from private.employee_trainings_5a where id = p_id and status = 'ATIVO' for update;
  if not found then raise exception 'training_unavailable'; end if;
  select team_id into v_team from public.epi_employees where id = v_row.employee_id;
  if not private.gestao_pode_5a(v_team) then raise exception 'forbidden_training'; end if;
  update private.employee_trainings_5a set status = 'CANCELADO', closed_at = clock_timestamp(),
    closed_by = (select auth.uid()), cancel_reason = p_reason where id = p_id;
  return p_id;
end $$;

-- 6) App do Funcionário: só a própria ficha ------------------------------------------
create or replace function public.my_trainings_5a() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_employee uuid;
begin
  select e.id into v_employee from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    where i.auth_user_id = (select auth.uid()) and i.status = 'active';
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  return private.ficha_5a(v_employee) - 'team_id' - 'employee_id';
end $$;

revoke all on function public.admin_trainings_overview_5a(), public.admin_training_catalog_5a(),
  public.save_training_type_5a(text,text,text,integer,boolean), public.set_profession_trainings_5a(text,text[]),
  public.register_training_5a(uuid,text,date,date,text,numeric,text,uuid), public.cancel_training_5a(uuid,text),
  public.my_trainings_5a() from public, anon, service_role;
grant execute on function public.admin_trainings_overview_5a(), public.admin_training_catalog_5a(),
  public.save_training_type_5a(text,text,text,integer,boolean), public.set_profession_trainings_5a(text,text[]),
  public.register_training_5a(uuid,text,date,date,text,numeric,text,uuid), public.cancel_training_5a(uuid,text),
  public.my_trainings_5a() to authenticated;

select jsonb_build_object('ok', true, 'marco', '5A treinamentos pronto') resultado;
commit;
