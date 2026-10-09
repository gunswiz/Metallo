// Marco 4G no TESTE ONLINE: jornada padrão e AEJ v002 (prévia). Contas FICTÍCIAS. Não imprime senha, token, CPF ou conteúdo.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4G — jornada e AEJ v002 (prévia) no teste online", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function call(tok, method, path, body, origin = COLAB) {
  const r = await fetch(FN + path, { method, headers: { Origin: origin, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: r.status, data };
}
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function marcar(tok) { const key = randomUUID(); await call(tok, "POST", "/v4a/begin", { idempotency_key: key }); return call(tok, "POST", "/v4a/events", { idempotency_key: key, location: { status: "DENIED" } }); }
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);
const j = await rpc(robo, "jornada_padrao_4g");
const min = h => h.reduce((t, x, i) => t + (i % 2 ? 1 : -1) * (Number(x.slice(0, 2)) * 60 + Number(x.slice(3))), 0);
check("app lê a jornada da empresa (44 h na semana)", j.status === 200 && Object.values(j.data).reduce((t, h) => t + min(h), 0) === 44 * 60);
check("funcionário não altera a jornada", (await rpc(robo, "admin_set_jornada_4g", { p_dias: j.data })).status >= 400);
check("jornada inválida recusada (horário fora de ordem)", (await rpc(gestor, "admin_set_jornada_4g", { p_dias: { ...j.data, "1": ["12:00", "07:00"] } })).status >= 400);
check("administrador regrava a mesma jornada", (await rpc(gestor, "admin_set_jornada_4g", { p_dias: j.data })).status < 300);

const a = await marcar(robo), b = await marcar(robo);
check("duas marcações do robô", a.status === 201 && b.status === 201);
const aej = await call(gestor, "POST", "/gestao/aej", { from: hoje, to: hoje }, GEST);
check("AEJ gerado para administrador", aej.status === 200 && /^AEJ_\d{14}_\d{8}_\d{8}\.txt$/.test(aej.data.filename));
const linhas = aej.data.content.split("\r\n");
check("termina com CRLF e sem linha em branco", linhas.at(-1) === "" && linhas.slice(0, -1).every(l => l.length));
const regs = linhas.slice(0, -1), tipo = t => regs.filter(l => l.startsWith(t + "|"));
const cab = regs[0].split("|");
check("01: cabeçalho com 10 campos e versão 002", cab.length === 10 && cab[0] === "01" && cab[9] === "002" && cab[6] === hoje && /T\d\d:\d\d:00-0300$/.test(cab[8]));
check("02: REP-P (tipo 3) com 17 dígitos", tipo("02").length === 1 && /^02\|1\|3\|\d{17}$/.test(tipo("02")[0]));
check("03: vínculos com CPF de 11 dígitos", tipo("03").length >= 1 && tipo("03").every(l => /^03\|\d+\|\d{11}\|.+$/.test(l)));
check("04: horário seg–qui 540 min e sexta 480 min", tipo("04").some(l => /^04\|HC\d\|540\|0700\|1200\|1300\|1700$/.test(l)) && tipo("04").some(l => /^04\|HC\d\|480\|0700\|1200\|1300\|1600$/.test(l)));
const m05 = tipo("05").map(l => l.split("|"));
check("05: 9 campos, E/S alternando, fonte O", m05.length >= 2 && m05.every(c => c.length === 9 && ["E", "S"].includes(c[4]) && c[6] === "O" && /^\d{3}$/.test(c[5])));
check("05: primeira entrada do dia leva o código do horário", m05.filter(c => c[4] === "E" && c[5] === "001").every(c => c[7] !== ""));
check("08: programa e desenvolvedor", tipo("08").length === 1 && tipo("08")[0].split("|").length === 7);
const tr = regs.at(-2).split("|");
check("99: trailer confere as quantidades", tr[0] === "99" && Number(tr[3]) === tipo("03").length && Number(tr[4]) === tipo("04").length && Number(tr[5]) === m05.length && tr[8] === "1");
check("linha da assinatura (.p7s) com 100 posições", regs.at(-1).length === 100 && regs.at(-1).startsWith("ASSINATURA_DIGITAL_EM_ARQUIVO_P7S"));
check("funcionário não gera AEJ", (await call(robo, "POST", "/gestao/aej", { from: hoje, to: hoje }, GEST)).status === 403);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4g-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
