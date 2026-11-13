create or replace function public.admin_liberar_10a(p_veiculo bigint, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  motivo text := trim(coalesce(p_motivo, ''));
  ordem bigint;
begin
  if private.frota_pode_cadastrar_10a() is not true then raise exception 'gestao_required' using errcode='42501'; end if;
  if char_length(motivo) < 5 then raise exception 'motivo_obrigatorio' using errcode='22023'; end if;
  update private.frota_veiculos_10a set situacao='disponivel', liberado_dia=private.frota_hoje_10a()
    where id=p_veiculo and situacao='nao_liberado';
  if not found then raise exception 'veiculo_nao_esta_bloqueado' using errcode='22023'; end if;
  for ordem in
    update private.frota_manutencoes_10a set bloqueia=false
      where veiculo_id=p_veiculo and status='aberta' and bloqueia returning id
  loop
    perform private.frota_evento_10a(p_veiculo,'liberacao_os','Bloqueio retirado da OS ' || ordem || '. Motivo da liberação: ' || left(motivo,300),null,auth.uid());
  end loop;
  perform private.frota_evento_10a(p_veiculo,'liberado','Liberação do veículo: ' || left(motivo,300),null,auth.uid());
end $$;
