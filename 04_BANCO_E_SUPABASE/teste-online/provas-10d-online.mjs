// Marco 10D no TESTE ONLINE: relatório, aviso de conserto e rotinas. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 10D — frota mais fluida (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }


const FN = `${BASE}/functions/v1/fotos-frota-10b`, ORIGEM_APP = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", ORIGEM_GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
async function enviar(tok, veiculo, bytes, nome = "defeito.png") {
  const f = new FormData(); f.set("acao", "enviar"); f.set("veiculo_id", String(veiculo)); f.set("arquivo", new Blob([bytes]), nome);
  const r = await fetch(FN, { method: "POST", headers: { Authorization: `Bearer ${tok}`, apikey: KEY, Origin: ORIGEM_APP }, body: f });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function abrir(tok, id, origem = ORIGEM_GESTAO) {
  const r = await fetch(FN, { method: "POST", headers: { Authorization: `Bearer ${tok}`, apikey: KEY, Origin: origem, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "abrir", foto_id: id }) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase(), placa = "PRB" + sufixo;
const idV = (await rpc(gestor, "admin_save_veiculo_10a", { p_id: null, p_placa: placa, p_nome: "Munck foto " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 500, p_ativo: true })).data;
const itens = (await rpc(robo, "my_frota_itens_10a")).data;
const respostas = (n, extra = {}) => itens.map(i => i.codigo === n ? { codigo: n, situacao: "N", obs: "pneu careca", ...extra } : { codigo: i.codigo, situacao: "C", obs: "" });
const ROTINAS = `${BASE}/functions/v1/rotinas-frota-10d`;
async function rotina(acao, segredo, metodo = "POST") {
  const h = { apikey: KEY, "Content-Type": "application/json" }; if (segredo !== undefined) h["x-metallo-cron"] = segredo;
  const r = await fetch(ROTINAS, { method: metodo, headers: h, body: metodo === "POST" ? JSON.stringify({ acao }) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const mes = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" }).slice(0, 7) + "-01";

// Checklist com defeito → manutenção aberta → relatório do mês
const c = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8), p_ciente: true, p_key: randomUUID() });
check("checklist com defeito registrado", c.status === 200 && c.data[0].resultado === "nao_liberado");
const rel = await rpc(gestor, "admin_frota_relatorio_10d", { p_mes: mes });
const l0 = (rel.data ?? []).find(x => x.veiculo_id === idV);
check("relatório do mês traz o caminhão com checklist, defeito e dia parado", rel.status === 200 && l0?.checklists === 1 && l0.itens_com_problema === 1 && l0.defeitos_abertos === 1 && l0.dias_parado >= 1, JSON.stringify(l0));
check("relatório soma os totais como números", l0 && typeof l0.km_rodados === "number" && typeof l0.custo === "number");
check("funcionário não lê o relatório", (await rpc(robo, "admin_frota_relatorio_10d", { p_mes: mes })).status >= 400);
check("sem login o relatório é recusado", (await fetch(`${BASE}/rest/v1/rpc/admin_frota_relatorio_10d`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_mes: mes }) })).status >= 400);

// Gestão conclui o conserto (o aviso ao motorista é conferido direto no banco depois desta prova)
const man = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data.manutencoes.find(m => m.status === "aberta");
const conc = await rpc(gestor, "admin_concluir_manutencao_10a", { p_id: man.id, p_custo: 120.5, p_km: 500, p_obs: "prova 10d" });
check("Gestão conclui o conserto", conc.status < 300);
const rel2 = await rpc(gestor, "admin_frota_relatorio_10d", { p_mes: mes });
const l1 = (rel2.data ?? []).find(x => x.veiculo_id === idV);
check("relatório mostra manutenção concluída e o custo", l1?.manutencoes_concluidas === 1 && Number(l1.custo) === 120.5, JSON.stringify(l1));

// Rotinas da frota só aceitam o segredo do agendador
check("rotina sem segredo é recusada", (await rotina("avisos")).status === 401);
check("rotina com segredo errado é recusada", (await rotina("avisos", "segredo-errado")).status === 401);
check("limpeza sem segredo é recusada", (await rotina("limpeza")).status === 401);
check("rotina não aceita GET", (await rotina("avisos", "x", "GET")).status === 405);
check("funcionário com o próprio login não roda a rotina", (await (async () => { const r = await fetch(ROTINAS, { method: "POST", headers: { Authorization: `Bearer ${robo}`, apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "limpeza" }) }); return r; })()).status === 401);

await rpc(gestor, "admin_save_veiculo_10a", { p_id: idV, p_placa: placa, p_nome: "Munck 10d " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 500, p_ativo: false });

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-10d-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
