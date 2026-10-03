-- Delta local após os dois ciclos Grok. Não aplicar no Supabase remoto.
-- F-3G-01: a constraint/idempotência transacional existente permanece; F-3G-02 e 07 abaixo.
begin;
create or replace function public.deliver_personal_item_3g(p_employee_id uuid,p_item_id uuid,p_quantity integer,
  p_variant text,p_note text,p_idempotency_key uuid,p_stock_origin text,p_stock_batch_id uuid,
  p_exception_reason text,p_exception_confirmed boolean) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_employee public.epi_employees%rowtype; v_item public.epi_items%rowtype;
  v_batch public.epi_stock_batches%rowtype; v_previous private.personal_item_deliveries_3g%rowtype;
  v_id uuid; v_worksite uuid;
  v_variant text:=nullif(pg_catalog.btrim(p_variant),'');
  v_note text:=nullif(pg_catalog.btrim(p_note),'');
  v_reason text:=nullif(pg_catalog.btrim(p_exception_reason),'');
begin
  if (select auth.uid()) is null or p_employee_id is null or p_item_id is null or p_idempotency_key is null
    or p_quantity is null or p_quantity not between 1 and 1000
    or char_length(p_variant)>80 or char_length(p_note)>240
    or p_variant ~ '[[:cntrl:]]' or p_note ~ '[[:cntrl:]]'
    or p_stock_origin is null or p_stock_origin not in ('STOCK_BATCH','WITHOUT_STOCK')
    or (p_stock_origin='STOCK_BATCH') is distinct from (p_stock_batch_id is not null)
    or (p_stock_origin='STOCK_BATCH' and (v_reason is not null or p_exception_confirmed is distinct from false))
    or (p_stock_origin='WITHOUT_STOCK' and (v_reason is null or
      v_reason not in ('EXTERNAL_SUPPLY','UNTRACKED_LEGACY_STOCK',
        'AUTHORIZED_OPERATIONAL_ADJUSTMENT','OTHER') or p_exception_confirmed is distinct from true
      or (v_reason='OTHER' and v_note is null)))
  then raise exception 'invalid_personal_item_delivery'; end if;
  select * into v_employee from public.epi_employees where id=p_employee_id and active for share;
  if not found then raise exception 'employee_not_available'; end if;
  if not private.can_manage_personal_item_3g(v_employee.team_id) then raise exception 'forbidden'; end if;
  -- epi:write basta para a entrega com lote; a exceção sem lote exige o admin global já existente.
  if p_stock_origin='WITHOUT_STOCK' and not public.is_active_admin() then
    raise exception 'forbidden_exceptional_delivery';
  end if;
  select * into v_item from public.epi_items where id=p_item_id and active and item_kind='personal_tool' for share;
  if not found then raise exception 'personal_item_not_available'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,3037));
  select * into v_previous from private.personal_item_deliveries_3g where idempotency_key=p_idempotency_key;
  if found then
    if v_previous.employee_id<>p_employee_id or v_previous.item_id<>p_item_id or v_previous.quantity<>p_quantity
      or v_previous.variant is distinct from v_variant or v_previous.internal_note is distinct from v_note
      or v_previous.delivered_by<>(select auth.uid()) or v_previous.stock_origin<>p_stock_origin
      or v_previous.stock_batch_id is distinct from p_stock_batch_id
      or v_previous.exception_reason is distinct from v_reason
      or (v_previous.exception_acknowledged_at is not null) is distinct from p_exception_confirmed
    then raise exception 'idempotency_conflict'; end if;
    return v_previous.id;
  end if;
  if p_stock_origin='STOCK_BATCH' then
    select * into v_batch from public.epi_stock_batches
      where id=p_stock_batch_id and item_id=p_item_id for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.variant is distinct from v_variant then raise exception 'stock_batch_variant_mismatch'; end if;
    if v_batch.worksite_id is null and not public.is_active_admin() then raise exception 'forbidden_central_stock'; end if;
    select t.worksite_id into v_worksite from public.teams t where t.id=v_employee.team_id;
    if v_batch.worksite_id is not null and (v_worksite is distinct from v_batch.worksite_id
      or not exists(select 1 from public.teams t where t.worksite_id=v_batch.worksite_id
        and private.can_manage_personal_item_3g(t.id)))
    then raise exception 'forbidden_stock_location'; end if;
    if v_batch.quantity<p_quantity then raise exception 'insufficient_personal_item_stock'; end if;
    update public.epi_stock_batches set quantity=quantity-p_quantity where id=v_batch.id
      and quantity>=p_quantity;
    if not found then raise exception 'insufficient_personal_item_stock'; end if;
  end if;
  insert into private.personal_item_deliveries_3g(employee_id,item_id,item_name_snapshot,item_code_snapshot,
    unit_snapshot,quantity,variant,internal_note,delivered_by,idempotency_key,stock_origin,stock_batch_id,
    exception_reason,exception_acknowledged_at)
  values(p_employee_id,p_item_id,v_item.name,v_item.code,v_item.unit,p_quantity,v_variant,v_note,
    (select auth.uid()),p_idempotency_key,p_stock_origin,p_stock_batch_id,v_reason,
    case when p_stock_origin='WITHOUT_STOCK' then pg_catalog.statement_timestamp() else null end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.close_personal_item_3g(p_delivery_id uuid,p_action text,p_related_delivery_id uuid,
  p_note text,p_idempotency_key uuid,p_return_destination text) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_delivery private.personal_item_deliveries_3g%rowtype;
  v_related private.personal_item_deliveries_3g%rowtype; v_batch public.epi_stock_batches%rowtype;
  v_employee public.epi_employees%rowtype; v_previous private.personal_item_events_3g%rowtype;
  v_note text:=nullif(pg_catalog.btrim(p_note),''); v_id bigint;
begin
  if p_delivery_id is null or p_idempotency_key is null or p_action is null
    or p_action not in ('RETURNED','REPLACED')
    or (p_action='RETURNED' and (p_related_delivery_id is not null or p_return_destination is null or
      p_return_destination not in ('STOCK_REUSABLE','EVALUATION','DAMAGED','DISCARDED','OTHER')))
    or (p_action='REPLACED' and (p_related_delivery_id is null or p_return_destination is not null))
    or char_length(p_note)>240 or p_note ~ '[[:cntrl:]]'
  then raise exception 'invalid_personal_item_closure'; end if;
  select * into v_delivery from private.personal_item_deliveries_3g where id=p_delivery_id;
  if not found then raise exception 'delivery_not_found'; end if;
  select * into v_employee from public.epi_employees where id=v_delivery.employee_id for share;
  if not found or not private.can_manage_personal_item_3g(v_employee.team_id) then raise exception 'forbidden'; end if;
  if not v_employee.active and p_action<>'RETURNED' then raise exception 'inactive_employee_return_only'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_delivery_id::text,3038));
  select * into v_previous from private.personal_item_events_3g where delivery_id=p_delivery_id
    and event_type in ('RETURNED','REPLACED');
  if found then
    if v_previous.event_type<>p_action or v_previous.related_delivery_id is distinct from p_related_delivery_id
      or v_previous.note is distinct from v_note or v_previous.category is distinct from p_return_destination
    then raise exception 'delivery_already_closed'; end if;
    return v_previous.id;
  end if;
  if p_action='REPLACED' then
    select * into v_related from private.personal_item_deliveries_3g where id=p_related_delivery_id;
    if not found or v_related.id=v_delivery.id or v_related.employee_id<>v_delivery.employee_id
      or v_related.item_id<>v_delivery.item_id or v_related.delivered_at<v_delivery.delivered_at
    then raise exception 'invalid_replacement'; end if;
    if exists(select 1 from private.personal_item_events_3g where related_delivery_id=p_related_delivery_id)
    then raise exception 'replacement_already_used'; end if;
  elsif p_return_destination='STOCK_REUSABLE' then
    if v_delivery.stock_origin<>'STOCK_BATCH' then raise exception 'stock_return_requires_original_batch'; end if;
    if exists(select 1 from private.personal_item_events_3g where delivery_id=p_delivery_id
      and event_type='PROBLEM' and category in ('DAMAGED','LOST'))
    then raise exception 'damaged_or_lost_item_cannot_restock'; end if;
    select * into v_batch from public.epi_stock_batches
      where id=v_delivery.stock_batch_id and item_id=v_delivery.item_id for update;
    if not found or v_batch.variant is distinct from v_delivery.variant
    then raise exception 'stock_batch_not_found'; end if;
    if v_batch.worksite_id is null and not public.is_active_admin() then raise exception 'forbidden_central_stock'; end if;
    if v_batch.worksite_id is not null and not exists(select 1 from public.teams t
      where t.worksite_id=v_batch.worksite_id and private.can_manage_personal_item_3g(t.id))
    then raise exception 'forbidden_stock_location'; end if;
    update public.epi_stock_batches set quantity=quantity+v_delivery.quantity where id=v_batch.id;
  end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,category,note,actor_id,
    related_delivery_id,idempotency_key)
  values(p_delivery_id,p_action,p_return_destination,v_note,(select auth.uid()),p_related_delivery_id,
    p_idempotency_key) returning id into v_id;
  return v_id;
end $$;


notify pgrst, 'reload schema';
commit;
