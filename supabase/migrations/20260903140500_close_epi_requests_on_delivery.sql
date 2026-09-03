create or replace function public.register_epi_delivery_batch(
  p_employee_id uuid,
  p_lines jsonb,
  p_delivery_reason text default 'initial',
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_request public.epi_requests%rowtype;
  v_line jsonb;
  v_quantity integer;
  v_delivered_remaining integer;
  v_group_id uuid := gen_random_uuid();
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_delivery';
  end if;

  select * into v_employee from public.epi_employees
  where id = p_employee_id and active for update;
  if not found then raise exception 'employee_not_found'; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity <= 0 then raise exception 'invalid_quantity'; end if;

    select * into v_batch from public.epi_stock_batches
    where id = (v_line->>'stock_batch_id')::uuid
      and item_id = (v_line->>'item_id')::uuid for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.quantity < v_quantity then
      raise exception 'insufficient_epi_stock';
    end if;

    update public.epi_stock_batches set quantity = quantity - v_quantity
    where id = v_batch.id;

    insert into public.epi_deliveries(
      employee_id, team_id, item_id, stock_batch_id, quantity,
      delivery_reason, delivery_group_id, ca_snapshot,
      brand_model_snapshot, lot_snapshot, variant_snapshot, note
    ) values (
      v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id,
      v_quantity, p_delivery_reason, v_group_id, v_batch.ca_number,
      v_batch.brand_model, v_batch.lot_number, v_batch.variant,
      nullif(trim(p_note), '')
    );

    v_delivered_remaining := v_quantity;
    for v_request in
      select * from public.epi_requests
      where employee_id = v_employee.id
        and item_id = v_batch.item_id
        and status = 'pending'
      order by created_at, id
      for update
    loop
      exit when v_delivered_remaining = 0;
      if v_delivered_remaining >= v_request.quantity then
        v_delivered_remaining := v_delivered_remaining - v_request.quantity;
        update public.epi_requests
          set status = 'fulfilled', fulfilled_by = auth.uid(),
              fulfilled_at = now()
        where id = v_request.id;
      else
        update public.epi_requests
          set quantity = quantity - v_delivered_remaining
        where id = v_request.id;
        v_delivered_remaining := 0;
      end if;
    end loop;
  end loop;

  return v_group_id;
end;
$$;

revoke execute on function public.register_epi_delivery_batch(uuid,jsonb,text,text)
  from public, anon;
grant execute on function public.register_epi_delivery_batch(uuid,jsonb,text,text)
  to authenticated;
