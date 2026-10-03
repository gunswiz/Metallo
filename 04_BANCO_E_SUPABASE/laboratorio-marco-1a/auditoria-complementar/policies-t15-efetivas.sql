-- Policies efetivas capturadas em 2026-09-26T23:44:43.682Z; consulta de catalogo local.

-- ALL; roles=authenticated; PERMISSIVE
alter policy epi_employee_item_sets_admin_write on public.epi_employee_item_sets using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));

-- SELECT; roles=authenticated; PERMISSIVE
alter policy epi_employee_item_sets_read on public.epi_employee_item_sets using ((is_active_admin() OR (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_employee_item_sets.employee_id) AND (e.team_id IS NOT NULL) AND can_operate('epi:write'::text, e.team_id))))));

-- ALL; roles=authenticated; PERMISSIVE
alter policy epi_employee_items_admin_write on public.epi_employee_items using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND p.active AND (p.role = 'admin'::text)))));

-- SELECT; roles=authenticated; PERMISSIVE
alter policy epi_employee_items_read on public.epi_employee_items using ((is_active_admin() OR (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_employee_items.employee_id) AND (e.team_id IS NOT NULL) AND can_operate('epi:write'::text, e.team_id))))));

-- SELECT; roles=authenticated; PERMISSIVE
alter policy epi_ack_read on public.epi_monthly_acknowledgements using ((is_active_admin() OR (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_monthly_acknowledgements.employee_id) AND (e.team_id IS NOT NULL) AND can_operate('epi:write'::text, e.team_id))))));

-- ALL; roles=authenticated; PERMISSIVE
alter policy epi_ack_write on public.epi_monthly_acknowledgements using ((is_active_admin() OR (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_monthly_acknowledgements.employee_id) AND (e.team_id IS NOT NULL) AND can_operate('epi:write'::text, e.team_id)))))) with check ((is_active_admin() OR (EXISTS ( SELECT 1
   FROM epi_employees e
  WHERE ((e.id = epi_monthly_acknowledgements.employee_id) AND (e.team_id IS NOT NULL) AND can_operate('epi:write'::text, e.team_id))))));
