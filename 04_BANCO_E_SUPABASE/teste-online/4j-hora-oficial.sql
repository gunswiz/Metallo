-- Marco 4J (TESTE ONLINE, dados fictícios): hora oficial comprovada.
-- Portaria 671/2021, Anexo IX, item 2: o REP-P deve manter sincronismo com a Hora Legal Brasileira (HLB),
-- disseminada pelo Observatório Nacional, com variação de no máximo 30 segundos.
-- A cada 10 minutos a Edge Function "hora-oficial" compara o relógio do banco (que carimba cada marcação)
-- com o NTP.br (NIC.br, que distribui a HLB a partir dos relógios atômicos do Observatório Nacional) e grava o resultado aqui.
-- Cada conferência é imutável e encadeada por hash: serve de prova de que o relógio estava certo na hora das marcações.

create table if not exists ponto.conferencia_hora (
  id bigint generated always as identity primary key,
  conferido_em timestamptz not null default clock_timestamp(),
  fonte text not null check (char_length(fonte) between 3 and 120),
  metodo text not null check (metodo in ('HTTPS_DATE_VIRADA_SEGUNDO')),
  diferenca_ms integer check (diferenca_ms is null or abs(diferenca_ms) < 86400000),
  incerteza_ms integer check (incerteza_ms is null or incerteza_ms between 0 and 86400000),
  situacao text not null check (situacao in ('OK', 'ATENCAO', 'FORA_DO_LIMITE', 'SEM_RESPOSTA')),
  detalhe jsonb not null default '{}'::jsonb check (pg_column_size(detalhe) < 8000),
  hash_anterior text check (hash_anterior is null or hash_anterior ~ '^[0-9a-f]{64}$'),
  hash text not null unique check (hash ~ '^[0-9a-f]{64}$')
);
create index if not exists conferencia_hora_quando on ponto.conferencia_hora (conferido_em desc);
create or replace trigger imutavel before update or delete on ponto.conferencia_hora for each row execute function ponto.imutavel();
create or replace trigger imutavel_truncate before truncate on ponto.conferencia_hora for each statement execute function ponto.imutavel();
revoke all on ponto.conferencia_hora from public, anon, authenticated, service_role;

create or replace function ponto.canonico_hora(c ponto.conferencia_hora)
returns text language sql immutable set search_path = '' as $$
  select jsonb_build_array(1, c.id, to_char(c.conferido_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), c.fonte, c.metodo,
    c.diferenca_ms, c.incerteza_ms, c.situacao, c.detalhe, c.hash_anterior)::text
$$;

-- Só a Edge Function (papel postgres) grava. Situação: OK até 2 s; ATENÇÃO até 30 s (limite legal); acima disso, FORA DO LIMITE.
create or replace function ponto.registrar_conferencia_hora(p_fonte text, p_diferenca_ms integer, p_incerteza_ms integer, p_detalhe jsonb)
returns ponto.conferencia_hora language plpgsql set search_path = '' as $$
declare c ponto.conferencia_hora; anterior text;
begin
  perform pg_catalog.pg_advisory_xact_lock(4747004);
  select x.hash into anterior from ponto.conferencia_hora x order by x.id desc limit 1;
  c.id := nextval(pg_catalog.pg_get_serial_sequence('ponto.conferencia_hora', 'id'));
  c.conferido_em := clock_timestamp(); c.fonte := p_fonte; c.metodo := 'HTTPS_DATE_VIRADA_SEGUNDO';
  c.diferenca_ms := p_diferenca_ms; c.incerteza_ms := p_incerteza_ms; c.detalhe := coalesce(p_detalhe, '{}'::jsonb);
  c.situacao := case when p_diferenca_ms is null or p_incerteza_ms is null then 'SEM_RESPOSTA'
    when abs(p_diferenca_ms) + p_incerteza_ms <= 2000 then 'OK'
    when abs(p_diferenca_ms) + p_incerteza_ms <= 30000 then 'ATENCAO' else 'FORA_DO_LIMITE' end;
  c.hash_anterior := anterior;
  c.hash := ponto.hash(ponto.canonico_hora(c));
  insert into ponto.conferencia_hora overriding system value select c.*;
  return c;
