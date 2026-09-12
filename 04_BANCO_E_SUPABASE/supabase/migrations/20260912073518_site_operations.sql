-- Obras compartilham estoque; equipes continuam identificando quem consumiu.
alter table public.asset_movements drop constraint asset_movements_movement_type_check;
alter table public.asset_movements add constraint asset_movements_movement_type_check check(movement_type in ('assign','transfer','return','maintenance','status_change','rental_return','rental_replacement'));
create table public.worksites (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 2 and 140),
  stock_team_id uuid not null unique references public.teams(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);
alter table public.teams add column worksite_id uuid references public.worksites(id);
create index teams_worksite_idx on public.teams(worksite_id);
alter table public.epi_stock_batches add column worksite_id uuid references public.worksites(id);
create index epi_stock_worksite_idx on public.epi_stock_batches(worksite_id, item_id);
create table public.epi_stock_transfers (
  id uuid primary key default gen_random_uuid(),
  origin_batch_id uuid not null references public.epi_stock_batches(id),
  destination_batch_id uuid not null references public.epi_stock_batches(id),
  quantity integer not null check(quantity>0),
  team_id uuid not null references public.teams(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);
create index epi_transfers_origin_idx on public.epi_stock_transfers(origin_batch_id);
create index epi_transfers_destination_idx on public.epi_stock_transfers(destination_batch_id);
create index epi_transfers_team_idx on public.epi_stock_transfers(team_id);
alter table public.epi_stock_transfers enable row level security;
grant select on public.epi_stock_transfers to authenticated;
revoke insert,update,delete on public.epi_stock_transfers from authenticated,anon;
create policy epi_transfers_read on public.epi_stock_transfers for select to authenticated using (public.can_operate('epi:write',team_id));

create table public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id),
  team_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  note text check(length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  check(ends_at is null or ends_at >= starts_at)
);
create index employee_assignments_employee_idx on public.employee_assignments(employee_id, starts_at desc);
create index employee_assignments_team_idx on public.employee_assignments(team_id);

create table public.supply_orders (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id),
  status text not null default 'submitted' check(status in ('submitted','awaiting_owner','approved','ordered','partial','received','rejected','cancelled')),
  note text check(length(note) <= 500),
  created_by uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index supply_orders_team_status_idx on public.supply_orders(team_id,status,created_at desc);
create table public.supply_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supply_orders(id),
  kind text not null check(kind in ('material','epi','rental')),
  item_id uuid references public.items(id),
  epi_item_id uuid references public.epi_items(id),
  description text not null check(length(btrim(description)) between 1 and 180),
  variant text check(length(variant) <= 100),
  quantity integer not null check(quantity between 1 and 100000),
  received_quantity integer not null default 0 check(received_quantity >= 0 and received_quantity <= quantity),
  check((kind='material' and item_id is not null and epi_item_id is null) or (kind='epi' and epi_item_id is not null and item_id is null) or (kind='rental' and item_id is null and epi_item_id is null))
);
create index supply_order_lines_order_idx on public.supply_order_lines(order_id);
create index supply_order_lines_item_idx on public.supply_order_lines(item_id);
create index supply_order_lines_epi_idx on public.supply_order_lines(epi_item_id);
create table public.supply_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.supply_orders(id),
  line_id uuid references public.supply_order_lines(id),
  event text not null,
  quantity integer,
  note text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id)
);
create index supply_order_events_order_idx on public.supply_order_events(order_id,recorded_at);
create index supply_order_events_line_idx on public.supply_order_events(line_id);

