// Cria exclusivamente contas e funcionários sintéticos no laboratório já iniciado.
// A credencial service_role permanece em memória. O arquivo local fica em backups/ (ignorado pelo Git).
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { revokePortalAccountLocal } from "./revogar-conta-portal-servidor.mjs";

const lab = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(root, "node_modules", "supabase", "dist", "supabase.js");
const docker = join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe");
const status = JSON.parse(execFileSync(process.execPath, [cli, "status", "--workdir", lab, "-o", "json"], { encoding: "utf8" }));
assert.equal(status.API_URL, "http://127.0.0.1:54321");
const endpoint = execFileSync(docker, ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
assert.ok(endpoint.startsWith("npipe:////./pipe/"), "Docker deve ser local");
export const base = status.API_URL;
export const anon = status.ANON_KEY;
const service = status.SERVICE_ROLE_KEY;
const runId = Date.now().toString(36);
export function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
export function sql(query) { return execFileSync(docker, ["exec", "supabase_db_laboratorio-marco-1a", "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", query], { encoding: "utf8" }).trim(); }
async function api(path, key, bearer, body, method = "POST") {
  const response = await fetch(base + path, { method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
async function create(name, kind) {
  const email = `previa-${kind}-${runId}@example.invalid`;
  const password = `Lab!${randomBytes(18).toString("base64url")}`;
  const token = randomUUID();
  await api("/rest/v1/rpc/issue_user_provisioning_ticket", service, service, { p_email: email, p_token: token });
  const user = await api("/auth/v1/admin/users", service, service, { email, password, email_confirm: true, user_metadata: { full_name: name, metallo_provisioning_token: token }, app_metadata: { metallo_provisioned: true, ...(kind !== "admin" ? { metallo_account_type: "employee_portal" } : {}) } });
  return { id: user.id, email, password };
}
export async function createPreviewAdminSession() {
const admin = await create("Admin Prévia Sintético", "admin");
sql(`update public.profiles set role='admin', active=true where id=${quote(admin.id)}::uuid`);
const adminSession = await api("/auth/v1/token?grant_type=password", anon, anon, { email: admin.email, password: admin.password });
return { admin, adminSession };
}
export async function createPreviewAccounts() {
const { admin, adminSession } = await createPreviewAdminSession();
const team = sql(`insert into public.teams(name,location_type,active) values('Equipe Prévia ${runId}', 'field', true) returning id`);
assert.match(team, /^[0-9a-f-]{36}$/);
const accounts = {};
for (const [kind, name] of [["joao", "João Sintético"], ["maria", "Maria Sintética"], ["revogada", "Conta Revogada Sintética"], ["banida", "Conta Banida Sintética"], ["inativo", "Funcionário Inativo Sintético"], ["expira", "Sessão Sintética Temporária"]]) {
  const user = await create(name, kind);
  const code = `PREVIA-${kind}-${runId}`;
  const employeeId = sql(`insert into public.epi_employees(full_name,registration_code,profession,team_id,created_by) values(${quote(name)},${quote(code)},'Profissão de teste',${quote(team)}::uuid,${quote(admin.id)}::uuid) returning id`);
  await api("/rest/v1/rpc/admin_register_portal_account", anon, adminSession.access_token, { p_auth_user_id: user.id });
  const identityId = await api("/rest/v1/rpc/admin_link_employee_identity", anon, adminSession.access_token, { p_auth_user_id: user.id, p_employee_id: employeeId, p_expected_employee_name: name, p_expected_registration_code: code, p_verification_method: "in_person" });
  accounts[kind] = { ...user, name, employeeId, identityId, team };
  if (kind === "banida") await api(`/auth/v1/admin/users/${user.id}`, service, service, { ban_duration: "24h" }, "PUT");
  if (kind === "inativo") sql(`update public.epi_employees set active=false where id=${quote(employeeId)}::uuid`);
  if (kind === "revogada") await revokePortalAccountLocal({ apiUrl: base, serviceRoleKey: service, adminAccessToken: adminSession.access_token, identityId, reason: "other" });
}
return { accounts, team, admin, adminAccessToken: adminSession.access_token };
}
export async function banPreviewAccount(id) {
  return api(`/auth/v1/admin/users/${id}`, service, service, { ban_duration: "24h" }, "PUT");
}
export async function revokePreviewAccount(identityId, adminAccessToken) {
  return revokePortalAccountLocal({ apiUrl: base, serviceRoleKey: service, adminAccessToken, identityId, reason: "other" });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const { accounts } = await createPreviewAccounts();
const targetDir = join(root, "backups");
mkdirSync(targetDir, { recursive: true });
const target = join(targetDir, "credenciais-previa-colaborador.json");
writeFileSync(target, JSON.stringify({ created_at: new Date().toISOString(), note: "Contas sintéticas locais. Não usar em projeto remoto.", ...accounts }, null, 2) + "\n", { mode: 0o600 });
console.log(`Contas sintéticas criadas: João, Maria e revogada. Credenciais locais: ${target}`);

}
