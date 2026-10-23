-- Marco 10C (TESTE ONLINE): defeito informado vira relato na manutenção (com fotos), alerta na Gestão e aviso no celular.
-- Depende do 10A e do 10B. Sem DROP/DELETE.

alter table private.frota_viagens_10a add column if not exists problema text check (problema is null or char_length(problema) <= 250);

create or replace function public.create_chegada_10a(p_viagem bigint, p_km integer, p_problema text, p_obs text, p_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_t private.frota_viagens_10a%rowtype; v_prob text := trim(coalesce(p_problema, ''));
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  if exists (select 1 from private.frota_viagens_10a t where t.chave_chegada = p_key and t.employee_id = v_emp) then return; end if;
  select * into v_t from private.frota_viagens_10a t where t.id = p_viagem and t.employee_id = v_emp and t.chegada_em is null for update;
  if not found then raise exception 'viagem_nao_encontrada' using errcode = '22023'; end if;
  if p_km is null or p_km < v_t.km_saida or p_km > 3000000 then raise exception 'km_menor_que_saida' using errcode = '22023'; end if;
  if v_prob <> '' and char_length(v_prob) < 3 then raise exception 'descreva_o_problema' using errcode = '22023'; end if;
  update private.frota_viagens_10a t set chegada_em = now(), km_chegada = p_km, obs_chegada = nullif(left(trim(coalesce(p_obs, '')), 200), ''), chave_chegada = p_key,
    problema = nullif(left(v_prob, 250), '') where t.id = p_viagem;
  update private.frota_veiculos_10a v set situacao = 'disponivel', km_atual = p_km where v.id = v_t.veiculo_id;
  perform private.frota_evento_10a(v_t.veiculo_id, 'chegada', 'Chegou de ' || v_t.destino || ' com ' || p_km || ' km.', v_emp, null);
  if v_prob <> '' then
    perform private.frota_abrir_automatica_10a(v_t.veiculo_id, 'chegada', 'Problema informado na chegada: ' || left(v_prob, 250), null, true);
    update private.frota_veiculos_10a v set situacao = 'nao_liberado' where v.id = v_t.veiculo_id;
    perform private.frota_evento_10a(v_t.veiculo_id, 'problema_chegada', 'Problema informado na chegada: ' || v_prob, v_emp, null);
  else
    perform private.frota_recalcula_10a(v_t.veiculo_id);
  end if;
end $$;


-- Relatos dos funcionários ligados a cada manutenção aberta por defeito (checklist ou chegada), com as fotos.
create or replace function public.admin_frota_relatos_10c(p_veiculo bigint) returns table(manutencao_id bigint, relatos jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select m.id, coalesce((select jsonb_agg(to_jsonb(x) order by x.quando desc) from (
      select k.created_at as quando, 'checklist'::text as tipo, e.full_name as por,
        (select jsonb_agg(jsonb_build_object('item', i.nome, 'obs', rp.obs, 'critico', rp.critico,
            'foto', (select f.id from private.frota_fotos_10b f where f.checklist_id = k.id and f.codigo = rp.codigo and f.caminho is not null)) order by rp.codigo)
          from private.frota_respostas_10a rp join private.frota_itens_10a i on i.codigo = rp.codigo where rp.checklist_id = k.id and rp.situacao = 'N') as itens,
        null::text as problema, null::uuid as foto
      from private.frota_checklists_10a k join public.epi_employees e on e.id = k.employee_id
      where k.veiculo_id = m.veiculo_id and k.resultado <> 'liberado' and k.created_at >= m.aberta_em and (m.concluida_em is null or k.created_at <= m.concluida_em)
      union all
      select t.chegada_em, 'chegada'::text, e.full_name, null::jsonb, t.problema,
        (select f.id from private.frota_fotos_10b f where f.viagem_id = t.id and f.caminho is not null)
      from private.frota_viagens_10a t join public.epi_employees e on e.id = t.employee_id
      where t.veiculo_id = m.veiculo_id and t.problema is not null and t.chegada_em >= m.aberta_em and (m.concluida_em is null or t.chegada_em <= m.concluida_em)
    ) x), '[]'::jsonb)
    from private.frota_manutencoes_10a m
    where m.veiculo_id = p_veiculo and m.origem in ('checklist', 'chegada');
end $$;

-- Pontos de atenção: agora também "defeito informado" (manutenção aberta por checklist ou chegada que ainda não foi para a oficina).
create or replace function public.admin_frota_atencao_10a() returns table(veiculo_id bigint, nome text, tipo text, texto text, gravidade text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select v.id, v.nome, 'defeito'::text, left(m.descricao, 200), case when m.bloqueia then 'vencido' else 'breve' end
    from private.frota_manutencoes_10a m join private.frota_veiculos_10a v on v.id = m.veiculo_id
    where v.ativo and m.origem in ('checklist', 'chegada') and m.status = 'aberta'
    union all
    select v.id, v.nome, 'documento'::text,
      case d.tipo when 'crlv' then 'CRLV' when 'seguro' then 'Seguro' when 'inspecao_guindaste' then 'Inspeção do guindaste' else coalesce(nullif(d.descricao, ''), 'Documento') end
        || case when d.vencimento < private.frota_hoje_10a() then ' vencido há ' || (private.frota_hoje_10a() - d.vencimento) || ' dia(s)' else ' vence em ' || (d.vencimento - private.frota_hoje_10a()) || ' dia(s)' end,
      case when d.vencimento < private.frota_hoje_10a() then 'vencido' else 'breve' end
    from private.frota_documentos_10a d join private.frota_veiculos_10a v on v.id = d.veiculo_id
    where v.ativo and d.vencimento <= private.frota_hoje_10a() + 30
    union all
    select v.id, v.nome, 'plano'::text, p.descricao || case private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual) when 'vencido' then ' — vencida' else ' — chegando' end,
      private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual)
    from private.frota_planos_10a p join private.frota_veiculos_10a v on v.id = p.veiculo_id
    where v.ativo and p.ativo and private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual) in ('vencido', 'breve')
    union all
    select v.id, v.nome, 'situacao'::text, case v.situacao when 'nao_liberado' then 'Não liberado: precisa de conserto ou liberação do engenheiro' else 'Na oficina' end, 'vencido'
    from private.frota_veiculos_10a v where v.ativo and v.situacao in ('nao_liberado', 'manutencao')
    order by 5, 2, 3;
