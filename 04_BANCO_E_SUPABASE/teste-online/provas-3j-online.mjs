// Marco 3J no TESTE ONLINE: confirmar recebimento de EPI exige DIGITAL (3F) ou SENHA da conta.
// Contas e entregas FICTÍCIAS (robô de provas). Não imprime senha nem token.
// Atenção: o último bloco provoca o limite de tentativas; o robô fica 15 minutos sem confirmar por senha.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ORIGIN = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/assinatura-epi-3f`;
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3J no teste online (dados fictícios)", checks: [] };
function check(name, condition) { evidence.checks.push({ name, ok: Boolean(condition) }); console.log((condition ? "OK   " : "FALHA") + " " + name); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(token, name, body = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function portal(token, body, origin = ORIGIN) {
  const r = await fetch(FN, { method: "POST", headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data };
}
// Conferência do registro privado pelo migrador temporário (somente leitura).
async function sqlValue(text) {
  const token = readFileSync(new URL("../../tmp/token-migrador.txt", import.meta.url), "utf8").trim();
  const r = await fetch(`${BASE}/functions/v1/migrador-temporario`, { method: "POST", headers: { Authorization: `Bearer ${ANON_JWT}`, apikey: ANON_JWT,
    "x-metallo-token": token, "x-metallo-modo": "sql", "Content-Type": "text/plain" }, body: text });
  const j = await r.json(); if (!j.ok) throw new Error("migrador: " + JSON.stringify(j).slice(0, 200));
  const row = Array.isArray(j.result) ? j.result[0] : null; return row ? Object.values(row)[0] : null;
}
const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const roboId = (await rpc(robo, "my_employee_profile")).data[0].employee_id;
async function novaEntrega() {
  const lote = await fetch(`${BASE}/rest/v1/epi_stock_batches?select=id,item_id,quantity,epi_items!inner(code)&epi_items.code=eq.EPI-CAP&quantity=gt.0&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${gestor}` } }).then(r => r.json());
  assert.ok(Array.isArray(lote) && lote.length === 1, "lote do capacete indisponível");
  const prep = await rpc(gestor, "prepare_epi_kit_3d", { p_employee_id: roboId, p_lines: [{ item_id: lote[0].item_id, stock_batch_id: lote[0].id, quantity: 1 }], p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200, JSON.stringify(prep.data));
  const g = await rpc(gestor, "register_epi_delivery_3d", { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(g.status, 200, JSON.stringify(g.data)); return g.data;
}
const status = async group => (await rpc(robo, "my_epi_delivery_groups_3d")).data.find(g => g.group_id === group)?.feedback_status ?? null;
const pc = (token, group, password, key = randomUUID(), origin) => portal(token, { action: "password_confirm", group_id: group, password, idempotency_key: key }, origin);

const group = await novaEntrega();
const direct = await rpc(robo, "respond_epi_delivery_3d", { p_group_id: group, p_action: "CONFIRMADO", p_delivery_id: null, p_category: null, p_details: null, p_idempotency_key: randomUUID() });
check("confirmação direta pela API (sem digital nem senha) é recusada", direct.status >= 400 && JSON.stringify(direct.data).includes("confirmacao_exige_digital_ou_senha"));
check("…e a entrega continua pendente", await status(group) === null);
check("sem login recusado", (await pc(null, group, "x")).status === 401);
check("origem externa recusada", (await pc(robo, group, cred.colaborador.robo.password, randomUUID(), "https://evil.example")).status === 403);
check("campo extra no corpo recusado", (await portal(robo, { action: "password_confirm", group_id: group, password: "x", idempotency_key: randomUUID(), employee_id: roboId })).status === 400);
const wrong = await pc(robo, group, "senha-errada-de-teste");
check("senha errada recusada com aviso claro", wrong.status === 400 && wrong.data?.code === "senha_incorreta");
check("…e nada foi confirmado", await status(group) === null);
const other = await pc(maria, group, cred.colaborador.maria.password);
check("Maria, com a própria senha, não confirma a entrega de outra pessoa", other.status === 400 && other.data?.code === undefined);
check("…e nada foi confirmado", await status(group) === null);
const key = randomUUID();
const ok = await pc(robo, group, cred.colaborador.robo.password, key);
check("senha correta confirma o recebimento", ok.status === 200 && ok.data?.method === "senha" && /^\d+$/.test(String(ok.data?.feedback_id)));
check("entrega aparece como CONFIRMADO", await status(group) === "CONFIRMADO");
check("registro guarda o método senha-reautenticacao", await sqlValue(`select method from private.epi_confirmacao_senha_3j where group_id='${group}'::uuid`) === "senha-reautenticacao");
check("sessão criada para conferir a senha foi encerrada (não sobra sessão extra)",
  Number(await sqlValue(`select count(*) from auth.sessions s join auth.users u on u.id=s.user_id where u.email='${cred.colaborador.robo.email}' and s.created_at>now()-interval '2 minutes'`)) <= 1);
const replay = await pc(robo, group, cred.colaborador.robo.password, key);
check("repetição da mesma intenção não duplica", replay.status === 200 && String(replay.data?.feedback_id) === String(ok.data?.feedback_id));
check("nova confirmação de entrega já confirmada é recusada", (await pc(robo, group, cred.colaborador.robo.password)).status >= 400);
check("tabelas privadas do 3J não aparecem na API pública",
  (await fetch(`${BASE}/rest/v1/epi_confirmacao_senha_3j?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${robo}` } })).status >= 400 &&
  (await fetch(`${BASE}/rest/v1/epi_tentativa_senha_3j?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${robo}` } })).status >= 400);
let changed = true;
try { await sqlValue(`update private.epi_confirmacao_senha_3j set method='x' where group_id='${group}'::uuid returning 1`); } catch { changed = false; }
check("registro de confirmação por senha é imutável", !changed &&
  await sqlValue(`select method from private.epi_confirmacao_senha_3j where group_id='${group}'::uuid`) === "senha-reautenticacao");

const group3 = await novaEntrega();
const item3 = (await rpc(robo, "my_epi_delivery_groups_3d")).data.find(g => g.group_id === group3).items[0].delivery_id;
const div = await rpc(robo, "respond_epi_delivery_3d", { p_group_id: group3, p_action: "DIVERGENCIA", p_delivery_id: item3, p_category: "TAMANHO", p_details: "Tamanho errado", p_idempotency_key: randomUUID() });
check("avisar problema (divergência) continua sem exigir senha", div.status === 200 && await status(group3) === "DIVERGENCIA");

// Limite: 5 senhas erradas em 15 minutos bloqueiam a confirmação por senha (inclusive com a senha certa).
const group2 = await novaEntrega();
for (let i = 0; i < 5; i++) await pc(robo, group2, `errada-${i}`);
const locked = await pc(robo, group2, cred.colaborador.robo.password);
check("após 5 senhas erradas, bloqueia por 15 minutos", locked.status === 429 && locked.data?.code === "muitas_tentativas");
check("…e nada foi confirmado", await status(group2) === null);

const failed = evidence.checks.filter(c => !c.ok).length;
evidence.result = failed ? `${failed} FALHA(S)` : `${evidence.checks.length}/${evidence.checks.length} OK`;
writeFileSync(new URL("./resultado-3j-online.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(evidence.result); process.exitCode = failed ? 1 : 0;
