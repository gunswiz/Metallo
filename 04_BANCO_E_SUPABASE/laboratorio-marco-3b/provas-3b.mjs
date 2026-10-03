// Marco 3B: ensaios reais apenas no Supabase local com contas e EPIs sinteticos.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const evidence = { at: new Date().toISOString(), scope: "Marco 3B local sintético", checks: [], http_samples: [] };
function check(name, condition) {
  evidence.checks.push({ name, ok: Boolean(condition) });
  assert.ok(condition, name);
}
async function request(path, bearer, body = {}, method = "POST") {
  const url = new URL(path, base);
  assert.equal(url.origin, base);
  const response = await fetch(url, { method, headers: { apikey: anon, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function login(account) {
  const session = await request("/auth/v1/token?grant_type=password", anon, { email: account.email, password: account.password });
  assert.equal(session.status, 200);
  return session.data;
}
const personal = (token, body = {}, query = "") => request(`/rest/v1/rpc/my_personal_epi${query}`, token, body);
const profile = token => request("/rest/v1/rpc/my_employee_profile", token);
const catalog = sql("select pg_get_userbyid(proowner),prosecdef,coalesce('search_path=\"\"'=any(proconfig),false),has_function_privilege('anon','public.my_personal_epi()','EXECUTE'),has_function_privilege('authenticated','public.my_personal_epi()','EXECUTE') from pg_proc where oid='public.my_personal_epi()'::regprocedure").split("|");
check("dono postgres e SECURITY DEFINER", catalog[0] === "postgres" && catalog[1] === "t");
check("search_path vazio", catalog[2] === "t");
check("anon negado, authenticated permitido", catalog[3] === "f" && catalog[4] === "t");
check("RPC sem argumentos e sem overload", sql("select count(*),min(pronargs),max(pronargs) from pg_proc where pronamespace='public'::regnamespace and proname='my_personal_epi'") === "1|0|0");
evidence.catalog = { owner: catalog[0], security_definer: catalog[1] === "t", empty_search_path: catalog[2] === "t",
  anon_execute: catalog[3] === "t", authenticated_execute: catalog[4] === "t",
  signatures: sql("select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='my_personal_epi'"),
  zero_arguments: sql("select pronargs from pg_proc where oid='public.my_personal_epi()'::regprocedure") === "0" };
check("RLS preservado nas tabelas EPI", sql("select count(*) from pg_class where oid in ('public.epi_deliveries'::regclass,'public.epi_items'::regclass,'public.epi_employee_items'::regclass,'public.epi_monthly_acknowledgements'::regclass) and relrowsecurity") === "4");

const { accounts, team, adminAccessToken } = await createPreviewAccounts();
const joaoSession = await login(accounts.joao), mariaSession = await login(accounts.maria), inactiveSession = await login(accounts.inativo), emptySession = await login(accounts.expira);
const joao = joaoSession.access_token, maria = mariaSession.access_token;
const stamp = Date.now();
function item(label, kind = "epi") {
  return sql(`insert into public.epi_items(code,name,item_kind,unit,ca_number,created_by) values(${quote(`3B-${stamp}-${label}`)},${quote(label)},${quote(kind)},'un','CA-CATALOGO',${quote(accounts.joao.id)}::uuid) returning id`);
}
function delivery(employee, epi, status, label, variant = "M", amount = 1) {
  const closed = status === "active" ? "null" : "now()-interval '1 day'";
  return sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,quantity,delivered_at,delivery_reason,current_status,ca_snapshot,variant_snapshot,delivered_by,closed_at,closed_by,note) values(${quote(employee.employeeId)}::uuid,${quote(team)}::uuid,${quote(epi)}::uuid,${amount},now()-interval '12 days',${quote(label)},${quote(status)},'CA-ENTREGA',${quote(variant)},${quote(accounts.joao.id)}::uuid,${closed},${status === "active" ? "null" : `${quote(accounts.joao.id)}::uuid`},'OBSERVACAO-INTERNA-3B') returning id`);
}
const itemJ = item("Capacete João 3B"), itemM = item("Capacete Maria 3B"), itemOld = item("Luva anterior João 3B"), uniform = item("Uniforme não EPI 3B", "uniform"), inactiveItem = item("Capacete inativo 3B");
const deliveryJ = delivery(accounts.joao, itemJ, "active", "initial");
const deliveryM = delivery(accounts.maria, itemM, "active", "initial");
delivery(accounts.joao, itemOld, "replaced", "replacement", "G");
delivery(accounts.joao, uniform, "active", "initial");
delivery(accounts.inativo, inactiveItem, "active", "initial");
const j = await personal(joao), m = await personal(maria);
check("João recebe EPI atual e histórico próprios", j.status === 200 && j.data.length === 2 && j.data.some(row => row.item_name === "Capacete João 3B" && row.current_status === "active") && j.data.some(row => row.item_name === "Luva anterior João 3B" && row.current_status === "replaced"));
check("Maria recebe somente EPI próprio", m.status === 200 && m.data.length === 1 && m.data[0].item_name === "Capacete Maria 3B");
check("João não recebe Maria", !JSON.stringify(j.data).includes("Maria 3B"));
check("Maria não recebe João", !JSON.stringify(m.data).includes("João 3B"));
check("conjunto ou uniforme não é EPI entregue", !JSON.stringify(j.data).includes("Uniforme não EPI"));
check("CA vem da entrega, não do catálogo atual", j.data.every(row => row.ca_number === "CA-ENTREGA"));
check("DTO sem IDs e campos administrativos", [...j.data, ...m.data].every(row => Object.keys(row).sort().join() === "ca_number,closed_at,current_status,delivered_at,delivery_reason,item_name,quantity,unit,variant" && !JSON.stringify(row).includes("OBSERVACAO-INTERNA")));
check("anon não executa RPC", (await personal(anon)).status >= 400);
check("admin Gestão não recebe EPI pessoal", (await personal(adminAccessToken)).data.length === 0);
for (const [actor, token] of [["João", joao], ["Maria", maria]]) {
  for (const table of ["epi_deliveries", "epi_items", "epi_employee_items", "epi_monthly_acknowledgements"]) {
    const direct = await request(`/rest/v1/${table}?select=*&limit=5`, token, undefined, "GET");
    check(`${actor} sem leitura operacional direta em ${table}`, direct.status >= 400 || (Array.isArray(direct.data) && direct.data.length === 0));
    evidence.http_samples.push({ case: "leitura operacional direta", actor, table, status: direct.status,
      rows: Array.isArray(direct.data) ? direct.data.length : null });
  }
}
for (const [name, value] of Object.entries({ employee_id: accounts.maria.employeeId, user_id: accounts.maria.id, cpf: "00000000000", team_id: team, item_id: itemM, delivery_id: deliveryM })) {
  const attack = await personal(joao, { [name]: value });
  check(`argumento extra ${name} não revela Maria`, attack.status >= 400 || (Array.isArray(attack.data) && !JSON.stringify(attack.data).includes("Maria 3B")));
  const query = await personal(joao, {}, `?${name}=${encodeURIComponent(value)}`);
  check(`querystring ${name} não revela Maria`, query.status >= 400 || (Array.isArray(query.data) && !JSON.stringify(query.data).includes("Maria 3B")));
}
check("ID de entrega em URL não revela Maria", (await request(`/rest/v1/rpc/my_personal_epi/${deliveryM}`, joao)).status >= 400);
check("seleção de colunas não amplia DTO", (await personal(joao, {}, "?select=*")).data.every(row => !Object.hasOwn(row, "employee_id")));
check("funcionário inativo sem EPI pessoal", (await personal(inactiveSession.access_token)).data.length === 0);
check("funcionário ativo sem entrega recebe lista vazia", (await personal(emptySession.access_token)).data.length === 0);
check("conta previamente revogada não faz login", (await request("/auth/v1/token?grant_type=password", anon, { email: accounts.revogada.email, password: accounts.revogada.password })).status >= 400);
sql(`update public.epi_employees set team_id=null where id=${quote(accounts.joao.employeeId)}::uuid`);
check("sem equipe mantém EPIs próprios", (await personal(joao)).data.length === 2 && (await profile(joao)).data.length === 1);
sql(`update public.epi_employees set team_id=${quote(team)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
const worksite = sql(`insert into public.worksites(name,stock_team_id,created_by) values('Obra Sintética 3B',${quote(team)}::uuid,${quote(accounts.joao.id)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(worksite)}::uuid where id=${quote(team)}::uuid`);
check("obra existente antes de encerrar vínculo", (await request("/rest/v1/rpc/my_current_work", joao)).data.length === 1);
sql(`update public.worksites set active=false where id=${quote(worksite)}::uuid`);
check("sem obra real mantém EPIs próprios", (await request("/rest/v1/rpc/my_current_work", joao)).data.length === 0 && (await personal(joao)).data.length === 2);
sql(`update public.teams set worksite_id=null where id=${quote(team)}::uuid`);
sql(`delete from public.worksites where id=${quote(worksite)}::uuid`);
const splitItem = item("Luva parcial João 3B");
const splitDelivery = delivery(accounts.joao, splitItem, "active", "initial", "G", 3);
const splitClose = await request("/rest/v1/rpc/close_epi_delivery_quantity", adminAccessToken,
  { p_delivery_id: splitDelivery, p_quantity: 1, p_status: "replaced" });
check("fechamento parcial aceito pela Gestão sintética", splitClose.status === 200);
const splitRows = (await personal(joao)).data.filter(row => row.item_name === "Luva parcial João 3B");
check("fechamento parcial devolve 2 ativos e 1 encerrado", splitRows.length === 2 &&
  splitRows.some(row => row.quantity === 2 && row.current_status === "active") &&
  splitRows.some(row => row.quantity === 1 && row.current_status === "replaced"));
check("parcial preserva data e CA sem duplicar a quantidade", splitRows.reduce((sum, row) => sum + row.quantity, 0) === 3 &&
  splitRows[0].delivered_at === splitRows[1].delivered_at && splitRows.every(row => row.ca_number === "CA-ENTREGA"));
evidence.http_samples.push({ case: "fechamento parcial", close_status: splitClose.status,
  personal_status: 200, active_quantity: 2, closed_quantity: 1, total_quantity: 3 });
await revokePreviewAccount(accounts.joao.identityId, adminAccessToken);
check("JWT residual após revogação não retorna EPIs", (await personal(joao)).data.length === 0);
check("novo login após revogação não recupera EPIs", (await request("/auth/v1/token?grant_type=password", anon, { email: accounts.joao.email, password: accounts.joao.password })).status >= 400);
const refreshed = await request("/auth/v1/token?grant_type=refresh_token", anon, { refresh_token: joaoSession.refresh_token });
check("refresh após revogação não recupera EPIs", refreshed.status >= 400 || (await personal(refreshed.data.access_token)).data.length === 0);
evidence.http_samples.push({ case: "João/Maria pessoais", joao_status: j.status, joao_rows: j.data.length, maria_status: m.status, maria_rows: m.data.length, restricted_delivery_reference_present: Boolean(deliveryJ) });
writeFileSync(fileURLToPath(new URL("./resultado-3b.json", import.meta.url)), JSON.stringify(evidence, null, 2) + "\n");
console.log(`Marco 3B local: ${evidence.checks.filter(x => x.ok).length}/${evidence.checks.length} verificações reais`);