create table public.rental_return_requests (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  team_id uuid not null references public.teams(id),
  note text not null check(length(btrim(note)) between 1 and 500),
  status text not null default 'pending' check(status in ('pending','arranged','returned','cancelled')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);
create unique index rental_return_open_idx on public.rental_return_requests(asset_id) where status in ('pending','arranged');
create index rental_return_team_idx on public.rental_return_requests(team_id);
create table public.rental_admin_details (
  asset_id uuid primary key references public.assets(id),
  amount numeric(12,2) check(amount >= 0),
  billing_period text check(billing_period in ('day','week','month','contract')),
  expected_return date,
  billing_closed_on date,
  note text check(length(note) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id)
);
create table public.site_operation_receipts (
  id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  command text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  result jsonb
);
create index site_operation_receipts_actor_idx on public.site_operation_receipts(actor_id,recorded_at desc);
create index works_created_by_idx on public.worksites(created_by);
create index epi_transfers_created_by_idx on public.epi_stock_transfers(created_by);
create index employee_assignments_created_by_idx on public.employee_assignments(created_by);
create index supply_orders_created_by_idx on public.supply_orders(created_by);
create index supply_order_events_actor_idx on public.supply_order_events(recorded_by);
create index rental_return_asset_idx on public.rental_return_requests(asset_id);
create index rental_return_created_by_idx on public.rental_return_requests(created_by);
create index rental_return_resolved_by_idx on public.rental_return_requests(resolved_by);
create index rental_details_updated_by_idx on public.rental_admin_details(updated_by);

create or replace function public.stock_team(p_team_id uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select coalesce(w.stock_team_id,t.id) from public.teams t left join public.worksites w on w.id=t.worksite_id where t.id=p_team_id;
$$;
create or replace function public.employee_work_team(p_employee_id uuid, p_at timestamptz default now()) returns uuid
language sql stable security definer set search_path='' as $$
  select coalesce((select a.team_id from public.employee_assignments a where a.employee_id=e.id and a.starts_at<=p_at and (a.ends_at is null or a.ends_at>p_at) order by a.starts_at desc limit 1),e.team_id)
  from public.epi_employees e where e.id=p_employee_id;
$$;
revoke all on function public.stock_team(uuid), public.employee_work_team(uuid,timestamptz) from public,anon;
grant execute on function public.stock_team(uuid), public.employee_work_team(uuid,timestamptz) to authenticated;

alter table public.movements add column occurred_at timestamptz;
update public.movements set occurred_at=created_at;
alter table public.movements alter column occurred_at set default now(), alter column occurred_at set not null;
create index movements_occurred_idx on public.movements(occurred_at desc,origin_team_id);
alter table public.asset_movements add column occurred_at timestamptz;
update public.asset_movements set occurred_at=created_at;
alter table public.asset_movements alter column occurred_at set default now(), alter column occurred_at set not null;
-- Stock addresses remain attached to the physical stock when a crew moves worksites.
alter table public.movements add column origin_stock_team_id uuid references public.teams(id), add column destination_stock_team_id uuid references public.teams(id);
update public.movements set origin_stock_team_id=origin_team_id,destination_stock_team_id=destination_team_id;
create index movements_origin_stock_idx on public.movements(origin_stock_team_id);
create index movements_destination_stock_idx on public.movements(destination_stock_team_id);
create or replace function public.set_operation_time() returns trigger language plpgsql set search_path='' as $$
declare v_at timestamptz := nullif(current_setting('metallo.occurred_at',true),'')::timestamptz;
begin
  if tg_table_name='movements' then
    new.origin_stock_team_id:=public.stock_team(new.origin_team_id);
    new.destination_stock_team_id:=public.stock_team(new.destination_team_id);
  end if;
  if v_at is null then return new; end if;
  if tg_table_name='epi_deliveries' then
    -- A partial return copies the original delivery; it is not a new handover.
    if new.current_status='active' then new.delivered_at:=v_at; end if;
  elsif tg_table_name='epi_stock_batches' then new.received_at:=v_at;
  else new.occurred_at:=v_at; end if;
  return new;
end; $$;
revoke all on function public.set_operation_time() from public,anon,authenticated;
create trigger set_operation_time before insert on public.movements for each row execute function public.set_operation_time();
create trigger set_operation_time before insert on public.asset_movements for each row execute function public.set_operation_time();
create trigger set_operation_time before insert on public.epi_deliveries for each row execute function public.set_operation_time();
create trigger set_operation_time before insert on public.epi_stock_batches for each row execute function public.set_operation_time();

-- Read policies; all mutations go through the guarded, transactional RPC.
alter table public.worksites enable row level security;
alter table public.employee_assignments enable row level security;
alter table public.supply_orders enable row level security;
alter table public.supply_order_lines enable row level security;
alter table public.supply_order_events enable row level security;
alter table public.rental_return_requests enable row level security;
alter table public.rental_admin_details enable row level security;
alter table public.site_operation_receipts enable row level security;
grant select on public.worksites,public.employee_assignments,public.supply_orders,public.supply_order_lines,public.supply_order_events,public.rental_return_requests,public.rental_admin_details,public.site_operation_receipts to authenticated;
revoke insert,update,delete on public.worksites,public.employee_assignments,public.supply_orders,public.supply_order_lines,public.supply_order_events,public.rental_return_requests,public.rental_admin_details,public.site_operation_receipts from authenticated,anon;
create policy works_read on public.worksites for select to authenticated using ((select private.is_active_user()));
create policy assignments_read on public.employee_assignments for select to authenticated using (public.can_operate('epi:write',team_id) or public.can_operate('epi:write',public.employee_work_team(employee_id)));
create policy orders_read on public.supply_orders for select to authenticated using (public.can_operate('requests:write',team_id) or public.can_operate('rentals:write',team_id));
create policy order_lines_read on public.supply_order_lines for select to authenticated using (exists(select 1 from public.supply_orders o where o.id=order_id));
create policy order_events_read on public.supply_order_events for select to authenticated using (exists(select 1 from public.supply_orders o where o.id=order_id));
create policy returns_read on public.rental_return_requests for select to authenticated using (public.can_operate('rentals:write',team_id));
create policy rental_details_admin on public.rental_admin_details for select to authenticated using ((select public.is_active_admin()));
create policy receipts_own on public.site_operation_receipts for select to authenticated using (actor_id=(select auth.uid()) or (select public.is_active_admin()));

alter policy epi_employees_read on public.epi_employees using (public.can_operate('epi:write',team_id) or public.can_operate('epi:write',public.employee_work_team(id)));
alter policy epi_deliveries_read on public.epi_deliveries using (public.can_operate('epi:write',team_id) or public.can_operate('epi:write',public.employee_work_team(employee_id)));
alter policy epi_stock_read on public.epi_stock_batches using (public.can_operate('epi:write') and (worksite_id is null or exists(select 1 from public.teams t where t.worksite_id=epi_stock_batches.worksite_id and public.can_operate('epi:write',t.id))));
alter policy epi_items_read on public.epi_items using ((select public.can_operate('epi:write')) or (select public.can_operate('requests:write')));
alter policy epi_item_variants_read on public.epi_item_variants using ((select public.can_operate('epi:write')) or (select public.can_operate('requests:write')));

create or replace function public.run_site_operation(p_command text,p_data jsonb,p_operation_id uuid,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid := auth.uid(); v_admin boolean := public.is_active_admin();
  v_receipt public.site_operation_receipts%rowtype; v_result jsonb := '{}'::jsonb;
  v_team uuid; v_site uuid; v_stock uuid; v_id uuid; v_old_team uuid; v_quantity integer;
  v_order public.supply_orders%rowtype; v_line public.supply_order_lines%rowtype;
  v_employee public.epi_employees%rowtype; v_asset public.assets%rowtype; v_batch public.epi_stock_batches%rowtype;
  v_entry jsonb; v_code text; v_status text; v_item uuid; v_kind text;
begin
  if not exists(select 1 from public.profiles where id=v_actor and active) then raise exception 'authentication_required'; end if;
  if p_data->>'actor_id' is distinct from v_actor::text then raise exception 'operation_actor_mismatch'; end if;
  if p_command in ('create_worksite','link_team') then perform pg_advisory_xact_lock(73002,1);
  else perform pg_advisory_xact_lock_shared(73002,1); end if;
  if p_operation_id is null or p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' or p_occurred_at<'2000-01-01'::timestamptz then raise exception 'invalid_operation_time'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>200000 then raise exception 'invalid_payload'; end if;
  insert into public.site_operation_receipts(id,actor_id,command,payload,occurred_at) values(p_operation_id,v_actor,p_command,p_data,p_occurred_at) on conflict(id) do nothing;
  select * into v_receipt from public.site_operation_receipts where id=p_operation_id for update;
  if v_receipt.actor_id<>v_actor or v_receipt.command<>p_command or v_receipt.payload<>p_data or v_receipt.occurred_at<>p_occurred_at then raise exception 'operation_id_conflict'; end if;
  if v_receipt.result is not null then return v_receipt.result; end if;
  perform set_config('metallo.occurred_at',p_occurred_at::text,true);
  v_team:=nullif(p_data->>'team_id','')::uuid;

  if p_command='create_worksite' then
    if not v_admin then raise exception 'admin_required'; end if;
    perform pg_advisory_xact_lock(73002,1);
    if not exists(select 1 from public.teams where id=v_team and active and worksite_id is null and location_type='field') then raise exception 'invalid_team'; end if;
    insert into public.worksites(name,stock_team_id,created_by) values(btrim(p_data->>'name'),v_team,v_actor) returning id into v_id;
    update public.teams set worksite_id=v_id where id=v_team;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='link_team' then
    if not v_admin then raise exception 'admin_required'; end if;
    perform pg_advisory_xact_lock(73002,1);
    v_site:=(p_data->>'worksite_id')::uuid;
    select stock_team_id into v_stock from public.worksites where id=v_site and active for update;
    if not found then raise exception 'worksite_not_found'; end if;
    if exists(select 1 from public.worksites where stock_team_id=v_team) then raise exception 'stock_team_cannot_move'; end if;
    if not exists(select 1 from public.teams where id=v_team and active and location_type='field') then raise exception 'invalid_team'; end if;
    -- Only balances still physically held by this team are consolidated. Previous worksite stock stays there.
    for v_entry in select to_jsonb(i) from public.inventory i where team_id=v_team order by item_id for update loop
      v_quantity:=(v_entry->>'quantity')::integer; v_item:=(v_entry->>'item_id')::uuid;
      if v_quantity>0 then
        insert into public.inventory(item_id,team_id,quantity) values(v_item,v_stock,v_quantity) on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity;
        insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(v_item,v_team,v_stock,v_quantity,'transfer','Unificação do estoque da obra',v_actor);
      end if;
    end loop;
    update public.movements set origin_stock_team_id=v_stock where origin_stock_team_id=v_team;
    update public.movements set destination_stock_team_id=v_stock where destination_stock_team_id=v_team;
    delete from public.inventory where team_id=v_team;
    update public.teams set worksite_id=v_site where id=v_team;
  elsif p_command='assign_employee' then
    if not v_admin then raise exception 'admin_required'; end if;
    select * into v_employee from public.epi_employees where id=(p_data->>'employee_id')::uuid and active for update;
    if not found then raise exception 'employee_not_found'; end if;
    if not exists(select 1 from public.teams where id=v_team and active) then raise exception 'invalid_team'; end if;
    if exists(select 1 from public.employee_assignments where employee_id=v_employee.id and starts_at>p_occurred_at) then raise exception 'assignment_date_conflict'; end if;
    update public.employee_assignments set ends_at=p_occurred_at where employee_id=v_employee.id and (ends_at is null or ends_at>p_occurred_at);
    insert into public.employee_assignments(employee_id,team_id,starts_at,ends_at,note,created_by) values(v_employee.id,v_team,p_occurred_at,nullif(p_data->>'ends_at','')::timestamptz,p_data->>'note',v_actor) returning id into v_id;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='end_assignment' then
    if not v_admin then raise exception 'admin_required'; end if;
    update public.employee_assignments set ends_at=p_occurred_at where id=(p_data->>'assignment_id')::uuid and starts_at<=p_occurred_at and (ends_at is null or ends_at>p_occurred_at);
    if not found then raise exception 'assignment_date_conflict'; end if;
  elsif p_command='create_order' then
    if jsonb_typeof(p_data->'lines') is distinct from 'array' then raise exception 'invalid_lines'; end if;
    if jsonb_array_length(p_data->'lines') not between 1 and 100 then raise exception 'invalid_lines'; end if;
    if not exists(select 1 from public.teams where id=v_team and active) then raise exception 'invalid_team'; end if;
    insert into public.supply_orders(team_id,note,created_by,occurred_at) values(v_team,p_data->>'note',v_actor,p_occurred_at) returning id into v_id;
    for v_entry in select value from jsonb_array_elements(p_data->'lines') loop
      v_kind:=v_entry->>'kind';
      if not public.can_operate(case when v_kind='rental' then 'rentals:write' else 'requests:write' end,v_team) then raise exception 'forbidden_team'; end if;
      if v_kind='material' and not exists(select 1 from public.items where id=(v_entry->>'item_id')::uuid and active and item_type='material') then raise exception 'invalid_material'; end if;
      if v_kind='epi' and not exists(select 1 from public.epi_items where id=(v_entry->>'epi_item_id')::uuid and active) then raise exception 'invalid_epi'; end if;
      if v_kind='epi' and exists(select 1 from public.epi_item_variants where item_id=(v_entry->>'epi_item_id')::uuid and active) and not exists(select 1 from public.epi_item_variants where item_id=(v_entry->>'epi_item_id')::uuid and active and value=v_entry->>'variant') then raise exception 'invalid_variant'; end if;
      insert into public.supply_order_lines(order_id,kind,item_id,epi_item_id,description,variant,quantity) values(v_id,v_kind,nullif(v_entry->>'item_id','')::uuid,nullif(v_entry->>'epi_item_id','')::uuid,btrim(v_entry->>'description'),nullif(btrim(v_entry->>'variant'),''),(v_entry->>'quantity')::integer);
    end loop;
    insert into public.supply_order_events(order_id,event,occurred_at,recorded_by) values(v_id,'submitted',p_occurred_at,v_actor);
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='order_status' then
    if not v_admin then raise exception 'admin_required'; end if;
    select * into v_order from public.supply_orders where id=(p_data->>'order_id')::uuid for update;
    if not found then raise exception 'order_not_found'; end if;
    v_status:=p_data->>'status';
    if not ((v_order.status='submitted' and v_status in ('awaiting_owner','rejected','cancelled')) or (v_order.status='awaiting_owner' and v_status in ('approved','rejected','cancelled')) or (v_order.status='approved' and v_status in ('ordered','cancelled')) or (v_order.status='ordered' and v_status='cancelled')) then raise exception 'invalid_order_transition'; end if;
    update public.supply_orders set status=v_status,updated_at=now() where id=v_order.id;
    insert into public.supply_order_events(order_id,event,note,occurred_at,recorded_by) values(v_order.id,v_status,p_data->>'note',p_occurred_at,v_actor);
  elsif p_command='receive_order' then
    select * into v_order from public.supply_orders where id=(p_data->>'order_id')::uuid for update;
    if not found or v_order.status not in ('ordered','partial') then raise exception 'order_not_receivable'; end if;
    select * into v_line from public.supply_order_lines where id=(p_data->>'line_id')::uuid and order_id=v_order.id for update;
    if not found then raise exception 'line_not_found'; end if;
    if not public.can_operate(case when v_line.kind='rental' then 'rentals:write' else 'requests:write' end,v_order.team_id) then raise exception 'forbidden_team'; end if;
    v_quantity:=(p_data->>'quantity')::integer;
    if v_quantity is null or v_quantity<=0 or v_quantity>v_line.quantity-v_line.received_quantity then raise exception 'invalid_quantity'; end if;
    select worksite_id into v_site from public.teams where id=v_order.team_id;
    v_stock:=public.stock_team(v_order.team_id);
    if v_line.kind='material' then
      insert into public.inventory(item_id,team_id,quantity) values(v_line.item_id,v_stock,v_quantity) on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
      insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(v_line.item_id,null,v_order.team_id,v_quantity,'entry','Compra direta - pedido '||v_order.id::text,v_actor);
    elsif v_line.kind='epi' then
      if v_site is null and not exists(select 1 from public.teams where id=v_order.team_id and location_type='central') then raise exception 'worksite_required'; end if;
      if exists(select 1 from public.epi_items where id=v_line.epi_item_id and item_kind='epi') and nullif(btrim(p_data->>'ca_number'),'') is null then raise exception 'ca_required'; end if;
      insert into public.epi_stock_batches(item_id,quantity,variant,ca_number,brand_model,lot_number,created_by,worksite_id) values(v_line.epi_item_id,v_quantity,v_line.variant,p_data->>'ca_number',p_data->>'brand_model',p_data->>'lot_number',v_actor,v_site);
    else
      if nullif(btrim(p_data->>'rental_company'),'') is null or jsonb_typeof(p_data->'asset_codes') is distinct from 'array' then raise exception 'rental_identification_required'; end if;
      if jsonb_array_length(p_data->'asset_codes')<>v_quantity then raise exception 'rental_identification_required'; end if;
      select id into v_item from public.items where code='LOC-'||v_line.id::text;
      if v_item is null then insert into public.items(code,name,item_type,unit) values('LOC-'||v_line.id::text,v_line.description,'equipment','un') returning id into v_item; end if;
      for v_code in select jsonb_array_elements_text(p_data->'asset_codes') loop
        if length(btrim(v_code)) not between 1 and 80 then raise exception 'rental_identification_required'; end if;
        perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_data->>'rental_company'))||':'||lower(btrim(v_code)),0));
        if exists(select 1 from public.assets where active and ownership_type='rented' and lower(btrim(rental_company))=lower(btrim(p_data->>'rental_company')) and lower(btrim(serial_number))=lower(btrim(v_code))) then raise exception 'rental_already_registered'; end if;
        insert into public.assets(item_id,asset_code,serial_number,team_id,status,ownership_type,rental_company,rental_start_date) values(v_item,btrim(p_data->>'rental_company')||':'||btrim(v_code)||':'||v_order.id::text,btrim(v_code),v_order.team_id,'available','rented',btrim(p_data->>'rental_company'),(p_occurred_at at time zone 'America/Fortaleza')::date) returning id into v_id;
        insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,previous_status,new_status,movement_type,note,performed_by) values(v_id,null,v_order.team_id,'available','available','assign','Recebimento de máquina alugada',v_actor);
      end loop;
    end if;
    update public.supply_order_lines set received_quantity=received_quantity+v_quantity where id=v_line.id;
    update public.supply_orders set status=case when exists(select 1 from public.supply_order_lines where order_id=v_order.id and received_quantity<quantity) then 'partial' else 'received' end,updated_at=now() where id=v_order.id;
    insert into public.supply_order_events(order_id,line_id,event,quantity,note,occurred_at,recorded_by) values(v_order.id,v_line.id,'received',v_quantity,p_data->>'note',p_occurred_at,v_actor);
  elsif p_command='rental_notify' then
    select * into v_asset from public.assets where id=(p_data->>'asset_id')::uuid and active and ownership_type='rented' for update;
    if not found then raise exception 'rental_not_found'; end if;
    if not public.can_operate('rentals:write',v_asset.team_id) then raise exception 'forbidden_team'; end if;
    insert into public.rental_return_requests(asset_id,team_id,note,occurred_at,created_by) values(v_asset.id,v_asset.team_id,p_data->>'note',p_occurred_at,v_actor) returning id into v_id;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='rental_resolve' then
    if not v_admin then raise exception 'admin_required'; end if;
    v_status:=p_data->>'status';
    if v_status not in ('arranged','returned','cancelled') then raise exception 'invalid_status'; end if;
    select asset_id into v_id from public.rental_return_requests where id=(p_data->>'request_id')::uuid and status in ('pending','arranged') for update;
    if not found then raise exception 'rental_request_not_found'; end if;
    if v_status='returned' then perform public.return_rented_equipment(v_id,p_data->>'note'); end if;
    update public.rental_return_requests set status=v_status,resolved_at=case when v_status='arranged' then null else p_occurred_at end,resolved_by=v_actor where id=(p_data->>'request_id')::uuid;
  elsif p_command='rental_details' then
    if not v_admin then raise exception 'admin_required'; end if;
    v_id:=(p_data->>'asset_id')::uuid;
    if not exists(select 1 from public.assets where id=v_id and ownership_type='rented') then raise exception 'rental_not_found'; end if;
    insert into public.rental_admin_details(asset_id,amount,billing_period,expected_return,billing_closed_on,note,updated_by) values(v_id,nullif(p_data->>'amount','')::numeric,nullif(p_data->>'billing_period',''),nullif(p_data->>'expected_return','')::date,nullif(p_data->>'billing_closed_on','')::date,p_data->>'note',v_actor)
    on conflict(asset_id) do update set amount=excluded.amount,billing_period=excluded.billing_period,expected_return=excluded.expected_return,billing_closed_on=excluded.billing_closed_on,note=excluded.note,updated_by=v_actor,updated_at=now();
  elsif p_command='epi_entry' then
    if not public.can_operate('epi:write',v_team) then raise exception 'forbidden_team'; end if;
    select worksite_id into v_site from public.teams where id=v_team and active;
    if not found then raise exception 'invalid_team'; end if;
    if v_site is null and not exists(select 1 from public.teams where id=v_team and location_type='central') then raise exception 'worksite_required'; end if;
    v_item:=(p_data->>'item_id')::uuid;
    if exists(select 1 from public.epi_items where id=v_item and item_kind='epi') and nullif(btrim(p_data->>'ca_number'),'') is null then raise exception 'ca_required'; end if;
    v_id:=public.add_epi_stock_batch(v_item,(p_data->>'quantity')::integer,p_data->>'variant',p_data->>'ca_number',p_data->>'brand_model',p_data->>'lot_number');
    update public.epi_stock_batches set worksite_id=v_site where id=v_id;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='epi_transfer' then
    if not public.can_operate('epi:write',v_team) then raise exception 'forbidden_team'; end if;
    select worksite_id into v_site from public.teams where id=v_team and active;
    if not found then raise exception 'invalid_team'; end if;
    if v_site is null and not exists(select 1 from public.teams where id=v_team and location_type='central') then raise exception 'worksite_required'; end if;
    select * into v_batch from public.epi_stock_batches where id=(p_data->>'stock_batch_id')::uuid for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.worksite_id is not null and not exists(select 1 from public.teams t where t.worksite_id=v_batch.worksite_id and public.can_operate('epi:write',t.id)) then raise exception 'forbidden_team'; end if;
    if v_batch.worksite_id is not distinct from v_site then raise exception 'same_worksite_stock'; end if;
    v_quantity:=(p_data->>'quantity')::integer;
    if v_quantity is null or v_quantity<=0 or v_quantity>v_batch.quantity then raise exception 'insufficient_epi_stock'; end if;
    update public.epi_stock_batches set quantity=quantity-v_quantity where id=v_batch.id;
    insert into public.epi_stock_batches(item_id,quantity,variant,ca_number,brand_model,lot_number,expires_on,created_by,worksite_id) values(v_batch.item_id,v_quantity,v_batch.variant,v_batch.ca_number,v_batch.brand_model,v_batch.lot_number,v_batch.expires_on,v_actor,v_site) returning id into v_id;
    insert into public.epi_stock_transfers(origin_batch_id,destination_batch_id,quantity,team_id,occurred_at,created_by) values(v_batch.id,v_id,v_quantity,v_team,p_occurred_at,v_actor);
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='set_worksite_status' then
    if not v_admin then raise exception 'admin_required'; end if;
    update public.worksites set active=(p_data->>'active')::boolean where id=(p_data->>'worksite_id')::uuid;
    if not found then raise exception 'worksite_not_found'; end if;
  elsif p_command='consume' then
    perform public.consume_material((p_data->>'item_id')::uuid,v_team,(p_data->>'quantity')::integer,p_data->>'note');
  elsif p_command='material_entry' then
    v_id:=public.register_movement((p_data->>'item_id')::uuid,'entry',(p_data->>'quantity')::integer,null,v_team,p_data->>'note');
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='transfer_equipment' then
    v_id:=public.register_asset_movement((p_data->>'asset_id')::uuid,'transfer',v_team,'available',p_data->>'note');
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='close_epi' then
    v_id:=public.close_epi_delivery_quantity((p_data->>'delivery_id')::uuid,(p_data->>'quantity')::integer,p_data->>'status');
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='deliver_epi' then
    v_id:=public.register_epi_delivery_batch((p_data->>'employee_id')::uuid,p_data->'lines',coalesce(p_data->>'reason','initial'),p_data->>'note');
    v_result:=jsonb_build_object('id',v_id);
  else raise exception 'invalid_command'; end if;
  update public.site_operation_receipts set result=v_result where id=p_operation_id;
  return v_result;
