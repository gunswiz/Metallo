begin;
alter table public.epi_employees
  add column if not exists aso_exam_date date,
  add column if not exists aso_expiry_date date;
alter table public.epi_employees add constraint epi_employee_aso_dates
  check (aso_expiry_date is null or (aso_exam_date is not null and aso_expiry_date >= aso_exam_date));

-- Existing employee RLS continues to restrict editing to administrators.
-- Inserts remain restricted by asset_movements_admin_insert RLS.
grant insert on public.asset_movements to authenticated;
create or replace function public.return_rented_equipment(p_asset_id uuid, p_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare a public.assets%rowtype;
begin
  if auth.uid() is null or not public.is_active_admin() then
    raise exception 'admin_required';
  end if;
  select * into a from public.assets where id=p_asset_id and active for update;
  if not found then raise exception 'invalid_or_inactive_asset'; end if;
  if position('#metallo:ownership=rented' in coalesce(a.notes,'')) = 0 then
    raise exception 'rented_equipment_required';
  end if;
  insert into public.asset_movements(asset_id,origin_team_id,destination_team_id,
    previous_status,new_status,movement_type,note,performed_by)
  values(a.id,a.team_id,a.team_id,a.status,'retired','status_change',
    'Devolução à locadora' || coalesce(': ' || nullif(trim(p_note),''),''),auth.uid());
  update public.assets set active=false,status='retired',updated_at=now(),
    notes=coalesce(a.notes,'') || E'\nDevolvido à locadora em ' || current_date::text
      || coalesce(': ' || nullif(trim(p_note),''),'') where id=a.id;
end $$;
revoke all on function public.return_rented_equipment(uuid,text) from public,anon;
grant execute on function public.return_rented_equipment(uuid,text) to authenticated;
commit;
