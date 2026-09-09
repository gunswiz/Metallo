-- Harden EPI mutations without breaking the currently installed app.
-- Stock decrements and delivery creation happen only in the controlled RPCs.

-- No database function is part of the pre-login API. Existing authenticated
-- grants remain intact, while future postgres-owned functions start private.
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

revoke all on table public.epi_stock_batches from anon;
revoke all on table public.epi_deliveries from anon;
revoke all on table public.epi_requests from anon;

drop policy if exists epi_stock_delivery_update on public.epi_stock_batches;
revoke update, delete on table public.epi_stock_batches from authenticated;
revoke insert on table public.epi_stock_batches from authenticated;
grant insert (
  item_id, quantity, ca_number, brand_model, lot_number, expires_on, variant
) on table public.epi_stock_batches to authenticated;

drop policy if exists epi_deliveries_write on public.epi_deliveries;
revoke insert, update, delete on table public.epi_deliveries from authenticated;
grant update (current_status, closed_at, closed_by)
  on table public.epi_deliveries to authenticated;

create policy epi_deliveries_close on public.epi_deliveries
for update to authenticated
using (
  current_status = 'active'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  )
)
with check (
  current_status in ('returned', 'replaced', 'lost', 'damaged', 'consumed')
  and closed_by = (select auth.uid())
  and closed_at is not null
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  )
);

create or replace function public.enforce_epi_delivery_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
$$;

revoke execute on function public.enforce_epi_delivery_close()
  from public, anon, authenticated;

drop trigger if exists enforce_epi_delivery_close on public.epi_deliveries;
create trigger enforce_epi_delivery_close
before update on public.epi_deliveries
for each row execute function public.enforce_epi_delivery_close();

drop policy if exists epi_requests_write on public.epi_requests;
revoke insert, update, delete on table public.epi_requests from authenticated;
grant insert (employee_id, team_id, item_id, quantity, requested_variant)
  on table public.epi_requests to authenticated;

create policy epi_requests_create on public.epi_requests
for insert to authenticated
with check (
  status = 'pending'
  and requested_by = (select auth.uid())
  and fulfilled_by is null
  and fulfilled_at is null
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active
      and p.role in ('admin', 'engineer')
  )
  and exists (
    select 1
    from public.epi_employees e
    where e.id = employee_id
      and e.team_id = team_id
      and e.active
  )
  and exists (
    select 1
    from public.epi_items i
    where i.id = item_id
      and i.active
  )
);

create or replace function public.register_epi_delivery(
  p_employee_id uuid,
  p_item_id uuid,
  p_stock_batch_id uuid,
  p_quantity integer,
  p_delivery_reason text default 'initial',
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.register_epi_delivery(
  uuid, uuid, uuid, integer, text, text
) from public, anon;
grant execute on function public.register_epi_delivery(
  uuid, uuid, uuid, integer, text, text
) to authenticated;

create or replace function public.register_epi_delivery_batch(
  p_employee_id uuid,
  p_lines jsonb,
  p_delivery_reason text default 'initial',
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.register_epi_delivery_batch(
  uuid, jsonb, text, text
) from public, anon;
grant execute on function public.register_epi_delivery_batch(
  uuid, jsonb, text, text
) to authenticated;

create or replace function public.fulfill_epi_request(
  p_request_id uuid,
  p_stock_batch_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.fulfill_epi_request(uuid, uuid)
  from public, anon;
grant execute on function public.fulfill_epi_request(uuid, uuid)
  to authenticated;

-- Existing direct inserts remain compatible, but reconciliation now happens
-- only once in the trigger and only for the matching variant.
