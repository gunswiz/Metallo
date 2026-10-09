// Marco 3T no TESTE ONLINE: pedido de material pelo app e resposta da Gestão. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3T — pedido de material (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }

const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const mats = await rpc(robo, "my_materiais_3t");
check("app lista materiais (sem equipamentos)", mats.status === 200 && mats.data.length >= 10 && mats.data.every(m => m.item_id && m.unidade));
const disco = mats.data.find(m => /Disco de corte/.test(m.nome)) ?? mats.data[0], chave = randomUUID();
const p1 = await rpc(robo, "create_pedido_material_3t", { p_item_id: disco.item_id, p_quantidade: 3, p_observacao: "prova automática", p_idempotency_key: chave });
const p1b = await rpc(robo, "create_pedido_material_3t", { p_item_id: disco.item_id, p_quantidade: 3, p_observacao: "prova automática", p_idempotency_key: chave });
check("pedido criado; reenvio com a mesma chave não duplica", p1.status === 200 && p1b.data === p1.data);
check("quantidade inválida recusada", (await rpc(robo, "create_pedido_material_3t", { p_item_id: disco.item_id, p_quantidade: 0, p_observacao: "", p_idempotency_key: randomUUID() })).status >= 400);
check("conta da Gestão não pede material como funcionário", (await rpc(gestor, "create_pedido_material_3t", { p_item_id: disco.item_id, p_quantidade: 1, p_observacao: "", p_idempotency_key: randomUUID() })).status >= 400);
const maria_v = await rpc(maria, "my_pedidos_material_3t");
check("Maria não vê o pedido do robô", maria_v.status === 200 && !maria_v.data.some(p => p.id === p1.data));
check("Maria não cancela o pedido do robô", (await rpc(maria, "cancel_pedido_material_3t", { p_id: p1.data })).status >= 400);
const g = await rpc(gestor, "admin_pedidos_material_3t");
check("Gestão vê o pedido aberto com nome e material", g.status === 200 && g.data.some(p => p.id === p1.data && p.status === "aberto" && p.material === disco.nome));
check("funcionário não responde pedido", (await rpc(robo, "decide_pedido_material_3t", { p_id: p1.data, p_status: "atendido", p_resposta: "" })).status >= 400);
check("recusar sem motivo é recusado", (await rpc(gestor, "decide_pedido_material_3t", { p_id: p1.data, p_status: "recusado", p_resposta: "" })).status >= 400);
check("Gestão marca como atendido", (await rpc(gestor, "decide_pedido_material_3t", { p_id: p1.data, p_status: "atendido", p_resposta: "Retire no contêiner" })).status < 300);
const meus = await rpc(robo, "my_pedidos_material_3t");
check("funcionário vê 'atendido' e a resposta", meus.data.some(p => p.id === p1.data && p.status === "atendido" && p.resposta === "Retire no contêiner"));
const p2 = await rpc(robo, "create_pedido_material_3t", { p_item_id: disco.item_id, p_quantidade: 1, p_observacao: "", p_idempotency_key: randomUUID() });
check("funcionário cancela o próprio pedido aberto", (await rpc(robo, "cancel_pedido_material_3t", { p_id: p2.data })).status < 300);
check("pedido já respondido não pode ser cancelado", (await rpc(robo, "cancel_pedido_material_3t", { p_id: p1.data })).status >= 400);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-3t-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
