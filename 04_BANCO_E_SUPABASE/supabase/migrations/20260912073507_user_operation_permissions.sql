-- Explicit operator rights. NULL preserves existing role defaults; [] means read-only.
alter table public.profiles
  add column operation_permissions text[],
  add column operation_team_ids uuid[],
  add constraint profiles_operation_permissions_valid check (
    operation_permissions is null or (
      operation_permissions <@ array['materials:write','consumption:write','equipment:write','epi:write','requests:write','rentals:write']::text[]
      and array_position(operation_permissions, null) is null
      and cardinality(operation_permissions) <= 6
    )
  ),
  add constraint profiles_operation_teams_valid check (
    operation_team_ids is null or (array_position(operation_team_ids, null) is null and cardinality(operation_team_ids) <= 100)
  );

create or replace function public.can_operate(p_permission text, p_team_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.role = 'admin' or (
      p_permission = any(coalesce(p.operation_permissions,
        case p.role
          when 'engineer' then array['materials:write','consumption:write','equipment:write','epi:write','requests:write','rentals:write']
          when 'leader' then array['materials:write','consumption:write','equipment:write','requests:write','rentals:write']
          else array[]::text[] end))
      and (p_team_id is null or
        case when p.operation_team_ids is not null then p_team_id = any(p.operation_team_ids)
          else p.role = 'engineer' or p.team_id = p_team_id end)
    )
    from public.profiles p where p.id = (select auth.uid()) and p.active
  ), false);
$$;
revoke all on function public.can_operate(text, uuid) from public, anon;
grant execute on function public.can_operate(text, uuid) to authenticated, service_role;

create or replace function public.admin_update_profile_access(
  p_user_id uuid, p_full_name text, p_role text, p_team_id uuid, p_active boolean,
  p_operation_permissions text[], p_operation_team_ids uuid[]
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  perform public.admin_update_profile(p_user_id, p_full_name, p_role, p_team_id, p_active);
  update public.profiles
    set operation_permissions = p_operation_permissions, operation_team_ids = p_operation_team_ids
    where id = p_user_id;
end;
$$;
revoke all on function public.admin_update_profile_access(uuid,text,text,uuid,boolean,text[],uuid[]) from public, anon;
grant execute on function public.admin_update_profile_access(uuid,text,text,uuid,boolean,text[],uuid[]) to authenticated;

create table public.profile_access_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  previous_access jsonb,
  new_access jsonb not null
);
create index profile_access_audit_profile_idx on public.profile_access_audit(profile_id, changed_at desc);
create index profile_access_audit_actor_idx on public.profile_access_audit(changed_by);
alter table public.profile_access_audit enable row level security;
revoke all on public.profile_access_audit from anon, authenticated;
grant select on public.profile_access_audit to authenticated;
create policy profile_access_audit_admin_read on public.profile_access_audit for select to authenticated using ((select public.is_active_admin()));

create or replace function public.validate_profile_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
  if new.operation_team_ids is not null and exists (
    select 1 from unnest(new.operation_team_ids) t(id)
    where not exists (select 1 from public.teams where id = t.id and active)
  ) then raise exception 'invalid_team'; end if;
  v_new := jsonb_build_object('role', new.role, 'active', new.active, 'team_id', new.team_id,
    'permissions', new.operation_permissions, 'teams', new.operation_team_ids);
  if tg_op = 'UPDATE' then
    v_old := jsonb_build_object('role', old.role, 'active', old.active, 'team_id', old.team_id,
      'permissions', old.operation_permissions, 'teams', old.operation_team_ids);
  end if;
  if v_new is distinct from v_old then
    insert into public.profile_access_audit(profile_id, changed_by, previous_access, new_access)
      values(new.id, (select auth.uid()), v_old, v_new);
  end if;
  return new;
end;
$$;
revoke all on function public.validate_profile_access() from public, anon, authenticated;
create trigger validate_profile_access after insert or update of role, active, team_id, operation_permissions, operation_team_ids on public.profiles
for each row execute function public.validate_profile_access();

