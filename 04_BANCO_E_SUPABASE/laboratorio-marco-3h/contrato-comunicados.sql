-- Marco 3H: contrato exclusivamente local. Nao aplicar no Supabase remoto.
-- Tres responsabilidades persistentes: comunicado, revisoes imutaveis e primeira abertura.
create table private.communications_3h (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  title text not null check (length(btrim(title)) between 1 and 120),
  message text not null check (length(btrim(message)) between 1 and 4000),
  audience text not null check (audience in ('ALL','TEAM','WORK')),
  team_id uuid references public.teams(id),
  work_id uuid references public.worksites(id),
  pinned boolean not null default false,
  expires_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  updated_at timestamptz,
  updated_by uuid references auth.users(id),
  archived_at timestamptz,
  archived_by uuid references auth.users(id),
  version integer not null default 1 check (version > 0),
  check ((audience='ALL' and team_id is null and work_id is null) or
         (audience='TEAM' and team_id is not null and work_id is null) or
         (audience='WORK' and work_id is not null and team_id is null))
);
create index communications_3h_visible_idx on private.communications_3h(status,pinned desc,published_at desc)
  where status='PUBLISHED';
create table private.communication_revisions_3h (
  id bigint generated always as identity primary key,
  communication_id uuid not null references private.communications_3h(id),
  event text not null check (event in ('CREATED','PUBLISHED','REVISED','ARCHIVED')),
  version integer not null,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default clock_timestamp(),
  before_state jsonb,
  after_state jsonb not null,
  unique(communication_id,version)
);
create table private.communication_views_3h (
  communication_id uuid not null references private.communications_3h(id),
  employee_id uuid not null references public.epi_employees(id),
  first_viewed_at timestamptz not null default clock_timestamp(),
  primary key(communication_id,employee_id)
);
create index communication_views_3h_employee_idx on private.communication_views_3h(employee_id,first_viewed_at desc);
alter table private.communications_3h enable row level security;
alter table private.communication_revisions_3h enable row level security;
alter table private.communication_views_3h enable row level security;
revoke all on private.communications_3h, private.communication_revisions_3h, private.communication_views_3h from public,anon,authenticated,service_role;
revoke all on sequence private.communication_revisions_3h_id_seq from public,anon,authenticated,service_role;

-- A mesma resolucao conservadora de Minha Obra (1C) e Minha Equipe (3A).
-- Parametro existe apenas no schema private, sem EXECUTE do cliente.
create function private.communication_context_3h(p_auth_user_id uuid)
returns table(employee_id uuid, team_id uuid, work_id uuid)
language sql stable security definer set search_path='' as $$
  with owner as (
    select e.id employee_id,e.team_id home_team_id
    from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id=i.auth_user_id
    join public.profiles p on p.id=i.auth_user_id and not p.active
    join public.epi_employees e on e.id=i.employee_id and e.active
    where i.auth_user_id=p_auth_user_id and i.status='active'
  ), chosen as (
    select o.employee_id,case
      when assignment.active_count=1 then assignment.active_team_id
      when assignment.active_count=0 and not exists
        (select 1 from public.employee_assignments history where history.employee_id=o.employee_id)
        then o.home_team_id
      else null::uuid end selected_team
    from owner o cross join lateral (
      select count(*) active_count,(array_agg(a.team_id))[1] active_team_id
      from public.employee_assignments a where a.employee_id=o.employee_id
        and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now())
    ) assignment
  )
  select c.employee_id,t.id,w.id from chosen c
  left join public.teams t on t.id=c.selected_team and t.active
  left join public.worksites w on w.id=t.worksite_id and w.active;
$$;
revoke all on function private.communication_context_3h(uuid) from public,anon,authenticated,service_role;

