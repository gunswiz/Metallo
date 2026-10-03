// Provas com Auth/JWT/PostgREST reais, exclusivamente no Supabase Docker local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const evidence = { at: new Date().toISOString(), scope: "Marco 3E, laboratório sintético local", checks: [] };
function check(name, good) { evidence.checks.push({ name, ok: Boolean(good) }); assert.ok(good, name); }
async function call(path, bearer, body = {}, method = "POST") {
  const url = new URL(path, base); assert.equal(url.origin, base);
  const response = await fetch(url, { method, headers: { apikey: anon, Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
const rpc = (name, token, args = {}) => call(`/rest/v1/rpc/${name}`, token, args);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon,
    { email: account.email, password: account.password });
  assert.equal(response.status, 200); return response.data.access_token;
}

const { accounts, adminAccessToken } = await createPreviewAccounts();
const adminId = JSON.parse(Buffer.from(adminAccessToken.split(".")[1], "base64url").toString("utf8")).sub;
const joao = await login(accounts.joao), maria = await login(accounts.maria), inactive = await login(accounts.inativo);
const tag = Date.now();
const itemId = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
  values(${quote(`3E-${tag}`)},'Capacete sintético 3E','epi','un',${quote(adminId)}::uuid) returning id`);
const batchId = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,lot_number,brand_model,created_by)
  values(${quote(itemId)}::uuid,4,'CA-3E-HIST','LOTE-3E','MARCA-3E',${quote(adminId)}::uuid) returning id`);
const before = sql(`select count(*) from public.epi_deliveries where employee_id=${quote(accounts.joao.employeeId)}::uuid`);
const prepared = await rpc("prepare_epi_kit_3d", adminAccessToken, { p_employee_id: accounts.joao.employeeId,
  p_lines: [{ item_id: itemId, stock_batch_id: batchId, quantity: 1 }], p_idempotency_key: randomUUID() });
check("preparação sintética 3D criada", prepared.status === 200 && typeof prepared.data === "string");
const delivered = await rpc("register_epi_delivery_3d", adminAccessToken,
  { p_preparation_id: prepared.data, p_idempotency_key: randomUUID() });
check("entrega sintética 3D registrada", delivered.status === 200 && typeof delivered.data === "string");
const groupId = delivered.data;
const confirmed = await rpc("respond_epi_delivery_3d", joao,
  { p_group_id: groupId, p_action: "CONFIRMADO", p_delivery_id: null, p_category: null,
    p_details: null, p_idempotency_key: randomUUID() });
check("confirmação posterior distinta", confirmed.status === 200 && Number.isInteger(confirmed.data));

// Prova dirigida do vínculo 3C → 3D: Capacete não pode ser satisfeito por Luva.
const sourceId = sql(`select id from public.epi_deliveries where delivery_group_id=${quote(groupId)}::uuid`);
const wrongItem = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
  values(${quote(`3E-WRONG-${tag}`)},'Luva incompatível sintética 3E','epi','par',${quote(adminId)}::uuid) returning id`);
const wrongBatch = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,created_by)
  values(${quote(wrongItem)}::uuid,4,'CA-WRONG-3E',${quote(adminId)}::uuid) returning id`);
const requested = await rpc("create_epi_exchange_request", joao, { p_delivery_id: sourceId,
  p_reason: "DESGASTE", p_note: null, p_idempotency_key: randomUUID() });
assert.equal(requested.status, 200);
const requestId = requested.data[0].request_id;
assert.equal((await rpc("manage_epi_exchange_request", adminAccessToken,
  { p_request_id: requestId, p_action: "EM_ANALISE" })).data, "EM_ANALISE");
check("pedido sintético de troca de Capacete é aprovado sem entrega", (await rpc("manage_epi_exchange_request", adminAccessToken,
  { p_request_id: requestId, p_action: "APROVADA" })).data === "APROVADA");
const wrongPreparation = await rpc("prepare_epi_kit_3d", adminAccessToken, {
  p_employee_id: accounts.joao.employeeId, p_exchange_request_id: requestId,
  p_lines: [{ item_id: wrongItem, stock_batch_id: wrongBatch, quantity: 1 }], p_idempotency_key: randomUUID() });
check("Capacete → Luva é rejeitado explicitamente por item incompatível", wrongPreparation.status >= 400 &&
  wrongPreparation.data.message === "exchange_item_mismatch");
