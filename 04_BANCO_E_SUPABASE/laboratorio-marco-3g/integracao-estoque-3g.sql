-- Delta local do Marco 3G. Aplicar depois de contrato-itens-pessoais.sql, nunca no remoto.
-- O proprio fato imutavel da entrega, ligado ao lote existente, documenta a saida.
begin;
alter table private.personal_item_deliveries_3g
  add column stock_origin text not null default 'LEGACY_PRE_INTEGRATION'
    check (stock_origin in ('LEGACY_PRE_INTEGRATION','STOCK_BATCH','WITHOUT_STOCK')),
  add column stock_batch_id uuid references public.epi_stock_batches(id) on delete restrict,
  add constraint personal_item_stock_origin_3g
    check ((stock_origin='STOCK_BATCH')=(stock_batch_id is not null));
create index personal_item_stock_batch_3g on private.personal_item_deliveries_3g(stock_batch_id)
  where stock_batch_id is not null;

-- Remove as assinaturas antigas: nenhuma chamada anterior pode contornar a escolha de origem/destino.
drop function public.deliver_personal_item_3g(uuid,uuid,integer,text,text,uuid);
drop function public.close_personal_item_3g(uuid,text,uuid,text,uuid);

create function public.deliver_personal_item_3g(p_employee_id uuid,p_item_id uuid,p_quantity integer,
  p_variant text,p_note text,p_idempotency_key uuid,p_stock_origin text,p_stock_batch_id uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_employee public.epi_employees%rowtype; v_item public.epi_items%rowtype;
  v_batch public.epi_stock_batches%rowtype; v_previous private.personal_item_deliveries_3g%rowtype;
  v_id uuid; v_worksite uuid;
  v_variant text:=nullif(pg_catalog.btrim(p_variant),''); v_note text:=nullif(pg_catalog.btrim(p_note),'');
begin
  if (select auth.uid()) is null or p_employee_id is null or p_item_id is null or p_idempotency_key is null
    or p_quantity is null or p_quantity not between 1 and 1000 or char_length(p_variant)>80 or char_length(p_note)>240
    or p_variant ~ '[[:cntrl:]]' or p_note ~ '[[:cntrl:]]'
    or p_stock_origin is null or p_stock_origin not in ('STOCK_BATCH','WITHOUT_STOCK')
    or (p_stock_origin='STOCK_BATCH') is distinct from (p_stock_batch_id is not null)
    or (p_stock_origin='WITHOUT_STOCK' and v_note is null)
  then raise exception 'invalid_personal_item_delivery'; end if;
  select * into v_employee from public.epi_employees where id=p_employee_id and active for share;
  if not found then raise exception 'employee_not_available'; end if;
  if not private.can_manage_personal_item_3g(v_employee.team_id) then raise exception 'forbidden'; end if;
  select * into v_item from public.epi_items where id=p_item_id and active and item_kind='personal_tool' for share;
  if not found then raise exception 'personal_item_not_available'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,3037));
  select * into v_previous from private.personal_item_deliveries_3g where idempotency_key=p_idempotency_key;
  if found then
    if v_previous.employee_id<>p_employee_id or v_previous.item_id<>p_item_id or v_previous.quantity<>p_quantity
      or v_previous.variant is distinct from v_variant or v_previous.internal_note is distinct from v_note
      or v_previous.delivered_by<>(select auth.uid()) or v_previous.stock_origin<>p_stock_origin
      or v_previous.stock_batch_id is distinct from p_stock_batch_id
    then raise exception 'idempotency_conflict'; end if;
    return v_previous.id;
  end if;
  if p_stock_origin='STOCK_BATCH' then
    select * into v_batch from public.epi_stock_batches
      where id=p_stock_batch_id and item_id=p_item_id for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.variant is distinct from v_variant then raise exception 'stock_batch_variant_mismatch'; end if;
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
    unit_snapshot,quantity,variant,internal_note,delivered_by,idempotency_key,stock_origin,stock_batch_id)
  values(p_employee_id,p_item_id,v_item.name,v_item.code,v_item.unit,p_quantity,v_variant,v_note,
    (select auth.uid()),p_idempotency_key,p_stock_origin,p_stock_batch_id) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.deliver_personal_item_3g(uuid,uuid,integer,text,text,uuid,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.deliver_personal_item_3g(uuid,uuid,integer,text,text,uuid,text,uuid)
  to authenticated;

create function public.close_personal_item_3g(p_delivery_id uuid,p_action text,p_related_delivery_id uuid,
  p_note text,p_idempotency_key uuid,p_return_destination text) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_delivery private.personal_item_deliveries_3g%rowtype;
  v_related private.personal_item_deliveries_3g%rowtype; v_batch public.epi_stock_batches%rowtype;
  v_employee public.epi_employees%rowtype; v_previous private.personal_item_events_3g%rowtype;
  v_note text:=nullif(pg_catalog.btrim(p_note),''); v_id bigint; v_worksite uuid;
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
  select * into v_employee from public.epi_employees where id=v_delivery.employee_id and active for share;
  if not found or not private.can_manage_personal_item_3g(v_employee.team_id) then raise exception 'forbidden'; end if;
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
      or not exists(select 1 from public.epi_items i where i.id=v_delivery.item_id and i.active)
    then raise exception 'stock_batch_not_found'; end if;
    select t.worksite_id into v_worksite from public.teams t where t.id=v_employee.team_id;
    if v_batch.worksite_id is not null and (v_worksite is distinct from v_batch.worksite_id
      or not exists(select 1 from public.teams t where t.worksite_id=v_batch.worksite_id
        and private.can_manage_personal_item_3g(t.id)))
    then raise exception 'forbidden_stock_location'; end if;
    update public.epi_stock_batches set quantity=quantity+v_delivery.quantity where id=v_batch.id;
  end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,category,note,actor_id,
    related_delivery_id,idempotency_key)
  values(p_delivery_id,p_action,p_return_destination,v_note,(select auth.uid()),p_related_delivery_id,
    p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.close_personal_item_3g(uuid,text,uuid,text,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function public.close_personal_item_3g(uuid,text,uuid,text,uuid,text)
  to authenticated;

-- O contrato pessoal continua sem origem, lote, saldo ou destino operacional interno.
create or replace function public.my_personal_items_3g() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid;
begin
  v_employee:=private.personal_item_actor_3g();
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'delivery_id',d.id,'item_name',d.item_name_snapshot,'quantity',d.quantity,'unit',d.unit_snapshot,
    'variant',d.variant,'delivered_at',d.delivered_at,'confirmed_at',confirm_ev.occurred_at,
    'status',case when terminal.event_type='RETURNED' then 'DEVOLVIDO'
      when terminal.event_type='REPLACED' then 'SUBSTITUIDO'
      when problem.category='DAMAGED' then 'DANIFICADO'
      when problem.category='LOST' then 'EXTRAVIADO'
      when confirm_ev.id is null then 'AGUARDANDO_CONFIRMACAO' else 'EM_USO' end,
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'event_type',ev.event_type,
      'category',case when ev.event_type='RETURNED' then null else ev.category end,
      'note',case when ev.event_type in ('PROBLEM','EXCHANGE_REQUESTED') then ev.note else null end,
      'occurred_at',ev.occurred_at)
      order by ev.id) from private.personal_item_events_3g ev where ev.delivery_id=d.id),'[]'::jsonb)
    ) order by d.delivered_at desc,d.id desc)
    from private.personal_item_deliveries_3g d
    left join lateral (select ev.id,ev.occurred_at from private.personal_item_events_3g ev
      where ev.delivery_id=d.id and ev.event_type='CONFIRMED' limit 1) confirm_ev on true
    left join lateral (select ev.event_type from private.personal_item_events_3g ev
      where ev.delivery_id=d.id and ev.event_type in ('RETURNED','REPLACED') limit 1) terminal on true
    left join lateral (select ev.category from private.personal_item_events_3g ev
      where ev.delivery_id=d.id and ev.event_type='PROBLEM' order by ev.id desc limit 1) problem on true
    where d.employee_id=v_employee),'[]'::jsonb);
