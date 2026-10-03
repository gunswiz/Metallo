-- Marco 3A: contrato pessoal somente leitura, aplicado exclusivamente ao laboratório.
-- Nenhum identificador de funcionário/equipe é recebido do cliente.
-- A equipe atual segue a resolução conservadora aprovada para Minha Obra (1C).
create or replace function public.my_team_summary()
returns table(team_name text, work_name text, member_count integer, members jsonb)
language sql stable security definer set search_path = '' as $$
  with owner as (
    select e.id as employee_id, e.team_id as home_team_id
    from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    where i.auth_user_id = (select auth.uid()) and i.status = 'active'
  ), owner_team as (
    select case
      when assignments.active_count = 1 then assignments.active_team_id
      when assignments.active_count = 0 and not exists (
        select 1 from public.employee_assignments history
        where history.employee_id = o.employee_id
      ) then o.home_team_id
      else null::uuid
    end as team_id
    from owner o
    cross join lateral (
      select count(*) as active_count, (array_agg(a.team_id))[1] as active_team_id
      from public.employee_assignments a
      where a.employee_id = o.employee_id and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
    ) assignments
  )
  select t.name, w.name, roster.member_count, roster.members
  from owner_team chosen
  join public.teams t on t.id = chosen.team_id and t.active
  left join public.worksites w on w.id = t.worksite_id and w.active
  cross join lateral (
    select count(*)::integer as member_count,
      coalesce(jsonb_agg(
        jsonb_build_object('name', member.full_name, 'profession',
          coalesce(nullif(pg_catalog.btrim(member.profession), ''), 'Função não informada'))
        order by member.full_name, member.id
      ), '[]'::jsonb) as members
    from public.epi_employees member
    cross join lateral (
      select count(*) as active_count, (array_agg(a.team_id))[1] as active_team_id
      from public.employee_assignments a
      where a.employee_id = member.id and a.starts_at <= now()
        and (a.ends_at is null or a.ends_at > now())
    ) member_assignments
    where member.active and t.id = case
      when member_assignments.active_count = 1 then member_assignments.active_team_id
      when member_assignments.active_count = 0 and not exists (
        select 1 from public.employee_assignments history
        where history.employee_id = member.id
      ) then member.team_id
      else null::uuid
    end
  ) roster;
$$;

revoke all on function public.my_team_summary() from public, anon, authenticated;
grant execute on function public.my_team_summary() to authenticated;
