-- Read-only schema snapshot, no production data. Auth is stubbed for local RLS tests.
set check_function_bodies=off;
create schema auth;
create schema private;
create role authenticated;
create role anon;
create role service_role;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table private.user_provisioning_tickets (
email text not null,
token text not null,
expires_at timestamp with time zone not null
);
create table public.asset_movements (
id uuid default gen_random_uuid() not null,
asset_id uuid not null,
origin_team_id uuid,
destination_team_id uuid,
previous_status text not null,
new_status text not null,
movement_type text not null,
note text,
performed_by uuid not null,
created_at timestamp with time zone default now() not null
);
create table public.assets (
id uuid default gen_random_uuid() not null,
item_id uuid not null,
asset_code text not null,
serial_number text,
team_id uuid,
status text default 'available'::text not null,
notes text,
active boolean default true not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null,
ownership_type text default 'owned'::text not null,
rental_company text,
rental_start_date date,
rental_end_date date,
user_notes text
);
create table public.epi_deliveries (
id uuid default gen_random_uuid() not null,
employee_id uuid not null,
team_id uuid not null,
item_id uuid not null,
stock_batch_id uuid,
quantity integer not null,
delivered_at timestamp with time zone default now() not null,
delivery_reason text default 'initial'::text not null,
current_status text default 'active'::text not null,
ca_snapshot text,
brand_model_snapshot text,
lot_snapshot text,
note text,
delivered_by uuid default auth.uid() not null,
closed_at timestamp with time zone,
closed_by uuid,
created_at timestamp with time zone default now() not null,
delivery_group_id uuid,
variant_snapshot text
);
create table public.epi_employee_item_sets (
employee_id uuid not null,
updated_by uuid default auth.uid(),
updated_at timestamp with time zone default now() not null
);
create table public.epi_employee_items (
employee_id uuid not null,
item_id uuid not null,
required_quantity integer default 1 not null
);
create table public.epi_employees (
id uuid default gen_random_uuid() not null,
full_name text not null,
registration_code text,
profession text not null,
team_id uuid not null,
shirt_size text,
pants_size text,
shoe_size text,
active boolean default true not null,
created_by uuid default auth.uid() not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null,
aso_exam_date date,
aso_expiry_date date
);
create table public.epi_item_variants (
id uuid default gen_random_uuid() not null,
item_id uuid not null,
value text not null,
label text not null,
sort_order integer default 0 not null,
active boolean default true not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.epi_items (
id uuid default gen_random_uuid() not null,
code text not null,
name text not null,
item_kind text not null,
unit text default 'un'::text not null,
ca_number text,
brand_model text,
minimum_stock integer default 0 not null,
replacement_days integer,
active boolean default true not null,
created_by uuid default auth.uid() not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null,
return_policy text default 'returnable'::text not null,
requires_note_on_close boolean default false not null,
system_key text
);
create table public.epi_monthly_acknowledgements (
id uuid default gen_random_uuid() not null,
employee_id uuid not null,
reference_month date not null,
signed_name text,
signed_at timestamp with time zone,
confirmed_by uuid,
created_at timestamp with time zone default now() not null
);
create table public.epi_profession_items (
profession_code text not null,
item_id uuid not null,
recommended_quantity integer default 1 not null
);
create table public.epi_professions (
code text not null,
name text not null,
uniform_color text default 'gray'::text not null,
active boolean default true not null,
sort_order integer default 0 not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.epi_requests (
id uuid default gen_random_uuid() not null,
employee_id uuid not null,
team_id uuid not null,
item_id uuid not null,
quantity integer default 1 not null,
status text default 'pending'::text not null,
requested_by uuid default auth.uid(),
fulfilled_by uuid,
fulfilled_at timestamp with time zone,
created_at timestamp with time zone default now() not null,
requested_variant text
);
create table public.epi_stock_batches (
id uuid default gen_random_uuid() not null,
item_id uuid not null,
quantity integer not null,
ca_number text,
brand_model text,
lot_number text,
expires_on date,
received_at timestamp with time zone default now() not null,
created_by uuid default auth.uid() not null,
created_at timestamp with time zone default now() not null,
variant text
);
create table public.inventory (
id uuid default gen_random_uuid() not null,
item_id uuid not null,
team_id uuid not null,
quantity integer default 0 not null,
status text default 'available'::text not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.items (
id uuid default gen_random_uuid() not null,
code text not null,
name text not null,
description text,
category text,
item_type text not null,
unit text default 'un'::text not null,
minimum_stock integer default 0 not null,
active boolean default true not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.movements (
id uuid default gen_random_uuid() not null,
item_id uuid not null,
origin_team_id uuid,
destination_team_id uuid,
quantity integer not null,
movement_type text not null,
note text,
performed_by uuid not null,
created_at timestamp with time zone default now() not null
);
create table public.operation_reasons (
id uuid default gen_random_uuid() not null,
scope text not null,
code text not null,
label text not null,
active boolean default true not null,
sort_order integer default 0 not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.profiles (
id uuid not null,
full_name text not null,
role text default 'collaborator'::text not null,
team_id uuid,
active boolean default false not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
create table public.teams (
id uuid default gen_random_uuid() not null,
name text not null,
description text,
active boolean default true not null,
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null,
location_type text default 'field'::text not null
);
create table public.work_locations (
id uuid default gen_random_uuid() not null,
name text not null,
location_type text default 'worksite'::text not null,
notes text,
active boolean default true not null,
created_by uuid default auth.uid(),
created_at timestamp with time zone default now() not null,
updated_at timestamp with time zone default now() not null
);
alter table private.user_provisioning_tickets add constraint user_provisioning_tickets_pkey PRIMARY KEY (email);
alter table public.asset_movements add constraint asset_movements_check CHECK (((origin_team_id IS NOT NULL) OR (destination_team_id IS NOT NULL) OR (movement_type = ANY (ARRAY['maintenance'::text, 'status_change'::text]))));
alter table public.asset_movements add constraint asset_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['assign'::text, 'transfer'::text, 'return'::text, 'maintenance'::text, 'status_change'::text])));
alter table public.asset_movements add constraint asset_movements_pkey PRIMARY KEY (id);
alter table public.assets add constraint assets_asset_code_key UNIQUE (asset_code);
alter table public.assets add constraint assets_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['owned'::text, 'rented'::text])));
alter table public.assets add constraint assets_pkey PRIMARY KEY (id);
alter table public.assets add constraint assets_rental_dates_check CHECK (((rental_end_date IS NULL) OR (rental_start_date IS NULL) OR (rental_end_date >= rental_start_date)));
alter table public.assets add constraint assets_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_use'::text, 'maintenance'::text, 'damaged'::text, 'lost'::text, 'retired'::text])));
alter table public.epi_deliveries add constraint epi_deliveries_current_status_check CHECK ((current_status = ANY (ARRAY['active'::text, 'returned'::text, 'replaced'::text, 'lost'::text, 'damaged'::text, 'consumed'::text])));
alter table public.epi_deliveries add constraint epi_deliveries_delivery_reason_check CHECK ((delivery_reason ~ '^[a-z][a-z0-9_]{1,39}$'::text));
alter table public.epi_deliveries add constraint epi_deliveries_pkey PRIMARY KEY (id);
alter table public.epi_deliveries add constraint epi_deliveries_quantity_check CHECK ((quantity > 0));
alter table public.epi_employee_item_sets add constraint epi_employee_item_sets_pkey PRIMARY KEY (employee_id);
alter table public.epi_employee_items add constraint epi_employee_items_pkey PRIMARY KEY (employee_id, item_id);
alter table public.epi_employee_items add constraint epi_employee_items_required_quantity_check CHECK ((required_quantity > 0));
alter table public.epi_employees add constraint epi_employee_aso_dates CHECK (((aso_expiry_date IS NULL) OR ((aso_exam_date IS NOT NULL) AND (aso_expiry_date >= aso_exam_date))));
alter table public.epi_employees add constraint epi_employees_full_name_check CHECK ((length(TRIM(BOTH FROM full_name)) >= 3));
alter table public.epi_employees add constraint epi_employees_pkey PRIMARY KEY (id);
alter table public.epi_item_variants add constraint epi_item_variants_item_id_value_key UNIQUE (item_id, value);
alter table public.epi_item_variants add constraint epi_item_variants_label_check CHECK (((length(TRIM(BOTH FROM label)) >= 1) AND (length(TRIM(BOTH FROM label)) <= 80)));
alter table public.epi_item_variants add constraint epi_item_variants_pkey PRIMARY KEY (id);
alter table public.epi_item_variants add constraint epi_item_variants_value_check CHECK (((length(TRIM(BOTH FROM value)) >= 1) AND (length(TRIM(BOTH FROM value)) <= 40)));
alter table public.epi_items add constraint epi_items_code_key UNIQUE (code);
alter table public.epi_items add constraint epi_items_item_kind_check CHECK ((item_kind = ANY (ARRAY['epi'::text, 'uniform'::text, 'personal_tool'::text])));
alter table public.epi_items add constraint epi_items_minimum_stock_check CHECK ((minimum_stock >= 0));
alter table public.epi_items add constraint epi_items_pkey PRIMARY KEY (id);
alter table public.epi_items add constraint epi_items_replacement_days_check CHECK (((replacement_days IS NULL) OR (replacement_days > 0)));
alter table public.epi_items add constraint epi_items_return_policy_check CHECK ((return_policy = ANY (ARRAY['consumable'::text, 'returnable'::text, 'personal'::text, 'uniform'::text, 'non_returnable'::text])));
alter table public.epi_monthly_acknowledgements add constraint epi_monthly_acknowledgements_employee_id_reference_month_key UNIQUE (employee_id, reference_month);
alter table public.epi_monthly_acknowledgements add constraint epi_monthly_acknowledgements_pkey PRIMARY KEY (id);
alter table public.epi_monthly_acknowledgements add constraint epi_monthly_acknowledgements_reference_month_check CHECK ((reference_month = (date_trunc('month'::text, (reference_month)::timestamp with time zone))::date));
alter table public.epi_profession_items add constraint epi_profession_items_pkey PRIMARY KEY (profession_code, item_id);
alter table public.epi_profession_items add constraint epi_profession_items_recommended_quantity_check CHECK ((recommended_quantity > 0));
alter table public.epi_professions add constraint epi_professions_name_key UNIQUE (name);
alter table public.epi_professions add constraint epi_professions_pkey PRIMARY KEY (code);
alter table public.epi_professions add constraint epi_professions_uniform_color_check CHECK ((uniform_color = ANY (ARRAY['gray'::text, 'blue'::text])));
alter table public.epi_requests add constraint epi_requests_pkey PRIMARY KEY (id);
alter table public.epi_requests add constraint epi_requests_quantity_check CHECK ((quantity > 0));
alter table public.epi_requests add constraint epi_requests_requested_variant_check CHECK (((requested_variant IS NULL) OR ((length(TRIM(BOTH FROM requested_variant)) >= 1) AND (length(TRIM(BOTH FROM requested_variant)) <= 40))));
alter table public.epi_requests add constraint epi_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'cancelled'::text])));
alter table public.epi_stock_batches add constraint epi_stock_batches_pkey PRIMARY KEY (id);
alter table public.epi_stock_batches add constraint epi_stock_batches_quantity_check CHECK ((quantity >= 0));
alter table public.inventory add constraint inventory_item_id_team_id_key UNIQUE (item_id, team_id);
alter table public.inventory add constraint inventory_pkey PRIMARY KEY (id);
alter table public.inventory add constraint inventory_quantity_check CHECK ((quantity >= 0));
alter table public.inventory add constraint inventory_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_use'::text, 'maintenance'::text, 'damaged'::text, 'lost'::text])));
alter table public.items add constraint items_code_key UNIQUE (code);
alter table public.items add constraint items_item_type_check CHECK ((item_type = ANY (ARRAY['material'::text, 'equipment'::text])));
alter table public.items add constraint items_minimum_stock_check CHECK ((minimum_stock >= 0));
alter table public.items add constraint items_pkey PRIMARY KEY (id);
alter table public.movements add constraint movements_check CHECK (((origin_team_id IS NOT NULL) OR (destination_team_id IS NOT NULL)));
alter table public.movements add constraint movements_check1 CHECK (((origin_team_id IS NULL) OR (destination_team_id IS NULL) OR (origin_team_id <> destination_team_id)));
alter table public.movements add constraint movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['entry'::text, 'exit'::text, 'transfer'::text, 'return'::text, 'maintenance'::text, 'consumption'::text, 'replenishment'::text])));
alter table public.movements add constraint movements_pkey PRIMARY KEY (id);
alter table public.movements add constraint movements_quantity_check CHECK ((quantity > 0));
alter table public.operation_reasons add constraint operation_reasons_code_check CHECK ((code ~ '^[a-z][a-z0-9_]{1,39}$'::text));
alter table public.operation_reasons add constraint operation_reasons_label_check CHECK (((length(TRIM(BOTH FROM label)) >= 2) AND (length(TRIM(BOTH FROM label)) <= 80)));
alter table public.operation_reasons add constraint operation_reasons_pkey PRIMARY KEY (id);
alter table public.operation_reasons add constraint operation_reasons_scope_check CHECK ((scope = ANY (ARRAY['epi_delivery'::text, 'epi_close'::text, 'equipment_transfer'::text, 'equipment_return'::text])));
alter table public.operation_reasons add constraint operation_reasons_scope_code_key UNIQUE (scope, code);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'engineer'::text, 'leader'::text, 'collaborator'::text])));
alter table public.teams add constraint teams_location_type_check CHECK ((location_type = ANY (ARRAY['central'::text, 'field'::text])));
alter table public.teams add constraint teams_name_key UNIQUE (name);
alter table public.teams add constraint teams_pkey PRIMARY KEY (id);
alter table public.work_locations add constraint work_locations_location_type_check CHECK ((location_type = ANY (ARRAY['worksite'::text, 'warehouse'::text, 'workshop'::text, 'office'::text, 'vehicle'::text, 'other'::text])));
alter table public.work_locations add constraint work_locations_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 2) AND (length(TRIM(BOTH FROM name)) <= 100)));
alter table public.work_locations add constraint work_locations_notes_check CHECK (((notes IS NULL) OR (length(notes) <= 500)));
alter table public.work_locations add constraint work_locations_pkey PRIMARY KEY (id);
alter table public.asset_movements add constraint asset_movements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT;
alter table public.asset_movements add constraint asset_movements_destination_team_id_fkey FOREIGN KEY (destination_team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.asset_movements add constraint asset_movements_origin_team_id_fkey FOREIGN KEY (origin_team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.asset_movements add constraint asset_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.assets add constraint assets_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
alter table public.assets add constraint assets_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.epi_deliveries add constraint epi_deliveries_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);
alter table public.epi_deliveries add constraint epi_deliveries_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES auth.users(id);
alter table public.epi_deliveries add constraint epi_deliveries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES epi_employees(id);
alter table public.epi_deliveries add constraint epi_deliveries_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id);
alter table public.epi_deliveries add constraint epi_deliveries_stock_batch_id_fkey FOREIGN KEY (stock_batch_id) REFERENCES epi_stock_batches(id);
alter table public.epi_deliveries add constraint epi_deliveries_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.epi_employee_item_sets add constraint epi_employee_item_sets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES epi_employees(id) ON DELETE CASCADE;
alter table public.epi_employee_item_sets add constraint epi_employee_item_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
alter table public.epi_employee_items add constraint epi_employee_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES epi_employees(id) ON DELETE CASCADE;
alter table public.epi_employee_items add constraint epi_employee_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id);
alter table public.epi_employees add constraint epi_employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.epi_employees add constraint epi_employees_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.epi_item_variants add constraint epi_item_variants_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id) ON DELETE CASCADE;
alter table public.epi_items add constraint epi_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.epi_monthly_acknowledgements add constraint epi_monthly_acknowledgements_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);
alter table public.epi_monthly_acknowledgements add constraint epi_monthly_acknowledgements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES epi_employees(id);
alter table public.epi_profession_items add constraint epi_profession_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id) ON DELETE CASCADE;
alter table public.epi_profession_items add constraint epi_profession_items_profession_code_fkey FOREIGN KEY (profession_code) REFERENCES epi_professions(code) ON DELETE CASCADE;
alter table public.epi_requests add constraint epi_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES epi_employees(id);
alter table public.epi_requests add constraint epi_requests_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES auth.users(id);
alter table public.epi_requests add constraint epi_requests_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id);
alter table public.epi_requests add constraint epi_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);
alter table public.epi_requests add constraint epi_requests_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table public.epi_stock_batches add constraint epi_stock_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.epi_stock_batches add constraint epi_stock_batches_item_id_fkey FOREIGN KEY (item_id) REFERENCES epi_items(id);
alter table public.inventory add constraint inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
alter table public.inventory add constraint inventory_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.movements add constraint movements_destination_team_id_fkey FOREIGN KEY (destination_team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.movements add constraint movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT;
alter table public.movements add constraint movements_origin_team_id_fkey FOREIGN KEY (origin_team_id) REFERENCES teams(id) ON DELETE RESTRICT;
alter table public.movements add constraint movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES profiles(id) ON DELETE RESTRICT;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
alter table public.work_locations add constraint work_locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
CREATE OR REPLACE FUNCTION private.current_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p.team_id from public.profiles p
  where p.id = auth.uid() and p.active = true;
$function$
;
CREATE OR REPLACE FUNCTION private.enforce_metallo_user_provisioning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  provisioning_token text := coalesce(
    new.raw_user_meta_data ->> 'metallo_provisioning_token',
    ''
  );
begin
  delete from private.user_provisioning_tickets
  where email = lower(trim(coalesce(new.email, '')))
    and token = provisioning_token
    and expires_at > now();

  if not found then
    raise exception 'public_signup_disabled' using errcode = '42501';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'metallo_provisioning_token';
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.is_active_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true
  );
