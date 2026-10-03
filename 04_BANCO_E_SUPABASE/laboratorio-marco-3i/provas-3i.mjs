// Marco 3I — EPI sem papel. Aplica o contrato e prova no Supabase Docker LOCAL (Auth/JWT/PostgREST reais).
// Dados sintéticos. Não conecta no Supabase remoto.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createPreviewAccounts, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
sql(readFileSync(new URL("./contrato-epi-sem-papel.sql", import.meta.url), "utf8"));
await new Promise(resolve => setTimeout(resolve, 1500)); // PostgREST recarrega o schema

const evidence = { at: new Date().toISOString(), scope: "Marco 3I local sintético", checks: [] };
function check(name, good) { evidence.checks.push({ name, ok: Boolean(good) }); if (!good) console.error("FALHOU:", name); }
async function call(path, bearer, body = {}) {
  const url = new URL(path, base); assert.equal(url.origin, base);
  const response = await fetch(url, { method: "POST", headers: { apikey: anon, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
const rpc = (name, token, args = {}) => call(`/rest/v1/rpc/${name}`, token, args);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon, { email: account.email, password: account.password });
  assert.equal(response.status, 200); return response.data.access_token;
}
const { accounts, adminAccessToken } = await createPreviewAccounts();
const adminId = JSON.parse(Buffer.from(adminAccessToken.split(".")[1], "base64url").toString("utf8")).sub;
const joao = await login(accounts.joao), maria = await login(accounts.maria);

// Permissões
check("RPCs 3I só para authenticated", sql(`select count(*),bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
  ('my_epi_awareness_3i','accept_epi_awareness_3i','admin_epi_awareness_3i','respond_epi_delivery_3d','manage_epi_delivery_feedback_3d')`) === "5|t");
check("tabela do termo sem DML para browser", sql(`select has_table_privilege('authenticated','public.epi_awareness_terms_3i','SELECT'),
  has_table_privilege('authenticated','public.epi_awareness_terms_3i','INSERT')`) === "f|f");
check("texto do termo não é exposto diretamente", sql(`select has_function_privilege('authenticated','private.epi_awareness_text_3i()','EXECUTE')`) === "f");

// Termo de ciência
const term = await rpc("my_epi_awareness_3i", joao);
check("João vê termo pendente com texto e hash", term.status === 200 && term.data.length === 1 && term.data[0].accepted_at === null &&
  /6\.6\.1/.test(term.data[0].term_text) && /^[0-9a-f]{64}$/.test(term.data[0].term_sha256));
check("hash diferente do texto é recusado", (await rpc("accept_epi_awareness_3i", joao, { p_term_sha256: "0".repeat(64), p_idempotency_key: randomUUID() })).status >= 400);
check("anon não aceita termo", (await rpc("accept_epi_awareness_3i", anon, { p_term_sha256: term.data[0].term_sha256, p_idempotency_key: randomUUID() })).status >= 400);
const accepted = await rpc("accept_epi_awareness_3i", joao, { p_term_sha256: term.data[0].term_sha256, p_idempotency_key: randomUUID() });
check("João aceita o termo", accepted.status === 200 && Number.isFinite(Date.parse(accepted.data)));
const again = await rpc("accept_epi_awareness_3i", joao, { p_term_sha256: term.data[0].term_sha256, p_idempotency_key: randomUUID() });
check("aceite repetido não duplica e mantém a data original", again.status === 200 && again.data === accepted.data &&
  sql(`select count(*) from public.epi_awareness_terms_3i where employee_id=${quote(accounts.joao.employeeId)}::uuid`) === "1");
check("aceite de João não marca Maria", (await rpc("my_epi_awareness_3i", maria)).data[0].accepted_at === null);
let blocked = false; try { sql(`update public.epi_awareness_terms_3i set accepted_at=now() where employee_id=${quote(accounts.joao.employeeId)}::uuid`); } catch { blocked = true; }
check("aceite é imutável (update bloqueado)", blocked);
blocked = false; try { sql(`delete from public.epi_awareness_terms_3i where employee_id=${quote(accounts.joao.employeeId)}::uuid`); } catch { blocked = true; }
check("aceite é imutável (delete bloqueado)", blocked);
const adminView = await rpc("admin_epi_awareness_3i", adminAccessToken, { p_employee_id: accounts.joao.employeeId });
check("Gestão vê aceite de João", adminView.status === 200 && adminView.data.length === 1 && adminView.data[0].accepted_at === accepted.data);
check("funcionário não consulta visão da Gestão", (await rpc("admin_epi_awareness_3i", joao, { p_employee_id: null })).data.length === 0);

// Entrega 3D sintética para a recusa
const tag = Date.now();
const itemId = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by) values(${quote(`3I-${tag}`)},'Luva sintética 3I','epi','par',${quote(adminId)}::uuid) returning id`);
const batchId = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,variant,created_by) values(${quote(itemId)}::uuid,10,'CA-3I','G',${quote(adminId)}::uuid) returning id`);
async function deliver(employeeId) {
  const prep = await rpc("prepare_epi_kit_3d", adminAccessToken, { p_employee_id: employeeId,
    p_lines: [{ item_id: itemId, stock_batch_id: batchId, quantity: 1 }], p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200, JSON.stringify(prep.data));
  const group = await rpc("register_epi_delivery_3d", adminAccessToken, { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(group.status, 200, JSON.stringify(group.data));
  return group.data;
}
const groupId = await deliver(accounts.joao.employeeId);
const manage = (token, action, message, note = null, key = randomUUID()) =>
  rpc("manage_epi_delivery_feedback_3d", token, { p_group_id: groupId, p_action: action, p_public_message: message, p_internal_note: note, p_idempotency_key: key });
check("recusa sem mensagem ao funcionário é rejeitada", (await manage(adminAccessToken, "RECUSA", null)).status >= 400);
check("funcionário não registra recusa", (await manage(joao, "RECUSA", "Recusa sintética")).status >= 400);
const refusalKey = randomUUID();
const refusal = await manage(adminAccessToken, "RECUSA", "Funcionário recusou receber a luva sintética.", "Testemunha sintética: encarregado", refusalKey);
check("Gestão registra recusa", refusal.status === 200);
check("retry da recusa é idempotente", (await manage(adminAccessToken, "RECUSA", "Funcionário recusou receber a luva sintética.", "Testemunha sintética: encarregado", refusalKey)).data === refusal.data);
check("segunda recusa seguida é transição inválida", (await manage(adminAccessToken, "RECUSA", "Outra recusa")).status >= 400);
const mine = (await rpc("my_epi_delivery_groups_3d", joao)).data.find(row => row.group_id === groupId);
check("João vê a recusa com a mensagem da Gestão", mine?.feedback_status === "RECUSA" && mine.public_message === "Funcionário recusou receber a luva sintética.");
check("nota interna não aparece ao funcionário", !JSON.stringify(mine).includes("Testemunha"));
const report = await rpc("my_epi_report_3e", joao);
check("ficha/histórico inclui a recusa", report.status === 200 && JSON.stringify(report.data).includes("\"RECUSA\""));
const confirm = await rpc("respond_epi_delivery_3d", joao, { p_group_id: groupId, p_action: "CONFIRMADO", p_delivery_id: null, p_category: null, p_details: null, p_idempotency_key: randomUUID() });
check("após recusa, João ainda pode confirmar o recebimento", confirm.status === 200);
check("recusa depois de confirmado é transição inválida", (await manage(adminAccessToken, "RECUSA", "Recusa após confirmação")).status >= 400);
blocked = false; try { sql(`update public.epi_delivery_feedback_events_3d set public_message='x' where id=${Number(refusal.data)}`); } catch { blocked = true; }
check("evento de recusa é imutável", blocked);
const fresh = await deliver(accounts.joao.employeeId);
check("fluxo antigo continua: confirmação direta sem recusa", (await rpc("respond_epi_delivery_3d", joao, { p_group_id: fresh, p_action: "CONFIRMADO", p_delivery_id: null, p_category: null, p_details: null, p_idempotency_key: randomUUID() })).status === 200);

evidence.passed = evidence.checks.every(row => row.ok); evidence.count = evidence.checks.length;
writeFileSync(new URL("./resultado-3i.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ passed: evidence.passed, checks: evidence.count, failed: evidence.checks.filter(row => !row.ok).map(row => row.name) }));
if (!evidence.passed) process.exitCode = 1;
