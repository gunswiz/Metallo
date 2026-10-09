// Marco 3P no TESTE ONLINE: lembrete do consumo do dia (Início + aviso no celular). Dados FICTÍCIOS.
import { createECDH, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const FN = `${BASE}/functions/v1/lembrete-consumo`;
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3P no teste online (dados fictícios)", checks: [] };
function check(name, condition) { evidence.checks.push({ name, ok: Boolean(condition) }); console.log((condition ? "OK   " : "FALHA") + " " + name); }
async function token(c) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: c.email, password: c.password }) }); return (await r.json()).access_token; }
async function rpc(tk, name, body = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; }
async function fn(body, headers = {}) { const r = await fetch(FN, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => null) }; }
const gestor = await token(cred.gestao), joao = await token(cred.colaborador.joao);
check("agendamento sem o segredo é recusado", (await fn({ acao: "agendado" })).status === 401);
check("agendamento com segredo errado é recusado", (await fn({ acao: "agendado" }, { "x-metallo-cron": "errado" })).status === 401);
check("teste sem login é recusado", (await fn({ acao: "teste" })).status === 401);
const pend = await rpc(gestor, "my_teams_without_consumption_today_3p");
check("Início: gestor vê as equipes sem consumo hoje", pend.status === 200 && Array.isArray(pend.data));
check("João (conta do app) não vê a lista da Gestão", (await rpc(joao, "my_teams_without_consumption_today_3p")).data?.length === 0);
const e = createECDH("prime256v1"); e.generateKeys();
const sub = { p_endpoint: `https://httpbin.org/status/201?prova=${randomBytes(4).toString("hex")}`, p_p256dh: e.getPublicKey().toString("base64url"), p_auth: randomBytes(16).toString("base64url") };
check("conta do app (João) não liga avisos da Gestão", (await rpc(joao, "save_push_subscription_3p", sub)).status >= 400);
check("endereço que não é https é recusado", (await rpc(gestor, "save_push_subscription_3p", { ...sub, p_endpoint: "http://x.y" })).status >= 400);
check("gestor liga os avisos neste aparelho", (await rpc(gestor, "save_push_subscription_3p", sub)).status === 204);
check("contagem de aparelhos do gestor", (await rpc(gestor, "my_push_count_3p")).data >= 1);
const t = await fn({ acao: "teste" }, { Authorization: `Bearer ${gestor}` });
check("aviso de teste é cifrado e enviado ao serviço do aparelho", t.status === 200 && t.data?.enviados >= 1);
check("João sem aparelho recebe aviso claro", (await fn({ acao: "teste" }, { Authorization: `Bearer ${joao}` })).data?.error === "sem_aparelho");
check("gestor desliga os avisos deste aparelho", (await rpc(gestor, "delete_push_subscription_3p", { p_endpoint: sub.p_endpoint })).status === 204);
writeFileSync(new URL("./resultado-3p-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
const failed = evidence.checks.filter(c => !c.ok).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length}`); process.exit(failed ? 1 : 0);
