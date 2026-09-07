begin;

-- Equipment rental data used to be serialized inside assets.notes so the
-- first mobile versions could ship without a schema change. Keep that legacy
-- payload for installed clients, but make normalized columns the source of
-- truth and expose the user's observation separately.
alter table public.assets
  add column if not exists ownership_type text not null default 'owned',
  add column if not exists rental_company text,
  add column if not exists rental_start_date date,
  add column if not exists rental_end_date date,
  add column if not exists user_notes text;

alter table public.assets
  drop constraint if exists assets_ownership_type_check,
  add constraint assets_ownership_type_check
    check (ownership_type in ('owned', 'rented')),
  drop constraint if exists assets_rental_dates_check,
  add constraint assets_rental_dates_check
    check (
      rental_end_date is null
      or rental_start_date is null
      or rental_end_date >= rental_start_date
    );

create index if not exists assets_active_ownership_created_idx
  on public.assets(ownership_type, created_at desc) where active;
create index if not exists movements_consumption_created_team_idx
  on public.movements(created_at desc, origin_team_id)
  where movement_type = 'consumption';

create or replace function public.asset_visible_notes(p_notes text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(string_agg(line, E'\n' order by ordinal)),
    ''
  )
  from regexp_split_to_table(coalesce(p_notes, ''), E'\r?\n')
       with ordinality as lines(line, ordinal)
  where line !~ '^#metallo:(ownership|rental_company|rental_start|rental_end)='
$$;

create or replace function public.asset_legacy_decode(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(coalesce(p_value, ''), '%20', ' '),
            '%26', '&'
          ),
          '%2F', '/'
        ),
        '%3A', ':'
      ),
      '%23', '#'
    ),
    '%25', '%'
  )
$$;

