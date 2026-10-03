// Auth, JWT e PostgREST reais; todos os atores e itens são sintéticos no Docker local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const evidence = { at: new Date().toISOString(), scope: "Marco 3D local sintético", checks: [] };
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
const adminId = JSON.parse(Buffer.from(adminAccessToken.split(".")[1], "base64url").toString("utf8")).sub;
const joao = await login(accounts.joao), maria = await login(accounts.maria), inactive = await login(accounts.inativo);
const tag = Date.now();
function seed(label, qty = 15) {
  const itemId = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
    values(${quote(`3D-${tag}-${label}`)},${quote(label)},'epi','par',${quote(adminId)}::uuid) returning id`);
  const batchId = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,variant,created_by)
    values(${quote(itemId)}::uuid,${qty},'CA-3D','42',${quote(adminId)}::uuid) returning id`);
  return { itemId, batchId };
}
const boot = seed("Bota sintética 3D"), glove = seed("Luva sintética 3D");
const professionCode=`3d-${tag}`; const professionName=`Função sintética 3D ${tag}`;
sql(`insert into public.epi_professions(code,name,uniform_color) values(${quote(professionCode)},${quote(professionName)},'gray')`);
sql(`insert into public.epi_profession_items(profession_code,item_id,recommended_quantity)
  values(${quote(professionCode)},${quote(boot.itemId)}::uuid,1),(${quote(professionCode)},${quote(glove.itemId)}::uuid,2)`);
