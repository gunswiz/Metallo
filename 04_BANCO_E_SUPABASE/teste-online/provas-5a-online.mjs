// Marco 5A no TESTE ONLINE: treinamentos e ASO com vencimento. Contas e dados FICTÍCIOS. Não imprime senha nem token.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 5A no teste online (dados fictícios)", checks: [] };
function check(name, condition) { evidence.checks.push({ name, ok: Boolean(condition) }); console.log((condition ? "OK   " : "FALHA") + " " + name); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(token, name, body = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; } return { status: r.status, data }; }
async function sqlValue(text) {
  const token = readFileSync(new URL("../../tmp/token-migrador.txt", import.meta.url), "utf8").trim();
  const r = await fetch(`${BASE}/functions/v1/migrador-temporario`, { method: "POST", headers: { Authorization: `Bearer ${ANON_JWT}`, apikey: ANON_JWT,
    "x-metallo-token": token, "x-metallo-modo": "sql", "Content-Type": "text/plain" }, body: text });
  const j = await r.json(); if (!j.ok) throw new Error("migrador: " + JSON.stringify(j).slice(0, 200));
  const row = Array.isArray(j.result) ? j.result[0] : null; return row ? Object.values(row)[0] : null;
}
const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const roboId = (await rpc(robo, "my_employee_profile")).data[0].employee_id;
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const minha = await rpc(robo, "my_trainings_5a");
check("funcionário consulta a própria ficha", minha.status === 200 && typeof minha.data.situacao === "string");
check("ficha do app não traz id do funcionário nem equipe", minha.status === 200 && !("employee_id" in minha.data) && !("team_id" in minha.data));
check("funcionário não abre a visão da Gestão", (await rpc(robo, "admin_trainings_overview_5a")).status >= 400);
check("funcionário não registra treinamento", (await rpc(robo, "register_training_5a", { p_employee_id: roboId, p_type_code: "NR35", p_completed_on: hoje, p_expires_on: null, p_provider: null, p_workload_hours: null, p_note: null, p_idempotency_key: randomUUID() })).status >= 400);
check("tabelas de treinamento fora da API pública", (await fetch(`${BASE}/rest/v1/employee_trainings_5a?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${gestor}` } })).status >= 400);
const visao = await rpc(gestor, "admin_trainings_overview_5a");
check("Gestão vê a visão geral", visao.status === 200 && Array.isArray(visao.data) && visao.data.some(f => f.employee_id === roboId));
const key = randomUUID();
const r1 = await rpc(gestor, "register_training_5a", { p_employee_id: roboId, p_type_code: "NR35", p_completed_on: hoje, p_expires_on: null, p_provider: "Prova automática", p_workload_hours: 8, p_note: null, p_idempotency_key: key });
check("Gestão registra treinamento", r1.status === 200 && /^[0-9a-f-]{36}$/.test(r1.data));
check("repetição da mesma tentativa não duplica", (await rpc(gestor, "register_training_5a", { p_employee_id: roboId, p_type_code: "NR35", p_completed_on: hoje, p_expires_on: null, p_provider: "Prova automática", p_workload_hours: 8, p_note: null, p_idempotency_key: key })).data === r1.data);
const ficha = (await rpc(robo, "my_trainings_5a")).data;
const nr35 = ficha.trainings.find(t => t.type_code === "NR35");
const esperado = new Date(`${hoje}T00:00:00Z`); esperado.setUTCMonth(esperado.getUTCMonth() + 24);
check("validade calculada pelo tipo (NR-35 = 24 meses)", nr35?.expires_on === esperado.toISOString().slice(0, 10) && nr35?.situacao === "EM_DIA");
check("só um registro ativo por tipo; anterior vira histórico",
  Number(await sqlValue(`select count(*) from private.employee_trainings_5a where employee_id='${roboId}' and type_code='NR35' and status='ATIVO'`)) === 1);
check("data futura recusada", (await rpc(gestor, "register_training_5a", { p_employee_id: roboId, p_type_code: "NR35", p_completed_on: "2099-01-01", p_expires_on: null, p_provider: null, p_workload_hours: null, p_note: null, p_idempotency_key: randomUUID() })).status >= 400);
check("validade antes da data do treinamento recusada", (await rpc(gestor, "register_training_5a", { p_employee_id: roboId, p_type_code: "NR10", p_completed_on: hoje, p_expires_on: "2000-01-01", p_provider: null, p_workload_hours: null, p_note: null, p_idempotency_key: randomUUID() })).status >= 400);
let mudou = true;
try { await sqlValue(`update private.employee_trainings_5a set completed_on=completed_on-1 where id='${r1.data}' returning 1`); } catch { mudou = false; }
check("dados do treinamento não podem ser alterados", !mudou);
let apagou = true;
try { await sqlValue(`delete from private.employee_trainings_5a where id='${r1.data}' returning 1`); } catch { apagou = false; }
check("histórico não pode ser apagado", !apagou);
check("Maria não cancela registro (não é Gestão)", (await rpc(maria, "cancel_training_5a", { p_id: r1.data, p_reason: "tentativa indevida" })).status >= 400);
check("Gestão cancela com motivo", (await rpc(gestor, "cancel_training_5a", { p_id: r1.data, p_reason: "Registro de prova automática" })).status === 200);
check("cancelado some da ficha, mas fica no histórico",
  !(await rpc(robo, "my_trainings_5a")).data.trainings.some(t => t.id === r1.data) &&
  await sqlValue(`select status from private.employee_trainings_5a where id='${r1.data}'`) === "CANCELADO");
check("só administrador altera tipos", (await rpc(maria, "save_training_type_5a", { p_code: "XX", p_name: "Teste", p_nr: null, p_validity_months: 1, p_active: true })).status >= 400);

const failed = evidence.checks.filter(c => !c.ok).length;
evidence.result = failed ? `${failed} FALHA(S)` : `${evidence.checks.length}/${evidence.checks.length} OK`;
writeFileSync(new URL("./resultado-5a-online.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(evidence.result); process.exitCode = failed ? 1 : 0;
