-- Marco 10A (TESTE ONLINE): frota de caminhões munck.
-- Cadastro e documentos com vencimento, saída e chegada, checklist diário (26 itens da planilha METALLO-ENG-01),
-- manutenção (corretiva e preventiva por plano) e histórico por caminhão. Sem localização por GPS.
-- Depende do 3T (private.funcionario_do_app_3t e private.pode_atender_3t). Sem DROP/DELETE.

create table if not exists private.frota_veiculos_10a (
  id bigint generated always as identity primary key,
  placa text not null unique check (placa ~ '^[A-Z0-9]{7}$'),
  nome text not null check (char_length(nome) between 2 and 60),
  modelo text check (modelo is null or char_length(modelo) <= 60),
  ano smallint check (ano is null or ano between 1980 and 2100),
  km_atual integer not null default 0 check (km_atual between 0 and 3000000),
  situacao text not null default 'disponivel' check (situacao in ('disponivel', 'em_uso', 'nao_liberado', 'manutencao')),
  liberado_dia date,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists private.frota_documentos_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  tipo text not null check (tipo in ('crlv', 'seguro', 'inspecao_guindaste', 'outro')),
  descricao text not null default '' check (char_length(descricao) <= 60),
  numero text check (numero is null or char_length(numero) <= 60),
  vencimento date not null,
  updated_at timestamptz not null default now(),
  unique (veiculo_id, tipo, descricao)
);

create table if not exists private.frota_itens_10a (
  codigo smallint primary key check (codigo between 1 and 99),
  nome text not null check (char_length(nome) between 2 and 80),
  critico boolean not null default false,
  ativo boolean not null default true
);

create table if not exists private.frota_checklists_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  employee_id uuid not null references public.epi_employees(id),
  dia date not null,
  local text check (local is null or char_length(local) <= 80),
  observacoes text check (observacoes is null or char_length(observacoes) <= 300),
  resultado text not null check (resultado in ('liberado', 'ressalvas', 'nao_liberado')),
  ciente boolean not null check (ciente),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);
create index if not exists frota_checklists_10a_dia on private.frota_checklists_10a(veiculo_id, dia);

create table if not exists private.frota_respostas_10a (
  checklist_id bigint not null references private.frota_checklists_10a(id),
  codigo smallint not null references private.frota_itens_10a(codigo),
  situacao text not null check (situacao in ('C', 'N', 'NA')),
  obs text check (obs is null or char_length(obs) <= 200),
  critico boolean not null default false,
  primary key (checklist_id, codigo)
);

create table if not exists private.frota_viagens_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  employee_id uuid not null references public.epi_employees(id),
  destino text not null check (char_length(destino) between 2 and 120),
  acompanhantes text check (acompanhantes is null or char_length(acompanhantes) <= 120),
  saida_em timestamptz not null default now(),
  km_saida integer not null check (km_saida >= 0),
  obs_saida text check (obs_saida is null or char_length(obs_saida) <= 200),
  chegada_em timestamptz,
  km_chegada integer check (km_chegada is null or km_chegada >= 0),
  obs_chegada text check (obs_chegada is null or char_length(obs_chegada) <= 200),
  chave_saida uuid not null unique,
  chave_chegada uuid unique,
  check (km_chegada is null or km_chegada >= km_saida)
);
create unique index if not exists frota_viagem_aberta_veiculo_10a on private.frota_viagens_10a(veiculo_id) where chegada_em is null;
create unique index if not exists frota_viagem_aberta_pessoa_10a on private.frota_viagens_10a(employee_id) where chegada_em is null;

create table if not exists private.frota_planos_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  descricao text not null check (char_length(descricao) between 2 and 80),
  cada_km integer check (cada_km is null or cada_km between 1 and 1000000),
  cada_dias integer check (cada_dias is null or cada_dias between 1 and 3650),
  ultimo_km integer check (ultimo_km is null or ultimo_km >= 0),
  ultima_data date,
  ativo boolean not null default true,
  check (cada_km is not null or cada_dias is not null),
  check (cada_km is null or ultimo_km is not null),
  check (cada_dias is null or ultima_data is not null)
);

create table if not exists private.frota_manutencoes_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  tipo text not null check (tipo in ('corretiva', 'preventiva')),
  descricao text not null check (char_length(descricao) between 3 and 300),
  origem text not null check (origem in ('checklist', 'chegada', 'gestao', 'plano')),
  checklist_id bigint references private.frota_checklists_10a(id),
  plano_id bigint references private.frota_planos_10a(id),
  status text not null default 'aberta' check (status in ('aberta', 'na_oficina', 'concluida', 'cancelada')),
  bloqueia boolean not null default false,
  aberta_em timestamptz not null default now(),
  oficina text check (oficina is null or char_length(oficina) <= 80),
  enviada_em timestamptz,
  previsao date,
  concluida_em timestamptz,
  km integer check (km is null or km >= 0),
  custo numeric(12,2) check (custo is null or custo >= 0),
  obs text check (obs is null or char_length(obs) <= 300)
);
create index if not exists frota_manutencoes_10a_status on private.frota_manutencoes_10a(veiculo_id, status);

create table if not exists private.frota_eventos_10a (
  id bigint generated always as identity primary key,
  veiculo_id bigint not null references private.frota_veiculos_10a(id),
  tipo text not null check (char_length(tipo) <= 40),
  texto text not null check (char_length(texto) <= 400),
  employee_id uuid references public.epi_employees(id),
  user_id uuid references auth.users(id),
  em timestamptz not null default now()
);
create index if not exists frota_eventos_10a_veiculo on private.frota_eventos_10a(veiculo_id, em desc);

