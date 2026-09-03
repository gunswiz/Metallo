create table if not exists public.epi_employee_item_sets (
  employee_id uuid primary key references public.epi_employees(id) on delete cascade,
  updated_by uuid references auth.users(id) default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.epi_employee_items (
  employee_id uuid not null references public.epi_employees(id) on delete cascade,
  item_id uuid not null references public.epi_items(id),
  required_quantity integer not null default 1 check (required_quantity > 0),
  primary key (employee_id, item_id)
);

create index if not exists epi_employee_items_item_idx
  on public.epi_employee_items(item_id);

alter table public.epi_employee_item_sets enable row level security;
alter table public.epi_employee_items enable row level security;

create policy epi_employee_item_sets_read on public.epi_employee_item_sets
for select to authenticated using (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role in ('admin','engineer')
));
create policy epi_employee_item_sets_admin_write on public.epi_employee_item_sets
for all to authenticated using (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role='admin'
)) with check (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role='admin'
));
create policy epi_employee_items_read on public.epi_employee_items
for select to authenticated using (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role in ('admin','engineer')
));
create policy epi_employee_items_admin_write on public.epi_employee_items
for all to authenticated using (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role='admin'
)) with check (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.active and p.role='admin'
));

grant select,insert,update,delete on public.epi_employee_item_sets to authenticated;
grant select,insert,update,delete on public.epi_employee_items to authenticated;

create or replace function public.set_epi_employee_items(
  p_employee_id uuid, p_lines jsonb
) returns void language plpgsql security invoker set search_path=public as $$
declare v_line jsonb;
begin
  insert into public.epi_employee_item_sets(employee_id,updated_by,updated_at)
  values(p_employee_id,auth.uid(),now())
  on conflict(employee_id) do update
    set updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  delete from public.epi_employee_items where employee_id=p_employee_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.epi_employee_items(employee_id,item_id,required_quantity)
    values(p_employee_id,(v_line->>'item_id')::uuid,(v_line->>'quantity')::integer);
  end loop;
end; $$;

revoke execute on function public.set_epi_employee_items(uuid,jsonb) from public,anon;
grant execute on function public.set_epi_employee_items(uuid,jsonb) to authenticated;
