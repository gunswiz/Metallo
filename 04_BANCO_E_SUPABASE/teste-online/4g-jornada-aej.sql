-- Marco 4G (TESTE ONLINE): jornada padrão da empresa (horário contratual), usada no espelho e no AEJ.
-- Informada pelo responsável em 09/10/2026: seg–qui 07:00–12:00 / 13:00–17:00; sex 07:00–12:00 / 13:00–16:00 (44 h/semana).
create table if not exists private.jornada_4g (
  singleton boolean primary key default true check (singleton),
  dias jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table private.jornada_4g enable row level security;
revoke all on private.jornada_4g from public, anon, authenticated, service_role;
alter table private.empregador_4f add column if not exists desenvolvedor_email text check (desenvolvedor_email is null or desenvolvedor_email ~ '^[^@\s]{1,40}@[^@\s]{1,40}$');

-- Formato: {"1":["07:00","12:00","13:00","17:00"], ..., "7":[]} — 1 = segunda … 7 = domingo; pares entrada/saída em ordem.
create or replace function private.jornada_valida_4g(p jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare d int; v jsonb; h text; anterior text;
begin
  if jsonb_typeof(p) <> 'object' then return false; end if;
  for d in 1..7 loop
    v := p -> d::text;
    if v is null or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) % 2 = 1 or jsonb_array_length(v) > 8 then return false; end if;
    anterior := null;
    for h in select jsonb_array_elements_text(v) loop
      if h !~ '^([01]\d|2[0-3]):[0-5]\d$' or (anterior is not null and h <= anterior) then return false; end if;
      anterior := h;
    end loop;
  end loop;
  return (select count(*) from jsonb_object_keys(p)) = 7;
end $$;
alter table private.jornada_4g drop constraint if exists jornada_4g_dias_validos;
alter table private.jornada_4g add constraint jornada_4g_dias_validos check (private.jornada_valida_4g(dias));

-- Leitura: qualquer pessoa logada (Gestão ou app) — não tem dado pessoal.
create or replace function public.jornada_padrao_4g() returns jsonb language sql stable security definer set search_path = '' as $$
  select dias from private.jornada_4g where singleton and (select auth.uid()) is not null;
$$;
create or replace function public.admin_set_jornada_4g(p_dias jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if not private.jornada_valida_4g(p_dias) then raise exception 'jornada_invalida' using errcode = '22023'; end if;
  insert into private.jornada_4g(singleton, dias, updated_by) values (true, p_dias, (select auth.uid()))
  on conflict (singleton) do update set dias = excluded.dias, updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke all on function public.jornada_padrao_4g(), public.admin_set_jornada_4g(jsonb) from public, anon;
grant execute on function public.jornada_padrao_4g(), public.admin_set_jornada_4g(jsonb) to authenticated;
revoke all on function private.jornada_valida_4g(jsonb) from public, anon, authenticated;

insert into private.jornada_4g(singleton, dias) values (true, '{"1":["07:00","12:00","13:00","17:00"],"2":["07:00","12:00","13:00","17:00"],"3":["07:00","12:00","13:00","17:00"],"4":["07:00","12:00","13:00","17:00"],"5":["07:00","12:00","13:00","16:00"],"6":[],"7":[]}')
on conflict (singleton) do nothing;
update private.empregador_4f set desenvolvedor_email = 'teste@metallo.invalid' where singleton and desenvolvedor_email is null;
select '4G pronto' as status;