alter table private.frota_veiculos_10a enable row level security;
alter table private.frota_documentos_10a enable row level security;
alter table private.frota_itens_10a enable row level security;
alter table private.frota_checklists_10a enable row level security;
alter table private.frota_respostas_10a enable row level security;
alter table private.frota_viagens_10a enable row level security;
alter table private.frota_planos_10a enable row level security;
alter table private.frota_manutencoes_10a enable row level security;
alter table private.frota_eventos_10a enable row level security;
revoke all on private.frota_veiculos_10a, private.frota_documentos_10a, private.frota_itens_10a, private.frota_checklists_10a, private.frota_respostas_10a,
  private.frota_viagens_10a, private.frota_planos_10a, private.frota_manutencoes_10a, private.frota_eventos_10a from public, anon, authenticated, service_role;

-- Os 26 itens do checklist da planilha METALLO-ENG-01. "Crítico" é sugestão inicial; o engenheiro ajusta em Frota › Itens do checklist.
insert into private.frota_itens_10a(codigo, nome, critico) values
  (1, 'Conservação e limpeza', false), (2, 'Retrovisor interno e externo', false), (3, 'Para-brisa', false), (4, 'Assentos', false),
  (5, 'Alavancas de comando', true), (6, 'Mangueiras hidráulicas', true), (7, 'Moitão', true), (8, 'Pneus', true), (9, 'Bateria', false),
  (10, 'Extintor de incêndio', false), (11, 'Visibilidade', false), (12, 'Fitas refletivas', false), (13, 'Trava da tampa do capô', false),
  (14, 'Habilitação do operador', true), (15, 'EPIs', false), (16, 'Alarme sonoro de ré', false), (17, 'Buzina', false), (18, 'Parte elétrica', false),
  (19, 'Luzes de ré e freio', false), (20, 'Farolete e luz direcional', false), (21, 'Freios', true), (22, 'Luz baixa e alta', false),
  (23, 'Limpador de para-brisas', false), (24, 'Trava de segurança do moitão', true), (25, 'Comandos', true), (26, 'Cintos de segurança', true)
on conflict (codigo) do nothing;