create function public.save_communication_3h(
  p_id uuid,p_title text,p_message text,p_audience text,p_team_id uuid,p_work_id uuid,
  p_pinned boolean,p_expires_at timestamptz,p_idempotency_key uuid,p_expected_version integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_row private.communications_3h%rowtype; v_before jsonb; v_id uuid;
begin
  if v_actor is null or not public.is_active_admin() then raise exception 'forbidden_communication'; end if;
  p_title:=pg_catalog.btrim(p_title); p_message:=pg_catalog.btrim(p_message);
  if p_title is null or length(p_title) not between 1 and 120 or p_title ~ '[[:cntrl:]]' or p_title ~ '[<>]'
    or p_message is null or length(p_message) not between 1 and 4000
    or p_message ~ '[<>]' or pg_catalog.translate(p_message,E'\n\r\t','') ~ '[[:cntrl:]]'
    then raise exception 'invalid_communication_text'; end if;
  if not ((p_audience='ALL' and p_team_id is null and p_work_id is null) or
    (p_audience='TEAM' and p_team_id is not null and p_work_id is null) or
    (p_audience='WORK' and p_work_id is not null and p_team_id is null))
    then raise exception 'invalid_communication_audience'; end if;
  if p_audience='TEAM' and not exists(select 1 from public.teams where id=p_team_id and active)
    then raise exception 'invalid_communication_audience'; end if;
  if p_audience='WORK' and not exists(select 1 from public.worksites where id=p_work_id and active)
    then raise exception 'invalid_communication_audience'; end if;
  if p_expires_at is not null and p_expires_at<=clock_timestamp() then raise exception 'invalid_communication_expiry'; end if;
  if p_id is null then
    if p_idempotency_key is null then raise exception 'missing_idempotency_key'; end if;
    insert into private.communications_3h(idempotency_key,title,message,audience,team_id,work_id,pinned,expires_at,created_by)
    values(p_idempotency_key,p_title,p_message,p_audience,p_team_id,p_work_id,coalesce(p_pinned,false),p_expires_at,v_actor)
    on conflict (idempotency_key) do nothing returning id into v_id;
    if v_id is null then
      select * into v_row from private.communications_3h where idempotency_key=p_idempotency_key;
      if v_row.created_by<>v_actor or v_row.title<>p_title or v_row.message<>p_message
        or v_row.audience<>p_audience or v_row.team_id is distinct from p_team_id
        or v_row.work_id is distinct from p_work_id or v_row.pinned<>coalesce(p_pinned,false)
        or v_row.expires_at is distinct from p_expires_at then raise exception 'idempotency_conflict'; end if;
      return v_row.id;
    end if;
    select * into v_row from private.communications_3h where id=v_id;
    insert into private.communication_revisions_3h(communication_id,event,version,actor_id,after_state)
    values(v_id,'CREATED',1,v_actor,to_jsonb(v_row));
    return v_id;
  end if;
  select * into v_row from private.communications_3h where id=p_id for update;
  if not found or v_row.status='ARCHIVED' then raise exception 'communication_unavailable'; end if;
  if p_expected_version is distinct from v_row.version then raise exception 'communication_version_conflict'; end if;
  if v_row.status='PUBLISHED' and
    (v_row.audience<>p_audience or v_row.team_id is distinct from p_team_id or v_row.work_id is distinct from p_work_id)
    then raise exception 'published_audience_immutable'; end if;
  v_before:=to_jsonb(v_row);
  update private.communications_3h set title=p_title,message=p_message,audience=p_audience,
    team_id=p_team_id,work_id=p_work_id,pinned=coalesce(p_pinned,false),expires_at=p_expires_at,
    updated_at=clock_timestamp(),updated_by=v_actor,version=version+1 where id=p_id returning * into v_row;
  insert into private.communication_revisions_3h(communication_id,event,version,actor_id,before_state,after_state)
  values(p_id,'REVISED',v_row.version,v_actor,v_before,to_jsonb(v_row));
  return p_id;
end $$;

create function public.publish_communication_3h(p_id uuid,p_expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_row private.communications_3h%rowtype; v_before jsonb;
begin
  if v_actor is null or not public.is_active_admin() then raise exception 'forbidden_communication'; end if;
  select * into v_row from private.communications_3h where id=p_id for update;
  if not found then raise exception 'communication_unavailable'; end if;
  if v_row.status='PUBLISHED' and v_row.version=p_expected_version+1 then return p_id; end if;
  if v_row.status<>'DRAFT' or v_row.version is distinct from p_expected_version
    then raise exception 'communication_version_conflict'; end if;
  if v_row.expires_at is not null and v_row.expires_at<=clock_timestamp()
    then raise exception 'invalid_communication_expiry'; end if;
  v_before:=to_jsonb(v_row);
  update private.communications_3h set status='PUBLISHED',published_at=clock_timestamp(),published_by=v_actor,
    version=version+1 where id=p_id returning * into v_row;
  insert into private.communication_revisions_3h(communication_id,event,version,actor_id,before_state,after_state)
  values(p_id,'PUBLISHED',v_row.version,v_actor,v_before,to_jsonb(v_row));
  return p_id;
end $$;

create function public.archive_communication_3h(p_id uuid,p_expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_row private.communications_3h%rowtype; v_before jsonb;
begin
  if v_actor is null or not public.is_active_admin() then raise exception 'forbidden_communication'; end if;
  select * into v_row from private.communications_3h where id=p_id for update;
  if not found or v_row.status='ARCHIVED' or v_row.version is distinct from p_expected_version
    then raise exception 'communication_version_conflict'; end if;
  v_before:=to_jsonb(v_row);
  update private.communications_3h set status='ARCHIVED',archived_at=clock_timestamp(),archived_by=v_actor,
    version=version+1 where id=p_id returning * into v_row;
  insert into private.communication_revisions_3h(communication_id,event,version,actor_id,before_state,after_state)
  values(p_id,'ARCHIVED',v_row.version,v_actor,v_before,to_jsonb(v_row));
  return p_id;
end $$;

create function public.my_communications_3h(p_unread_only boolean default false,p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_context record; v_result jsonb;
begin
  select * into v_context from private.communication_context_3h(auth.uid());
  if not found then raise exception 'portal_access_denied'; end if;
  if p_limit is null or p_limit not between 1 and 30 or p_offset is null or p_offset not between 0 and 10000
    then raise exception 'invalid_pagination'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.pinned desc,rows.published_at desc,rows.id desc),'[]'::jsonb)
  into v_result from (
    select c.id,c.title,c.audience,
      case when c.audience='ALL' then 'Todos os colaboradores'
        when c.audience='TEAM' then t.name else w.name end audience_name,
      c.pinned,c.published_at,c.updated_at,c.expires_at,c.version,v.first_viewed_at
    from private.communications_3h c
    left join public.teams t on t.id=c.team_id
    left join public.worksites w on w.id=c.work_id
    left join private.communication_views_3h v on v.communication_id=c.id and v.employee_id=v_context.employee_id
    where c.status='PUBLISHED' and (c.expires_at is null or c.expires_at>now())
      and (c.audience='ALL' or (c.audience='TEAM' and c.team_id=v_context.team_id)
        or (c.audience='WORK' and c.work_id=v_context.work_id))
      and (not coalesce(p_unread_only,false) or v.first_viewed_at is null)
    order by c.pinned desc,c.published_at desc,c.id desc limit p_limit offset p_offset
  ) rows;
  return v_result;
end $$;

create function public.open_communication_3h(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_context record; v_row record; v_viewed_at timestamptz;
begin
  select * into v_context from private.communication_context_3h(auth.uid());
  if not found then raise exception 'portal_access_denied'; end if;
  select c.*,case when c.audience='ALL' then 'Todos os colaboradores'
    when c.audience='TEAM' then t.name else w.name end audience_name
  into v_row from private.communications_3h c
  left join public.teams t on t.id=c.team_id left join public.worksites w on w.id=c.work_id
  where c.id=p_id and c.status='PUBLISHED' and (c.expires_at is null or c.expires_at>now())
    and (c.audience='ALL' or (c.audience='TEAM' and c.team_id=v_context.team_id)
      or (c.audience='WORK' and c.work_id=v_context.work_id));
  if not found then raise exception 'communication_unavailable'; end if;
  insert into private.communication_views_3h(communication_id,employee_id) values(p_id,v_context.employee_id)
  on conflict do nothing;
  select first_viewed_at into v_viewed_at from private.communication_views_3h
    where communication_id=p_id and employee_id=v_context.employee_id;
  return jsonb_build_object('id',v_row.id,'title',v_row.title,'message',v_row.message,
    'audience',v_row.audience,'audience_name',v_row.audience_name,'pinned',v_row.pinned,
    'published_at',v_row.published_at,'updated_at',v_row.updated_at,'version',v_row.version,
    'first_viewed_at',v_viewed_at);
end $$;

create function public.admin_communications_3h(p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'forbidden_communication'; end if;
  if p_limit is null or p_limit not between 1 and 30 or p_offset is null or p_offset not between 0 and 10000
    then raise exception 'invalid_pagination'; end if;
  with eligible as (
    select context.* from private.employee_identity i
    cross join lateral private.communication_context_3h(i.auth_user_id) context
  ), selected as (
    select c.* from private.communications_3h c order by c.created_at desc,c.id desc limit p_limit offset p_offset
  ), rows as (
    select c.id,c.title,c.message,c.audience,c.team_id,c.work_id,
      case when c.audience='ALL' then 'Todos os colaboradores'
        when c.audience='TEAM' then t.name else w.name end audience_name,
      c.pinned,c.expires_at,c.status,c.created_at,c.published_at,c.updated_at,c.version,
      count(e.employee_id)::integer recipient_count,
      count(v.employee_id)::integer viewed_count
    from selected c left join public.teams t on t.id=c.team_id
    left join public.worksites w on w.id=c.work_id
    left join eligible e on c.audience='ALL' or (c.audience='TEAM' and c.team_id=e.team_id)
      or (c.audience='WORK' and c.work_id=e.work_id)
    left join private.communication_views_3h v on v.communication_id=c.id and v.employee_id=e.employee_id
    group by c.id,c.title,c.message,c.audience,c.team_id,c.work_id,t.name,w.name,c.pinned,
      c.expires_at,c.status,c.created_at,c.published_at,c.updated_at,c.version
  ) select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at desc,rows.id desc),'[]'::jsonb)
  into v_result from rows;
  return v_result;
end $$;

revoke all on function public.save_communication_3h(uuid,text,text,text,uuid,uuid,boolean,timestamptz,uuid,integer),
  public.publish_communication_3h(uuid,integer),public.archive_communication_3h(uuid,integer),
  public.my_communications_3h(boolean,integer,integer),public.open_communication_3h(uuid),
  public.admin_communications_3h(integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.save_communication_3h(uuid,text,text,text,uuid,uuid,boolean,timestamptz,uuid,integer),
  public.publish_communication_3h(uuid,integer),public.archive_communication_3h(uuid,integer),
  public.my_communications_3h(boolean,integer,integer),public.open_communication_3h(uuid),
  public.admin_communications_3h(integer,integer) to authenticated;
