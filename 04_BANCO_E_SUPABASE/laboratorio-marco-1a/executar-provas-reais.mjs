// Provas reais de Auth/JWT/PostgREST/RPC somente contra a pilha local.
// Todas as identidades e linhas criadas sao sinteticas.
import assert from "node:assert/strict";
import { createHmac, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { revokePortalAccountLocal } from "./revogar-conta-portal-servidor.mjs";

const lab = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(root, "node_modules", "supabase", "dist", "supabase.js");
const docker = join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe");
const container = "supabase_db_laboratorio-marco-1a";
if (!existsSync(cli) || !existsSync(docker)) throw new Error("CLI ou Docker local ausente.");
const endpoint = execFileSync(docker, ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { encoding: "utf8" }).trim();
if (!endpoint.startsWith("npipe:////./pipe/")) throw new Error("Contexto Docker nao e local.");
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" };
const status = JSON.parse(execFileSync(process.execPath, [cli, "status", "--workdir", lab, "-o", "json"], { encoding: "utf8", env }));
assert.equal(status.API_URL, "http://127.0.0.1:54321");
assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY && status.JWT_SECRET);
const base = status.API_URL;
const anon = status.ANON_KEY;
const service = status.SERVICE_ROLE_KEY;
const report = { started_at: new Date().toISOString(), environment: "Supabase CLI 2.117.0 local", checks: [] };

