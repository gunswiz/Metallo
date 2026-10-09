// Marco 4F no TESTE ONLINE: CPF obrigatório para marcar, CPF/hash do AFD gravados na marcação, AFD v004 conferido linha a linha.
// Contas e documentos FICTÍCIOS. Não imprime senha, token, CPF ou conteúdo do AFD.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4F — CPF, empresa e AFD v004 (prévia) no teste online", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function call(tok, method, path, body, origin = COLAB) {
  const r = await fetch(FN + path, { method, headers: { Origin: origin, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: r.status, data };
}
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function marcar(tok) { const key = randomUUID(); await call(tok, "POST", "/v4a/begin", { idempotency_key: key }); return call(tok, "POST", "/v4a/events", { idempotency_key: key, location: { status: "DENIED" } }); }
const sha = t => createHash("sha256").update(t, "utf8").digest("hex");
function crc(t) { let c = 0; for (const ch of t) { c ^= ch.charCodeAt(0); for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0x8408 : c >>> 1; } return c.toString(16).toUpperCase().padStart(4, "0"); }
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);
const lista = await rpc(gestor, "admin_employees_cpf_4f");
const roboLinha = lista.data.find(p => p.registration_code === "TESTE-006");
check("Gestão vê CPF só mascarado", lista.status === 200 && lista.data.every(p => p.cpf_mascarado === null || /^\*\*\*\.\d{3}\.\d{3}-\*\*$/.test(p.cpf_mascarado)));
check("funcionário não lê a lista de CPF", (await rpc(robo, "admin_employees_cpf_4f")).status >= 400);
check("CPF inválido recusado", (await rpc(gestor, "admin_set_employee_cpf_4f", { p_employee_id: roboLinha.employee_id, p_cpf: "12345678900" })).status >= 400);

// Sem CPF: marcação recusada. Depois volta o mesmo CPF fictício do robô.
const cpfRobo = "81618495950";
check("remover CPF do robô", (await rpc(gestor, "admin_set_employee_cpf_4f", { p_employee_id: roboLinha.employee_id, p_cpf: "" })).status < 300);
const semCpf = await marcar(robo);
check("sem CPF a marcação é recusada (CPF_NAO_CADASTRADO)", semCpf.status === 409 && semCpf.data.error === "CPF_NAO_CADASTRADO", JSON.stringify(semCpf));
check("CPF de volta", (await rpc(gestor, "admin_set_employee_cpf_4f", { p_employee_id: roboLinha.employee_id, p_cpf: cpfRobo })).status < 300);
const m1 = await marcar(robo), m2 = await marcar(robo);
check("com CPF marca normalmente", m1.status === 201 && m2.status === 201);

const afd = await call(gestor, "POST", "/gestao/afd", { from: hoje, to: hoje }, GEST);
check("AFD gerado para administrador", afd.status === 200 && /^AFD\d{17}\d{14}REP_P\.txt$/.test(afd.data.filename));
const linhas = afd.data.content.split("\r\n");
check("termina com CRLF, sem linha em branco no meio", linhas.at(-1) === "" && linhas.slice(0, -1).every(l => l.length > 0));
const [cab, ...resto] = linhas.slice(0, -1);
const trailer = resto.at(-2), assinatura = resto.at(-1), tipo7 = resto.slice(0, -2);
check("cabeçalho tipo 1 com 302 posições, versão 004 e CRC-16 correto", cab.length === 302 && cab.slice(0, 10) === "0000000001" && cab.slice(250, 253) === "004" && crc(cab.slice(0, 298)) === cab.slice(298));
check("período do cabeçalho", cab.slice(206, 216) === hoje && cab.slice(216, 226) === hoje);
check("registros tipo 7 com 137 posições", tipo7.length >= 2 && tipo7.every(l => l.length === 137 && l[9] === "7"));
check("DH com segundos 00 e fuso -0300", tipo7.every(l => /^\d{4}-\d\d-\d\dT\d\d:\d\d:00-0300$/.test(l.slice(10, 34)) && /:00-0300$/.test(l.slice(46, 70))));
check("CPF do robô nas marcações dele (12 posições)", tipo7.some(l => l.slice(34, 46) === "0" + cpfRobo));
check("coletor 02 (navegador) e on-line", tipo7.every(l => l.slice(70, 72) === "02" && l[72] === "0"));
check("NSR em ordem crescente", tipo7.every((l, i) => i === 0 || Number(l.slice(0, 9)) > Number(tipo7[i - 1].slice(0, 9))));
// Corrente do hash: cada linha = SHA-256(campos 1–7 + hash anterior). Dentro do arquivo, as consecutivas por NSR devem encadear.
let encadeado = true;
for (let i = 1; i < tipo7.length; i++) if (Number(tipo7[i].slice(0, 9)) === Number(tipo7[i - 1].slice(0, 9)) + 1 && sha(tipo7[i].slice(0, 73) + tipo7[i - 1].slice(73)) !== tipo7[i].slice(73)) encadeado = false;
check("hash SHA-256 de cada registro encadeia com o anterior", encadeado);
check("trailer tipo 9 conta os registros 7", trailer.length === 64 && trailer.startsWith("999999999") && Number(trailer.slice(54, 63)) === tipo7.length && trailer[63] === "9");
check("linha da assinatura indica .p7s (100 posições)", assinatura.length === 100 && assinatura.startsWith("ASSINATURA_DIGITAL_EM_ARQUIVO_P7S"));
check("funcionário não gera AFD", (await call(robo, "POST", "/gestao/afd", { from: hoje, to: hoje }, GEST)).status === 403);
check("período inválido recusado", (await call(gestor, "POST", "/gestao/afd", { from: hoje, to: "2020-01-01" }, GEST)).status === 400);
const integ = await call(gestor, "GET", "/gestao", undefined, GEST);
check("integridade do ponto (inclui a corrente do AFD) continua íntegra", integ.status === 200 && integ.data.integrity.ok === true, JSON.stringify(integ.data.integrity));

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4f-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
