-- Marco 10D (TESTE ONLINE): frota mais fluida — aviso diário da Gestão, aviso de conserto ao funcionário, relatório do mês
-- e limpeza de fotos (PRONTA, porém DESLIGADA até o engenheiro dizer os prazos). Depende de 10A, 10B, 10C, 3U e 5C. Sem DROP/DELETE no começo de linha.

-- 1) Aviso do funcionário: novo tipo FROTA.
alter table private.avisos_funcionario_3u drop constraint if exists avisos_funcionario_3u_tipo_check,
  add constraint avisos_funcionario_3u_tipo_check check (tipo = any (array['PONTO', 'COMUNICADO', 'TROCA_EPI', 'PEDIDO_MATERIAL', 'ENTREGA_EPI', 'ITEM_PESSOAL', 'FECHAMENTO', 'CONTRACHEQUE', 'ATESTADO', 'FROTA']::text[]));

-- Conserto concluído: avisa quem informou o defeito (checklist com problema ou chegada com problema) naquela manutenção.
create or replace function private.coletar_avisos_frota_10d()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into private.avisos_funcionario_3u(employee_id, chave, tipo, titulo, corpo, url, expira_em)
  select q.employee_id, 'FROTA:' || m.id || ':' || q.employee_id, 'FROTA', 'Conserto concluído',
    left('A manutenção do ' || v.nome || ' que você avisou foi concluída. Obrigado por avisar!', 240), '/colaborador/frota', now() + interval '3 days'
  from private.frota_manutencoes_10a m
  join private.frota_veiculos_10a v on v.id = m.veiculo_id
  cross join lateral (
    select c.employee_id from private.frota_checklists_10a c
      where c.veiculo_id = m.veiculo_id and c.created_at between m.aberta_em - interval '2 minutes' and m.concluida_em
        and exists (select 1 from private.frota_respostas_10a r where r.checklist_id = c.id and r.situacao = 'N')
    union
    select t.employee_id from private.frota_viagens_10a t
      where t.veiculo_id = m.veiculo_id and t.problema is not null and t.chegada_em between m.aberta_em - interval '2 minutes' and m.concluida_em
  ) rep
  join private.quem_recebe_3u() q on q.employee_id = rep.employee_id
  where m.status = 'concluida' and m.origem in ('checklist', 'chegada') and m.concluida_em > now() - interval '1 day'
  on conflict (chave) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.coletar_avisos_frota_10d() from public, anon, authenticated, service_role;

-- 2) Aviso da manhã para a Gestão: caminhão sem checklist hoje, documento e preventiva vencidos/vencendo.
create table if not exists private.frota_avisos_10d (chave text primary key check (char_length(chave) <= 80), enviado_em timestamptz not null default now());
alter table private.frota_avisos_10d enable row level security;
revoke all on private.frota_avisos_10d from public, anon, authenticated, service_role;

