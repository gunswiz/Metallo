// Provas locais sintéticas da integração 3G com os lotes já usados pelo Almoxarifado.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPreviewAccounts, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const result = { scope: "Marco 3G — estoque local sintético", at: new Date().toISOString(), checks: [] };
function check(name, condition) { const ok = Boolean(condition); result.checks.push({ name, ok }); assert.ok(ok, name); }
async function call(path, token, body) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { apikey: anon,
    Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
const rpc = (name, token, body = {}) => call(`/rest/v1/rpc/${name}`, token, body);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon,
    { email: account.email, password: account.password });
  assert.equal(response.status, 200);
  return response.data.access_token;
}
const { accounts, team, adminAccessToken: admin } = await createPreviewAccounts();
const joao = await login(accounts.joao), maria = await login(accounts.maria);
const adminId = sql("select id from public.profiles where active and role='admin' order by created_at desc limit 1");
const legacyBefore = Number(sql("select count(*) from private.personal_item_deliveries_3g where stock_origin='LEGACY_PRE_INTEGRATION'"));
const key = () => randomUUID();
function item(name) {
  return sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
    values(${quote(`LAB3G-STOCK-${randomUUID().slice(0,8)}`)},${quote(name)},'personal_tool','un',
      ${quote(adminId)}::uuid) returning id`);
}
function batch(itemId, quantity, worksiteId = null) {
  return sql(`insert into public.epi_stock_batches(item_id,quantity,created_by,worksite_id)
    values(${quote(itemId)}::uuid,${quantity},${quote(adminId)}::uuid,
      ${worksiteId ? `${quote(worksiteId)}::uuid` : "null"}) returning id`);
}
const balance = batchId => Number(sql(`select quantity from public.epi_stock_batches where id=${quote(batchId)}::uuid`));
const deliveries = keyId => Number(sql(`select count(*) from private.personal_item_deliveries_3g
  where idempotency_key=${quote(keyId)}::uuid`));
const linked = deliveryId => sql(`select stock_origin||':'||coalesce(stock_batch_id::text,'-')
  from private.personal_item_deliveries_3g where id=${quote(deliveryId)}::uuid`);
const deliver = (token, employeeId, itemId, batchId, quantity = 1, idempotencyKey = key(),
  origin = batchId ? "STOCK_BATCH" : "WITHOUT_STOCK") => rpc("deliver_personal_item_3g", token, {
    p_employee_id: employeeId, p_item_id: itemId, p_quantity: quantity, p_variant: null,
    p_note: origin === "WITHOUT_STOCK" ? "Origem sintética sem estoque" : null,
    p_idempotency_key: idempotencyKey, p_stock_origin: origin, p_stock_batch_id: batchId,
    p_exception_reason: origin === "WITHOUT_STOCK" ? "UNTRACKED_LEGACY_STOCK" : null,
    p_exception_confirmed: origin === "WITHOUT_STOCK",
  });
const exceptionBody = (employeeId, itemId, overrides = {}) => ({
  p_employee_id: employeeId, p_item_id: itemId, p_quantity: 1, p_variant: null,
  p_note: null, p_idempotency_key: key(), p_stock_origin: "WITHOUT_STOCK", p_stock_batch_id: null,
  p_exception_reason: "EXTERNAL_SUPPLY", p_exception_confirmed: true, ...overrides,
});
const close = (token, deliveryId, action, destination, relatedId = null, idempotencyKey = key()) =>
  rpc("close_personal_item_3g", token, { p_delivery_id: deliveryId, p_action: action,
    p_related_delivery_id: relatedId, p_note: null, p_idempotency_key: idempotencyKey,
    p_return_destination: destination });

const trena = item("Trena 5 m — estoque sintético 3G");
const stock = batch(trena, 10);
const originalKey = key();
const first = await deliver(admin, accounts.joao.employeeId, trena, stock, 1, originalKey);
check("A: entrega vinculada desconta 10 para 9", first.status === 200 && balance(stock) === 9);
check("vínculo imutável da saída aponta ao lote existente", linked(first.data) === `STOCK_BATCH:${stock}`);
const retried = await deliver(admin, accounts.joao.employeeId, trena, stock, 1, originalKey);
check("K/L: retry e resposta perdida retornam a mesma entrega, sem segunda saída",
  retried.status === 200 && retried.data === first.data && balance(stock) === 9 && deliveries(originalKey) === 1);
const intentItem = item("Intenção idempotente sintética 3G"), intentBatch = batch(intentItem, 5);
const intentKey = key();
const intent = await deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 1, intentKey);
check("F-3G-01: tentativa inicial cria uma entrega e uma baixa", intent.status === 200 && balance(intentBatch) === 4);
const intentRetry = await deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 1, intentKey);
check("F-3G-01: timeout/resposta perdida mantém resultado e saldo", intentRetry.status === 200
  && intentRetry.data === intent.data && deliveries(intentKey) === 1 && balance(intentBatch) === 4);
const conflict = await deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 2, intentKey);
check("F-3G-01: mesma chave com payload divergente gera conflito controlado", conflict.status >= 400
  && conflict.data?.message === "idempotency_conflict" && balance(intentBatch) === 4);
const newIntent = await deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 1, key());
check("F-3G-01: nova chave permite outra entrega intencional", newIntent.status === 200
  && newIntent.data !== intent.data && balance(intentBatch) === 3);
const doubleKey = key();
const doubleClick = await Promise.all([deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 1, doubleKey),
  deliver(admin, accounts.joao.employeeId, intentItem, intentBatch, 1, doubleKey)]);
check("F-3G-01: dois envios simultâneos da mesma operação fazem uma só baixa",
  doubleClick.every(row => row.status === 200 && row.data === doubleClick[0].data)
  && deliveries(doubleKey) === 1 && balance(intentBatch) === 2);
const sameKey = key();
const tabs = await Promise.all(Array.from({ length: 2 }, () =>
  deliver(admin, accounts.maria.employeeId, trena, stock, 1, sameKey)));
check("M: duas abas com a mesma intenção fazem uma saída", tabs.every(x => x.status === 200 && x.data === tabs[0].data)
  && balance(stock) === 8 && deliveries(sameKey) === 1);
const without = await deliver(admin, accounts.joao.employeeId, trena, null);
check("B: entrega sem vínculo explícito não movimenta estoque", without.status === 200 && balance(stock) === 8
  && linked(without.data) === "WITHOUT_STOCK:-");
check("origem sem estoque exige justificativa", (await rpc("deliver_personal_item_3g", admin, {
  p_employee_id: accounts.joao.employeeId, p_item_id: trena, p_quantity: 1, p_variant: null,
  p_note: null, p_idempotency_key: key(), p_stock_origin: "WITHOUT_STOCK", p_stock_batch_id: null,
  p_exception_reason: null, p_exception_confirmed: false,
})).status >= 400 && balance(stock) === 8);
check("exceção direta sem confirmação é recusada", (await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { p_exception_confirmed: false }))).status >= 400 && balance(stock) === 8);
check("motivo OUTRO sem observação é recusado", (await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { p_exception_reason: "OTHER" }))).status >= 400 && balance(stock) === 8);
check("ausência de lote não ativa exceção automaticamente", (await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { p_stock_origin: "STOCK_BATCH",
    p_exception_reason: null, p_exception_confirmed: false }))).status >= 400 && balance(stock) === 8);
check("parâmetro skip_stock não contorna a assinatura da RPC", (await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { skip_stock: true }))).status >= 400 && balance(stock) === 8);
check("parâmetro without_stock não contorna a assinatura da RPC", (await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { without_stock: true }))).status >= 400 && balance(stock) === 8);
const scopedHelper = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?scoped=${randomUUID()}`);
const scoped = await scopedHelper.createPreviewAdminSession();
sql(`update public.profiles set role='engineer',operation_permissions=array['epi:write']::text[],
  operation_team_ids=array[${quote(team)}::uuid] where id=${quote(scoped.admin.id)}::uuid`);
