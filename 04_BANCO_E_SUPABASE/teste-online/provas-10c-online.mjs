// Marco 10C no TESTE ONLINE: defeito vira relato na manutenção e aviso. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 10C — defeito da frota vira relato e alerta (teste online)", checks: [] };
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
async function avisar(tok, veiculo, origem = ORIGEM_APP) {
  const r = await fetch(FN, { method: "POST", headers: { Authorization: `Bearer ${tok}`, apikey: KEY, Origin: origem, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "avisar", veiculo_id: veiculo }) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const f1 = await enviar(robo, idV, PNG);
const c = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8, { foto: f1.data.id }), p_ciente: true, p_key: randomUUID() });
check("checklist com defeito registrado", c.status === 200 && c.data[0].resultado === "nao_liberado");
const at = await rpc(gestor, "admin_frota_atencao_10a");
check("alerta de defeito aparece para a Gestão", at.status === 200 && at.data.some(a => a.veiculo_id === idV && a.tipo === "defeito" && a.gravidade === "vencido"), JSON.stringify(at.data).slice(0, 300));
check("funcionário não lê os alertas da Gestão", (await rpc(robo, "admin_frota_atencao_10a")).status >= 400);
const rel = await rpc(gestor, "admin_frota_relatos_10c", { p_veiculo: idV });
const r0 = rel.data?.[0]?.relatos?.[0];
check("manutenção aberta traz o relato com item, observação e foto", rel.status === 200 && r0?.tipo === "checklist" && r0.itens.some(i => i.obs === "pneu careca" && i.foto === f1.data.id), JSON.stringify(rel.data).slice(0, 400));
check("funcionário não lê os relatos", (await rpc(robo, "admin_frota_relatos_10c", { p_veiculo: idV })).status >= 400);
const av = await avisar(robo, idV);
check("aviso do defeito é aceito pela função", av.status === 200 && av.data.ok === true, JSON.stringify(av));
check("segundo aviso seguido não repete", (await avisar(robo, idV)).data.enviado === false);
check("outro funcionário não dispara aviso do defeito do robô", (await avisar(maria, idV)).data.enviado === false);
check("Gestão não dispara aviso como funcionário", (await avisar(gestor, idV)).status >= 400 || (await avisar(gestor, idV)).data.enviado === false);
check("origem da Gestão não pode avisar", (await avisar(gestor, idV, ORIGEM_GESTAO)).status >= 400);
check("aviso sem veículo é recusado", (await avisar(robo, 0)).status === 400);
await rpc(gestor, "admin_liberar_10a", { p_veiculo: idV, p_motivo: "prova 10c" });
const s = await rpc(robo, "create_saida_10a", { p_veiculo: idV, p_destino: "Obra", p_acompanhantes: "", p_km: 500, p_obs: "", p_key: randomUUID() });
const ch = await rpc(robo, "create_chegada_10a", { p_viagem: s.data, p_km: 530, p_problema: "barulho no guindaste", p_obs: "", p_key: randomUUID() });
check("chegada com problema registrada", ch.status < 300);
const rel2 = await rpc(gestor, "admin_frota_relatos_10c", { p_veiculo: idV });
const todos = (rel2.data ?? []).flatMap(x => x.relatos ?? []);
check("relato da chegada traz o problema escrito", todos.some(x => x.tipo === "chegada" && x.problema === "barulho no guindaste"), JSON.stringify(rel2.data).slice(0, 400));
await rpc(gestor, "admin_save_veiculo_10a", { p_id: idV, p_placa: placa, p_nome: "Munck 10c " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 530, p_ativo: false });

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-10c-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