create or replace function private.aviso_frota_10d(p_resumo boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare hoje date := private.frota_hoje_10a(); v_sem text[]; v_docs jsonb; v_planos jsonb; partes text[] := '{}'; v_nd int; v_np int;
begin
  -- Caminhão que está em uso ou rodou nos últimos 3 dias e ainda não teve checklist hoje.
  select array_agg(v.nome order by v.nome) into v_sem from private.frota_veiculos_10a v
   where v.ativo and v.situacao in ('disponivel', 'em_uso')
     and not exists (select 1 from private.frota_checklists_10a c where c.veiculo_id = v.id and c.dia = hoje)
     and (v.situacao = 'em_uso' or exists (select 1 from private.frota_viagens_10a t where t.veiculo_id = v.id and t.saida_em > now() - interval '3 days'));
  if v_sem is not null then
    partes := array_append(partes, 'Sem checklist hoje: ' || array_to_string(v_sem[1:3], ', ') || case when cardinality(v_sem) > 3 then ' e mais ' || (cardinality(v_sem) - 3) else '' end || '.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('chave', 'DOC:' || d.id || ':' || case when d.vencimento < hoje then 'v' else 'b' end, 'vencido', d.vencimento < hoje,
      'novo', not exists (select 1 from private.frota_avisos_10d x where x.chave = 'DOC:' || d.id || ':' || case when d.vencimento < hoje then 'v' else 'b' end and x.enviado_em > now() - interval '7 days'))), '[]'::jsonb)
    into v_docs from private.frota_documentos_10a d join private.frota_veiculos_10a v on v.id = d.veiculo_id
    where v.ativo and d.vencimento <= hoje + 30;
  select coalesce(jsonb_agg(jsonb_build_object('chave', 'PLANO:' || p.id, 'vencido', true,
      'novo', not exists (select 1 from private.frota_avisos_10d x where x.chave = 'PLANO:' || p.id and x.enviado_em > now() - interval '7 days'))), '[]'::jsonb)
    into v_planos from private.frota_planos_10a p join private.frota_veiculos_10a v on v.id = p.veiculo_id
    where v.ativo and p.ativo and private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual) = 'vencido';

  -- Na segunda vai o resumo completo; nos outros dias só o que é novo.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_docs from jsonb_array_elements(v_docs) e where p_resumo or (e->>'novo')::boolean;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_planos from jsonb_array_elements(v_planos) e where p_resumo or (e->>'novo')::boolean;
  v_nd := jsonb_array_length(v_docs); v_np := jsonb_array_length(v_planos);
  if v_nd > 0 then
    partes := array_append(partes, 'Documentos: ' || concat_ws(', ',
      case when exists (select 1 from jsonb_array_elements(v_docs) e where (e->>'vencido')::boolean) then (select count(*) from jsonb_array_elements(v_docs) e where (e->>'vencido')::boolean) || ' vencido(s)' end,
      case when exists (select 1 from jsonb_array_elements(v_docs) e where not (e->>'vencido')::boolean) then (select count(*) from jsonb_array_elements(v_docs) e where not (e->>'vencido')::boolean) || ' vencendo em 30 dias' end) || '.');
  end if;
  if v_np > 0 then partes := array_append(partes, 'Preventiva vencida: ' || v_np || '.'); end if;
  if cardinality(partes) = 0 then return null; end if;
  insert into private.frota_avisos_10d(chave) select e->>'chave' from (select * from jsonb_array_elements(v_docs) union all select * from jsonb_array_elements(v_planos)) t(e)
    on conflict (chave) do update set enviado_em = now();
  return jsonb_build_object('title', 'Frota · ' || case when p_resumo then 'resumo da semana' else 'bom dia' end, 'body', left(array_to_string(partes, ' '), 240), 'url', '/frota');
end $$;
revoke all on function private.aviso_frota_10d(boolean) from public, anon, authenticated, service_role;

-- 3) Relatório do mês, uma linha por caminhão.
create or replace function public.admin_frota_relatorio_10d(p_mes date)
returns table(veiculo_id bigint, nome text, placa text, saidas bigint, km_rodados bigint, checklists bigint, itens_com_problema bigint,
  defeitos_abertos bigint, manutencoes_concluidas bigint, dias_parado integer, custo numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v_ini date := date_trunc('month', coalesce(p_mes, private.frota_hoje_10a()))::date; v_fim date := (date_trunc('month', coalesce(p_mes, private.frota_hoje_10a())) + interval '1 month')::date;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select v.id, v.nome, v.placa,
      (select count(*) from private.frota_viagens_10a t where t.veiculo_id = v.id and (t.saida_em at time zone 'America/Fortaleza')::date >= v_ini and (t.saida_em at time zone 'America/Fortaleza')::date < v_fim),
      (select coalesce(sum(t.km_chegada - t.km_saida), 0)::bigint from private.frota_viagens_10a t where t.veiculo_id = v.id and t.km_chegada is not null
        and (t.saida_em at time zone 'America/Fortaleza')::date >= v_ini and (t.saida_em at time zone 'America/Fortaleza')::date < v_fim),
      (select count(*) from private.frota_checklists_10a c where c.veiculo_id = v.id and c.dia >= v_ini and c.dia < v_fim),
      (select count(*) from private.frota_respostas_10a r join private.frota_checklists_10a c on c.id = r.checklist_id where c.veiculo_id = v.id and c.dia >= v_ini and c.dia < v_fim and r.situacao = 'N'),
      (select count(*) from private.frota_manutencoes_10a m where m.veiculo_id = v.id and m.tipo = 'corretiva' and (m.aberta_em at time zone 'America/Fortaleza')::date >= v_ini and (m.aberta_em at time zone 'America/Fortaleza')::date < v_fim),
      (select count(*) from private.frota_manutencoes_10a m where m.veiculo_id = v.id and m.status = 'concluida' and (m.concluida_em at time zone 'America/Fortaleza')::date >= v_ini and (m.concluida_em at time zone 'America/Fortaleza')::date < v_fim),
      (select count(distinct g.dia)::int from private.frota_manutencoes_10a m
         cross join lateral (select gs::date dia from generate_series(greatest((m.aberta_em at time zone 'America/Fortaleza')::date, v_ini)::timestamp,
           least(coalesce((m.concluida_em at time zone 'America/Fortaleza')::date, private.frota_hoje_10a()), v_fim - 1)::timestamp, interval '1 day') gs) g
         where m.veiculo_id = v.id and m.bloqueia and m.status in ('aberta', 'na_oficina', 'concluida')),
      (select coalesce(sum(m.custo), 0) from private.frota_manutencoes_10a m where m.veiculo_id = v.id and m.status = 'concluida'
        and (m.concluida_em at time zone 'America/Fortaleza')::date >= v_ini and (m.concluida_em at time zone 'America/Fortaleza')::date < v_fim)
    from private.frota_veiculos_10a v where v.ativo or exists (select 1 from private.frota_viagens_10a t where t.veiculo_id = v.id and (t.saida_em at time zone 'America/Fortaleza')::date >= v_ini and (t.saida_em at time zone 'America/Fortaleza')::date < v_fim)
    order by v.nome;
end $$;

-- 4) Limpeza de fotos: PRONTA e DESLIGADA. Só vale com ativo = true e com os prazos preenchidos pelo engenheiro/administrador.
create table if not exists private.frota_retencao_10d (
  singleton boolean primary key default true check (singleton),
  ativo boolean not null default false,
  dias_fotos_soltas integer check (dias_fotos_soltas is null or dias_fotos_soltas between 1 and 3650),
  dias_fotos_defeito integer check (dias_fotos_defeito is null or dias_fotos_defeito between 1 and 3650),
  atualizado_em timestamptz not null default now()
);
insert into private.frota_retencao_10d(singleton) values (true) on conflict do nothing;
alter table private.frota_retencao_10d enable row level security;
revoke all on private.frota_retencao_10d from public, anon, authenticated, service_role;