check("Gestão com epi:write sem admin não pode usar a exceção", (await rpc("deliver_personal_item_3g",
  scoped.adminSession.access_token, exceptionBody(accounts.joao.employeeId, trena))).status >= 400 && balance(stock) === 8);
check("F-3G-02: Gestão com epi:write não baixa lote central por RPC direta", (await deliver(
  scoped.adminSession.access_token, accounts.joao.employeeId, trena, stock)).status >= 400 && balance(stock) === 8);
check("F-3G-02: batch_id central injetado para Maria também falha", (await deliver(
  scoped.adminSession.access_token, accounts.maria.employeeId, trena, stock)).status >= 400 && balance(stock) === 8);
check("F-3G-02: João não opera lote central nem com employee_id próprio", (await deliver(
  joao, accounts.joao.employeeId, trena, stock)).status >= 400 && balance(stock) === 8);
const centralReturnItem = item("Retorno central restrito 3G"), centralReturnBatch = batch(centralReturnItem, 2);
const centralReturnDelivery = await deliver(admin, accounts.joao.employeeId, centralReturnItem, centralReturnBatch);
check("F-3G-02: administrador autorizado pode operar lote central", centralReturnDelivery.status === 200
  && balance(centralReturnBatch) === 1);
check("F-3G-02: Gestão comum não repõe lote central por RPC direta", (await close(
  scoped.adminSession.access_token, centralReturnDelivery.data, "RETURNED", "STOCK_REUSABLE")).status >= 400
  && balance(centralReturnBatch) === 1);
