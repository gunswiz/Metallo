-- Marco 3Q (TESTE ONLINE, dados fictícios): preço por unidade de cada material, para mostrar o consumo em R$.
-- Preço fica fora da tabela items (que é compartilhada com a produção) e tem histórico de quem mudou.
create table if not exists private.item_prices_3q (
  item_id uuid primary key references public.items(id) on delete cascade,
  unit_price numeric(12,2) not null check (unit_price > 0 and unit_price < 10000000),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
create table if not exists private.item_price_history_3q (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  old_price numeric(12,2),
  new_price numeric(12,2),
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id)
);
alter table private.item_prices_3q enable row level security;
alter table private.item_price_history_3q enable row level security;
revoke all on private.item_prices_3q, private.item_price_history_3q from public, anon, authenticated, service_role;

create or replace function private.pode_ver_precos_3q()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin', 'engineer'));
$$;
revoke all on function private.pode_ver_precos_3q() from public, anon, authenticated, service_role;

-- Leitura: administrador e engenheiro (quem acompanha custo). Demais perfis recebem lista vazia.
create or replace function public.item_prices_3q()
returns table(item_id uuid, unit_price numeric, updated_at timestamptz) language sql stable security definer set search_path = '' as $$
  select p.item_id, p.unit_price, p.updated_at from private.item_prices_3q p where private.pode_ver_precos_3q();
$$;

-- Gravação: só administrador. p_prices = [{"item_id": "...", "unit_price": 12.5 | null}] (null apaga o preço).
create or replace function public.admin_set_item_prices_3q(p_prices jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_row jsonb; v_item uuid; v_new numeric(12,2); v_old numeric(12,2); v_count int := 0;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user and active and role = 'admin')
  then raise exception 'admin_required' using errcode = '42501'; end if;
  if jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) > 500 then raise exception 'invalid_prices' using errcode = '22023'; end if;
  for v_row in select * from jsonb_array_elements(p_prices) loop
    v_item := (v_row->>'item_id')::uuid;
    if not exists (select 1 from public.items where id = v_item) then raise exception 'item_not_found' using errcode = '22023'; end if;
    v_new := case when v_row->'unit_price' is null or jsonb_typeof(v_row->'unit_price') = 'null' then null else round((v_row->>'unit_price')::numeric, 2) end;
    if v_new is not null and (v_new <= 0 or v_new >= 10000000) then raise exception 'invalid_price' using errcode = '22023'; end if;
    select unit_price into v_old from private.item_prices_3q where item_id = v_item;
    if v_old is not distinct from v_new then continue; end if;
    if v_new is null then delete from private.item_prices_3q where item_id = v_item;
    else insert into private.item_prices_3q(item_id, unit_price, updated_at, updated_by) values (v_item, v_new, now(), v_user)
      on conflict (item_id) do update set unit_price = excluded.unit_price, updated_at = now(), updated_by = v_user; end if;
    insert into private.item_price_history_3q(item_id, old_price, new_price, changed_by) values (v_item, v_old, v_new, v_user);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.item_prices_3q(), public.admin_set_item_prices_3q(jsonb) from public, anon;
grant execute on function public.item_prices_3q(), public.admin_set_item_prices_3q(jsonb) to authenticated;
select '3Q pronto' as status;
