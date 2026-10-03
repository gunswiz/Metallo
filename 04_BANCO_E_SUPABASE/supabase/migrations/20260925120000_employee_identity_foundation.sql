-- Marco 1A: isolated identity foundation. Review migration history before remote application.
-- No account is provisioned or activated by this migration.
-- Personal access is independent of the Management profiles.role value.
create table private.employee_portal_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  registered_by uuid not null references auth.users(id) on delete restrict,
  registered_at timestamptz not null default now()
);
alter table private.employee_portal_accounts enable row level security;
revoke all on private.employee_portal_accounts from public, anon, authenticated;

create table private.employee_identity (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  verification_method text not null check (verification_method in ('in_person', 'hr_record')),
  linked_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revocation_reason text check (revocation_reason in ('employment_ended', 'wrong_association', 'account_replaced', 'other')),
  constraint employee_identity_revocation_complete check (
    (status = 'active' and revoked_at is null and revoked_by is null and revocation_reason is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by is not null and revocation_reason is not null)
  )
);
create unique index employee_identity_active_employee_uq
  on private.employee_identity(employee_id) where status = 'active';
create index employee_identity_employee_history_idx
  on private.employee_identity(employee_id, created_at desc);
create index employee_identity_linked_by_idx on private.employee_identity(linked_by);
create index employee_identity_revoked_by_idx on private.employee_identity(revoked_by);
alter table private.employee_identity enable row level security;
revoke all on private.employee_identity from public, anon, authenticated;

create table private.employee_identity_audit (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references private.employee_identity(id) on delete restrict,
  auth_user_id uuid not null,
  employee_id uuid not null,
  event_type text not null check (event_type in ('linked', 'revoked')),
  status text not null check (status in ('active', 'revoked')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_at timestamptz not null default now(),
  verification_method text,
  reason text,
  constraint employee_identity_audit_event_shape check (
    (event_type = 'linked' and status = 'active' and verification_method is not null and reason is null)
    or (event_type = 'revoked' and status = 'revoked' and verification_method is null and reason is not null)
  )
);
create index employee_identity_audit_identity_idx
  on private.employee_identity_audit(identity_id, event_at desc);
create index employee_identity_audit_actor_idx
  on private.employee_identity_audit(actor_id, event_at desc);
alter table private.employee_identity_audit enable row level security;
revoke all on private.employee_identity_audit from public, anon, authenticated;

create function private.guard_employee_identity_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'identity_history_is_immutable';
  end if;
  if row(new.id, new.auth_user_id, new.employee_id, new.verification_method,
         new.linked_by, new.created_at, new.activated_at)
     is distinct from
     row(old.id, old.auth_user_id, old.employee_id, old.verification_method,
         old.linked_by, old.created_at, old.activated_at)
     or old.status <> 'active' or new.status <> 'revoked'
     or new.revoked_at is null or new.revoked_by is null
     or new.revocation_reason is null then
    raise exception 'identity_history_is_immutable';
  end if;
  return new;
end;
$$;
create trigger employee_identity_guard_update
before update or delete on private.employee_identity
for each row execute function private.guard_employee_identity_history();

create function private.audit_employee_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into private.employee_identity_audit(
      identity_id, auth_user_id, employee_id, event_type, status, actor_id, verification_method
    ) values (new.id, new.auth_user_id, new.employee_id, 'linked', new.status,
              new.linked_by, new.verification_method);
  elsif tg_op = 'UPDATE' then
    insert into private.employee_identity_audit(
      identity_id, auth_user_id, employee_id, event_type, status, actor_id, reason
    ) values (new.id, new.auth_user_id, new.employee_id, 'revoked', new.status,
              new.revoked_by, new.revocation_reason);
  end if;
  return new;
end;
$$;
create trigger employee_identity_audit_event
after insert or update on private.employee_identity
for each row execute function private.audit_employee_identity();

create function private.prevent_employee_identity_audit_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'identity_audit_is_immutable';
end;
$$;
create trigger employee_identity_audit_immutable
before update or delete on private.employee_identity_audit
for each row execute function private.prevent_employee_identity_audit_change();

revoke all on function private.guard_employee_identity_history(),
  private.audit_employee_identity(), private.prevent_employee_identity_audit_change()
  from public, anon, authenticated;

-- A portal account must never be made an active Management profile.
create function private.prevent_portal_management_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from private.employee_portal_accounts a where a.auth_user_id = new.id
  ) and new.active then
    raise exception 'portal_account_cannot_be_management_active' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger prevent_portal_management_activation
before insert or update of active on public.profiles
for each row execute function private.prevent_portal_management_activation();
revoke all on function private.prevent_portal_management_activation()
  from public, anon, authenticated;

create function private.is_portal_account(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.employee_portal_accounts a where a.auth_user_id = p_user_id
  );
$$;
revoke all on function private.is_portal_account(uuid) from public, anon, authenticated;