CREATE OR REPLACE FUNCTION public.create_material_for_team(p_code text, p_name text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT 'un'::text, p_minimum_stock integer DEFAULT 0, p_team_id uuid DEFAULT NULL::uuid, p_quantity integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team uuid; v_item_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select role,team_id into v_role,v_user_team from public.profiles where id=v_user_id and active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if not public.can_operate('materials:write') then raise exception 'forbidden_role'; end if;
 if p_team_id is null then raise exception 'team_required'; end if;
 if not public.can_operate('materials:write', p_team_id) then raise exception 'forbidden_team'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'invalid_quantity'; end if;
 if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then raise exception 'code_and_name_required'; end if;
 if not exists(select 1 from public.teams where id=p_team_id and active=true) then raise exception 'invalid_team'; end if;
 select id into v_item_id from public.items where lower(code)=lower(trim(p_code)) and active=true and item_type='material' limit 1;
 if v_item_id is null then
   insert into public.items(code,name,description,category,item_type,unit,minimum_stock,active)
   values(trim(p_code),trim(p_name),nullif(trim(p_description),''),nullif(trim(p_category),''),'material',coalesce(nullif(trim(p_unit),''),'un'),greatest(coalesce(p_minimum_stock,0),0),true)
   returning id into v_item_id;
 end if;
 insert into public.inventory(item_id,team_id,quantity,status) values(v_item_id,p_team_id,p_quantity,'available')
 on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by)
 values(v_item_id,null,p_team_id,p_quantity,'entry','Entrada de material',v_user_id);
 return v_item_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_equipment_for_team(p_code text, p_name text, p_asset_code text, p_serial_number text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team uuid; v_item_id uuid; v_asset_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select role,team_id into v_role,v_user_team from public.profiles where id=v_user_id and active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if not public.can_operate('equipment:write') then raise exception 'forbidden_role'; end if;
 if p_team_id is null then raise exception 'team_required'; end if;
 if not public.can_operate('equipment:write', p_team_id) then raise exception 'forbidden_team'; end if;
 if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null or nullif(trim(p_asset_code),'') is null then raise exception 'code_name_asset_required'; end if;
 if not exists(select 1 from public.teams where id=p_team_id and active=true) then raise exception 'invalid_team'; end if;
 select id into v_item_id from public.items where lower(code)=lower(trim(p_code)) and active=true and item_type='equipment' limit 1;
 if v_item_id is null then
   insert into public.items(code,name,description,category,item_type,unit,minimum_stock,active)
   values(trim(p_code),trim(p_name),nullif(trim(p_description),''),nullif(trim(p_category),''),'equipment','un',0,true)
   returning id into v_item_id;
 end if;
 insert into public.assets(item_id,asset_code,serial_number,team_id,status,notes,active)
 values(v_item_id,trim(p_asset_code),nullif(trim(p_serial_number),''),p_team_id,'available',nullif(trim(p_notes),''),true) returning id into v_asset_id;
 insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,previous_status,new_status,movement_type,note,performed_by)
 values(v_asset_id,null,p_team_id,'available','available','assign','Cadastro inicial',v_user_id);
 return v_asset_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_equipment_for_team_v2(p_code text, p_name text, p_asset_code text, p_serial_number text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_user_notes text DEFAULT NULL::text, p_ownership_type text DEFAULT 'owned'::text, p_rental_company text DEFAULT NULL::text, p_rental_start_date date DEFAULT NULL::date, p_rental_end_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_user_team uuid;
  v_item_id uuid;
  v_asset_id uuid;
  v_visible_notes text := public.asset_visible_notes(p_user_notes);
  v_legacy_notes text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select role, team_id into v_role, v_user_team
  from public.profiles where id = v_user_id and active;
  if not found then raise exception 'inactive_or_missing_profile'; end if;
  if not public.can_operate('equipment:write') then raise exception 'forbidden_role'; end if;
  if p_team_id is null then raise exception 'team_required'; end if;
  if not public.can_operate('equipment:write', p_team_id) then raise exception 'forbidden_team'; end if;
  if nullif(trim(p_code), '') is null
     or nullif(trim(p_name), '') is null
     or nullif(trim(p_asset_code), '') is null then
    raise exception 'code_name_asset_required';
  end if;
  if p_ownership_type not in ('owned', 'rented') then raise exception 'invalid_ownership_type'; end if;
  if p_ownership_type = 'rented' and nullif(trim(p_rental_company), '') is null then
    raise exception 'rental_company_required';
  end if;
  if p_rental_end_date is not null and p_rental_start_date is not null
     and p_rental_end_date < p_rental_start_date then raise exception 'invalid_rental_dates'; end if;
  if not exists(select 1 from public.teams where id = p_team_id and active) then raise exception 'invalid_team'; end if;

  select id into v_item_id from public.items
  where lower(code) = lower(trim(p_code)) and active and item_type = 'equipment'
  limit 1;
  if v_item_id is null then
    insert into public.items(code, name, description, category, item_type, unit, minimum_stock, active)
    values(trim(p_code), trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_category), ''), 'equipment', 'un', 0, true)
    returning id into v_item_id;
  end if;

  v_legacy_notes := '#metallo:ownership=' || p_ownership_type;
  if p_ownership_type = 'rented' then
    v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_company=' || public.asset_legacy_encode(p_rental_company);
    if p_rental_start_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_start=' || p_rental_start_date::text; end if;
    if p_rental_end_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_end=' || p_rental_end_date::text; end if;
  end if;
  if v_visible_notes is not null then v_legacy_notes := v_legacy_notes || E'\n' || v_visible_notes; end if;

  insert into public.assets(
    item_id, asset_code, serial_number, team_id, status, notes, user_notes,
    ownership_type, rental_company, rental_start_date, rental_end_date, active
  ) values (
    v_item_id, trim(p_asset_code), nullif(trim(p_serial_number), ''), p_team_id,
    'available', v_legacy_notes, v_visible_notes, p_ownership_type,
    case when p_ownership_type = 'rented' then trim(p_rental_company) else null end,
    case when p_ownership_type = 'rented' then p_rental_start_date else null end,
    case when p_ownership_type = 'rented' then p_rental_end_date else null end,
    true
  ) returning id into v_asset_id;

  insert into public.asset_movements(
    asset_id, origin_team_id, destination_team_id, previous_status,
    new_status, movement_type, note, performed_by
  ) values (
    v_asset_id, null, p_team_id, 'available', 'available', 'assign',
    'Cadastro inicial', v_user_id
  );
  return v_asset_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_movement(p_item_id uuid, p_movement_type text, p_quantity integer, p_origin_team_id uuid DEFAULT NULL::uuid, p_destination_team_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team_id uuid; v_movement_id uuid; v_remaining integer;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select p.role,p.team_id into v_role,v_user_team_id from public.profiles p where p.id=v_user_id and p.active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if not public.can_operate('materials:write') then raise exception 'forbidden_role'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'invalid_quantity'; end if;
 if p_movement_type not in ('entry','exit','transfer','return','maintenance') then raise exception 'invalid_movement_type'; end if;
 if not exists(select 1 from public.items i where i.id=p_item_id and i.active=true and i.item_type='material') then raise exception 'invalid_or_inactive_material'; end if;
 if p_movement_type='transfer' then
   if p_origin_team_id is null or p_destination_team_id is null or p_origin_team_id=p_destination_team_id then raise exception 'invalid_transfer_teams'; end if;
 elsif p_movement_type in ('exit','maintenance') then
   if p_origin_team_id is null or p_destination_team_id is not null then raise exception 'invalid_origin_destination'; end if;
 elsif p_movement_type in ('entry','return') then
   if p_destination_team_id is null or p_origin_team_id is not null then raise exception 'invalid_origin_destination'; end if;
 end if;
 if not public.can_operate('materials:write', coalesce(p_origin_team_id, p_destination_team_id)) then raise exception 'forbidden_team'; end if;
 if p_origin_team_id is not null then
   update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=p_origin_team_id and quantity>=p_quantity returning quantity into v_remaining;
   if not found then raise exception 'insufficient_stock'; end if;
 end if;
 if p_destination_team_id is not null then
   insert into public.inventory(item_id,team_id,quantity) values(p_item_id,p_destination_team_id,p_quantity)
   on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 end if;
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by)
 values(p_item_id,p_origin_team_id,p_destination_team_id,p_quantity,p_movement_type,nullif(trim(p_note),''),v_user_id) returning id into v_movement_id;
 return v_movement_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_asset_movement(p_asset_id uuid, p_movement_type text, p_destination_team_id uuid DEFAULT NULL::uuid, p_new_status text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team_id uuid; v_origin_team_id uuid; v_old_status text; v_target_team_id uuid; v_target_status text; v_movement_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select p.role,p.team_id into v_role,v_user_team_id from public.profiles p where p.id=v_user_id and p.active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if not public.can_operate('equipment:write') then raise exception 'forbidden_role'; end if;
 select a.team_id,a.status into v_origin_team_id,v_old_status from public.assets a join public.items i on i.id=a.item_id where a.id=p_asset_id and a.active=true and i.active=true and i.item_type='equipment' for update of a;
 if not found then raise exception 'invalid_or_inactive_asset'; end if;
 if not public.can_operate('equipment:write', v_origin_team_id) then raise exception 'forbidden_origin_team'; end if;
 if p_movement_type not in ('assign','transfer','return','maintenance','status_change') then raise exception 'invalid_asset_movement_type'; end if;
 v_target_team_id:=v_origin_team_id; v_target_status:=coalesce(p_new_status,v_old_status);
 if p_movement_type in ('assign','transfer','return') then
   if p_destination_team_id is null then raise exception 'destination_required'; end if;
   if p_movement_type='transfer' and p_destination_team_id=v_origin_team_id then raise exception 'same_team_transfer'; end if;
   v_target_team_id:=p_destination_team_id; if p_new_status is null then v_target_status:='available'; end if;
 elsif p_movement_type='maintenance' then v_target_status:='maintenance';
 elsif p_movement_type='status_change' and p_new_status is null then raise exception 'new_status_required'; end if;
 if v_target_status not in ('available','in_use','maintenance','damaged','lost','retired') then raise exception 'invalid_asset_status'; end if;
 update public.assets set team_id=v_target_team_id,status=v_target_status,updated_at=now() where id=p_asset_id;
 insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,previous_status,new_status,movement_type,note,performed_by)
 values(p_asset_id,v_origin_team_id,v_target_team_id,v_old_status,v_target_status,p_movement_type,nullif(trim(p_note),''),v_user_id) returning id into v_movement_id;
 return v_movement_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_material(p_item_id uuid, p_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('consumption:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('consumption:write', p_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 then raise exception 'invalid_quantity'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=p_team_id for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=p_team_id;
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(p_item_id,p_team_id,null,p_quantity,'consumption',p_note,auth.uid());
end $function$
;

CREATE OR REPLACE FUNCTION public.replenish_material(p_item_id uuid, p_origin_team_id uuid, p_destination_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('materials:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('materials:write', p_destination_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 or p_origin_team_id=p_destination_team_id then raise exception 'invalid_quantity'; end if;
 if not exists(select 1 from public.teams where id=p_origin_team_id and active=true and location_type='central') then raise exception 'origin_must_be_cosem'; end if;
 if not exists(select 1 from public.teams where id=p_destination_team_id and active=true and location_type='field') then raise exception 'destination_must_be_field_team'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=p_origin_team_id for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=p_origin_team_id;
 insert into public.inventory(item_id,team_id,quantity,status) values(p_item_id,p_destination_team_id,p_quantity,'available') on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(p_item_id,p_origin_team_id,p_destination_team_id,p_quantity,'replenishment',p_note,auth.uid());
end $function$
;

CREATE OR REPLACE FUNCTION public.register_epi_delivery(p_employee_id uuid, p_item_id uuid, p_stock_batch_id uuid, p_quantity integer, p_delivery_reason text DEFAULT 'initial'::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_delivery_id uuid;
begin
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active
  for update;
  if not found then raise exception 'employee_not_found'; end if;
  if not public.can_operate('epi:write', v_employee.team_id) then raise exception 'forbidden_team'; end if;

  select * into v_batch
  from public.epi_stock_batches
  where id = p_stock_batch_id and item_id = p_item_id
  for update;
  if not found then raise exception 'stock_batch_not_found'; end if;
  if v_batch.quantity < p_quantity then
    raise exception 'insufficient_epi_stock';
  end if;

  update public.epi_stock_batches
  set quantity = quantity - p_quantity
  where id = v_batch.id;

  insert into public.epi_deliveries (
    employee_id, team_id, item_id, stock_batch_id, quantity,
    delivery_reason, ca_snapshot, brand_model_snapshot,
    lot_snapshot, variant_snapshot, note, delivered_by
  ) values (
    v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id, p_quantity,
    p_delivery_reason, v_batch.ca_number, v_batch.brand_model,
    v_batch.lot_number, v_batch.variant, nullif(trim(p_note), ''),
    (select auth.uid())
  ) returning id into v_delivery_id;

  return v_delivery_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_epi_delivery_batch(p_employee_id uuid, p_lines jsonb, p_delivery_reason text DEFAULT 'initial'::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_line jsonb;
  v_quantity integer;
  v_group_id uuid := gen_random_uuid();
begin
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0
     or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid_delivery_lines';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active
  for update;
  if not found then raise exception 'employee_not_found'; end if;
  if not public.can_operate('epi:write', v_employee.team_id) then raise exception 'forbidden_team'; end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select * into v_batch
    from public.epi_stock_batches
    where id = (v_line->>'stock_batch_id')::uuid
      and item_id = (v_line->>'item_id')::uuid
    for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.quantity < v_quantity then
      raise exception 'insufficient_epi_stock';
    end if;

    update public.epi_stock_batches
    set quantity = quantity - v_quantity
    where id = v_batch.id;

    insert into public.epi_deliveries (
      employee_id, team_id, item_id, stock_batch_id, quantity,
      delivery_reason, delivery_group_id, ca_snapshot,
      brand_model_snapshot, lot_snapshot, variant_snapshot, note, delivered_by
    ) values (
      v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id,
      v_quantity, p_delivery_reason, v_group_id, v_batch.ca_number,
      v_batch.brand_model, v_batch.lot_number, v_batch.variant,
      nullif(trim(p_note), ''), (select auth.uid())
    );
  end loop;

  return v_group_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_epi_item(p_employee_id uuid, p_item_id uuid, p_quantity integer, p_requested_variant text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.epi_employees%rowtype;
  v_item public.epi_items%rowtype;
  v_variant text := nullif(trim(coalesce(p_requested_variant, '')), '');
  v_request_id uuid;
begin
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'invalid_quantity';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active;
  if not found then raise exception 'employee_not_found'; end if;
  if not public.can_operate('epi:write', v_employee.team_id) then raise exception 'forbidden_team'; end if;

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
$function$
;

CREATE OR REPLACE FUNCTION public.fulfill_epi_request(p_request_id uuid, p_stock_batch_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.epi_requests%rowtype;
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_group_id uuid := gen_random_uuid();
begin
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;

  select * into v_request
  from public.epi_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then raise exception 'request_not_pending'; end if;

  select * into v_employee
  from public.epi_employees
  where id = v_request.employee_id and active;
  if not found then raise exception 'employee_not_found'; end if;
  if not public.can_operate('epi:write', v_employee.team_id) then raise exception 'forbidden_team'; end if;

  select * into v_batch
  from public.epi_stock_batches
  where id = p_stock_batch_id
    and item_id = v_request.item_id
    and (
      v_request.requested_variant is null
      or variant = v_request.requested_variant
    )
  for update;
  if not found then raise exception 'stock_batch_not_found'; end if;
  if v_batch.quantity < v_request.quantity then
    raise exception 'insufficient_epi_stock';
  end if;

  update public.epi_stock_batches
  set quantity = quantity - v_request.quantity
  where id = v_batch.id;

  update public.epi_requests
  set status = 'fulfilled', fulfilled_by = (select auth.uid()), fulfilled_at = now()
  where id = v_request.id;

  insert into public.epi_deliveries (
    employee_id, team_id, item_id, stock_batch_id, quantity,
    delivery_reason, delivery_group_id, ca_snapshot,
    brand_model_snapshot, lot_snapshot, variant_snapshot, note, delivered_by
  ) values (
    v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id,
    v_request.quantity, 'replacement', v_group_id, v_batch.ca_number,
    v_batch.brand_model, v_batch.lot_number, v_batch.variant,
    'Atendimento de pendência', (select auth.uid())
  );

  return v_group_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.close_epi_delivery_quantity(p_delivery_id uuid, p_quantity integer, p_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_delivery public.epi_deliveries%rowtype;
  v_closed_id uuid;
  v_group_id uuid;
begin
  if not public.can_operate('epi:write') then
    raise exception 'forbidden_role';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000 then
    raise exception 'invalid_quantity';
  end if;

  if p_status is null or p_status not in
     ('returned', 'replaced', 'lost', 'damaged', 'consumed') then
    raise exception 'invalid_delivery_status';
  end if;

  select * into v_delivery
  from public.epi_deliveries
  where id = p_delivery_id
    and current_status = 'active'
  for update;

  if not found then
    raise exception 'delivery_not_active';
  end if;

  if not public.can_operate('epi:write', v_delivery.team_id) then raise exception 'forbidden_team'; end if;
  if p_quantity > v_delivery.quantity then
    raise exception 'invalid_quantity';
  end if;

  if p_quantity = v_delivery.quantity then
    update public.epi_deliveries
    set current_status = p_status,
        closed_at = now(),
        closed_by = v_actor
    where id = v_delivery.id
    returning id into v_closed_id;

    return v_closed_id;
  end if;

  v_group_id := coalesce(v_delivery.delivery_group_id, gen_random_uuid());

  update public.epi_deliveries
  set quantity = quantity - p_quantity,
      delivery_group_id = v_group_id
  where id = v_delivery.id;

  insert into public.epi_deliveries (
    employee_id,
    team_id,
    item_id,
    stock_batch_id,
    quantity,
    delivered_at,
    delivery_reason,
    current_status,
    ca_snapshot,
    brand_model_snapshot,
    lot_snapshot,
    note,
    delivered_by,
    closed_at,
    closed_by,
    created_at,
    delivery_group_id,
    variant_snapshot
  ) values (
    v_delivery.employee_id,
    v_delivery.team_id,
    v_delivery.item_id,
    v_delivery.stock_batch_id,
    p_quantity,
    v_delivery.delivered_at,
    v_delivery.delivery_reason,
    p_status,
    v_delivery.ca_snapshot,
    v_delivery.brand_model_snapshot,
    v_delivery.lot_snapshot,
    v_delivery.note,
    v_delivery.delivered_by,
    now(),
    v_actor,
    v_delivery.created_at,
    v_group_id,
    v_delivery.variant_snapshot
  ) returning id into v_closed_id;

  return v_closed_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_epi_stock_batch(p_item_id uuid, p_quantity integer, p_variant text DEFAULT NULL::text, p_ca_number text DEFAULT NULL::text, p_brand_model text DEFAULT NULL::text, p_lot_number text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_variant text := nullif(btrim(p_variant), '');
  v_has_variants boolean;
begin
  if not public.can_operate('epi:write') then
    raise exception 'not authorized';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception 'invalid quantity';
  end if;

  if not exists (
    select 1 from public.epi_items i where i.id = p_item_id and i.active
  ) then
    raise exception 'active EPI item not found';
  end if;

  select exists (
    select 1
    from public.epi_item_variants v
    where v.item_id = p_item_id and v.active
  ) into v_has_variants;

  if v_has_variants then
    select v.value
    into v_variant
    from public.epi_item_variants v
    where v.item_id = p_item_id
      and v.active
      and (
        lower(v.value) = lower(coalesce(v_variant, ''))
        or lower(v.label) = lower(coalesce(v_variant, ''))
      )
    order by v.sort_order, v.label
    limit 1;

    if v_variant is null then
      raise exception 'invalid or missing item variant';
    end if;
  end if;

  insert into public.epi_stock_batches (
    item_id,
    quantity,
    variant,
    ca_number,
    brand_model,
    lot_number,
    created_by
  ) values (
    p_item_id,
    p_quantity,
    v_variant,
    nullif(btrim(p_ca_number), ''),
    nullif(btrim(p_brand_model), ''),
    nullif(btrim(p_lot_number), ''),
    v_actor
  )
  returning id into v_batch_id;

  return v_batch_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_update_profile(p_user_id uuid, p_full_name text, p_role text, p_team_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_current public.profiles%rowtype;
begin
  if not public.is_active_admin() then
    raise exception 'admin_required';
  end if;
  perform pg_advisory_xact_lock(73001, 1);
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
$function$
;

alter policy epi_deliveries_read on public.epi_deliveries using (public.can_operate('epi:write', team_id));
alter policy epi_employee_item_sets_read on public.epi_employee_item_sets using (exists(select 1 from public.epi_employees e where e.id = epi_employee_item_sets.employee_id and public.can_operate('epi:write', e.team_id)));
alter policy epi_employee_items_read on public.epi_employee_items using (exists(select 1 from public.epi_employees e where e.id = epi_employee_items.employee_id and public.can_operate('epi:write', e.team_id)));
alter policy epi_employees_read on public.epi_employees using (public.can_operate('epi:write', team_id));
alter policy epi_item_variants_read on public.epi_item_variants using ((select public.can_operate('epi:write')));
alter policy epi_items_read on public.epi_items using ((select public.can_operate('epi:write')));
alter policy epi_ack_read on public.epi_monthly_acknowledgements using ((select public.can_operate('epi:write')));
alter policy epi_profession_items_read on public.epi_profession_items using ((select public.can_operate('epi:write')));
alter policy epi_professions_read on public.epi_professions using ((select public.can_operate('epi:write')));
alter policy epi_requests_read on public.epi_requests using (public.can_operate('epi:write', team_id));
alter policy epi_stock_read on public.epi_stock_batches using ((select public.can_operate('epi:write')));
alter policy operation_reasons_read on public.operation_reasons using ((select public.can_operate('epi:write')));
alter policy work_locations_read on public.work_locations using ((select public.can_operate('epi:write')));
alter policy epi_deliveries_close on public.epi_deliveries using (current_status = 'active' and public.can_operate('epi:write', team_id)) with check (current_status in ('returned','replaced','lost','damaged','consumed') and closed_by = (select auth.uid()) and closed_at is not null and public.can_operate('epi:write', team_id));
alter policy epi_requests_create on public.epi_requests with check (status = 'pending' and requested_by = (select auth.uid()) and fulfilled_by is null and fulfilled_at is null and public.can_operate('epi:write', team_id) and exists(select 1 from public.epi_employees e where e.id=employee_id and e.active and e.team_id=epi_requests.team_id) and exists(select 1 from public.epi_items i where i.id=item_id and i.active));
alter policy epi_ack_read on public.epi_monthly_acknowledgements using (exists(select 1 from public.epi_employees e where e.id = employee_id and public.can_operate('epi:write', e.team_id)));
alter policy epi_ack_write on public.epi_monthly_acknowledgements using (exists(select 1 from public.epi_employees e where e.id = employee_id and public.can_operate('epi:write', e.team_id))) with check (exists(select 1 from public.epi_employees e where e.id = employee_id and public.can_operate('epi:write', e.team_id)));
