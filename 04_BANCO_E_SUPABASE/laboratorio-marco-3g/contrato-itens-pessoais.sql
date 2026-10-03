-- Marco 3G: contrato exclusivamente local e sintetico. Nunca aplicar ao Supabase remoto.
-- Reutiliza apenas o catalogo epi_items(item_kind='personal_tool'); fatos pessoais ficam isolados.
create table private.personal_item_deliveries_3g (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  item_id uuid not null references public.epi_items(id) on delete restrict,
  item_name_snapshot text not null,
  item_code_snapshot text not null,
  unit_snapshot text not null,
  quantity integer not null check (quantity between 1 and 1000),
  variant text check (variant is null or (char_length(variant) between 1 and 80 and variant=btrim(variant))),
  internal_note text check (internal_note is null or (char_length(internal_note) between 1 and 240 and internal_note=btrim(internal_note))),
  delivered_by uuid not null references auth.users(id) on delete restrict,
  delivered_at timestamptz not null default now(),
  idempotency_key uuid not null unique
);
create index personal_item_deliveries_3g_employee on private.personal_item_deliveries_3g(employee_id,delivered_at desc);

create table private.personal_item_events_3g (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references private.personal_item_deliveries_3g(id) on delete restrict,
  event_type text not null check (event_type in ('CONFIRMED','PROBLEM','EXCHANGE_REQUESTED','EXCHANGE_APPROVED','EXCHANGE_REFUSED','RETURNED','REPLACED')),
  category text,
  note text check (note is null or (char_length(note) between 1 and 240 and note=btrim(note))),
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  request_event_id bigint references private.personal_item_events_3g(id) on delete restrict,
  related_delivery_id uuid references private.personal_item_deliveries_3g(id) on delete restrict,
  idempotency_key uuid not null,
  event_version integer not null default 1 check (event_version=1),
  unique(delivery_id,idempotency_key),
  check ((event_type in ('EXCHANGE_APPROVED','EXCHANGE_REFUSED'))=(request_event_id is not null)),
  check ((event_type='REPLACED')=(related_delivery_id is not null))
);
create index personal_item_events_3g_delivery on private.personal_item_events_3g(delivery_id,id);
create unique index personal_item_events_3g_confirm_once on private.personal_item_events_3g(delivery_id) where event_type='CONFIRMED';
create unique index personal_item_events_3g_terminal_once on private.personal_item_events_3g(delivery_id) where event_type in ('RETURNED','REPLACED');
create unique index personal_item_events_3g_request_decision_once on private.personal_item_events_3g(request_event_id) where request_event_id is not null;
create unique index personal_item_events_3g_replacement_once on private.personal_item_events_3g(related_delivery_id) where related_delivery_id is not null;

alter table private.personal_item_deliveries_3g enable row level security;
alter table private.personal_item_events_3g enable row level security;
revoke all on private.personal_item_deliveries_3g,private.personal_item_events_3g from public,anon,authenticated,service_role;
revoke all on sequence private.personal_item_events_3g_id_seq from public,anon,authenticated,service_role;

create function private.guard_personal_item_history_3g() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'personal_item_history_immutable'; end $$;
revoke all on function private.guard_personal_item_history_3g() from public,anon,authenticated,service_role;
create trigger personal_item_delivery_immutable_3g before update or delete on private.personal_item_deliveries_3g
  for each row execute function private.guard_personal_item_history_3g();
create trigger personal_item_event_immutable_3g before update or delete on private.personal_item_events_3g
  for each row execute function private.guard_personal_item_history_3g();

-- Mantem entregas pessoais anteriores consultaveis, mas novos lancamentos nao abrem dois historicos.
create function private.route_personal_item_delivery_3g() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.epi_items i where i.id=new.item_id and i.item_kind='personal_tool')
  then raise exception 'use_personal_items_3g'; end if;
  return new;
end $$;
revoke all on function private.route_personal_item_delivery_3g() from public,anon,authenticated,service_role;
create trigger route_personal_item_delivery_3g before insert on public.epi_deliveries
  for each row execute function private.route_personal_item_delivery_3g();

