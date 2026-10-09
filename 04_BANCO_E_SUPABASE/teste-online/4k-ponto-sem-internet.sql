-- Marco 4K (TESTE ONLINE, dados fictícios): ponto sem internet.
-- Portaria 671/2021, Anexo IX, itens 4 e 5: o coletor pode, excepcionalmente, ficar sem conexão; as marcações
-- feitas assim devem ser enviadas no primeiro momento em que ele voltar a ficar on-line. No AFD (registro tipo 7,
-- posição 73) a marcação sai com "1" = off-line. O NSR é dado na chegada ao servidor (data de gravação).
-- A hora vem do celular, corrigida pela última conferência com o servidor. Cada marcação sem internet guarda a
-- "prova" dessa hora; se algo não bater, ela chega marcada "conferir" para a Gestão olhar — nunca é alterada.

alter table ponto.marcacao drop constraint if exists marcacao_online_check;

create table if not exists ponto.marcacao_offline (
  event_id uuid primary key references ponto.marcacao(event_id),
  nsr bigint not null unique,
  metodo text not null check (metodo in ('RELOGIO_CONTINUO', 'RELOGIO_DO_CELULAR', 'SEM_CONFERENCIA', 'HORA_DO_SERVIDOR')),
  hora_aparelho timestamptz,
  ajuste_ms bigint,
  sincronizado_em timestamptz,
  desvio_envio_ms bigint,
  conferir boolean not null,
  motivos text[] not null default '{}',
  recebido_em timestamptz not null default clock_timestamp()
);
create or replace trigger imutavel before update or delete on ponto.marcacao_offline for each row execute function ponto.imutavel();
create or replace trigger imutavel_truncate before truncate on ponto.marcacao_offline for each statement execute function ponto.imutavel();
revoke all on ponto.marcacao_offline from public, anon, authenticated, service_role;

create or replace function ponto.registrar_offline(p_user uuid, p_session uuid, p_key uuid, p_marking_at timestamptz, p_location jsonb, p_prova jsonb)
returns table(marcacao ponto.marcacao, duplicate boolean, conferir boolean)
language plpgsql set search_path = '' as $$
declare a record; i ponto.intencao; m ponto.marcacao; c ponto.contador_nsr; loc jsonb := p_location; captured timestamptz; req text; v_cpf text;
  agora timestamptz := clock_timestamp(); marca timestamptz; v_metodo text; aparelho timestamptz; ajuste bigint; sinc timestamptz;
  aparelho_agora timestamptz; desvio bigint; v_motivos text[] := '{}'; v_conferir boolean;