$function$
;
CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION private.strip_metallo_provisioning_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'metallo_provisioning_token';
  return new;
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
  if v_actor is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
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
CREATE OR REPLACE FUNCTION public.admin_delete_asset_movement(p_movement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.asset_movements%rowtype;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into m from public.asset_movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;
  if exists(select 1 from public.asset_movements where asset_id=m.asset_id and created_at>m.created_at) then
    raise exception 'only_latest_asset_movement_can_change';
  end if;

  update public.assets
  set team_id=m.origin_team_id,
      status=m.previous_status,
      updated_at=now()
  where id=m.asset_id;
  delete from public.asset_movements where id=p_movement_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_delete_material_movement(p_movement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.movements%rowtype;
  v_qty integer;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into m from public.movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;

  if m.destination_team_id is not null then
    update public.inventory
       set quantity=quantity-m.quantity, updated_at=now()
     where item_id=m.item_id and team_id=m.destination_team_id and quantity>=m.quantity
     returning quantity into v_qty;
    if not found then raise exception 'cannot_reverse_destination_stock'; end if;
  end if;

  if m.origin_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,m.origin_team_id,m.quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  delete from public.movements where id=p_movement_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_update_asset_movement(p_movement_id uuid, p_destination_team_id uuid, p_new_status text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.asset_movements%rowtype;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if p_destination_team_id is null then raise exception 'team_required'; end if;
  if p_new_status not in ('available','in_use','maintenance','damaged','lost','retired') then raise exception 'invalid_asset_status'; end if;
  if not exists(select 1 from public.teams where id=p_destination_team_id and active=true) then raise exception 'invalid_team'; end if;

  select * into m from public.asset_movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;
  if exists(select 1 from public.asset_movements where asset_id=m.asset_id and created_at>m.created_at) then
    raise exception 'only_latest_asset_movement_can_change';
  end if;

  update public.asset_movements
  set destination_team_id=p_destination_team_id,
      new_status=p_new_status,
      note=nullif(trim(p_note),'')
  where id=p_movement_id;

  update public.assets
  set team_id=p_destination_team_id, status=p_new_status, updated_at=now()
  where id=m.asset_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_update_material_movement(p_movement_id uuid, p_quantity integer, p_origin_team_id uuid, p_destination_team_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  m public.movements%rowtype;
  v_qty integer;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'invalid_quantity'; end if;
  if p_origin_team_id is not null and p_destination_team_id is not null and p_origin_team_id=p_destination_team_id then
    raise exception 'same_team_transfer';
  end if;

  select * into m from public.movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;

  -- Reverte o efeito antigo.
  if m.destination_team_id is not null then
    update public.inventory set quantity=quantity-m.quantity, updated_at=now()
    where item_id=m.item_id and team_id=m.destination_team_id and quantity>=m.quantity
    returning quantity into v_qty;
    if not found then raise exception 'cannot_reverse_destination_stock'; end if;
  end if;
  if m.origin_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,m.origin_team_id,m.quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  -- Aplica o novo efeito.
  if p_origin_team_id is not null then
    update public.inventory set quantity=quantity-p_quantity, updated_at=now()
    where item_id=m.item_id and team_id=p_origin_team_id and quantity>=p_quantity
    returning quantity into v_qty;
    if not found then raise exception 'insufficient_stock'; end if;
  end if;
  if p_destination_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,p_destination_team_id,p_quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  update public.movements
  set quantity=p_quantity,
      origin_team_id=p_origin_team_id,
      destination_team_id=p_destination_team_id,
      note=nullif(trim(p_note),'')
  where id=p_movement_id;
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
CREATE OR REPLACE FUNCTION public.asset_legacy_decode(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(p_value, ''), '%20', ' '),
            '%26', '&'
          ),
          '%2F', '/'
        ),
        '%3A', ':'
      ),
      '%23', '#'
    ),
    '%25', '%'
  )
