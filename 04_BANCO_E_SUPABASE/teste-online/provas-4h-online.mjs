// Marco 4H no TESTE ONLINE: feriados, ocorrências do ponto e registro 07 do AEJ. Contas FICTÍCIAS; não imprime senha, token ou CPF.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev", FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4H — feriados, ocorrências e AEJ registro 07 (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function aej(tok, from, to) { const r = await fetch(`${FN}/gestao/aej`, { method: "POST", headers: { Origin: GEST, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to }) }); return { status: r.status, data: await r.json() }; }

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);
const fer = await rpc(robo, "feriados_4h", { p_de: "2026-01-01", p_ate: "2026-12-31" });
check("10 feriados nacionais de 2026 visíveis para quem está logado", fer.status === 200 && fer.data.filter(f => f.tipo === "nacional").length === 10);
check("funcionário não cadastra feriado", (await rpc(robo, "admin_set_feriado_4h", { p_data: "2026-03-25", p_nome: "Teste", p_tipo: "estadual" })).status >= 400);
check("administrador cadastra feriado estadual de teste", (await rpc(gestor, "admin_set_feriado_4h", { p_data: "2026-03-25", p_nome: "Data Magna do Ceará", p_tipo: "estadual" })).status < 300);
check("administrador retira (desativa) o feriado de teste", (await rpc(gestor, "admin_remove_feriado_4h", { p_data: "2026-03-25" })).status < 300
  && !(await rpc(robo, "feriados_4h", { p_de: "2026-03-25", p_ate: "2026-03-25" })).data.length);

const lista = await rpc(gestor, "admin_employees_cpf_4f"), roboId = lista.data.find(p => p.registration_code === "TESTE-006").employee_id;
const dia = "2026-10-06";
check("funcionário não lança ocorrência", (await rpc(robo, "admin_set_ocorrencia_4h", { p_employee_id: roboId, p_data: dia, p_tipo: "atestado", p_observacao: "" })).status >= 400);
const o1 = await rpc(gestor, "admin_set_ocorrencia_4h", { p_employee_id: roboId, p_data: dia, p_tipo: "falta", p_observacao: "teste automático" });
check("administrador lança falta não justificada", o1.status === 200 && Number(o1.data) > 0);
const minhas = await rpc(robo, "my_ocorrencias_4h", { p_de: "2026-10-01", p_ate: "2026-10-31" });
check("funcionário vê a própria ocorrência (sem a observação interna)", minhas.status === 200 && minhas.data.some(o => o.data === dia && o.tipo === "falta") && minhas.data.every(o => !("observacao" in o)));
const arq = await aej(gestor, "2026-10-04", "2026-10-11");
const l07 = arq.data.content.split("\r\n").filter(l => l.startsWith("07|"));
check("AEJ traz DSR nos domingos (04/10 e 11/10) e a falta (tipo 2)", arq.status === 200 && l07.some(l => /^07\|\d+\|1\|2026-10-04\|\|$/.test(l)) && l07.some(l => /^07\|\d+\|1\|2026-10-11\|\|$/.test(l)) && l07.some(l => /^07\|\d+\|2\|2026-10-06\|\|$/.test(l)));
const tr = arq.data.content.split("\r\n").filter(Boolean).at(-2).split("|");
check("trailer conta os registros 07", Number(tr[7]) === l07.length);
const o2 = await rpc(gestor, "admin_set_ocorrencia_4h", { p_employee_id: roboId, p_data: dia, p_tipo: "atestado", p_observacao: "" });
const ativas = (await rpc(gestor, "admin_ocorrencias_4h", { p_de: dia, p_ate: dia })).data.filter(o => o.employee_id === roboId);
check("trocar a ocorrência do dia cancela a anterior (fica uma ativa)", o2.status === 200 && ativas.length === 1 && ativas[0].tipo === "atestado");
check("cancelar ocorrência", (await rpc(gestor, "admin_cancelar_ocorrencia_4h", { p_id: Number(o2.data) })).status < 300
  && !(await rpc(gestor, "admin_ocorrencias_4h", { p_de: dia, p_ate: dia })).data.some(o => o.employee_id === roboId));
const arq2 = await aej(gestor, "2026-10-04", "2026-10-11");
check("sem a falta, o AEJ não traz mais o tipo 2 daquele dia", !arq2.data.content.includes("|2|2026-10-06|"));

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4h-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