sql(`update public.epi_employees set profession=${quote(professionName)} where id=${quote(accounts.joao.employeeId)}::uuid`);
const suggested=await rpc("admin_epi_kit_suggestion_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId});
check("kit por função é só sugestão configurada",suggested.status===200 && suggested.data.length===2 &&
  suggested.data.some(row=>row.item_id===boot.itemId && row.recommended_quantity===1) &&
  suggested.data.some(row=>row.item_id===glove.itemId && row.recommended_quantity===2) &&
  sql(`select count(*) from public.epi_deliveries where employee_id=${quote(accounts.joao.employeeId)}::uuid`) === "0");
check("funcionário não consulta sugestão administrativa",(await rpc("admin_epi_kit_suggestion_3d",joao,
  {p_employee_id:accounts.joao.employeeId})).data.length===0);
const lines = [boot, glove].map(({itemId,batchId}) => ({ item_id:itemId, stock_batch_id:batchId, quantity:1 }));
const args = { p_employee_id: accounts.joao.employeeId, p_lines: lines, p_idempotency_key: randomUUID() };
check("RPCs novas só para authenticated", sql(`select count(*),bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
  ('admin_epi_kit_suggestion_3d','prepare_epi_kit_3d','register_epi_delivery_3d',
   'my_epi_delivery_groups_3d','respond_epi_delivery_3d','admin_epi_delivery_feedback_3d',
   'manage_epi_delivery_feedback_3d','admin_epi_prepared_kits_3d',
   'admin_epi_approved_exchanges_3d')`) === "9|t");
check("tabelas novas sem DML para browser", sql(`select has_table_privilege('authenticated','public.epi_prepared_kits_3d','INSERT'),
  has_table_privilege('authenticated','public.epi_delivery_groups_3d','SELECT'),
  has_table_privilege('service_role','public.epi_delivery_feedback_events_3d','DELETE')`) === "f|f|f");
check("João não prepara entrega", (await rpc("prepare_epi_kit_3d", joao, args)).status >= 400);
check("Maria não prepara entrega", (await rpc("prepare_epi_kit_3d", maria, args)).status >= 400);
check("anon não prepara", (await rpc("prepare_epi_kit_3d", anon, args)).status >= 400);
const beforeStock = sql(`select quantity from public.epi_stock_batches where id=${quote(boot.batchId)}::uuid`);
const prepared = await rpc("prepare_epi_kit_3d", adminAccessToken, args);
check("Gestão prepara kit", prepared.status === 200 && /^[0-9a-f-]{36}$/.test(prepared.data));
const prepId = prepared.data;
check("mesma preparação é idempotente", (await rpc("prepare_epi_kit_3d", adminAccessToken, args)).data === prepId);
check("chave da preparação não pode mudar conteúdo", (await rpc("prepare_epi_kit_3d", adminAccessToken,
  { ...args, p_lines: [lines[0]] })).status >= 400);
check("preparação não baixa estoque", sql(`select quantity from public.epi_stock_batches where id=${quote(boot.batchId)}::uuid`) === beforeStock);
check("preparação não cria entrega", sql(`select count(*) from public.epi_deliveries where employee_id=${quote(accounts.joao.employeeId)}::uuid
  and delivery_group_id=${quote(prepId)}::uuid`) === "0");
check("Gestão autorizada vê kit preparado; funcionário não vê fila", (await rpc("admin_epi_prepared_kits_3d",adminAccessToken)).data.some(row=>row.preparation_id===prepId) &&
  (await rpc("admin_epi_prepared_kits_3d",joao)).data.length===0);
check("João não registra entrega", (await rpc("register_epi_delivery_3d", joao,
  {p_preparation_id:prepId,p_idempotency_key:randomUUID()})).status >= 400);
const deliveryKey = randomUUID();
const delivered = await rpc("register_epi_delivery_3d", adminAccessToken,
  {p_preparation_id:prepId,p_idempotency_key:deliveryKey});
if (delivered.status !== 200) console.error("Registro local 3D:", delivered.status, delivered.data?.message ?? delivered.data?.code);
check("Gestão registra entrega explícita", delivered.status === 200 && /^[0-9a-f-]{36}$/.test(delivered.data));
const groupId = delivered.data;
const nameAtDelivery=sql(`select full_name from public.epi_employees where id=${quote(accounts.joao.employeeId)}::uuid`);
check("nova entrega preserva snapshot do funcionário",sql(`select employee_name_snapshot from public.epi_delivery_groups_3d where id=${quote(groupId)}::uuid`)===nameAtDelivery);
sql(`update public.epi_employees set full_name='Nome sintético alterado 3D' where id=${quote(accounts.joao.employeeId)}::uuid`);
check("mudança cadastral não reescreve nome da entrega",sql(`select employee_name_snapshot from public.epi_delivery_groups_3d where id=${quote(groupId)}::uuid`)===nameAtDelivery);
sql(`update public.epi_employees set full_name=${quote(nameAtDelivery)} where id=${quote(accounts.joao.employeeId)}::uuid`);
check("dois itens no mesmo agrupamento", sql(`select count(*) from public.epi_deliveries where delivery_group_id=${quote(groupId)}::uuid`) === "2");
check("estoque só baixa na entrega", sql(`select quantity from public.epi_stock_batches where id=${quote(boot.batchId)}::uuid`) === String(Number(beforeStock)-1));
check("entrega tem snapshot de nome, unidade, CA e variante", sql(`select count(*) from public.epi_deliveries where delivery_group_id=${quote(groupId)}::uuid
  and item_name_snapshot is not null and unit_snapshot='par' and ca_snapshot='CA-3D' and variant_snapshot='42'`) === "2");
check("retry devolve mesmo grupo", (await rpc("register_epi_delivery_3d", adminAccessToken,
  {p_preparation_id:prepId,p_idempotency_key:deliveryKey})).data === groupId);
check("nova chave não duplica entrega", (await rpc("register_epi_delivery_3d", adminAccessToken,
  {p_preparation_id:prepId,p_idempotency_key:randomUUID()})).status >= 400);
const own = await rpc("my_epi_delivery_groups_3d", joao), other = await rpc("my_epi_delivery_groups_3d", maria);
check("João vê próprio kit registrado", own.status === 200 && own.data.some(row => row.group_id===groupId && row.items.length===2));
check("Maria não vê kit de João", other.status === 200 && !other.data.some(row => row.group_id===groupId));
check("tabela não expõe detalhes diretamente", (await call("/rest/v1/epi_delivery_groups_3d?select=*", joao, undefined, "GET")).status >= 400);
check("Maria não confirma João", (await rpc("respond_epi_delivery_3d", maria,
  {p_group_id:groupId,p_action:"CONFIRMADO",p_idempotency_key:randomUUID()})).status >= 400);
check("Maria não relata divergência em João",(await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupId,p_action:"DIVERGENCIA",p_delivery_id:own.data.find(row=>row.group_id===groupId).items[0].delivery_id,
    p_category:"OUTRO",p_details:"Tentativa cruzada",p_idempotency_key:randomUUID()})).status>=400);
