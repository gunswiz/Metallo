-- Marco 3C: solicitacao de troca somente no laboratorio local.
-- Separada de epi_requests: aquela tabela exige equipe e seu atendimento movimenta estoque/entregas.
-- Nenhum objeto deste arquivo pertence a uma migration remota.
create table if not exists public.epi_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  source_delivery_id uuid not null references public.epi_deliveries(id) on delete restrict,
  item_name_snapshot text not null,
  ca_snapshot text,
  reason text not null check (reason in ('DESGASTE','DANO','PERDA_EXTRAVIO','OUTRO')),
  note text,
  status text not null default 'SOLICITADA'
    check (status in ('SOLICITADA','EM_ANALISE','APROVADA','RECUSADA','CANCELADA')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  public_decision text,
  internal_note text,
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  constraint epi_exchange_note_shape check (note is null or (char_length(note) between 1 and 240 and note = btrim(note))),
  constraint epi_exchange_other_note check (reason <> 'OUTRO' or note is not null),
  constraint epi_exchange_decision_shape check (public_decision is null or (char_length(public_decision) between 1 and 240 and public_decision = btrim(public_decision))),
  constraint epi_exchange_internal_shape check (internal_note is null or (char_length(internal_note) between 1 and 240 and internal_note = btrim(internal_note))),
  unique(employee_id, idempotency_key)
);
create unique index if not exists epi_exchange_one_open_delivery
  on public.epi_exchange_requests(source_delivery_id)
  where status in ('SOLICITADA','EM_ANALISE','APROVADA');
create index if not exists epi_exchange_employee_created
  on public.epi_exchange_requests(employee_id,created_at desc);
alter table public.epi_exchange_requests enable row level security;
revoke all on public.epi_exchange_requests from public, anon, authenticated, service_role;

create table if not exists public.epi_exchange_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.epi_exchange_requests(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  public_message text,
  internal_note text
);
create index if not exists epi_exchange_events_request on public.epi_exchange_events(request_id,id);
alter table public.epi_exchange_events enable row level security;
revoke all on public.epi_exchange_events from public, anon, authenticated, service_role;

-- Historico append-only inclusive para o proprietario das RPCs. Correcao futura exige evento novo.
create or replace function public.guard_epi_exchange_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'epi_exchange_history_immutable';
end $$;
alter function public.guard_epi_exchange_event() owner to postgres;
drop trigger if exists guard_epi_exchange_event on public.epi_exchange_events;
create trigger guard_epi_exchange_event before update or delete on public.epi_exchange_events
for each row execute function public.guard_epi_exchange_event();
revoke all on function public.guard_epi_exchange_event() from public, anon, authenticated, service_role;

-- Impede acesso por overload homonimo na API PostgREST.
do $guard$ begin
  if exists (select 1 from pg_catalog.pg_proc where pronamespace='public'::pg_catalog.regnamespace
    and proname in ('my_exchangeable_epi','my_epi_exchange_requests','create_epi_exchange_request',
      'cancel_epi_exchange_request','admin_epi_exchange_requests','manage_epi_exchange_request'))
  then raise exception 'epi_exchange_rpc_already_exists'; end if;
end $guard$;

