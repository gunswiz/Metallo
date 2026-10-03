// Reaplica somente as quatro funções corrigidas no Supabase Docker local.
// A fonte única das definições permanece contrato-entrega-confirmacao.sql.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

const source = readFileSync(new URL("./contrato-entrega-confirmacao.sql", import.meta.url), "utf8");
const names = ["prepare_epi_kit_3d", "register_epi_delivery_3d", "my_epi_delivery_groups_3d", "admin_epi_delivery_feedback_3d"];
const definitions = names.map(name => {
  const start = source.indexOf(`create function public.${name}(`);
  assert.ok(start >= 0, `Definição ${name} ausente`);
  const next = source.indexOf(`\nalter function public.${name}(`, start);
  assert.ok(next > start, `Final ${name} ausente`);
  const grantEnd = source.indexOf(";", source.indexOf(`grant execute on function public.${name}(`, next));
  assert.ok(grantEnd > next, `Grant ${name} ausente`);
  return source.slice(start, grantEnd + 1).replace(/^create function/, "create or replace function");
});

const statements = ["begin;", ...definitions.slice(0, 2),
  "drop function public.my_epi_delivery_groups_3d();",
  definitions[2].replace(/^create or replace function/, "create function"),
  definitions[3], "commit;"];
sql(statements.join("\n"));
const status = sql(`select count(*),bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace
  and p.proname in ('prepare_epi_kit_3d','register_epi_delivery_3d',
    'my_epi_delivery_groups_3d','admin_epi_delivery_feedback_3d')`);
assert.equal(status, "4|t", "Grants locais incorretos");
console.log(JSON.stringify({ applied: names, scope: "Supabase Docker local", grants: status }));