const confirmKey = randomUUID();
const confirmArgs = {p_group_id:groupId,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,p_idempotency_key:confirmKey};
const confirmed = await Promise.all(Array.from({length:5},()=>rpc("respond_epi_delivery_3d",joao,confirmArgs)));
if (!confirmed.every(row=>row.status===200)) console.error("Confirmação local 3D:",confirmed.map(row=>[row.status,row.data?.message??row.data?.code]));
check("cinco cliques retornam mesmo evento", confirmed.every(row => row.status===200 && row.data===confirmed[0].data));
check("um único acknowledgement", sql(`select count(*) from public.epi_delivery_feedback_events_3d
  where group_id=${quote(groupId)}::uuid and event_type='CONFIRMADO'`) === "1");
check("confirmação não cria entrega", sql(`select count(*) from public.epi_deliveries where delivery_group_id=${quote(groupId)}::uuid`) === "2");
check("manifestação divergente após confirmação negada", (await rpc("respond_epi_delivery_3d",joao,
  {p_group_id:groupId,p_action:"DIVERGENCIA",p_delivery_id:own.data.find(row=>row.group_id===groupId).items[0].delivery_id,
   p_category:"TAMANHO",p_details:"Recebi 41",p_idempotency_key:randomUUID()})).status >= 400);
const sourceId = own.data.find(row=>row.group_id===groupId).items[0].delivery_id;
const sourceItemId=sql(`select item_id from public.epi_deliveries where id=${quote(sourceId)}::uuid`);
const matchingLine=lines.find(line=>line.item_id===sourceItemId);
const wrongLine=lines.find(line=>line.item_id!==sourceItemId);
const request = await rpc("create_epi_exchange_request",joao,
  {p_delivery_id:sourceId,p_reason:"DESGASTE",p_note:"Troca sintética 3D",p_idempotency_key:randomUUID()});
check("pedido 3C nasce sem nova entrega",request.status===200 && request.data[0].request_status==="SOLICITADA" &&
  sql(`select count(*) from public.epi_delivery_groups_3d where exchange_request_id=${quote(request.data[0].request_id)}::uuid`) === "0");
const requestId=request.data[0].request_id;
check("Gestão aprova 3C após análise",(await rpc("manage_epi_exchange_request",adminAccessToken,
  {p_request_id:requestId,p_action:"EM_ANALISE"})).data==="EM_ANALISE" &&
  (await rpc("manage_epi_exchange_request",adminAccessToken,
    {p_request_id:requestId,p_action:"APROVADA"})).data==="APROVADA");
check("Gestão vê pedido 3C aprovado",(await rpc("admin_epi_approved_exchanges_3d",adminAccessToken)).data.some(row=>row.request_id===requestId && row.delivery_group_id===null));
check("troca 3C rejeita EPI diferente",(await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[wrongLine],p_exchange_request_id:requestId,p_idempotency_key:randomUUID()})).status>=400);
const exchangePrep=await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[matchingLine],p_exchange_request_id:requestId,p_idempotency_key:randomUUID()});
check("kit de troca 3C é preparado sem nova entrega",exchangePrep.status===200 &&
  sql(`select count(*) from public.epi_delivery_groups_3d where exchange_request_id=${quote(requestId)}::uuid`) === "0");