begin
  a := ponto.ator(p_user, p_session);
  if p_key is null or p_marking_at is null or p_prova is null or jsonb_typeof(p_prova) <> 'object' then
    raise exception 'PEDIDO_INVALIDO' using errcode = 'P0001'; end if;
  if (p_prova->>'employee_id') is distinct from a.employee_id::text then raise exception 'FUNCIONARIO_DIFERENTE' using errcode = 'P0001'; end if;
  v_metodo := p_prova->>'metodo';
  if v_metodo is null or v_metodo not in ('RELOGIO_CONTINUO', 'RELOGIO_DO_CELULAR', 'SEM_CONFERENCIA') then raise exception 'PEDIDO_INVALIDO' using errcode = 'P0001'; end if;
  begin
    aparelho := (p_prova->>'hora_aparelho')::timestamptz; ajuste := (p_prova->>'ajuste_ms')::bigint;
    sinc := (p_prova->>'sincronizado_em')::timestamptz; aparelho_agora := (p_prova->>'aparelho_agora')::timestamptz;
  exception when others then raise exception 'PEDIDO_INVALIDO' using errcode = 'P0001'; end;
  if ajuste is not null and abs(ajuste) > 31536000000 then raise exception 'PEDIDO_INVALIDO' using errcode = 'P0001'; end if;

  select * into c from ponto.contador_nsr where singleton for update;
  -- Mesma chave já registrada (ex.: a internet caiu depois de enviar): devolve a original, sem duplicar.
  select * into m from ponto.marcacao x where x.idempotency_key = p_key;
  if m.nsr is not null then
    if m.auth_user_id <> p_user then raise exception 'INTENCAO_CONFLITANTE' using errcode = 'P0001'; end if;
    return query select m, true, coalesce((select y.conferir from ponto.marcacao_offline y where y.event_id = m.event_id), false); return;
  end if;
  select x.cpf into v_cpf from private.employee_cpf_4f x where x.employee_id = a.employee_id;
  if v_cpf is null then raise exception 'CPF_NAO_CADASTRADO' using errcode = 'P0001'; end if;

  marca := date_trunc('milliseconds', p_marking_at);
  select * into i from ponto.intencao x where x.idempotency_key = p_key;
  if i.idempotency_key is not null then
    -- A marcação começou com internet (o servidor já anotou a hora) e caiu no meio: vale a hora do servidor.
    if i.auth_user_id <> p_user or i.employee_id <> a.employee_id then raise exception 'INTENCAO_CONFLITANTE' using errcode = 'P0001'; end if;
    marca := i.marking_at; v_metodo := 'HORA_DO_SERVIDOR';
  else
    if marca > agora + interval '5 minutes' then raise exception 'MARCACAO_NO_FUTURO' using errcode = 'P0001'; end if;
    if marca < agora - interval '7 days' then raise exception 'MARCACAO_OFFLINE_ANTIGA' using errcode = 'P0001'; end if;
    if marca > agora then marca := date_trunc('milliseconds', agora); v_motivos := array_append(v_motivos, 'HORA_A_FRENTE_DO_SERVIDOR'); end if;
    if v_metodo = 'SEM_CONFERENCIA' or sinc is null then v_motivos := array_append(v_motivos, 'CELULAR_SEM_CONFERENCIA_DE_HORA');
    else
      if sinc > agora + interval '1 minute' or marca < sinc - interval '1 minute' then v_motivos := array_append(v_motivos, 'HORA_ANTES_DA_ULTIMA_CONFERENCIA'); end if;
      if marca - sinc > interval '3 days' then v_motivos := array_append(v_motivos, 'CONFERENCIA_DE_HORA_ANTIGA'); end if;
    end if;
    if v_metodo = 'RELOGIO_DO_CELULAR' and (aparelho is null or ajuste is null
      or abs(extract(epoch from (marca - (aparelho + ajuste * interval '1 millisecond')))) > 2) then v_motivos := array_append(v_motivos, 'HORA_INCOERENTE'); end if;
    if aparelho_agora is not null and ajuste is not null then
      desvio := round(extract(epoch from (agora - aparelho_agora)) * 1000)::bigint - ajuste;
      if abs(desvio) > 30000 then v_motivos := array_append(v_motivos, 'RELOGIO_DO_CELULAR_MUDOU'); end if;
    end if;
    insert into ponto.intencao(idempotency_key, auth_user_id, employee_id, marking_at) values (p_key, p_user, a.employee_id, marca);
  end if;

  if (select count(*) from ponto.marcacao x join ponto.marcacao_offline y on y.event_id = x.event_id where x.employee_id = a.employee_id
      and (x.marking_at at time zone 'America/Fortaleza')::date = (marca at time zone 'America/Fortaleza')::date) >= 12 then
    raise exception 'LIMITE_OFFLINE' using errcode = 'P0001'; end if;
  if v_metodo <> 'HORA_DO_SERVIDOR' and exists (select 1 from ponto.marcacao x where x.employee_id = a.employee_id
      and x.marking_at between marca - interval '60 seconds' and marca + interval '60 seconds') then
    raise exception 'MARCACAO_REPETIDA' using errcode = 'P0001'; end if;

  if loc ? 'captured_at' and loc->>'captured_at' is not null then
    captured := (loc->>'captured_at')::timestamptz;
    if captured - marca > interval '150 seconds' or marca - captured > interval '10 minutes' then
      loc := jsonb_build_object('status','UNKNOWN','latitude',null,'longitude',null,'accuracy_meters',null,'captured_at',null,
        'provider','BROWSER_GEOLOCATION','mock_signal','NOT_EXPOSED');
    end if;
  end if;
  req := ponto.hash(loc::text);
  v_conferir := cardinality(v_motivos) > 0;

  m.nsr := c.ultimo_nsr + 1; m.event_id := gen_random_uuid(); m.idempotency_key := p_key;
  m.auth_user_id := p_user; m.employee_id := a.employee_id; m.employee_name := a.employee_name; m.employee_code := a.employee_code;
  m.marking_at := marca; m.recorded_at := date_trunc('milliseconds', clock_timestamp());
  m.timezone := 'America/Fortaleza'; m.collector := 'BROWSER'; m.online := false; m.location := loc; m.request_hash := req;
  m.previous_hash := c.ultimo_hash; m.hash_version := 1;
  m.payload_hash := ponto.hash(ponto.canonico(m));
  m.employee_cpf := v_cpf;
  m.afd_hash := ponto.hash(ponto.afd_linha7(m) || coalesce(c.ultimo_afd_hash, ''));
  insert into ponto.marcacao select m.*;
  insert into ponto.marcacao_offline(event_id, nsr, metodo, hora_aparelho, ajuste_ms, sincronizado_em, desvio_envio_ms, conferir, motivos)
    values (m.event_id, m.nsr, v_metodo, aparelho, ajuste, sinc, desvio, v_conferir, v_motivos);
  update ponto.contador_nsr set ultimo_nsr = m.nsr, ultimo_hash = m.payload_hash, ultimo_afd_hash = m.afd_hash where singleton;
  return query select m, false, v_conferir;
end $$;
revoke all on function ponto.registrar_offline(uuid, uuid, uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated, service_role;

select '4K pronto' as status;
