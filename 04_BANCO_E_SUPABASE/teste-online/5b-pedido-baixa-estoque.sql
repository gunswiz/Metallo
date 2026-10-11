-- Marco 5B (TESTE ONLINE, dados fictícios): pedido de material atendido já dá baixa no estoque.
-- Ao marcar "Atendido", a Gestão pode (padrão: sim) lançar o material como CONSUMO da equipe do funcionário,
-- no estoque da obra dela. Assim o encarregado não precisa lançar de novo, e o consumo do dia já conta.

create table if not exists private.pedido_material_baixa_5b (
  pedido_id bigint primary key references private.pedidos_material_3t(id),
  team_id uuid not null references public.teams(id),
  quantidade integer not null check (quantidade > 0),
  feito_em timestamptz not null default now(),
  feito_por uuid not null references auth.users(id)
);
alter table private.pedido_material_baixa_5b enable row level security;
revoke all on private.pedido_material_baixa_5b from public, anon, authenticated, service_role;

-- Equipe atual do funcionário: a escala ativa (se houver só uma); senão, a equipe do cadastro.
create or replace function private.equipe_do_funcionario_5b(p_employee uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when count(*) = 1 then (array_agg(a.team_id))[1] end from public.employee_assignments a
      where a.employee_id = p_employee and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())),
    (select e.team_id from public.epi_employees e where e.id = p_employee));
$$;
revoke all on function private.equipe_do_funcionario_5b(uuid) from public, anon, authenticated, service_role;

-- Lista para a Gestão: além do pedido, a equipe, o saldo na obra e se já deu baixa.
create or replace function public.admin_pedidos_material_5b()
returns table(id bigint, funcionario text, matricula text, material text, unidade text, quantidade numeric, observacao text, status text,
  resposta text, created_at timestamptz, decided_at timestamptz, equipe text, saldo_obra integer, baixa_feita boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select p.id, e.full_name, e.registration_code, i.name, i.unit, p.quantidade, p.observacao, p.status, p.resposta, p.created_at, p.decided_at,
    t.name, (select inv.quantity from public.inventory inv where inv.item_id = p.item_id and inv.team_id = coalesce(w.stock_team_id, t.id)),
    exists (select 1 from private.pedido_material_baixa_5b b where b.pedido_id = p.id)
  from private.pedidos_material_3t p join public.epi_employees e on e.id = p.employee_id join public.items i on i.id = p.item_id
    left join public.teams t on t.id = private.equipe_do_funcionario_5b(p.employee_id)
    left join public.worksites w on w.id = t.worksite_id
  where p.status = 'aberto' or p.decided_at > now() - interval '30 days' order by (p.status = 'aberto') desc, p.created_at desc limit 200;
end $$;
revoke all on function public.admin_pedidos_material_5b() from public, anon;
grant execute on function public.admin_pedidos_material_5b() to authenticated;

-- Atender/recusar. Com p_baixar, o consumo é lançado pela mesma regra de sempre (public.consume_material:
-- permissão de consumo para a equipe e saldo suficiente). Tudo ou nada: sem saldo, o pedido continua aberto.
create or replace function public.decide_pedido_material_5b(p_id bigint, p_status text, p_resposta text, p_baixar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v private.pedidos_material_3t; v_team uuid; v_item text; v_func text;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select * into v from private.pedidos_material_3t where id = p_id for update;
  if v.id is null or v.status <> 'aberto' then raise exception 'pedido_nao_encontrado' using errcode = '22023'; end if;
  if p_status = 'atendido' and coalesce(p_baixar, false) then
    if v.quantidade <> trunc(v.quantidade) then raise exception 'quantidade_fracionada' using errcode = '22023'; end if;
    v_team := private.equipe_do_funcionario_5b(v.employee_id);
    if v_team is null then raise exception 'funcionario_sem_equipe' using errcode = '22023'; end if;
    select e.full_name into v_func from public.epi_employees e where e.id = v.employee_id;
    perform public.consume_material(v.item_id, v_team, v.quantidade, left('Pedido pelo app nº ' || v.id || ' — ' || v_func, 200));
    insert into private.pedido_material_baixa_5b(pedido_id, team_id, quantidade, feito_por) values (v.id, v_team, v.quantidade::integer, (select auth.uid()));
  end if;
  perform public.decide_pedido_material_3t(p_id, p_status, p_resposta);
end $$;
revoke all on function public.decide_pedido_material_5b(bigint, text, text, boolean) from public, anon;
grant execute on function public.decide_pedido_material_5b(bigint, text, text, boolean) to authenticated;

select '5B pronto' as status;
