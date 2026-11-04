CREATE OR REPLACE FUNCTION public.admin_frota_ficha_10a(p_veiculo bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_v private.frota_veiculos_10a%rowtype;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select * into v_v from private.frota_veiculos_10a v where v.id = p_veiculo;
  if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  return jsonb_build_object(
    'veiculo', jsonb_build_object('id', v_v.id, 'nome', v_v.nome, 'placa', v_v.placa, 'modelo', v_v.modelo, 'ano', v_v.ano, 'situacao', v_v.situacao, 'km_atual', v_v.km_atual, 'ativo', v_v.ativo),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'descricao', d.descricao, 'numero', d.numero, 'vencimento', d.vencimento) order by d.vencimento)
      from private.frota_documentos_10a d where d.veiculo_id = p_veiculo), '[]'::jsonb),
    'planos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'descricao', p.descricao, 'cada_km', p.cada_km, 'cada_dias', p.cada_dias, 'ultimo_km', p.ultimo_km, 'ultima_data', p.ultima_data, 'ativo', p.ativo,
        'situacao', private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v_v.km_atual)) order by p.id)
      from private.frota_planos_10a p where p.veiculo_id = p_veiculo), '[]'::jsonb),
    'manutencoes', coalesce((select jsonb_agg(to_jsonb(x) order by x.aberta_em desc) from (
      select m.id, m.tipo, m.descricao, m.origem, m.status, m.bloqueia, m.aberta_em, m.oficina, m.enviada_em, m.previsao, m.concluida_em, m.km, m.custo, m.obs
      from private.frota_manutencoes_10a m where m.veiculo_id = p_veiculo order by m.aberta_em desc limit 60) x), '[]'::jsonb),
    'viagens', coalesce((select jsonb_agg(to_jsonb(x) order by x.saida_em desc) from (
      select t.id, e.full_name as motorista, t.destino, t.acompanhantes, t.saida_em, t.km_saida, t.chegada_em, t.km_chegada, t.obs_saida, t.obs_chegada
      from private.frota_viagens_10a t join public.epi_employees e on e.id = t.employee_id where t.veiculo_id = p_veiculo order by t.saida_em desc limit 40) x), '[]'::jsonb),
    'checklists', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select k.id, k.dia, k.resultado, e.full_name as por, k.local, k.observacoes, k.created_at,
        (select count(*)::int from private.frota_respostas_10a r where r.checklist_id = k.id and r.situacao = 'N') as itens_nao_conformes
      from private.frota_checklists_10a k join public.epi_employees e on e.id = k.employee_id where k.veiculo_id = p_veiculo order by k.created_at desc limit 30) x), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(to_jsonb(x) order by x.em desc) from (
      select ev.tipo, case when ev.tipo = 'liberado' then regexp_replace(ev.texto, '^Liberado pelo engenheiro: ', 'Liberação do veículo: ') else ev.texto end as texto,
        ev.em, coalesce(e.full_name, gestor.full_name) as pessoa
      from private.frota_eventos_10a ev left join public.epi_employees e on e.id = ev.employee_id
      left join public.profiles gestor on gestor.id = ev.user_id
      where ev.veiculo_id = p_veiculo order by ev.em desc limit 40) x), '[]'::jsonb)
  );
end $function$;
