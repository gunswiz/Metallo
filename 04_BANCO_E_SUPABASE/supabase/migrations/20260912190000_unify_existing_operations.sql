-- LOCAL ONLY: apply after review and explicit publication approval.
-- Keep old public RPC signatures for installed APKs.
begin;

alter table public.assets add column replaces_asset_id uuid references public.assets(id);
create unique index assets_replaces_asset_idx on public.assets(replaces_asset_id) where replaces_asset_id is not null;

-- Run after the old notes decoder. Keep older installed clients' representation
-- synchronized whenever a typed rental field changes.
create or replace function public.encode_asset_legacy_metadata()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.notes:=concat_ws(E'\n','#metallo:ownership='||new.ownership_type,
    case when new.ownership_type='rented' then '#metallo:rental_company='||public.asset_legacy_encode(new.rental_company) end,
    case when new.ownership_type='rented' and new.rental_start_date is not null then '#metallo:rental_start='||new.rental_start_date::text end,
    case when new.ownership_type='rented' and new.rental_end_date is not null then '#metallo:rental_end='||new.rental_end_date::text end,
    new.user_notes);
  return new;
end; $$;
revoke all on function public.encode_asset_legacy_metadata() from public,anon,authenticated;
create trigger zz_encode_asset_legacy_metadata before insert or update of notes,user_notes,ownership_type,rental_company,rental_start_date,rental_end_date
on public.assets for each row execute function public.encode_asset_legacy_metadata();

create or replace function public.return_rented_equipment(p_asset_id uuid,p_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; v_note text:=public.asset_visible_notes(p_note);
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into a from public.assets where id=p_asset_id for update;
  if not found or a.ownership_type<>'rented' then raise exception 'rented_equipment_required'; end if;
  if not a.active then
    if not exists(select 1 from public.asset_movements where asset_id=a.id and movement_type='rental_return') then
      raise exception 'invalid_or_inactive_asset';
    end if;
  else
    insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,previous_status,new_status,movement_type,note,performed_by)
    values(a.id,a.team_id,a.team_id,a.status,'retired','rental_return','Devolução à locadora'||coalesce(': '||v_note,''),auth.uid());
    update public.assets set active=false,status='retired',updated_at=now(),
      user_notes=concat_ws(E'\n',a.user_notes,'Devolvido à locadora em '||current_date::text||coalesce(': '||v_note,'')),
      notes=concat_ws(E'\n',a.notes,'Devolvido à locadora em '||current_date::text||coalesce(': '||v_note,''))
    where id=a.id;
  end if;
  update public.rental_return_requests set status='returned',
    resolved_at=coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()),resolved_by=auth.uid()
    where asset_id=a.id and status in ('pending','arranged');
  -- billing_closed_on is deliberately confirmed separately by ADM.
end; $$;
revoke all on function public.return_rented_equipment(uuid,text) from public,anon;
grant execute on function public.return_rented_equipment(uuid,text) to authenticated;

-- Reconcile only returns supported by an existing physical-return movement.
update public.rental_return_requests r set status='returned',resolved_at=m.occurred_at,resolved_by=m.performed_by
from public.assets a, lateral (
  select occurred_at,performed_by from public.asset_movements
  where asset_id=a.id and movement_type='rental_return' order by occurred_at desc,created_at desc limit 1
) m where r.asset_id=a.id and not a.active and a.ownership_type='rented' and r.status in ('pending','arranged');

-- Consolidate the forecast used by the UI and alerts. Preserve conflicting prior
-- dates in the asset's notes before choosing the date already used by alerts.
update public.assets a set
  user_notes=concat_ws(E'\n',a.user_notes,case when a.rental_end_date is not null then
    'Consolidação da previsão: ficha anterior '||a.rental_end_date::text||'; previsão da ADM '||d.expected_return::text end),
  rental_end_date=d.expected_return
from public.rental_admin_details d
where d.asset_id=a.id and d.expected_return is not null and a.rental_end_date is distinct from d.expected_return;
update public.rental_admin_details d set expected_return=a.rental_end_date
from public.assets a where a.id=d.asset_id and d.expected_return is distinct from a.rental_end_date;

create or replace function public.sync_rental_forecast_from_asset()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.rental_end_date is distinct from old.rental_end_date then
    update public.rental_admin_details set expected_return=new.rental_end_date,updated_at=now()
      where asset_id=new.id and expected_return is distinct from new.rental_end_date;
  end if;
  return new;
end; $$;
revoke all on function public.sync_rental_forecast_from_asset() from public,anon,authenticated;
create trigger asset_rental_forecast after update of rental_end_date on public.assets
for each row execute function public.sync_rental_forecast_from_asset();