end; $$;
revoke all on function public.run_site_operation(text,jsonb,uuid,timestamptz) from public,anon;
grant execute on function public.run_site_operation(text,jsonb,uuid,timestamptz) to authenticated;

create or replace function public.site_dashboard() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
  'works', coalesce((select jsonb_agg(to_jsonb(w) order by w.name) from public.worksites w),'[]'::jsonb),
  'teams', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'worksite_id',t.worksite_id,'central',t.location_type='central') order by t.name) from public.teams t where t.active),'[]'::jsonb),
  'materials', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'code',i.code,'unit',i.unit,'stock',coalesce((select jsonb_agg(jsonb_build_object('team_id',s.team_id,'quantity',s.quantity)) from public.inventory s where s.item_id=i.id),'[]'::jsonb)) order by i.name) from public.items i where i.active and i.item_type='material'),'[]'::jsonb),
  'epi_items', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'code',i.code,'kind',i.item_kind,'variants',coalesce((select jsonb_agg(v.value order by v.sort_order) from public.epi_item_variants v where v.item_id=i.id and v.active),'[]'::jsonb)) order by i.name) from public.epi_items i where i.active),'[]'::jsonb),
  'batches', coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'item_id',b.item_id,'quantity',b.quantity,'variant',b.variant,'ca_number',b.ca_number,'worksite_id',b.worksite_id) order by b.received_at) from public.epi_stock_batches b where b.quantity>0),'[]'::jsonb),
  'employees', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.full_name,'team_id',public.employee_work_team(e.id),'home_team_id',e.team_id) order by e.full_name) from public.epi_employees e where e.active),'[]'::jsonb),
  'assignments', coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at desc) from public.employee_assignments a where a.ends_at is null or a.ends_at>now()-interval '90 days'),'[]'::jsonb),
  'assets', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',i.name,'code',a.asset_code,'number',a.serial_number,'company',a.rental_company,'team_id',a.team_id,'status',a.status,'active',a.active,'ownership',a.ownership_type) order by i.name,a.asset_code) from public.assets a join public.items i on i.id=a.item_id where a.active or (public.is_active_admin() and a.ownership_type='rented')),'[]'::jsonb),
  'orders', coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.description) from public.supply_order_lines l where l.order_id=o.id),'[]'::jsonb),'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.recorded_at) from public.supply_order_events e where e.order_id=o.id),'[]'::jsonb)) order by o.created_at desc) from public.supply_orders o),'[]'::jsonb),
  'rental_returns', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.rental_return_requests r),'[]'::jsonb),
  'rental_details', coalesce((select jsonb_agg(to_jsonb(r)) from public.rental_admin_details r),'[]'::jsonb),
  'alerts', case when public.is_active_admin() then coalesce((select jsonb_agg(a) from (
    select 'order:'||o.id::text as id,'Pedido aguardando providência' as title,t.name||' - '||case o.status when 'submitted' then 'Recebido pela ADM' when 'awaiting_owner' then 'Aguardando aprovação do patrão' when 'approved' then 'Aprovado: falta providenciar compra' else 'Há itens ainda não recebidos' end as description,'orders' as section from public.supply_orders o join public.teams t on t.id=o.team_id where o.status in ('submitted','awaiting_owner','approved','partial')
    union all select 'return:'||r.id::text,'Máquina liberada pela obra',a.asset_code||' - '||r.note,'rentals' from public.rental_return_requests r join public.assets a on a.id=r.asset_id where r.status in ('pending','arranged')
    union all select 'rental:'||a.id::text,'Devolução prevista vencida',a.asset_code||' - '||a.rental_company,'rentals' from public.assets a left join public.rental_admin_details d on d.asset_id=a.id where a.active and a.ownership_type='rented' and coalesce(d.expected_return,a.rental_end_date)<current_date
    union all select 'idle:'||a.id::text,'Conferir necessidade da máquina',a.asset_code||' - sem movimentação registrada há 14 dias','rentals' from public.assets a where a.active and a.ownership_type='rented' and a.updated_at<now()-interval '14 days'
    union all select 'closedwork:'||a.id::text,'Máquina em obra encerrada',a.asset_code||' - '||w.name,'rentals' from public.assets a join public.teams t on t.id=a.team_id join public.worksites w on w.id=t.worksite_id where a.active and a.ownership_type='rented' and not w.active
    union all select 'stock:'||s.id::text,'Material abaixo do mínimo',i.name||' - '||t.name||': '||s.quantity::text||' '||i.unit,'stock' from public.inventory s join public.items i on i.id=s.item_id join public.teams t on t.id=s.team_id where i.active and s.quantity<i.minimum_stock
    union all select 'epi:'||i.id::text,'EPI abaixo do mínimo',i.name,'stock' from public.epi_items i where i.active and coalesce((select sum(b.quantity) from public.epi_stock_batches b where b.item_id=i.id),0)<i.minimum_stock
    union all select 'aso:'||e.id::text,'ASO próximo do vencimento ou vencido',e.full_name||' - '||e.aso_expiry_date::text,'people' from public.epi_employees e where e.active and e.aso_expiry_date<=current_date+30
    union all select 'replacement:'||d.id::text,'Conferir reposição de EPI',e.full_name||' - '||i.name,'people' from public.epi_deliveries d join public.epi_items i on i.id=d.item_id join public.epi_employees e on e.id=d.employee_id where d.current_status='active' and i.replacement_days is not null and d.delivered_at+(i.replacement_days*interval '1 day')<=now()
  ) a),'[]'::jsonb) else '[]'::jsonb end
);
$$;
revoke all on function public.site_dashboard() from public,anon;
grant execute on function public.site_dashboard() to authenticated;

