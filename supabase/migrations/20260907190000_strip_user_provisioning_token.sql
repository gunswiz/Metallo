begin;

create or replace function private.strip_metallo_provisioning_token()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'metallo_provisioning_token';
  return new;
end;
$function$;

revoke all on function private.strip_metallo_provisioning_token()
  from public, anon, authenticated;
grant execute on function private.strip_metallo_provisioning_token()
  to supabase_auth_admin;

drop trigger if exists strip_metallo_provisioning_token on auth.users;
create trigger strip_metallo_provisioning_token
before update of raw_user_meta_data on auth.users
for each row execute function private.strip_metallo_provisioning_token();

comment on function private.strip_metallo_provisioning_token() is
  'Removes the single-use provisioning secret before Auth metadata updates are persisted.';

commit;