$function$
;
CREATE OR REPLACE FUNCTION public.asset_legacy_encode(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(regexp_replace(btrim(coalesce(p_value, '')), E'[\r\n]+', ' ', 'g'), '%', '%25'),
            ' ', '%20'
          ),
          '&', '%26'
        ),
        '/', '%2F'
      ),
      ':', '%3A'
    ),
    '#', '%23'
  )
$function$
;
CREATE OR REPLACE FUNCTION public.asset_visible_notes(p_notes text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select nullif(
    btrim(string_agg(line, E'\n' order by ordinal)),
    ''
  )
  from regexp_split_to_table(coalesce(p_notes, ''), E'\r?\n')
       with ordinality as lines(line, ordinal)
  where line !~ '^#metallo:(ownership|rental_company|rental_start|rental_end)='
$function$
;
CREATE OR REPLACE FUNCTION public.claim_initial_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_first_user_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if exists (select 1 from public.profiles where role='admin' and active=true) then
    raise exception 'admin_already_exists';
  end if;

  select u.id into v_first_user_id
  from auth.users u
  where coalesce(u.is_anonymous,false)=false and u.deleted_at is null
  order by u.created_at asc nulls last, u.id asc
  limit 1;

  if v_first_user_id is distinct from v_user_id then
    raise exception 'only_first_user_can_claim_admin';
  end if;

  update public.profiles
  set role='admin', active=true, updated_at=now()
  where id=v_user_id;

  if not found then raise exception 'profile_not_found'; end if;
  return true;
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
  if v_actor is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
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
CREATE OR REPLACE FUNCTION public.consume_material(p_item_id uuid, p_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
 if v_role='leader' and v_team is distinct from p_team_id then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 then raise exception 'invalid_quantity'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=p_team_id for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=p_team_id;
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(p_item_id,p_team_id,null,p_quantity,'consumption',p_note,auth.uid());
end $function$
;
CREATE OR REPLACE FUNCTION public.create_epi_item_with_stock(p_code text, p_name text, p_item_kind text, p_unit text, p_ca_number text DEFAULT NULL::text, p_brand_model text DEFAULT NULL::text, p_minimum_stock integer DEFAULT 0, p_return_policy text DEFAULT 'returnable'::text, p_initial_quantity integer DEFAULT 0, p_variant text DEFAULT NULL::text, p_lot_number text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item_id uuid;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null
     or nullif(trim(p_unit), '') is null then raise exception 'required_epi_field'; end if;
  if p_item_kind not in ('epi', 'uniform', 'personal_tool') then raise exception 'invalid_epi_kind'; end if;
  if p_return_policy not in ('returnable', 'personal', 'uniform') then raise exception 'invalid_return_policy'; end if;
  if p_minimum_stock < 0 or p_initial_quantity < 0 then raise exception 'invalid_quantity'; end if;

  insert into public.epi_items(
    code, name, item_kind, unit, ca_number, brand_model,
    minimum_stock, return_policy, active, created_by
  ) values (
    trim(p_code), trim(p_name), p_item_kind, trim(p_unit),
    case when p_item_kind = 'epi' then nullif(trim(p_ca_number), '') else null end,
    nullif(trim(p_brand_model), ''), p_minimum_stock, p_return_policy,
    true, auth.uid()
  ) returning id into v_item_id;

  if p_initial_quantity > 0 then
    insert into public.epi_stock_batches(
      item_id, quantity, variant, ca_number, brand_model,
      lot_number, created_by
    ) values (
      v_item_id, p_initial_quantity, nullif(trim(p_variant), ''),
      case when p_item_kind = 'epi' then nullif(trim(p_ca_number), '') else null end,
      nullif(trim(p_brand_model), ''), nullif(trim(p_lot_number), ''), auth.uid()
    );
  end if;
  return v_item_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_equipment_for_team(p_code text, p_name text, p_asset_code text, p_serial_number text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_team_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team uuid; v_item_id uuid; v_asset_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select role,team_id into v_role,v_user_team from public.profiles where id=v_user_id and active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
 if p_team_id is null then raise exception 'team_required'; end if;
 if v_role='leader' and p_team_id is distinct from v_user_team then raise exception 'forbidden_team'; end if;
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
  if v_role not in ('admin', 'engineer', 'leader') then raise exception 'forbidden_role'; end if;
  if p_team_id is null then raise exception 'team_required'; end if;
  if v_role = 'leader' and p_team_id is distinct from v_user_team then raise exception 'forbidden_team'; end if;
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
CREATE OR REPLACE FUNCTION public.create_material_for_team(p_code text, p_name text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT 'un'::text, p_minimum_stock integer DEFAULT 0, p_team_id uuid DEFAULT NULL::uuid, p_quantity integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team uuid; v_item_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select role,team_id into v_role,v_user_team from public.profiles where id=v_user_id and active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
 if p_team_id is null then raise exception 'team_required'; end if;
 if v_role='leader' and p_team_id is distinct from v_user_team then raise exception 'forbidden_team'; end if;
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
CREATE OR REPLACE FUNCTION public.create_team_admin(p_name text, p_description text DEFAULT NULL::text, p_location_type text DEFAULT 'field'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if p_location_type not in ('central','field') then raise exception 'invalid_location_type'; end if;
  if p_location_type='central' and exists(select 1 from public.teams where location_type='central' and active) then raise exception 'central_exists'; end if;
  insert into public.teams(name,description,active,location_type) values(trim(p_name),nullif(trim(coalesce(p_description,'')),''),true,p_location_type) returning id into v_id;
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_team_admin(p_name text, p_description text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'team_name_required'; end if;
  if (select count(*) from public.teams where active=true)>=4 then raise exception 'team_limit_reached'; end if;
  insert into public.teams(name,description,active) values(trim(p_name),nullif(trim(p_description),''),true) returning id into v_id;
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.deactivate_asset_admin(p_asset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.is_active_admin() then raise exception 'admin_required'; end if;
 update public.assets set active=false,updated_at=now() where id=p_asset_id;
 if not found then raise exception 'asset_not_found'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.deactivate_item_admin(p_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.is_active_admin() then raise exception 'admin_required'; end if;
 if exists(select 1 from public.inventory where item_id=p_item_id and quantity<>0) then raise exception 'item_has_stock'; end if;
 if exists(select 1 from public.assets where item_id=p_item_id and active) then raise exception 'item_has_assets'; end if;
 update public.items set active=false,updated_at=now() where id=p_item_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.delete_team_admin(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_epi_delivery_close()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- A partial close first reduces an active delivery. Authenticated clients do
  -- not have UPDATE permission for these columns; only the guarded RPC below
  -- can reach this branch through its definer privileges.
  if old.current_status = 'active' and new.current_status = 'active' then
    if new.quantity <= 0 or new.quantity >= old.quantity then
      raise exception 'invalid_quantity';
    end if;

    if (to_jsonb(new) - array['quantity', 'delivery_group_id'])
       is distinct from
       (to_jsonb(old) - array['quantity', 'delivery_group_id']) then
      raise exception 'immutable_delivery_history';
    end if;

    if old.delivery_group_id is not null
       and new.delivery_group_id is distinct from old.delivery_group_id then
      raise exception 'immutable_delivery_history';
    end if;

    return new;
  end if;

  if old.current_status <> 'active'
     or new.current_status not in
        ('returned', 'replaced', 'lost', 'damaged', 'consumed') then
    raise exception 'invalid_delivery_transition';
  end if;

  if (to_jsonb(new) - array['current_status', 'closed_at', 'closed_by'])
     is distinct from
     (to_jsonb(old) - array['current_status', 'closed_at', 'closed_by']) then
    raise exception 'immutable_delivery_history';
  end if;

  new.closed_at := now();
  new.closed_by := (select auth.uid());
  return new;
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
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(coalesce(new.email,''), '@', 1), ''), 'Usuário'),
    'collaborator',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_active_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'admin'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.issue_user_provisioning_ticket(p_email text, p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_token text := trim(coalesce(p_token, ''));
begin
  if normalized_email = '' or normalized_token = '' then
    raise exception 'invalid_provisioning_ticket' using errcode = '22023';
  end if;

  delete from private.user_provisioning_tickets
  where expires_at <= now();

  insert into private.user_provisioning_tickets (email, token, expires_at)
  values (normalized_email, normalized_token, now() + interval '2 minutes')
  on conflict (email) do update
  set token = excluded.token,
      expires_at = excluded.expires_at;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.preserve_epi_item_system_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.system_key is not null
     and new.system_key is distinct from old.system_key then
    raise exception 'immutable_epi_system_key';
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reconcile_epi_request_after_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_request public.epi_requests%rowtype;
begin
  if new.current_status <> 'active' then
    return new;
  end if;

  select * into v_request
  from public.epi_requests
  where employee_id = new.employee_id
    and item_id = new.item_id
    and status = 'pending'
    and (requested_variant is null or requested_variant = new.variant_snapshot)
  order by created_at, id
  limit 1
  for update;

  if not found then return new; end if;

  if new.quantity >= v_request.quantity then
    update public.epi_requests
    set status = 'fulfilled',
        fulfilled_by = (select auth.uid()),
        fulfilled_at = now()
    where id = v_request.id;
  else
    update public.epi_requests
    set quantity = quantity - new.quantity
    where id = v_request.id;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.register_asset_movement(p_asset_id uuid, p_movement_type text, p_destination_team_id uuid DEFAULT NULL::uuid, p_new_status text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team_id uuid; v_origin_team_id uuid; v_old_status text; v_target_team_id uuid; v_target_status text; v_movement_id uuid;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select p.role,p.team_id into v_role,v_user_team_id from public.profiles p where p.id=v_user_id and p.active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
 select a.team_id,a.status into v_origin_team_id,v_old_status from public.assets a join public.items i on i.id=a.item_id where a.id=p_asset_id and a.active=true and i.active=true and i.item_type='equipment' for update of a;
 if not found then raise exception 'invalid_or_inactive_asset'; end if;
 if v_role='leader' and v_origin_team_id is distinct from v_user_team_id then raise exception 'forbidden_origin_team'; end if;
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
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
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
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
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
CREATE OR REPLACE FUNCTION public.register_movement(p_item_id uuid, p_movement_type text, p_quantity integer, p_origin_team_id uuid DEFAULT NULL::uuid, p_destination_team_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team_id uuid; v_movement_id uuid; v_remaining integer;
begin
 if v_user_id is null then raise exception 'authentication_required'; end if;
 select p.role,p.team_id into v_role,v_user_team_id from public.profiles p where p.id=v_user_id and p.active=true;
 if not found then raise exception 'inactive_or_missing_profile'; end if;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
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
 if v_role='leader' then
   if p_origin_team_id is not null and p_origin_team_id is distinct from v_user_team_id then raise exception 'forbidden_origin_team'; end if;
   if p_movement_type in ('entry','return') and p_destination_team_id is distinct from v_user_team_id then raise exception 'forbidden_destination_team'; end if;
 end if;
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
CREATE OR REPLACE FUNCTION public.replenish_material(p_item_id uuid, p_origin_team_id uuid, p_destination_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if v_role not in ('admin','engineer','leader') then raise exception 'forbidden_role'; end if;
 if v_role='leader' and v_team is distinct from p_destination_team_id then raise exception 'forbidden_team'; end if;
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
$function$
;
CREATE OR REPLACE FUNCTION public.return_rented_equipment(p_asset_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  a public.assets%rowtype;
  v_note text := public.asset_visible_notes(p_note);
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into a from public.assets where id = p_asset_id and active for update;
  if not found then raise exception 'invalid_or_inactive_asset'; end if;
  if a.ownership_type <> 'rented' then raise exception 'rented_equipment_required'; end if;
  insert into public.asset_movements(
    asset_id, origin_team_id, destination_team_id, previous_status,
    new_status, movement_type, note, performed_by
  ) values (
    a.id, a.team_id, a.team_id, a.status, 'retired', 'rental_return',
    'Devolução à locadora' || coalesce(': ' || v_note, ''), auth.uid()
  );
  update public.assets set
    active = false,
    status = 'retired',
    updated_at = now(),
    user_notes = concat_ws(E'\n', a.user_notes, 'Devolvido à locadora em ' || current_date::text || coalesce(': ' || v_note, '')),
    notes = concat_ws(E'\n', a.notes, 'Devolvido à locadora em ' || current_date::text || coalesce(': ' || v_note, ''))
  where id = a.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.revoke_user_provisioning_ticket(p_email text, p_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from private.user_provisioning_tickets
  where email = lower(trim(coalesce(p_email, '')))
    and token = trim(coalesce(p_token, ''));
$function$
;
CREATE OR REPLACE FUNCTION public.set_epi_employee_items(p_employee_id uuid, p_lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_line jsonb;
begin
  insert into public.epi_employee_item_sets(employee_id,updated_by,updated_at) values(p_employee_id,auth.uid(),now()) on conflict(employee_id) do update set updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  delete from public.epi_employee_items where employee_id=p_employee_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.epi_employee_items(employee_id,item_id,required_quantity) values(p_employee_id,(v_line->>'item_id')::uuid,(v_line->>'quantity')::integer);
  end loop;
end; $function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_asset_legacy_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company text;
  v_start text;
  v_end text;
begin
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes then
    return new;
  end if;

  if coalesce(new.notes, '') ~ '(?m)^#metallo:ownership=' then
    new.ownership_type := case
      when new.notes ~ '(?m)^#metallo:ownership=rented$' then 'rented'
      else 'owned'
    end;
    v_company := substring(new.notes from '(?m)^#metallo:rental_company=([^\r\n]*)$');
    v_start := substring(new.notes from '(?m)^#metallo:rental_start=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$');
    v_end := substring(new.notes from '(?m)^#metallo:rental_end=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$');
    new.rental_company := case when new.ownership_type = 'rented'
      then nullif(public.asset_legacy_decode(v_company), '') else null end;
    new.rental_start_date := case when v_start is null then null
      else replace(v_start, '/', '-')::date end;
    new.rental_end_date := case when v_end is null then null
      else replace(v_end, '/', '-')::date end;
    new.user_notes := public.asset_visible_notes(new.notes);
  elsif new.user_notes is null then
    new.user_notes := nullif(btrim(new.notes), '');
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_asset_admin(p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_notes text, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.is_active_admin() then raise exception 'admin_required'; end if;
 update public.assets set asset_code=trim(p_asset_code),serial_number=nullif(trim(coalesce(p_serial_number,'')),''),team_id=p_team_id,status=p_status,notes=nullif(trim(coalesce(p_notes,'')),''),active=coalesce(p_active,true),updated_at=now() where id=p_asset_id;
 if not found then raise exception 'asset_not_found'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.update_equipment_admin(p_item_id uuid, p_item_code text, p_item_name text, p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_notes text, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.update_equipment_admin_v2(p_item_id uuid, p_item_code text, p_item_name text, p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_user_notes text, p_ownership_type text, p_rental_company text DEFAULT NULL::text, p_rental_start_date date DEFAULT NULL::date, p_rental_end_date date DEFAULT NULL::date, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_visible_notes text := public.asset_visible_notes(p_user_notes);
  v_legacy_notes text;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_item_code), '') is null
     or nullif(trim(p_item_name), '') is null
     or nullif(trim(p_asset_code), '') is null then raise exception 'required_equipment_field'; end if;
  if p_status not in ('available', 'in_use', 'maintenance', 'damaged', 'lost', 'retired') then raise exception 'invalid_asset_status'; end if;
  if p_ownership_type not in ('owned', 'rented') then raise exception 'invalid_ownership_type'; end if;
  if p_ownership_type = 'rented' and nullif(trim(p_rental_company), '') is null then raise exception 'rental_company_required'; end if;
  if p_rental_end_date is not null and p_rental_start_date is not null
     and p_rental_end_date < p_rental_start_date then raise exception 'invalid_rental_dates'; end if;
  if not exists(select 1 from public.teams where id = p_team_id and active) then raise exception 'invalid_team'; end if;

  update public.items set code = trim(p_item_code), name = trim(p_item_name), updated_at = now()
  where id = p_item_id and item_type = 'equipment' and active;
  if not found then raise exception 'item_not_found'; end if;

  v_legacy_notes := '#metallo:ownership=' || p_ownership_type;
  if p_ownership_type = 'rented' then
    v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_company=' || public.asset_legacy_encode(p_rental_company);
    if p_rental_start_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_start=' || p_rental_start_date::text; end if;
    if p_rental_end_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_end=' || p_rental_end_date::text; end if;
  end if;
  if v_visible_notes is not null then v_legacy_notes := v_legacy_notes || E'\n' || v_visible_notes; end if;

  update public.assets set
    asset_code = trim(p_asset_code),
    serial_number = nullif(trim(coalesce(p_serial_number, '')), ''),
    team_id = p_team_id,
    status = p_status,
    notes = v_legacy_notes,
    user_notes = v_visible_notes,
    ownership_type = p_ownership_type,
    rental_company = case when p_ownership_type = 'rented' then trim(p_rental_company) else null end,
    rental_start_date = case when p_ownership_type = 'rented' then p_rental_start_date else null end,
    rental_end_date = case when p_ownership_type = 'rented' then p_rental_end_date else null end,
    active = coalesce(p_active, true),
    updated_at = now()
  where id = p_asset_id and item_id = p_item_id;
  if not found then raise exception 'asset_not_found'; end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_item_admin(p_item_id uuid, p_code text, p_name text, p_description text, p_category text, p_unit text, p_minimum_stock numeric, p_active boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not public.is_active_admin() then raise exception 'admin_required'; end if;
 update public.items set code=trim(p_code),name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),category=nullif(trim(coalesce(p_category,'')),''),unit=coalesce(nullif(trim(p_unit),''),'un'),minimum_stock=greatest(coalesce(p_minimum_stock,0),0),active=coalesce(p_active,true),updated_at=now() where id=p_item_id;
 if not found then raise exception 'item_not_found'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.update_team_admin(p_team_id uuid, p_name text, p_description text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'team_name_required'; end if;

  update public.teams
  set name = trim(p_name),
      description = nullif(trim(p_description),''),
      updated_at = now()
  where id = p_team_id and active = true;

  if not found then raise exception 'team_not_found'; end if;
end;
$function$
;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER reconcile_epi_request_after_delivery AFTER INSERT ON public.epi_deliveries FOR EACH ROW EXECUTE FUNCTION reconcile_epi_request_after_delivery();
CREATE TRIGGER enforce_epi_delivery_close BEFORE UPDATE ON public.epi_deliveries FOR EACH ROW EXECUTE FUNCTION enforce_epi_delivery_close();
CREATE TRIGGER preserve_epi_item_system_key BEFORE UPDATE ON public.epi_items FOR EACH ROW EXECUTE FUNCTION preserve_epi_item_system_key();
CREATE TRIGGER sync_asset_legacy_metadata BEFORE INSERT OR UPDATE OF notes ON public.assets FOR EACH ROW EXECUTE FUNCTION sync_asset_legacy_metadata();
alter table private.user_provisioning_tickets enable row level security;
alter table public.asset_movements enable row level security;
alter table public.assets enable row level security;
alter table public.epi_deliveries enable row level security;
alter table public.epi_employee_item_sets enable row level security;
alter table public.epi_employee_items enable row level security;
alter table public.epi_employees enable row level security;
alter table public.epi_item_variants enable row level security;
alter table public.epi_items enable row level security;
alter table public.epi_monthly_acknowledgements enable row level security;
alter table public.epi_profession_items enable row level security;
alter table public.epi_professions enable row level security;
alter table public.epi_requests enable row level security;
alter table public.epi_stock_batches enable row level security;
alter table public.inventory enable row level security;
alter table public.items enable row level security;
alter table public.movements enable row level security;
alter table public.operation_reasons enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.work_locations enable row level security;
create policy asset_movements_admin_insert on public.asset_movements for INSERT to authenticated  with check (private.is_admin());
create policy asset_movements_read on public.asset_movements for SELECT to authenticated using (private.is_active_user()) ;
create policy assets_admin_delete on public.assets for DELETE to authenticated using (private.is_admin()) ;
create policy assets_admin_insert on public.assets for INSERT to authenticated  with check (private.is_admin());
create policy assets_admin_update on public.assets for UPDATE to authenticated using (private.is_admin()) with check (private.is_admin());
create policy assets_read on public.assets for SELECT to authenticated using (private.is_active_user()) ;
create policy epi_deliveries_close on public.epi_deliveries for UPDATE to authenticated using (((current_status = 'active'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text]))))))) with check (((current_status = ANY (ARRAY['returned'::text, 'replaced'::text, 'lost'::text, 'damaged'::text, 'consumed'::text])) AND (closed_by = ( SELECT auth.uid() AS uid)) AND (closed_at IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))));
create policy epi_deliveries_read on public.epi_deliveries for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_employee_item_sets_admin_write on public.epi_employee_item_sets for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_employee_item_sets_read on public.epi_employee_item_sets for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_employee_items_admin_write on public.epi_employee_items for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_employee_items_read on public.epi_employee_items for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_employees_admin_write on public.epi_employees for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_employees_read on public.epi_employees for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_item_variants_admin_delete on public.epi_item_variants for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) ;
create policy epi_item_variants_admin_insert on public.epi_item_variants for INSERT to authenticated  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_item_variants_admin_update on public.epi_item_variants for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_item_variants_read on public.epi_item_variants for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_items_admin_write on public.epi_items for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_items_read on public.epi_items for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_ack_read on public.epi_monthly_acknowledgements for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_ack_write on public.epi_monthly_acknowledgements for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text]))))));
create policy epi_profession_items_admin_delete on public.epi_profession_items for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) ;
create policy epi_profession_items_admin_insert on public.epi_profession_items for INSERT to authenticated  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_profession_items_admin_update on public.epi_profession_items for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_profession_items_read on public.epi_profession_items for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_professions_admin_delete on public.epi_professions for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) ;
create policy epi_professions_admin_insert on public.epi_professions for INSERT to authenticated  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_professions_admin_update on public.epi_professions for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_professions_read on public.epi_professions for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_requests_create on public.epi_requests for INSERT to authenticated  with check (((status = 'pending'::text) AND (requested_by = ( SELECT auth.uid() AS uid)) AND (fulfilled_by IS NULL) AND (fulfilled_at IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text]))))) AND (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_requests.employee_id) AND (e.team_id = epi_requests.team_id) AND e.active))) AND (EXISTS ( SELECT 1
   FROM epi_items i
  WHERE ((i.id = epi_requests.item_id) AND i.active)))));
