// Auth/JWT/PostgREST reais; apenas Supabase local e identidades sinteticas.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";
import { personalItem3g, adminPersonalItem3g } from "../../01_WEB/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g.ts";
import { z } from "../../01_WEB/node_modules/zod/index.js";

assert.equal(base, "http://127.0.0.1:54321");
const result = { scope: "Marco 3G — laboratório local sintético", at: new Date().toISOString(), checks: [] };
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
  assert.equal(response.status, 200, `login ${account.name}`);
  return response.data.access_token;
}
function catalogue(name, kind = "personal_tool") {
  const code = `LAB3G-${randomUUID().slice(0, 8)}`;
  return sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
    values(${quote(code)},${quote(name)},${quote(kind)},'un',${quote(adminId)}::uuid) returning id`);
}
const { accounts, team, adminAccessToken: admin } = await createPreviewAccounts();
const adminId = sql(`select id from public.profiles where active and role='admin' order by created_at desc limit 1`);
const joao = await login(accounts.joao), maria = await login(accounts.maria), inactive = await login(accounts.inativo);
const item = catalogue("Trena 5 m — laboratório 3G");
const square = catalogue("Esquadro 12 polegadas — laboratório 3G");
const epi = catalogue("Capacete — EPI fora do 3G", "epi");
const key = () => randomUUID();
const deliver = (token, employeeId, itemId, idempotencyKey = key()) => rpc("deliver_personal_item_3g", token,
  { p_employee_id: employeeId, p_item_id: itemId, p_quantity: 1, p_variant: null,
    p_note: "Item sintético sem vínculo com estoque", p_idempotency_key: idempotencyKey,
    p_stock_origin: "WITHOUT_STOCK", p_stock_batch_id: null,
    p_exception_reason: "UNTRACKED_LEGACY_STOCK", p_exception_confirmed: true });
const dKey = key();
const d1 = await deliver(admin, accounts.joao.employeeId, item, dKey);
check("A: Gestao entrega item pessoal", d1.status === 200 && typeof d1.data === "string");
check("idempotencia de entrega retorna mesmo ID", (await deliver(admin, accounts.joao.employeeId, item, dKey)).data === d1.data);
const dMaria = await deliver(admin, accounts.maria.employeeId, square);
check("B/F: item aparece somente para titular correto", dMaria.status === 200 &&
  (await rpc("my_personal_items_3g", joao)).data.some(row => row.delivery_id === d1.data) &&
  !(await rpc("my_personal_items_3g", joao)).data.some(row => row.delivery_id === dMaria.data) &&
  (await rpc("my_personal_items_3g", maria)).data.some(row => row.delivery_id === dMaria.data));
check("contrato Web valida resposta real pessoal", z.array(personalItem3g).safeParse(
  (await rpc("my_personal_items_3g", joao)).data).success);
check("G/I: Joao nao confirma entrega de Maria por ID", (await rpc("confirm_personal_item_3g", joao,
  { p_delivery_id: dMaria.data, p_idempotency_key: key() })).status >= 400);
check("H: employee_id injetado nao altera titular", (await rpc("my_personal_items_3g", joao,
  { p_employee_id: accounts.maria.employeeId })).status >= 400);
const confirmation = await rpc("confirm_personal_item_3g", joao, { p_delivery_id: d1.data, p_idempotency_key: key() });
check("C: confirmacao simples separada da entrega", confirmation.status === 200 && Number.isInteger(confirmation.data));
const parallel = await Promise.all(Array.from({ length: 4 }, () => rpc("confirm_personal_item_3g", joao,
  { p_delivery_id: d1.data, p_idempotency_key: key() })));
check("D/E: duplo clique e duas abas formam uma confirmacao", parallel.every(x => x.status === 200 && x.data === confirmation.data)
  && sql(`select count(*) from private.personal_item_events_3g where delivery_id=${quote(d1.data)}::uuid
    and event_type='CONFIRMED'`) === "1");
check("J: Joao sem equipe continua no portal", (() => {
  sql(`update public.epi_employees set team_id=null where id=${quote(accounts.joao.employeeId)}::uuid`);
  return true;
})() && (await rpc("my_personal_items_3g", joao)).status === 200);
check("J: so admin entrega para empregado sem equipe", (await deliver(admin, accounts.joao.employeeId, square)).status === 200);
const d2 = (await rpc("my_personal_items_3g", joao)).data.find(row => row.item_name.includes("Esquadro"));
check("K: funcionario inativo nao executa acao", (await rpc("my_personal_items_3g", inactive)).status >= 400);
check("F: Maria nao informa problema no item de Joao", (await rpc("report_personal_item_3g", maria,
  { p_delivery_id: d1.data, p_action: "PROBLEM", p_category: "DAMAGED", p_note: null,
    p_idempotency_key: key() })).status >= 400);
const problem = await rpc("report_personal_item_3g", joao,
  { p_delivery_id: d2.delivery_id, p_action: "PROBLEM", p_category: "DAMAGED", p_note: "Dano sintético",
    p_idempotency_key: key() });
check("L: problema cria evento sem encerramento", problem.status === 200 &&
  (await rpc("my_personal_items_3g", joao)).data.find(row => row.delivery_id === d2.delivery_id).status === "DANIFICADO");
const request = await rpc("report_personal_item_3g", joao,
  { p_delivery_id: d1.data, p_action: "EXCHANGE_REQUESTED", p_category: "WEAR", p_note: null,
    p_idempotency_key: key() });
check("M/F: Joao solicita troca propria, Maria nao", request.status === 200 &&
  (await rpc("report_personal_item_3g", maria,
    { p_delivery_id: d1.data, p_action: "EXCHANGE_REQUESTED", p_category: "WEAR", p_note: null,
      p_idempotency_key: key() })).status >= 400);
const decision = await rpc("decide_personal_item_3g", admin,
  { p_request_id: request.data, p_action: "EXCHANGE_APPROVED", p_note: "Nota interna de teste",
    p_idempotency_key: key() });
check("N: aprovacao nao cria entrega", decision.status === 200 &&
  sql(`select count(*) from private.personal_item_deliveries_3g where employee_id=${quote(accounts.joao.employeeId)}::uuid and item_id=${quote(item)}::uuid`) === "1");
check("dados internos da Gestao nao aparecem no contrato pessoal", !(await rpc("my_personal_items_3g", joao)).data
  .find(row => row.delivery_id === d1.data).events.some(event => event.note === "Nota interna de teste"));
check("request_id manipulado/usuario portal nao decide", (await rpc("decide_personal_item_3g", joao,
  { p_request_id: request.data, p_action: "EXCHANGE_REFUSED", p_note: null, p_idempotency_key: key() })).status >= 400);
const replacement = await deliver(admin, accounts.joao.employeeId, item);
check("O: nova entrega nao encerra anterior", replacement.status === 200 &&
  (await rpc("my_personal_items_3g", joao)).data.find(row => row.delivery_id === d1.data).status === "EM_USO");
check("Q: substituicao exige nova entrega do mesmo tipo", (await rpc("close_personal_item_3g", admin,
  { p_delivery_id: d1.data, p_action: "REPLACED", p_related_delivery_id: d2.delivery_id,
    p_note: null, p_idempotency_key: key(), p_return_destination: null })).status >= 400);
const replaced = await rpc("close_personal_item_3g", admin,
  { p_delivery_id: d1.data, p_action: "REPLACED", p_related_delivery_id: replacement.data,
    p_note: null, p_idempotency_key: key(), p_return_destination: null });
check("Q/R: substituicao formal preserva historico", replaced.status === 200 &&
  (await rpc("my_personal_items_3g", joao)).data.find(row => row.delivery_id === d1.data).status === "SUBSTITUIDO");
const returned = await rpc("close_personal_item_3g", admin,
  { p_delivery_id: d2.delivery_id, p_action: "RETURNED", p_related_delivery_id: null,
    p_note: null, p_idempotency_key: key(), p_return_destination: "EVALUATION" });
check("P: devolucao so pela Gestao", returned.status === 200 &&
  (await rpc("close_personal_item_3g", joao,
    { p_delivery_id: replacement.data, p_action: "RETURNED", p_related_delivery_id: null,
      p_note: null, p_idempotency_key: key(), p_return_destination: "EVALUATION" })).status >= 400);
check("S: EPI classificado nao entra no 3G", (await deliver(admin, accounts.joao.employeeId, epi)).status >= 400);
check("T: item fora do catalogo pessoal nao pode ser entregue", (await deliver(admin, accounts.joao.employeeId, randomUUID())).status >= 400);
check("novo item pessoal nao entra no fluxo legado de EPI", (() => {
  try { sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,quantity,delivered_by)
    values(${quote(accounts.maria.employeeId)}::uuid,${quote(team)}::uuid,${quote(square)}::uuid,1,
      ${quote(adminId)}::uuid)`); return false; } catch { return true; }
})());
check("Gestao sem permissao nao registra entrega", (await deliver(joao, accounts.joao.employeeId, item)).status >= 400);
check("R: fatos historicos impedem UPDATE", (() => {
  try { sql(`update private.personal_item_deliveries_3g set quantity=2 where id=${quote(d1.data)}::uuid`); return false; }
  catch { return true; }
})());
const residual = await login(accounts.expira);
await revokePreviewAccount(accounts.expira.identityId, admin);
check("U: token residual de identidade revogada nao consulta modulo", (await rpc("my_personal_items_3g", residual)).status >= 400);
const management = await rpc("admin_personal_items_3g", admin,
  { p_employee_id: accounts.joao.employeeId, p_team_id: null, p_work_id: null, p_status: null });
