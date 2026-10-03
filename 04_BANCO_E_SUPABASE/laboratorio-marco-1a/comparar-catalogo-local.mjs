// Compara somente metadados do PostgreSQL local com o catalogo remoto ja capturado.
// Nao abre conexao de rede nem executa SQL no projeto compartilhado.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const docker = join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe");
const container = "supabase_db_laboratorio-marco-1a";
const remote = JSON.parse(readFileSync(new URL("../../06_TESTES_E_QUALIDADE/fixtures/supabase-remoto-catalogo-20260926.json", import.meta.url), "utf8"));
if (!existsSync(docker)) throw new Error("Docker Desktop local nao encontrado.");
const endpoint = execFileSync(docker, ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
if (!endpoint.startsWith("npipe:////./pipe/")) throw new Error("Contexto Docker nao e local.");

const queries = {
  relations: `select n.nspname as schema_name,c.relname as name,c.relkind,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') order by 1,2`,
  columns: `select n.nspname as schema_name,c.relname as table_name,a.attname as name,format_type(a.atttypid,a.atttypmod) as type_name,a.attnotnull as not_null,pg_get_expr(d.adbin,d.adrelid) as default_expr,a.attidentity as identity_kind,a.attgenerated as generated_kind from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum`,
  constraints: `select n.nspname as schema_name,c.relname as table_name,k.conname as name,k.contype,pg_get_constraintdef(k.oid,true) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and k.contype <> 'n' order by 1,2,3`,
  indexes: `select n.nspname as schema_name,c.relname as table_name,i.relname as name,pg_get_indexdef(i.oid) as definition from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') order by 1,2,3`,
  policies: `select schemaname as schema_name,tablename as table_name,policyname as name,permissive,roles::text,cmd,qual,with_check from pg_policies where schemaname in ('public','private') order by 1,2,3`,
  triggers: `select n.nspname as schema_name,c.relname as table_name,t.tgname as name,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and not t.tgisinternal order by 1,2,3`,
  functions: `select n.nspname as schema_name,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as returns,p.prosecdef as security_definer,p.provolatile as volatility,p.proconfig as config,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,md5(pg_get_functiondef(p.oid)) as definition_md5,md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n')) as definition_md5_normalized,length(pg_get_functiondef(p.oid)) as definition_chars from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by 1,2,3`,
  views: `select schemaname as schema_name,viewname as name,md5(definition) as definition_md5,definition from pg_views where schemaname in ('public','private') order by 1,2`,
  extensions: `select e.extname as name,e.extversion as version,n.nspname as schema_name from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by 1`,
  grants: `select table_schema as schema_name,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4`,
  schemas: `select n.nspname as name,has_schema_privilege('anon',n.oid,'USAGE') as anon_usage,has_schema_privilege('authenticated',n.oid,'USAGE') as authenticated_usage from pg_namespace n where n.nspname not like 'pg\\_%' escape '\\' and n.nspname <> 'information_schema' order by 1`,
  auth_fks: `select n.nspname as schema_name,c.relname as table_name,k.conname as name,pg_get_constraintdef(k.oid,true) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where k.contype='f' and k.confrelid='auth.users'::regclass order by 1,2,3`,
};

function queryRows(sql) {
  const wrapped = `select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) from (${sql}) q`;
  const output = execFileSync(docker, ["exec", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", wrapped], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
  return JSON.parse(output);
}
function key(row, category) {
  if (category === "grants") return [row.schema_name, row.table_name, row.grantee, row.privilege_type].join(".");
  return [row.schema_name, row.table_name, row.name, row.arguments].filter(Boolean).join(".");
}
function comparable(row, category) {
  const value = { ...row };
  if (category === "functions" || category === "views") {
    delete value.definition_md5;
    delete value.definition_md5_normalized;
    delete value.definition_chars;
    if (category === "views") delete value.definition;
  }
  if ("definition" in value) value.definition = value.definition.replace(/\s+/g, " ").trim();
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

const local = {};
const summary = {};
for (const [category, sql] of Object.entries(queries)) {
  local[category] = queryRows(sql);
  const remoteRows = remote.catalog[category];
  const localMap = new Map(local[category].map((row) => [key(row, category), row]));
  const remoteMap = new Map(remoteRows.map((row) => [key(row, category), row]));
  const onlyRemote = [...remoteMap.keys()].filter((id) => !localMap.has(id));
  const onlyLocal = [...localMap.keys()].filter((id) => !remoteMap.has(id));
  const differing = [...remoteMap.keys()].filter((id) => localMap.has(id) && comparable(remoteMap.get(id), category) !== comparable(localMap.get(id), category));
  summary[category] = { remote: remoteRows.length, local: local[category].length, only_remote: onlyRemote.length, only_local: onlyLocal.length, differing: differing.length, examples: { only_remote: onlyRemote.slice(0, 12), only_local: onlyLocal.slice(0, 12), differing: differing.slice(0, 12) } };
  if (category === "functions") {
    const normalized = new Map(remote.normalized_function_hashes.map((row) => [key(row, category), row.normalized_md5]));
    const bodies = [...remoteMap.keys()].filter((id) => localMap.has(id) && normalized.get(id) !== localMap.get(id).definition_md5_normalized);
    summary.functions.body_fingerprint_different = bodies.length;
    summary.functions.body_examples = bodies.slice(0, 12);
  }
}

const stamp = new Date().toISOString();
const phase = process.argv.includes("--post1a") ? "post1a" : "pre1a";
const report = { captured_at: stamp, source: "Docker Desktop local; PostgreSQL 17", remote_capture: remote.captured_date, summary };
writeFileSync(new URL(`./catalogo-laboratorio-${phase}.json`, import.meta.url), JSON.stringify({ captured_at: stamp, catalog: local }, null, 2) + "\n");
writeFileSync(new URL(`./comparacao-laboratorio-${phase}.json`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
for (const [name, result] of Object.entries(summary)) {
  console.log(`${name}: remoto=${result.remote} local=${result.local} faltam=${result.only_remote} extras=${result.only_local} diferentes=${result.differing}`);
}
console.log(`Comparacao detalhada: comparacao-laboratorio-${phase}.json`);
