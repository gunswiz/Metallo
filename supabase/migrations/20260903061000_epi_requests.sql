create table if not exists public.epi_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id),
  team_id uuid not null references public.teams(id),
  item_id uuid not null references public.epi_items(id),
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'pending'
    check (status in ('pending','fulfilled','cancelled')),
  requested_by uuid references auth.users(id) default auth.uid(),
  fulfilled_by uuid references auth.users(id),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists epi_requests_team_status_idx
  on public.epi_requests(team_id, status, created_at desc);
create index if not exists epi_requests_employee_idx
  on public.epi_requests(employee_id, created_at desc);
create index if not exists epi_requests_item_idx
  on public.epi_requests(item_id, status);
create unique index if not exists epi_requests_one_pending_idx
  on public.epi_requests(employee_id, item_id) where status = 'pending';

alter table public.epi_requests enable row level security;

create policy epi_requests_read on public.epi_requests for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.active
    and p.role in ('admin','engineer')
));
create policy epi_requests_write on public.epi_requests for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.active
    and p.role in ('admin','engineer')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.active
    and p.role in ('admin','engineer')
));

grant select, insert, update on public.epi_requests to authenticated;

create or replace function public.fulfill_epi_request(p_request_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.epi_requests%rowtype;
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_remaining integer;
  v_take integer;
  v_group_id uuid := gen_random_uuid();
begin
  select * into v_request from public.epi_requests
  where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'request_not_pending'; end if;

  select * into v_employee from public.epi_employees
  where id = v_request.employee_id and active;
  if not found then raise exception 'employee_not_found'; end if;

  v_remaining := v_request.quantity;
  for v_batch in
    select * from public.epi_stock_batches
    where item_id = v_request.item_id and quantity > 0
    order by received_at, id for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_batch.quantity, v_remaining);
    update public.epi_stock_batches
      set quantity = quantity - v_take where id = v_batch.id;
    insert into public.epi_deliveries(
      employee_id, team_id, item_id, stock_batch_id, quantity,
      delivery_reason, delivery_group_id, ca_snapshot,
      brand_model_snapshot, lot_snapshot, note
    ) values (
      v_employee.id, v_employee.team_id, v_batch.item_id, v_batch.id, v_take,
      'replacement', v_group_id, v_batch.ca_number,
      v_batch.brand_model, v_batch.lot_number, 'Atendimento de pendência'
    );
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then raise exception 'insufficient_epi_stock'; end if;
  update public.epi_requests set status = 'fulfilled',
    fulfilled_by = auth.uid(), fulfilled_at = now()
  where id = v_request.id;
  return v_group_id;
end;
$$;

revoke execute on function public.fulfill_epi_request(uuid) from public, anon;
grant execute on function public.fulfill_epi_request(uuid) to authenticated;
