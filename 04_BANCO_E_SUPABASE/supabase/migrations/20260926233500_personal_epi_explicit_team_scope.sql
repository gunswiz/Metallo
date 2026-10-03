-- T-15: explicitar o recorte em itens, kits e acknowledgements pessoais de EPI.
-- Somente laboratorio. Nao altera can_operate, grants, FKs, DTO ou migrations auditadas.
-- A RLS de epi_employees ja negava o caso NULL no catalogo T-05 ensaiado;
-- esta guarda local elimina a dependencia exclusiva daquela policy transitiva.
alter policy epi_employee_items_read on public.epi_employee_items using (
  public.is_active_admin() or exists (
    select 1 from public.epi_employees e
    where e.id = epi_employee_items.employee_id
      and e.team_id is not null
      and public.can_operate('epi:write', e.team_id)
  )
);

alter policy epi_employee_item_sets_read on public.epi_employee_item_sets using (
  public.is_active_admin() or exists (
    select 1 from public.epi_employees e
    where e.id = epi_employee_item_sets.employee_id
      and e.team_id is not null
      and public.can_operate('epi:write', e.team_id)
  )
);

alter policy epi_ack_read on public.epi_monthly_acknowledgements using (
  public.is_active_admin() or exists (
    select 1 from public.epi_employees e
    where e.id = epi_monthly_acknowledgements.employee_id
      and e.team_id is not null
      and public.can_operate('epi:write', e.team_id)
  )
);

-- FOR ALL: USING protege leitura/UPDATE/DELETE; WITH CHECK protege INSERT e
-- destino de UPDATE, inclusive troca maliciosa de employee_id. Admin preservado.
alter policy epi_ack_write on public.epi_monthly_acknowledgements using (
  public.is_active_admin() or exists (
    select 1 from public.epi_employees e
    where e.id = epi_monthly_acknowledgements.employee_id
      and e.team_id is not null
      and public.can_operate('epi:write', e.team_id)
  )
) with check (
  public.is_active_admin() or exists (
    select 1 from public.epi_employees e
    where e.id = epi_monthly_acknowledgements.employee_id
      and e.team_id is not null
      and public.can_operate('epi:write', e.team_id)
  )
);
