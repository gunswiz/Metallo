-- Fotos da oficina pertencem a uma OS; fotos do motorista continuam com vínculo pessoal obrigatório.
alter table private.frota_fotos_10b
  alter column employee_id drop not null,
  add column manutencao_id bigint references private.frota_manutencoes_10a(id),
  add column gestor_id uuid references public.profiles(id),
  add constraint frota_foto_origem_10m check (
    (employee_id is not null and manutencao_id is null and gestor_id is null)
    or (employee_id is null and manutencao_id is not null and gestor_id is not null
        and checklist_id is null and viagem_id is null and sha256 is not null));
create unique index frota_reparo_unico_10m on private.frota_fotos_10b(manutencao_id, gestor_id, sha256);

create function public.admin_reservar_foto_os_10m(p_veiculo bigint,p_ordem bigint,p_sha text)
returns table(foto_id uuid, pronta boolean) language plpgsql security definer set search_path='' as $$
declare autor uuid := auth.uid();
begin
  if autor is null or private.pode_atender_3t() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
  if p_sha is null or p_sha !~ '^[0-9a-f]{64}$' then raise exception 'pedido_invalido'; end if;
  perform 1 from private.frota_manutencoes_10a where id=p_ordem and veiculo_id=p_veiculo and status <> 'cancelada' for update;
  if not found then raise exception 'ordem_indisponivel'; end if;
  if not exists(select 1 from private.frota_fotos_10b where manutencao_id=p_ordem and gestor_id=autor and sha256=p_sha) then
    if (select count(*) from private.frota_fotos_10b where manutencao_id=p_ordem) >= 30 then raise exception 'muitos_envios'; end if;
    insert into private.frota_fotos_10b(veiculo_id,manutencao_id,gestor_id,sha256) values(p_veiculo,p_ordem,autor,p_sha);
  end if;
  return query select f.id,f.caminho is not null from private.frota_fotos_10b f where f.manutencao_id=p_ordem and f.gestor_id=autor and f.sha256=p_sha;
end $$;

create function public.admin_comprovantes_os_10m(p_veiculo bigint)
returns table(ordem bigint,foto uuid,em timestamptz,autor text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.pode_atender_3t() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
  return query select f.manutencao_id,f.id,f.created_at,p.full_name::text from private.frota_fotos_10b f
    join public.profiles p on p.id=f.gestor_id where f.veiculo_id=p_veiculo and f.manutencao_id is not null and f.caminho is not null
    order by f.created_at desc,f.id;
end $$;
revoke all on function public.admin_reservar_foto_os_10m(bigint,bigint,text), public.admin_comprovantes_os_10m(bigint) from public,anon,service_role;
grant execute on function public.admin_reservar_foto_os_10m(bigint,bigint,text), public.admin_comprovantes_os_10m(bigint) to authenticated;
