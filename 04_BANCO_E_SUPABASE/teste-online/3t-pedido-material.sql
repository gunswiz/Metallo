-- Marco 3T (TESTE ONLINE): o funcionário pede material pelo app; a Gestão atende ou recusa, com resposta.
create table if not exists private.pedidos_material_3t (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  item_id uuid not null references public.items(id),
  quantidade numeric(10,2) not null check (quantidade > 0 and quantidade <= 1000),
  observacao text check (observacao is null or char_length(observacao) <= 200),
  idempotency_key uuid not null unique,
  status text not null default 'aberto' check (status in ('aberto', 'atendido', 'recusado', 'cancelado')),
  resposta text check (resposta is null or char_length(resposta) <= 200),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);
create index if not exists pedidos_material_3t_status on private.pedidos_material_3t(status, created_at);
alter table private.pedidos_material_3t enable row level security;
revoke all on private.pedidos_material_3t from public, anon, authenticated, service_role;

-- Quem é o funcionário desta conta do app (mesma regra das outras telas pessoais).
create or replace function private.funcionario_do_app_3t() returns uuid language sql stable security definer set search_path = '' as $$
  select e.id from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
  where i.auth_user_id = (select auth.uid()) and i.status = 'active'
$$;
revoke all on function private.funcionario_do_app_3t() from public, anon, authenticated, service_role;

create or replace function public.my_materiais_3t() returns table(item_id uuid, nome text, unidade text, categoria text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.funcionario_do_app_3t() is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select i.id, i.name, i.unit, i.category from public.items i where i.active and i.item_type = 'material' order by i.category nulls last, i.name;
end $$;

create or replace function public.create_pedido_material_3t(p_item_id uuid, p_quantidade numeric, p_observacao text, p_idempotency_key uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_id bigint; v_abertos int;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select id into v_id from private.pedidos_material_3t where idempotency_key = p_idempotency_key and employee_id = v_emp;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.items where id = p_item_id and active and item_type = 'material') then raise exception 'material_invalido' using errcode = '22023'; end if;
  if p_quantidade is null or p_quantidade <= 0 or p_quantidade > 1000 then raise exception 'quantidade_invalida' using errcode = '22023'; end if;
  select count(*) into v_abertos from private.pedidos_material_3t where employee_id = v_emp and status = 'aberto';
  if v_abertos >= 10 then raise exception 'muitos_pedidos_abertos' using errcode = '22023'; end if;
  insert into private.pedidos_material_3t(employee_id, item_id, quantidade, observacao, idempotency_key)
    values (v_emp, p_item_id, round(p_quantidade, 2), nullif(left(trim(coalesce(p_observacao, '')), 200), ''), p_idempotency_key) returning id into v_id;
  return v_id;
end $$;

create or replace function public.my_pedidos_material_3t() returns table(id bigint, material text, unidade text, quantidade numeric, observacao text, status text, resposta text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select p.id, i.name, i.unit, p.quantidade, p.observacao, p.status, p.resposta, p.created_at, p.decided_at
    from private.pedidos_material_3t p join public.items i on i.id = p.item_id where p.employee_id = v_emp order by p.created_at desc limit 30;
end $$;

create or replace function public.cancel_pedido_material_3t(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  update private.pedidos_material_3t set status = 'cancelado', decided_at = now() where id = p_id and employee_id = v_emp and status = 'aberto';
  if not found then raise exception 'pedido_nao_encontrado' using errcode = '22023'; end if;
end $$;

-- Gestão: administrador, engenheiro ou líder ativo.
create or replace function private.pode_atender_3t() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin', 'engineer', 'leader'))
$$;
revoke all on function private.pode_atender_3t() from public, anon, authenticated, service_role;

create or replace function public.admin_pedidos_material_3t() returns table(id bigint, funcionario text, matricula text, material text, unidade text, quantidade numeric, observacao text, status text, resposta text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select p.id, e.full_name, e.registration_code, i.name, i.unit, p.quantidade, p.observacao, p.status, p.resposta, p.created_at, p.decided_at
    from private.pedidos_material_3t p join public.epi_employees e on e.id = p.employee_id join public.items i on i.id = p.item_id
    where p.status = 'aberto' or p.decided_at > now() - interval '30 days' order by (p.status = 'aberto') desc, p.created_at desc limit 200;
end $$;

create or replace function public.decide_pedido_material_3t(p_id bigint, p_status text, p_resposta text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_status not in ('atendido', 'recusado') then raise exception 'status_invalido' using errcode = '22023'; end if;
  if p_status = 'recusado' and nullif(trim(coalesce(p_resposta, '')), '') is null then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  update private.pedidos_material_3t set status = p_status, resposta = nullif(left(trim(coalesce(p_resposta, '')), 200), ''), decided_at = now(), decided_by = (select auth.uid())
    where id = p_id and status = 'aberto';
  if not found then raise exception 'pedido_nao_encontrado' using errcode = '22023'; end if;
end $$;

revoke all on function public.my_materiais_3t(), public.create_pedido_material_3t(uuid, numeric, text, uuid), public.my_pedidos_material_3t(), public.cancel_pedido_material_3t(bigint),
  public.admin_pedidos_material_3t(), public.decide_pedido_material_3t(bigint, text, text) from public, anon;
grant execute on function public.my_materiais_3t(), public.create_pedido_material_3t(uuid, numeric, text, uuid), public.my_pedidos_material_3t(), public.cancel_pedido_material_3t(bigint),
  public.admin_pedidos_material_3t(), public.decide_pedido_material_3t(bigint, text, text) to authenticated;
select '3T pronto' as status;
