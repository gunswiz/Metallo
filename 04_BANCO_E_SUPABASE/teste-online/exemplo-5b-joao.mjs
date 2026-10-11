// Deixa um pedido de material ABERTO do João (fictício) para testar a baixa na tela Pedidos da Gestão.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const u = cred.colaborador.joao;
const tok = (await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) })).json()).access_token;
const rpc = async (fn, a = {}) => (await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(a) })).json();
const mats = await rpc("my_materiais_3t");
const m = mats.find(x => /Arame MIG/.test(x.nome)) ?? mats[0];
console.log("pedido", await rpc("create_pedido_material_3t", { p_item_id: m.item_id, p_quantidade: 2, p_observacao: "Acabou o arame na solda", p_idempotency_key: randomUUID() }), m.nome);