check("pedido 3C não permite segundo kit preparado",(await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[matchingLine],p_exchange_request_id:requestId,p_idempotency_key:randomUUID()})).status>=400);
const exchangeDelivery=await rpc("register_epi_delivery_3d",adminAccessToken,
  {p_preparation_id:exchangePrep.data,p_idempotency_key:randomUUID()});
check("entrega real vincula solicitação 3C",exchangeDelivery.status===200 &&
  sql(`select count(*) from public.epi_delivery_groups_3d where id=${quote(exchangeDelivery.data)}::uuid and exchange_request_id=${quote(requestId)}::uuid`) === "1");
check("EPI anterior e pedido 3C não são encerrados automaticamente",sql(`select current_status from public.epi_deliveries where id=${quote(sourceId)}::uuid`) === "active" &&
  sql(`select status from public.epi_exchange_requests where id=${quote(requestId)}::uuid`) === "APROVADA");
const drift=seed("EPI com CA alterado entre tela e envio 3D");
sql(`update public.epi_stock_batches set lot_number='LOTE-3D-A',brand_model='MARCA-3D-A'
  where id=${quote(drift.batchId)}::uuid`);
const driftPrep=await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[{item_id:drift.itemId,stock_batch_id:drift.batchId,quantity:1}],p_idempotency_key:randomUUID()});
check("kit para cenário de mudança é preparado",driftPrep.status===200);
check("preparação preserva lote e marca do estoque",sql(`select lines_snapshot->0->>'lot_number',lines_snapshot->0->>'brand_model'
  from public.epi_prepared_kits_3d where id=${quote(driftPrep.data)}::uuid`) === "LOTE-3D-A|MARCA-3D-A");
sql(`update public.epi_stock_batches set ca_number='CA-ALTERADO' where id=${quote(drift.batchId)}::uuid`);
check("registro revalida CA mudado entre tela e envio",(await rpc("register_epi_delivery_3d",adminAccessToken,
  {p_preparation_id:driftPrep.data,p_idempotency_key:randomUUID()})).status>=400 &&
  sql(`select count(*) from public.epi_deliveries where stock_batch_id=${quote(drift.batchId)}::uuid`) === "0");
const driftLot=seed("EPI com lote alterado após preparo 3D");
sql(`update public.epi_stock_batches set lot_number='LOTE-ORIGINAL',brand_model='MARCA-ORIGINAL'
  where id=${quote(driftLot.batchId)}::uuid`);
const driftLotPrep=await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[{item_id:driftLot.itemId,stock_batch_id:driftLot.batchId,quantity:1}],p_idempotency_key:randomUUID()});
sql(`update public.epi_stock_batches set lot_number='LOTE-TROCADO' where id=${quote(driftLot.batchId)}::uuid`);
check("registro nega lote alterado após preparo",driftLotPrep.status===200 &&
  (await rpc("register_epi_delivery_3d",adminAccessToken,
    {p_preparation_id:driftLotPrep.data,p_idempotency_key:randomUUID()})).status>=400);
const driftBrand=seed("EPI com marca alterada após preparo 3D");
sql(`update public.epi_stock_batches set lot_number='LOTE-ORIGINAL',brand_model='MARCA-ORIGINAL'
  where id=${quote(driftBrand.batchId)}::uuid`);
const driftBrandPrep=await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.joao.employeeId,p_lines:[{item_id:driftBrand.itemId,stock_batch_id:driftBrand.batchId,quantity:1}],p_idempotency_key:randomUUID()});
sql(`update public.epi_stock_batches set brand_model='MARCA-TROCADA' where id=${quote(driftBrand.batchId)}::uuid`);
check("registro nega marca alterada após preparo",driftBrandPrep.status===200 &&
  (await rpc("register_epi_delivery_3d",adminAccessToken,
    {p_preparation_id:driftBrandPrep.data,p_idempotency_key:randomUUID()})).status>=400);
