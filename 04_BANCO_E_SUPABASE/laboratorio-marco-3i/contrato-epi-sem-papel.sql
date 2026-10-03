-- Marco 3I — EPI sem papel. SOMENTE laboratório local (Docker). Não aplicar no Supabase remoto.
-- 1) Recusa registrada pela Gestão (novo evento RECUSA, imutável, com mensagem ao funcionário).
-- 2) Termo de ciência dos deveres do trabalhador (NR-6, item 6.6.1), aceito uma vez pelo próprio funcionário.
-- Base: contratos 3D (entrega/confirmação), 3E (ficha/histórico) e 3F (biometria) já aplicados.

begin;

-- 1. RECUSA ------------------------------------------------------------------
do $$
declare v_name text;
begin
  select c.conname into v_name from pg_constraint c
    where c.conrelid='public.epi_delivery_feedback_events_3d'::regclass and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%event_type%';
  if v_name is not null then
    execute format('alter table public.epi_delivery_feedback_events_3d drop constraint %I', v_name);
  end if;
end $$;
alter table public.epi_delivery_feedback_events_3d add constraint epi_delivery_feedback_events_3d_event_type_check
  check (event_type in ('CONFIRMADO','DIVERGENCIA','EM_ANALISE','RESOLVIDA','RECUSA'));

-- Funcionário continua podendo confirmar ou informar divergência depois de uma recusa registrada.
create or replace function public.respond_epi_delivery_3d(p_group_id uuid,p_action text,p_delivery_id uuid,
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
  if v_last is not null and v_last not in ('RESOLVIDA','RECUSA') then raise exception 'feedback_already_recorded'; end if;
  if p_delivery_id is not null and not exists(select 1 from public.epi_deliveries d
    where d.id=p_delivery_id and d.delivery_group_id=p_group_id and d.employee_id=v_employee)
  then raise exception 'delivery_item_not_found'; end if;
  insert into public.epi_delivery_feedback_events_3d(group_id,event_type,delivery_id,category,details,
    actor_id,idempotency_key) values(p_group_id,p_action,p_delivery_id,p_category,v_details,
    (select auth.uid()),p_idempotency_key) returning id into v_id;
  return v_id;
end $$;

-- Gestão: além de análise/resolução, registra RECUSA de entrega ainda sem resposta do funcionário.
-- A mensagem pública (o que foi recusado) é obrigatória; a nota interna (ex.: testemunha) é opcional.
create or replace function public.manage_epi_delivery_feedback_3d(p_group_id uuid,p_action text,
  p_public_message text,p_internal_note text,p_idempotency_key uuid)
returns bigint language plpgsql volatile security definer set search_path='' as $$
declare v_group public.epi_delivery_groups_3d%rowtype; v_team uuid; v_last text;
  v_existing public.epi_delivery_feedback_events_3d%rowtype; v_id bigint;
  v_public text:=nullif(pg_catalog.btrim(p_public_message),'');
  v_internal text:=nullif(pg_catalog.btrim(p_internal_note),'');
begin
  if p_group_id is null or p_idempotency_key is null or p_action not in ('EM_ANALISE','RESOLVIDA','RECUSA')
    or (p_action in ('RESOLVIDA','RECUSA') and v_public is null)
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
    (v_last='EM_ANALISE' and p_action='RESOLVIDA') or
    (p_action='RECUSA' and (v_last is null or v_last='RESOLVIDA')))
  then raise exception 'invalid_feedback_transition'; end if;
  insert into public.epi_delivery_feedback_events_3d(group_id,event_type,actor_id,
    public_message,internal_note,idempotency_key)
  values(p_group_id,p_action,(select auth.uid()),v_public,v_internal,p_idempotency_key)
  returning id into v_id;
  return v_id;
end $$;

-- 2. TERMO DE CIÊNCIA ----------------------------------------------------------
-- Texto único no servidor; o hash prova exatamente o que foi aceito.
create or replace function private.epi_awareness_text_3i()
returns text language sql immutable set search_path='' as $$
  select 'Declaro que recebi orientação sobre o uso dos Equipamentos de Proteção Individual (EPI) '
    || 'e que, conforme a NR-6, item 6.6.1, cabe a mim, quanto ao EPI: '
    || 'a) usar o fornecido pela organização; '
    || 'b) utilizar apenas para a finalidade a que se destina; '
    || 'c) responsabilizar-me pela limpeza, guarda e conservação; '
    || 'd) comunicar à organização quando extraviado, danificado ou com qualquer alteração que o torne impróprio para uso; e '
    || 'e) cumprir as determinações da organização sobre o uso adequado. '
    || 'Também estou ciente de que as entregas de EPI são registradas neste sistema eletrônico e que '
    || 'confirmo cada recebimento pelo aplicativo.';
