-- Correções da auditoria de segurança (14/11/2026). Aplicar primeiro no banco de TESTE.


CREATE OR REPLACE FUNCTION public.replenish_material(p_item_id uuid, p_origin_team_id uuid, p_destination_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('materials:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('materials:write', p_destination_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 or p_quantity<>trunc(p_quantity) or p_origin_team_id=p_destination_team_id then raise exception 'invalid_quantity'; end if;
 if not public.can_operate('materials:write', p_origin_team_id) then raise exception 'forbidden_origin_team'; end if;
 if not exists(select 1 from public.teams where id=p_origin_team_id and active=true and location_type='central') then raise exception 'origin_must_be_cosem'; end if;
 if not exists(select 1 from public.teams where id=p_destination_team_id and active=true and location_type='field') then raise exception 'destination_must_be_field_team'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=public.stock_team(p_origin_team_id) for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=public.stock_team(p_origin_team_id);
 insert into public.inventory(item_id,team_id,quantity,status) values(p_item_id,public.stock_team(p_destination_team_id),p_quantity,'available') on conflict(item_id,team_id) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now();
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(p_item_id,p_origin_team_id,p_destination_team_id,p_quantity,'replenishment',p_note,auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION public.consume_material(p_item_id uuid, p_team_id uuid, p_quantity numeric, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_role text; v_team uuid; v_current numeric;
begin
  perform pg_advisory_xact_lock_shared(73002,1);
 select role,team_id into v_role,v_team from public.profiles where id=auth.uid() and active=true;
 if not public.can_operate('consumption:write') then raise exception 'forbidden_role'; end if;
 if not public.can_operate('consumption:write', p_team_id) then raise exception 'forbidden_team'; end if;
 if coalesce(p_quantity,0)<=0 or p_quantity<>trunc(p_quantity) then raise exception 'invalid_quantity'; end if;
 select quantity into v_current from public.inventory where item_id=p_item_id and team_id=public.stock_team(p_team_id) for update;
 if coalesce(v_current,0)<p_quantity then raise exception 'insufficient_stock'; end if;
 update public.inventory set quantity=quantity-p_quantity,updated_at=now() where item_id=p_item_id and team_id=public.stock_team(p_team_id);
 insert into public.movements(item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by) values(p_item_id,p_team_id,null,p_quantity,'consumption',p_note,auth.uid());
end $function$;

CREATE OR REPLACE FUNCTION public.register_epi_delivery_batch(p_employee_id uuid, p_lines jsonb, p_delivery_reason text DEFAULT 'initial'::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_line jsonb;
  v_quantity integer;
  v_group_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock_shared(73002,1);
  if not public.can_operate('epi:write') then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) = 0
     or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid_delivery_lines';
  end if;

  select * into v_employee
  from public.epi_employees
  where id = p_employee_id and active
  for update;
  if not found then raise exception 'employee_not_found'; end if;
  v_employee.team_id := public.employee_work_team(v_employee.id, coalesce(nullif(current_setting('metallo.occurred_at',true),'')::timestamptz,now()));
  if not public.can_operate('epi:write', v_employee.team_id)
     or not public.can_operate('epi:write', public.employee_work_team(v_employee.id, now())) then raise exception 'forbidden_team'; end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select * into v_batch
    from public.epi_stock_batches
    where id = (v_line->>'stock_batch_id')::uuid
      and item_id = (v_line->>'item_id')::uuid
    for update;
    if not found then raise exception 'stock_batch_not_found'; end if;
    if v_batch.worksite_id is not null and v_batch.worksite_id is distinct from (select worksite_id from public.teams where id=v_employee.team_id) then raise exception 'wrong_worksite_stock'; end if;
    if v_batch.quantity < v_quantity then
      raise exception 'insufficient_epi_stock';
    end if;

    update public.epi_stock_batches
    set quantity = quantity - v_quantity
    where id = v_batch.id;

    insert into public.epi_deliveries (
      employee_id, team_id, item_id, stock_batch_id, quantity,
      delivery_reason, delivery_group_id, ca_snapshot,
      brand_model_snapshot, lot_snapshot, variant_snapshot, note, delivered_by
    ) values (
      v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id,
      v_quantity, p_delivery_reason, v_group_id, v_batch.ca_number,
      v_batch.brand_model, v_batch.lot_number, v_batch.variant,
      nullif(trim(p_note), ''), (select auth.uid())
    );
  end loop;

  return v_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_pedidos_material_3t()
 RETURNS TABLE(id bigint, funcionario text, matricula text, material text, unidade text, quantidade numeric, observacao text, status text, resposta text, created_at timestamp with time zone, decided_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select p.id, e.full_name, e.registration_code, i.name, i.unit, p.quantidade, p.observacao, p.status, p.resposta, p.created_at, p.decided_at
    from private.pedidos_material_3t p join public.epi_employees e on e.id = p.employee_id join public.items i on i.id = p.item_id
    where (p.status = 'aberto' or p.decided_at > now() - interval '30 days')
    and (public.is_active_admin() or public.can_operate('requests:write', private.equipe_do_funcionario_5b(p.employee_id))) order by (p.status = 'aberto') desc, p.created_at desc limit 200;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_pedidos_material_5b()
 RETURNS TABLE(id bigint, funcionario text, matricula text, material text, unidade text, quantidade numeric, observacao text, status text, resposta text, created_at timestamp with time zone, decided_at timestamp with time zone, equipe text, saldo_obra integer, baixa_feita boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select p.id, e.full_name, e.registration_code, i.name, i.unit, p.quantidade, p.observacao, p.status, p.resposta, p.created_at, p.decided_at,
    t.name, (select inv.quantity from public.inventory inv where inv.item_id = p.item_id and inv.team_id = coalesce(w.stock_team_id, t.id)),
    exists (select 1 from private.pedido_material_baixa_5b b where b.pedido_id = p.id)
  from private.pedidos_material_3t p join public.epi_employees e on e.id = p.employee_id join public.items i on i.id = p.item_id
    left join public.teams t on t.id = private.equipe_do_funcionario_5b(p.employee_id)
    left join public.worksites w on w.id = t.worksite_id
  where (p.status = 'aberto' or p.decided_at > now() - interval '30 days')
    and (public.is_active_admin() or public.can_operate('requests:write', private.equipe_do_funcionario_5b(p.employee_id))) order by (p.status = 'aberto') desc, p.created_at desc limit 200;
end $function$;

CREATE OR REPLACE FUNCTION public.decide_pedido_material_3t(p_id bigint, p_status text, p_resposta text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_status not in ('atendido', 'recusado') then raise exception 'status_invalido' using errcode = '22023'; end if;
  if p_status = 'recusado' and nullif(trim(coalesce(p_resposta, '')), '') is null then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  if not exists (select 1 from private.pedidos_material_3t p where p.id = p_id and (public.is_active_admin() or public.can_operate('requests:write', private.equipe_do_funcionario_5b(p.employee_id)))) then raise exception 'forbidden_team' using errcode = '42501'; end if;
  update private.pedidos_material_3t set status = p_status, resposta = nullif(left(trim(coalesce(p_resposta, '')), 200), ''), decided_at = now(), decided_by = (select auth.uid())
    where id = p_id and status = 'aberto';
  if not found then raise exception 'pedido_nao_encontrado' using errcode = '22023'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.decide_pedido_material_5b(p_id bigint, p_status text, p_resposta text, p_baixar boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v private.pedidos_material_3t; v_team uuid; v_func text;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select * into v from private.pedidos_material_3t where id = p_id for update;
  if v.id is null or v.status <> 'aberto' then raise exception 'pedido_nao_encontrado' using errcode = '22023'; end if;
  if not (public.is_active_admin() or public.can_operate('requests:write', private.equipe_do_funcionario_5b(v.employee_id))) then raise exception 'forbidden_team' using errcode = '42501'; end if;
  if p_status = 'atendido' and coalesce(p_baixar, false) then
    if v.quantidade <> trunc(v.quantidade) then raise exception 'quantidade_fracionada' using errcode = '22023'; end if;
    v_team := private.equipe_do_funcionario_5b(v.employee_id);
    if v_team is null then raise exception 'funcionario_sem_equipe' using errcode = '22023'; end if;
    select e.full_name into v_func from public.epi_employees e where e.id = v.employee_id;
    perform public.consume_material(v.item_id, v_team, v.quantidade, left('Pedido pelo app nº ' || v.id || ' — ' || v_func, 200));
    insert into private.pedido_material_baixa_5b(pedido_id, team_id, quantidade, feito_por) values (v.id, v_team, v.quantidade::integer, (select auth.uid()));
  end if;
  perform public.decide_pedido_material_3t(p_id, p_status, p_resposta);
end $function$;

CREATE OR REPLACE FUNCTION public.set_asset_rental_details_3r(p_asset_id uuid, p_contract_number text, p_real_value numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_team uuid; v_owner text; v_contract text := nullif(trim(coalesce(p_contract_number, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select team_id, ownership_type into v_team, v_owner from public.assets where id = p_asset_id and active;
  if not found then raise exception 'asset_not_found' using errcode = '22023'; end if;
  if not public.can_operate('equipment:write', v_team) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from private.asset_rental_details_3r d where d.asset_id = p_asset_id)
     and not exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.active and pr.role in ('admin','engineer'))
  then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_owner <> 'rented' then raise exception 'not_rented' using errcode = '22023'; end if;
  if v_contract is not null and (char_length(v_contract) > 60 or v_contract ~ '[[:cntrl:]]') then raise exception 'invalid_contract' using errcode = '22023'; end if;
  if p_real_value is not null and (p_real_value <= 0 or p_real_value >= 100000000) then raise exception 'invalid_value' using errcode = '22023'; end if;
  if v_contract is null and p_real_value is null then delete from private.asset_rental_details_3r where asset_id = p_asset_id; return; end if;
  insert into private.asset_rental_details_3r(asset_id, contract_number, real_value, updated_at, updated_by)
    values (p_asset_id, v_contract, round(p_real_value, 2), now(), (select auth.uid()))
  on conflict (asset_id) do update set contract_number = excluded.contract_number, real_value = excluded.real_value,
    updated_at = now(), updated_by = excluded.updated_by;
end $function$;

CREATE OR REPLACE FUNCTION private.avisos_para_enviar_3u()
 RETURNS TABLE(aviso_id bigint, sub_id bigint, endpoint text, p256dh text, auth text, titulo text, corpo text, url text, tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id, s.id, s.endpoint, s.p256dh, s.auth, a.titulo, a.corpo, a.url, a.tipo
  from private.avisos_funcionario_3u a join private.push_funcionario_3u s on s.employee_id = a.employee_id
  join private.employee_identity i on i.auth_user_id = s.auth_user_id and i.employee_id = s.employee_id and i.status = 'active'
  where a.enviado_em is null and a.expira_em > now() and a.tentativas < 5
    and (a.tipo = 'PONTO' or private.em_horario_de_trabalho_3u(a.employee_id, now()))
  order by a.id limit 500;
$function$;

CREATE OR REPLACE FUNCTION private.quem_recebe_3u()
 RETURNS TABLE(employee_id uuid, auth_user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select distinct on (s.employee_id) s.employee_id, s.auth_user_id from private.push_funcionario_3u s
    join private.employee_identity i on i.auth_user_id = s.auth_user_id and i.employee_id = s.employee_id and i.status = 'active'
    left join private.push_prefs_3u p on p.employee_id = s.employee_id where coalesce(p.outros_avisos, true) order by s.employee_id, s.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION private.lembretes_ponto_3u(p_agora timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; v_local timestamp := p_agora at time zone 'America/Fortaleza'; v_dia date := (p_agora at time zone 'America/Fortaleza')::date;
  hs text[]; i int; feitas int; n int := 0; k int; nomes text[] := array['entrada', 'saída para o almoço', 'volta do almoço', 'saída'];
begin
  for r in select distinct s.employee_id from private.push_funcionario_3u s
    join private.employee_identity i on i.auth_user_id = s.auth_user_id and i.employee_id = s.employee_id and i.status = 'active'
    left join private.push_prefs_3u p on p.employee_id = s.employee_id
    join public.epi_employees e on e.id = s.employee_id and e.active
    where coalesce(p.lembrete_ponto, true) loop
    hs := private.horarios_do_dia_3u(r.employee_id, v_dia);
    if cardinality(hs) = 0 then continue; end if;
    for i in 1 .. cardinality(hs) loop
      if v_local >= v_dia + hs[i]::time and v_local < v_dia + hs[i]::time + interval '9 minutes' then
        select count(*) into feitas from ponto.marcacao m where m.employee_id = r.employee_id
          and m.marking_at >= (v_dia::timestamp at time zone 'America/Fortaleza') and m.marking_at < ((v_dia + 1)::timestamp at time zone 'America/Fortaleza');
        if feitas < i then
          insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
          values (r.employee_id, 'PONTO:' || v_dia || ':' || i || ':' || r.employee_id, 'PONTO', 'Hora do ponto',
            'Hora de bater o ponto: ' || case when cardinality(hs) = 4 then nomes[i] else 'marcação ' || i end || ' (' || hs[i] || '). Se já bateu, pode ignorar.',
            '/colaborador/ponto', ((v_dia + hs[i]::time + interval '1 hour')::timestamp at time zone 'America/Fortaleza'))
          on conflict (chave) do nothing;
          get diagnostics k = row_count; n := n + k;
        end if;
      end if;
    end loop;
  end loop;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_employee_identity(p_identity_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_user_id uuid;
begin
  if v_actor is null or not public.is_active_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
    ('employment_ended', 'wrong_association', 'account_replaced', 'other') then
    raise exception 'invalid_revocation_reason' using errcode = '22023';
  end if;
  update private.employee_identity
    set status = 'revoked', revoked_at = now(), revoked_by = v_actor,
        revocation_reason = p_reason
    where id = p_identity_id and status = 'active'
    returning auth_user_id into v_user_id;
  if v_user_id is null then
    -- A retry must still be able to finish the Auth ban after a partial failure.
    select auth_user_id into v_user_id from private.employee_identity
      where id = p_identity_id and status = 'revoked'
        and revocation_reason = p_reason;
    if v_user_id is null then
      raise exception 'active_identity_not_found' using errcode = '22023';
    end if;
  end if;
  delete from private.push_funcionario_3u where auth_user_id = v_user_id;
  update public.profiles set active = false, updated_at = now()
    where id = v_user_id;
  if not found then
    raise exception 'portal_profile_not_found' using errcode = '22023';
  end if;
  return v_user_id;
end;
$function$;

delete from private.push_funcionario_3u s where not exists (select 1 from private.employee_identity i where i.auth_user_id = s.auth_user_id and i.employee_id = s.employee_id and i.status = 'active');

CREATE OR REPLACE FUNCTION public.save_my_push_3u(p_endpoint text, p_p256dh text, p_auth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then raise exception 'invalid_push_endpoint' using errcode = '22023'; end if;
  delete from private.push_funcionario_3u where id in (select id from private.push_funcionario_3u where employee_id = v_emp and endpoint <> p_endpoint order by created_at desc offset 4);
  insert into private.push_funcionario_3u(auth_user_id, employee_id, endpoint, p256dh, auth)
    values ((select auth.uid()), v_emp, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set auth_user_id = excluded.auth_user_id, employee_id = excluded.employee_id,
    p256dh = excluded.p256dh, auth = excluded.auth, created_at = now(), fail_count = 0;
  insert into private.push_prefs_3u(employee_id) values (v_emp) on conflict do nothing;
end $function$;

CREATE OR REPLACE FUNCTION public.save_push_subscription_3p(p_endpoint text, p_p256dh text, p_auth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null or not exists (select 1 from public.profiles where id = (select auth.uid()) and active)
  then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then raise exception 'invalid_push_endpoint' using errcode = '22023'; end if;
  delete from private.push_subscriptions_3p where id in (select id from private.push_subscriptions_3p where user_id = (select auth.uid()) and endpoint <> p_endpoint order by created_at desc offset 4);
  insert into private.push_subscriptions_3p(user_id, endpoint, p256dh, auth)
    values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    created_at = now(), fail_count = 0;
end $function$;
CREATE OR REPLACE FUNCTION public.admin_cancelar_manutencao_10a(p_id bigint, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_m private.frota_manutencoes_10a%rowtype; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(v_motivo) < 3 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  select * into v_m from private.frota_manutencoes_10a m where m.id = p_id and m.status in ('aberta', 'na_oficina') for update;
  if not found then raise exception 'manutencao_nao_encontrada' using errcode = '22023'; end if;
  if v_m.bloqueia and v_m.origem in ('checklist', 'chegada') and not private.frota_pode_cadastrar_10a() then raise exception 'engenheiro_ou_admin_obrigatorio' using errcode = '42501'; end if;
  update private.frota_manutencoes_10a m set status = 'cancelada', concluida_em = now(), obs = left(v_motivo, 300) where m.id = p_id;
  perform private.frota_recalcula_10a(v_m.veiculo_id);
  perform private.frota_evento_10a(v_m.veiculo_id, 'manutencao_cancelada', 'Manutenção cancelada: ' || left(v_m.descricao, 150) || ' — ' || left(v_motivo, 150), null, (select auth.uid()));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_concluir_manutencao_10a(p_id bigint, p_custo numeric, p_km integer, p_obs text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_m private.frota_manutencoes_10a%rowtype;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_custo is not null and (p_custo < 0 or p_custo > 99999999) then raise exception 'custo_invalido' using errcode = '22023'; end if;
  select * into v_m from private.frota_manutencoes_10a m where m.id = p_id and m.status in ('aberta', 'na_oficina') for update;
  if not found then raise exception 'manutencao_nao_encontrada' using errcode = '22023'; end if;
  if v_m.bloqueia and v_m.origem in ('checklist', 'chegada') and not private.frota_pode_cadastrar_10a() then raise exception 'engenheiro_ou_admin_obrigatorio' using errcode = '42501'; end if;
  update private.frota_manutencoes_10a m set status = 'concluida', concluida_em = now(), custo = round(p_custo, 2), km = p_km, obs = nullif(left(trim(coalesce(p_obs, '')), 300), '') where m.id = p_id;
  if p_km is not null and p_km > 0 then update private.frota_veiculos_10a v set km_atual = greatest(v.km_atual, least(p_km, 3000000)) where v.id = v_m.veiculo_id; end if;
  perform private.frota_recalcula_10a(v_m.veiculo_id);
  perform private.frota_evento_10a(v_m.veiculo_id, 'manutencao_concluida', 'Manutenção concluída: ' || left(v_m.descricao, 200) || case when p_custo is null then '' else ' (custo R$ ' || to_char(p_custo, 'FM999G999G990D00') || ')' end, null, (select auth.uid()));
end $function$;
