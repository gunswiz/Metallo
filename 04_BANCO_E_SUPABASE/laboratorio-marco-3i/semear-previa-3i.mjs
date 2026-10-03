// Prepara dados SINTÉTICOS para a prévia visual do Marco 3I (Docker local apenas).
// Cria para o João da prévia: 1 entrega pendente (confirmar com/sem biometria) e 1 entrega com recusa registrada.
// Não imprime senhas nem tokens. Não toca no Supabase remoto.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const saved = JSON.parse(readFileSync(new URL("../../backups/credenciais-previa-3h.json", import.meta.url), "utf8"));
async function call(path, bearer, body) {
  const response = await fetch(new URL(path, base), { method: "POST", headers: { apikey: anon, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text(); return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function login(user) { const r = await call("/auth/v1/token?grant_type=password", anon, { email: user.email, password: user.password }); assert.equal(r.status, 200); return r.data.access_token; }
const admin = await login(saved.admin), joao = await login(saved.joao);
const adminId = JSON.parse(Buffer.from(admin.split(".")[1], "base64url").toString("utf8")).sub;
const profile = await call("/rest/v1/rpc/my_employee_profile", joao, {});
const employeeId = profile.data?.[0]?.employee_id; assert.ok(employeeId, "perfil do João da prévia indisponível");
const tag = Date.now();
function item(name, unit) {
  const id = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by) values(${quote(`PREVIA-3I-${tag}-${name}`)},${quote(name)},'epi',${quote(unit)},${quote(adminId)}::uuid) returning id`);
  const batch = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,variant,created_by) values(${quote(id)}::uuid,20,'CA-40377','G',${quote(adminId)}::uuid) returning id`);
  return { item_id: id, stock_batch_id: batch, quantity: 1 };
}
async function deliver(lines) {
  const prep = await call("/rest/v1/rpc/prepare_epi_kit_3d", admin, { p_employee_id: employeeId, p_lines: lines, p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200, JSON.stringify(prep.data));
  const group = await call("/rest/v1/rpc/register_epi_delivery_3d", admin, { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(group.status, 200, JSON.stringify(group.data)); return group.data;
}
await deliver([item("Luva de vaqueta (prévia 3I)", "par"), item("Óculos de proteção (prévia 3I)", "un")]);
const refused = await deliver([item("Protetor auricular (prévia 3I)", "un")]);
const r = await call("/rest/v1/rpc/manage_epi_delivery_feedback_3d", admin, { p_group_id: refused, p_action: "RECUSA",
  p_public_message: "Recusou receber o protetor auricular nesta entrega (dado sintético da prévia).", p_internal_note: "Testemunha sintética: encarregado da prévia", p_idempotency_key: randomUUID() });
assert.equal(r.status, 200, JSON.stringify(r.data));
console.log(JSON.stringify({ ok: true, preview: "João da prévia: 1 entrega pendente + 1 com recusa registrada", scope: "SIMULAÇÃO SEM VALOR OFICIAL" }));