check("F-3G-02: administrador autorizado repõe lote central original", (await close(
  admin, centralReturnDelivery.data, "RETURNED", "STOCK_REUSABLE")).status === 200
  && balance(centralReturnBatch) === 2);
check("João não cria entrega excepcional por chamada direta", (await rpc("deliver_personal_item_3g", joao,
  exceptionBody(accounts.joao.employeeId, trena))).status >= 400 && balance(stock) === 8);
const batchesBeforeException = Number(sql("select count(*) from public.epi_stock_batches"));
const exceptional = await rpc("deliver_personal_item_3g", admin,
  exceptionBody(accounts.joao.employeeId, trena, { p_exception_reason: "OTHER", p_note: "Material externo sintético" }));
check("exceção autorizada não movimenta saldo nem cria lote", exceptional.status === 200 &&
  balance(stock) === 8 && Number(sql("select count(*) from public.epi_stock_batches")) === batchesBeforeException);
check("auditoria da exceção usa ator e horário do servidor", sql(`select
  (stock_origin='WITHOUT_STOCK' and stock_batch_id is null and exception_reason='OTHER'
    and exception_acknowledged_at is not null and delivered_at is not null
    and delivered_by=${quote(adminId)}::uuid)::text
  from private.personal_item_deliveries_3g where id=${quote(exceptional.data)}::uuid`) === "true");
check("origem e motivo imutáveis após a entrega", (() => {
  try { sql(`update private.personal_item_deliveries_3g set stock_origin='STOCK_BATCH',
    exception_reason=null where id=${quote(exceptional.data)}::uuid`); return false; }
  catch { return balance(stock) === 8; }
})());
const confirmed = await rpc("confirm_personal_item_3g", joao,
  { p_delivery_id: first.data, p_idempotency_key: key() });
check("C: confirmação não desconta novamente", confirmed.status === 200 && balance(stock) === 8);
const requested = await rpc("report_personal_item_3g", joao, { p_delivery_id: first.data,
  p_action: "EXCHANGE_REQUESTED", p_category: "WEAR", p_note: null, p_idempotency_key: key() });
check("D: solicitação não desconta", requested.status === 200 && balance(stock) === 8);
const approved = await rpc("decide_personal_item_3g", admin, { p_request_id: requested.data,
  p_action: "EXCHANGE_APPROVED", p_note: null, p_idempotency_key: key() });