check("rejeição não cria preparação, grupo, entrega nem baixa estoque", sql(`select
  (select count(*) from public.epi_prepared_kits_3d where exchange_request_id=${quote(requestId)}::uuid),
  (select count(*) from public.epi_delivery_groups_3d where exchange_request_id=${quote(requestId)}::uuid),
  (select count(*) from public.epi_deliveries where employee_id=${quote(accounts.joao.employeeId)}::uuid),
  (select quantity from public.epi_stock_batches where id=${quote(wrongBatch)}::uuid)`)
  === `0|0|${Number(before) + 1}|4`);
const matchingPreparation = await rpc("prepare_epi_kit_3d", adminAccessToken, {
  p_employee_id: accounts.joao.employeeId, p_exchange_request_id: requestId,
  p_lines: [{ item_id: itemId, stock_batch_id: batchId, quantity: 1 }], p_idempotency_key: randomUUID() });
check("mesmo Capacete pode ser preparado, sem concluir troca ou entregar", matchingPreparation.status === 200 &&
  sql(`select status from public.epi_exchange_requests where id=${quote(requestId)}::uuid`) === "APROVADA" &&
  sql(`select count(*) from public.epi_delivery_groups_3d where exchange_request_id=${quote(requestId)}::uuid`) === "0" &&
  sql(`select current_status from public.epi_deliveries where id=${quote(sourceId)}::uuid`) === "active");

const adminJoao = await rpc("admin_epi_report_3e", adminAccessToken, { p_employee_id: accounts.joao.employeeId });
check("Gestão autorizada lê somente relatório solicitado", adminJoao.status === 200 &&
  adminJoao.data.employee.id === accounts.joao.employeeId &&
  adminJoao.data.deliveries.length === 1 && adminJoao.data.feedback.length === 1);
check("CA, lote e marca vêm do snapshot da entrega", adminJoao.data.deliveries[0].ca === "CA-3E-HIST" &&
  adminJoao.data.deliveries[0].lot === "LOTE-3E" && adminJoao.data.deliveries[0].brand === "MARCA-3E" &&
  adminJoao.data.deliveries[0].legacy_name === false);
check("IDs operacionais preservados sem inventar nome do responsável", adminJoao.data.deliveries[0].item_id === itemId &&
  adminJoao.data.deliveries[0].responsible_id === adminId && adminJoao.data.deliveries[0].responsible_name_snapshot === null);
check("relatório não inclui nota interna ou dados médicos", !/internal_note|aso_|cpf|salary|password|jwt/i.test(JSON.stringify(adminJoao.data)));
check("payload 3E minimiza relatos e mensagens livres", !/\"(details|public_message|note|message)\"\s*:/.test(JSON.stringify(adminJoao.data)));
const adminAgain = await rpc("admin_epi_report_3e", adminAccessToken, { p_employee_id: accounts.joao.employeeId });
check("cada emissão recebe report_id diferente", adminAgain.status === 200 &&
  adminAgain.data.report_id !== adminJoao.data.report_id);
check("geração usa horário do servidor", Math.abs(Date.now() - Date.parse(adminJoao.data.generated_at)) < 60000);

const ownJoao = await rpc("my_epi_report_3e", joao), ownMaria = await rpc("my_epi_report_3e", maria);
check("João vê sua entrega e confirmação", ownJoao.status === 200 &&
  ownJoao.data.employee.id === accounts.joao.employeeId && ownJoao.data.deliveries.length === 1);
check("Maria não vê fatos de João", ownMaria.status === 200 &&
  ownMaria.data.employee.id === accounts.maria.employeeId && ownMaria.data.deliveries.length === 0);
const originalTeam = sql(`select team_id from public.epi_employees where id=${quote(accounts.joao.employeeId)}::uuid`);
// F-3E-01: classificação/nome atuais não apagam os snapshots da entrega 3D.
try {
  sql(`update public.epi_items set item_kind='uniform',name='Catálogo reclassificado sintético' where id=${quote(itemId)}::uuid`);
  const retained = await rpc("my_epi_report_3e", joao);
  check("reclassificação do catálogo preserva entrega e nome histórico 3D", retained.status === 200 &&
    retained.data.deliveries.length === 1 && retained.data.deliveries[0].item_name === "Capacete sintético 3E" &&
    retained.data.deliveries[0].item_id === itemId && retained.data.deliveries[0].group_id === groupId);
} finally { sql(`update public.epi_items set item_kind='epi',name='Capacete sintético 3E' where id=${quote(itemId)}::uuid`); }
check("FK impede exclusão de item referenciado sem desabilitar controles", sql(`do $$ begin
  begin delete from public.epi_items where id=${quote(itemId)}::uuid;
    raise exception 'deletion_should_have_been_blocked';
  exception when foreign_key_violation then null; end;
end $$; select count(*) from public.epi_items where id=${quote(itemId)}::uuid`) === "1");
const uniformItem = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
  values(${quote(`3E-UNIFORM-${tag}`)},'Uniforme sintético fora do relatório EPI','uniform','un',${quote(adminId)}::uuid) returning id`);
sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,quantity,delivered_by)
  values(${quote(accounts.maria.employeeId)}::uuid,${quote(originalTeam)}::uuid,${quote(uniformItem)}::uuid,1,${quote(adminId)}::uuid)`);
