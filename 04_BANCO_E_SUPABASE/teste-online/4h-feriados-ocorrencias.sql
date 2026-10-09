-- Marco 4H (TESTE ONLINE): feriados e ocorrências do ponto (tratamento). Os registros ORIGINAIS de marcação não são tocados.
create table if not exists private.feriados_4h (
  data date primary key,
  nome text not null check (char_length(nome) between 2 and 80),
  tipo text not null check (tipo in ('nacional', 'estadual', 'municipal', 'empresa')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create table if not exists private.ocorrencias_ponto_4h (
  id bigint generated always as identity primary key,
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('atestado', 'ferias', 'folga', 'falta_justificada', 'falta', 'folga_feriado')),
  observacao text check (observacao is null or char_length(observacao) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id)
);
create unique index if not exists ocorrencias_ponto_4h_ativa on private.ocorrencias_ponto_4h(employee_id, data) where cancelled_at is null;
alter table private.feriados_4h enable row level security;
alter table private.ocorrencias_ponto_4h enable row level security;
revoke all on private.feriados_4h, private.ocorrencias_ponto_4h from public, anon, authenticated, service_role;

-- Feriados: qualquer pessoa logada lê; só administrador inclui/retira.
create or replace function public.feriados_4h(p_de date, p_ate date) returns table(data date, nome text, tipo text)
language sql stable security definer set search_path = '' as $$
  select f.data, f.nome, f.tipo from private.feriados_4h f
  where (select auth.uid()) is not null and f.ativo and f.data between p_de and p_ate and p_ate - p_de <= 400 order by f.data;
$$;
create or replace function public.admin_set_feriado_4h(p_data date, p_nome text, p_tipo text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  insert into private.feriados_4h(data, nome, tipo, created_by) values (p_data, trim(p_nome), p_tipo, (select auth.uid()))
  on conflict (data) do update set nome = excluded.nome, tipo = excluded.tipo, ativo = true, created_by = excluded.created_by, created_at = now();
end $$;
create or replace function public.admin_remove_feriado_4h(p_data date) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  -- Retirar = desativar (fica o histórico).
  update private.feriados_4h set ativo = false, created_by = (select auth.uid()), created_at = now() where data = p_data;
end $$;

-- Ocorrências: só administrador registra/cancela (cancelar guarda quem e quando; nada é apagado).
create or replace function public.admin_ocorrencias_4h(p_de date, p_ate date)
returns table(id bigint, employee_id uuid, data date, tipo text, observacao text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_ate - p_de > 400 then raise exception 'periodo_invalido' using errcode = '22023'; end if;
  return query select o.id, o.employee_id, o.data, o.tipo, o.observacao, o.created_at from private.ocorrencias_ponto_4h o
    where o.cancelled_at is null and o.data between p_de and p_ate order by o.data;
end $$;
create or replace function public.admin_set_ocorrencia_4h(p_employee_id uuid, p_data date, p_tipo text, p_observacao text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if not exists (select 1 from public.epi_employees where id = p_employee_id) then raise exception 'employee_not_found' using errcode = '22023'; end if;
  if p_data > (now() at time zone 'America/Fortaleza')::date + 366 then raise exception 'data_invalida' using errcode = '22023'; end if;
  update private.ocorrencias_ponto_4h set cancelled_at = now(), cancelled_by = (select auth.uid())
    where employee_id = p_employee_id and data = p_data and cancelled_at is null;
  insert into private.ocorrencias_ponto_4h(employee_id, data, tipo, observacao, created_by)
    values (p_employee_id, p_data, p_tipo, nullif(trim(coalesce(p_observacao, '')), ''), (select auth.uid())) returning id into v_id;
  return v_id;
end $$;
create or replace function public.admin_cancelar_ocorrencia_4h(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  update private.ocorrencias_ponto_4h set cancelled_at = now(), cancelled_by = (select auth.uid()) where id = p_id and cancelled_at is null;
end $$;

-- App: a própria pessoa vê as ocorrências dela (sem observação interna).
create or replace function public.my_ocorrencias_4h(p_de date, p_ate date) returns table(data date, tipo text)
language plpgsql stable security definer set search_path = '' as $$
declare v_employee uuid;
begin
  select e.id into v_employee from private.employee_identity i
    join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
    join public.profiles p on p.id = i.auth_user_id and not p.active
    join public.epi_employees e on e.id = i.employee_id and e.active
    where i.auth_user_id = (select auth.uid()) and i.status = 'active';
  if v_employee is null then raise exception 'portal_access_denied'; end if;
  if p_ate - p_de > 400 then raise exception 'periodo_invalido' using errcode = '22023'; end if;
  return query select o.data, o.tipo from private.ocorrencias_ponto_4h o
    where o.employee_id = v_employee and o.cancelled_at is null and o.data between p_de and p_ate order by o.data;
end $$;

revoke all on function public.feriados_4h(date, date), public.admin_set_feriado_4h(date, text, text), public.admin_remove_feriado_4h(date),
  public.admin_ocorrencias_4h(date, date), public.admin_set_ocorrencia_4h(uuid, date, text, text), public.admin_cancelar_ocorrencia_4h(bigint),
  public.my_ocorrencias_4h(date, date) from public, anon;
grant execute on function public.feriados_4h(date, date), public.admin_set_feriado_4h(date, text, text), public.admin_remove_feriado_4h(date),
  public.admin_ocorrencias_4h(date, date), public.admin_set_ocorrencia_4h(uuid, date, text, text), public.admin_cancelar_ocorrencia_4h(bigint),
  public.my_ocorrencias_4h(date, date) to authenticated;

-- Feriados nacionais de 2026 (Portaria MGI nº 11.460/2025). Estaduais e municipais: cadastrar na Gestão (dependem do local da obra).
insert into private.feriados_4h(data, nome, tipo) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'), ('2026-04-03', 'Paixão de Cristo', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'), ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'), ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'), ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'), ('2026-12-25', 'Natal', 'nacional')
on conflict (data) do nothing;
select '4H pronto' as status;
