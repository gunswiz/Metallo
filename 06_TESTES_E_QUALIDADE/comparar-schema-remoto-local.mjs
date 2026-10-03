// Diagnostic comparison only. It never connects to or changes the remote project.
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const remote = JSON.parse(await readFile(new URL("./fixtures/supabase-remoto-catalogo-20260926.json", import.meta.url), "utf8"));
const db = new PGlite();

const queries = {
  relations: `select n.nspname as schema_name,c.relname as name,c.relkind,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') order by 1,2`,
  columns: `select n.nspname as schema_name,c.relname as table_name,a.attname as name,format_type(a.atttypid,a.atttypmod) as type_name,a.attnotnull as not_null,pg_get_expr(d.adbin,d.adrelid) as default_expr,a.attidentity as identity_kind,a.attgenerated as generated_kind from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum`,
  constraints: `select n.nspname as schema_name,c.relname as table_name,k.conname as name,k.contype,pg_get_constraintdef(k.oid,true) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') order by 1,2,3`,
  indexes: `select n.nspname as schema_name,c.relname as table_name,i.relname as name,pg_get_indexdef(i.oid) as definition from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') order by 1,2,3`,
  policies: `select schemaname as schema_name,tablename as table_name,policyname as name,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private') order by 1,2,3`,
  triggers: `select n.nspname as schema_name,c.relname as table_name,t.tgname as name,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and not t.tgisinternal order by 1,2,3`,
  functions: `select n.nspname as schema_name,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as returns,p.prosecdef as security_definer,p.provolatile as volatility,p.proconfig as config,has_function_privilege('anon',p.oid,'execute') as anon_execute,has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,md5(pg_get_functiondef(p.oid)) as definition_md5,md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n')) as definition_md5_normalized,length(pg_get_functiondef(p.oid)) as definition_chars from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by 1,2,3`,
  views: `select schemaname as schema_name,viewname as name,md5(definition) as definition_md5,definition from pg_views where schemaname in ('public','private') order by 1,2`,
  grants: `select table_schema as schema_name,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role') order by 1,2,3,4`,
  auth_fks: `select n.nspname as schema_name,c.relname as table_name,k.conname as name,pg_get_constraintdef(k.oid,true) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where k.contype='f' and k.confrelid='auth.users'::regclass order by 1,2,3`,
};

function key(row, category) {
  if (category === "grants") return [row.schema_name, row.table_name, row.grantee, row.privilege_type].join(".");
  return [row.schema_name, row.table_name, row.name, row.arguments].filter(Boolean).join(".");
}

function comparable(row, category) {
  const clone = { ...row };
  if (category === "functions" || category === "views") {
    // PostgreSQL/PGlite can print equivalent definitions differently. Report
    // body fingerprints separately from signature and privilege differences.
    delete clone.definition_md5;
    delete clone.definition_md5_normalized;
    delete clone.definition_chars;
    if (category === "views") delete clone.definition;
  }
  if (category === "policies" && typeof clone.roles === "string") {
    clone.roles = clone.roles.slice(1, -1).split(",");
  }
  if ("definition" in clone) clone.definition = clone.definition.replace(/\s+/g, " ").trim();
  return JSON.stringify(clone);
}

try {
  for (const path of [
    "./fixtures/metallo-0.9.8-schema.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
  ]) {
    await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  const results = {};
  for (const [category, query] of Object.entries(queries)) {
    const localRows = (await db.query(query)).rows.filter((row) => category !== "constraints" || row.contype !== "n");
    const remoteRows = remote.catalog[category].filter((row) => category !== "constraints" || row.contype !== "n");
    const localMap = new Map(localRows.map((row) => [key(row, category), row]));
    const remoteMap = new Map(remoteRows.map((row) => [key(row, category), row]));
    const onlyRemote = [...remoteMap.keys()].filter((id) => !localMap.has(id));
    const onlyLocal = [...localMap.keys()].filter((id) => !remoteMap.has(id));
    const differing = [...remoteMap.keys()].filter((id) => localMap.has(id) && comparable(remoteMap.get(id), category) !== comparable(localMap.get(id), category));
    results[category] = {
      remote: remoteRows.length,
      local: localRows.length,
      only_remote: onlyRemote.length,
      only_local: onlyLocal.length,
      differing: differing.length,
      examples: { only_remote: onlyRemote.slice(0, 6), only_local: onlyLocal.slice(0, 6), differing: differing.slice(0, 6) },
    };
    if (category === "functions" || category === "views") {
      const normalized = new Map((remote.normalized_function_hashes ?? []).map((row) => [key(row, "functions"), row.normalized_md5]));
      const bodyDiff = [...remoteMap.keys()].filter((id) => localMap.has(id) && (category === "functions" ? normalized.get(id) !== localMap.get(id).definition_md5_normalized : remoteMap.get(id).definition_md5 !== localMap.get(id).definition_md5));
      results[category].body_fingerprint_different = bodyDiff.length;
      results[category].body_examples = bodyDiff.slice(0, 8);
    }
    if (category === "functions") {
      const fields = ["returns", "security_definer", "volatility", "config", "anon_execute", "authenticated_execute"];
      results[category].field_differences = Object.fromEntries(fields.map((field) => [field, [...remoteMap.keys()].filter((id) => localMap.has(id) && JSON.stringify(remoteMap.get(id)[field]) !== JSON.stringify(localMap.get(id)[field])).length]));
    }
  }
  console.log(JSON.stringify({ source: remote.project_ref, fixture: "metallo-0.9.8 + local permissions/site/identity", results }, null, 2));
} finally {
  await db.close();
}
