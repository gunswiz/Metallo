-- Marco 4D (TESTE ONLINE, dados fictícios): núcleo do ponto em Postgres próprio, schema "ponto" fora da API.
-- Substitui, só no ambiente de teste, o núcleo local (PGlite + journal). O laboratório 2B/4A/4B/4C não muda.
-- Garantias no próprio banco:
--   * originais imutáveis (sem UPDATE/DELETE/TRUNCATE em intenção e marcação);
--   * NSR sequencial sem buracos (contador único travado na mesma transação da gravação);
--   * cadeia de hash SHA-256 (cada marcação aponta o hash da anterior) e verificação completa em SQL;
--   * hora da marcação = relógio do servidor no início (intenção), nunca do aparelho;
--   * identidade conferida a cada pedido (sessão do Auth ativa + vínculo pessoal ativo + funcionário ativo).
-- Nada aqui é exposto ao PostgREST: só o papel postgres (Edge Function ponto-4d) usa estas funções.

create schema ponto;
revoke all on schema ponto from public, anon, authenticated, service_role;

create table ponto.intencao (
  idempotency_key uuid primary key,
  auth_user_id uuid not null,
  employee_id uuid not null,
  marking_at timestamptz not null default date_trunc('milliseconds', clock_timestamp()),
  created_at timestamptz not null default clock_timestamp()
);
create index intencao_titular on ponto.intencao(auth_user_id, marking_at desc);

create table ponto.contador_nsr (
  singleton boolean primary key default true check (singleton),
  ultimo_nsr bigint not null default 0 check (ultimo_nsr >= 0),
  ultimo_hash text check (ultimo_hash ~ '^[0-9a-f]{64}$')
);
insert into ponto.contador_nsr(singleton, ultimo_nsr, ultimo_hash) values (true, 0, null);

create table ponto.marcacao (
  nsr bigint primary key check (nsr > 0),
  event_id uuid not null unique,
  idempotency_key uuid not null unique references ponto.intencao(idempotency_key),
  auth_user_id uuid not null,
  employee_id uuid not null,
  employee_name text not null check (length(btrim(employee_name)) >= 3),
  employee_code text,
  marking_at timestamptz not null,
  recorded_at timestamptz not null,
  timezone text not null check (timezone = 'America/Fortaleza'),
  collector text not null check (collector = 'BROWSER'),
  online boolean not null check (online),
  location jsonb not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  previous_hash text check (previous_hash ~ '^[0-9a-f]{64}$'),
  hash_version integer not null check (hash_version = 1),
  payload_hash text not null unique check (payload_hash ~ '^[0-9a-f]{64}$'),
  check ((nsr = 1) = (previous_hash is null)),
  check (recorded_at >= marking_at)
);
create index marcacao_titular_hora on ponto.marcacao(auth_user_id, marking_at desc, event_id desc);
create index marcacao_hora on ponto.marcacao(marking_at desc);

create function ponto.imutavel() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'ORIGINAL_IMUTAVEL' using errcode = 'P0001'; end $$;
create trigger imutavel before update or delete on ponto.intencao for each row execute function ponto.imutavel();
create trigger imutavel before update or delete on ponto.marcacao for each row execute function ponto.imutavel();
create trigger imutavel_truncate before truncate on ponto.intencao for each statement execute function ponto.imutavel();
create trigger imutavel_truncate before truncate on ponto.marcacao for each statement execute function ponto.imutavel();
create trigger imutavel_truncate before truncate on ponto.contador_nsr for each statement execute function ponto.imutavel();
create function ponto.contador_so_avanca() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.ultimo_nsr <> old.ultimo_nsr + 1 then raise exception 'CONTADOR_INVALIDO' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger so_avanca before update or delete on ponto.contador_nsr for each row execute function ponto.contador_so_avanca();

alter table ponto.intencao enable row level security;
alter table ponto.marcacao enable row level security;
alter table ponto.contador_nsr enable row level security;
revoke all on all tables in schema ponto from public, anon, authenticated, service_role;

-- Forma canônica v1 (ordem fixa, UTC com milissegundos, jsonb normalizado pelo Postgres).
create function ponto.canonico(m ponto.marcacao) returns text language sql immutable set search_path = '' as $$
  select jsonb_build_array(1, m.nsr, m.event_id, m.auth_user_id, m.employee_id, m.employee_name, m.employee_code,
    m.idempotency_key, to_char(m.marking_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    to_char(m.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), m.timezone, m.collector, m.online,
    m.location, m.request_hash, m.previous_hash)::text
$$;
create function ponto.hash(t text) returns text language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(t, 'UTF8')), 'hex')
$$;

-- Quem está pedindo: sessão do Auth viva + vínculo pessoal ativo + funcionário ativo (mesma regra do 3F/2E).
create function ponto.ator(p_user uuid, p_session uuid,
  out employee_id uuid, out employee_name text, out employee_code text)
language plpgsql stable set search_path = '' as $$
begin
  if p_user is null or p_session is null then raise exception 'SESSAO_INVALIDA' using errcode = 'P0001'; end if;
  perform 1 from auth.sessions s where s.id = p_session and s.user_id = p_user and (s.not_after is null or s.not_after > now());
  if not found then raise exception 'SESSAO_ENCERRADA' using errcode = 'P0001'; end if;
  select e.id, e.full_name, e.registration_code into employee_id, employee_name, employee_code
  from private.employee_identity i
  join private.employee_portal_accounts a on a.auth_user_id = i.auth_user_id
  join public.profiles p on p.id = i.auth_user_id and not p.active
  join public.epi_employees e on e.id = i.employee_id and e.active
  where i.auth_user_id = p_user and i.status = 'active';
  if employee_id is null then raise exception 'CONTEXTO_INATIVO' using errcode = 'P0001'; end if;