create or replace function public.replace_rented_equipment(
  p_asset_id uuid,p_asset_code text,p_serial_number text default null,p_note text default null,
  p_occurred_at timestamptz default now(),p_operation_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.assets%rowtype; v_id uuid; r public.site_operation_receipts%rowtype;
  v_payload jsonb:=jsonb_build_object('asset_id',p_asset_id,'asset_code',btrim(p_asset_code),'serial_number',p_serial_number,'note',p_note);
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'admin_required'; end if;
  if p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' or p_occurred_at<'2000-01-01'::timestamptz then raise exception 'invalid_operation_time'; end if;
  if length(btrim(coalesce(p_asset_code,''))) not between 1 and 80 or length(coalesce(p_serial_number,''))>120
     or length(btrim(coalesce(p_note,''))) not between 3 and 500 then raise exception 'invalid_replacement'; end if;
  if p_operation_id is not null then
    insert into public.site_operation_receipts(id,actor_id,command,payload,occurred_at)
      values(p_operation_id,auth.uid(),'replace_rented_equipment',v_payload,p_occurred_at) on conflict(id) do nothing;
    select * into r from public.site_operation_receipts where id=p_operation_id for update;
    if r.actor_id<>auth.uid() or r.command<>'replace_rented_equipment' or r.payload<>v_payload or r.occurred_at<>p_occurred_at then raise exception 'operation_id_conflict'; end if;
    if r.result is not null then return (r.result->>'id')::uuid; end if;
  end if;
  select * into a from public.assets where id=p_asset_id for update;
  if not found or not a.active or a.ownership_type<>'rented' or a.team_id is null
    or lower(btrim(a.asset_code))=lower(btrim(p_asset_code)) then raise exception 'invalid_replacement'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(a.rental_company))||':'||lower(btrim(coalesce(nullif(p_serial_number,''),p_asset_code))),0));
  if exists(select 1 from public.assets where active and ownership_type='rented'
    and lower(btrim(rental_company))=lower(btrim(a.rental_company))
    and lower(btrim(coalesce(nullif(serial_number,''),asset_code)))=lower(btrim(coalesce(nullif(p_serial_number,''),p_asset_code)))) then raise exception 'rental_already_registered'; end if;
  perform set_config('metallo.occurred_at',p_occurred_at::text,true);
  perform public.return_rented_equipment(a.id,'Substituição por '||btrim(p_asset_code)||': '||p_note);
  insert into public.assets(item_id,asset_code,serial_number,team_id,status,ownership_type,rental_company,rental_start_date,rental_end_date,user_notes,replaces_asset_id)
    values(a.item_id,btrim(p_asset_code),nullif(btrim(p_serial_number),''),a.team_id,'available','rented',a.rental_company,
      (p_occurred_at at time zone 'America/Fortaleza')::date,
      case when a.rental_end_date >= (p_occurred_at at time zone 'America/Fortaleza')::date then a.rental_end_date else null end,
      'Substitui '||a.asset_code||': '||p_note,a.id) returning id into v_id;
  insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,previous_status,new_status,movement_type,note,performed_by)
    values(v_id,null,a.team_id,'available','available','assign','Substituição da máquina '||a.asset_code,auth.uid());
  if p_operation_id is not null then update public.site_operation_receipts set result=jsonb_build_object('id',v_id) where id=p_operation_id; end if;
  return v_id;
end; $$;
revoke all on function public.replace_rented_equipment(uuid,text,text,text,timestamptz,uuid) from public,anon;
grant execute on function public.replace_rented_equipment(uuid,text,text,text,timestamptz,uuid) to authenticated;

-- The public operation dispatcher and snapshot are appended below, retaining
-- existing validation, permissions, atomic receipts, and event timestamps.

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
    perform 1 from public.assets where id=(select asset_id from public.rental_return_requests where id=(p_data->>'request_id')::uuid) for update;
    select asset_id into v_id from public.rental_return_requests where id=(p_data->>'request_id')::uuid and status in ('pending','arranged') for update;
    if not found then raise exception 'rental_request_not_found'; end if;
    if v_status='returned' then perform public.return_rented_equipment(v_id,p_data->>'note'); end if;
    update public.rental_return_requests set status=v_status,resolved_at=case when v_status='arranged' then null else p_occurred_at end,resolved_by=v_actor where id=(p_data->>'request_id')::uuid;
  elsif p_command='rental_details' then
    if not v_admin then raise exception 'admin_required'; end if;
    v_id:=(p_data->>'asset_id')::uuid;
    if not exists(select 1 from public.assets where id=v_id and ownership_type='rented') then raise exception 'rental_not_found'; end if;
    update public.assets set rental_end_date=nullif(p_data->>'expected_return','')::date where id=v_id;
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
  elsif p_command='material_movement' then
    if p_data->>'movement_type' in ('entry','replenishment') then raise exception 'use_receiving_flow'; end if;
    if p_data->>'movement_type'='consumption' then
      perform public.consume_material((p_data->>'item_id')::uuid,(p_data->>'origin_team_id')::uuid,(p_data->>'quantity')::integer,p_data->>'note');
    else
      v_id:=public.register_movement((p_data->>'item_id')::uuid,
        case when p_data->>'movement_type'='return' and nullif(p_data->>'origin_team_id','') is not null then 'transfer' else p_data->>'movement_type' end,
        (p_data->>'quantity')::integer,nullif(p_data->>'origin_team_id','')::uuid,nullif(p_data->>'destination_team_id','')::uuid,p_data->>'note');
    end if;
    v_result:=jsonb_build_object('id',v_id);
  elsif p_command='asset_movement' then
    v_id:=public.register_asset_movement((p_data->>'asset_id')::uuid,p_data->>'movement_type',nullif(p_data->>'destination_team_id','')::uuid,p_data->>'new_status',p_data->>'note');
    v_result:=jsonb_build_object('id',v_id);
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
  'epi_items', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'code',i.code,'kind',i.item_kind,'unit',i.unit,'variants',coalesce((select jsonb_agg(v.value order by v.sort_order) from public.epi_item_variants v where v.item_id=i.id and v.active),'[]'::jsonb)) order by i.name) from public.epi_items i where i.active),'[]'::jsonb),
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
commit;
