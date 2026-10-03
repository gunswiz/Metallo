import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const remote = JSON.parse(await readFile(new URL("../../06_TESTES_E_QUALIDADE/fixtures/supabase-remoto-catalogo-20260926.json", import.meta.url), "utf8"));
const snapshot = JSON.parse(await readFile(new URL("./catalogo-remoto-funcoes.json", import.meta.url), "utf8"));
const key = (row) => [row.schema_name, row.name, row.arguments].join("|");
const expected = new Map(remote.normalized_function_hashes.map((row) => [key(row), row.normalized_md5]));

if (snapshot.functions.length !== 57 || expected.size !== 57) throw new Error("catalogo_funcoes_incompleto");
for (const fn of snapshot.functions) {
  const hash = createHash("md5").update(fn.definition.replace(/\r\n/g, "\n")).digest("hex");
  if (hash !== expected.get(key(fn))) throw new Error(`funcao_remota_divergente: ${key(fn)}`);
}
console.log(`Corpos das funções remotas preservados: ${snapshot.functions.length}/57 conferidos.`);