-- Fotos que já podem sair. Soltas = nunca ligadas a checklist nem chegada. De defeito = ligadas, mais velhas que o prazo e SEM manutenção aberta no caminhão.
create or replace function private.fotos_expiradas_10d()
returns table(id uuid, caminho text, motivo text) language sql stable security definer set search_path = '' as $$
  with cfg as (select * from private.frota_retencao_10d where singleton and ativo)
  select f.id, f.caminho, case when f.checklist_id is null and f.viagem_id is null then 'solta' else 'defeito' end
  from private.frota_fotos_10b f cross join cfg
  where f.caminho is not null and (
    (f.checklist_id is null and f.viagem_id is null and cfg.dias_fotos_soltas is not null and f.created_at < now() - make_interval(days => cfg.dias_fotos_soltas))
    or ((f.checklist_id is not null or f.viagem_id is not null) and cfg.dias_fotos_defeito is not null and f.created_at < now() - make_interval(days => cfg.dias_fotos_defeito)
        and not exists (select 1 from private.frota_manutencoes_10a m where m.veiculo_id = f.veiculo_id and m.status in ('aberta', 'na_oficina'))))
  order by f.created_at limit 200;
$$;
create or replace function private.esquecer_foto_10d(p_id uuid) returns void language sql security definer set search_path = '' as $$ delete from private.frota_fotos_10b where id = p_id; $$;
revoke all on function private.fotos_expiradas_10d(), private.esquecer_foto_10d(uuid) from public, anon, authenticated, service_role;

revoke all on function public.admin_frota_relatorio_10d(date) from public, anon;
grant execute on function public.admin_frota_relatorio_10d(date) to authenticated;

-- 5) Agenda: conserto concluído a cada 5 minutos (direto no banco; o envio é o do avisos-funcionario) e aviso da manhã (09:00 em Fortaleza, seg–sáb).
select cron.schedule('metallo-frota-conserto-10d', '*/5 * * * *', $job$ select private.coletar_avisos_frota_10d(); $job$);
select cron.schedule('metallo-frota-manha-10d', '0 12 * * 1-6', $job$
  select net.http_post(
    url := 'https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/rotinas-frota-10d',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-metallo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_lembrete')),
    body := '{"acao":"avisos"}'::jsonb, timeout_milliseconds := 20000);
$job$);

select '10D pronto' as status;
