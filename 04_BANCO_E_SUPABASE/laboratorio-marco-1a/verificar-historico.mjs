import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const directory = new URL("./historico-remoto/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifesto.json", directory), "utf8"));

if (manifest.entries.length !== 33) throw new Error("historico_remoto_incompleto");
for (const entry of manifest.entries) {
  if (!/^\d{14}$/.test(entry.version) || !/^[a-z0-9_]+$/.test(entry.name)) {
    throw new Error("nome_de_migration_invalido");
  }
  const filename = `${entry.version}_${entry.name}.sql`;
  const sql = (await readFile(new URL(filename, directory), "utf8"))
    .replace(/\r\n/g, "\n")
    .replace(/\n+$/, "");
  const localHash = createHash("md5").update(sql).digest("hex");
  if (localHash !== entry.normalized_md5) {
    throw new Error(`historico_remoto_divergente: ${filename}`);
  }
}
console.log(`Histórico remoto preservado: ${manifest.entries.length}/33 SQLs conferidos.`);