check("E: aprovação não desconta", approved.status === 200 && balance(stock) === 8);
const replacement = await deliver(admin, accounts.joao.employeeId, trena, stock);
check("F: nova entrega física desconta exatamente uma vez", replacement.status === 200 && balance(stock) === 7);
const replaced = await close(admin, first.data, "REPLACED", null, replacement.data);
check("substituição formal não movimenta estoque", replaced.status === 200 && balance(stock) === 7);
const evaluation = await close(admin, tabs[0].data, "RETURNED", "EVALUATION");
check("G: devolução para avaliação não aumenta saldo", evaluation.status === 200 && balance(stock) === 7);
const returnKey = key();
const reused = await close(admin, replacement.data, "RETURNED", "STOCK_REUSABLE", null, returnKey);
check("H: retorno reutilizável explícito aumenta saldo no lote de origem", reused.status === 200 && balance(stock) === 8);
check("retorno repetido com mesma chave não duplica entrada", (await close(admin, replacement.data,
  "RETURNED", "STOCK_REUSABLE", null, returnKey)).data === reused.data && balance(stock) === 8);
const damaged = await deliver(admin, accounts.joao.employeeId, trena, stock);
await rpc("report_personal_item_3g", joao, { p_delivery_id: damaged.data, p_action: "PROBLEM",
  p_category: "DAMAGED", p_note: null, p_idempotency_key: key() });
const beforeDamaged = balance(stock);
check("I: danificado não pode retornar como reutilizável", (await close(admin, damaged.data,
  "RETURNED", "STOCK_REUSABLE")).status >= 400 && balance(stock) === beforeDamaged);
check("danificado devolvido para avaliação não aumenta saldo", (await close(admin, damaged.data,
  "RETURNED", "DAMAGED")).status === 200 && balance(stock) === beforeDamaged);
const lost = await deliver(admin, accounts.maria.employeeId, trena, stock);
await rpc("report_personal_item_3g", maria, { p_delivery_id: lost.data, p_action: "PROBLEM",
  p_category: "LOST", p_note: null, p_idempotency_key: key() });
const beforeLost = balance(stock);
check("J: extraviado não retorna ao saldo nem pode ser reintegrado como reutilizável", (await close(admin, lost.data,
  "RETURNED", "STOCK_REUSABLE")).status >= 400 && balance(stock) === beforeLost);
check("João não confirma item de Maria", (await rpc("confirm_personal_item_3g", joao,
  { p_delivery_id: lost.data, p_idempotency_key: key() })).status >= 400);
check("funcionário não injeta lote ou matrícula para criar saída", (await deliver(joao,
  accounts.maria.employeeId, trena, stock)).status >= 400 && balance(stock) === beforeLost);
check("lote de outro item é recusado", (await deliver(admin, accounts.joao.employeeId,
  item("Outro item sintético 3G"), stock)).status >= 400 && balance(stock) === beforeLost);

const lastItem = item("Última unidade — concorrência 3G"), lastBatch = batch(lastItem, 1);
const parallel = await Promise.all([
  deliver(admin, accounts.joao.employeeId, lastItem, lastBatch),
  deliver(admin, accounts.maria.employeeId, lastItem, lastBatch),
]);
check("N: última unidade concorrente gera só uma entrega e nunca saldo negativo",
  parallel.filter(x => x.status === 200).length === 1 && parallel.filter(x => x.status >= 400).length === 1
  && balance(lastBatch) === 0 && Number(sql(`select count(*) from private.personal_item_deliveries_3g
    where stock_batch_id=${quote(lastBatch)}::uuid`)) === 1);
check("O/R: saldo insuficiente não cria entrega parcial", (await deliver(admin,
  accounts.joao.employeeId, lastItem, lastBatch, 2)).status >= 400 && balance(lastBatch) === 0);
