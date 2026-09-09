begin;

-- The security hardening removed PUBLIC execution from SECURITY DEFINER
-- functions. Auth user creation still needs this trigger function so a new
-- account can receive its matching public.profiles row.
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
grant execute on function public.handle_new_user()
  to supabase_auth_admin;

commit;