CREATE OR REPLACE FUNCTION public.create_material_for_team(p_code text, p_name text, p_description text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_unit text DEFAULT 'un'::text, p_minimum_stock integer DEFAULT 0, p_team_id uuid DEFAULT NULL::uuid, p_quantity integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user_id uuid:=auth.uid(); v_role text; v_user_team uuid; v_item_id uuid;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
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
 insert into public.inventory(item_id,team_id,quantity,status) values(v_item_id,public.stock_team(p_team_id),p_quantity,'available')
 on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by)
 values(v_item_id,null,p_team_id,p_quantity,'entry','Entrada de material',v_user_id);
 return v_item_id;
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
  perform pg_advisory_xact_lock_shared(73002,1);
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
   update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=public.stock_team(p_origin_team_id) and quantity>=p_quantity returning quantity into v_remaining;
   if not found then raise exception 'insufficient_stock'; end if;
 end if;
 if p_destination_team_id is not null then
   insert into public.inventory(item_id,team_id,quantity) values(p_item_id,public.stock_team(p_destination_team_id),p_quantity)
   on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 end if;
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by)
 values(p_item_id,p_origin_team_id,p_destination_team_id,p_quantity,p_movement_type,nullif(trim(p_note),''),v_user_id) returning id into v_movement_id;
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
  perform pg_advisory_xact_lock_shared(73002,1);
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('consumption:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('consumption:write', p_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 then raise exception 'invalid_quantity'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=public.stock_team(p_team_id) for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=public.stock_team(p_team_id);
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
  perform pg_advisory_xact_lock_shared(73002,1);
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('materials:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('materials:write', p_destination_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 or p_origin_team_id=p_destination_team_id then raise exception 'invalid_quantity'; end if;
 if not exists(select 1 from public.teams where id=p_origin_team_id and active=true and location_type='central') then raise exception 'origin_must_be_cosem'; end if;
 if not exists(select 1 from public.teams where id=p_destination_team_id and active=true and location_type='field') then raise exception 'destination_must_be_field_team'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=public.stock_team(p_origin_team_id) for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=public.stock_team(p_origin_team_id);
 insert into public.inventory(item_id,team_id,quantity,status) values(p_item_id,public.stock_team(p_destination_team_id),p_quantity,'available') on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
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
  perform pg_advisory_xact_lock_shared(73002,1);
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
  v_employee.team_id := public.employee_work_team(v_employee.id, coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()));
  if not public.can_operate('epi:write', v_employee.team_id) then raise exception 'forbidden_team'; end if;

  select * into v_batch
  from public.epi_stock_batches
  where id = p_stock_batch_id and item_id = p_item_id
  for update;
  if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.worksite_id is not null and v_batch.worksite_id is distinct from (select worksite_id from public.teams where id=v_employee.team_id) then raise exception 'wrong_worksite_stock'; end if;
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
  perform pg_advisory_xact_lock_shared(73002,1);
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) = 0
     or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid_delivery_lines';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active
  for update;
  if not found then raise exception 'employee_not_found'; end if;
  v_employee.team_id := public.employee_work_team(v_employee.id, coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()));
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
    if v_batch.worksite_id is not null and v_batch.worksite_id is distinct from (select worksite_id from public.teams where id=v_employee.team_id) then raise exception 'wrong_worksite_stock'; end if;
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
  perform pg_advisory_xact_lock_shared(73002,1);
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
  v_employee.team_id := public.employee_work_team(v_employee.id, coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()));
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
  perform pg_advisory_xact_lock_shared(73002,1);
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
  v_employee.team_id := public.employee_work_team(v_employee.id, coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()));
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
    if v_batch.worksite_id is not null and v_batch.worksite_id is distinct from (select worksite_id from public.teams where id=v_employee.team_id) then raise exception 'wrong_worksite_stock'; end if;
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