create policy epi_requests_read on public.epi_requests for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy epi_stock_admin_write on public.epi_stock_batches for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy epi_stock_read on public.epi_stock_batches for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy inventory_admin_delete on public.inventory for DELETE to authenticated using (private.is_admin()) ;
create policy inventory_admin_insert on public.inventory for INSERT to authenticated  with check (private.is_admin());
create policy inventory_admin_update on public.inventory for UPDATE to authenticated using (private.is_admin()) with check (private.is_admin());
create policy inventory_read on public.inventory for SELECT to authenticated using (private.is_active_user()) ;
create policy items_admin_delete on public.items for DELETE to authenticated using (private.is_admin()) ;
create policy items_admin_insert on public.items for INSERT to authenticated  with check (private.is_admin());
create policy items_admin_update on public.items for UPDATE to authenticated using (private.is_admin()) with check (private.is_admin());
create policy items_read on public.items for SELECT to authenticated using (private.is_active_user()) ;
create policy movements_admin_insert on public.movements for INSERT to authenticated  with check (private.is_admin());
create policy movements_read on public.movements for SELECT to authenticated using (private.is_active_user()) ;
create policy operation_reasons_admin_delete on public.operation_reasons for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) ;
create policy operation_reasons_admin_insert on public.operation_reasons for INSERT to authenticated  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy operation_reasons_admin_update on public.operation_reasons for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy operation_reasons_read on public.operation_reasons for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
create policy profiles_admin_delete on public.profiles for DELETE to authenticated using (private.is_admin()) ;
create policy profiles_admin_insert on public.profiles for INSERT to authenticated  with check (private.is_admin());
create policy profiles_admin_update on public.profiles for UPDATE to authenticated using (private.is_admin()) with check (private.is_admin());
create policy profiles_read on public.profiles for SELECT to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_active_user() AS is_active_user))) ;
create policy teams_admin_delete on public.teams for DELETE to authenticated using (private.is_admin()) ;
create policy teams_admin_insert on public.teams for INSERT to authenticated  with check (private.is_admin());
create policy teams_admin_update on public.teams for UPDATE to authenticated using (private.is_admin()) with check (private.is_admin());
create policy teams_read on public.teams for SELECT to authenticated using (private.is_active_user()) ;
create policy work_locations_admin_delete on public.work_locations for DELETE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) ;
create policy work_locations_admin_insert on public.work_locations for INSERT to authenticated  with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy work_locations_admin_update on public.work_locations for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));
create policy work_locations_read on public.work_locations for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = ANY (ARRAY['admin'::text, 'engineer'::text])))))) ;
grant usage on schema public, private, auth to authenticated;
grant select on all tables in schema public to authenticated;
grant update (current_status,closed_at,closed_by) on public.epi_deliveries to authenticated;
grant insert on public.epi_requests to authenticated;
set check_function_bodies=on;
