// Marco 3C: Auth/JWT/PostgREST reais; somente contas e EPIs sintéticos no Docker local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const evidence = { at: new Date().toISOString(), scope: "Marco 3C local sintético", checks: [], samples: [] };
function check(name, good) { evidence.checks.push({ name, ok: Boolean(good) }); assert.ok(good, name); }
async function call(path, bearer, body = {}, method = "POST") {
  const url = new URL(path, base); assert.equal(url.origin, base);
  const response = await fetch(url, { method, headers: { apikey: anon, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
const rpc = (name, token, args = {}) => call(`/rest/v1/rpc/${name}`, token, args);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon, { email: account.email, password: account.password });
  assert.equal(response.status, 200); return response.data.access_token;
}
const { accounts, team, adminAccessToken } = await createPreviewAccounts();
check("sem DML direto para service_role nas novas tabelas", sql("select has_table_privilege('service_role','public.epi_exchange_requests','UPDATE'),has_table_privilege('service_role','public.epi_exchange_events','DELETE')") === "f|f");
check("EXECUTE das seis RPCs somente para authenticated", sql(`select count(*),bool_and(
  has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace
  and p.proname in ('my_exchangeable_epi','create_epi_exchange_request','my_epi_exchange_requests',
    'cancel_epi_exchange_request','admin_epi_exchange_requests','manage_epi_exchange_request')`) === "6|t");
const adminId = JSON.parse(Buffer.from(adminAccessToken.split(".")[1], "base64url").toString("utf8")).sub;
const joao = await login(accounts.joao), maria = await login(accounts.maria), inactive = await login(accounts.inativo);
const tag = Date.now();
function item(label) { return sql(`insert into public.epi_items(code,name,item_kind,unit,created_by) values(${quote(`3C-${tag}-${label}`)},${quote(label)},'epi','un',${quote(accounts.joao.id)}::uuid) returning id`); }
function delivery(employee, itemId, active = true) {
  return sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,quantity,delivered_at,delivery_reason,current_status,ca_snapshot,delivered_by,closed_at,closed_by)
    values(${quote(employee.employeeId)}::uuid,${quote(team)}::uuid,${quote(itemId)}::uuid,1,now(),'initial',${quote(active ? "active" : "replaced")},'CA-TESTE-3C',${quote(accounts.joao.id)}::uuid,${active ? "null" : "now()"},${active ? "null" : `${quote(accounts.joao.id)}::uuid`}) returning id`);
}
const deliveryJ = delivery(accounts.joao, item("Capacete João 3C"));
const deliveryM = delivery(accounts.maria, item("Capacete Maria 3C"));
const deliveryClosed = delivery(accounts.joao, item("Luva encerrada João 3C"), false);
const deliveryInactive = delivery(accounts.inativo, item("EPI inativo 3C"));
const eligibleJ = await rpc("my_exchangeable_epi", joao), eligibleM = await rpc("my_exchangeable_epi", maria);
check("João só seleciona sua entrega ativa", eligibleJ.status === 200 && eligibleJ.data.some(row => row.delivery_id === deliveryJ) && !eligibleJ.data.some(row => [deliveryM,deliveryClosed].includes(row.delivery_id)));
check("Maria só seleciona sua entrega ativa", eligibleM.status === 200 && eligibleM.data.some(row => row.delivery_id === deliveryM) && !eligibleM.data.some(row => row.delivery_id === deliveryJ));
check("inativo não seleciona EPI", (await rpc("my_exchangeable_epi", inactive)).data.every(row => row.delivery_id !== deliveryInactive));
check("anon não consulta itens pessoais", (await rpc("my_exchangeable_epi", anon)).status >= 400);
const before = sql(`select count(*) from public.epi_deliveries where id in (${quote(deliveryJ)}::uuid,${quote(deliveryM)}::uuid)`);
const keyJ = randomUUID();
const payloadJ = { p_delivery_id: deliveryJ, p_reason: "DESGASTE", p_note: "Uso sintético", p_idempotency_key: keyJ };
const createdJ = await rpc("create_epi_exchange_request", joao, payloadJ);
check("João cria solicitação própria", createdJ.status === 200 && createdJ.data.length === 1 && createdJ.data[0].request_status === "SOLICITADA");
const requestJ = createdJ.data[0].request_id;
check("mesma chave retorna mesmo pedido", (await rpc("create_epi_exchange_request", joao, payloadJ)).data[0].request_id === requestJ);
check("reuso divergente da chave é negado", (await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_reason: "DANO" })).status >= 400);
check("nova chave para entrega com pedido aberto é negada", (await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_idempotency_key: randomUUID() })).status >= 400);
check("João não cria para Maria", (await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_delivery_id: deliveryM, p_idempotency_key: randomUUID() })).status >= 400);
check("Maria não cria para João", (await rpc("create_epi_exchange_request", maria, { ...payloadJ, p_delivery_id: deliveryJ, p_idempotency_key: randomUUID() })).status >= 400);
check("entrega encerrada é negada", (await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_delivery_id: deliveryClosed, p_idempotency_key: randomUUID() })).status >= 400);
check("motivo ausente é negado", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_note: "", p_idempotency_key: randomUUID() })).status >= 400);
check("motivo não controlado é negado", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "VENCIDO", p_note: "", p_idempotency_key: randomUUID() })).status >= 400);
check("OUTRO sem observação é negado", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "OUTRO", p_note: " ", p_idempotency_key: randomUUID() })).status >= 400);
check("nota longa é negada", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "DANO", p_note: "x".repeat(241), p_idempotency_key: randomUUID() })).status >= 400);
const injectedKey = randomUUID();
const injected = await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_idempotency_key: injectedKey, p_employee_id: accounts.maria.employeeId });
check("p_employee_id novo não altera titular", injected.status >= 400 &&
  sql(`select count(*) from public.epi_exchange_requests where idempotency_key=${quote(injectedKey)}::uuid`) === "0");
check("admin Gestão não cria pedido pessoal", (await rpc("create_epi_exchange_request", adminAccessToken, { ...payloadJ, p_idempotency_key: randomUUID() })).status >= 400);
const personalJ = await rpc("my_epi_exchange_requests", joao), personalM = await rpc("my_epi_exchange_requests", maria);
check("João consulta somente próprio pedido", personalJ.status === 200 && personalJ.data.some(row => row.request_id === requestJ) && !personalM.data.some(row => row.request_id === requestJ));
check("consulta pessoal omite nota interna", personalJ.data.every(row => !Object.hasOwn(row,"internal_note") && !Object.hasOwn(row,"employee_id")));
check("Maria não cancela pedido João", (await rpc("cancel_epi_exchange_request", maria, { p_request_id: requestJ })).status >= 400);
check("tabela nova não expõe leitura direta ao portal", (await call("/rest/v1/epi_exchange_requests?select=*", joao, undefined, "GET")).status >= 400);
check("eventos não expõem leitura direta", (await call("/rest/v1/epi_exchange_events?select=*", joao, undefined, "GET")).status >= 400);
check("Maria não faz análise Gestão", (await rpc("manage_epi_exchange_request", maria, { p_request_id: requestJ, p_action: "EM_ANALISE" })).status >= 400);
const adminList = await rpc("admin_epi_exchange_requests", adminAccessToken);
check("admin autorizado enxerga pedido mínimo", adminList.status === 200 && adminList.data.some(row => row.request_id === requestJ) && !adminList.data.some(row => Object.hasOwn(row,"employee_id")));
check("portal não recebe fila Gestão", (await rpc("admin_epi_exchange_requests", joao)).data.length === 0);
sql(`update public.profiles set role='engineer',operation_permissions=array[]::text[] where id=${quote(adminId)}::uuid`);
check("gestor autenticado sem epi:write não consulta fila", (await rpc("admin_epi_exchange_requests", adminAccessToken)).data.length === 0);
check("gestor sem epi:write não analisa", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: requestJ, p_action: "EM_ANALISE" })).status >= 400);
sql(`update public.profiles set role='admin',operation_permissions=null where id=${quote(adminId)}::uuid`);
check("aprovação direta sem análise é negada", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: requestJ, p_action: "APROVADA" })).status >= 400);
check("colocar em análise", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: requestJ, p_action: "EM_ANALISE", p_internal_note: "Nota interna sintética" })).data === "EM_ANALISE");
const [adminAfterNote, personalAfterNote] = await Promise.all([
  rpc("admin_epi_exchange_requests", adminAccessToken), rpc("my_epi_exchange_requests", joao),
]);
check("nota interna é visível somente na fila da Gestão", adminAfterNote.data.find(row => row.request_id === requestJ)?.internal_note === "Nota interna sintética" &&
  !Object.hasOwn(personalAfterNote.data.find(row => row.request_id === requestJ), "internal_note"));
check("cancelamento após análise é negado", (await rpc("cancel_epi_exchange_request", joao, { p_request_id: requestJ })).status >= 400);
check("recusa sem mensagem pública é negada", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: requestJ, p_action: "RECUSADA" })).status >= 400);
check("aprovação após análise", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: requestJ, p_action: "APROVADA" })).data === "APROVADA");
check("pedido aprovado aguarda entrega", (await rpc("my_epi_exchange_requests", joao)).data.find(row => row.request_id === requestJ).request_status === "APROVADA");
check("aprovação não cria entrega", sql(`select count(*) from public.epi_deliveries where id in (${quote(deliveryJ)}::uuid,${quote(deliveryM)}::uuid)`) === before);
check("aprovação não muda estoque", sql(`select count(*) from public.epi_stock_batches where item_id=(select item_id from public.epi_deliveries where id=${quote(deliveryJ)}::uuid)`) === "0");
check("histórico registra três estados", sql(`select string_agg(to_status,',' order by id) from public.epi_exchange_events where request_id=${quote(requestJ)}::uuid`) === "SOLICITADA,EM_ANALISE,APROVADA");
check("histórico não pode ser atualizado", (() => { try { sql(`update public.epi_exchange_events set to_status='RECUSADA' where request_id=${quote(requestJ)}::uuid`); return false; } catch { return true; } })());
const keyM = randomUUID();
const createdM = await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "OUTRO", p_note: "  Solicitação sintética  ", p_idempotency_key: keyM });
check("Maria cria OUTRO com observação aparada", createdM.status === 200 && createdM.data.length === 1);
const requestM = createdM.data[0].request_id;
check("observação foi aparada", (await rpc("my_epi_exchange_requests", maria)).data.find(row => row.request_id === requestM).note === "Solicitação sintética");
check("João não cancela Maria", (await rpc("cancel_epi_exchange_request", joao, { p_request_id: requestM })).status >= 400);
check("Maria cancela própria SOLICITADA", (await rpc("cancel_epi_exchange_request", maria, { p_request_id: requestM })).data === "CANCELADA");
check("cancelar outra vez é idempotente", (await rpc("cancel_epi_exchange_request", maria, { p_request_id: requestM })).data === "CANCELADA");
check("histórico cancelamento preservado", sql(`select string_agg(to_status,',' order by id) from public.epi_exchange_events where request_id=${quote(requestM)}::uuid`) === "SOLICITADA,CANCELADA");
const cancelledRetry = await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "OUTRO", p_note: "Solicitação sintética", p_idempotency_key: keyM });
check("retry após cancelamento não recria", cancelledRetry.data[0].request_id === requestM && cancelledRetry.data[0].request_status === "CANCELADA");
const concurrent = await Promise.all(Array.from({length:5}, () => rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "DANO", p_note: "", p_idempotency_key: randomUUID() })));
check("cinco requisições concorrentes criam uma aberta", concurrent.filter(response => response.status === 200).length === 1 && concurrent.filter(response => response.status >= 400).length === 4);
check("índice preserva uma aberta", sql(`select count(*) from public.epi_exchange_requests where source_delivery_id=${quote(deliveryM)}::uuid and status in ('SOLICITADA','EM_ANALISE','APROVADA')`) === "1");
const fleeting = delivery(accounts.maria, item("EPI encerrado entre tela e envio 3C"));
check("entrega aparece ativa antes do envio", (await rpc("my_exchangeable_epi", maria)).data.some(row => row.delivery_id === fleeting));
sql(`update public.epi_deliveries set current_status='returned',closed_at=now(),closed_by=${quote(accounts.joao.id)}::uuid where id=${quote(fleeting)}::uuid`);
check("encerrada entre tela e envio é negada no backend", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: fleeting, p_reason: "DANO", p_note: "", p_idempotency_key: randomUUID() })).status >= 400);
const refusalDelivery = delivery(accounts.maria, item("EPI recusa 3C"));
const refusal = await rpc("create_epi_exchange_request", maria, { p_delivery_id: refusalDelivery, p_reason: "PERDA_EXTRAVIO", p_note: "Perda sintética", p_idempotency_key: randomUUID() });
check("perda/extravio cria apenas solicitação", refusal.status === 200);
const refusalId = refusal.data[0].request_id;
check("Gestão coloca recusa em análise", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: refusalId, p_action: "EM_ANALISE" })).data === "EM_ANALISE");
check("Gestão recusa com motivo público", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: refusalId, p_action: "RECUSADA", p_public_message: "Não disponível no momento", p_internal_note: "Nota interna não visível" })).data === "RECUSADA");
const refusalView = (await rpc("my_epi_exchange_requests", maria)).data.find(row => row.request_id === refusalId);
check("recusa exibe somente motivo público", refusalView.request_status === "RECUSADA" && refusalView.public_decision === "Não disponível no momento" && !JSON.stringify(refusalView).includes("Nota interna"));
check("recusa não modifica entrega", sql(`select current_status from public.epi_deliveries where id=${quote(refusalDelivery)}::uuid`) === "active");
const staleDelivery = delivery(accounts.maria, item("EPI encerrado durante análise 3C"));
const stale = await rpc("create_epi_exchange_request", maria, { p_delivery_id: staleDelivery, p_reason: "DANO", p_note: "", p_idempotency_key: randomUUID() });
check("pedido antes do encerramento foi criado", stale.status === 200);
const staleId = stale.data[0].request_id;
check("gestor inicia análise de EPI ativo", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: staleId, p_action: "EM_ANALISE" })).data === "EM_ANALISE");
sql(`update public.epi_deliveries set current_status='returned',closed_at=now(),closed_by=${quote(accounts.joao.id)}::uuid where id=${quote(staleDelivery)}::uuid`);
check("gestor não aprova entrega encerrada durante análise", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: staleId, p_action: "APROVADA" })).status >= 400);
check("gestor ainda pode recusar com explicação", (await rpc("manage_epi_exchange_request", adminAccessToken, { p_request_id: staleId, p_action: "RECUSADA", p_public_message: "EPI já encerrado" })).data === "RECUSADA");
const noTeamDelivery = delivery(accounts.maria, item("EPI sem equipe 3C"));
sql(`update public.epi_employees set team_id=null where id=${quote(accounts.maria.employeeId)}::uuid`);
check("sem equipe mantém leitura pessoal", (await rpc("my_exchangeable_epi", maria)).data.some(row => row.delivery_id === deliveryM));
const noTeamRequest = await rpc("create_epi_exchange_request", maria, { p_delivery_id: noTeamDelivery, p_reason: "DESGASTE", p_note: "", p_idempotency_key: randomUUID() });
check("sem equipe cria troca própria", noTeamRequest.status === 200);
const noTeamRequestId = noTeamRequest.data[0].request_id;
sql(`update public.profiles set role='engineer',operation_permissions=array['epi:write']::text[],operation_team_ids=array[${quote(team)}::uuid] where id=${quote(adminId)}::uuid`);
const scopedQueue = await rpc("admin_epi_exchange_requests", adminAccessToken);
check("gestor com epi:write em outra equipe não ganha equipe nula", scopedQueue.data.some(row => row.request_id === requestJ) &&
  !scopedQueue.data.some(row => row.request_id === noTeamRequestId));
check("gestor de outra equipe não analisa pedido sem equipe", (await rpc("manage_epi_exchange_request", adminAccessToken,
  { p_request_id: noTeamRequestId, p_action: "EM_ANALISE" })).status >= 400);
sql(`update public.profiles set role='admin',operation_permissions=null,operation_team_ids=null where id=${quote(adminId)}::uuid`);
check("admin global mantém fila sem equipe", (await rpc("admin_epi_exchange_requests", adminAccessToken)).data.some(row => row.request_id === noTeamRequestId));
sql(`update public.epi_employees set active=false where id=${quote(accounts.maria.employeeId)}::uuid`);
check("inativo perde pedidos pessoais", (await rpc("my_epi_exchange_requests", maria)).data.length === 0);
check("inativo não cria pedido", (await rpc("create_epi_exchange_request", maria, { p_delivery_id: deliveryM, p_reason: "DANO", p_note: "", p_idempotency_key: randomUUID() })).status >= 400);
await revokePreviewAccount(accounts.joao.identityId, adminAccessToken);
check("revogado perde pedidos com token antigo", (await rpc("my_epi_exchange_requests", joao)).data.length === 0);
check("revogado não cria com token antigo", (await rpc("create_epi_exchange_request", joao, { ...payloadJ, p_idempotency_key: randomUUID() })).status >= 400);
check("revogado não cancela com token antigo", (await rpc("cancel_epi_exchange_request", joao, { p_request_id: requestJ })).status >= 400);
evidence.passed = evidence.checks.every(row => row.ok);
evidence.count = evidence.checks.length;
writeFileSync(new URL("./resultado-3c.json", import.meta.url), JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify({passed:evidence.passed,checks:evidence.count}));
