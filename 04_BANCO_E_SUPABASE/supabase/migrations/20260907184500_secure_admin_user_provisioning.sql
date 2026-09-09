begin;

create table if not exists private.user_provisioning_tickets (
  email text primary key,
  token text not null,
  expires_at timestamptz not null
);

revoke all on table private.user_provisioning_tickets
  from public, anon, authenticated;

create or replace function public.issue_user_provisioning_ticket(
  p_email text,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_token text := trim(coalesce(p_token, ''));
begin
  if normalized_email = '' or normalized_token = '' then
    raise exception 'invalid_provisioning_ticket' using errcode = '22023';
  end if;

  delete from private.user_provisioning_tickets
  where expires_at <= now();

  insert into private.user_provisioning_tickets (email, token, expires_at)
  values (normalized_email, normalized_token, now() + interval '2 minutes')
  on conflict (email) do update
  set token = excluded.token,
      expires_at = excluded.expires_at;
end;
$function$;

create or replace function public.revoke_user_provisioning_ticket(
  p_email text,
  p_token text
)
returns void
language sql
security definer
set search_path = ''
as $function$
  delete from private.user_provisioning_tickets
  where email = lower(trim(coalesce(p_email, '')))
    and token = trim(coalesce(p_token, ''));
$function$;

revoke all on function public.issue_user_provisioning_ticket(text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_user_provisioning_ticket(text, text)
  from public, anon, authenticated;
grant execute on function public.issue_user_provisioning_ticket(text, text)
  to service_role;
grant execute on function public.revoke_user_provisioning_ticket(text, text)
  to service_role;

create or replace function private.enforce_metallo_user_provisioning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  provisioning_token text := coalesce(
    new.raw_user_meta_data ->> 'metallo_provisioning_token',
    ''
  );
begin
  delete from private.user_provisioning_tickets
  where email = lower(trim(coalesce(new.email, '')))
    and token = provisioning_token
    and expires_at > now();

  if not found then
    raise exception 'public_signup_disabled' using errcode = '42501';
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    - 'metallo_provisioning_token';
  return new;
end;
$function$;

revoke all on function private.enforce_metallo_user_provisioning()
  from public, anon, authenticated;
grant execute on function private.enforce_metallo_user_provisioning()
  to supabase_auth_admin;

comment on table private.user_provisioning_tickets is
  'Short-lived, single-use authorization for admin-provisioned Auth users.';
comment on function private.enforce_metallo_user_provisioning() is
  'Rejects Auth creation unless the Metallo admin workflow issued a matching single-use ticket.';

commit;
