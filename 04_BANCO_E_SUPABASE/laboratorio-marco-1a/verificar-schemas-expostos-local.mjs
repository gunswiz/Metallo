// Le apenas o endpoint REST local com limit=0; nao consulta linhas.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const lab = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(root, "node_modules", "supabase", "dist", "supabase.js");
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" };
const status = JSON.parse(execFileSync(process.execPath, [cli, "status", "--workdir", lab, "-o", "json"], { encoding: "utf8", env }));
if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("API nao e local.");
const checks = [];
for (const schema of ["codex_probe_absent", "public", "graphql_public", "private", "auth", "storage"]) {
  const response = await fetch(`${status.API_URL}/rest/v1/teams?select=id&limit=0`, {
    headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}`, "Accept-Profile": schema }
  });
  const body = await response.json();
  const result = { schema, status: response.status, code: body?.code ?? null, hint: body?.hint ?? null };
  checks.push(result);
  console.log(`${schema}: HTTP ${result.status}, ${result.code ?? "aceito"}`);
}
if (checks[0].code !== "PGRST106" || !checks[0].hint?.includes("public, graphql_public") ||
    checks[1].code === "PGRST106" || checks[2].code === "PGRST106" ||
    checks.slice(3).some((item) => item.code !== "PGRST106")) {
  throw new Error("Schemas locais nao correspondem a public + graphql_public.");
}
writeFileSync(new URL("./schemas-expostos-local.json", import.meta.url),
  JSON.stringify({ captured_at: new Date().toISOString(), method: "GET teams?select=id&limit=0; Accept-Profile", checks }, null, 2) + "\n");
