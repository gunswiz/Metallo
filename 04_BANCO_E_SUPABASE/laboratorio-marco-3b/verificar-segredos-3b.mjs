// Varredura local do 3B; aceita ZIP opcional para inspeção direta antes do Grok.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const status = JSON.parse(execFileSync(process.execPath, [resolve(root, "node_modules/supabase/dist/supabase.js"), "status", "--workdir", resolve(root, "04_BANCO_E_SUPABASE/laboratorio-marco-1a"), "-o", "json"], { encoding: "utf8" }));
assert.equal(status.API_URL, "http://127.0.0.1:54321");
const credentials = resolve(root, "backups/credenciais-previa-colaborador.json");
const saved = existsSync(credentials) ? JSON.parse(readFileSync(credentials, "utf8")) : {};
const values = [status.SERVICE_ROLE_KEY, status.JWT_SECRET,
  ...Object.values(saved).filter(value => value && typeof value === "object").map(value => value.password)]
  .filter(value => typeof value === "string" && value.length >= 20);
const paths = [
  "01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts",
  "01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts",
  "01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx",
  "01_WEB/app/colaborador/[[...screen]]/meu-perfil.tsx",
  "01_WEB/app/colaborador/[[...screen]]/meus-epis.tsx",
  "01_WEB/app/colaborador/[[...screen]]/colaborador.module.css",
  "01_WEB/10_TESTES/colaborador-epis.test.tsx",
  "04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql",
  "04_BANCO_E_SUPABASE/laboratorio-marco-3b/provas-3b.mjs",
  "04_BANCO_E_SUPABASE/laboratorio-marco-3b/resultado-3b.json",
  "05_DOCUMENTACAO/40_MARCO_3B_MEUS_EPIS.md",
];
const bundles = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(js|css)$/.test(entry.name)) bundles.push(path);
  }
}
for (const path of ["01_WEB/.next-local-preview/dev/static/chunks", "01_WEB/.next-local-preview/static/chunks", "01_WEB/.next/static/chunks"]) walk(resolve(root, path));
const findings = [];
let bytes = 0;
function scan(path, content) {
  if (values.some(value => content.includes(value))) findings.push({ file: path, kind: "valor sensível local" });
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(content)) findings.push({ file: path, kind: "sb_secret" });
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content)) findings.push({ file: path, kind: "chave privada PEM" });
}
for (const path of [...paths.map(path => resolve(root, path)), ...bundles]) {
  assert.ok(existsSync(path), `Arquivo esperado ausente: ${relative(root, path)}`);
  bytes += statSync(path).size;
  scan(relative(root, path).replaceAll("\\", "/"), readFileSync(path, "utf8"));
}
let zip = null;
if (process.argv[2]) {
  const zipPath = resolve(process.argv[2]);
  assert.ok(existsSync(zipPath));
  const names = execFileSync("tar", ["-tf", zipPath], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  for (const name of names) if (/(^|\/)(?:\.env(?:\.|$)|backups\/|cookies?|.*private.*\.key$)/i.test(name)) findings.push({ file: name, kind: "arquivo indevido" });
  scan(`ZIP:${relative(root, zipPath)}`, execFileSync("tar", ["-xOf", zipPath], { maxBuffer: 40 * 1024 * 1024 }).toString("utf8"));
  zip = { path: relative(root, zipPath).replaceAll("\\", "/"), entries: names.length, sha256: createHash("sha256").update(readFileSync(zipPath)).digest("hex") };
}
const report = { at: new Date().toISOString(), scope: "fontes e bundles locais 3B" + (zip ? "; ZIP final" : ""), sourceFiles: paths.length, clientBundles: bundles.length, bytes, zip, findings, passed: findings.length === 0 };
writeFileSync(new URL("./resultado-segredos-3b.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ passed: report.passed, sourceFiles: report.sourceFiles, clientBundles: report.clientBundles, zip: report.zip, findings: findings.length }));
if (!report.passed) process.exitCode = 1;