const shortItem = item("Saldo um, pedido dois — 3G"), shortBatch = batch(shortItem, 1);
check("saldo 1, pedido 2: não cria entrega nem saldo parcial", (await deliver(admin,
  accounts.joao.employeeId, shortItem, shortBatch, 2)).status >= 400 && balance(shortBatch) === 1
  && Number(sql(`select count(*) from private.personal_item_deliveries_3g
    where stock_batch_id=${quote(shortBatch)}::uuid`)) === 0);

const debitItem = item("Falha no débito — rollback 3G"), debitBatch = batch(debitItem, 3);
sql(`create function private.lab3g_fail_debit() returns trigger language plpgsql set search_path='' as $$
  begin if new.id=${quote(debitBatch)}::uuid and new.quantity<old.quantity
    then raise exception 'lab3g_forced_debit_failure'; end if; return new; end $$`);
sql(`create trigger lab3g_fail_debit before update on public.epi_stock_batches
  for each row execute function private.lab3g_fail_debit()`);
try {
  check("R: falha no estoque impede criar entrega", (await deliver(admin,
    accounts.joao.employeeId, debitItem, debitBatch)).status >= 400 && balance(debitBatch) === 3
    && Number(sql(`select count(*) from private.personal_item_deliveries_3g
      where stock_batch_id=${quote(debitBatch)}::uuid`)) === 0);
} finally {
  sql("drop trigger lab3g_fail_debit on public.epi_stock_batches");
  sql("drop function private.lab3g_fail_debit()");
}
const failureItem = item("Falha após débito — rollback 3G"), failureBatch = batch(failureItem, 3);
sql(`create function private.lab3g_fail_insert() returns trigger language plpgsql set search_path='' as $$
  begin if new.item_id=${quote(failureItem)}::uuid then raise exception 'lab3g_forced_insert_failure'; end if;
    return new; end $$`);
sql(`create trigger lab3g_fail_insert before insert on private.personal_item_deliveries_3g
  for each row execute function private.lab3g_fail_insert()`);
try {
  check("S: falha na entrega reverte débito do lote", (await deliver(admin,
    accounts.joao.employeeId, failureItem, failureBatch)).status >= 400 && balance(failureBatch) === 3
    && Number(sql(`select count(*) from private.personal_item_deliveries_3g
      where stock_batch_id=${quote(failureBatch)}::uuid`)) === 0);
} finally {
  sql("drop trigger lab3g_fail_insert on private.personal_item_deliveries_3g");
  sql("drop function private.lab3g_fail_insert()");
}
const legacy = Number(sql("select count(*) from private.personal_item_deliveries_3g where stock_origin='LEGACY_PRE_INTEGRATION'"));
check("T: entregas antigas permanecem legadas sem lote inventado", legacy === legacyBefore &&
  Number(sql("select count(*) from private.personal_item_deliveries_3g where stock_origin='LEGACY_PRE_INTEGRATION' and stock_batch_id is not null")) === 0);
const oldTeam = sql(`insert into public.teams(name,location_type,active)
  values(${quote(`Equipe antiga 3G ${randomUUID().slice(0,8)}`)},'field',true) returning id`);
const oldWork = sql(`insert into public.worksites(name,stock_team_id,created_by)
  values(${quote(`Obra antiga 3G ${randomUUID().slice(0,8)}`)},${quote(oldTeam)}::uuid,
    ${quote(adminId)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(oldWork)}::uuid where id=${quote(oldTeam)}::uuid`);
const newTeam = sql(`insert into public.teams(name,location_type,active)
  values(${quote(`Equipe nova 3G ${randomUUID().slice(0,8)}`)},'field',true) returning id`);
const newWork = sql(`insert into public.worksites(name,stock_team_id,created_by)
  values(${quote(`Obra nova 3G ${randomUUID().slice(0,8)}`)},${quote(newTeam)}::uuid,
    ${quote(adminId)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(newWork)}::uuid where id=${quote(newTeam)}::uuid`);
