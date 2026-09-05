-- Correct confirmed functional failures without changing operational data.
-- This migration is intentionally backward compatible with the installed app.

-- Pending users must be able to read their own profile. Active users keep the
-- existing broader read access needed by the operational dashboards.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_active_user())
);

-- Profile changes must reach the signed-in device so role, team and access
-- changes no longer require a new login.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- Never allow the only active administrator to remove their own last usable
-- administrator role. The check and update run in the same transaction.
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_role text,
  p_team_id uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.profiles%rowtype;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required';
  end if;
  if p_role not in ('admin', 'engineer', 'leader', 'collaborator') then
    raise exception 'invalid_role';
  end if;
  if nullif(trim(p_full_name), '') is null then
    raise exception 'name_required';
  end if;
  if p_role in ('leader', 'collaborator') and p_team_id is null then
    raise exception 'team_required';
  end if;
  if p_team_id is not null and not exists (
    select 1 from public.teams where id = p_team_id and active
  ) then
    raise exception 'invalid_team';
  end if;

  select * into v_current
  from public.profiles
  where id = p_user_id
  for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_current.active
     and v_current.role = 'admin'
     and (coalesce(p_active, true) is not true or p_role <> 'admin')
     and (
       select count(*) from public.profiles
       where active and role = 'admin'
     ) <= 1 then
    raise exception 'last_admin_required';
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      role = p_role,
      team_id = p_team_id,
      active = coalesce(p_active, true),
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke execute on function public.admin_update_profile(
  uuid, text, text, uuid, boolean
) from public, anon;
grant execute on function public.admin_update_profile(
  uuid, text, text, uuid, boolean
) to authenticated;

-- A central location and teams referenced by active EPI workflows cannot be
-- deactivated. All dependency checks happen while the team row is locked.
create or replace function public.delete_team_admin(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_type text;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required';
  end if;

  select location_type into v_location_type
  from public.teams
  where id = p_team_id and active
  for update;
  if not found then raise exception 'team_not_found'; end if;
  if v_location_type = 'central' then
    raise exception 'central_team_required';
  end if;
  if exists (
    select 1 from public.inventory where team_id = p_team_id and quantity > 0
  ) then
    raise exception 'team_has_inventory';
  end if;
  if exists (
    select 1 from public.assets where team_id = p_team_id and active
  ) then
    raise exception 'team_has_assets';
  end if;
  if exists (
    select 1 from public.profiles where team_id = p_team_id and active
  ) then
    raise exception 'team_has_active_users';
  end if;
  if exists (
    select 1 from public.epi_employees where team_id = p_team_id and active
  ) then
    raise exception 'team_has_epi_employees';
  end if;
  if exists (
    select 1 from public.epi_requests
    where team_id = p_team_id and status = 'pending'
  ) then
    raise exception 'team_has_epi_requests';
  end if;
  if exists (
    select 1 from public.epi_deliveries
    where team_id = p_team_id and current_status = 'active'
  ) then
    raise exception 'team_has_epi_deliveries';
  end if;

  update public.teams
  set active = false, updated_at = now()
  where id = p_team_id;
end;
$$;

revoke execute on function public.delete_team_admin(uuid) from public, anon;
grant execute on function public.delete_team_admin(uuid) to authenticated;

-- Keep an immutable internal identity for built-in EPI semantics. Display code
-- and name remain editable without breaking boot/glasses variants or kits.
alter table public.epi_items
  add column if not exists system_key text;

update public.epi_items
set system_key = upper(code)
where system_key is null
  and upper(code) in (
    'EPI-CAP', 'EPI-OCU', 'EPI-AUR', 'EPI-BOT', 'EPI-LUV-RASPA',
    'EPI-MASC-SOLDA', 'EPI-AVENTAL', 'EPI-RESP-PINT', 'FARD-AZUL',
    'FARD-CINZA', 'PES-TRENA', 'PES-ESQ', 'PES-RISC', 'PES-LAPIS',
    'PES-BAT-SOLDA'
  );

create unique index if not exists epi_items_system_key_unique
  on public.epi_items(system_key)
  where system_key is not null;

create or replace function public.preserve_epi_item_system_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.system_key is not null
     and new.system_key is distinct from old.system_key then
    raise exception 'immutable_epi_system_key';
  end if;
  return new;
end;
$$;

revoke execute on function public.preserve_epi_item_system_key()
  from public, anon, authenticated;
drop trigger if exists preserve_epi_item_system_key on public.epi_items;
create trigger preserve_epi_item_system_key
before update on public.epi_items
for each row execute function public.preserve_epi_item_system_key();

-- Qualify both sides of the team comparison. The previous expression compared
-- epi_employees.team_id with itself and therefore accepted a stale client team.
drop policy if exists epi_requests_create on public.epi_requests;
create policy epi_requests_create on public.epi_requests
for insert to authenticated
with check (
  status = 'pending'
  and requested_by = (select auth.uid())
  and fulfilled_by is null
  and fulfilled_at is null
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  )
  and exists (
    select 1 from public.epi_employees e
    where e.id = epi_requests.employee_id
      and e.team_id = epi_requests.team_id
      and e.active
  )
  and exists (
    select 1 from public.epi_items i
    where i.id = epi_requests.item_id and i.active
  )
);