end $$;
revoke all on function public.my_personal_items_3g() from public,anon,authenticated,service_role;
grant execute on function public.my_personal_items_3g() to authenticated;

-- A Gestão recebe a origem e o destino para rastrear; o portal pessoal não os recebe.
create or replace function public.admin_personal_items_3g(p_employee_id uuid default null,p_team_id uuid default null,
  p_work_id uuid default null,p_status text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.active)
  then raise exception 'forbidden'; end if;
  return coalesce((select pg_catalog.jsonb_agg(row_data.data order by row_data.delivered_at desc)
    from (select d.delivered_at,pg_catalog.jsonb_build_object(
      'delivery_id',d.id,'employee_id',e.id,'employee_name',e.full_name,
      'team_id',t.id,'team_name',t.name,'work_id',w.id,'work_name',w.name,
      'item_id',d.item_id,'item_name',d.item_name_snapshot,
      'quantity',d.quantity,'unit',d.unit_snapshot,'variant',d.variant,'internal_note',d.internal_note,
      'stock_origin',d.stock_origin,'stock_batch_id',d.stock_batch_id,
      'return_destination',terminal.category,
      'delivered_at',d.delivered_at,'delivered_by',d.delivered_by,'confirmed_at',confirmation.occurred_at,
      'status',case when terminal.event_type='RETURNED' then 'DEVOLVIDO'
        when terminal.event_type='REPLACED' then 'SUBSTITUIDO'
        when problem.category='DAMAGED' then 'DANIFICADO'
        when problem.category='LOST' then 'EXTRAVIADO'
        when confirmation.id is null then 'AGUARDANDO_CONFIRMACAO' else 'EM_USO' end,
      'requests',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'request_id',req.id,'action',req.event_type,'reason',req.category,'note',req.note,
        'requested_at',req.occurred_at,'decision',decision.event_type,'decision_at',decision.occurred_at)
        order by req.id desc) from private.personal_item_events_3g req
        left join private.personal_item_events_3g decision on decision.request_event_id=req.id
        where req.delivery_id=d.id and req.event_type in ('PROBLEM','EXCHANGE_REQUESTED')),'[]'::jsonb)
      ) data from private.personal_item_deliveries_3g d
      join public.epi_employees e on e.id=d.employee_id
      left join public.teams t on t.id=e.team_id
      left join public.worksites w on w.id=t.worksite_id
      left join lateral (select ev.id,ev.event_type,ev.category from private.personal_item_events_3g ev
        where ev.delivery_id=d.id and ev.event_type in ('RETURNED','REPLACED') limit 1) terminal on true
      left join lateral (select ev.id,ev.occurred_at from private.personal_item_events_3g ev
        where ev.delivery_id=d.id and ev.event_type='CONFIRMED' limit 1) confirmation on true
      left join lateral (select ev.category from private.personal_item_events_3g ev
        where ev.delivery_id=d.id and ev.event_type='PROBLEM' order by ev.id desc limit 1) problem on true
      where (p_employee_id is null or e.id=p_employee_id) and (p_team_id is null or e.team_id=p_team_id)
        and (p_work_id is null or w.id=p_work_id)
        and private.can_manage_personal_item_3g(e.team_id)
        and (p_status is null or p_status=case when terminal.event_type='RETURNED' then 'DEVOLVIDO'
          when terminal.event_type='REPLACED' then 'SUBSTITUIDO'
          when problem.category='DAMAGED' then 'DANIFICADO'
          when problem.category='LOST' then 'EXTRAVIADO'
          when confirmation.id is null then 'AGUARDANDO_CONFIRMACAO' else 'EM_USO' end)
    ) row_data),'[]'::jsonb);
end $$;
revoke all on function public.admin_personal_items_3g(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.admin_personal_items_3g(uuid,uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
