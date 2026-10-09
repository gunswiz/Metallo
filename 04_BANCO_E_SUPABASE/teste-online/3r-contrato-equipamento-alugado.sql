-- Marco 3R (TESTE ONLINE, dados fictícios): equipamento alugado com número do contrato e valor real do equipamento
-- (quanto o equipamento vale, para saber o tamanho do prejuízo em caso de perda/dano — NÃO é o valor do aluguel).
-- Fica fora de public.assets (compartilhada com a produção).
create table if not exists private.asset_rental_details_3r (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  contract_number text check (contract_number is null or char_length(contract_number) between 1 and 60),
  real_value numeric(14,2) check (real_value is null or (real_value > 0 and real_value < 100000000)),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
alter table private.asset_rental_details_3r enable row level security;
revoke all on private.asset_rental_details_3r from public, anon, authenticated, service_role;

-- Gravar: quem pode cadastrar/editar equipamento daquela equipe (mesma regra do cadastro). Só para alugados.
create or replace function public.set_asset_rental_details_3r(p_asset_id uuid, p_contract_number text, p_real_value numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_team uuid; v_owner text; v_contract text := nullif(trim(coalesce(p_contract_number, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select team_id, ownership_type into v_team, v_owner from public.assets where id = p_asset_id and active;
  if not found then raise exception 'asset_not_found' using errcode = '22023'; end if;
  if not public.can_operate('equipment:write', v_team) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_owner <> 'rented' then raise exception 'not_rented' using errcode = '22023'; end if;
  if v_contract is not null and (char_length(v_contract) > 60 or v_contract ~ '[[:cntrl:]]') then raise exception 'invalid_contract' using errcode = '22023'; end if;
  if p_real_value is not null and (p_real_value <= 0 or p_real_value >= 100000000) then raise exception 'invalid_value' using errcode = '22023'; end if;
  if v_contract is null and p_real_value is null then delete from private.asset_rental_details_3r where asset_id = p_asset_id; return; end if;
  insert into private.asset_rental_details_3r(asset_id, contract_number, real_value, updated_at, updated_by)
    values (p_asset_id, v_contract, round(p_real_value, 2), now(), (select auth.uid()))
  on conflict (asset_id) do update set contract_number = excluded.contract_number, real_value = excluded.real_value,
    updated_at = now(), updated_by = excluded.updated_by;
end $$;

-- Ler: contrato para qualquer perfil ativo da Gestão; valor real só administrador e engenheiro.
create or replace function public.asset_rental_details_3r()
returns table(asset_id uuid, contract_number text, real_value numeric) language sql stable security definer set search_path = '' as $$
  select d.asset_id, d.contract_number,
    case when exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin', 'engineer')) then d.real_value end
  from private.asset_rental_details_3r d
  where exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active);
$$;
revoke all on function public.set_asset_rental_details_3r(uuid, text, numeric), public.asset_rental_details_3r() from public, anon;
grant execute on function public.set_asset_rental_details_3r(uuid, text, numeric), public.asset_rental_details_3r() to authenticated;
select '3R pronto' as status;