create function public.my_exchangeable_epi()
returns table(delivery_id uuid,item_name text,ca_number text,variant text,recorded_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, i.name, d.ca_snapshot, d.variant_snapshot, d.delivered_at
  from private.employee_identity link
  join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
  join public.profiles profile on profile.id=link.auth_user_id and not profile.active
  join public.epi_employees e on e.id=link.employee_id and e.active
  join public.epi_deliveries d on d.employee_id=e.id and d.current_status='active'
  join public.epi_items i on i.id=d.item_id and i.item_kind='epi'
  where link.auth_user_id=(select auth.uid()) and link.status='active'
  order by d.delivered_at desc,d.id desc;
$$;
alter function public.my_exchangeable_epi() owner to postgres;
revoke all on function public.my_exchangeable_epi() from public,anon,authenticated,service_role;
grant execute on function public.my_exchangeable_epi() to authenticated;

create function public.create_epi_exchange_request(
  p_delivery_id uuid,p_reason text,p_note text,p_idempotency_key uuid)
returns table(request_id uuid,request_status text,requested_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_employee uuid; v_delivery public.epi_deliveries%rowtype;
  v_item public.epi_items%rowtype; v_existing public.epi_exchange_requests%rowtype;
  v_note text := nullif(pg_catalog.btrim(p_note),''); v_created public.epi_exchange_requests%rowtype;
begin
  if (select auth.uid()) is null or p_delivery_id is null or p_idempotency_key is null
    or p_reason is null or p_reason not in ('DESGASTE','DANO','PERDA_EXTRAVIO','OUTRO')
    or (p_note is not null and (char_length(p_note)>240 or p_note ~ '[[:cntrl:]]'))
    or (v_note is not null and char_length(v_note)>240)
    or (p_reason='OUTRO' and v_note is null)
  then raise exception 'invalid_exchange_request'; end if;
  select e.id into v_employee
  from private.employee_identity link
  join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
  join public.profiles profile on profile.id=link.auth_user_id and not profile.active
  join public.epi_employees e on e.id=link.employee_id and e.active
  where link.auth_user_id=(select auth.uid()) and link.status='active'
  for share of link,portal,profile,e;
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_delivery_id::text,7341));
  select * into v_existing from public.epi_exchange_requests
    where employee_id=v_employee and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.source_delivery_id<>p_delivery_id or v_existing.reason<>p_reason
      or v_existing.note is distinct from v_note then raise exception 'idempotency_conflict'; end if;
    return query select v_existing.id,v_existing.status,v_existing.created_at; return;
  end if;
  select * into v_delivery from public.epi_deliveries
    where id=p_delivery_id and employee_id=v_employee and current_status='active' for share;
  if not found then raise exception 'epi_not_available'; end if;
  select * into v_item from public.epi_items where id=v_delivery.item_id and item_kind='epi';
  if not found then raise exception 'epi_not_available'; end if;
  if exists(select 1 from public.epi_exchange_requests
    where source_delivery_id=p_delivery_id and status in ('SOLICITADA','EM_ANALISE','APROVADA'))
  then raise exception 'exchange_request_already_open'; end if;
  insert into public.epi_exchange_requests(employee_id,source_delivery_id,item_name_snapshot,ca_snapshot,reason,note,idempotency_key)
    values(v_employee,p_delivery_id,v_item.name,v_delivery.ca_snapshot,p_reason,v_note,p_idempotency_key)
    returning * into v_created;
  insert into public.epi_exchange_events(request_id,from_status,to_status,actor_id)
    values(v_created.id,null,'SOLICITADA',(select auth.uid()));
  return query select v_created.id,v_created.status,v_created.created_at;
end $$;
alter function public.create_epi_exchange_request(uuid,text,text,uuid) owner to postgres;
revoke all on function public.create_epi_exchange_request(uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_epi_exchange_request(uuid,text,text,uuid) to authenticated;

create function public.my_epi_exchange_requests()
returns table(request_id uuid,source_delivery_id uuid,item_name text,ca_number text,reason text,note text,
  request_status text,requested_at timestamptz,updated_at timestamptz,public_decision text,
  timeline jsonb)
language sql stable security definer set search_path = '' as $$
  select r.id,r.source_delivery_id,r.item_name_snapshot,r.ca_snapshot,r.reason,r.note,r.status,r.created_at,r.updated_at,
    r.public_decision,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('status',ev.to_status,'at',ev.occurred_at,
      'message',ev.public_message) order by ev.id)
      from public.epi_exchange_events ev where ev.request_id=r.id),'[]'::jsonb)
  from public.epi_exchange_requests r
  join public.epi_employees e on e.id=r.employee_id and e.active
  join private.employee_identity link on link.employee_id=e.id and link.status='active'
  join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
  join public.profiles profile on profile.id=link.auth_user_id and not profile.active
  where link.auth_user_id=(select auth.uid())
  order by r.created_at desc,r.id desc;
$$;
alter function public.my_epi_exchange_requests() owner to postgres;
revoke all on function public.my_epi_exchange_requests() from public,anon,authenticated,service_role;
grant execute on function public.my_epi_exchange_requests() to authenticated;

create function public.cancel_epi_exchange_request(p_request_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_employee uuid; v_row public.epi_exchange_requests%rowtype;
begin
  select e.id into v_employee from private.employee_identity link
    join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
    join public.profiles profile on profile.id=link.auth_user_id and not profile.active
    join public.epi_employees e on e.id=link.employee_id and e.active
    where link.auth_user_id=(select auth.uid()) and link.status='active' for share of link,portal,profile,e;
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  select * into v_row from public.epi_exchange_requests where id=p_request_id and employee_id=v_employee for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_row.status='CANCELADA' then return 'CANCELADA'; end if;
  if v_row.status<>'SOLICITADA' then raise exception 'request_cannot_be_cancelled'; end if;
  update public.epi_exchange_requests set status='CANCELADA',updated_at=now() where id=v_row.id;
  insert into public.epi_exchange_events(request_id,from_status,to_status,actor_id)
    values(v_row.id,v_row.status,'CANCELADA',(select auth.uid()));
  return 'CANCELADA';
end $$;
alter function public.cancel_epi_exchange_request(uuid) owner to postgres;
revoke all on function public.cancel_epi_exchange_request(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_epi_exchange_request(uuid) to authenticated;

create function public.admin_epi_exchange_requests()
returns table(request_id uuid,employee_name text,item_name text,ca_number text,reason text,note text,
  request_status text,requested_at timestamptz,updated_at timestamptz,public_decision text,internal_note text,timeline jsonb)
language sql stable security definer set search_path = '' as $$
  select r.id,e.full_name,r.item_name_snapshot,r.ca_snapshot,r.reason,r.note,r.status,r.created_at,r.updated_at,
    r.public_decision,r.internal_note,
    coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('status',ev.to_status,'at',ev.occurred_at)
      order by ev.id) from public.epi_exchange_events ev where ev.request_id=r.id),'[]'::jsonb)
  from public.epi_exchange_requests r join public.epi_employees e on e.id=r.employee_id
  where (e.team_id is not null and public.can_operate('epi:write',e.team_id))
    or (e.team_id is null and exists(select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.active and p.role='admin'))
  order by r.created_at desc,r.id desc;
