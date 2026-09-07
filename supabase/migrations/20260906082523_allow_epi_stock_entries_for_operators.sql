-- Stock entries are operational EPI work: both administrators and engineers
-- may register them, while catalog creation/editing remains administrator-only.
-- A function is used instead of widening direct table access so that variants
-- configured for boots, glasses and uniforms are validated centrally.
create or replace function public.add_epi_stock_batch(
  p_item_id uuid,
  p_quantity integer,
  p_variant text default null,
  p_ca_number text default null,
  p_brand_model text default null,
  p_lot_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_variant text := nullif(btrim(p_variant), '');
  v_has_variants boolean;
begin
  if v_actor is null or not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.active
      and p.role in ('admin', 'engineer')
  ) then
    raise exception 'not authorized';
  end if;

  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception 'invalid quantity';
  end if;

  if not exists (
    select 1 from public.epi_items i where i.id = p_item_id and i.active
  ) then
    raise exception 'active EPI item not found';
  end if;

  select exists (
    select 1
    from public.epi_item_variants v
    where v.item_id = p_item_id and v.active
  ) into v_has_variants;

  if v_has_variants then
    select v.value
    into v_variant
    from public.epi_item_variants v
    where v.item_id = p_item_id
      and v.active
      and (
        lower(v.value) = lower(coalesce(v_variant, ''))
        or lower(v.label) = lower(coalesce(v_variant, ''))
      )
    order by v.sort_order, v.label
    limit 1;

    if v_variant is null then
      raise exception 'invalid or missing item variant';
    end if;
  end if;

  insert into public.epi_stock_batches (
    item_id,
    quantity,
    variant,
    ca_number,
    brand_model,
    lot_number,
    created_by
  ) values (
    p_item_id,
    p_quantity,
    v_variant,
    nullif(btrim(p_ca_number), ''),
    nullif(btrim(p_brand_model), ''),
    nullif(btrim(p_lot_number), ''),
    v_actor
  )
  returning id into v_batch_id;

  return v_batch_id;
end;
$$;

revoke all on function public.add_epi_stock_batch(uuid, integer, text, text, text, text) from public, anon;
grant execute on function public.add_epi_stock_batch(uuid, integer, text, text, text, text) to authenticated;

comment on function public.add_epi_stock_batch(uuid, integer, text, text, text, text) is
  'Registers an EPI stock batch for an active administrator or engineer and validates configured variants.';