-- Funções de apoio (só dentro do banco).
create or replace function private.frota_hoje_10a() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Fortaleza')::date
$$;
create or replace function private.frota_pode_cadastrar_10a() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role in ('admin', 'engineer'))
$$;
create or replace function private.frota_evento_10a(p_veiculo bigint, p_tipo text, p_texto text, p_emp uuid, p_user uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.frota_eventos_10a(veiculo_id, tipo, texto, employee_id, user_id) values (p_veiculo, p_tipo, left(p_texto, 400), p_emp, p_user)
$$;
-- 'vencido', 'breve' (a vencer) ou 'ok' para um plano de manutenção preventiva.
create or replace function private.frota_plano_situacao_10a(p_cada_km integer, p_ultimo_km integer, p_cada_dias integer, p_ultima_data date, p_km_atual integer) returns text
language sql stable set search_path = '' as $$
  select case
    when (p_cada_km is not null and p_km_atual - p_ultimo_km >= p_cada_km)
      or (p_cada_dias is not null and private.frota_hoje_10a() - p_ultima_data >= p_cada_dias) then 'vencido'
    when (p_cada_km is not null and (p_km_atual - p_ultimo_km) >= p_cada_km * 0.9)
      or (p_cada_dias is not null and (private.frota_hoje_10a() - p_ultima_data) >= p_cada_dias - greatest(7, p_cada_dias / 10)) then 'breve'
    else 'ok' end
$$;
-- Abre manutenção corretiva automática (checklist ou chegada). Se o caminhão já tem uma assim aberta, só reforça o bloqueio.
create or replace function private.frota_abrir_automatica_10a(p_veiculo bigint, p_origem text, p_descricao text, p_checklist bigint, p_bloqueia boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.frota_manutencoes_10a m where m.veiculo_id = p_veiculo and m.origem in ('checklist', 'chegada') and m.status in ('aberta', 'na_oficina')) then
    if p_bloqueia then
      update private.frota_manutencoes_10a m set bloqueia = true where m.veiculo_id = p_veiculo and m.origem in ('checklist', 'chegada') and m.status = 'aberta';
    end if;
    return;
  end if;
  insert into private.frota_manutencoes_10a(veiculo_id, tipo, descricao, origem, checklist_id, bloqueia)
    values (p_veiculo, 'corretiva', left(p_descricao, 300), p_origem, p_checklist, p_bloqueia);
end $$;
-- Depois de mudar uma manutenção: na oficina = "manutencao"; aberta que bloqueia = "nao_liberado"; senão disponível.
-- Só mexe em caminhão que está parado (nunca em um que está na rua).
create or replace function private.frota_recalcula_10a(p_veiculo bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nova text;
begin
  v_nova := case
    when exists (select 1 from private.frota_manutencoes_10a m where m.veiculo_id = p_veiculo and m.status = 'na_oficina') then 'manutencao'
    when exists (select 1 from private.frota_manutencoes_10a m where m.veiculo_id = p_veiculo and m.status = 'aberta' and m.bloqueia) then 'nao_liberado'
    else 'disponivel' end;
  update private.frota_veiculos_10a v set situacao = v_nova where v.id = p_veiculo and v.situacao in ('disponivel', 'manutencao', 'nao_liberado') and v.situacao <> v_nova;
end $$;
revoke all on function private.frota_hoje_10a(), private.frota_pode_cadastrar_10a(), private.frota_evento_10a(bigint, text, text, uuid, uuid),
  private.frota_plano_situacao_10a(integer, integer, integer, date, integer), private.frota_abrir_automatica_10a(bigint, text, text, bigint, boolean),
  private.frota_recalcula_10a(bigint) from public, anon, authenticated, service_role;

-- ============ App do funcionário ============
create or replace function public.my_frota_10a() returns table(id bigint, nome text, placa text, modelo text, situacao text, km_atual integer,
  checklist_hoje text, motorista text, destino text, saida_em timestamptz, minha_viagem bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query
    select v.id, v.nome, v.placa, v.modelo, v.situacao, v.km_atual,
      (select c.resultado from private.frota_checklists_10a c where c.veiculo_id = v.id and c.dia = private.frota_hoje_10a() order by c.created_at desc limit 1),
      e.full_name, t.destino, t.saida_em, case when t.employee_id = v_emp then t.id end
    from private.frota_veiculos_10a v
      left join private.frota_viagens_10a t on t.veiculo_id = v.id and t.chegada_em is null
      left join public.epi_employees e on e.id = t.employee_id
    where v.ativo order by v.nome;
end $$;

create or replace function public.my_frota_itens_10a() returns table(codigo smallint, nome text, critico boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.funcionario_do_app_3t() is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select i.codigo, i.nome, i.critico from private.frota_itens_10a i where i.ativo order by i.codigo;
end $$;

create or replace function public.my_frota_viagens_10a() returns table(id bigint, veiculo text, destino text, saida_em timestamptz, chegada_em timestamptz, km_saida integer, km_chegada integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t();
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  return query select t.id, v.nome, t.destino, t.saida_em, t.chegada_em, t.km_saida, t.km_chegada
    from private.frota_viagens_10a t join private.frota_veiculos_10a v on v.id = t.veiculo_id
    where t.employee_id = v_emp order by t.saida_em desc limit 15;
end $$;

-- Checklist do dia. p_respostas = [{"codigo":1,"situacao":"C"|"N"|"NA","obs":"..."}] com todos os itens ativos, uma vez cada.
create or replace function public.create_checklist_10a(p_veiculo bigint, p_local text, p_obs text, p_respostas jsonb, p_ciente boolean, p_key uuid)
returns table(id bigint, resultado text)
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_cid bigint; v_res text; v_v private.frota_veiculos_10a%rowtype;
  v_ativos int; v_ok int; v_crit boolean; v_algum boolean; v_lista text;
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select c.id, c.resultado into v_cid, v_res from private.frota_checklists_10a c where c.idempotency_key = p_key and c.employee_id = v_emp;
  if v_cid is not null then return query select v_cid, v_res; return; end if;
  select * into v_v from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo for update;
  if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if v_v.situacao in ('em_uso', 'manutencao') then raise exception 'veiculo_indisponivel' using errcode = '22023'; end if;
  if p_ciente is not true then raise exception 'ciencia_obrigatoria' using errcode = '22023'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'array' then raise exception 'itens_incompletos' using errcode = '22023'; end if;
  select count(*) into v_ativos from private.frota_itens_10a i where i.ativo;
  select count(*) into v_ok from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text)
    join private.frota_itens_10a i on i.codigo = r.codigo and i.ativo;
  if v_ok <> v_ativos or jsonb_array_length(p_respostas) <> v_ativos
    or (select count(distinct r.codigo) from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text)) <> v_ativos then
    raise exception 'itens_incompletos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) where r.situacao is null or r.situacao not in ('C', 'N', 'NA')) then
    raise exception 'resposta_invalida' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) where r.situacao = 'N' and char_length(trim(coalesce(r.obs, ''))) < 3) then
    raise exception 'descreva_o_problema' using errcode = '22023';
  end if;
  select coalesce(bool_or(r.situacao = 'N' and i.critico), false), coalesce(bool_or(r.situacao = 'N'), false),
    string_agg(i.nome, ', ' order by i.codigo) filter (where r.situacao = 'N')
    into v_crit, v_algum, v_lista
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join private.frota_itens_10a i on i.codigo = r.codigo;
  v_res := case when v_crit then 'nao_liberado' when v_algum then 'ressalvas' else 'liberado' end;
  insert into private.frota_checklists_10a(veiculo_id, employee_id, dia, local, observacoes, resultado, ciente, idempotency_key)
    values (p_veiculo, v_emp, private.frota_hoje_10a(), nullif(left(trim(coalesce(p_local, '')), 80), ''), nullif(left(trim(coalesce(p_obs, '')), 300), ''), v_res, true, p_key)
    returning frota_checklists_10a.id into v_cid;
  insert into private.frota_respostas_10a(checklist_id, codigo, situacao, obs, critico)
    select v_cid, r.codigo, r.situacao, nullif(left(trim(coalesce(r.obs, '')), 200), ''), i.critico
    from jsonb_to_recordset(p_respostas) as r(codigo int, situacao text, obs text) join private.frota_itens_10a i on i.codigo = r.codigo;
  if v_crit then
    update private.frota_veiculos_10a v set situacao = 'nao_liberado' where v.id = p_veiculo;
    perform private.frota_abrir_automatica_10a(p_veiculo, 'checklist', 'Checklist com item crítico não conforme: ' || v_lista, v_cid, true);
    perform private.frota_evento_10a(p_veiculo, 'checklist_bloqueio', 'Checklist com item crítico não conforme (' || v_lista || '). Caminhão não liberado.', v_emp, null);
  elsif v_algum then
    perform private.frota_abrir_automatica_10a(p_veiculo, 'checklist', 'Checklist com item não conforme: ' || v_lista, v_cid, false);
    perform private.frota_evento_10a(p_veiculo, 'checklist_ressalvas', 'Checklist com ressalvas (' || v_lista || ').', v_emp, null);
  else
    perform private.frota_evento_10a(p_veiculo, 'checklist_ok', 'Checklist sem problemas.', v_emp, null);
  end if;
  return query select v_cid, v_res;
end $$;

create or replace function public.create_saida_10a(p_veiculo bigint, p_destino text, p_acompanhantes text, p_km integer, p_obs text, p_key uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_emp uuid := private.funcionario_do_app_3t(); v_id bigint; v_v private.frota_veiculos_10a%rowtype; v_destino text := trim(coalesce(p_destino, ''));
begin
  if v_emp is null then raise exception 'portal_access_denied' using errcode = '42501'; end if;
  select t.id into v_id from private.frota_viagens_10a t where t.chave_saida = p_key and t.employee_id = v_emp;
  if v_id is not null then return v_id; end if;
  select * into v_v from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo for update;
  if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if v_v.situacao = 'em_uso' then raise exception 'veiculo_em_uso' using errcode = '22023'; end if;
  if v_v.situacao = 'manutencao' then raise exception 'veiculo_em_manutencao' using errcode = '22023'; end if;
  if v_v.situacao = 'nao_liberado' then raise exception 'veiculo_nao_liberado' using errcode = '22023'; end if;
  if exists (select 1 from private.frota_viagens_10a t where t.employee_id = v_emp and t.chegada_em is null) then raise exception 'voce_ja_esta_com_um_caminhao' using errcode = '22023'; end if;
  if char_length(v_destino) < 2 or char_length(v_destino) > 120 then raise exception 'destino_invalido' using errcode = '22023'; end if;
  if p_km is null or p_km < v_v.km_atual or p_km > 3000000 then raise exception 'km_menor_que_atual' using errcode = '22023'; end if;
  if v_v.liberado_dia is distinct from private.frota_hoje_10a()
    and not exists (select 1 from private.frota_checklists_10a c where c.veiculo_id = p_veiculo and c.dia = private.frota_hoje_10a() and c.resultado in ('liberado', 'ressalvas')) then
    raise exception 'checklist_do_dia_necessario' using errcode = '22023';
  end if;
  insert into private.frota_viagens_10a(veiculo_id, employee_id, destino, acompanhantes, km_saida, obs_saida, chave_saida)
    values (p_veiculo, v_emp, v_destino, nullif(left(trim(coalesce(p_acompanhantes, '')), 120), ''), p_km, nullif(left(trim(coalesce(p_obs, '')), 200), ''), p_key)
    returning frota_viagens_10a.id into v_id;
  update private.frota_veiculos_10a v set situacao = 'em_uso', km_atual = p_km where v.id = p_veiculo;
  perform private.frota_evento_10a(p_veiculo, 'saida', 'Saiu para ' || v_destino || ' com ' || p_km || ' km.', v_emp, null);
  return v_id;
end $$;

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
  update private.frota_viagens_10a t set chegada_em = now(), km_chegada = p_km, obs_chegada = nullif(left(trim(coalesce(p_obs, '')), 200), ''), chave_chegada = p_key where t.id = p_viagem;
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

revoke all on function public.my_frota_10a(), public.my_frota_itens_10a(), public.my_frota_viagens_10a(),
  public.create_checklist_10a(bigint, text, text, jsonb, boolean, uuid), public.create_saida_10a(bigint, text, text, integer, text, uuid),
  public.create_chegada_10a(bigint, integer, text, text, uuid) from public, anon;
grant execute on function public.my_frota_10a(), public.my_frota_itens_10a(), public.my_frota_viagens_10a(),
  public.create_checklist_10a(bigint, text, text, jsonb, boolean, uuid), public.create_saida_10a(bigint, text, text, integer, text, uuid),
  public.create_chegada_10a(bigint, integer, text, text, uuid) to authenticated;

-- ============ Gestão (administrador, engenheiro e líder operam; cadastro e liberação só administrador e engenheiro) ============
create or replace function public.admin_frota_painel_10a() returns table(id bigint, nome text, placa text, modelo text, ano smallint, situacao text, km_atual integer, ativo boolean,
  motorista text, destino text, acompanhantes text, saida_em timestamptz, checklist_hoje text, checklist_hoje_em timestamptz, checklist_hoje_por text,
  manutencoes_abertas integer, docs_vencidos integer, docs_breve integer, planos_vencidos integer, planos_breve integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select v.id, v.nome, v.placa, v.modelo, v.ano, v.situacao, v.km_atual, v.ativo,
      e.full_name, t.destino, t.acompanhantes, t.saida_em,
      c.resultado, c.created_at, ce.full_name,
      (select count(*)::int from private.frota_manutencoes_10a m where m.veiculo_id = v.id and m.status in ('aberta', 'na_oficina')),
      (select count(*)::int from private.frota_documentos_10a d where d.veiculo_id = v.id and d.vencimento < private.frota_hoje_10a()),
      (select count(*)::int from private.frota_documentos_10a d where d.veiculo_id = v.id and d.vencimento between private.frota_hoje_10a() and private.frota_hoje_10a() + 30),
      (select count(*)::int from private.frota_planos_10a p where p.veiculo_id = v.id and p.ativo and private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual) = 'vencido'),
      (select count(*)::int from private.frota_planos_10a p where p.veiculo_id = v.id and p.ativo and private.frota_plano_situacao_10a(p.cada_km, p.ultimo_km, p.cada_dias, p.ultima_data, v.km_atual) = 'breve')
    from private.frota_veiculos_10a v
      left join private.frota_viagens_10a t on t.veiculo_id = v.id and t.chegada_em is null
      left join public.epi_employees e on e.id = t.employee_id
      left join lateral (select k.resultado, k.created_at, k.employee_id from private.frota_checklists_10a k where k.veiculo_id = v.id and k.dia = private.frota_hoje_10a() order by k.created_at desc limit 1) c on true
      left join public.epi_employees ce on ce.id = c.employee_id
    order by v.ativo desc, v.nome;
end $$;

create or replace function public.admin_frota_itens_10a() returns table(codigo smallint, nome text, critico boolean, ativo boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query select i.codigo, i.nome, i.critico, i.ativo from private.frota_itens_10a i order by i.codigo;
end $$;

-- Ficha completa de um caminhão (um só retorno em JSON).
create or replace function public.admin_frota_ficha_10a(p_veiculo bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
      select ev.tipo, ev.texto, ev.em, e.full_name as pessoa
      from private.frota_eventos_10a ev left join public.epi_employees e on e.id = ev.employee_id where ev.veiculo_id = p_veiculo order by ev.em desc limit 40) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_frota_checklist_10a(p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_c jsonb;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  select jsonb_build_object('id', k.id, 'veiculo', v.nome, 'placa', v.placa, 'dia', k.dia, 'resultado', k.resultado, 'por', e.full_name, 'local', k.local, 'observacoes', k.observacoes, 'created_at', k.created_at)
    into v_c from private.frota_checklists_10a k join private.frota_veiculos_10a v on v.id = k.veiculo_id join public.epi_employees e on e.id = k.employee_id where k.id = p_id;
  if v_c is null then raise exception 'checklist_invalido' using errcode = '22023'; end if;
  return jsonb_build_object('checklist', v_c, 'itens', coalesce((select jsonb_agg(jsonb_build_object('codigo', r.codigo, 'nome', i.nome, 'situacao', r.situacao, 'obs', r.obs, 'critico', r.critico) order by r.codigo)
    from private.frota_respostas_10a r join private.frota_itens_10a i on i.codigo = r.codigo where r.checklist_id = p_id), '[]'::jsonb));
end $$;

-- Grade do mês (como a planilha em papel): para cada dia e item, o pior resultado do dia (N, depois C, depois NA).
create or replace function public.admin_frota_mes_10a(p_veiculo bigint, p_mes date) returns table(dia date, codigo smallint, situacao text, por text)
language plpgsql stable security definer set search_path = '' as $$
declare v_ini date := date_trunc('month', coalesce(p_mes, private.frota_hoje_10a()))::date;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
    select k.dia, r.codigo, case when bool_or(r.situacao = 'N') then 'N' when bool_or(r.situacao = 'C') then 'C' else 'NA' end,
      (select string_agg(distinct e.full_name, ', ') from private.frota_checklists_10a k2 join public.epi_employees e on e.id = k2.employee_id where k2.veiculo_id = p_veiculo and k2.dia = k.dia)
    from private.frota_checklists_10a k join private.frota_respostas_10a r on r.checklist_id = k.id
    where k.veiculo_id = p_veiculo and k.dia >= v_ini and k.dia < (v_ini + interval '1 month')::date
    group by k.dia, r.codigo order by k.dia, r.codigo;
end $$;

-- Pontos de atenção de toda a frota (documentos, planos, caminhão parado).
create or replace function public.admin_frota_atencao_10a() returns table(veiculo_id bigint, nome text, tipo text, texto text, gravidade text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  return query
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

create or replace function public.admin_save_veiculo_10a(p_id bigint, p_placa text, p_nome text, p_modelo text, p_ano integer, p_km integer, p_ativo boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id; v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g')); v_antigo integer; v_sit text;
begin
  if not private.frota_pode_cadastrar_10a() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if v_placa !~ '^[A-Z0-9]{7}$' then raise exception 'placa_invalida' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 or char_length(trim(p_nome)) > 60 then raise exception 'nome_invalido' using errcode = '22023'; end if;
  if p_km is null or p_km < 0 or p_km > 3000000 then raise exception 'km_invalido' using errcode = '22023'; end if;
  if v_id is null then
    insert into private.frota_veiculos_10a(placa, nome, modelo, ano, km_atual, ativo)
      values (v_placa, trim(p_nome), nullif(left(trim(coalesce(p_modelo, '')), 60), ''), p_ano, p_km, coalesce(p_ativo, true)) returning frota_veiculos_10a.id into v_id;
    perform private.frota_evento_10a(v_id, 'cadastro', 'Caminhão cadastrado.', null, (select auth.uid()));
  else
    select v.km_atual, v.situacao into v_antigo, v_sit from private.frota_veiculos_10a v where v.id = v_id for update;
    if not found then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
    if coalesce(p_ativo, true) = false and v_sit = 'em_uso' then raise exception 'caminhao_em_uso' using errcode = '22023'; end if;
    update private.frota_veiculos_10a v set placa = v_placa, nome = trim(p_nome), modelo = nullif(left(trim(coalesce(p_modelo, '')), 60), ''), ano = p_ano,
      km_atual = p_km, ativo = coalesce(p_ativo, true) where v.id = v_id;
    if v_antigo is distinct from p_km then perform private.frota_evento_10a(v_id, 'km_corrigido', 'Km ajustado de ' || v_antigo || ' para ' || p_km || '.', null, (select auth.uid())); end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_save_documento_10a(p_veiculo bigint, p_tipo text, p_descricao text, p_numero text, p_vencimento date) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not private.frota_pode_cadastrar_10a() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_tipo not in ('crlv', 'seguro', 'inspecao_guindaste', 'outro') or p_vencimento is null then raise exception 'documento_invalido' using errcode = '22023'; end if;
  if p_tipo = 'outro' and char_length(trim(coalesce(p_descricao, ''))) < 2 then raise exception 'descreva_o_documento' using errcode = '22023'; end if;
  if not exists (select 1 from private.frota_veiculos_10a v where v.id = p_veiculo) then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  insert into private.frota_documentos_10a(veiculo_id, tipo, descricao, numero, vencimento)
    values (p_veiculo, p_tipo, case when p_tipo = 'outro' then left(trim(p_descricao), 60) else '' end, nullif(left(trim(coalesce(p_numero, '')), 60), ''), p_vencimento)
    on conflict (veiculo_id, tipo, descricao) do update set numero = excluded.numero, vencimento = excluded.vencimento, updated_at = now()
    returning frota_documentos_10a.id into v_id;
  perform private.frota_evento_10a(p_veiculo, 'documento', 'Documento atualizado (' || p_tipo || ') com vencimento em ' || to_char(p_vencimento, 'DD/MM/YYYY') || '.', null, (select auth.uid()));
  return v_id;
end $$;

create or replace function public.admin_set_item_10a(p_codigo smallint, p_nome text, p_critico boolean, p_ativo boolean) returns smallint
language plpgsql security definer set search_path = '' as $$
declare v_cod smallint := p_codigo;
begin
  if not private.frota_pode_cadastrar_10a() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 2 or char_length(trim(p_nome)) > 80 then raise exception 'nome_invalido' using errcode = '22023'; end if;
  if v_cod is null then
    select coalesce(max(i.codigo), 0) + 1 into v_cod from private.frota_itens_10a i;
    if v_cod > 99 then raise exception 'itens_demais' using errcode = '22023'; end if;
    insert into private.frota_itens_10a(codigo, nome, critico, ativo) values (v_cod, trim(p_nome), coalesce(p_critico, false), coalesce(p_ativo, true));
  else
    update private.frota_itens_10a i set nome = trim(p_nome), critico = coalesce(p_critico, false), ativo = coalesce(p_ativo, true) where i.codigo = v_cod;
    if not found then raise exception 'item_invalido' using errcode = '22023'; end if;
  end if;
  return v_cod;
end $$;

create or replace function public.admin_liberar_10a(p_veiculo bigint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not private.frota_pode_cadastrar_10a() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(v_motivo) < 5 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  update private.frota_veiculos_10a v set situacao = 'disponivel', liberado_dia = private.frota_hoje_10a() where v.id = p_veiculo and v.situacao = 'nao_liberado';
  if not found then raise exception 'veiculo_nao_esta_bloqueado' using errcode = '22023'; end if;
  update private.frota_manutencoes_10a m set bloqueia = false where m.veiculo_id = p_veiculo and m.status = 'aberta';
  perform private.frota_evento_10a(p_veiculo, 'liberado', 'Liberado pelo engenheiro: ' || left(v_motivo, 300), null, (select auth.uid()));
end $$;

-- Manutenção (administrador, engenheiro e líder).
create or replace function public.admin_abrir_manutencao_10a(p_veiculo bigint, p_tipo text, p_descricao text, p_bloquear boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_desc text := trim(coalesce(p_descricao, ''));
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_tipo not in ('corretiva', 'preventiva') or char_length(v_desc) < 3 or char_length(v_desc) > 300 then raise exception 'manutencao_invalida' using errcode = '22023'; end if;
  if not exists (select 1 from private.frota_veiculos_10a v where v.id = p_veiculo and v.ativo) then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  insert into private.frota_manutencoes_10a(veiculo_id, tipo, descricao, origem, bloqueia) values (p_veiculo, p_tipo, v_desc, 'gestao', coalesce(p_bloquear, false))
    returning frota_manutencoes_10a.id into v_id;
  if coalesce(p_bloquear, false) then update private.frota_veiculos_10a v set situacao = 'nao_liberado' where v.id = p_veiculo and v.situacao = 'disponivel'; end if;
  perform private.frota_evento_10a(p_veiculo, 'manutencao_aberta', 'Manutenção aberta (' || p_tipo || '): ' || left(v_desc, 300), null, (select auth.uid()));
  return v_id;
end $$;

create or replace function public.admin_enviar_oficina_10a(p_id bigint, p_oficina text, p_previsao date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m private.frota_manutencoes_10a%rowtype; v_of text := trim(coalesce(p_oficina, ''));
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(v_of) < 2 or char_length(v_of) > 80 then raise exception 'oficina_invalida' using errcode = '22023'; end if;
  select * into v_m from private.frota_manutencoes_10a m where m.id = p_id and m.status = 'aberta' for update;
  if not found then raise exception 'manutencao_nao_encontrada' using errcode = '22023'; end if;
  if exists (select 1 from private.frota_veiculos_10a v where v.id = v_m.veiculo_id and v.situacao = 'em_uso') then raise exception 'caminhao_em_uso' using errcode = '22023'; end if;
  update private.frota_manutencoes_10a m set status = 'na_oficina', oficina = v_of, enviada_em = now(), previsao = p_previsao where m.id = p_id;
  perform private.frota_recalcula_10a(v_m.veiculo_id);
  perform private.frota_evento_10a(v_m.veiculo_id, 'oficina', 'Enviado à oficina ' || v_of || case when p_previsao is null then '' else ' (previsão ' || to_char(p_previsao, 'DD/MM/YYYY') || ')' end || '.', null, (select auth.uid()));
end $$;

create or replace function public.admin_concluir_manutencao_10a(p_id bigint, p_custo numeric, p_km integer, p_obs text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m private.frota_manutencoes_10a%rowtype;
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if p_custo is not null and (p_custo < 0 or p_custo > 99999999) then raise exception 'custo_invalido' using errcode = '22023'; end if;
  select * into v_m from private.frota_manutencoes_10a m where m.id = p_id and m.status in ('aberta', 'na_oficina') for update;
  if not found then raise exception 'manutencao_nao_encontrada' using errcode = '22023'; end if;
  update private.frota_manutencoes_10a m set status = 'concluida', concluida_em = now(), custo = round(p_custo, 2), km = p_km, obs = nullif(left(trim(coalesce(p_obs, '')), 300), '') where m.id = p_id;
  if p_km is not null and p_km > 0 then update private.frota_veiculos_10a v set km_atual = greatest(v.km_atual, least(p_km, 3000000)) where v.id = v_m.veiculo_id; end if;
  perform private.frota_recalcula_10a(v_m.veiculo_id);
  perform private.frota_evento_10a(v_m.veiculo_id, 'manutencao_concluida', 'Manutenção concluída: ' || left(v_m.descricao, 200) || case when p_custo is null then '' else ' (custo R$ ' || to_char(p_custo, 'FM999G999G990D00') || ')' end, null, (select auth.uid()));
end $$;

create or replace function public.admin_cancelar_manutencao_10a(p_id bigint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_m private.frota_manutencoes_10a%rowtype; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(v_motivo) < 3 then raise exception 'motivo_obrigatorio' using errcode = '22023'; end if;
  select * into v_m from private.frota_manutencoes_10a m where m.id = p_id and m.status in ('aberta', 'na_oficina') for update;
  if not found then raise exception 'manutencao_nao_encontrada' using errcode = '22023'; end if;
  update private.frota_manutencoes_10a m set status = 'cancelada', concluida_em = now(), obs = left(v_motivo, 300) where m.id = p_id;
  perform private.frota_recalcula_10a(v_m.veiculo_id);
  perform private.frota_evento_10a(v_m.veiculo_id, 'manutencao_cancelada', 'Manutenção cancelada: ' || left(v_m.descricao, 150) || ' — ' || left(v_motivo, 150), null, (select auth.uid()));
end $$;

-- Planos de manutenção preventiva (por km e/ou por dias).
create or replace function public.admin_save_plano_10a(p_id bigint, p_veiculo bigint, p_descricao text, p_cada_km integer, p_cada_dias integer, p_ultimo_km integer, p_ultima_data date, p_ativo boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint := p_id; v_desc text := trim(coalesce(p_descricao, ''));
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if char_length(v_desc) < 2 or char_length(v_desc) > 80 then raise exception 'plano_invalido' using errcode = '22023'; end if;
  if (p_cada_km is null and p_cada_dias is null) or (p_cada_km is not null and p_ultimo_km is null) or (p_cada_dias is not null and p_ultima_data is null) then raise exception 'plano_invalido' using errcode = '22023'; end if;
  if not exists (select 1 from private.frota_veiculos_10a v where v.id = p_veiculo) then raise exception 'veiculo_invalido' using errcode = '22023'; end if;
  if v_id is null then
    insert into private.frota_planos_10a(veiculo_id, descricao, cada_km, cada_dias, ultimo_km, ultima_data, ativo)
      values (p_veiculo, v_desc, p_cada_km, p_cada_dias, p_ultimo_km, p_ultima_data, coalesce(p_ativo, true)) returning frota_planos_10a.id into v_id;
  else
    update private.frota_planos_10a p set descricao = v_desc, cada_km = p_cada_km, cada_dias = p_cada_dias, ultimo_km = p_ultimo_km, ultima_data = p_ultima_data, ativo = coalesce(p_ativo, true)
      where p.id = v_id and p.veiculo_id = p_veiculo;
    if not found then raise exception 'plano_invalido' using errcode = '22023'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_concluir_plano_10a(p_plano bigint, p_km integer, p_data date, p_custo numeric, p_obs text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p private.frota_planos_10a%rowtype; v_data date := coalesce(p_data, private.frota_hoje_10a());
begin
  if not private.pode_atender_3t() then raise exception 'gestao_required' using errcode = '42501'; end if;
  if (p_custo is not null and (p_custo < 0 or p_custo > 99999999)) or v_data > private.frota_hoje_10a() then raise exception 'plano_invalido' using errcode = '22023'; end if;
  select * into v_p from private.frota_planos_10a p where p.id = p_plano and p.ativo for update;
  if not found then raise exception 'plano_invalido' using errcode = '22023'; end if;
  if v_p.cada_km is not null and (p_km is null or p_km < 0 or p_km > 3000000) then raise exception 'km_invalido' using errcode = '22023'; end if;
  update private.frota_planos_10a p set ultima_data = v_data, ultimo_km = coalesce(p_km, p.ultimo_km) where p.id = p_plano;
  insert into private.frota_manutencoes_10a(veiculo_id, tipo, descricao, origem, plano_id, status, concluida_em, km, custo, obs)
    values (v_p.veiculo_id, 'preventiva', v_p.descricao, 'plano', p_plano, 'concluida', now(), p_km, round(p_custo, 2), nullif(left(trim(coalesce(p_obs, '')), 300), ''));
  if p_km is not null then update private.frota_veiculos_10a v set km_atual = greatest(v.km_atual, p_km) where v.id = v_p.veiculo_id; end if;
  perform private.frota_evento_10a(v_p.veiculo_id, 'plano_feito', 'Manutenção preventiva feita: ' || v_p.descricao || '.', null, (select auth.uid()));
end $$;

-- Permissões das funções da Gestão.
revoke all on function public.admin_frota_painel_10a() from public, anon;
revoke all on function public.admin_frota_itens_10a() from public, anon;
revoke all on function public.admin_frota_ficha_10a(bigint) from public, anon;
revoke all on function public.admin_frota_checklist_10a(bigint) from public, anon;
revoke all on function public.admin_frota_mes_10a(bigint, date) from public, anon;
revoke all on function public.admin_frota_atencao_10a() from public, anon;
revoke all on function public.admin_save_veiculo_10a(bigint, text, text, text, integer, integer, boolean) from public, anon;
revoke all on function public.admin_save_documento_10a(bigint, text, text, text, date) from public, anon;
revoke all on function public.admin_set_item_10a(smallint, text, boolean, boolean) from public, anon;
revoke all on function public.admin_liberar_10a(bigint, text) from public, anon;
revoke all on function public.admin_abrir_manutencao_10a(bigint, text, text, boolean) from public, anon;
revoke all on function public.admin_enviar_oficina_10a(bigint, text, date) from public, anon;
revoke all on function public.admin_concluir_manutencao_10a(bigint, numeric, integer, text) from public, anon;
revoke all on function public.admin_cancelar_manutencao_10a(bigint, text) from public, anon;
revoke all on function public.admin_save_plano_10a(bigint, bigint, text, integer, integer, integer, date, boolean) from public, anon;
revoke all on function public.admin_concluir_plano_10a(bigint, integer, date, numeric, text) from public, anon;
grant execute on function public.admin_frota_painel_10a() to authenticated;
grant execute on function public.admin_frota_itens_10a() to authenticated;
grant execute on function public.admin_frota_ficha_10a(bigint) to authenticated;
grant execute on function public.admin_frota_checklist_10a(bigint) to authenticated;
grant execute on function public.admin_frota_mes_10a(bigint, date) to authenticated;
grant execute on function public.admin_frota_atencao_10a() to authenticated;
grant execute on function public.admin_save_veiculo_10a(bigint, text, text, text, integer, integer, boolean) to authenticated;
grant execute on function public.admin_save_documento_10a(bigint, text, text, text, date) to authenticated;
grant execute on function public.admin_set_item_10a(smallint, text, boolean, boolean) to authenticated;
grant execute on function public.admin_liberar_10a(bigint, text) to authenticated;
grant execute on function public.admin_abrir_manutencao_10a(bigint, text, text, boolean) to authenticated;
grant execute on function public.admin_enviar_oficina_10a(bigint, text, date) to authenticated;
grant execute on function public.admin_concluir_manutencao_10a(bigint, numeric, integer, text) to authenticated;
grant execute on function public.admin_cancelar_manutencao_10a(bigint, text) to authenticated;
grant execute on function public.admin_save_plano_10a(bigint, bigint, text, integer, integer, integer, date, boolean) to authenticated;
grant execute on function public.admin_concluir_plano_10a(bigint, integer, date, numeric, text) to authenticated;

-- Dados fictícios de teste: 5 caminhões Munck.
insert into private.frota_veiculos_10a(placa, nome, modelo, ano, km_atual)
values ('TST0A01', 'Munck 01', 'Caminhão Munck (teste)', 2018, 84200),
       ('TST0A02', 'Munck 02', 'Caminhão Munck (teste)', 2019, 61350),
       ('TST0A03', 'Munck 03', 'Caminhão Munck (teste)', 2015, 112800),
       ('TST0A04', 'Munck 04', 'Caminhão Munck (teste)', 2021, 39900),
       ('TST0A05', 'Munck 05', 'Caminhão Munck (teste)', 2013, 143600)
on conflict (placa) do nothing;

insert into private.frota_documentos_10a(veiculo_id, tipo, descricao, numero, vencimento)
select v.id, d.tipo, '', d.tipo || '-' || v.placa, private.frota_hoje_10a() + d.dias
from private.frota_veiculos_10a v
join (values ('TST0A01','crlv',200),('TST0A01','seguro',20),('TST0A01','inspecao_guindaste',150),
             ('TST0A02','crlv',90),('TST0A02','seguro',300),('TST0A02','inspecao_guindaste',8),
             ('TST0A03','crlv',-5),('TST0A03','seguro',120),('TST0A03','inspecao_guindaste',60),
             ('TST0A04','crlv',250),('TST0A04','seguro',250),('TST0A04','inspecao_guindaste',200),
             ('TST0A05','crlv',45),('TST0A05','seguro',100),('TST0A05','inspecao_guindaste',25)) as d(placa, tipo, dias) on d.placa = v.placa
on conflict (veiculo_id, tipo, descricao) do nothing;

insert into private.frota_planos_10a(veiculo_id, descricao, cada_km, ultimo_km)
select v.id, 'Troca de óleo e filtros', 10000, v.km_atual - 9300
from private.frota_veiculos_10a v
where v.placa like 'TST0A0%' and not exists (select 1 from private.frota_planos_10a p where p.veiculo_id = v.id and p.descricao = 'Troca de óleo e filtros');

insert into private.frota_planos_10a(veiculo_id, descricao, cada_dias, ultima_data)
select v.id, 'Revisão do sistema hidráulico do guindaste', 180, private.frota_hoje_10a() - 120
from private.frota_veiculos_10a v
where v.placa like 'TST0A0%' and not exists (select 1 from private.frota_planos_10a p where p.veiculo_id = v.id and p.descricao = 'Revisão do sistema hidráulico do guindaste');

select '10A pronto' as status;
