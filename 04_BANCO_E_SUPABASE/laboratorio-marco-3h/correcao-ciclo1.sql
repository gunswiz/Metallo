-- Correção local F-3H-02; mesma assinatura, owner e grants. Sem migration remota.
create or replace function public.save_communication_3h(
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