$$;
alter function public.admin_epi_exchange_requests() owner to postgres;
revoke all on function public.admin_epi_exchange_requests() from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_exchange_requests() to authenticated;

create function public.manage_epi_exchange_request(
  p_request_id uuid,p_action text,p_public_message text default null,p_internal_note text default null)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_row public.epi_exchange_requests%rowtype; v_team uuid; v_target text;
  v_public text := nullif(pg_catalog.btrim(p_public_message),'');
  v_internal text := nullif(pg_catalog.btrim(p_internal_note),'');
begin
  if p_action not in ('EM_ANALISE','APROVADA','RECUSADA')
    or (p_public_message is not null and (char_length(p_public_message)>240 or p_public_message ~ '[[:cntrl:]]'))
    or (p_internal_note is not null and (char_length(p_internal_note)>240 or p_internal_note ~ '[[:cntrl:]]'))
    or (p_action='RECUSADA' and v_public is null)
  then raise exception 'invalid_management_action'; end if;
  -- Segura a linha do gestor até o commit; mudança concorrente de permissão espera.
  perform 1 from public.profiles p where p.id=(select auth.uid()) and p.active for share;
  if not found then raise exception 'management_access_denied'; end if;
  -- A checagem sem lock evita que um ator sem escopo prenda o pedido de outro.
  perform 1 from public.epi_exchange_requests r join public.epi_employees e on e.id=r.employee_id
    where r.id=p_request_id and ((e.team_id is not null and public.can_operate('epi:write',e.team_id))
      or (e.team_id is null and exists(select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.active and p.role='admin')));
  if not found then raise exception 'management_access_denied'; end if;
  select * into v_row from public.epi_exchange_requests where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  select e.team_id into v_team from public.epi_employees e where e.id=v_row.employee_id for share of e;
  if not ((v_team is not null and public.can_operate('epi:write',v_team)) or
    (v_team is null and exists(select 1 from public.profiles p where p.id=(select auth.uid())
      and p.active and p.role='admin'))) then raise exception 'management_access_denied'; end if;
  if not ((v_row.status='SOLICITADA' and p_action='EM_ANALISE') or
    (v_row.status='EM_ANALISE' and p_action in ('APROVADA','RECUSADA')))
  then raise exception 'invalid_status_transition'; end if;
  if p_action='APROVADA' then
    perform 1 from public.epi_deliveries d
      join public.epi_employees e on e.id=d.employee_id and e.active
      join public.epi_items i on i.id=d.item_id and i.item_kind='epi'
      where d.id=v_row.source_delivery_id and d.employee_id=v_row.employee_id and d.current_status='active'
      for share of d,e,i;
    if not found then raise exception 'epi_not_available'; end if;
  end if;
  v_target := p_action;
  update public.epi_exchange_requests set status=v_target,updated_at=now(),
    public_decision=case when v_target='RECUSADA' then v_public else public_decision end,
    internal_note=case when v_internal is not null then v_internal else internal_note end,
    decided_by=case when v_target in ('APROVADA','RECUSADA') then (select auth.uid()) else decided_by end,
    decided_at=case when v_target in ('APROVADA','RECUSADA') then now() else decided_at end
  where id=v_row.id;
  insert into public.epi_exchange_events(request_id,from_status,to_status,actor_id,public_message,internal_note)
    values(v_row.id,v_row.status,v_target,(select auth.uid()),
      case when v_target='RECUSADA' then v_public else null end,v_internal);
  return v_target;
end $$;
alter function public.manage_epi_exchange_request(uuid,text,text,text) owner to postgres;
revoke all on function public.manage_epi_exchange_request(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.manage_epi_exchange_request(uuid,text,text,text) to authenticated;