-- Existing helpers retain Management behavior, while portal accounts cannot
-- use their SECURITY DEFINER privileges to inspect arbitrary team IDs.
create or replace function public.stock_team(p_team_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(w.stock_team_id, t.id)
    from public.teams t left join public.worksites w on w.id = t.worksite_id
    where t.id = p_team_id and not private.is_portal_account((select auth.uid()));
$$;
create or replace function public.employee_work_team(
  p_employee_id uuid, p_at timestamptz default now()
) returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce((
    select a.team_id from public.employee_assignments a
    where a.employee_id = e.id and a.starts_at <= p_at
      and (a.ends_at is null or a.ends_at > p_at)
    order by a.starts_at desc limit 1
  ), e.team_id)
  from public.epi_employees e
  where e.id = p_employee_id and not private.is_portal_account((select auth.uid()));
$$;

-- Future account provisioning must be a separate server flow that sets this
-- server-owned Auth marker. Existing create-employee does not set it.
create function public.admin_register_portal_account(p_auth_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_auth_user_id is null or not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = p_auth_user_id and not p.active
      and u.raw_app_meta_data ->> 'metallo_account_type' = 'employee_portal'
  ) then
    raise exception 'dedicated_portal_account_required' using errcode = '22023';
  end if;
  insert into private.employee_portal_accounts(auth_user_id, registered_by)
    values (p_auth_user_id, v_actor);
end;
$$;
revoke all on function public.admin_register_portal_account(uuid) from public, anon;
grant execute on function public.admin_register_portal_account(uuid) to authenticated;

-- Identity writes require an active administrator. The personal read API below
-- is separate and derives the employee ID from auth.uid().
create function public.admin_link_employee_identity(
  p_auth_user_id uuid, p_employee_id uuid, p_expected_employee_name text,
  p_expected_registration_code text, p_verification_method text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_employee_name text;
  v_registration_code text;
  v_identity_id uuid;
begin
  if v_actor is null or not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_auth_user_id is null or p_employee_id is null or
     p_verification_method is null or
     p_verification_method not in ('in_person', 'hr_record') or
     p_expected_employee_name is null or
     nullif(btrim(p_expected_employee_name), '') is null or
     p_expected_registration_code is null or
     nullif(btrim(p_expected_registration_code), '') is null then
    raise exception 'invalid_identity_request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.employee_portal_accounts a
      join public.profiles p on p.id = a.auth_user_id
    where a.auth_user_id = p_auth_user_id and not p.active
  ) then
    raise exception 'registered_portal_account_required' using errcode = '22023';
  end if;
  select e.full_name, e.registration_code into v_employee_name, v_registration_code
    from public.epi_employees e where e.id = p_employee_id and e.active;
  if v_employee_name is null or v_employee_name <> btrim(p_expected_employee_name)
     or v_registration_code is null
     or v_registration_code <> btrim(p_expected_registration_code) then
    raise exception 'employee_confirmation_mismatch' using errcode = '22023';
  end if;
  insert into private.employee_identity(
    auth_user_id, employee_id, verification_method, linked_by
  ) values (p_auth_user_id, p_employee_id, p_verification_method, v_actor)
  returning id into v_identity_id;
  return v_identity_id;
end;
$$;
revoke all on function public.admin_link_employee_identity(uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.admin_link_employee_identity(uuid, uuid, text, text, text)
  to authenticated;

create function public.admin_revoke_employee_identity(
  p_identity_id uuid, p_reason text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_user_id uuid;
begin
  if v_actor is null or not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
    ('employment_ended', 'wrong_association', 'account_replaced', 'other') then
    raise exception 'invalid_revocation_reason' using errcode = '22023';
  end if;
  update private.employee_identity
    set status = 'revoked', revoked_at = now(), revoked_by = v_actor,
        revocation_reason = p_reason
    where id = p_identity_id and status = 'active'
    returning auth_user_id into v_user_id;
  if v_user_id is null then
    -- A retry must still be able to finish the Auth ban after a partial failure.
    select auth_user_id into v_user_id from private.employee_identity
      where id = p_identity_id and status = 'revoked'
        and revocation_reason = p_reason;
    if v_user_id is null then
      raise exception 'active_identity_not_found' using errcode = '22023';
    end if;
  end if;
  update public.profiles set active = false, updated_at = now()
    where id = v_user_id;
  if not found then
    raise exception 'portal_profile_not_found' using errcode = '22023';
  end if;
  return v_user_id;
end;
$$;
revoke all on function public.admin_revoke_employee_identity(uuid, text)
  from public, anon;
grant execute on function public.admin_revoke_employee_identity(uuid, text)
  to authenticated;

-- Minimal personal DTO. No employee_id input, no ASO or clothing sizes.
create function public.my_employee_profile()
returns table(employee_id uuid, full_name text, profession text, team_name text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.full_name, e.profession, t.name
  from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    join public.teams t on t.id = e.team_id and t.active
  where i.auth_user_id = (select auth.uid()) and i.status = 'active';
$$;
revoke all on function public.my_employee_profile() from public, anon;
grant execute on function public.my_employee_profile() to authenticated;
