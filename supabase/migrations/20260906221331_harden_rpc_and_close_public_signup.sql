begin;

-- This helper only reads the caller's own authorization context. Running it as
-- the caller removes an unnecessary SECURITY DEFINER boundary while preserving
-- the existing admin checks used by operational RPCs.
alter function public.is_active_admin() security invoker;
revoke execute on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated, service_role;

-- Initial bootstrap is permanently closed once the first administrator exists.
-- Future users must be provisioned by the authenticated admin Edge Function.
revoke all on function public.claim_initial_admin()
  from public, anon, authenticated;

-- SECURITY DEFINER operations remain explicit authenticated endpoints, but
-- never inherit execution from PUBLIC or the anonymous API role.
do $block$
declare
  target record;
begin
  for target in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as function_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon',
      target.schema_name,
      target.function_name,
      target.function_args
    );
  end loop;
end
$block$;

-- New database functions are private by default. Each callable RPC must receive
-- an intentional, reviewed GRANT in the migration that creates it.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

-- Supabase public sign-up can set user_metadata, but cannot set app_metadata.
-- Only the service-role admin workflow stamps this server-controlled marker.
create or replace function private.enforce_metallo_user_provisioning()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if coalesce(new.raw_app_meta_data ->> 'metallo_provisioned', 'false') <> 'true' then
    raise exception 'public_signup_disabled' using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function private.enforce_metallo_user_provisioning()
  from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.enforce_metallo_user_provisioning()
  to supabase_auth_admin;

drop trigger if exists enforce_metallo_user_provisioning on auth.users;
create trigger enforce_metallo_user_provisioning
before insert on auth.users
for each row execute function private.enforce_metallo_user_provisioning();

comment on function private.enforce_metallo_user_provisioning() is
  'Blocks public Auth sign-up; users must be created by the Metallo admin workflow.';

commit;
