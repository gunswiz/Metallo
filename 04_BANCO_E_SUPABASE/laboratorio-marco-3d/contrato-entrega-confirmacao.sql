-- Marco 3D, exclusivamente no laboratório sintético. Não é migration remota.
-- Os modelos de profissão e os conjuntos do empregado continuam sugestões mutáveis.
-- Preparação, entrega e manifestação pessoal são fatos diferentes.

alter table public.epi_deliveries add column if not exists item_name_snapshot text;
alter table public.epi_deliveries add column if not exists unit_snapshot text;
alter table public.epi_deliveries add column if not exists item_code_snapshot text;

-- Preenche o fato histórico na inserção: o gatilho legado impede regravar a entrega depois.
create or replace function public.snapshot_epi_delivery_3d()
returns trigger language plpgsql set search_path='' as $$
declare v_item public.epi_items%rowtype;
begin
  select * into v_item from public.epi_items where id=new.item_id;
  if not found then raise exception 'epi_item_not_found'; end if;
  new.item_name_snapshot:=v_item.name;
  new.unit_snapshot:=v_item.unit;
  new.item_code_snapshot:=v_item.code;
  return new;
end $$;
alter function public.snapshot_epi_delivery_3d() owner to postgres;
revoke all on function public.snapshot_epi_delivery_3d() from public,anon,authenticated,service_role;
drop trigger if exists snapshot_epi_delivery_3d on public.epi_deliveries;
create trigger snapshot_epi_delivery_3d before insert on public.epi_deliveries
for each row execute function public.snapshot_epi_delivery_3d();

create table if not exists public.epi_prepared_kits_3d (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  profession_snapshot text not null,
  lines_snapshot jsonb not null check (jsonb_typeof(lines_snapshot)='array' and jsonb_array_length(lines_snapshot) between 1 and 30),
  exchange_request_id uuid unique references public.epi_exchange_requests(id) on delete restrict,
  prepared_by uuid not null references auth.users(id) on delete restrict,
  prepared_at timestamptz not null default now(),
  idempotency_key uuid not null unique
);

create table if not exists public.epi_delivery_groups_3d (
  id uuid primary key,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  employee_name_snapshot text,
  prepared_kit_id uuid not null unique references public.epi_prepared_kits_3d(id) on delete restrict,
  exchange_request_id uuid unique references public.epi_exchange_requests(id) on delete restrict,
  profession_snapshot text not null,
  team_name_snapshot text,
  work_name_snapshot text,
  delivered_by uuid not null references auth.users(id) on delete restrict,
  delivered_at timestamptz not null default now(),
  idempotency_key uuid not null unique
);
create index if not exists epi_delivery_groups_3d_employee_at on public.epi_delivery_groups_3d(employee_id,delivered_at desc);

create table if not exists public.epi_delivery_feedback_events_3d (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.epi_delivery_groups_3d(id) on delete restrict,
  event_type text not null check (event_type in ('CONFIRMADO','DIVERGENCIA','EM_ANALISE','RESOLVIDA')),
  delivery_id uuid references public.epi_deliveries(id) on delete restrict,
  category text check (category is null or category in ('ITEM_FALTANDO','QUANTIDADE','TAMANHO','VARIANTE','NAO_RECEBIDO','OUTRO')),
  details text check (details is null or (char_length(details) between 1 and 240 and details=btrim(details))),
  public_message text check (public_message is null or (char_length(public_message) between 1 and 240 and public_message=btrim(public_message))),
  internal_note text check (internal_note is null or (char_length(internal_note) between 1 and 240 and internal_note=btrim(internal_note))),
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  idempotency_key uuid not null,
  unique(group_id,idempotency_key)
);
create index if not exists epi_delivery_feedback_3d_group on public.epi_delivery_feedback_events_3d(group_id,id);

alter table public.epi_prepared_kits_3d enable row level security;
alter table public.epi_delivery_groups_3d enable row level security;
alter table public.epi_delivery_feedback_events_3d enable row level security;
revoke all on public.epi_prepared_kits_3d, public.epi_delivery_groups_3d,
  public.epi_delivery_feedback_events_3d from public,anon,authenticated,service_role;
revoke all on sequence public.epi_delivery_feedback_events_3d_id_seq from public,anon,authenticated,service_role;