const mariaArgs = {p_employee_id:accounts.maria.employeeId,p_lines:[lines[0]],p_idempotency_key:randomUUID()};
const prepM = await rpc("prepare_epi_kit_3d",adminAccessToken,mariaArgs);
check("Gestão prepara kit Maria", prepM.status===200);
const groupM = await rpc("register_epi_delivery_3d",adminAccessToken,
  {p_preparation_id:prepM.data,p_idempotency_key:randomUUID()});
check("Gestão registra entrega Maria", groupM.status===200);
const itemM = (await rpc("my_epi_delivery_groups_3d",maria)).data.find(row=>row.group_id===groupM.data).items[0].delivery_id;
check("João não diverge Maria", (await rpc("respond_epi_delivery_3d",joao,
  {p_group_id:groupM.data,p_action:"DIVERGENCIA",p_delivery_id:itemM,p_category:"TAMANHO",
   p_details:"Recebi 41",p_idempotency_key:randomUUID()})).status>=400);
check("João não confirma Maria",(await rpc("respond_epi_delivery_3d",joao,
  {p_group_id:groupM.data,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,
    p_idempotency_key:randomUUID()})).status>=400);
const injectedFeedbackKey=randomUUID();
check("body não escolhe employee_id ou acknowledgement_id",(await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,
    p_idempotency_key:injectedFeedbackKey,p_employee_id:accounts.joao.employeeId,p_acknowledgement_id:123})).status>=400 &&
  sql(`select count(*) from public.epi_delivery_feedback_events_3d where idempotency_key=${quote(injectedFeedbackKey)}::uuid`) === "0");
const queryManipulation=await call(`/rest/v1/rpc/my_epi_delivery_groups_3d?employee_id=${accounts.joao.employeeId}`,maria,undefined,"GET");
check("querystring não revela grupos de João",queryManipulation.status>=400 ||
  (Array.isArray(queryManipulation.data) && !queryManipulation.data.some(row=>row.group_id===groupId)));
check("ID de item João em grupo Maria é negado", (await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"DIVERGENCIA",p_delivery_id:own.data.find(row=>row.group_id===groupId).items[0].delivery_id,
   p_category:"TAMANHO",p_details:"Recebi 41",p_idempotency_key:randomUUID()})).status>=400);
const divergent = await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"DIVERGENCIA",p_delivery_id:itemM,
   p_category:"TAMANHO",p_details:"Recebi tamanho 41",p_idempotency_key:randomUUID()});
check("Maria informa divergência por item", divergent.status===200 && Number.isSafeInteger(divergent.data));
check("tela antiga não confirma após divergência",(await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,
    p_idempotency_key:randomUUID()})).status>=400);
check("divergência preserva entrega original", sql(`select count(*) from public.epi_deliveries where id=${quote(itemM)}::uuid and variant_snapshot='42'`) === "1");
check("nova divergência igual é negada", (await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"DIVERGENCIA",p_delivery_id:itemM,
   p_category:"TAMANHO",p_details:"Recebi tamanho 41",p_idempotency_key:randomUUID()})).status>=400);
const feedback = await rpc("admin_epi_delivery_feedback_3d",adminAccessToken);
check("Gestão vê divergência, portal não recebe nota interna", feedback.status===200 &&
  feedback.data.some(row=>row.group_id===groupM.data && row.feedback_status==="DIVERGENCIA") &&
  !(await rpc("my_epi_delivery_groups_3d",maria)).data.some(row=>Object.hasOwn(row,"internal_note")));
sql(`update public.profiles set role='engineer',operation_permissions=array[]::text[] where id=${quote(adminId)}::uuid`);
check("Gestão sem epi:write não vê feedback", (await rpc("admin_epi_delivery_feedback_3d",adminAccessToken)).data.length===0);
check("Gestão sem epi:write não trata divergência", (await rpc("manage_epi_delivery_feedback_3d",adminAccessToken,
  {p_group_id:groupM.data,p_action:"EM_ANALISE",p_public_message:null,p_internal_note:null,p_idempotency_key:randomUUID()})).status>=400);
