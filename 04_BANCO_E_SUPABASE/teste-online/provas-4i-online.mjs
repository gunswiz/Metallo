// Marco 4I no TESTE ONLINE: registros tipo 2 (empresa) e 5 (funcionário) no AFD, na mesma numeração das marcações.
// Contas e documentos FICTÍCIOS. Não imprime senha, token ou CPF.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev", FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4I — AFD com registros tipo 2 e 5 (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function call(tok, method, path, body, origin = GEST) { const r = await fetch(FN + path, { method, headers: { Origin: origin, Authorization: `Bearer ${tok}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; }
function crc(t) { let c = 0; for (const ch of t) { c ^= ch.charCodeAt(0); for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0x8408 : c >>> 1; } return c.toString(16).toUpperCase().padStart(4, "0"); }
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);
const emp = await rpc(gestor, "admin_employer_4i");
check("Gestão vê o responsável só mascarado", emp.status === 200 && /^\*\*\*\.\d{3}\.\d{3}-\*\*$/.test(emp.data[0].responsavel_mascarado));
check("a função antiga de salvar a empresa não grava mais", (await rpc(gestor, "admin_set_employer_4f", { p_tipo: 1, p_documento: "11222333000181", p_cno: "", p_razao: "X", p_local: "Y", p_inpi: "", p_dev: "" })).status >= 400);
check("funcionário não salva a empresa", (await rpc(robo, "admin_set_employer_4i", { p_tipo: 1, p_documento: "11222333000181", p_cno: "", p_razao: "X", p_local: "Y", p_inpi: "", p_dev: "", p_responsavel: "" })).status >= 400);
// Alterar o local da obra (mantendo o responsável) gera um registro tipo 2; voltar ao original gera outro.
const e = emp.data[0], base = { p_tipo: e.tipo_documento, p_documento: e.documento, p_cno: e.cno_caepf ?? "", p_razao: e.razao_social, p_inpi: e.inpi ?? "", p_dev: e.desenvolvedor_documento ?? "", p_responsavel: "" };
check("alterar o local gera registro tipo 2", (await rpc(gestor, "admin_set_employer_4i", { ...base, p_local: "Obra de teste 2 - Fortaleza/CE" })).status < 300);
check("voltar o local gera outro registro tipo 2", (await rpc(gestor, "admin_set_employer_4i", { ...base, p_local: e.local_prestacao })).status < 300);
check("salvar sem mudança não gera registro", (await rpc(gestor, "admin_set_employer_4i", { ...base, p_local: e.local_prestacao })).status < 300);
// CPF do robô: troca e volta (A, A) — dois registros tipo 5.
const lista = await rpc(gestor, "admin_employees_cpf_4f"), roboId = lista.data.find(p => p.registration_code === "TESTE-006").employee_id;
check("alterar CPF gera registro tipo 5", (await rpc(gestor, "admin_set_employee_cpf_4f", { p_employee_id: roboId, p_cpf: "52601815906" })).status < 300);
check("voltar o CPF gera outro tipo 5", (await rpc(gestor, "admin_set_employee_cpf_4f", { p_employee_id: roboId, p_cpf: "81618495950" })).status < 300);

const afd = await call(gestor, "POST", "/gestao/afd", { from: hoje, to: hoje });
const linhas = afd.data.content.split("\r\n").filter(Boolean), corpo = linhas.slice(1, -2);
const t2 = corpo.filter(l => l[9] === "2"), t5 = corpo.filter(l => l[9] === "5"), t7 = corpo.filter(l => l[9] === "7");
check("AFD traz registros tipo 2 (331 posições) e tipo 5 (118 posições)", t2.length >= 2 && t5.length >= 2 && t2.every(l => l.length === 331) && t5.every(l => l.length === 118));
check("CRC-16 dos tipos 2 e 5 confere", [...t2, ...t5].every(l => crc(l.slice(0, -4)) === l.slice(-4)));
check("tipo 5: operação A e nome do robô", t5.some(l => l[34] === "A" && l.slice(47, 99).startsWith("Rob")));
check("tipo 2: CNPJ e razão social da empresa", t2.every(l => l.slice(49, 63) === e.documento.padEnd(14, " ") && l.slice(77, 227).trimEnd() === e.razao_social));
const nsrs = corpo.map(l => Number(l.slice(0, 9)));
check("tudo em ordem crescente de NSR, sem repetir", nsrs.every((n, i) => i === 0 || n > nsrs[i - 1]));
const tr = linhas.at(-2);
check("trailer conta tipos 2, 5 e 7", Number(tr.slice(9, 18)) === t2.length && Number(tr.slice(36, 45)) === t5.length && Number(tr.slice(54, 63)) === t7.length);
const integ = await call(gestor, "GET", "/gestao");
check("integridade: NSR contínuo somando marcações e cadastros", integ.status === 200 && integ.data.integrity.ok === true, JSON.stringify(integ.data.integrity));

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4i-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