create or replace function public.asset_legacy_encode(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(
    replace(
      replace(
        replace(
          replace(
            replace(regexp_replace(btrim(coalesce(p_value, '')), E'[\r\n]+', ' ', 'g'), '%', '%25'),
            ' ', '%20'
          ),
          '&', '%26'
        ),
        '/', '%2F'
      ),
      ':', '%3A'
    ),
    '#', '%23'
  )
$$;

revoke all on function public.asset_visible_notes(text) from public, anon, authenticated;
revoke all on function public.asset_legacy_decode(text) from public, anon, authenticated;
revoke all on function public.asset_legacy_encode(text) from public, anon, authenticated;

update public.assets
set ownership_type = case
      when coalesce(notes, '') ~ '(?m)^#metallo:ownership=rented$' then 'rented'
      else 'owned'
    end,
    rental_company = case
      when coalesce(notes, '') ~ '(?m)^#metallo:ownership=rented$'
      then nullif(public.asset_legacy_decode(substring(notes from '(?m)^#metallo:rental_company=([^\r\n]*)$')), '')
      else null
    end,
    rental_start_date = case
      when substring(coalesce(notes, '') from '(?m)^#metallo:rental_start=([0-9]{4})[-/]([0-9]{2})[-/]([0-9]{2})$') is not null
      then replace(substring(notes from '(?m)^#metallo:rental_start=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$'), '/', '-')::date
      else null
    end,
    rental_end_date = case
      when substring(coalesce(notes, '') from '(?m)^#metallo:rental_end=([0-9]{4})[-/]([0-9]{2})[-/]([0-9]{2})$') is not null
      then replace(substring(notes from '(?m)^#metallo:rental_end=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$'), '/', '-')::date
      else null
    end,
    user_notes = public.asset_visible_notes(notes)
where user_notes is null;

create or replace function public.sync_asset_legacy_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company text;
  v_start text;
  v_end text;
begin
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes then
    return new;
  end if;

  if coalesce(new.notes, '') ~ '(?m)^#metallo:ownership=' then
    new.ownership_type := case
      when new.notes ~ '(?m)^#metallo:ownership=rented$' then 'rented'
      else 'owned'
    end;
    v_company := substring(new.notes from '(?m)^#metallo:rental_company=([^\r\n]*)$');
    v_start := substring(new.notes from '(?m)^#metallo:rental_start=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$');
    v_end := substring(new.notes from '(?m)^#metallo:rental_end=([0-9]{4}[-/][0-9]{2}[-/][0-9]{2})$');
    new.rental_company := case when new.ownership_type = 'rented'
      then nullif(public.asset_legacy_decode(v_company), '') else null end;
    new.rental_start_date := case when v_start is null then null
      else replace(v_start, '/', '-')::date end;
    new.rental_end_date := case when v_end is null then null
      else replace(v_end, '/', '-')::date end;
    new.user_notes := public.asset_visible_notes(new.notes);
  elsif new.user_notes is null then
    new.user_notes := nullif(btrim(new.notes), '');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_asset_legacy_metadata() from public, anon, authenticated;
drop trigger if exists sync_asset_legacy_metadata on public.assets;
create trigger sync_asset_legacy_metadata
before insert or update of notes on public.assets
for each row execute function public.sync_asset_legacy_metadata();

create or replace function public.create_equipment_for_team_v2(
  p_code text,
  p_name text,
  p_asset_code text,
  p_serial_number text default null,
  p_description text default null,
  p_category text default null,
  p_team_id uuid default null,
  p_user_notes text default null,
  p_ownership_type text default 'owned',
  p_rental_company text default null,
  p_rental_start_date date default null,
  p_rental_end_date date default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_user_team uuid;
  v_item_id uuid;
  v_asset_id uuid;
  v_visible_notes text := public.asset_visible_notes(p_user_notes);
  v_legacy_notes text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select role, team_id into v_role, v_user_team
  from public.profiles where id = v_user_id and active;
  if not found then raise exception 'inactive_or_missing_profile'; end if;
  if v_role not in ('admin', 'engineer', 'leader') then raise exception 'forbidden_role'; end if;
  if p_team_id is null then raise exception 'team_required'; end if;
  if v_role = 'leader' and p_team_id is distinct from v_user_team then raise exception 'forbidden_team'; end if;
  if nullif(trim(p_code), '') is null
     or nullif(trim(p_name), '') is null
     or nullif(trim(p_asset_code), '') is null then
    raise exception 'code_name_asset_required';
  end if;
  if p_ownership_type not in ('owned', 'rented') then raise exception 'invalid_ownership_type'; end if;
  if p_ownership_type = 'rented' and nullif(trim(p_rental_company), '') is null then
    raise exception 'rental_company_required';
  end if;
  if p_rental_end_date is not null and p_rental_start_date is not null
     and p_rental_end_date < p_rental_start_date then raise exception 'invalid_rental_dates'; end if;
  if not exists(select 1 from public.teams where id = p_team_id and active) then raise exception 'invalid_team'; end if;

  select id into v_item_id from public.items
  where lower(code) = lower(trim(p_code)) and active and item_type = 'equipment'
  limit 1;
  if v_item_id is null then
    insert into public.items(code, name, description, category, item_type, unit, minimum_stock, active)
    values(trim(p_code), trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_category), ''), 'equipment', 'un', 0, true)
    returning id into v_item_id;
  end if;

  v_legacy_notes := '#metallo:ownership=' || p_ownership_type;
  if p_ownership_type = 'rented' then
    v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_company=' || public.asset_legacy_encode(p_rental_company);
    if p_rental_start_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_start=' || p_rental_start_date::text; end if;
    if p_rental_end_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_end=' || p_rental_end_date::text; end if;
  end if;
  if v_visible_notes is not null then v_legacy_notes := v_legacy_notes || E'\n' || v_visible_notes; end if;

  insert into public.assets(
    item_id, asset_code, serial_number, team_id, status, notes, user_notes,
    ownership_type, rental_company, rental_start_date, rental_end_date, active
  ) values (
    v_item_id, trim(p_asset_code), nullif(trim(p_serial_number), ''), p_team_id,
    'available', v_legacy_notes, v_visible_notes, p_ownership_type,
    case when p_ownership_type = 'rented' then trim(p_rental_company) else null end,
    case when p_ownership_type = 'rented' then p_rental_start_date else null end,
    case when p_ownership_type = 'rented' then p_rental_end_date else null end,
    true
  ) returning id into v_asset_id;

  insert into public.asset_movements(
    asset_id, origin_team_id, destination_team_id, previous_status,
    new_status, movement_type, note, performed_by
  ) values (
    v_asset_id, null, p_team_id, 'available', 'available', 'assign',
    'Cadastro inicial', v_user_id
  );
  return v_asset_id;
