-- Marco 4L (complemento, 11/10): percentuais de hora extra da EMPRESA. Informado pelo responsável: a empresa paga 60%.
-- Domingo/feriado trabalhado sem folga: 100% (em dobro) até a empresa informar outro valor.
create table if not exists private.percentuais_dp_4l (
  singleton boolean primary key default true check (singleton),
  extra integer not null default 60 check (extra between 50 and 200),
  domingo_feriado integer not null default 100 check (domingo_feriado between 100 and 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table private.percentuais_dp_4l enable row level security;
revoke all on private.percentuais_dp_4l from public, anon, authenticated, service_role;
insert into private.percentuais_dp_4l(singleton, extra, domingo_feriado) values (true, 60, 100) on conflict (singleton) do nothing;

create or replace function public.percentuais_dp_4l() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  return coalesce((select jsonb_build_object('extra', p.extra, 'domingo_feriado', p.domingo_feriado) from private.percentuais_dp_4l p), '{"extra":60,"domingo_feriado":100}'::jsonb);
end $$;
create or replace function public.admin_set_percentuais_dp_4l(p_extra integer, p_domingo_feriado integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  -- Lei: hora extra no mínimo 50% (CF art. 7º XVI); domingo/feriado sem folga, no mínimo em dobro.
  if p_extra is null or p_extra not between 50 and 200 or p_domingo_feriado is null or p_domingo_feriado not between 100 and 300 then
    raise exception 'percentual_invalido' using errcode = '22023'; end if;
  insert into private.percentuais_dp_4l(singleton, extra, domingo_feriado, updated_by) values (true, p_extra, p_domingo_feriado, (select auth.uid()))
  on conflict (singleton) do update set extra = excluded.extra, domingo_feriado = excluded.domingo_feriado, updated_at = now(), updated_by = excluded.updated_by;
end $$;
revoke all on function public.percentuais_dp_4l(), public.admin_set_percentuais_dp_4l(integer, integer) from public, anon;
grant execute on function public.percentuais_dp_4l(), public.admin_set_percentuais_dp_4l(integer, integer) to authenticated;