create or replace function public.guard_epi_3d_immutable()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'epi_3d_history_immutable'; end $$;
alter function public.guard_epi_3d_immutable() owner to postgres;
revoke all on function public.guard_epi_3d_immutable() from public,anon,authenticated,service_role;
drop trigger if exists guard_epi_prepared_3d on public.epi_prepared_kits_3d;
create trigger guard_epi_prepared_3d before update or delete on public.epi_prepared_kits_3d
for each row execute function public.guard_epi_3d_immutable();
drop trigger if exists guard_epi_delivery_groups_3d on public.epi_delivery_groups_3d;
create trigger guard_epi_delivery_groups_3d before update or delete on public.epi_delivery_groups_3d
for each row execute function public.guard_epi_3d_immutable();
drop trigger if exists guard_epi_feedback_3d on public.epi_delivery_feedback_events_3d;
create trigger guard_epi_feedback_3d before update or delete on public.epi_delivery_feedback_events_3d
for each row execute function public.guard_epi_3d_immutable();

-- Apenas campos de encerramento podem mudar após a entrega 3D; o fato original não muda.
create or replace function public.guard_epi_delivery_snapshot_3d()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.epi_delivery_groups_3d g where g.id=old.delivery_group_id)
    then raise exception 'epi_3d_delivery_immutable'; end if;
    return old;
  end if;
  if exists(select 1 from public.epi_delivery_groups_3d g where g.id=old.delivery_group_id)
    and (new.employee_id,new.team_id,new.item_id,new.stock_batch_id,new.quantity,new.delivered_at,
      new.delivery_reason,new.delivery_group_id,new.ca_snapshot,new.brand_model_snapshot,
      new.lot_snapshot,new.variant_snapshot,new.item_name_snapshot,new.unit_snapshot,new.item_code_snapshot,
      new.delivered_by,new.note) is distinct from
      (old.employee_id,old.team_id,old.item_id,old.stock_batch_id,old.quantity,old.delivered_at,
      old.delivery_reason,old.delivery_group_id,old.ca_snapshot,old.brand_model_snapshot,
      old.lot_snapshot,old.variant_snapshot,old.item_name_snapshot,old.unit_snapshot,old.item_code_snapshot,
      old.delivered_by,old.note)
  then raise exception 'epi_3d_delivery_immutable'; end if;
  return new;
end $$;
alter function public.guard_epi_delivery_snapshot_3d() owner to postgres;
revoke all on function public.guard_epi_delivery_snapshot_3d() from public,anon,authenticated,service_role;
drop trigger if exists guard_epi_delivery_snapshot_3d on public.epi_deliveries;
create trigger guard_epi_delivery_snapshot_3d before update or delete on public.epi_deliveries
for each row execute function public.guard_epi_delivery_snapshot_3d();

-- Evita que equipe nula amplie o alcance de funções antigas que usam can_operate(...,NULL).
create or replace function public.guard_epi_delivery_team_3d()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.team_id is null and not exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.active and p.role='admin')
  then raise exception 'epi_delivery_unassigned_admin_only'; end if;
  return new;
end $$;
alter function public.guard_epi_delivery_team_3d() owner to postgres;
revoke all on function public.guard_epi_delivery_team_3d() from public,anon,authenticated,service_role;
drop trigger if exists guard_epi_delivery_team_3d on public.epi_deliveries;
create trigger guard_epi_delivery_team_3d before insert or update of team_id on public.epi_deliveries
for each row execute function public.guard_epi_delivery_team_3d();
alter table public.epi_deliveries alter column team_id drop not null;

-- Em futuras reconstruções, assinaturas homônimas não podem ampliar a superfície PostgREST.
do $guard$ begin
  if exists(select 1 from pg_catalog.pg_proc where pronamespace='public'::pg_catalog.regnamespace
    and proname in ('admin_epi_kit_suggestion_3d','prepare_epi_kit_3d','register_epi_delivery_3d',
      'my_epi_delivery_groups_3d','respond_epi_delivery_3d','admin_epi_delivery_feedback_3d',
      'manage_epi_delivery_feedback_3d','admin_epi_prepared_kits_3d',
      'admin_epi_approved_exchanges_3d'))
  then raise exception 'epi_3d_rpc_already_exists'; end if;
end $guard$;

