-- Close only the selected quantity from an active EPI delivery. This keeps the
-- remaining units assigned to the employee and records the selected units in
-- the immutable history, in the same transaction.

create or replace function public.enforce_epi_delivery_close()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.enforce_epi_delivery_close()
  from public, anon, authenticated;

-- A closed split is historical data, not a new delivery. Prevent it from
-- consuming or fulfilling a pending COSEM request.
create or replace function public.reconcile_epi_request_after_delivery()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke execute on function public.reconcile_epi_request_after_delivery()
  from public, anon, authenticated;

create or replace function public.close_epi_delivery_quantity(
  p_delivery_id uuid,
  p_quantity integer,
  p_status text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

comment on function public.close_epi_delivery_quantity(uuid, integer, text)
  is 'Atomically closes a selected quantity and keeps the remaining delivery active.';

revoke all on function public.close_epi_delivery_quantity(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.close_epi_delivery_quantity(uuid, integer, text)
  to authenticated;
