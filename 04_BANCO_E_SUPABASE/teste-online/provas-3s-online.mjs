// Marco 3S no TESTE ONLINE: conferir o código de verificação do PDF de EPI. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3S — conferir código de EPI (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }

// Código do capacete do João (exemplo de demonstração do Marco 3M), como sai impresso (grupos de 4, maiúsculas).
const codigo = "0d82f316eeb730081b2a22e9539fbe0782123083a0e30cf35e88b964c14ff9fc".toUpperCase().match(/.{4}/g).join(" ");
const gestor = await login(cred.gestao), robo = await login(cred.colaborador.robo);
const ok = await rpc(gestor, "conferir_codigo_epi_3s", { p_codigo: codigo });
check("código impresso é encontrado e confere", ok.status === 200 && ok.data.length === 1 && ok.data[0].integro === true && ok.data[0].matricula === "TESTE-001" && ok.data[0].forma === "senha");
check("mostra os itens confirmados", Array.isArray(ok.data[0].itens) && ok.data[0].itens.some(i => /Capacete/.test(i.item_name)));
const outro = codigo.slice(0, -1) + (codigo.endsWith("C") ? "D" : "C");
check("um caractere diferente não encontra nada", (await rpc(gestor, "conferir_codigo_epi_3s", { p_codigo: outro })).data.length === 0);
check("código incompleto é recusado", (await rpc(gestor, "conferir_codigo_epi_3s", { p_codigo: "0D82 F316" })).status >= 400);
check("conta só do app (sem Gestão) não confere", (await rpc(robo, "conferir_codigo_epi_3s", { p_codigo: codigo })).status >= 400);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-3s-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