end;
$$;

revoke all on function public.create_equipment_for_team_v2(
  text, text, text, text, text, text, uuid, text, text, text, date, date
) from public, anon;
grant execute on function public.create_equipment_for_team_v2(
  text, text, text, text, text, text, uuid, text, text, text, date, date
) to authenticated;

create or replace function public.update_equipment_admin_v2(
  p_item_id uuid,
  p_item_code text,
  p_item_name text,
  p_asset_id uuid,
  p_asset_code text,
  p_serial_number text,
  p_team_id uuid,
  p_status text,
  p_user_notes text,
  p_ownership_type text,
  p_rental_company text default null,
  p_rental_start_date date default null,
  p_rental_end_date date default null,
  p_active boolean default true
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visible_notes text := public.asset_visible_notes(p_user_notes);
  v_legacy_notes text;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_item_code), '') is null
     or nullif(trim(p_item_name), '') is null
     or nullif(trim(p_asset_code), '') is null then raise exception 'required_equipment_field'; end if;
  if p_status not in ('available', 'in_use', 'maintenance', 'damaged', 'lost', 'retired') then raise exception 'invalid_asset_status'; end if;
  if p_ownership_type not in ('owned', 'rented') then raise exception 'invalid_ownership_type'; end if;
  if p_ownership_type = 'rented' and nullif(trim(p_rental_company), '') is null then raise exception 'rental_company_required'; end if;
  if p_rental_end_date is not null and p_rental_start_date is not null
     and p_rental_end_date < p_rental_start_date then raise exception 'invalid_rental_dates'; end if;
  if not exists(select 1 from public.teams where id = p_team_id and active) then raise exception 'invalid_team'; end if;

  update public.items set code = trim(p_item_code), name = trim(p_item_name), updated_at = now()
  where id = p_item_id and item_type = 'equipment' and active;
  if not found then raise exception 'item_not_found'; end if;

  v_legacy_notes := '#metallo:ownership=' || p_ownership_type;
  if p_ownership_type = 'rented' then
    v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_company=' || public.asset_legacy_encode(p_rental_company);
    if p_rental_start_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_start=' || p_rental_start_date::text; end if;
    if p_rental_end_date is not null then v_legacy_notes := v_legacy_notes || E'\n#metallo:rental_end=' || p_rental_end_date::text; end if;
  end if;
  if v_visible_notes is not null then v_legacy_notes := v_legacy_notes || E'\n' || v_visible_notes; end if;

  update public.assets set
    asset_code = trim(p_asset_code),
    serial_number = nullif(trim(coalesce(p_serial_number, '')), ''),
    team_id = p_team_id,
    status = p_status,
    notes = v_legacy_notes,
    user_notes = v_visible_notes,
    ownership_type = p_ownership_type,
    rental_company = case when p_ownership_type = 'rented' then trim(p_rental_company) else null end,
    rental_start_date = case when p_ownership_type = 'rented' then p_rental_start_date else null end,
    rental_end_date = case when p_ownership_type = 'rented' then p_rental_end_date else null end,
    active = coalesce(p_active, true),
    updated_at = now()
  where id = p_asset_id and item_id = p_item_id;
  if not found then raise exception 'asset_not_found'; end if;