-- New clients request through this transaction-safe RPC. The team and audit
-- user are derived server-side, eliminating stale or forged client values.
create or replace function public.request_epi_item(
  p_employee_id uuid,
  p_item_id uuid,
  p_quantity integer,
  p_requested_variant text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.epi_employees%rowtype;
  v_item public.epi_items%rowtype;
  v_variant text := nullif(trim(coalesce(p_requested_variant, '')), '');
  v_request_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
    raise exception 'forbidden';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active;
  if not found then raise exception 'employee_not_found'; end if;

  select * into v_item
  from public.epi_items
  where id = p_item_id and active;
  if not found then raise exception 'epi_item_not_found'; end if;

  if coalesce(v_item.system_key, upper(v_item.code)) = 'EPI-BOT' then
    if v_variant is null or v_variant !~ '^(3[8-9]|4[0-6])$' then
      raise exception 'shoe_size_required';
    end if;
  elsif coalesce(v_item.system_key, upper(v_item.code)) = 'EPI-OCU' then
    if lower(coalesce(v_variant, '')) not in ('claro', 'escuro') then
      raise exception 'glasses_variant_required';
    end if;
    v_variant := initcap(lower(v_variant));
  end if;

  insert into public.epi_requests (
    employee_id, team_id, item_id, quantity, requested_variant, requested_by
  ) values (
    v_employee.id, v_employee.team_id, v_item.id, p_quantity, v_variant,
    (select auth.uid())
  ) returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.request_epi_item(
  uuid, uuid, integer, text
) from public, anon;
grant execute on function public.request_epi_item(
  uuid, uuid, integer, text
) to authenticated;

-- Equipment type and individual asset are now updated in one database
-- transaction, avoiding half-saved edits if the second update fails.
create or replace function public.update_equipment_admin(
  p_item_id uuid,
  p_item_code text,
  p_item_name text,
  p_asset_id uuid,
  p_asset_code text,
  p_serial_number text,
  p_team_id uuid,
  p_status text,
  p_notes text,
  p_active boolean default true
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_admin() then
    raise exception 'admin_required';
  end if;
  if nullif(trim(p_item_code), '') is null
     or nullif(trim(p_item_name), '') is null
     or nullif(trim(p_asset_code), '') is null then
    raise exception 'required_equipment_field';
  end if;
  if p_status not in (
    'available', 'in_use', 'maintenance', 'damaged', 'lost', 'retired'
  ) then
    raise exception 'invalid_asset_status';
  end if;
  if not exists (
    select 1 from public.teams where id = p_team_id and active
  ) then
    raise exception 'invalid_team';
  end if;

  update public.items
  set code = trim(p_item_code),
      name = trim(p_item_name),
      updated_at = now()
  where id = p_item_id and item_type = 'equipment' and active;
  if not found then raise exception 'item_not_found'; end if;

  update public.assets
  set asset_code = trim(p_asset_code),
      serial_number = nullif(trim(coalesce(p_serial_number, '')), ''),
      team_id = p_team_id,
      status = p_status,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      active = coalesce(p_active, true),
      updated_at = now()
  where id = p_asset_id and item_id = p_item_id;
  if not found then raise exception 'asset_not_found'; end if;
end;
$$;

revoke execute on function public.update_equipment_admin(
  uuid, text, text, uuid, text, text, uuid, text, text, boolean
) from public, anon;
grant execute on function public.update_equipment_admin(
  uuid, text, text, uuid, text, text, uuid, text, text, boolean
) to authenticated;