end $$;
revoke all on function ponto.registrar_conferencia_hora(text, integer, integer, jsonb) from public, anon, authenticated, service_role;

-- Situação atual, para o app (relógio) e para a Gestão. "valida" = conferida nos últimos 30 minutos e dentro de 30 s.
create or replace function ponto.hora_atual_4j()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce((select jsonb_build_object('conferido_em', c.conferido_em, 'diferenca_ms', c.diferenca_ms, 'incerteza_ms', c.incerteza_ms,
      'situacao', c.situacao, 'fonte', c.fonte,
      'valida', c.situacao in ('OK', 'ATENCAO') and c.conferido_em > clock_timestamp() - interval '30 minutes')
    from ponto.conferencia_hora c order by c.id desc limit 1),
    jsonb_build_object('conferido_em', null, 'diferenca_ms', null, 'incerteza_ms', null, 'situacao', 'SEM_RESPOSTA', 'fonte', null, 'valida', false))
$$;
create or replace function public.hora_oficial_4j()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return ponto.hora_atual_4j();
end $$;
revoke all on function public.hora_oficial_4j() from public, anon;
grant execute on function public.hora_oficial_4j() to authenticated;

-- Gestão (administrador): histórico das conferências + conferência da cadeia de hash.
create or replace function public.admin_conferencias_hora_4j(p_limite integer default 48)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r ponto.conferencia_hora; anterior text := null; ok boolean := true; total bigint := 0; fora bigint := 0; sem bigint := 0;
begin
  if not public.is_active_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if p_limite is null or p_limite not between 1 and 500 then raise exception 'limite_invalido' using errcode = '22023'; end if;
  for r in select * from ponto.conferencia_hora order by id loop
    total := total + 1;
    if r.hash_anterior is distinct from anterior or ponto.hash(ponto.canonico_hora(r)) <> r.hash then ok := false; end if;
    anterior := r.hash;
  end loop;
  select count(*) filter (where situacao = 'FORA_DO_LIMITE'), count(*) filter (where situacao = 'SEM_RESPOSTA')
    into fora, sem from ponto.conferencia_hora where conferido_em > clock_timestamp() - interval '30 days';
  return jsonb_build_object('atual', ponto.hora_atual_4j(), 'cadeia_ok', ok, 'total', total, 'fora_30d', fora, 'sem_resposta_30d', sem,
    'lista', coalesce((select jsonb_agg(jsonb_build_object('conferido_em', c.conferido_em, 'diferenca_ms', c.diferenca_ms,
      'incerteza_ms', c.incerteza_ms, 'situacao', c.situacao, 'fonte', c.fonte) order by c.id desc)
      from (select * from ponto.conferencia_hora order by id desc limit p_limite) c), '[]'::jsonb));
end $$;
revoke all on function public.admin_conferencias_hora_4j(integer) from public, anon;
grant execute on function public.admin_conferencias_hora_4j(integer) to authenticated;

-- Segredo próprio do agendamento do ponto (gerado no banco; nunca aparece no repositório nem em log).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'metallo_cron_ponto', 'Agendamentos do ponto e avisos (4J/3U)')
  where not exists (select 1 from vault.secrets where name = 'metallo_cron_ponto');

-- Conferência a cada 10 minutos.
select cron.schedule('metallo-hora-oficial', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://cvimwiqokkujfhwynhmt.supabase.co/functions/v1/hora-oficial',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-metallo-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_ponto')),
    body := '{"acao":"conferir"}'::jsonb, timeout_milliseconds := 30000);
$job$);

select '4J pronto' as status;