-- O perfil da Gestao continua sujeito ao escopo operacional; equipe ausente exige admin global.
create function private.can_manage_personal_item_3g(p_team_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select case when p_team_id is null then public.is_active_admin()
    else public.can_operate('epi:write',p_team_id) end
$$;
revoke all on function private.can_manage_personal_item_3g(uuid) from public,anon,authenticated,service_role;

-- O titular pessoal nunca e escolhido pelo cliente. Bloqueio SHARE sincroniza revogacao/inativacao concorrente.
create function private.personal_item_actor_3g() returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid;
begin
  select e.id into v_employee from private.employee_identity link
    join private.employee_portal_accounts account on account.auth_user_id=link.auth_user_id
    join public.profiles profile on profile.id=link.auth_user_id and not profile.active
    join public.epi_employees e on e.id=link.employee_id and e.active
    where link.auth_user_id=(select auth.uid()) and link.status='active'
    for share of link,account,profile,e;
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  return v_employee;
end $$;
revoke all on function private.personal_item_actor_3g() from public,anon,authenticated,service_role;

create function public.deliver_personal_item_3g(p_employee_id uuid,p_item_id uuid,p_quantity integer,
  p_variant text,p_note text,p_idempotency_key uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_employee public.epi_employees%rowtype; v_item public.epi_items%rowtype;
  v_previous private.personal_item_deliveries_3g%rowtype; v_id uuid;
  v_variant text:=nullif(pg_catalog.btrim(p_variant),''); v_note text:=nullif(pg_catalog.btrim(p_note),'');
begin
  if (select auth.uid()) is null or p_employee_id is null or p_item_id is null or p_idempotency_key is null
    or p_quantity not between 1 and 1000 or char_length(p_variant)>80 or char_length(p_note)>240
    or p_variant ~ '[[:cntrl:]]' or p_note ~ '[[:cntrl:]]'
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
      or v_previous.delivered_by<>(select auth.uid()) then raise exception 'idempotency_conflict'; end if;
    return v_previous.id;
  end if;
  insert into private.personal_item_deliveries_3g(employee_id,item_id,item_name_snapshot,item_code_snapshot,
    unit_snapshot,quantity,variant,internal_note,delivered_by,idempotency_key)
  values(p_employee_id,p_item_id,v_item.name,v_item.code,v_item.unit,p_quantity,v_variant,v_note,
    (select auth.uid()),p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.deliver_personal_item_3g(uuid,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.deliver_personal_item_3g(uuid,uuid,integer,text,text,uuid) to authenticated;

create function public.my_personal_items_3g() returns jsonb
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
      'event_type',ev.event_type,'category',ev.category,
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

create function public.confirm_personal_item_3g(p_delivery_id uuid,p_idempotency_key uuid) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid; v_event private.personal_item_events_3g%rowtype;
begin
  if p_delivery_id is null or p_idempotency_key is null then raise exception 'invalid_confirmation'; end if;
  v_employee:=private.personal_item_actor_3g();
  perform 1 from private.personal_item_deliveries_3g where id=p_delivery_id and employee_id=v_employee;
  if not found then raise exception 'delivery_not_found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_delivery_id::text,3038));
  select * into v_event from private.personal_item_events_3g where delivery_id=p_delivery_id and event_type='CONFIRMED';
  if found then return v_event.id; end if;
  if exists(select 1 from private.personal_item_events_3g where delivery_id=p_delivery_id
    and event_type in ('RETURNED','REPLACED')) then raise exception 'delivery_closed'; end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,actor_id,idempotency_key)
    values(p_delivery_id,'CONFIRMED',(select auth.uid()),p_idempotency_key) returning id into v_event.id;
  return v_event.id;
end $$;
revoke all on function public.confirm_personal_item_3g(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.confirm_personal_item_3g(uuid,uuid) to authenticated;

create function public.report_personal_item_3g(p_delivery_id uuid,p_action text,p_category text,
  p_note text,p_idempotency_key uuid) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid; v_event private.personal_item_events_3g%rowtype;
  v_note text:=nullif(pg_catalog.btrim(p_note),'');
begin
  if p_delivery_id is null or p_idempotency_key is null or
    not ((p_action='PROBLEM' and p_category in ('DAMAGED','LOST','OTHER')) or
      (p_action='EXCHANGE_REQUESTED' and p_category in ('WEAR','DAMAGED','LOST','OTHER')))
    or char_length(p_note)>240 or p_note ~ '[[:cntrl:]]' then raise exception 'invalid_personal_item_report'; end if;
  v_employee:=private.personal_item_actor_3g();
  perform 1 from private.personal_item_deliveries_3g where id=p_delivery_id and employee_id=v_employee;
  if not found then raise exception 'delivery_not_found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_delivery_id::text,3038));
  select * into v_event from private.personal_item_events_3g where delivery_id=p_delivery_id and idempotency_key=p_idempotency_key;
  if found then
    if v_event.event_type<>p_action or v_event.category is distinct from p_category or v_event.note is distinct from v_note
    then raise exception 'idempotency_conflict'; end if;
    return v_event.id;
  end if;
  if exists(select 1 from private.personal_item_events_3g where delivery_id=p_delivery_id
    and event_type in ('RETURNED','REPLACED')) then raise exception 'delivery_closed'; end if;
  if p_action='EXCHANGE_REQUESTED' and exists(
    select 1 from private.personal_item_events_3g request
    where request.delivery_id=p_delivery_id and request.event_type='EXCHANGE_REQUESTED'
      and not exists(select 1 from private.personal_item_events_3g decision
        where decision.request_event_id=request.id and decision.event_type='EXCHANGE_REFUSED')
  ) then raise exception 'exchange_request_already_open'; end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,category,note,actor_id,idempotency_key)
    values(p_delivery_id,p_action,p_category,v_note,(select auth.uid()),p_idempotency_key)
    returning id into v_event.id;
  return v_event.id;
end $$;
revoke all on function public.report_personal_item_3g(uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.report_personal_item_3g(uuid,text,text,text,uuid) to authenticated;

create function public.admin_personal_items_3g(p_employee_id uuid default null,p_team_id uuid default null,
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
      left join lateral (select ev.id,ev.occurred_at from private.personal_item_events_3g ev
        where ev.delivery_id=d.id and ev.event_type='CONFIRMED' limit 1) confirmation on true
      left join lateral (select ev.event_type from private.personal_item_events_3g ev
        where ev.delivery_id=d.id and ev.event_type in ('RETURNED','REPLACED') limit 1) terminal on true
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

create function public.decide_personal_item_3g(p_request_id bigint,p_action text,p_note text,
  p_idempotency_key uuid) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_request private.personal_item_events_3g%rowtype; v_delivery private.personal_item_deliveries_3g%rowtype;
  v_employee public.epi_employees%rowtype; v_previous private.personal_item_events_3g%rowtype;
  v_note text:=nullif(pg_catalog.btrim(p_note),''); v_id bigint;
begin
  if p_request_id is null or p_action not in ('EXCHANGE_APPROVED','EXCHANGE_REFUSED')
    or p_idempotency_key is null or char_length(p_note)>240 or p_note ~ '[[:cntrl:]]'
  then raise exception 'invalid_personal_item_decision'; end if;
  select * into v_request from private.personal_item_events_3g where id=p_request_id and event_type='EXCHANGE_REQUESTED';
  if not found then raise exception 'request_not_found'; end if;
  select * into v_delivery from private.personal_item_deliveries_3g where id=v_request.delivery_id;
  select * into v_employee from public.epi_employees where id=v_delivery.employee_id and active for share;
  if not found or not private.can_manage_personal_item_3g(v_employee.team_id) then raise exception 'forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_delivery.id::text,3038));
  select * into v_previous from private.personal_item_events_3g where request_event_id=p_request_id;
  if found then
    if v_previous.event_type<>p_action or v_previous.note is distinct from v_note then raise exception 'decision_already_recorded'; end if;
    return v_previous.id;
  end if;
  if exists(select 1 from private.personal_item_events_3g where delivery_id=v_delivery.id
    and event_type in ('RETURNED','REPLACED')) then raise exception 'delivery_closed'; end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,note,actor_id,request_event_id,idempotency_key)
    values(v_delivery.id,p_action,v_note,(select auth.uid()),p_request_id,p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.decide_personal_item_3g(bigint,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.decide_personal_item_3g(bigint,text,text,uuid) to authenticated;

create function public.close_personal_item_3g(p_delivery_id uuid,p_action text,p_related_delivery_id uuid,
  p_note text,p_idempotency_key uuid) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare v_delivery private.personal_item_deliveries_3g%rowtype; v_related private.personal_item_deliveries_3g%rowtype;
  v_employee public.epi_employees%rowtype; v_previous private.personal_item_events_3g%rowtype;
  v_note text:=nullif(pg_catalog.btrim(p_note),''); v_id bigint;
begin
  if p_delivery_id is null or p_idempotency_key is null or p_action not in ('RETURNED','REPLACED')
    or (p_action='RETURNED' and p_related_delivery_id is not null)
    or (p_action='REPLACED' and p_related_delivery_id is null)
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
      or v_previous.note is distinct from v_note then raise exception 'delivery_already_closed'; end if;
    return v_previous.id;
  end if;
  if p_action='REPLACED' then
    select * into v_related from private.personal_item_deliveries_3g where id=p_related_delivery_id;
    if not found or v_related.id=v_delivery.id or v_related.employee_id<>v_delivery.employee_id
      or v_related.item_id<>v_delivery.item_id or v_related.delivered_at<v_delivery.delivered_at
    then raise exception 'invalid_replacement'; end if;
    if exists(select 1 from private.personal_item_events_3g where related_delivery_id=p_related_delivery_id)
    then raise exception 'replacement_already_used'; end if;
  end if;
  insert into private.personal_item_events_3g(delivery_id,event_type,note,actor_id,related_delivery_id,idempotency_key)
    values(p_delivery_id,p_action,v_note,(select auth.uid()),p_related_delivery_id,p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.close_personal_item_3g(uuid,text,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.close_personal_item_3g(uuid,text,uuid,text,uuid) to authenticated;
