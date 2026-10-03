-- Aplicar somente no Supabase local laboratorio-marco-1a via psql.
-- O núcleo fornece IDs extraídos de JWT assinado; apenas service_role pode executar.
-- Nenhuma tabela Auth ou RPC de sessão é exposta ao JWT do portal.
drop function if exists public.lab_active_session_2e();
create or replace function public.lab_active_session_2e(p_session_id uuid,p_auth_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.id = p_session_id
      and s.user_id = p_auth_user_id
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function public.lab_active_session_2e(uuid,uuid) from public, anon, authenticated;
grant execute on function public.lab_active_session_2e(uuid,uuid) to service_role;