sql(`update public.profiles set role='admin',operation_permissions=null where id=${quote(adminId)}::uuid`);
check("Gestão coloca divergência em análise", (await rpc("manage_epi_delivery_feedback_3d",adminAccessToken,
  {p_group_id:groupM.data,p_action:"EM_ANALISE",p_public_message:null,p_internal_note:"Nota interna sintética",p_idempotency_key:randomUUID()})).status===200);
check("Gestão resolve com mensagem pública", (await rpc("manage_epi_delivery_feedback_3d",adminAccessToken,
  {p_group_id:groupM.data,p_action:"RESOLVIDA",p_public_message:"Conferido no laboratório",p_internal_note:null,p_idempotency_key:randomUUID()})).status===200);
const resolvedFeedback=await rpc("admin_epi_delivery_feedback_3d",adminAccessToken);
check("Gestão preserva item e motivo após resolver",resolvedFeedback.status===200 &&
  resolvedFeedback.data.some(row=>row.group_id===groupM.data && row.feedback_status==="RESOLVIDA" &&
    row.category==="TAMANHO" && row.details==="Recebi tamanho 41" && row.item_name));
const resolvedPersonal=await rpc("my_epi_delivery_groups_3d",maria);
check("Maria vê horário e mensagem pública da resolução sem nota interna",resolvedPersonal.status===200 &&
  resolvedPersonal.data.some(row=>row.group_id===groupM.data && row.feedback_status==="RESOLVIDA" &&
    row.feedback_at && row.public_message==="Conferido no laboratório" && !Object.hasOwn(row,"internal_note")));
check("histórico de feedback não pode ser apagado", (()=>{ try { sql(`delete from public.epi_delivery_feedback_events_3d where group_id=${quote(groupM.data)}::uuid`); return false; } catch { return true; } })());
check("snapshot de entrega não pode ser editado", (()=>{ try { sql(`update public.epi_deliveries set item_name_snapshot='Outro' where id=${quote(itemM)}::uuid`); return false; } catch { return true; } })());
sql(`update public.epi_employees set team_id=null where id=${quote(accounts.maria.employeeId)}::uuid`);
check("Maria sem equipe vê própria entrega", (await rpc("my_epi_delivery_groups_3d",maria)).data.some(row=>row.group_id===groupM.data));
sql(`update public.profiles set role='engineer',operation_permissions=array['epi:write']::text[],
  operation_team_ids=array[${quote(team)}::uuid] where id=${quote(adminId)}::uuid`);
check("gestor restrito não prepara funcionário sem equipe",(await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.maria.employeeId,p_lines:[lines[1]],p_idempotency_key:randomUUID()})).status>=400);
sql(`update public.profiles set role='admin',operation_permissions=null where id=${quote(adminId)}::uuid`);
const noTeamPrep=await rpc("prepare_epi_kit_3d",adminAccessToken,
  {p_employee_id:accounts.maria.employeeId,p_lines:[lines[1]],p_idempotency_key:randomUUID()});
const noTeamGroup=await rpc("register_epi_delivery_3d",adminAccessToken,
  {p_preparation_id:noTeamPrep.data,p_idempotency_key:randomUUID()});
check("admin registra entrega sem equipe/obra",noTeamPrep.status===200 && noTeamGroup.status===200 &&
  sql(`select count(*) from public.epi_deliveries where delivery_group_id=${quote(noTeamGroup.data)}::uuid and team_id is null`) === "1");
const noTeamDeliveryId=sql(`select id from public.epi_deliveries where delivery_group_id=${quote(noTeamGroup.data)}::uuid`);
sql(`update public.profiles set role='engineer',operation_permissions=array['epi:write']::text[],
  operation_team_ids=array[${quote(team)}::uuid] where id=${quote(adminId)}::uuid`);