-- Keep the existing administration screens compatible with shared stock.
CREATE OR REPLACE FUNCTION public.admin_delete_material_movement(p_movement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m public.movements%rowtype;
  v_qty integer;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into m from public.movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;
  if m.note='Unificação do estoque da obra' or m.note like 'Compra direta - pedido %' then raise exception 'linked_movement_immutable'; end if;

  if m.destination_team_id is not null then
    update public.inventory
       set quantity=quantity-m.quantity, updated_at=now()
     where item_id=m.item_id and team_id=m.destination_stock_team_id and quantity>=m.quantity
     returning quantity into v_qty;
    if not found then raise exception 'cannot_reverse_destination_stock'; end if;
  end if;

  if m.origin_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,m.origin_stock_team_id,m.quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  delete from public.movements where id=p_movement_id;
end;
$function$
;

-- Keep the existing administration screens compatible with shared stock.
CREATE OR REPLACE FUNCTION public.admin_update_material_movement(p_movement_id uuid, p_quantity integer, p_origin_team_id uuid, p_destination_team_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m public.movements%rowtype;
  v_qty integer;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'invalid_quantity'; end if;
  if p_origin_team_id is not null and p_destination_team_id is not null and p_origin_team_id=p_destination_team_id then
    raise exception 'same_team_transfer';
  end if;

  select * into m from public.movements where id=p_movement_id for update;
  if not found then raise exception 'movement_not_found'; end if;
  if m.note='Unificação do estoque da obra' or m.note like 'Compra direta - pedido %' then raise exception 'linked_movement_immutable'; end if;

  -- Reverte o efeito antigo.
  if m.destination_team_id is not null then
    update public.inventory set quantity=quantity-m.quantity, updated_at=now()
    where item_id=m.item_id and team_id=m.destination_stock_team_id and quantity>=m.quantity
    returning quantity into v_qty;
    if not found then raise exception 'cannot_reverse_destination_stock'; end if;
  end if;
  if m.origin_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,m.origin_stock_team_id,m.quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  -- Aplica o novo efeito.
  if p_origin_team_id is not null then
    update public.inventory set quantity=quantity-p_quantity, updated_at=now()
    where item_id=m.item_id and team_id=public.stock_team(p_origin_team_id) and quantity>=p_quantity
    returning quantity into v_qty;
    if not found then raise exception 'insufficient_stock'; end if;
  end if;
  if p_destination_team_id is not null then
    insert into public.inventory(item_id,team_id,quantity,status)
    values(m.item_id,public.stock_team(p_destination_team_id),p_quantity,'available')
    on conflict (item_id,team_id) do update
      set quantity=public.inventory.quantity+excluded.quantity, updated_at=now();
  end if;

  update public.movements
  set origin_stock_team_id=public.stock_team(p_origin_team_id),
      destination_stock_team_id=public.stock_team(p_destination_team_id),
      quantity=p_quantity,
      origin_team_id=p_origin_team_id,
      destination_team_id=p_destination_team_id,
      note=nullif(trim(p_note),'')
  where id=p_movement_id;
end;
$function$
;

-- Keep the existing administration screens compatible with shared stock.
CREATE OR REPLACE FUNCTION public.delete_team_admin(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_location_type text;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
  if not public.is_active_admin() then
    raise exception 'admin_required';
  end if;

  if exists(select 1 from public.teams where id=p_team_id and worksite_id is not null) then raise exception 'team_linked_to_worksite'; end if;

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

-- The current responsible may record the disposition of EPI carried by a borrowed employee.
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

  if not public.can_operate('epi:write', public.employee_work_team(v_delivery.employee_id)) then raise exception 'forbidden_team'; end if;
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
