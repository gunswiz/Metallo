// Marco 3M: exemplo FICTÍCIO para a demonstração — uma entrega de capacete ao João, confirmada com a senha (gera o código).
// Contas e entregas FICTÍCIAS (robô de provas). Não imprime senha nem token.
// Uma confirmação por senha correta (sem erros: não aciona o limite de tentativas).
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ORIGIN = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/assinatura-epi-3f`;
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3M no teste online (dados fictícios)", checks: [] };
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
const robo = await login(cred.colaborador.joao), maria = null, gestor = await login(cred.gestao);
const roboId = (await rpc(robo, "my_employee_profile")).data[0].employee_id;
async function novaEntrega() {
  const lote = await fetch(`${BASE}/rest/v1/epi_stock_batches?select=id,item_id,quantity,epi_items!inner(code)&epi_items.code=eq.EPI-CAP&quantity=gt.0&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${gestor}` } }).then(r => r.json());
  assert.ok(Array.isArray(lote) && lote.length === 1, "lote do capacete indisponível");
  const prep = await rpc(gestor, "prepare_epi_kit_3d", { p_employee_id: roboId, p_lines: [{ item_id: lote[0].item_id, stock_batch_id: lote[0].id, quantity: 1 }], p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200, JSON.stringify(prep.data));
  const g = await rpc(gestor, "register_epi_delivery_3d", { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(g.status, 200, JSON.stringify(g.data)); return g.data;
}
const pc = (token, group, password, key = randomUUID(), origin) => portal(token, { action: "password_confirm", group_id: group, password, idempotency_key: key }, origin);
const status = async group => (await rpc(robo, "my_epi_delivery_groups_3d")).data.find(g => g.group_id === group)?.feedback_status ?? null;

const group = await novaEntrega();
const ok = await pc(robo, group, cred.colaborador.joao.password);
console.log(ok.status === 200 && /^[0-9a-f]{64}$/.test(String(ok.data?.code)) ? "OK exemplo do João criado com código" : "FALHA " + ok.status);
