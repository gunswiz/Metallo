-- Marco 3E: leitura de EPI somente no laboratório sintético local.
-- Não é migration remota. A geração do PDF não grava fatos operacionais.

create or replace function private.epi_report_payload_3e(p_employee_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_result jsonb;
begin
  if (select count(*) from public.epi_deliveries where employee_id=p_employee_id)>3000
    or (select count(*) from public.epi_exchange_events x join public.epi_exchange_requests r on r.id=x.request_id where r.employee_id=p_employee_id)>3000
    or (select count(*) from public.epi_delivery_feedback_events_3d x join public.epi_delivery_groups_3d g on g.id=x.group_id where g.employee_id=p_employee_id)>3000
  then raise exception 'epi_report_too_large'; end if;

  select pg_catalog.jsonb_build_object(
    'employee',pg_catalog.jsonb_build_object('id',e.id,'name',e.full_name,
      'registration',e.registration_code,'profession',e.profession,'team',t.name),
    'generated_at',pg_catalog.now(),
    'report_id',pg_catalog.gen_random_uuid(),
    'deliveries',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',d.id,'item_id',d.item_id,'group_id',d.delivery_group_id,'item_name',coalesce(d.item_name_snapshot,i.name),
      'legacy_name',d.item_name_snapshot is null,'ca',d.ca_snapshot,'quantity',d.quantity,
      'unit',coalesce(d.unit_snapshot,i.unit),'legacy_unit',d.unit_snapshot is null,
      'variant',d.variant_snapshot,'lot',d.lot_snapshot,'brand',d.brand_model_snapshot,
      'delivered_at',d.delivered_at,'status',d.current_status,'closed_at',d.closed_at,
      'reason',d.delivery_reason,'team',g.team_name_snapshot,'work',g.work_name_snapshot,
      'responsible_id',coalesce(g.delivered_by,d.delivered_by),
      'responsible_name_snapshot',null,
      'exchange_request_id',g.exchange_request_id,
      'employee_name_snapshot',g.employee_name_snapshot,'profession_snapshot',g.profession_snapshot)
      order by d.delivered_at,d.id)
      from public.epi_deliveries d join public.epi_items i on i.id=d.item_id
      left join public.epi_delivery_groups_3d g on g.id=d.delivery_group_id
      -- O grupo 3D só nasce de entrega de EPI validada no registro. A classificação
      -- atual do catálogo não pode apagar esse fato histórico. Legado sem grupo
      -- continua dependendo do catálogo, sem adivinhar sua classificação passada.
      where d.employee_id=e.id and (i.item_kind='epi' or g.id is not null)),'[]'::jsonb),
    'feedback',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',x.id,'group_id',x.group_id,'delivery_id',x.delivery_id,'type',x.event_type,
      'category',x.category,
      'at',x.occurred_at) order by x.occurred_at,x.id)
      from public.epi_delivery_feedback_events_3d x
      join public.epi_delivery_groups_3d g on g.id=x.group_id
      where g.employee_id=e.id),'[]'::jsonb),
    'exchanges',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',r.id,'source_delivery_id',r.source_delivery_id,'item_name',r.item_name_snapshot,
      'ca',r.ca_snapshot,'reason',r.reason,'created_at',r.created_at,
      'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',x.id,'status',x.to_status,'at',x.occurred_at)
        order by x.occurred_at,x.id) from public.epi_exchange_events x
        where x.request_id=r.id),'[]'::jsonb),
      'new_group_id',(select g.id from public.epi_delivery_groups_3d g
        where g.exchange_request_id=r.id)) order by r.created_at,r.id)
      from public.epi_exchange_requests r where r.employee_id=e.id),'[]'::jsonb)
  ) into v_result
  from public.epi_employees e left join public.teams t on t.id=e.team_id and t.active
  where e.id=p_employee_id;
  if v_result is null then raise exception 'employee_not_found'; end if;
  return v_result;
end $$;
alter function private.epi_report_payload_3e(uuid) owner to postgres;
revoke all on function private.epi_report_payload_3e(uuid) from public,anon,authenticated,service_role;

create or replace function public.admin_epi_report_3e(p_employee_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_team uuid;
begin
  if p_employee_id is null then raise exception 'employee_not_found'; end if;
  select e.team_id into v_team from public.epi_employees e where e.id=p_employee_id;
  if not found or not ((v_team is not null and public.can_operate('epi:write',v_team))
    or (v_team is null and exists(select 1 from public.profiles p where p.id=(select auth.uid())
      and p.active and p.role='admin')))
  then raise exception 'epi_report_access_denied'; end if;
  return private.epi_report_payload_3e(p_employee_id);
end $$;
alter function public.admin_epi_report_3e(uuid) owner to postgres;
revoke all on function public.admin_epi_report_3e(uuid) from public,anon,authenticated,service_role;
grant execute on function public.admin_epi_report_3e(uuid) to authenticated;

create or replace function public.my_epi_report_3e()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_employee uuid;
begin
  select e.id into v_employee from private.employee_identity link
    join private.employee_portal_accounts portal on portal.auth_user_id=link.auth_user_id
    join public.profiles p on p.id=link.auth_user_id and not p.active
    join public.epi_employees e on e.id=link.employee_id and e.active
    where link.auth_user_id=(select auth.uid()) and link.status='active';
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  return private.epi_report_payload_3e(v_employee);
end $$;
alter function public.my_epi_report_3e() owner to postgres;
revoke all on function public.my_epi_report_3e() from public,anon,authenticated,service_role;
grant execute on function public.my_epi_report_3e() to authenticated;