check("engenheiro restrito não encerra entrega sem equipe pela RPC legada",
  (await rpc("close_epi_delivery_quantity",adminAccessToken,
    {p_delivery_id:noTeamDeliveryId,p_quantity:1,p_status:"returned"})).status>=400 &&
  sql(`select current_status from public.epi_deliveries where id=${quote(noTeamDeliveryId)}::uuid`) === "active");
sql(`update public.profiles set role='admin',operation_permissions=null where id=${quote(adminId)}::uuid`);
const noTeamConfirmation=await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:noTeamGroup.data,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,p_idempotency_key:randomUUID()});
check("Maria sem equipe/obra confirma entrega própria",noTeamConfirmation.status===200);
check("Maria sem equipe pode relatar nova divergência após resolução", (await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"DIVERGENCIA",p_delivery_id:itemM,p_category:"OUTRO",
   p_details:"Nova observação sintética",p_idempotency_key:randomUUID()})).status===200);
check("nova divergência conserva evento anterior no histórico",sql(`select count(*) from public.epi_delivery_feedback_events_3d
  where group_id=${quote(groupM.data)}::uuid and event_type='DIVERGENCIA'`) === "2");
const secondAnalysis=await rpc("manage_epi_delivery_feedback_3d",adminAccessToken,
  {p_group_id:groupM.data,p_action:"EM_ANALISE",p_public_message:null,p_internal_note:null,p_idempotency_key:randomUUID()});
const secondResolution=await rpc("manage_epi_delivery_feedback_3d",adminAccessToken,
  {p_group_id:groupM.data,p_action:"RESOLVIDA",p_public_message:"Resolvido novamente",p_internal_note:null,p_idempotency_key:randomUUID()});
check("Gestão pode tratar segunda divergência",secondAnalysis.status===200 && secondResolution.status===200);
const afterResolution=await rpc("respond_epi_delivery_3d",maria,
  {p_group_id:groupM.data,p_action:"CONFIRMADO",p_delivery_id:null,p_category:null,p_details:null,p_idempotency_key:randomUUID()});
check("Maria pode confirmar após divergência resolvida",afterResolution.status===200 &&
  (await rpc("my_epi_delivery_groups_3d",maria)).data.some(row=>row.group_id===groupM.data && row.feedback_status==="CONFIRMADO"));
const historicName=sql(`select item_name_snapshot from public.epi_deliveries where delivery_group_id=${quote(groupId)}::uuid and item_id=${quote(boot.itemId)}::uuid`);
sql(`update public.epi_items set name='Nome atual do catálogo alterado 3D' where id=${quote(boot.itemId)}::uuid`);
check("renomear catálogo não muda grupo histórico 3D",(await rpc("my_epi_delivery_groups_3d",joao)).data
  .find(row=>row.group_id===groupId).items.some(item=>item.item_name===historicName) &&
  historicName!=="Nome atual do catálogo alterado 3D");
check("inativo não confirma", (await rpc("respond_epi_delivery_3d",inactive,
  {p_group_id:groupId,p_action:"CONFIRMADO",p_idempotency_key:randomUUID()})).status>=400);
await revokePreviewAccount(accounts.joao.identityId,adminAccessToken);
check("token antigo revogado não consulta", (await rpc("my_epi_delivery_groups_3d",joao)).data.length===0);
check("token antigo revogado não confirma", (await rpc("respond_epi_delivery_3d",joao,
  {p_group_id:groupId,p_action:"CONFIRMADO",p_idempotency_key:randomUUID()})).status>=400);
evidence.passed=evidence.checks.every(row=>row.ok); evidence.count=evidence.checks.length;
writeFileSync(new URL("./resultado-3d.json",import.meta.url),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify({passed:evidence.passed,checks:evidence.count}));
