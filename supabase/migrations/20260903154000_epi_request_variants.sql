alter table public.epi_requests
  add column if not exists requested_variant text
  check (requested_variant is null or requested_variant in ('Claro', 'Escuro'));

create or replace function public.reconcile_epi_request_after_delivery()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_request public.epi_requests%rowtype;
begin
  select * into v_request from public.epi_requests
  where employee_id = new.employee_id
    and item_id = new.item_id
    and status = 'pending'
    and (requested_variant is null or requested_variant = new.variant_snapshot)
  order by created_at, id
  limit 1
  for update;

  if not found then return new; end if;

  if new.quantity >= v_request.quantity then
    update public.epi_requests
      set status = 'fulfilled', fulfilled_by = auth.uid(), fulfilled_at = now()
    where id = v_request.id;
  else
    update public.epi_requests
      set quantity = quantity - new.quantity
    where id = v_request.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.reconcile_epi_request_after_delivery()
  from public, anon, authenticated;

drop trigger if exists reconcile_epi_request_after_delivery
  on public.epi_deliveries;
create trigger reconcile_epi_request_after_delivery
after insert on public.epi_deliveries
for each row execute function public.reconcile_epi_request_after_delivery();