end $$;

-- Aviso no celular da Gestão: a Edge Function chama isto COMO O FUNCIONÁRIO logo depois de ele informar um defeito.
-- Só devolve algo se a própria pessoa informou defeito neste caminhão nos últimos 15 minutos e ainda não houve aviso (evita repetir).
create or replace function public.avisar_defeito_frota_10c(p_veiculo bigint) returns table(veiculo text, quem text, resumo text, bloqueado boolean)
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_nome text; v_quem text; v_resumo text; v_bloq boolean;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select v.nome into v_nome from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo;
  if v_nome is null then return; end if;
  if exists (select 1 from private.frota_eventos_10a ev where ev.veiculo_id = p_veiculo and ev.employee_id = v_emp and ev.tipo = 'aviso_defeito' and ev.em > now() - interval '15 minutes') then return; end if;
  select e.full_name into v_quem from public.epi_employees e where e.id = v_emp;
  select string_agg(i.nome, ', ' order by i.codigo), coalesce(bool_or(rp.critico), false) into v_resumo, v_bloq
    from private.frota_checklists_10a k join private.frota_respostas_10a rp on rp.checklist_id = k.id and rp.situacao = 'N' join private.frota_itens_10a i on i.codigo = rp.codigo
    where k.veiculo_id = p_veiculo and k.employee_id = v_emp and k.created_at > now() - interval '15 minutes';
  if v_resumo is null then
    select t.problema, true into v_resumo, v_bloq from private.frota_viagens_10a t
      where t.veiculo_id = p_veiculo and t.employee_id = v_emp and t.problema is not null and t.chegada_em > now() - interval '15 minutes' order by t.chegada_em desc limit 1;
  end if;
  if v_resumo is null then return; end if;
  perform private.frota_evento_10a(p_veiculo, 'aviso_defeito', 'Gestão avisada do defeito informado.', v_emp, null);
  return query select v_nome, v_quem, left(v_resumo, 140), v_bloq;
end $$;

revoke all on function public.admin_frota_relatos_10c(bigint), public.admin_frota_atencao_10a(), public.avisar_defeito_frota_10c(bigint),
  public.create_chegada_10a(bigint, integer, text, text, uuid) from public, anon;
grant execute on function public.admin_frota_relatos_10c(bigint), public.admin_frota_atencao_10a(), public.avisar_defeito_frota_10c(bigint),
  public.create_chegada_10a(bigint, integer, text, text, uuid) to authenticated;

select '10C pronto' as status;