end $$;

-- 1) Intenção: fixa a hora oficial da marcação no servidor. Mesma chave = mesma hora.
create function ponto.iniciar(p_user uuid, p_session uuid, p_key uuid)
returns table(idempotency_key uuid, marking_at timestamptz)
language plpgsql set search_path = '' as $$
declare a record; i ponto.intencao;
begin
  a := ponto.ator(p_user, p_session);
  insert into ponto.intencao(idempotency_key, auth_user_id, employee_id) values (p_key, p_user, a.employee_id)
    on conflict on constraint intencao_pkey do nothing;
  select * into i from ponto.intencao x where x.idempotency_key = p_key;
  if i.auth_user_id <> p_user or i.employee_id <> a.employee_id then raise exception 'INTENCAO_CONFLITANTE' using errcode = 'P0001'; end if;
  return query select i.idempotency_key, i.marking_at;
end $$;

-- 2) Gravação: valida a intenção, limita a localização ao horário da intenção, grava com NSR e cadeia de hash.
create function ponto.registrar(p_user uuid, p_session uuid, p_key uuid, p_location jsonb)
returns table(marcacao ponto.marcacao, duplicate boolean)
language plpgsql set search_path = '' as $$
declare a record; i ponto.intencao; m ponto.marcacao; c ponto.contador_nsr; loc jsonb := p_location; captured timestamptz; req text;
begin
  a := ponto.ator(p_user, p_session);
  -- Escritor único: todas as gravações passam por este travamento, na ordem do NSR.
  select * into c from ponto.contador_nsr where singleton for update;
  select * into i from ponto.intencao x where x.idempotency_key = p_key;
  if i.idempotency_key is null or i.auth_user_id <> p_user or i.employee_id <> a.employee_id then
    raise exception 'INTENCAO_NAO_AUTORIZADA' using errcode = 'P0001'; end if;
  -- Revisão 4C: hora de captura informada pelo aparelho fora de [-10 min, +150 s] da intenção => localização não comprovada.
  if loc ? 'captured_at' and loc->>'captured_at' is not null then
    captured := (loc->>'captured_at')::timestamptz;
    if captured - i.marking_at > interval '150 seconds' or i.marking_at - captured > interval '10 minutes' then
      loc := jsonb_build_object('status','UNKNOWN','latitude',null,'longitude',null,'accuracy_meters',null,'captured_at',null,
        'provider','BROWSER_GEOLOCATION','mock_signal','NOT_EXPOSED');
    end if;
  end if;
  req := ponto.hash(loc::text);
  select * into m from ponto.marcacao x where x.idempotency_key = p_key;
  if m.nsr is not null then
    if m.request_hash <> req then raise exception 'INTENCAO_CONFLITANTE' using errcode = 'P0001'; end if;
    return query select m, true; return;
  end if;
  if clock_timestamp() < i.marking_at or clock_timestamp() - i.marking_at > interval '120 seconds' then
    raise exception 'INTENCAO_EXPIRADA' using errcode = 'P0001'; end if;
  m.nsr := c.ultimo_nsr + 1; m.event_id := gen_random_uuid(); m.idempotency_key := p_key;
  m.auth_user_id := p_user; m.employee_id := a.employee_id; m.employee_name := a.employee_name; m.employee_code := a.employee_code;
  m.marking_at := i.marking_at; m.recorded_at := date_trunc('milliseconds', clock_timestamp());
  m.timezone := 'America/Fortaleza'; m.collector := 'BROWSER'; m.online := true; m.location := loc; m.request_hash := req;
  m.previous_hash := c.ultimo_hash; m.hash_version := 1;
  m.payload_hash := ponto.hash(ponto.canonico(m));
  insert into ponto.marcacao select m.*;
  update ponto.contador_nsr set ultimo_nsr = m.nsr, ultimo_hash = m.payload_hash where singleton;
  return query select m, false;
end $$;

-- Verificação completa da cadeia (para a Gestão e para as provas).
create function ponto.verificar(out ok boolean, out total bigint, out motivo text)
language plpgsql stable set search_path = '' as $$
declare r ponto.marcacao; esperado bigint := 0; anterior text := null; c ponto.contador_nsr;
begin
  ok := true; total := 0; motivo := null;
  for r in select * from ponto.marcacao order by nsr loop
    esperado := esperado + 1; total := total + 1;
    if r.nsr <> esperado then ok := false; motivo := 'NSR_COM_BURACO_' || esperado; return; end if;
    if r.previous_hash is distinct from anterior then ok := false; motivo := 'CADEIA_QUEBRADA_NSR_' || r.nsr; return; end if;
    if ponto.hash(ponto.canonico(r)) <> r.payload_hash then ok := false; motivo := 'HASH_DIVERGENTE_NSR_' || r.nsr; return; end if;
    anterior := r.payload_hash;
  end loop;
  select * into c from ponto.contador_nsr where singleton;
  if c.ultimo_nsr <> total or c.ultimo_hash is distinct from anterior then ok := false; motivo := 'CONTADOR_DIVERGENTE'; end if;
end $$;

revoke all on all functions in schema ponto from public, anon, authenticated, service_role;
select 'ponto 4D pronto' as status;