end;
$$;

revoke all on function public.update_equipment_admin_v2(
  uuid, text, text, uuid, text, text, uuid, text, text, text, text, date, date, boolean
) from public, anon;
grant execute on function public.update_equipment_admin_v2(
  uuid, text, text, uuid, text, text, uuid, text, text, text, text, date, date, boolean
) to authenticated;

create or replace function public.return_rented_equipment(p_asset_id uuid, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.assets%rowtype;
  v_note text := public.asset_visible_notes(p_note);
begin
  if auth.uid() is null or not public.is_active_admin() then raise exception 'admin_required'; end if;
  select * into a from public.assets where id = p_asset_id and active for update;
  if not found then raise exception 'invalid_or_inactive_asset'; end if;
  if a.ownership_type <> 'rented' then raise exception 'rented_equipment_required'; end if;
  insert into public.asset_movements(
    asset_id, origin_team_id, destination_team_id, previous_status,
    new_status, movement_type, note, performed_by
  ) values (
    a.id, a.team_id, a.team_id, a.status, 'retired', 'rental_return',
    'Devolução à locadora' || coalesce(': ' || v_note, ''), auth.uid()
  );
  update public.assets set
    active = false,
    status = 'retired',
    updated_at = now(),
    user_notes = concat_ws(E'\n', a.user_notes, 'Devolvido à locadora em ' || current_date::text || coalesce(': ' || v_note, '')),
    notes = concat_ws(E'\n', a.notes, 'Devolvido à locadora em ' || current_date::text || coalesce(': ' || v_note, ''))
  where id = a.id;
end;
$$;

revoke all on function public.return_rented_equipment(uuid, text) from public, anon;
grant execute on function public.return_rented_equipment(uuid, text) to authenticated;

create or replace function public.create_epi_item_with_stock(
  p_code text,
  p_name text,
  p_item_kind text,
  p_unit text,
  p_ca_number text default null,
  p_brand_model text default null,
  p_minimum_stock integer default 0,
  p_return_policy text default 'returnable',
  p_initial_quantity integer default 0,
  p_variant text default null,
  p_lot_number text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item_id uuid;
begin
  if not public.is_active_admin() then raise exception 'admin_required'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null
     or nullif(trim(p_unit), '') is null then raise exception 'required_epi_field'; end if;
  if p_item_kind not in ('epi', 'uniform', 'personal_tool') then raise exception 'invalid_epi_kind'; end if;
  if p_return_policy not in ('returnable', 'personal', 'uniform') then raise exception 'invalid_return_policy'; end if;
  if p_minimum_stock < 0 or p_initial_quantity < 0 then raise exception 'invalid_quantity'; end if;

  insert into public.epi_items(
    code, name, item_kind, unit, ca_number, brand_model,
    minimum_stock, return_policy, active, created_by
  ) values (
    trim(p_code), trim(p_name), p_item_kind, trim(p_unit),
    case when p_item_kind = 'epi' then nullif(trim(p_ca_number), '') else null end,
    nullif(trim(p_brand_model), ''), p_minimum_stock, p_return_policy,
    true, auth.uid()
  ) returning id into v_item_id;

  if p_initial_quantity > 0 then
    insert into public.epi_stock_batches(
      item_id, quantity, variant, ca_number, brand_model,
      lot_number, created_by
    ) values (
      v_item_id, p_initial_quantity, nullif(trim(p_variant), ''),
      case when p_item_kind = 'epi' then nullif(trim(p_ca_number), '') else null end,
      nullif(trim(p_brand_model), ''), nullif(trim(p_lot_number), ''), auth.uid()
    );
  end if;
  return v_item_id;
end;
$$;

revoke all on function public.create_epi_item_with_stock(
  text, text, text, text, text, text, integer, text, integer, text, text
) from public, anon;
grant execute on function public.create_epi_item_with_stock(
  text, text, text, text, text, text, integer, text, integer, text, text
) to authenticated;

commit;