const movedItem = item("Trena com mudança de obra 3G");
const oldBatch = batch(movedItem, 1, oldWork), newBatch = batch(movedItem, 5, newWork);
sql(`update public.epi_employees set team_id=${quote(oldTeam)}::uuid
  where id=${quote(accounts.joao.employeeId)}::uuid`);
const movedDelivery = await deliver(admin, accounts.joao.employeeId, movedItem, oldBatch);
check("entrega na obra antiga reduz apenas o lote original", movedDelivery.status === 200 &&
  balance(oldBatch) === 0 && balance(newBatch) === 5);
sql(`update public.profiles set operation_team_ids=array[${quote(oldTeam)}::uuid]
  where id=${quote(scoped.admin.id)}::uuid`);
const scopedItem = item("Lote de obra autorizado 3G"), scopedBatch = batch(scopedItem, 2, oldWork);
const scopedDelivery = await deliver(scoped.adminSession.access_token,
  accounts.joao.employeeId, scopedItem, scopedBatch);
check("F-3G-02: Gestão com escopo opera lote da própria obra", scopedDelivery.status === 200
  && balance(scopedBatch) === 1);
const scopedWorkDelivery = await deliver(scoped.adminSession.access_token,
  accounts.joao.employeeId, movedItem, newBatch);
check("F-3G-02: escopo de obra não vira permissão no lote de outra obra",
  scopedWorkDelivery.status >= 400 && balance(newBatch) === 5);
sql(`update public.epi_employees set team_id=${quote(newTeam)}::uuid
  where id=${quote(accounts.joao.employeeId)}::uuid`);
check("F-3G-07: Gestão sem escopo atual não encerra item após mudança de equipe",
  (await close(scoped.adminSession.access_token, scopedDelivery.data, "RETURNED", "STOCK_REUSABLE")).status >= 400
  && balance(scopedBatch) === 1);
check("F-3G-07: administrador autorizado devolve ao lote da obra original",
  (await close(admin, scopedDelivery.data, "RETURNED", "STOCK_REUSABLE")).status === 200
  && balance(scopedBatch) === 2);
check("devolução reutilizável após mudança de equipe/obra repõe somente o lote original",
  (await close(admin, movedDelivery.data, "RETURNED", "STOCK_REUSABLE")).status === 200 &&
  balance(oldBatch) === 1 && balance(newBatch) === 5);
sql(`update public.epi_employees set team_id=${quote(team)}::uuid
  where id=${quote(accounts.joao.employeeId)}::uuid`);
sql(`update public.epi_employees set team_id=${quote(newTeam)}::uuid
  where id=${quote(accounts.maria.employeeId)}::uuid`);
check("F-3G-07: Gestão sem escopo do funcionário não encerra entrega histórica alheia",
  (await close(scoped.adminSession.access_token, tabs[0].data, "RETURNED", "OTHER")).status >= 400);
check("F-3G-02: lote central injetado para funcionário de outra equipe é recusado",
  (await deliver(scoped.adminSession.access_token, accounts.maria.employeeId, trena, stock)).status >= 400);
sql(`update public.epi_employees set team_id=${quote(team)}::uuid
  where id=${quote(accounts.maria.employeeId)}::uuid`);
const joaoItems = await rpc("my_personal_items_3g", joao);
check("portal de João não recebe lote, saldo ou destino interno", joaoItems.status === 200 &&
  joaoItems.data.some(row => row.delivery_id === first.data) &&
  joaoItems.data.every(row => !Object.hasOwn(row, "stock_batch_id") && !Object.hasOwn(row, "stock_origin")
    && row.events.every(event => event.event_type !== "RETURNED" || event.category === null)));
const mariaItems = await rpc("my_personal_items_3g", maria);
check("P: João e Maria continuam isolados", mariaItems.status === 200 &&
  !joaoItems.data.some(row => row.delivery_id === tabs[0].data) &&
  !mariaItems.data.some(row => row.delivery_id === first.data));
