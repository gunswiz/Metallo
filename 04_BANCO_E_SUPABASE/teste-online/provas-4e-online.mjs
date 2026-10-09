// Marco 4E no TESTE ONLINE: provas do espelho de ponto (Edge Function ponto-4d v3). Contas FICTÍCIAS.
// Não imprime senha, token ou coordenada.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4E — espelho de ponto no teste online (dados fictícios)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function call(tok, method, path, body, origin = COLAB) {
  const r = await fetch(FN + path, { method, headers: { Origin: origin, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: r.status, data };
}
async function marcar(tok) { const key = randomUUID(); await call(tok, "POST", "/v4a/begin", { idempotency_key: key }); return call(tok, "POST", "/v4a/events", { idempotency_key: key, location: { status: "DENIED" } }); }
const mes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const m1 = await marcar(robo), m2 = await marcar(robo);
check("duas marcações do robô gravadas", m1.status === 201 && m2.status === 201, `${m1.status}/${m2.status}`);

const meu = await call(robo, "POST", "/v4b/espelho", { month: mes });
const ids = new Set(meu.data.events?.map(e => e.event_id));
check("app: espelho do mês traz as marcações da própria pessoa", meu.status === 200 && ids.has(m1.data.event.event_id) && ids.has(m2.data.event.event_id));
check("app: espelho só tem um funcionário (a própria pessoa)", new Set(meu.data.events.map(e => e.employee_id)).size === 1);
check("app: sem localização nem hash no espelho", meu.data.events.every(e => !("location" in e) && !("payload_hash" in e)));
const daMaria = await call(maria, "POST", "/v4b/espelho", { month: mes });
check("app: Maria não vê marcações do robô", daMaria.status === 200 && !daMaria.data.events.some(e => ids.has(e.event_id)));
check("app: mês inválido recusado", (await call(robo, "POST", "/v4b/espelho", { month: "2026-13" })).status === 400);
check("app: campo extra recusado", (await call(robo, "POST", "/v4b/espelho", { month: mes, employee_id: randomUUID() })).status === 400);
check("app: origem externa recusada", (await call(robo, "POST", "/v4b/espelho", { month: mes }, "https://evil.example")).status === 403);
check("app: sem login recusado", (await call(null, "POST", "/v4b/espelho", { month: mes })).status === 401);

const gest = await call(gestor, "POST", "/gestao/espelho", { month: mes }, GEST);
check("Gestão (admin): espelho do mês com várias pessoas", gest.status === 200 && gest.data.events.some(e => ids.has(e.event_id)));
check("Gestão: funcionário comum não abre o espelho geral", (await call(robo, "POST", "/gestao/espelho", { month: mes }, GEST)).status === 403);
check("Gestão: origem do app recusada", (await call(gestor, "POST", "/gestao/espelho", { month: mes }, COLAB)).status === 403);
check("Gestão: GET recusado", (await call(gestor, "GET", "/gestao/espelho", undefined, GEST)).status === 403);
check("Gestão: rota antiga continua funcionando", (await call(gestor, "GET", "/gestao", undefined, GEST)).status === 200);

const ok = evidence.checks.every(c => c.ok);
evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4e-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(ok ? 0 : 1);
