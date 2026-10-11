// Marcos 5B (pedido atendido baixa o estoque), 5C (alerta de estoque baixo) e 5D (vencimentos) no TESTE ONLINE.
// Contas FICTÍCIAS. Não imprime senha nem token.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marcos 5B, 5C e 5D — baixa do pedido, alertas e vencimentos (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function rest(tok, path) { const r = await fetch(`${BASE}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${tok}` } }); return { status: r.status, data: await r.json() }; }
const dia = ms => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(ms));

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);

// ---------- 5B ----------
const mats = await rpc(robo, "my_materiais_3t");
const parafuso = mats.data.find(m => /Parafuso sextavado/.test(m.nome));
check("5B material de prova disponível no app", Boolean(parafuso));
const p1 = await rpc(robo, "create_pedido_material_3t", { p_item_id: parafuso.item_id, p_quantidade: 2, p_observacao: "prova 5B", p_idempotency_key: randomUUID() });
const lista1 = await rpc(gestor, "admin_pedidos_material_5b"), linha1 = lista1.data?.find(p => p.id === p1.data);
check("5B Gestão vê equipe e saldo da obra no pedido", lista1.status === 200 && linha1?.equipe && typeof linha1.saldo_obra === "number" && linha1.baixa_feita === false, JSON.stringify(linha1));
const saldoAntes = Number(linha1?.saldo_obra ?? 0);
check("5B funcionário não usa a resposta com baixa", (await rpc(robo, "decide_pedido_material_5b", { p_id: p1.data, p_status: "atendido", p_resposta: "", p_baixar: true })).status >= 400);
const at = await rpc(gestor, "decide_pedido_material_5b", { p_id: p1.data, p_status: "atendido", p_resposta: "Retire no contêiner", p_baixar: true });
check("5B Gestão atende com baixa no estoque", at.status < 300, JSON.stringify(at.data));
const linha1b = (await rpc(gestor, "admin_pedidos_material_5b")).data.find(p => p.id === p1.data);
check("5B saldo da obra diminuiu exatamente a quantidade pedida", Number(linha1b.saldo_obra) === saldoAntes - 2, `${saldoAntes} -> ${linha1b.saldo_obra}`);
check("5B pedido fica atendido e marcado como baixado", linha1b.status === "atendido" && linha1b.baixa_feita === true);
const mov = await rest(gestor, `movements?select=quantity,movement_type,note&note=like.*${encodeURIComponent("Pedido pelo app nº " + p1.data + " ")}*`);
check("5B consumo lançado no histórico de movimentações (uma vez só)", mov.status === 200 && mov.data.length === 1 && Number(mov.data[0].quantity) === 2, JSON.stringify(mov.data));
check("5B pedido já respondido não é atendido de novo", (await rpc(gestor, "decide_pedido_material_5b", { p_id: p1.data, p_status: "atendido", p_resposta: "", p_baixar: true })).status >= 400);
check("5B app do funcionário vê o pedido atendido", (await rpc(robo, "my_pedidos_material_3t")).data.some(p => p.id === p1.data && p.status === "atendido"));
// Sem saldo: recusa a baixa e o pedido continua aberto.
const p2 = await rpc(robo, "create_pedido_material_3t", { p_item_id: parafuso.item_id, p_quantidade: saldoAntes + 500, p_observacao: "prova 5B sem saldo", p_idempotency_key: randomUUID() });
const sem = await rpc(gestor, "decide_pedido_material_5b", { p_id: p2.data, p_status: "atendido", p_resposta: "", p_baixar: true });
check("5B sem saldo na obra: a baixa é recusada com aviso claro", sem.status >= 400 && /insufficient_stock/.test(JSON.stringify(sem.data)), JSON.stringify(sem.data));
const linha2 = (await rpc(gestor, "admin_pedidos_material_5b")).data.find(p => p.id === p2.data);
check("5B sem saldo: pedido continua aberto e estoque não mexe", linha2.status === "aberto" && linha2.baixa_feita === false && Number(linha2.saldo_obra) === saldoAntes - 2);
// Atender SEM baixa (saída já lançada) continua possível.
const sb = await rpc(gestor, "decide_pedido_material_5b", { p_id: p2.data, p_status: "atendido", p_resposta: "Saída já lançada", p_baixar: false });
const linha2b = (await rpc(gestor, "admin_pedidos_material_5b")).data.find(p => p.id === p2.data);
check("5B atender sem baixa não mexe no estoque", sb.status < 300 && linha2b.status === "atendido" && linha2b.baixa_feita === false && Number(linha2b.saldo_obra) === saldoAntes - 2);

// ---------- 5D ----------
const epi = await rest(gestor, "epi_items?select=id&limit=1"), epiId = epi.data?.[0]?.id;
const antes = (await rpc(gestor, "ca_validades_5d")).data?.find(v => v.item_id === epiId)?.validade ?? null;
const alvo = dia(Date.now() + 10 * 86400000);
check("5D funcionário não muda validade do C.A.", (await rpc(robo, "admin_set_ca_validade_5d", { p_item_id: epiId, p_validade: alvo })).status >= 400);
check("5D Gestão salva validade do C.A.", (await rpc(gestor, "admin_set_ca_validade_5d", { p_item_id: epiId, p_validade: alvo })).status < 300);
check("5D data absurda é recusada", (await rpc(gestor, "admin_set_ca_validade_5d", { p_item_id: epiId, p_validade: "1990-01-01" })).status >= 400);
check("5D Gestão lê a validade salva", (await rpc(gestor, "ca_validades_5d")).data.some(v => v.item_id === epiId && v.validade === alvo));
const venc = await rpc(gestor, "vencimentos_epi_5d");
check("5D C.A. vencendo em 10 dias aparece na lista de vencimentos", venc.status === 200 && venc.data.some(v => v.grupo === "CA" && v.vence_em === alvo));
check("5D funcionário não vê os vencimentos da Gestão", (await rpc(robo, "vencimentos_epi_5d")).status >= 400);
check("5D sem login não vê os vencimentos", (await rpc(null, "vencimentos_epi_5d")).status >= 400);
await rpc(gestor, "admin_set_ca_validade_5d", { p_item_id: epiId, p_validade: antes });

// ---------- 5C ----------
const fn = `${BASE}/functions/v1/lembrete-consumo`;
const semSegredo = await fetch(fn, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "alertas" }) });
check("5C disparo dos alertas sem a chave do agendador é recusado", semSegredo.status === 401);
const errado = await fetch(fn, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json", "x-metallo-cron": "chave-errada" }, body: JSON.stringify({ acao: "alertas" }) });
check("5C chave errada também é recusada", errado.status === 401);
check("5C funcionário não chama a montagem dos alertas", (await rpc(robo, "aviso_alertas_5c", {})).status >= 400);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-5b-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