check("visao Gestao limitada a funcionario selecionado", management.status === 200 &&
  management.data.length >= 3 && management.data.every(row => row.employee_id === accounts.joao.employeeId));
check("contrato Web valida resposta real da Gestao", z.array(adminPersonalItem3g).safeParse(management.data).success);
check("tabelas privadas nao sao acessiveis por PostgREST", (await call("/rest/v1/personal_item_deliveries_3g", joao, {})).status >= 400);
const scopedHelper = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?scoped=${randomUUID()}`);
const scoped = await scopedHelper.createPreviewAdminSession();
sql(`update public.profiles set role='engineer', operation_permissions=array['epi:write']::text[],
  operation_team_ids=array[${quote(team)}::uuid] where id=${quote(scoped.admin.id)}::uuid`);
check("Gestao com escopo nao entrega para funcionario sem equipe", (await deliver(scoped.adminSession.access_token,
  accounts.joao.employeeId, item)).status >= 400);
const scopedList = await rpc("admin_personal_items_3g", scoped.adminSession.access_token,
  { p_employee_id: null, p_team_id: null, p_work_id: null, p_status: null });
check("Gestao com escopo ve apenas equipe autorizada", scopedList.status === 200 &&
  scopedList.data.length >= 1 && scopedList.data.every(row => row.team_id === team));
sql(`update public.profiles set operation_permissions=array[]::text[] where id=${quote(scoped.admin.id)}::uuid`);
check("Gestao sem epi:write nao entrega", (await deliver(scoped.adminSession.access_token,
  accounts.maria.employeeId, square)).status >= 400);

// Contas limpas e massa para a avaliacao manual; credenciais ficam fora dos pacotes.
const manualHelper = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?manual=${randomUUID()}`);
const manual = await manualHelper.createPreviewAccounts();
const manualAdminHelper = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?gestao=${randomUUID()}`);
const manualAdmin = await manualAdminHelper.createPreviewAdminSession();
const manualItem = catalogue("Trena 5 m — prévia 3G");
const manualSquare = catalogue("Esquadro 12 polegadas — prévia 3G");
const manualLevel = catalogue("Nível pequeno — prévia 3G");
const pending = await deliver(manual.adminAccessToken, manual.accounts.joao.employeeId, manualItem);
const used = await deliver(manual.adminAccessToken, manual.accounts.joao.employeeId, manualSquare);
const manualJoao = await login(manual.accounts.joao);
await rpc("confirm_personal_item_3g", manualJoao, { p_delivery_id: used.data, p_idempotency_key: key() });
const mariaItem = await deliver(manual.adminAccessToken, manual.accounts.maria.employeeId, manualLevel);
check("massa manual: Joao pendente/em uso e Maria isolada", pending.status === 200 && used.status === 200 && mariaItem.status === 200);
mkdirSync(new URL("../../backups/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../backups/credenciais-previa-itens-3g.json", import.meta.url), JSON.stringify({
  note: "Somente laboratório local sintético. Não incluir em pacote ou ZIP.",
  colaborador: "http://localhost:3101/colaborador/itens",
  gestao: "http://localhost:3101/funcionarios/" + manual.accounts.joao.employeeId + "/itens",
  admin: { email: manualAdmin.admin.email, password: manualAdmin.admin.password },
  joao: { email: manual.accounts.joao.email, password: manual.accounts.joao.password },
  maria: { email: manual.accounts.maria.email, password: manual.accounts.maria.password },
}, null, 2) + "\n", { mode: 0o600 });
result.passed = result.checks.filter(entry => entry.ok).length;
result.total = result.checks.length;
writeFileSync(new URL("./resultado-3g.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(`Marco 3G Auth/JWT/PostgREST locais: ${result.passed}/${result.total}`);
