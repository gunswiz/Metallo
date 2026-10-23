// Marco 3T no TESTE ONLINE: pedido de material pelo app e resposta da Gestão. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 10B — foto do defeito da frota (teste online)", checks: [] };
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
const respostas = (n, extra = {}) => itens.map(i => i.codigo === 8 ? { codigo: 8, situacao: "N", obs: "pneu careca", ...extra } : { codigo: i.codigo, situacao: "C", obs: "" });

const f1 = await enviar(robo, idV, PNG);
check("foto PNG enviada pelo funcionário", f1.status === 201 && /^[0-9a-f-]{36}$/.test(f1.data.id ?? ""), JSON.stringify(f1));
check("arquivo que não é foto é recusado", (await enviar(robo, idV, Buffer.from("%PDF-1.4 teste"), "x.pdf")).status === 415);
check("sem login a função recusa", (await fetch(FN, { method: "POST", headers: { apikey: KEY, Origin: ORIGEM_APP } })).status >= 400);
check("conta da Gestão não envia foto como funcionário", (await (async () => { const f = new FormData(); f.set("acao", "enviar"); f.set("veiculo_id", String(idV)); f.set("arquivo", new Blob([PNG]), "a.png");
  const r = await fetch(FN, { method: "POST", headers: { Authorization: `Bearer ${gestor}`, apikey: KEY, Origin: ORIGEM_APP }, body: f }); return r; })()).status >= 400);
const a1 = await abrir(gestor, f1.data.id);
check("Gestão abre a foto (link de 2 minutos no balde privado)", a1.status === 200 && String(a1.data.url).includes("/storage/v1/object/sign/frota-10b/") && a1.data.expira_em_s === 120);
const baixa = await fetch(a1.data.url);
check("o link entrega a imagem enviada", baixa.status === 200 && (await baixa.arrayBuffer()).byteLength === PNG.length);
check("outro funcionário não abre a foto", (await abrir(maria, f1.data.id, ORIGEM_APP)).status >= 400);
check("endereço público do balde não funciona", (await fetch(`${BASE}/storage/v1/object/public/frota-10b/${idV}/${f1.data.id}.png`)).status >= 400);
check("outro funcionário não usa a foto do robô no checklist", (await rpc(maria, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8, { foto: f1.data.id }), p_ciente: true, p_key: randomUUID() })).status >= 400);
check("foto inexistente no checklist é recusada", (await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8, { foto: randomUUID() }), p_ciente: true, p_key: randomUUID() })).status >= 400);
const c = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8, { foto: f1.data.id }), p_ciente: true, p_key: randomUUID() });
check("checklist com foto no item N", c.status === 200 && c.data[0].resultado === "nao_liberado");
const det = await rpc(gestor, "admin_frota_checklist_10a", { p_id: c.data[0].id });
check("Gestão vê a foto no item certo", det.status === 200 && det.data.itens.find(i => i.codigo === 8).foto === f1.data.id && !det.data.itens.find(i => i.codigo === 1).foto);
const f2 = await enviar(robo, idV, PNG);
check("a mesma foto não vale para dois itens/checklists", (await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "", p_obs: "", p_respostas: respostas(8, { foto: f1.data.id }), p_ciente: true, p_key: randomUUID() })).status >= 400);
await rpc(gestor, "admin_liberar_10a", { p_veiculo: idV, p_motivo: "prova de foto" });
const s = await rpc(robo, "create_saida_10a", { p_veiculo: idV, p_destino: "Obra", p_acompanhantes: "", p_km: 500, p_obs: "", p_key: randomUUID() });
const ch = await rpc(robo, "create_chegada_10a", { p_viagem: s.data, p_km: 520, p_problema: "vazamento de óleo", p_obs: "", p_key: randomUUID() });
check("chegada registrada", ch.status < 300);
check("outro funcionário não anexa foto na chegada do robô", (await rpc(maria, "anexar_foto_chegada_10b", { p_viagem: s.data, p_foto: f2.data.id })).status >= 400);
check("robô anexa foto na chegada", (await rpc(robo, "anexar_foto_chegada_10b", { p_viagem: s.data, p_foto: f2.data.id })).status < 300);
const fc = await rpc(gestor, "admin_frota_fotos_chegada_10b", { p_veiculo: idV });
check("Gestão vê a foto da chegada", fc.status === 200 && fc.data.some(x => x.viagem_id === s.data && x.foto_id === f2.data.id));
check("funcionário não lista fotos da Gestão", (await rpc(robo, "admin_frota_fotos_chegada_10b", { p_veiculo: idV })).status >= 400);
await rpc(gestor, "admin_save_veiculo_10a", { p_id: idV, p_placa: placa, p_nome: "Munck foto " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 520, p_ativo: false });

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-10b-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
