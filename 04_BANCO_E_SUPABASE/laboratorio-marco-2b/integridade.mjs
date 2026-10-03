// Verificador SQL somente leitura. Não recria schema, trigger, evento ou resultado.
import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = 2;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const iso = value => new Date(value).toISOString();
export function eventHash(event) {
  if ((event.hash_version ?? 1) !== 1) throw Error('HASH_VERSION_DESCONHECIDA');
  return sha256(JSON.stringify([event.event_id,event.auth_user_id,event.idempotency_key,event.contract_version,
    event.worker_snapshot_ref,event.employment_snapshot_ref,event.employer_snapshot_ref,event.establishment_snapshot_ref,
    event.context_version,iso(event.server_received_at_utc),iso(event.server_committed_at_utc),event.collector_version,event.channel]));
}
export async function inventory(db) {
  const events = (await db.query('select * from lab_time_event order by event_id')).rows;
  const results = (await db.query('select * from lab_intent_result order by idempotency_key')).rows;
  const contexts = (await db.query('select * from lab_context order by auth_user_id')).rows;
  const metadata = (await db.query('select * from lab_recovery_state')).rows;
  return JSON.parse(JSON.stringify({events,results,contexts,metadata}));
}
export function eventDigest(snapshot) {
  // Conjunto completo de originais/resultados; alterações normais de contexto não são originais.
  return sha256(JSON.stringify([snapshot.events,snapshot.results]));
}
const expectedColumns = {
  lab_context: ['auth_user_id','source_employee_id','worker_ref','employment_ref','employer_ref','establishment_ref','active','context_status','context_version','context_updated_at','valid_until'],
  lab_time_event: ['event_id','auth_user_id','idempotency_key','contract_version','worker_snapshot_ref','employment_snapshot_ref','employer_snapshot_ref','establishment_snapshot_ref','context_version','server_received_at_utc','server_committed_at_utc','collector_version','channel','payload_hash','created_at','hash_version'],
  lab_intent_result: ['idempotency_key','auth_user_id','request_hash','event_id'],
  lab_recovery_state: ['singleton','schema_version','database_id','recovery_epoch'],
};
const requiredConstraints = {
  lab_context: ['PRIMARY KEY (auth_user_id)','UNIQUE (source_employee_id)','UNIQUE (worker_ref)','UNIQUE (employment_ref)',"CHECK ((context_status = ANY (ARRAY['active'::text, 'inactive'::text, 'revoked'::text, 'ambiguous'::text, 'invalid'::text])))",'CHECK ((context_version > 0))'],
  lab_time_event: ['PRIMARY KEY (event_id)','UNIQUE (idempotency_key)','FOREIGN KEY (auth_user_id) REFERENCES lab_context(auth_user_id)','CHECK ((contract_version = 1))',"CHECK ((channel = 'metallo-colaborador-lab'::text))","CHECK ((payload_hash ~ '^[0-9a-f]{64}$'::text))",'CHECK ((hash_version = 1))'],
  lab_intent_result: ['PRIMARY KEY (idempotency_key)','UNIQUE (event_id)','FOREIGN KEY (idempotency_key) REFERENCES lab_time_event(idempotency_key)','FOREIGN KEY (event_id) REFERENCES lab_time_event(event_id)',"CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))"],
  lab_recovery_state: ['PRIMARY KEY (singleton)','CHECK (singleton)','CHECK ((schema_version = 2))','CHECK ((recovery_epoch >= 0))'],
};
export async function verifyIntegrity(db, {legacy = false} = {}) {
  const reasons = [];
  const fail = code => { if (!reasons.includes(code)) reasons.push(code); };
  let schemaOk = true, appendOnlyOk = false, snapshot = null;
  try {
    const columns = (await db.query("select table_name,column_name,is_nullable,data_type from information_schema.columns where table_schema='public' order by ordinal_position")).rows;
    for (const [table, names] of Object.entries(expectedColumns)) {
      if (legacy && table === 'lab_recovery_state') continue;
      const expected = legacy ? names.filter(name => name !== 'hash_version') : names;
      const actual = columns.filter(row => row.table_name === table);
      if (actual.map(row => row.column_name).join() !== expected.join() || actual.some(row => row.is_nullable !== 'NO')) { schemaOk = false; fail('SCHEMA_COLUNAS'); }
      for(const row of actual){
        const name=row.column_name;
        const type=name.endsWith('_id')||name==='idempotency_key'?'uuid':['active','singleton'].includes(name)?'boolean':name.endsWith('_at')||name.endsWith('_at_utc')||name==='valid_until'?'timestamp with time zone':['context_version','contract_version','hash_version','schema_version','recovery_epoch'].includes(name)?'integer':'text';
        if(row.data_type!==type){schemaOk=false;fail('SCHEMA_TIPOS');}
      }
    }
    const constraints = (await db.query("select c.conrelid::regclass::text as table_name,pg_get_constraintdef(c.oid) as definition,c.convalidated from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public'")).rows;
    for (const [table, definitions] of Object.entries(requiredConstraints)) {
      if (legacy && table === 'lab_recovery_state') continue;
      if (definitions.filter(definition=>!legacy||!definition.includes('hash_version')).some(definition => !constraints.some(row => row.table_name === table && row.definition === definition && row.convalidated))) { schemaOk = false; fail('SCHEMA_CONSTRAINTS'); }
    }
    const triggers = (await db.query("select t.tgname,t.tgenabled,t.tgtype,p.prosrc,p.prosecdef,p.proconfig from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='lab_time_event'::regclass and not t.tgisinternal")).rows;
    const expectedBody = "begin raise exception 'Original sintético imutável'; end";
    appendOnlyOk = triggers.length === 1 && triggers[0].tgname === 'lab_event_no_update_delete' && triggers[0].tgenabled === 'O' && triggers[0].tgtype === 27 && triggers[0].prosrc.trim().replace(/\s+/g,' ') === expectedBody && !triggers[0].prosecdef && triggers[0].proconfig===null;
    if (!appendOnlyOk) fail('APPEND_ONLY_INVALIDO');
    const events = (await db.query('select * from lab_time_event order by event_id')).rows;
    // O contrato v1 gera horários com precisão de milissegundos. Date/JSON arredondariam
    // silenciosamente uma adulteração sub-ms; inspecionar o valor SQL antes da conversão.
    const imprecise = (await db.query("select count(*)::int as n from lab_time_event where date_trunc('milliseconds',server_received_at_utc)<>server_received_at_utc or date_trunc('milliseconds',server_committed_at_utc)<>server_committed_at_utc")).rows[0].n;
    if(imprecise)fail('TIMESTAMP_PRECISAO_NAO_SUPORTADA');
    const results = (await db.query('select * from lab_intent_result order by idempotency_key')).rows;
    const contexts = (await db.query('select * from lab_context order by auth_user_id')).rows;
    const metadata = legacy ? [] : (await db.query('select * from lab_recovery_state')).rows;
    snapshot = JSON.parse(JSON.stringify({events,results,contexts,metadata}));
    if (!legacy && (metadata.length !== 1 || metadata[0].singleton !== true || metadata[0].schema_version !== SCHEMA_VERSION || !Number.isSafeInteger(metadata[0].recovery_epoch) || metadata[0].recovery_epoch < 0 || !/^[\da-f-]{36}$/.test(metadata[0].database_id))) fail('SCHEMA_VERSION_OU_GERACAO');
    const keys = new Set();
    // Índices efêmeros desta verificação integral. Nada é reutilizado entre chamadas.
    const contextIds = new Set(contexts.map(context => context.auth_user_id));
    const resultsByEvent = new Map(), eventsById = new Map();
    for (const result of results) {
      const group = resultsByEvent.get(result.event_id) ?? [];
      group.push(result); resultsByEvent.set(result.event_id, group);
    }
    for (const event of events) {
      const group = eventsById.get(event.event_id) ?? [];
      group.push(event); eventsById.set(event.event_id, group);
    }
    for (const event of events) {
      if (keys.has(event.idempotency_key)) fail('CHAVE_DUPLICADA');
      keys.add(event.idempotency_key);
      try { if (eventHash(event) !== event.payload_hash) fail('HASH_DIVERGENTE'); } catch { fail('HASH_VERSION_OU_TIMESTAMP'); }
      if (!event.created_at || !Number.isFinite(Date.parse(event.created_at)) || !event.server_received_at_utc || !event.server_committed_at_utc) fail('TIMESTAMP_INVALIDO');
      if (event.contract_version !== 1 || event.channel !== 'metallo-colaborador-lab' || !Number.isInteger(event.context_version) || event.context_version < 1) fail('CONTRATO_EVENTO');
      if (!contextIds.has(event.auth_user_id)) fail('CONTEXTO_ORFAO');
      const matches = (resultsByEvent.get(event.event_id) ?? []).filter(result => result.idempotency_key === event.idempotency_key && result.auth_user_id === event.auth_user_id && result.request_hash === sha256(JSON.stringify([event.contract_version])));
      if (matches.length !== 1) fail('RESULTADO_INCOERENTE');
    }
    if (results.length !== events.length || results.some(result => !(eventsById.get(result.event_id) ?? []).some(event => event.idempotency_key === result.idempotency_key && event.auth_user_id === result.auth_user_id))) fail('RESULTADO_ORFAO');
  } catch { schemaOk = false; fail('BANCO_OU_SCHEMA_INACESSIVEL'); }
  return {status:reasons.length?'FAIL':'PASS',passed:reasons.length===0,schema_ok:schemaOk,append_only_ok:appendOnlyOk,reasons,snapshot,
    digest:snapshot?eventDigest(snapshot):null,event_count:snapshot?.events.length??null};
}
