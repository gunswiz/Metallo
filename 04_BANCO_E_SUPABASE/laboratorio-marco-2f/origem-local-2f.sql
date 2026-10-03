-- Somente no banco Docker local laboratorio-marco-1a. Não é migration remota.
-- O audit da identidade já é escrito na mesma transação da revogação e é imutável.
create or replace function public.lab_authz_source_2f(p_auth_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'auth_user_id', i.auth_user_id,
    'employee_id', i.employee_id,
    'state', upper(i.status),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', x.id, 'version', x.version,
        'auth_user_id', x.auth_user_id, 'employee_id', x.employee_id,
        'state', upper(x.status)) order by x.version)
      from (
        select a.id, a.auth_user_id, a.employee_id, a.status,
          row_number() over (order by case a.event_type when 'linked' then 0 else 1 end, a.event_at, a.id)::integer as version
        from private.employee_identity_audit a
        where a.identity_id = i.id
      ) x
    ), '[]'::jsonb)
  )
  from private.employee_identity i where i.auth_user_id = p_auth_user_id;
$$;
revoke all on function public.lab_authz_source_2f(uuid) from public, anon, authenticated;
grant execute on function public.lab_authz_source_2f(uuid) to service_role;

-- Prova de conclusão do logout global pendente. Nunca apaga sessões nem altera Auth.
create or replace function public.lab_sessions_before_cutoff_2f(p_auth_user_id uuid, p_cutoff_sec bigint)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(*) from auth.sessions s
  where s.user_id = p_auth_user_id
    and s.created_at < to_timestamp(p_cutoff_sec + 1);
$$;
revoke all on function public.lab_sessions_before_cutoff_2f(uuid,bigint) from public, anon, authenticated;
grant execute on function public.lab_sessions_before_cutoff_2f(uuid,bigint) to service_role;