const inactiveItem = item("Devolução pós-inativação sintética 3G"), inactiveBatch = batch(inactiveItem, 5);
const inactiveReusable = await deliver(admin, accounts.joao.employeeId, inactiveItem, inactiveBatch);
const inactiveDiscarded = await deliver(admin, accounts.joao.employeeId, inactiveItem, inactiveBatch);
check("F-3G-07: duas entregas históricas existem antes da inativação", inactiveReusable.status === 200
  && inactiveDiscarded.status === 200 && balance(inactiveBatch) === 3);
sql(`update public.epi_employees set active=false where id=${quote(accounts.joao.employeeId)}::uuid`);
sql(`update public.epi_items set active=false where id=${quote(inactiveItem)}::uuid`);
check("F-3G-07: inativação impede nova entrega, sem reativar funcionário", (await deliver(admin,
  accounts.joao.employeeId, inactiveItem, inactiveBatch)).status >= 400
  && sql(`select active::text from public.epi_employees where id=${quote(accounts.joao.employeeId)}::uuid`) === "false");
check("F-3G-07: funcionário inativo não registra a própria devolução", (await close(joao,
  inactiveReusable.data, "RETURNED", "STOCK_REUSABLE")).status >= 400);
check("F-3G-07: Gestão comum não repõe lote central de funcionário inativo", (await close(
  scoped.adminSession.access_token, inactiveReusable.data, "RETURNED", "STOCK_REUSABLE")).status >= 400
  && balance(inactiveBatch) === 3);
const inactiveReturnKey = key();
const inactiveReturn = await close(admin, inactiveReusable.data, "RETURNED", "STOCK_REUSABLE", null, inactiveReturnKey);
check("F-3G-07: admin registra devolução histórica ao lote original mesmo com item inativo",
  inactiveReturn.status === 200 && balance(inactiveBatch) === 4 &&
  sql(`select (e.actor_id=${quote(adminId)}::uuid and e.occurred_at is not null
    and d.employee_id=${quote(accounts.joao.employeeId)}::uuid and d.stock_batch_id=${quote(inactiveBatch)}::uuid)::text
    from private.personal_item_events_3g e join private.personal_item_deliveries_3g d on d.id=e.delivery_id
    where e.id=${Number(inactiveReturn.data)}`) === "true");
check("F-3G-07: devolução repetida é idempotente e não repõe duas vezes", (await close(admin,
  inactiveReusable.data, "RETURNED", "STOCK_REUSABLE", null, inactiveReturnKey)).data === inactiveReturn.data
  && balance(inactiveBatch) === 4);
check("F-3G-07: descarte posterior à inativação não repõe saldo", (await close(admin,
  inactiveDiscarded.data, "RETURNED", "DISCARDED")).status === 200 && balance(inactiveBatch) === 4);
check("F-3G-07: inativo não admite substituição administrativa", (await close(admin,
  inactiveDiscarded.data, "REPLACED", null, inactiveReusable.data)).status >= 400);
check("F-3G-07: portal do inativo não reabre lista pessoal", (await rpc("my_personal_items_3g", joao)).status >= 400);
check("F-3G-07: identidade e vínculo permaneceram inativos", sql(`select active::text from public.epi_employees
  where id=${quote(accounts.joao.employeeId)}::uuid`) === "false");
sql(`update public.profiles set active=false where id=${quote(scoped.admin.id)}::uuid`);
check("F-3G-02: perfil Gestão inativo não opera lote central", (await deliver(
  scoped.adminSession.access_token, accounts.maria.employeeId, trena, stock)).status >= 400);
result.passed = result.checks.filter(entry => entry.ok).length;
result.total = result.checks.length;
result.stock = { initial: 10, afterFirstDelivery: 9, afterSecondDelivery: 8, afterReplacement: 7,
  afterReusableReturn: 8, lastUnitAfterConcurrency: balance(lastBatch) };
writeFileSync(new URL("./resultado-estoque-3g.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(`Marco 3G estoque/Auth/JWT/PostgREST local: ${result.passed}/${result.total}`);
