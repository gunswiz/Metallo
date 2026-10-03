-- Marco 1C: leitura pessoal da obra atual. Aplicar somente no laboratório até auditoria.
-- Nenhum ID de funcionário, usuário, equipe ou obra é recebido do cliente.
create or replace function public.my_current_work()
returns table(work_id uuid, work_name text)
language sql stable security definer set search_path = '' as $$
  with owner as (
    select e.id as employee_id, e.team_id as home_team_id
    from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    where i.auth_user_id = (select auth.uid()) and i.status = 'active'
  )
  select w.id, w.name
  from owner e
  cross join lateral (
    select count(*) as active_count, (array_agg(a.team_id))[1] as active_team_id
    from public.employee_assignments a
    where a.employee_id = e.employee_id and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  ) current_assignment
  cross join lateral (
    select case
      when current_assignment.active_count = 1 then current_assignment.active_team_id
      when current_assignment.active_count = 0 and not exists (
        select 1 from public.employee_assignments history
        where history.employee_id = e.employee_id
      ) then e.home_team_id
      else null::uuid
    end as team_id
  ) chosen
  join public.teams t on t.id = chosen.team_id and t.active
  join public.worksites w on w.id = t.worksite_id and w.active;
$$;

revoke all on function public.my_current_work() from public, anon, authenticated;
grant execute on function public.my_current_work() to authenticated;
