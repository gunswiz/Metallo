-- Evidencia capturada em 2026-09-26T22:47:59.462Z; somente leitura.
CREATE OR REPLACE FUNCTION public.my_employee_profile()
 RETURNS TABLE(employee_id uuid, full_name text, profession text, team_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id, e.full_name, e.profession, t.name
  from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    left join public.teams t on t.id = e.team_id and t.active
  where i.auth_user_id = (select auth.uid()) and i.status = 'active';
$function$
;
