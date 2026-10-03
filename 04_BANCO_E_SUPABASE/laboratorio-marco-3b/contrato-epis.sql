-- Marco 3B: consulta pessoal de EPIs, aplicada somente ao laboratorio local.
-- A fonte de verdade sao entregas; kits e confirmacoes mensais nao provam posse
-- ou aceite de uma entrega individual.
-- Falha fechada se houver outra assinatura da RPC no catálogo local.
do $guard$
begin
  if exists (
    select 1 from pg_catalog.pg_proc
    where pronamespace = 'public'::pg_catalog.regnamespace
      and proname = 'my_personal_epi' and pronargs <> 0
  ) then
    raise exception 'my_personal_epi_overload_not_allowed';
  end if;
end
$guard$;

create or replace function public.my_personal_epi()
returns table(
  item_name text,
  ca_number text,
  quantity integer,
  unit text,
  variant text,
  delivered_at timestamptz,
  delivery_reason text,
  current_status text,
  closed_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select item.name, delivery.ca_snapshot, delivery.quantity, item.unit,
         delivery.variant_snapshot, delivery.delivered_at,
         delivery.delivery_reason, delivery.current_status, delivery.closed_at
  from private.employee_identity identity_link
  join private.employee_portal_accounts portal
    on portal.auth_user_id = identity_link.auth_user_id
  join public.profiles profile
    on profile.id = identity_link.auth_user_id and not profile.active
  join public.epi_employees employee
    on employee.id = identity_link.employee_id and employee.active
  join public.epi_deliveries delivery
    on delivery.employee_id = employee.id
  join public.epi_items item
    on item.id = delivery.item_id and item.item_kind = 'epi'
  where identity_link.auth_user_id = (select auth.uid())
    and identity_link.status = 'active'
  order by delivery.delivered_at desc, delivery.id desc;
$$;

alter function public.my_personal_epi() owner to postgres;
revoke all on function public.my_personal_epi() from public, anon, authenticated;
grant execute on function public.my_personal_epi() to authenticated;
