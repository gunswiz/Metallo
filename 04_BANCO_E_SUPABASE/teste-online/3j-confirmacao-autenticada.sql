-- Marco 3J (TESTE ONLINE, dados fictícios): recebimento de EPI confirmado SEMPRE com digital (3F) ou senha.
-- Senha: a Edge Function assinatura-epi-3f confere a senha no Auth e grava aqui como foi a confirmação.
create table private.epi_confirmacao_senha_3j (
  id bigint generated always as identity primary key,
  group_id uuid not null unique references public.epi_delivery_groups_3d(id) on delete restrict,
  feedback_id bigint not null unique references public.epi_delivery_feedback_events_3d(id) on delete restrict,
  account_id uuid not null references auth.users(id) on delete restrict,
  employee_id uuid not null references public.epi_employees(id) on delete restrict,
  method text not null check (method = 'senha-reautenticacao'),
  verified_at timestamptz not null default clock_timestamp()
);
create table private.epi_tentativa_senha_3j (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete restrict,
  ok boolean not null,
  at timestamptz not null default clock_timestamp()
);
create index epi_tentativa_senha_3j_conta on private.epi_tentativa_senha_3j(account_id, at desc);
create function private.imutavel_3j() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'registro_imutavel'; end $$;
create trigger imutavel before update or delete on private.epi_confirmacao_senha_3j for each row execute function private.imutavel_3j();
alter table private.epi_confirmacao_senha_3j enable row level security;
alter table private.epi_tentativa_senha_3j enable row level security;
revoke all on private.epi_confirmacao_senha_3j, private.epi_tentativa_senha_3j from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_epi_delivery_3d(p_group_id uuid, p_action text, p_delivery_id uuid, p_category text, p_details text, p_idempotency_key uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Marco 3J: confirmar recebimento exige digital (3F) ou senha. Só as Edge Functions ligam esta chave na transação;
  -- pela API pública ela nunca vem ligada, então CONFIRMADO direto é recusado.
  if p_action='CONFIRMADO' and coalesce(pg_catalog.current_setting('metallo.confirmacao_3j', true),'')<>'ok'
  then raise exception 'confirmacao_exige_digital_ou_senha'; end if;
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
end $function$
;

select '3J pronto' as status;
