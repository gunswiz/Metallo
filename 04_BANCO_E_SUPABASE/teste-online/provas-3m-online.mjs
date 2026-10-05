// Marco 3M no TESTE ONLINE: código de verificação (SHA-256 do conteúdo confirmado) na ficha de EPI.
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
const pc = (token, group, password, key = randomUUID(), origin) => portal(token, { action: "password_confirm", group_id: group, password, idempotency_key: key }, origin);
const status = async group => (await rpc(robo, "my_epi_delivery_groups_3d")).data.find(g => g.group_id === group)?.feedback_status ?? null;

const group = await novaEntrega();
const ok = await pc(robo, group, cred.colaborador.robo.password);
const code = ok.data?.code;
check("confirmação por senha devolve código de 64 caracteres", ok.status === 200 && /^[0-9a-f]{64}$/.test(String(code)));
check("código gravado no banco é o mesmo devolvido", await sqlValue(`select payload_hash from private.epi_confirmacao_senha_3j where group_id='${group}'::uuid`) === code);
const canonical = await sqlValue(`select payload_canonical from private.epi_confirmacao_senha_3j where group_id='${group}'::uuid`);
check("código = SHA-256 do conteúdo gravado (dá para refazer a conta)", createHash("sha256").update(canonical, "utf8").digest("hex") === code);
const parsed = JSON.parse(canonical);
check("conteúdo traz versão 3F-v1, o funcionário, a entrega e os itens", parsed.version === "3F-v1" && parsed.employee_id === roboId && parsed.group_id === group && parsed.items.length >= 1);
const alterado = JSON.stringify({ ...parsed, items: parsed.items.map(item => ({ ...item, quantity: item.quantity + 1 })) });
check("mudar a quantidade muda o código", createHash("sha256").update(alterado, "utf8").digest("hex") !== code);
let changed = true;
try { await sqlValue(`update private.epi_confirmacao_senha_3j set payload_hash=null where group_id='${group}'::uuid returning 1`); } catch { changed = false; }
check("código guardado não pode ser apagado nem trocado", !changed &&
  await sqlValue(`select payload_hash from private.epi_confirmacao_senha_3j where group_id='${group}'::uuid`) === code);
const admin = await rpc(gestor, "admin_epi_report_3e", { p_employee_id: roboId });
const fbAdmin = admin.data?.feedback?.find(row => row.group_id === group && row.type === "CONFIRMADO");
check("Gestão: ficha traz forma 'senha' e o mesmo código", admin.status === 200 && fbAdmin?.method === "senha" && fbAdmin?.code === code);
const mine = await rpc(robo, "my_epi_report_3e");
const fbMine = mine.data?.feedback?.find(row => row.group_id === group && row.type === "CONFIRMADO");
check("App: a própria ficha do funcionário traz o mesmo código", mine.status === 200 && fbMine?.code === code);
check("Maria não lê a ficha (nem o código) de outra pessoa pela Gestão", (await rpc(maria, "admin_epi_report_3e", { p_employee_id: roboId })).status >= 400);
const digital = await sqlValue(`select coalesce(json_agg(json_build_object('employee',employee_id,'feedback',feedback_id,'hash',payload_hash)),'[]'::json)::text from (select employee_id,feedback_id,payload_hash from private.epi_signature_events_3f limit 1) x`);
const ev = JSON.parse(digital)[0];
if (ev) {
  const report = await rpc(gestor, "admin_epi_report_3e", { p_employee_id: ev.employee });
  const row = report.data?.feedback?.find(item => String(item.id) === String(ev.feedback));
  check("confirmação com a digital aparece como 'digital' com o código da assinatura", row?.method === "digital" && row?.code === ev.hash);
} else check("há confirmação com digital para conferir", false);
const old = await sqlValue(`select coalesce(json_agg(json_build_object('employee',employee_id,'feedback',feedback_id)),'[]'::json)::text from (select employee_id,feedback_id from private.epi_confirmacao_senha_3j where payload_hash is null limit 1) x`);
const legacy = JSON.parse(old)[0];
if (legacy) {
  const report = await rpc(gestor, "admin_epi_report_3e", { p_employee_id: legacy.employee });
  const row = report.data?.feedback?.find(item => String(item.id) === String(legacy.feedback));
  check("confirmação antiga por senha continua sem código (não se inventa depois)", row?.method === "senha" && row?.code === null);
}
writeFileSync(new URL("./resultado-3m-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
const failed = evidence.checks.filter(item => !item.ok).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length}`);
process.exit(failed ? 1 : 0);