$$;
alter function private.epi_awareness_text_3i() owner to postgres;
revoke all on function private.epi_awareness_text_3i() from public,anon,authenticated,service_role;

create table if not exists public.epi_awareness_terms_3i (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  term_version text not null check (term_version='NR6-6.6.1-v1'),
  term_sha256 text not null check (term_sha256 ~ '^[0-9a-f]{64}$'),
  actor_id uuid not null references auth.users(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  idempotency_key uuid not null unique,
  unique(employee_id,term_version)
);
alter table public.epi_awareness_terms_3i enable row level security;
revoke all on public.epi_awareness_terms_3i from public,anon,authenticated,service_role;
revoke all on sequence public.epi_awareness_terms_3i_id_seq from public,anon,authenticated,service_role;
drop trigger if exists guard_epi_awareness_3i on public.epi_awareness_terms_3i;
create trigger guard_epi_awareness_3i before update or delete on public.epi_awareness_terms_3i
for each row execute function public.guard_epi_3d_immutable();

create or replace function public.my_epi_awareness_3i()
returns table(term_version text,term_text text,term_sha256 text,accepted_at timestamptz)
language sql stable security definer set search_path='' as $$
  select 'NR6-6.6.1-v1',private.epi_awareness_text_3i(),
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(private.epi_awareness_text_3i(),'UTF8')),'hex'),
    (select t.accepted_at from public.epi_awareness_terms_3i t
      where t.employee_id=e.id and t.term_version='NR6-6.6.1-v1')
  from private.employee_identity link
  join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
  join public.profiles profile on profile.id=link.auth_user_id and not profile.active
  join public.epi_employees e on e.id=link.employee_id and e.active
  where link.auth_user_id=(select auth.uid()) and link.status='active';
$$;
alter function public.my_epi_awareness_3i() owner to postgres;
revoke all on function public.my_epi_awareness_3i() from public,anon,authenticated,service_role;
grant execute on function public.my_epi_awareness_3i() to authenticated;

create or replace function public.accept_epi_awareness_3i(p_term_sha256 text,p_idempotency_key uuid)
returns timestamptz language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid; v_hash text; v_row public.epi_awareness_terms_3i%rowtype;
begin
  v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(private.epi_awareness_text_3i(),'UTF8')),'hex');
  if (select auth.uid()) is null or p_idempotency_key is null or p_term_sha256 is distinct from v_hash
  then raise exception 'invalid_awareness'; end if;
  select e.id into v_employee from private.employee_identity link
    join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
    join public.profiles profile on profile.id=link.auth_user_id and not profile.active
    join public.epi_employees e on e.id=link.employee_id and e.active
    where link.auth_user_id=(select auth.uid()) and link.status='active'
    for share of link,portal,profile,e;
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_employee::text,8034));
  select * into v_row from public.epi_awareness_terms_3i
    where employee_id=v_employee and term_version='NR6-6.6.1-v1';
  if found then return v_row.accepted_at; end if; -- aceite único; repetir não cria outro
  insert into public.epi_awareness_terms_3i(employee_id,term_version,term_sha256,actor_id,idempotency_key)
    values(v_employee,'NR6-6.6.1-v1',v_hash,(select auth.uid()),p_idempotency_key)
    returning * into v_row;
  return v_row.accepted_at;
end $$;
alter function public.accept_epi_awareness_3i(text,uuid) owner to postgres;
revoke all on function public.accept_epi_awareness_3i(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.accept_epi_awareness_3i(text,uuid) to authenticated;

-- Gestão vê o aceite dentro do seu escopo (mesma regra das entregas 3D).
create or replace function public.admin_epi_awareness_3i(p_employee_id uuid default null)
returns table(employee_id uuid,employee_name text,accepted_at timestamptz)
language sql stable security definer set search_path='' as $$
  select e.id,e.full_name,t.accepted_at
  from public.epi_employees e
  left join public.epi_awareness_terms_3i t on t.employee_id=e.id and t.term_version='NR6-6.6.1-v1'
  where e.active and (p_employee_id is null or e.id=p_employee_id)
    and ((e.team_id is not null and public.can_operate('epi:write',e.team_id))
      or (e.team_id is null and exists(select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.active and p.role='admin')))
  order by e.full_name,e.id;
$$;
alter function public.admin_epi_awareness_3i(uuid) owner to postgres;
revoke all on function public.admin_epi_awareness_3i(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_awareness_3i(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
