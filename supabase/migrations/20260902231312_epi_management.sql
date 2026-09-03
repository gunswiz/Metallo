-- Metallo EPI: employees without app access, central stock and handovers.
create extension if not exists pgcrypto;

create table public.epi_employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 3),
  registration_code text,
  profession text not null,
  team_id uuid not null references public.teams(id),
  shirt_size text,
  pants_size text,
  shoe_size text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index epi_employees_registration_code_key
  on public.epi_employees (lower(registration_code))
  where registration_code is not null and registration_code <> '';
create index epi_employees_team_idx on public.epi_employees(team_id) where active;

create table public.epi_items (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  item_kind text not null check (item_kind in ('epi', 'uniform', 'personal_tool')),
  unit text not null default 'un',
  ca_number text,
  brand_model text,
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  replacement_days integer check (replacement_days is null or replacement_days > 0),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);

create index epi_items_kind_idx on public.epi_items(item_kind) where active;

create table public.epi_stock_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.epi_items(id),
  quantity integer not null check (quantity >= 0),
  ca_number text,
  brand_model text,
  lot_number text,
  expires_on date,
  received_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index epi_stock_item_idx on public.epi_stock_batches(item_id);

create table public.epi_deliveries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id),
  team_id uuid not null references public.teams(id),
  item_id uuid not null references public.epi_items(id),
  stock_batch_id uuid references public.epi_stock_batches(id),
  quantity integer not null check (quantity > 0),
  delivered_at timestamptz not null default now(),
  delivery_reason text not null default 'initial'
    check (delivery_reason in ('initial', 'replacement', 'additional')),
  current_status text not null default 'active'
    check (current_status in ('active', 'returned', 'replaced', 'lost', 'damaged', 'consumed')),
  ca_snapshot text,
  brand_model_snapshot text,
  lot_snapshot text,
  note text,
  delivered_by uuid not null default auth.uid() references auth.users(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index epi_deliveries_employee_idx on public.epi_deliveries(employee_id, delivered_at desc);
create index epi_deliveries_team_idx on public.epi_deliveries(team_id, delivered_at desc);

create table public.epi_monthly_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.epi_employees(id),
  reference_month date not null check (reference_month = date_trunc('month', reference_month)::date),
  signed_name text,
  signed_at timestamptz,
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(employee_id, reference_month)
);

alter table public.epi_employees enable row level security;
alter table public.epi_items enable row level security;
alter table public.epi_stock_batches enable row level security;
alter table public.epi_deliveries enable row level security;
alter table public.epi_monthly_acknowledgements enable row level security;

-- Authorization uses server-managed profile rows, never user-editable metadata.
create policy epi_employees_read on public.epi_employees for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_employees_admin_write on public.epi_employees for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'));

create policy epi_items_read on public.epi_items for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_items_admin_write on public.epi_items for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'));

create policy epi_stock_read on public.epi_stock_batches for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_stock_admin_write on public.epi_stock_batches for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'));
create policy epi_stock_delivery_update on public.epi_stock_batches for update to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));

create policy epi_deliveries_read on public.epi_deliveries for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_deliveries_write on public.epi_deliveries for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));

create policy epi_ack_read on public.epi_monthly_acknowledgements for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));
create policy epi_ack_write on public.epi_monthly_acknowledgements for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin','engineer')));

grant select, insert, update, delete on public.epi_employees to authenticated;
grant select, insert, update, delete on public.epi_items to authenticated;
grant select, insert, update, delete on public.epi_stock_batches to authenticated;
grant select, insert, update, delete on public.epi_deliveries to authenticated;
grant select, insert, update, delete on public.epi_monthly_acknowledgements to authenticated;

create or replace function public.register_epi_delivery(
  p_employee_id uuid,
  p_item_id uuid,
  p_stock_batch_id uuid,
  p_quantity integer,
  p_delivery_reason text default 'initial',
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee public.epi_employees%rowtype;
  v_batch public.epi_stock_batches%rowtype;
  v_delivery_id uuid;
begin
  if p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  select * into v_employee from public.epi_employees where id = p_employee_id and active for update;
  if not found then raise exception 'employee_not_found'; end if;
  select * into v_batch from public.epi_stock_batches where id = p_stock_batch_id and item_id = p_item_id for update;
  if not found then raise exception 'stock_batch_not_found'; end if;
  if v_batch.quantity < p_quantity then raise exception 'insufficient_epi_stock'; end if;

  update public.epi_stock_batches set quantity = quantity - p_quantity where id = v_batch.id;
  insert into public.epi_deliveries(
    employee_id, team_id, item_id, stock_batch_id, quantity, delivery_reason,
    ca_snapshot, brand_model_snapshot, lot_snapshot, note
  ) values (
    v_employee.id, v_employee.team_id, p_item_id, v_batch.id, p_quantity, p_delivery_reason,
    v_batch.ca_number, v_batch.brand_model, v_batch.lot_number, nullif(trim(p_note), '')
  ) returning id into v_delivery_id;
  return v_delivery_id;
end;
$$;

revoke execute on function public.register_epi_delivery(uuid,uuid,uuid,integer,text,text) from public, anon;
grant execute on function public.register_epi_delivery(uuid,uuid,uuid,integer,text,text) to authenticated;
