-- Marco 3M (TESTE ONLINE, dados fictícios): código de verificação na ficha de EPI.
-- O código é o resumo SHA-256 (formato 3F-v1) do que o funcionário confirmou: itens, quantidades, C.A., data.
-- Digital: já gravado em private.epi_signature_events_3f. Senha: passa a ser gravado aqui na hora da confirmação.
-- Confirmações antigas por senha ficam sem código (não se calcula depois, para não fingir que existia).
alter table private.epi_confirmacao_senha_3j
  add column if not exists payload_version text check (payload_version is null or payload_version = '3F-v1'),
  add column if not exists payload_canonical text,
  add column if not exists payload_hash text check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION private.epi_report_payload_3e(p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      where d.employee_id=e.id and (i.item_kind='epi' or g.id is not null)),'[]'::jsonb),
    'feedback',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',x.id,'group_id',x.group_id,'delivery_id',x.delivery_id,'type',x.event_type,
      'category',x.category,
      'at',x.occurred_at,
      -- 3M: como foi confirmado e o código de verificação gravado na hora.
      'method',case when s.id is not null then 'digital' when c.id is not null then 'senha' end,
      'code',coalesce(s.payload_hash,c.payload_hash)) order by x.occurred_at,x.id)
      from public.epi_delivery_feedback_events_3d x
      join public.epi_delivery_groups_3d g on g.id=x.group_id
      left join private.epi_signature_events_3f s on s.feedback_id=x.id
      left join private.epi_confirmacao_senha_3j c on c.feedback_id=x.id
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
end $function$;
alter function private.epi_report_payload_3e(uuid) owner to postgres;
revoke all on function private.epi_report_payload_3e(uuid) from public,anon,authenticated,service_role;

select '3M pronto' as status;