function record(name, ok, detail = "") {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(`${name}: ${detail}`);
}
function observe(name, ok, detail = "") {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}
function sql(text) {
  // O inventário integral cresceu com as fixtures acumuladas; nenhuma linha é truncada.
  return execFileSync(docker, ["exec", container, "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", text], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim();
}
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
async function request(path, { method = "GET", apikey = anon, bearer = apikey, body, headers = {} } = {}) {
  if (!path.startsWith("/")) throw new Error("Caminho HTTP invalido.");
  const response = await fetch(base + path, { method, headers: { apikey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { status: response.status, data };
}
function requireHttp(name, response, allowed) {
  record(name, allowed.includes(response.status), `HTTP ${response.status}${allowed.includes(response.status) ? "" : ` ${JSON.stringify(response.data).slice(0, 220)}`}`);
  return response.data;
}
async function createUser(name, kind, runId) {
  const email = `${kind}-${runId}@example.invalid`;
  const password = `Lab!${randomBytes(18).toString("base64url")}`;
  const token = randomUUID();
  requireHttp(`ticket ${kind}`, await request("/rest/v1/rpc/issue_user_provisioning_ticket", { method: "POST", apikey: service, bearer: service, body: { p_email: email, p_token: token } }), [200, 204]);
  const app_metadata = { metallo_provisioned: true };
  if (kind !== "admin") app_metadata.metallo_account_type = "employee_portal";
  const user = requireHttp(`Auth create ${kind}`, await request("/auth/v1/admin/users", { method: "POST", apikey: service, bearer: service, body: { email, password, email_confirm: true, user_metadata: { full_name: name, metallo_provisioning_token: token }, app_metadata } }), [200, 201]);
  assert.ok(user.id);
  return { id: user.id, email, password, name };
}
async function signIn(user) {
  const result = requireHttp(`Auth login ${user.name}`, await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: user.email, password: user.password } }), [200]);
  assert.ok(result.access_token && result.refresh_token);
  const [header, payload, signature] = result.access_token.split(".");
  const jwtHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  const jwtPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  let validSignature = false;
  if (jwtHeader.alg === "ES256") {
    const jwks = requireHttp("Auth JWKS local", await request("/auth/v1/.well-known/jwks.json"), [200]);
    const key = jwks.keys.find((entry) => entry.kid === jwtHeader.kid);
    assert.ok(key, "Chave do JWT ausente no JWKS local");
    validSignature = verify("sha256", Buffer.from(`${header}.${payload}`), { key: createPublicKey({ key, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
  } else if (jwtHeader.alg === "HS256") {
    const expected = createHmac("sha256", status.JWT_SECRET).update(`${header}.${payload}`).digest();
    validSignature = timingSafeEqual(expected, Buffer.from(signature, "base64url"));
  } else {
    throw new Error(`Algoritmo JWT nao previsto: ${jwtHeader.alg}`);
  }
  record(`JWT assinado ${user.name}`, validSignature && jwtPayload.sub === user.id && jwtPayload.role === "authenticated" && Boolean(jwtPayload.session_id) && jwtPayload.exp > Math.floor(Date.now() / 1000));
  return { ...result, payload: jwtPayload };
}

try {
  const health = await request("/auth/v1/health");
  requireHttp("Auth local saudavel", health, [200]);
  const runId = Date.now().toString(36);
  const admin = await createUser("Admin Sintetico", "admin", runId);
  const updated = sql(`update public.profiles set role='admin', active=true where id=${literal(admin.id)}::uuid returning id`);
  record("Admin Gestao sintetico ativo", updated === admin.id);
  const adminSession = await signIn(admin);
  const adminProfile = await request(`/rest/v1/profiles?id=eq.${admin.id}&select=id,role,active`, { bearer: adminSession.access_token });
  requireHttp("Gestao via PostgREST", adminProfile, [200]);
  record("Perfil admin pela RLS", Array.isArray(adminProfile.data) && adminProfile.data.length === 1 && adminProfile.data[0].role === "admin");

  const signup = await request("/auth/v1/signup", { method: "POST", body: { email: `publico-${runId}@example.invalid`, password: `Lab!${randomBytes(18).toString("base64url")}` } });
  record("Inscricao publica bloqueada", signup.status >= 400 && signup.status < 500, `HTTP ${signup.status}`);

  const joao = await createUser("Joao Sintetico", "joao", runId);
  const maria = await createUser("Maria Sintetica", "maria", runId);
  const revogada = await createUser("Conta Revogada Sintetica", "revogada", runId);
  const teamId = sql("select id from public.teams where location_type='central' and active=true order by created_at limit 1");
  record("Equipe sintetica disponivel", /^[0-9a-f-]{36}$/.test(teamId));

  function createEmployee(user, code, aso) {
    const id = sql(`insert into public.epi_employees(full_name,registration_code,profession,team_id,aso_exam_date,aso_expiry_date,created_by) values(${literal(user.name)},${literal(code)},'Profissao Teste',${literal(teamId)}::uuid,'2026-09-01',${literal(aso)},${literal(admin.id)}::uuid) returning id`);
    assert.match(id, /^[0-9a-f-]{36}$/);
    return id;
  }
  const joaoEmployee = createEmployee(joao, `LAB-J-${runId}`, "2027-09-01");
  const mariaEmployee = createEmployee(maria, `LAB-M-${runId}`, "2027-09-01");
  const revokedEmployee = createEmployee(revogada, `LAB-R-${runId}`, "2027-09-01");
  record("Funcionarios EPI sinteticos", [joaoEmployee, mariaEmployee, revokedEmployee].every(Boolean));

  const itemId = sql(`insert into public.epi_items(code,name,item_kind,unit,minimum_stock,created_by) values(${literal(`LAB-EPI-${runId}`)},'Capacete sintetico','epi','un',0,${literal(admin.id)}::uuid) returning id`);
  const batchId = sql(`insert into public.epi_stock_batches(item_id,quantity,created_by) values(${literal(itemId)}::uuid,10,${literal(admin.id)}::uuid) returning id`);
  for (const employeeId of [joaoEmployee, mariaEmployee]) {
    sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,stock_batch_id,quantity,delivered_by) values(${literal(employeeId)}::uuid,${literal(teamId)}::uuid,${literal(itemId)}::uuid,${literal(batchId)}::uuid,1,${literal(admin.id)}::uuid) returning id`);
  }
  record("Entregas EPI sinteticas", true);

  const identities = new Map();
  for (const [user, employeeId, code] of [[joao, joaoEmployee, `LAB-J-${runId}`], [maria, mariaEmployee, `LAB-M-${runId}`], [revogada, revokedEmployee, `LAB-R-${runId}`]]) {
    requireHttp(`Registro de conta dedicada ${user.name}`, await request("/rest/v1/rpc/admin_register_portal_account", { method: "POST", bearer: adminSession.access_token, body: { p_auth_user_id: user.id } }), [200, 204]);
    const linked = requireHttp(`Vinculo identidade ${user.name}`, await request("/rest/v1/rpc/admin_link_employee_identity", { method: "POST", bearer: adminSession.access_token, body: { p_auth_user_id: user.id, p_employee_id: employeeId, p_expected_employee_name: user.name, p_expected_registration_code: code, p_verification_method: "in_person" } }), [200]);
    assert.match(linked, /^[0-9a-f-]{36}$/);
    identities.set(user.id, linked);
  }

  const joaoSession = await signIn(joao);
  const mariaSession = await signIn(maria);
  const revokedSession = await signIn(revogada);
  if (process.env.METALLO_TEST_EDGE_FUNCTIONS === "1") {
    for (const [name, body] of [
      ["admin-invite-user", { email: `nao-criar-${runId}@example.invalid`, full_name: "Teste Negado", role: "collaborator" }],
      ["create-employee", { email: `nao-criar-${runId}@example.invalid`, full_name: "Teste Negado", role: "collaborator" }],
      ["delete-employee", { user_id: maria.id }],
      ["revoke-portal-account", { identity_id: identities.get(maria.id), reason: "other" }]
    ]) {
      const response = await request(`/functions/v1/${name}`, { method: "POST", bearer: joaoSession.access_token, body });
      observe(`Edge Function ${name} nega Joao`, response.status === 403, `HTTP ${response.status}`);
    }
  }
  for (const [user, session, employeeId] of [[joao, joaoSession, joaoEmployee], [maria, mariaSession, mariaEmployee], [revogada, revokedSession, revokedEmployee]]) {
    const own = await request("/rest/v1/rpc/my_employee_profile", { method: "POST", bearer: session.access_token, body: {} });
    requireHttp(`DTO proprio ${user.name}`, own, [200]);
    record(`Identidade propria ${user.name}`, Array.isArray(own.data) && own.data.length === 1 && own.data[0].employee_id === employeeId && own.data[0].full_name === user.name);
    record(`DTO minimo sem ASO/CPF/campos sensiveis ${user.name}`, JSON.stringify(Object.keys(own.data[0]).sort()) === JSON.stringify(["employee_id", "full_name", "profession", "team_name"]));
  }

  const adminEmployees = await request("/rest/v1/epi_employees?select=id", { bearer: adminSession.access_token });
  requireHttp("Gestao le EPI via RLS", adminEmployees, [200]);
  record("Gestao encontra tres funcionarios", [joaoEmployee, mariaEmployee, revokedEmployee].every((id) => adminEmployees.data.some((row) => row.id === id)));
  for (const [viewer, session, target] of [["Joao", joaoSession, mariaEmployee], ["Maria", mariaSession, joaoEmployee]]) {
    for (const table of ["epi_employees", "epi_deliveries", "epi_monthly_acknowledgements", "epi_requests"]) {
      const filter = table === "epi_employees" ? `id=eq.${target}` : `employee_id=eq.${target}`;
      const response = await request(`/rest/v1/${table}?${filter}&select=*`, { bearer: session.access_token });
      observe(`${viewer} nao le ${table} alheio`, (response.status === 200 && Array.isArray(response.data) && response.data.length === 0) || response.status === 403, `HTTP ${response.status}`);
    }
  }
  for (const [viewer, session] of [["Joao", joaoSession], ["Maria", mariaSession]]) {
    const aso = await request("/rest/v1/epi_employees?select=id,aso_exam_date,aso_expiry_date", { bearer: session.access_token });
    observe(`${viewer} nao le ASO`, (aso.status === 200 && Array.isArray(aso.data) && aso.data.length === 0) || aso.status === 403, `HTTP ${aso.status}`);
    const privateTable = await request("/rest/v1/employee_identity?select=*", { bearer: session.access_token });
    observe(`${viewer} nao acessa identidade privada`, privateTable.status >= 400, `HTTP ${privateTable.status}`);
  }

  const portalTables = [
    "asset_movements", "assets", "employee_assignments", "epi_deliveries",
    "epi_employee_item_sets", "epi_employee_items", "epi_employees",
    "epi_item_variants", "epi_items", "epi_monthly_acknowledgements",
    "epi_profession_items", "epi_professions", "epi_requests", "epi_stock_batches",
    "epi_stock_transfers", "inventory", "items", "movements", "operation_reasons",
    "profile_access_audit", "profiles", "rental_admin_details", "rental_return_requests",
    "site_operation_receipts", "supply_order_events", "supply_order_lines",
    "supply_orders", "teams", "work_locations", "worksites"
  ];
  report.table_matrix = [];
  for (const [viewer, session, user] of [["Joao", joaoSession, joao], ["Maria", mariaSession, maria]]) {
    for (const table of portalTables) {
      const response = await request(`/rest/v1/${table}?select=*&limit=100`, { bearer: session.access_token });
      const rows = Array.isArray(response.data) ? response.data : [];
      const allowed = table === "profiles"
        ? response.status === 200 && rows.length === 1 && rows[0].id === user.id && rows[0].active === false
        : response.status === 200 && rows.length === 0;
      report.table_matrix.push({ viewer, table, status: response.status, rows: rows.length, ok: allowed });
      observe(`${viewer} tabela ${table}`, allowed, `HTTP ${response.status}, linhas ${rows.length}`);
    }
  }
  record("Inventario REST de 30 tabelas para Joao e Maria", report.table_matrix.length === 60);

  const fingerprintTables = [...portalTables.map((table) => `public.${table}`),
    "private.employee_portal_accounts", "private.employee_identity", "private.employee_identity_audit"];
  const tableFingerprint = () => Object.fromEntries(fingerprintTables.map((table) => [table,
    sql(`select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from ${table} t`)
  ]));
  const beforeRpc = tableFingerprint();
  const rpcSignatures = JSON.parse(sql(`select coalesce(json_agg(json_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.proname,pg_get_function_identity_arguments(p.oid))::text,'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated',p.oid,'EXECUTE')`));
  report.rpc_matrix = [];
  const deniedByGuard = new Set(["not authorized", "admin_required", "forbidden_role",
    "inactive_or_missing_profile", "forbidden", "authentication_required"]);
  const rpcValue = (name, type) => {
    if (type.endsWith("[]")) return [];
    if (type === "jsonb") return name === "p_lines" ? [] : {};
    if (type === "uuid") {
      if (name === "p_employee_id") return joaoEmployee;
      if (name === "p_team_id" || name.includes("team_id")) return teamId;
      if (name === "p_item_id") return itemId;
      if (name === "p_stock_batch_id") return batchId;
      if (name === "p_auth_user_id" || name === "p_user_id") return joao.id;
      if (name === "p_identity_id") return identities.get(maria.id);
      return randomUUID();
    }
    if (type === "integer" || type === "numeric") return 1;
    if (type === "boolean") return true;
    if (type === "date") return "2026-09-01";
    if (type.startsWith("timestamp")) return new Date().toISOString();
    const special = { p_verification_method: "in_person", p_reason: "other", p_expected_employee_name: joao.name,
      p_expected_registration_code: `LAB-J-${runId}`, p_full_name: joao.name, p_role: "worker",
      p_status: "delivered", p_movement_type: "in", p_item_kind: "epi", p_unit: "un",
      p_return_policy: "returnable", p_ownership_type: "owned", p_command: "invalid_lab_command" };
    return special[name] ?? `LAB-DENIED-${runId}`;
  };
  for (const signature of rpcSignatures) {
    const args = Object.fromEntries(signature.args ? signature.args.split(", ").map((arg) => {
      const [name, ...typeWords] = arg.split(" ");
      return [name, rpcValue(name, typeWords.join(" "))];
    }) : []);
    const response = await request(`/rest/v1/rpc/${signature.name}`, { method: "POST", bearer: joaoSession.access_token, body: args });
    let allowed;
    if (signature.name === "my_employee_profile") allowed = response.status === 200 && Array.isArray(response.data) && response.data.length === 1 && response.data[0].employee_id === joaoEmployee;
    // A equipe central desta fixture não possui obra; o RPC pessoal novo deve retornar vazio.
    else if (signature.name === "my_current_work") allowed = response.status === 200 && Array.isArray(response.data) && response.data.length === 0;
    else if (signature.name === "is_active_admin" || signature.name === "can_operate") allowed = response.status === 200 && response.data === false;
    else if (signature.name === "stock_team" || signature.name === "employee_work_team") allowed = response.status === 200 && response.data === null;
    else if (signature.name === "site_dashboard") {
      report.portal_dashboard = response;
      allowed = response.status === 200 && ["works", "teams", "employees", "alerts"].every(key => Array.isArray(response.data?.[key]) && response.data[key].length === 0)
        && Object.values(response.data ?? {}).every(value => Array.isArray(value) && value.length === 0);
      for (const key of ["works", "teams", "employees", "alerts"]) observe(`P4 dashboard.${key} vazio`, Array.isArray(response.data?.[key]) && response.data[key].length === 0);
    }
    else allowed = (response.status === 400 && response.data?.code === "P0001" && deniedByGuard.has(response.data?.message))
      || (response.status === 403 && response.data?.code === "42501")
      || (signature.name === "create_team_admin" && response.status === 300 && response.data?.code === "PGRST203")
      || (signature.name === "set_updated_at" && response.status === 404 && response.data?.code === "PGRST202");
    const coverage = signature.name === "set_updated_at" ? "trigger_nao_chamavel"
      : response.data?.code === "PGRST203" || response.data?.code === "PGRST202" ? "somente_roteamento_PostgREST"
      : response.status === 200 ? "executada"
      : deniedByGuard.has(response.data?.message) ? "bloqueada_por_guarda_SQL"
      : response.data?.code === "42501" ? "bloqueada_por_privilegio_SQL" : "nao_classificada";
    report.rpc_matrix.push({ name: signature.name, args: signature.args, status: response.status, coverage,
      body_exercised: ["executada", "bloqueada_por_guarda_SQL"].includes(coverage),
      code: response.data?.code ?? null, message: response.data?.message ?? null, ok: allowed });
    observe(`Portal RPC ${signature.name}(${signature.args})`, allowed, `HTTP ${response.status}, codigo ${response.data?.code ?? "-"}`);
  }
  const afterRpc = tableFingerprint();
  observe("RPCs do portal nao alteram tabelas publicas ou identidades privadas", fingerprintTables.every((table) => beforeRpc[table] === afterRpc[table]));
  record("Inventario RPC autenticadas executado", report.rpc_matrix.length >= 43, `${report.rpc_matrix.length} assinaturas`);

  const changedId = await request("/rest/v1/rpc/my_employee_profile", { method: "POST", bearer: joaoSession.access_token, body: { p_employee_id: mariaEmployee } });
  report.extra_id_routing = changedId;
  observe("Parametro employee_id inexistente: roteamento PostgREST, nao guarda SQL", changedId.status === 404 && changedId.data?.code === "PGRST202", `HTTP ${changedId.status}, ${changedId.data?.code}`);
  const adminAttempt = await request("/rest/v1/rpc/admin_link_employee_identity", { method: "POST", bearer: joaoSession.access_token, body: { p_auth_user_id: maria.id, p_employee_id: joaoEmployee, p_expected_employee_name: joao.name, p_expected_registration_code: `LAB-J-${runId}`, p_verification_method: "in_person" } });
  observe("Joao nao chama RPC administrativa", adminAttempt.status >= 400, `HTTP ${adminAttempt.status}`);
  for (const [name, args] of [["employee_work_team", { p_employee_id: mariaEmployee }], ["stock_team", { p_team_id: teamId }]]) {
    const response = await request(`/rest/v1/rpc/${name}`, { method: "POST", bearer: joaoSession.access_token, body: args });
    observe(`RPC ${name} nao vaza dados`, response.status === 200 && response.data === null, `HTTP ${response.status}`);
  }

  const [jwtHeader, jwtPayload, jwtSignature] = joaoSession.access_token.split(".");
  const forgedClaims = JSON.parse(Buffer.from(jwtPayload, "base64url").toString("utf8"));
  forgedClaims.sub = maria.id;
  const forgedJwt = `${jwtHeader}.${Buffer.from(JSON.stringify(forgedClaims)).toString("base64url")}.${jwtSignature}`;
  const forgedResponse = await request("/rest/v1/rpc/my_employee_profile", { method: "POST", bearer: forgedJwt, body: {} });
  observe("JWT adulterado recusado pelo PostgREST", forgedResponse.status === 401, `HTTP ${forgedResponse.status}`);
  const activeRefresh = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: joaoSession.refresh_token } });
  observe("Refresh de conta ativa funciona", activeRefresh.status === 200 && Boolean(activeRefresh.data?.access_token), `HTTP ${activeRefresh.status}`);

  for (const table of ["profiles", "teams", "worksites", "items", "inventory", "epi_employees", "epi_items", "epi_deliveries", "supply_orders"]) {
    const response = await request(`/rest/v1/${table}?select=*&limit=100`, { bearer: adminSession.access_token });
    observe(`Gestao continua lendo ${table}`, response.status === 200 && Array.isArray(response.data), `HTTP ${response.status}`);
  }
  const adminFlag = await request("/rest/v1/rpc/is_active_admin", { method: "POST", bearer: adminSession.access_token, body: {} });
  observe("RPC admin da Gestao continua ativa", adminFlag.status === 200 && adminFlag.data === true, `HTTP ${adminFlag.status}`);
  const newTeam = await request("/rest/v1/rpc/create_team_admin", { method: "POST", bearer: adminSession.access_token,
    body: { p_name: `Equipe LAB ${runId}`, p_description: "Teste sintetico", p_location_type: "field" } });
  observe("Gestao cria equipe sintetica via RPC", newTeam.status === 200 && /^[0-9a-f-]{36}$/.test(newTeam.data ?? ""), `HTTP ${newTeam.status}`);
  if (newTeam.status === 200) {
    const updateTeam = await request("/rest/v1/rpc/update_team_admin", { method: "POST", bearer: adminSession.access_token,
      body: { p_team_id: newTeam.data, p_name: `Equipe LAB editada ${runId}`, p_description: "Teste sintetico" } });
    observe("Gestao edita equipe sintetica via RPC", [200, 204].includes(updateTeam.status), `HTTP ${updateTeam.status}`);
  }

  if (process.env.METALLO_TEST_EDGE_FUNCTIONS === "1") {
    const revocationBody = { identity_id: identities.get(revogada.id), reason: "employment_ended" };
    const first = await request("/functions/v1/revoke-portal-account", { method: "POST", bearer: adminSession.access_token, body: revocationBody });
    observe("Edge servidor revoga banco e bloqueia Auth", first.status === 200 && first.data?.auth_user_id === revogada.id, `HTTP ${first.status}`);
    const auditBeforeRetry = sql(`select count(*) from private.employee_identity_audit where identity_id=${literal(identities.get(revogada.id))}::uuid`);
    const retry = await request("/functions/v1/revoke-portal-account", { method: "POST", bearer: adminSession.access_token, body: revocationBody });
    observe("Revogacao pode ser repetida sem novo evento", retry.status === 200 && retry.data?.auth_user_id === revogada.id &&
      sql(`select count(*) from private.employee_identity_audit where identity_id=${literal(identities.get(revogada.id))}::uuid`) === auditBeforeRetry, `HTTP ${retry.status}`);
  } else {
    const revokeResult = await revokePortalAccountLocal({ apiUrl: base, serviceRoleKey: service,
      adminAccessToken: adminSession.access_token, identityId: identities.get(revogada.id), reason: "employment_ended" });
    record("Fluxo servidor revoga banco e bloqueia Auth", revokeResult.databaseRevoked && revokeResult.authBanned && revokeResult.authUserId === revogada.id);
  }
  const oldAccess = await request("/rest/v1/rpc/my_employee_profile", { method: "POST", bearer: revokedSession.access_token, body: {} });
  observe("Token antigo perde acesso pessoal imediato", oldAccess.status === 200 && Array.isArray(oldAccess.data) && oldAccess.data.length === 0, `HTTP ${oldAccess.status}`);
  const refreshed = await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: revokedSession.refresh_token } });
  observe("Refresh da conta revogada bloqueado", refreshed.status >= 400, `HTTP ${refreshed.status}`);
  const newLogin = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: revogada.email, password: revogada.password } });
  observe("Novo login da conta revogada bloqueado", newLogin.status >= 400, `HTTP ${newLogin.status}`);
  if (process.env.METALLO_TEST_EDGE_FUNCTIONS === "1") {
    for (const [name, body] of [
      ["admin-invite-user", {}], ["create-employee", {}], ["delete-employee", { user_id: maria.id }],
      ["revoke-portal-account", { identity_id: identities.get(maria.id), reason: "other" }]
    ]) {
      const response = await request(`/functions/v1/${name}`, { method: "POST", bearer: revokedSession.access_token, body });
      observe(`Edge Function ${name} nega token antigo revogado`, [401, 403].includes(response.status), `HTTP ${response.status}`);
    }
  }
  if (process.env.METALLO_TEST_COMPLEMENTARY === "1") {
    if (process.env.METALLO_TEST_EDGE_FUNCTIONS !== "1") throw new Error("Complementares exigem Edge Functions reais.");
    const { runComplementary } = await import("./executar-provas-complementares.mjs");
    await runComplementary({ request, sql, literal, report, record, observe, createUser, createEmployee,
      admin, adminSession, joao, maria, joaoSession, mariaSession, joaoEmployee, mariaEmployee,
      teamId, itemId, batchId, identities, runId, service });
    if (process.env.METALLO_TEST_MANAGEMENT_SCOPE === '1') {
      const { runManagementScope } = await import('./executar-provas-gestao.mjs');
      await runManagementScope({ request, sql, literal, report, observe, admin, adminSession,
        mariaSession, runId, service });
    }
  }
} catch (error) {
  report.error = String(error.message ?? error);
  process.exitCode = 1;
} finally {
  report.finished_at = new Date().toISOString();
  const evidencePath = process.env.METALLO_EVIDENCE_REVISION === "2f" ? "../laboratorio-marco-2f/base-real.json" : process.env.METALLO_EVIDENCE_REVISION === "2e" ? "../laboratorio-marco-2e/base-real.json" : process.env.METALLO_EVIDENCE_REVISION === "2d" ? "../laboratorio-marco-2d/base-real.json" : process.env.METALLO_EVIDENCE_REVISION === "2b" ? "../laboratorio-marco-2b/base-real.json" :
    process.env.METALLO_EVIDENCE_REVISION === "1c" ? "./marco-1c/base-real.json" :
    process.env.METALLO_EVIDENCE_REVISION === "r2" ? "./saneamento-r2/resultado-provas-reais.json" : "./resultado-provas-reais.json";
  const target = new URL(evidencePath, import.meta.url);
  if(['2d','2e','2f'].includes(process.env.METALLO_EVIDENCE_REVISION) && existsSync(target)) {
    const {previous_runs=[],...previous}=JSON.parse(readFileSync(target,'utf8'));
    report.previous_runs=[...previous_runs,previous];
  }
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
}