create function public.admin_epi_kit_suggestion_3d(p_employee_id uuid)
returns table(item_id uuid,item_name text,unit text,recommended_quantity integer)
language sql stable security definer set search_path='' as $$
  select i.id,i.name,i.unit,pi.recommended_quantity
  from public.epi_employees e
  join public.epi_professions p on pg_catalog.lower(p.name)=pg_catalog.lower(e.profession) and p.active
  join public.epi_profession_items pi on pi.profession_code=p.code
  join public.epi_items i on i.id=pi.item_id and i.active and i.item_kind='epi'
  where e.id=p_employee_id and e.active
    and ((e.team_id is not null and public.can_operate('epi:write',e.team_id))
      or (e.team_id is null and exists(select 1 from public.profiles actor
        where actor.id=(select auth.uid()) and actor.active and actor.role='admin')))
  order by i.name,i.id;
$$;
alter function public.admin_epi_kit_suggestion_3d(uuid) owner to postgres;
revoke all on function public.admin_epi_kit_suggestion_3d(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_kit_suggestion_3d(uuid) to authenticated;

create function public.admin_epi_prepared_kits_3d()
returns table(preparation_id uuid,employee_id uuid,employee_name text,prepared_at timestamptz,
  lines jsonb,exchange_request_id uuid,delivery_group_id uuid)
language sql stable security definer set search_path='' as $$
  select prep.id,e.id,e.full_name,prep.prepared_at,prep.lines_snapshot,
    prep.exchange_request_id,g.id
  from public.epi_prepared_kits_3d prep
  join public.epi_employees e on e.id=prep.employee_id
  left join public.epi_delivery_groups_3d g on g.prepared_kit_id=prep.id
  where (e.team_id is not null and public.can_operate('epi:write',e.team_id))
    or (e.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin'))
  order by prep.prepared_at desc,prep.id desc;
$$;
alter function public.admin_epi_prepared_kits_3d() owner to postgres;
revoke all on function public.admin_epi_prepared_kits_3d() from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_prepared_kits_3d() to authenticated;

create function public.admin_epi_approved_exchanges_3d()
returns table(request_id uuid,employee_id uuid,employee_name text,item_id uuid,
  item_name text,source_delivery_id uuid,delivery_group_id uuid)
language sql stable security definer set search_path='' as $$
  select r.id,e.id,e.full_name,d.item_id,r.item_name_snapshot,r.source_delivery_id,g.id
  from public.epi_exchange_requests r
  join public.epi_employees e on e.id=r.employee_id
  join public.epi_deliveries d on d.id=r.source_delivery_id
  left join public.epi_delivery_groups_3d g on g.exchange_request_id=r.id
  where r.status='APROVADA' and ((e.team_id is not null and public.can_operate('epi:write',e.team_id))
    or (e.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin')))
  order by r.created_at desc,r.id desc;
$$;
alter function public.admin_epi_approved_exchanges_3d() owner to postgres;
revoke all on function public.admin_epi_approved_exchanges_3d() from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_approved_exchanges_3d() to authenticated;

create function public.prepare_epi_kit_3d(p_employee_id uuid,p_lines jsonb,p_idempotency_key uuid,
  p_exchange_request_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_employee public.epi_employees%rowtype; v_request public.epi_exchange_requests%rowtype;
  v_line jsonb; v_batch public.epi_stock_batches%rowtype; v_item public.epi_items%rowtype;
  v_lines jsonb:='[]'::jsonb; v_existing public.epi_prepared_kits_3d%rowtype; v_id uuid;
  v_quantity integer; v_seen uuid[]:='{}'::uuid[];
begin
  if (select auth.uid()) is null or p_employee_id is null or p_idempotency_key is null
    or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 30
  then raise exception 'invalid_preparation'; end if;
  perform 1 from public.profiles p where p.id=(select auth.uid()) and p.active for share;
  if not found then raise exception 'management_access_denied'; end if;
  select * into v_employee from public.epi_employees where id=p_employee_id and active for share;
  if not found then raise exception 'employee_not_found'; end if;
  if not ((v_employee.team_id is not null and public.can_operate('epi:write',v_employee.team_id))
    or (v_employee.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin')))
  then raise exception 'management_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,8031));
  select * into v_existing from public.epi_prepared_kits_3d where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.employee_id<>p_employee_id or v_existing.exchange_request_id is distinct from p_exchange_request_id
      or (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('item_id',x->>'item_id','stock_batch_id',x->>'stock_batch_id','quantity',x->'quantity') order by ord)
          from pg_catalog.jsonb_array_elements(v_existing.lines_snapshot) with ordinality as t(x,ord)) is distinct from p_lines
    then raise exception 'idempotency_conflict'; end if;
    return v_existing.id;
  end if;
  if p_exchange_request_id is not null then
    select * into v_request from public.epi_exchange_requests where id=p_exchange_request_id
      and employee_id=p_employee_id and status='APROVADA' for share;
    if not found then raise exception 'exchange_not_approved'; end if;
    perform 1 from public.epi_deliveries d where d.id=v_request.source_delivery_id
      and d.employee_id=p_employee_id and d.current_status='active' for share;
    if not found then raise exception 'source_epi_not_active'; end if;
  end if;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    if pg_catalog.jsonb_typeof(v_line)<>'object' or
      (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_line) as k(key))<>3 or
      not (v_line ? 'item_id' and v_line ? 'stock_batch_id' and v_line ? 'quantity') or
      pg_catalog.jsonb_typeof(v_line->'quantity')<>'number'
    then raise exception 'invalid_preparation_line'; end if;
    v_quantity:=(v_line->>'quantity')::integer;
    if v_quantity not between 1 and 100 or (v_line->>'stock_batch_id')::uuid=any(v_seen)
    then raise exception 'invalid_preparation_line'; end if;
    select * into v_batch from public.epi_stock_batches where id=(v_line->>'stock_batch_id')::uuid
      and item_id=(v_line->>'item_id')::uuid for share;
    if not found then raise exception 'stock_batch_not_found'; end if;
    select * into v_item from public.epi_items where id=v_batch.item_id and active and item_kind='epi' for share;
    if not found then raise exception 'epi_not_available'; end if;
    if p_exchange_request_id is not null and v_item.id<>(select item_id from public.epi_deliveries
      where id=v_request.source_delivery_id) then raise exception 'exchange_item_mismatch'; end if;
    v_seen:=pg_catalog.array_append(v_seen,v_batch.id);
    v_lines:=v_lines || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'item_id',v_item.id,'stock_batch_id',v_batch.id,'quantity',v_quantity,
      'item_name',v_item.name,'item_code',v_item.code,'unit',v_item.unit,
      'ca',v_batch.ca_number,'variant',v_batch.variant,
      'lot_number',v_batch.lot_number,'brand_model',v_batch.brand_model));
  end loop;
  insert into public.epi_prepared_kits_3d(employee_id,profession_snapshot,lines_snapshot,
    exchange_request_id,prepared_by,idempotency_key)
  values(p_employee_id,v_employee.profession,v_lines,p_exchange_request_id,(select auth.uid()),p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;
alter function public.prepare_epi_kit_3d(uuid,jsonb,uuid,uuid) owner to postgres;
revoke all on function public.prepare_epi_kit_3d(uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_epi_kit_3d(uuid,jsonb,uuid,uuid) to authenticated;

create function public.register_epi_delivery_3d(p_preparation_id uuid,p_idempotency_key uuid)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v_prep public.epi_prepared_kits_3d%rowtype; v_employee public.epi_employees%rowtype;
  v_existing public.epi_delivery_groups_3d%rowtype; v_group uuid; v_team_name text; v_work_name text;
  v_line jsonb; v_batch public.epi_stock_batches%rowtype; v_item public.epi_items%rowtype;
begin
  if (select auth.uid()) is null or p_preparation_id is null or p_idempotency_key is null
  then raise exception 'invalid_delivery'; end if;
  perform 1 from public.profiles p where p.id=(select auth.uid()) and p.active for share;
  if not found then raise exception 'management_access_denied'; end if;
  select * into v_prep from public.epi_prepared_kits_3d where id=p_preparation_id for share;
  if not found then raise exception 'preparation_not_found'; end if;
  select * into v_employee from public.epi_employees where id=v_prep.employee_id and active for update;
  if not found then raise exception 'employee_not_found'; end if;
  if not ((v_employee.team_id is not null and public.can_operate('epi:write',v_employee.team_id))
    or (v_employee.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin')))
  then raise exception 'management_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_preparation_id::text,8032));
  select * into v_existing from public.epi_delivery_groups_3d
    where prepared_kit_id=p_preparation_id or idempotency_key=p_idempotency_key;
  if found then
    if v_existing.prepared_kit_id<>p_preparation_id or v_existing.idempotency_key<>p_idempotency_key
    then raise exception 'delivery_already_registered'; end if;
    return v_existing.id;
  end if;
  if v_prep.exchange_request_id is not null then
    perform 1 from public.epi_exchange_requests r where r.id=v_prep.exchange_request_id
      and r.employee_id=v_prep.employee_id and r.status='APROVADA' for share;
    if not found then raise exception 'exchange_not_approved'; end if;
    perform 1 from public.epi_deliveries d join public.epi_exchange_requests r
      on r.source_delivery_id=d.id where r.id=v_prep.exchange_request_id
      and d.employee_id=v_prep.employee_id and d.current_status='active' for share of d;
    if not found then raise exception 'source_epi_not_active'; end if;
  end if;
  -- A preparação é só uma foto da separação; alterações posteriores de catálogo/lote exigem nova revisão.
  for v_line in select value from pg_catalog.jsonb_array_elements(v_prep.lines_snapshot) loop
    select * into v_batch from public.epi_stock_batches
      where id=(v_line->>'stock_batch_id')::uuid and item_id=(v_line->>'item_id')::uuid for share;
    select * into v_item from public.epi_items where id=(v_line->>'item_id')::uuid and active and item_kind='epi' for share;
    if v_batch.id is null or v_item.id is null or v_item.name is distinct from v_line->>'item_name'
      or v_item.code is distinct from v_line->>'item_code' or v_item.unit is distinct from v_line->>'unit'
      or v_batch.ca_number is distinct from v_line->>'ca'
      or v_batch.variant is distinct from v_line->>'variant'
      or (v_line ? 'lot_number' and v_batch.lot_number is distinct from v_line->>'lot_number')
      or (v_line ? 'brand_model' and v_batch.brand_model is distinct from v_line->>'brand_model')
    then raise exception 'prepared_kit_context_changed'; end if;
  end loop;
  -- Reusa a rotina existente de baixa de estoque e criação atômica de múltiplas entregas.
  v_group:=public.register_epi_delivery_batch(v_employee.id,
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('item_id',x->>'item_id',
      'stock_batch_id',x->>'stock_batch_id','quantity',x->'quantity'))
      from pg_catalog.jsonb_array_elements(v_prep.lines_snapshot) x),
    case when v_prep.exchange_request_id is null then 'initial' else 'replacement' end,null);
  select t.name,w.name into v_team_name,v_work_name from public.teams t
    left join public.worksites w on w.id=t.worksite_id where t.id=v_employee.team_id;
  insert into public.epi_delivery_groups_3d(id,employee_id,employee_name_snapshot,prepared_kit_id,exchange_request_id,
    profession_snapshot,team_name_snapshot,work_name_snapshot,delivered_by,idempotency_key)
  values(v_group,v_employee.id,v_employee.full_name,v_prep.id,v_prep.exchange_request_id,v_employee.profession,
    v_team_name,v_work_name,(select auth.uid()),p_idempotency_key);
  return v_group;
end $$;
alter function public.register_epi_delivery_3d(uuid,uuid) owner to postgres;
revoke all on function public.register_epi_delivery_3d(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.register_epi_delivery_3d(uuid,uuid) to authenticated;

create function public.my_epi_delivery_groups_3d()
returns table(group_id uuid,delivered_at timestamptz,profession text,items jsonb,
  feedback_status text,feedback_at timestamptz,public_message text)
language sql stable security definer set search_path='' as $$
  select g.id,g.delivered_at,g.profession_snapshot,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'delivery_id',d.id,'item_name',d.item_name_snapshot,'ca_number',d.ca_snapshot,
      'quantity',d.quantity,'unit',d.unit_snapshot,'variant',d.variant_snapshot,
      'current_status',d.current_status) order by d.id)
      from public.epi_deliveries d where d.delivery_group_id=g.id),'[]'::jsonb),
    ev.event_type,ev.occurred_at,ev.public_message
  from private.employee_identity link
  join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
  join public.profiles profile on profile.id=link.auth_user_id and not profile.active
  join public.epi_employees e on e.id=link.employee_id and e.active
  join public.epi_delivery_groups_3d g on g.employee_id=e.id
  left join lateral (select x.event_type,x.occurred_at,x.public_message
    from public.epi_delivery_feedback_events_3d x where x.group_id=g.id
    order by x.id desc limit 1) ev on true
  where link.auth_user_id=(select auth.uid()) and link.status='active'
  order by g.delivered_at desc,g.id desc;
$$;
alter function public.my_epi_delivery_groups_3d() owner to postgres;
revoke all on function public.my_epi_delivery_groups_3d() from public,anon,authenticated,service_role;
grant execute on function public.my_epi_delivery_groups_3d() to authenticated;

create function public.respond_epi_delivery_3d(p_group_id uuid,p_action text,p_delivery_id uuid,
  p_category text,p_details text,p_idempotency_key uuid)
returns bigint language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid; v_group public.epi_delivery_groups_3d%rowtype;
  v_last text; v_existing public.epi_delivery_feedback_events_3d%rowtype; v_id bigint;
  v_details text:=nullif(pg_catalog.btrim(p_details),'');
begin
  if (select auth.uid()) is null or p_group_id is null or p_idempotency_key is null
    or p_action not in ('CONFIRMADO','DIVERGENCIA')
    or (p_action='CONFIRMADO' and (p_delivery_id is not null or p_category is not null or v_details is not null))
    or (p_action='DIVERGENCIA' and (p_delivery_id is null or p_category not in
      ('ITEM_FALTANDO','QUANTIDADE','TAMANHO','VARIANTE','NAO_RECEBIDO','OUTRO') or v_details is null))
    or (p_details is not null and (char_length(p_details)>240 or p_details ~ '[[:cntrl:]]'))
  then raise exception 'invalid_feedback'; end if;
  select e.id into v_employee from private.employee_identity link
    join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
    join public.profiles profile on profile.id=link.auth_user_id and not profile.active
    join public.epi_employees e on e.id=link.employee_id and e.active
    where link.auth_user_id=(select auth.uid()) and link.status='active'
    for share of link,portal,profile,e;
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  -- O filtro de titularidade precede o lock do grupo.
  perform 1 from public.epi_delivery_groups_3d where id=p_group_id and employee_id=v_employee;
  if not found then raise exception 'delivery_not_found'; end if;
  select * into v_group from public.epi_delivery_groups_3d where id=p_group_id and employee_id=v_employee for share;
  if not found then raise exception 'delivery_not_found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text,8033));
  select * into v_existing from public.epi_delivery_feedback_events_3d
    where group_id=p_group_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.actor_id<>(select auth.uid()) or v_existing.event_type<>p_action
      or v_existing.delivery_id is distinct from p_delivery_id
      or v_existing.category is distinct from p_category or v_existing.details is distinct from v_details
    then raise exception 'idempotency_conflict'; end if;
    return v_existing.id;
  end if;
  select ev.event_type into v_last from public.epi_delivery_feedback_events_3d ev
    where ev.group_id=p_group_id order by ev.id desc limit 1;
  if v_last is not null and v_last<>'RESOLVIDA' then raise exception 'feedback_already_recorded'; end if;
  if p_delivery_id is not null and not exists(select 1 from public.epi_deliveries d
    where d.id=p_delivery_id and d.delivery_group_id=p_group_id and d.employee_id=v_employee)
  then raise exception 'delivery_item_not_found'; end if;
  insert into public.epi_delivery_feedback_events_3d(group_id,event_type,delivery_id,category,details,
    actor_id,idempotency_key) values(p_group_id,p_action,p_delivery_id,p_category,v_details,
    (select auth.uid()),p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
alter function public.respond_epi_delivery_3d(uuid,text,uuid,text,text,uuid) owner to postgres;
revoke all on function public.respond_epi_delivery_3d(uuid,text,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.respond_epi_delivery_3d(uuid,text,uuid,text,text,uuid) to authenticated;

create function public.admin_epi_delivery_feedback_3d()
returns table(group_id uuid,employee_name text,delivered_at timestamptz,feedback_status text,
  item_name text,category text,details text,public_message text,internal_note text)
language sql stable security definer set search_path='' as $$
  select g.id,e.full_name,g.delivered_at,ev.event_type,d.item_name_snapshot,
    issue.category,issue.details,ev.public_message,ev.internal_note
  from public.epi_delivery_groups_3d g join public.epi_employees e on e.id=g.employee_id
  left join lateral (select x.* from public.epi_delivery_feedback_events_3d x
    where x.group_id=g.id order by x.id desc limit 1) ev on true
  left join lateral (select x.delivery_id,x.category,x.details from public.epi_delivery_feedback_events_3d x
    where x.group_id=g.id and x.event_type='DIVERGENCIA' order by x.id desc limit 1) issue on true
  left join public.epi_deliveries d on d.id=issue.delivery_id
  where (e.team_id is not null and public.can_operate('epi:write',e.team_id))
    or (e.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin'))
  order by g.delivered_at desc,g.id desc;
$$;
alter function public.admin_epi_delivery_feedback_3d() owner to postgres;
revoke all on function public.admin_epi_delivery_feedback_3d() from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_delivery_feedback_3d() to authenticated;

create function public.manage_epi_delivery_feedback_3d(p_group_id uuid,p_action text,
  p_public_message text,p_internal_note text,p_idempotency_key uuid)
returns bigint language plpgsql volatile security definer set search_path='' as $$
declare v_group public.epi_delivery_groups_3d%rowtype; v_team uuid; v_last text;
  v_existing public.epi_delivery_feedback_events_3d%rowtype; v_id bigint;
  v_public text:=nullif(pg_catalog.btrim(p_public_message),'');
  v_internal text:=nullif(pg_catalog.btrim(p_internal_note),'');
begin
  if p_group_id is null or p_idempotency_key is null or p_action not in ('EM_ANALISE','RESOLVIDA')
    or (p_action='RESOLVIDA' and v_public is null)
    or (p_public_message is not null and (char_length(p_public_message)>240 or p_public_message ~ '[[:cntrl:]]'))
    or (p_internal_note is not null and (char_length(p_internal_note)>240 or p_internal_note ~ '[[:cntrl:]]'))
  then raise exception 'invalid_management_feedback'; end if;
  perform 1 from public.profiles p where p.id=(select auth.uid()) and p.active for share;
  if not found then raise exception 'management_access_denied'; end if;
  perform 1 from public.epi_delivery_groups_3d g join public.epi_employees e on e.id=g.employee_id
    where g.id=p_group_id and ((e.team_id is not null and public.can_operate('epi:write',e.team_id))
      or (e.team_id is null and exists(select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.active and p.role='admin')));
  if not found then raise exception 'management_access_denied'; end if;
  select * into v_group from public.epi_delivery_groups_3d where id=p_group_id for share;
  select e.team_id into v_team from public.epi_employees e where e.id=v_group.employee_id for share of e;
  if not ((v_team is not null and public.can_operate('epi:write',v_team)) or
    (v_team is null and exists(select 1 from public.profiles p where p.id=(select auth.uid())
      and p.active and p.role='admin')))
  then raise exception 'management_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text,8033));
  select * into v_existing from public.epi_delivery_feedback_events_3d
    where group_id=p_group_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.actor_id<>(select auth.uid()) or v_existing.event_type<>p_action
      or v_existing.public_message is distinct from v_public
      or v_existing.internal_note is distinct from v_internal
    then raise exception 'idempotency_conflict'; end if;
    return v_existing.id;
  end if;
  select ev.event_type into v_last from public.epi_delivery_feedback_events_3d ev
    where ev.group_id=p_group_id order by ev.id desc limit 1;
  if not ((v_last='DIVERGENCIA' and p_action='EM_ANALISE') or
    (v_last='EM_ANALISE' and p_action='RESOLVIDA'))
  then raise exception 'invalid_feedback_transition'; end if;
  insert into public.epi_delivery_feedback_events_3d(group_id,event_type,actor_id,
    public_message,internal_note,idempotency_key)
  values(p_group_id,p_action,(select auth.uid()),v_public,v_internal,p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;
alter function public.manage_epi_delivery_feedback_3d(uuid,text,text,text,uuid) owner to postgres;
revoke all on function public.manage_epi_delivery_feedback_3d(uuid,text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.manage_epi_delivery_feedback_3d(uuid,text,text,text,uuid) to authenticated;

notify pgrst, 'reload schema';