check("uniforme sem grupo 3D não vira EPI no relatório pessoal", (await rpc("my_epi_report_3e", maria)).data.deliveries.length === 0);
check("Gestão autorizada conserva histórico de funcionário inativo", (await rpc("admin_epi_report_3e", adminAccessToken,
  { p_employee_id: accounts.inativo.employeeId })).data.employee.id === accounts.inativo.employeeId);
try {
  sql(`update public.teams set active=false where id=${quote(originalTeam)}::uuid`);
  const withoutActiveTeam = await rpc("my_epi_report_3e", joao);
  check("equipe inativa não bloqueia relatório e preserva snapshot da entrega", withoutActiveTeam.status === 200 &&
    withoutActiveTeam.data.employee.team === null && withoutActiveTeam.data.deliveries.length === 1 &&
    withoutActiveTeam.data.deliveries[0].team === ownJoao.data.deliveries[0].team);
} finally {
  sql(`update public.teams set active=true where id=${quote(originalTeam)}::uuid`);
}
try {
  sql(`update public.epi_employees set team_id=null where id=${quote(accounts.joao.employeeId)}::uuid`);
  const unassigned = await rpc("my_epi_report_3e", joao);
  check("funcionário sem equipe continua acessando o próprio relatório", unassigned.status === 200 &&
    unassigned.data.employee.id === accounts.joao.employeeId && unassigned.data.employee.team === null &&
    unassigned.data.deliveries.length === 1);
  const globalAdmin = await rpc("admin_epi_report_3e", adminAccessToken, { p_employee_id: accounts.joao.employeeId });
  check("Gestão global conserva relatório histórico de funcionário sem equipe", globalAdmin.status === 200 &&
    globalAdmin.data.employee.team === null);
} finally {
  sql(`update public.epi_employees set team_id=${quote(originalTeam)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
}
check("João não escolhe Maria em RPC administrativa", (await rpc("admin_epi_report_3e", joao,
  { p_employee_id: accounts.maria.employeeId })).status >= 400);
check("Maria não escolhe João em RPC administrativa", (await rpc("admin_epi_report_3e", maria,
  { p_employee_id: accounts.joao.employeeId })).status >= 400);
check("João não escolhe outro titular em RPC pessoal", (await rpc("my_epi_report_3e", joao,
  { p_employee_id: accounts.maria.employeeId })).status >= 400);
for (const arg of ["report_id", "delivery_id", "batch_id", "employee_id"]) {
  check(`RPC pessoal recusa parâmetro injetado ${arg}`, (await rpc("my_epi_report_3e", joao,
    { [arg]: randomUUID() })).status >= 400);
}
check("report_id em querystring não seleciona outro documento", (await call(
  `/rest/v1/rpc/my_epi_report_3e?report_id=${randomUUID()}`, joao, undefined, "GET")).status >= 400);
check("funcionário inativo não recebe relatório pessoal", (await rpc("my_epi_report_3e", inactive)).status >= 400);
check("anônimo não executa RPCs", (await rpc("my_epi_report_3e", anon)).status >= 400 &&
  (await rpc("admin_epi_report_3e", anon, { p_employee_id: accounts.joao.employeeId })).status >= 400);
check("tabelas históricas continuam fechadas a acesso direto", (await call("/rest/v1/epi_delivery_feedback_events_3d?select=*", joao, undefined, "GET")).status >= 400);

const restrictedFixture = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?restricted-${tag}`);
const { admin: restrictedAccount } = await restrictedFixture.createPreviewAdminSession();
sql(`update public.profiles set role='engineer',active=true,operation_permissions='{}',operation_team_ids='{}'
  where id=${quote(restrictedAccount.id)}::uuid`);
const restricted = await login(restrictedAccount);
check("Gestão sem permissão não emite relatório de João", (await rpc("admin_epi_report_3e", restricted,
  { p_employee_id: accounts.joao.employeeId })).status >= 400);
try {
  sql(`update public.epi_employees set team_id=null where id=${quote(accounts.joao.employeeId)}::uuid`);
  check("equipe nula não amplia a permissão da Gestão", (await rpc("admin_epi_report_3e", restricted,
    { p_employee_id: accounts.joao.employeeId })).status >= 400);
} finally {
  sql(`update public.epi_employees set team_id=${quote(originalTeam)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
}

// Exercita também a rota real da Gestão; cookies sintéticos só existem em memória.
const requireWeb = createRequire(new URL("../../01_WEB/package.json", import.meta.url));
const { createServerClient } = requireWeb("@supabase/ssr");
async function managementCookie(account) {
  const jar = new Map();
  const client = createServerClient(base, anon, { cookies: {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: rows => rows.forEach(row => jar.set(row.name, row.value)),
  } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.equal(error, null);
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}
const freshManagement = await (await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?http-${tag}`)).createPreviewAdminSession();
const adminCookie = await managementCookie(freshManagement.admin);
const restrictedCookie = await managementCookie(restrictedAccount);
// F-3E-04: escopo explícito de equipes é respeitado; NULL preserva o modelo herdado.
const otherTeam = sql(`insert into public.teams(name,location_type,active)
  values(${quote(`Equipe B sintética confronto 3E ${tag}`)},'field',true) returning id`);
sql(`update public.epi_employees set team_id=${quote(otherTeam)}::uuid where id=${quote(accounts.maria.employeeId)}::uuid`);
sql(`update public.profiles set operation_permissions=array['epi:write'],operation_team_ids=array[${quote(originalTeam)}::uuid]
  where id=${quote(restrictedAccount.id)}::uuid`);
check("engenheiro com equipe explícita lê somente equipe autorizada", (await rpc("admin_epi_report_3e", restricted,
  { p_employee_id: accounts.joao.employeeId })).status === 200);
check("engenheiro restrito à equipe A não lê Maria da equipe B", (await rpc("admin_epi_report_3e", restricted,
  { p_employee_id: accounts.maria.employeeId })).data.message === "epi_report_access_denied");
const deniedRoute = `http://127.0.0.1:3102/funcionarios/${accounts.maria.employeeId}/epi`;
const deniedPage = await fetch(deniedRoute, { headers: { Cookie: restrictedCookie }, redirect: "manual" });
const deniedHtml = await deniedPage.text();
evidence.denied_preview = { status: deniedPage.status,
  not_found_marker: deniedHtml.includes('NEXT_HTTP_ERROR_FALLBACK;404'),
  false_offline_message: deniedHtml.includes('Confirme que o laboratório local está disponível'),
  personal_report_visible: deniedHtml.includes('Confira os registros de Maria') };
// Next notFound: 404 sem streaming; resposta já iniciada pode ter 200 com boundary 404.
// Exigir o boundary nessa situação, além da ausência de dados e do falso erro offline.
check("prévia Gestão sem escopo mostra indisponível sem relatório ou falsa queda",
  (deniedPage.status === 404 || (deniedPage.status === 200 && evidence.denied_preview.not_found_marker)) &&
  !deniedHtml.includes('Confirme que o laboratório local está disponível') && !deniedHtml.includes('Confira os registros de Maria'));
const deniedPdf = await fetch(`${deniedRoute}/pdf`, { headers: { Cookie: restrictedCookie }, redirect: "manual" });
check("PDF Gestão sem escopo responde 404 neutro e sem cache", deniedPdf.status === 404 &&
  (await deniedPdf.text()) === "Relatório indisponível." && deniedPdf.headers.get("cache-control").includes("no-store"));
const absentPdf = await fetch(`http://127.0.0.1:3102/funcionarios/${randomUUID()}/epi/pdf`,
  { headers: { Cookie: restrictedCookie }, redirect: "manual" });
check("titular ausente e acesso negado produzem o mesmo 404 público", absentPdf.status === 404 &&
  (await absentPdf.text()) === "Relatório indisponível.");
sql(`update public.profiles set operation_permissions=null,operation_team_ids=null where id=${quote(restrictedAccount.id)}::uuid`);
check("engenheiro NULL conserva escopo global explicitamente herdado", (await rpc("admin_epi_report_3e", restricted,
  { p_employee_id: accounts.maria.employeeId })).status === 200);
sql(`update public.profiles set operation_permissions='{}',operation_team_ids='{}' where id=${quote(restrictedAccount.id)}::uuid`);
const route = `http://127.0.0.1:3102/funcionarios/${accounts.joao.employeeId}/epi`;
const page = await fetch(route, { headers: { Cookie: adminCookie }, redirect: "manual" });
check("Gestão HTTP autenticada mostra prévia 3E", page.status === 200 && (await page.text()).includes("Ficha e histórico de EPI"));
const file = await fetch(`${route}/pdf?type=history&preset=all`, { headers: { Cookie: adminCookie }, redirect: "manual" });
check("Gestão HTTP gera PDF real sem cache", file.status === 200 && file.headers.get("content-type") === "application/pdf" &&
  file.headers.get("cache-control").includes("no-store") && (await file.arrayBuffer()).byteLength > 1000);
check("URL de PDF sem sessão não revela documento", (await fetch(`${route}/pdf`, { redirect: "manual" })).status === 307);
check("URL de PDF Gestão sem permissão é recusada", (await fetch(`${route}/pdf`, { headers: { Cookie: restrictedCookie }, redirect: "manual" })).status === 307);
check("URL de PDF recusa filtro manipulado", (await fetch(`${route}/pdf?preset=custom&from=2026-09-30&to=2026-09-01`,
  { headers: { Cookie: adminCookie }, redirect: "manual" })).status === 400);
check("relatório não altera entregas", sql(`select count(*) from public.epi_deliveries where employee_id=${quote(accounts.joao.employeeId)}::uuid`) === String(Number(before) + 1));
check("relatório não altera feedback", sql(`select count(*) from public.epi_delivery_feedback_events_3d where group_id=${quote(groupId)}::uuid`) === "1");
check("grants só para authenticated", sql(`select count(*),bool_and(has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'))
  from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in
  ('admin_epi_report_3e','my_epi_report_3e')`) === "2|t");
check("grupo de entrega tem unicidade aplicada por pedido de troca", sql(`select count(*) from pg_constraint
  where conrelid='public.epi_delivery_groups_3d'::regclass and contype='u'
    and pg_get_constraintdef(oid)='UNIQUE (exchange_request_id)'`) === "1");
// F-3E-03: limite SQL exercitado com 3001 fatos sintéticos em transação descartada.
const limitProof = sql(`begin;
  insert into public.epi_deliveries(employee_id,team_id,item_id,quantity,delivered_by)
    select ${quote(accounts.inativo.employeeId)}::uuid,${quote(originalTeam)}::uuid,${quote(itemId)}::uuid,1,${quote(adminId)}::uuid
    from generate_series(1,3001);
  do $$ begin
    begin perform private.epi_report_payload_3e(${quote(accounts.inativo.employeeId)}::uuid);
      raise exception 'limit_should_have_been_blocked';
    exception when others then if sqlerrm <> 'epi_report_too_large' then raise; end if; end;
  end $$;
  select count(*) from public.epi_deliveries where employee_id=${quote(accounts.inativo.employeeId)}::uuid;
  rollback;`);
check("3001 entregas falham no limite controlado da extração SQL", limitProof === "3001");
check("ensaio do limite não persiste entregas nem muda estoque", sql(`select count(*) from public.epi_deliveries
  where employee_id=${quote(accounts.inativo.employeeId)}::uuid`) === "0");
await revokePreviewAccount(accounts.joao.identityId, adminAccessToken);
check("JWT residual revogado não emite relatório", (await rpc("my_epi_report_3e", joao)).status >= 400);
check("revogação pessoal não apaga história da Gestão autorizada", (await rpc("admin_epi_report_3e", adminAccessToken,
  { p_employee_id: accounts.joao.employeeId })).data.deliveries.length === 1);

writeFileSync(new URL("./resultado-3e.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`Marco 3E local: ${evidence.checks.length}/${evidence.checks.length} verificações reais aprovadas.`);
