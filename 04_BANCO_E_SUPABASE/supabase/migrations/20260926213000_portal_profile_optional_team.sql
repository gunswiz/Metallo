-- Decisao do responsavel: equipe nao e requisito de acesso pessoal.
-- Candidata aplicada somente no laboratorio; preservar a fundacao 1A auditada.
-- NULL representa ausencia de atribuicao. A FK existente continua impedindo
-- referencia orfa; excluir equipe ainda exige desvincular referencias antes.
alter table public.epi_employees alter column team_id drop not null;

create or replace function public.my_employee_profile()
returns table(employee_id uuid, full_name text, profession text, team_name text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.full_name, e.profession, t.name
  from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    left join public.teams t on t.id = e.team_id and t.active
  where i.auth_user_id = (select auth.uid()) and i.status = 'active';
$$;
revoke all on function public.my_employee_profile() from public, anon;
grant execute on function public.my_employee_profile() to authenticated;
