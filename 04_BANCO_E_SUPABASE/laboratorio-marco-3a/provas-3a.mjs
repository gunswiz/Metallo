// Ensaios reais locais: GoTrue, JWT e PostgREST. Não acessa projeto remoto.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPreviewAccounts, revokePreviewAccount, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const evidence = { at: new Date().toISOString(), scope: "Marco 3A local sintético", checks: [], http_samples: [] };
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
  return session.data.access_token;
}
const teamRpc = (token, body = {}, query = "") => request(`/rest/v1/rpc/my_team_summary${query}`, token, body);
const profileRpc = token => request("/rest/v1/rpc/my_employee_profile", token);
const workRpc = token => request("/rest/v1/rpc/my_current_work", token);
const catalog = sql("select prosecdef, coalesce('search_path=\"\"'=any(proconfig),false), has_function_privilege('anon','public.my_team_summary()','EXECUTE'), has_function_privilege('authenticated','public.my_team_summary()','EXECUTE') from pg_proc where oid='public.my_team_summary()'::regprocedure").split("|");
check("RPC é SECURITY DEFINER e sem argumentos", catalog.length === 4 && catalog[0] === "t");
check("RPC fixa search_path vazio", catalog[1] === "t");
check("anon sem EXECUTE, authenticated com EXECUTE", catalog[2] === "f" && catalog[3] === "t");
const overloads = sql("select count(*), min(pronargs), max(pronargs) from pg_proc where pronamespace='public'::regnamespace and proname='my_team_summary'").split("|");
check("existe só a RPC pessoal sem argumentos", overloads.length === 3 && overloads.every(value => value === "1" || value === "0") && overloads.join("|") === "1|0|0");
evidence.rls_policies = JSON.parse(sql("select coalesce(json_agg(json_build_object('table', tablename, 'name', policyname, 'roles', roles, 'command', cmd, 'condition', qual) order by tablename, policyname), '[]'::json)::text from pg_policies where schemaname='public' and tablename in ('epi_employees','teams','employee_assignments','worksites')"));
const rlsEnabled = sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('epi_employees','teams','employee_assignments','worksites') and c.relrowsecurity");
check("RLS ativo nas quatro tabelas operacionais", rlsEnabled === "4" && ["epi_employees", "teams", "employee_assignments", "worksites"].every(table => evidence.rls_policies.some(policy => policy.table === table && policy.command === "SELECT")));
const { accounts, team: teamA, adminAccessToken } = await createPreviewAccounts();
const joao = await login(accounts.joao), maria = await login(accounts.maria);
const teamBName = `Equipe B 3A sintética ${Date.now()}`;
const teamB = sql(`insert into public.teams(name,location_type,active) values(${quote(teamBName)},'field',true) returning id`);
sql(`update public.epi_employees set team_id=${quote(teamB)}::uuid where id=${quote(accounts.maria.employeeId)}::uuid`);
const workA = sql(`insert into public.worksites(name,stock_team_id,created_by) values('Obra A 3A sintética',${quote(teamA)}::uuid,${quote(accounts.joao.id)}::uuid) returning id`);
const workB = sql(`insert into public.worksites(name,stock_team_id,created_by) values('Obra B 3A sintética',${quote(teamB)}::uuid,${quote(accounts.joao.id)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(workA)}::uuid where id=${quote(teamA)}::uuid`);
sql(`update public.teams set worksite_id=${quote(workB)}::uuid where id=${quote(teamB)}::uuid`);
const colleagueA = sql(`insert into public.epi_employees(full_name,profession,team_id,created_by) values('Colega A 3A','Montador',${quote(teamA)}::uuid,${quote(accounts.joao.id)}::uuid) returning id`);
const colleagueB = sql(`insert into public.epi_employees(full_name,profession,team_id,created_by) values('Colega B 3A','Caldeireiro',${quote(teamB)}::uuid,${quote(accounts.joao.id)}::uuid) returning id`);
sql(`insert into public.epi_employees(full_name,profession,team_id,created_by) values('Colega Sem Função 3A','  ',${quote(teamA)}::uuid,${quote(accounts.joao.id)}::uuid)`);
sql(`insert into public.epi_employees(full_name,profession,team_id,created_by,active) values('Colega Inativo 3A','Teste',${quote(teamA)}::uuid,${quote(accounts.joao.id)}::uuid,false)`);

let j = await teamRpc(joao), m = await teamRpc(maria);
check("João vê uma equipe própria", j.status === 200 && j.data.length === 1 && j.data[0].team_name.includes("Equipe Prévia"));
check("Maria vê a equipe B", m.status === 200 && m.data.length === 1 && m.data[0].team_name === teamBName);
check("João não recebe Maria nem colega B", !JSON.stringify(j.data).includes(accounts.maria.name) && !JSON.stringify(j.data).includes("Colega B 3A"));
check("Maria não recebe João nem colega A", !JSON.stringify(m.data).includes(accounts.joao.name) && !JSON.stringify(m.data).includes("Colega A 3A"));
check("integrantes ativos mínimos de João", j.data[0].members.some(x => x.name === "Colega A 3A" && x.profession === "Montador") && !JSON.stringify(j.data).includes("Colega Inativo 3A"));
check("integrantes ativos mínimos de Maria", m.data[0].members.some(x => x.name === "Colega B 3A" && x.profession === "Caldeireiro"));
check("função em branco vira rótulo válido no DTO", j.data[0].members.some(x => x.name === "Colega Sem Função 3A" && x.profession === "Função não informada"));
evidence.http_samples.push({ case: "João equipe", status: j.status, dto: j.data });
evidence.http_samples.push({ case: "Maria equipe", status: m.status, dto: m.data });
check("nenhum campo pessoal proibido no DTO", [j, m].every(r => Object.keys(r.data[0]).sort().join() === "member_count,members,team_name,work_name" && r.data[0].members.every(x => Object.keys(x).sort().join() === "name,profession")));
check("contagem equivale à lista filtrada", [j, m].every(r => r.data[0].member_count === r.data[0].members.length));
check("obra da equipe coincide com Minha Obra pessoal", (await workRpc(joao)).data[0].work_name === j.data[0].work_name && (await workRpc(maria)).data[0].work_name === m.data[0].work_name);
check("perfil mínimo continua próprio", (await profileRpc(joao)).data[0].employee_id === accounts.joao.employeeId && (await profileRpc(maria)).data[0].employee_id === accounts.maria.employeeId);
const extraTeam = await teamRpc(joao, { team_id: teamB });
check("RPC recusa team_id injetado", extraTeam.status >= 400 && !JSON.stringify(extraTeam.data).includes("Colega B 3A"));
const extraEmployee = await teamRpc(joao, { employee_id: accounts.maria.employeeId });
check("RPC recusa employee_id injetado", extraEmployee.status >= 400 && !JSON.stringify(extraEmployee.data).includes("Colega B 3A"));
const mariaTeamInjection = await teamRpc(maria, { team_id: teamA, employee_id: accounts.joao.employeeId });
check("Maria não escolhe equipe ou funcionário de João pelo body", mariaTeamInjection.status >= 400 && !JSON.stringify(mariaTeamInjection.data).includes("Colega A 3A"));
const filtered = await teamRpc(joao, {}, `?team_name=eq.${encodeURIComponent(teamBName)}`);
check("querystring não troca equipe", filtered.status === 200 && filtered.data.length === 0);
const mariaFiltered = await teamRpc(maria, {}, `?team_name=eq.${encodeURIComponent(j.data[0].team_name)}`);
check("Maria não alcança equipe de João pela querystring", mariaFiltered.status === 200 && mariaFiltered.data.length === 0);
const directEmployees = await request(`/rest/v1/epi_employees?select=id,full_name&id=eq.${accounts.maria.employeeId}`, joao, undefined, "GET");
check("João não lê Maria pela tabela operacional", directEmployees.status >= 400 || (Array.isArray(directEmployees.data) && directEmployees.data.length === 0));
const directTeams = await request(`/rest/v1/teams?select=id,name&id=eq.${teamB}`, joao, undefined, "GET");
check("João não lê equipe de Maria pela tabela operacional", directTeams.status >= 400 || (Array.isArray(directTeams.data) && directTeams.data.length === 0));
for (const [actor, token] of [["João", joao], ["Maria", maria], ["anon", anon]]) {
  for (const table of ["epi_employees", "teams", "employee_assignments", "worksites"]) {
    const direct = await request(`/rest/v1/${table}?select=*`, token, undefined, "GET");
    evidence.http_samples.push({ case: `${actor} GET ${table} select=*`, status: direct.status,
      row_count: Array.isArray(direct.data) ? direct.data.length : null });
    check(`${actor} não lê linhas operacionais em ${table} select=*`, direct.status >= 400 || (Array.isArray(direct.data) && direct.data.length === 0));
  }
}
const adminOperations = await request("/rest/v1/epi_employees?select=id&limit=1", adminAccessToken, undefined, "GET");
check("admin Gestão preserva leitura operacional autorizada", adminOperations.status === 200 && Array.isArray(adminOperations.data) && adminOperations.data.length === 1);
evidence.http_samples.push({ case: "admin Gestão GET epi_employees select=id", status: adminOperations.status, row_count: adminOperations.data.length });
check("admin Gestão não recebe equipe pessoal", (await teamRpc(adminAccessToken)).data.length === 0);
check("anon não executa RPC", (await teamRpc(anon)).status >= 400);
const revokedLogin = await request("/auth/v1/token?grant_type=password", anon, { email: accounts.revogada.email, password: accounts.revogada.password });
check("revogada não consegue novo login", revokedLogin.status >= 400);

sql(`update public.epi_employees set team_id=null where id=${quote(accounts.joao.employeeId)}::uuid`);
j = await teamRpc(joao);
check("sem equipe mantém perfil e esvazia Equipe", j.status === 200 && j.data.length === 0 && (await profileRpc(joao)).data.length === 1);
check("sem equipe mantém Minha Obra vazia", (await workRpc(joao)).data.length === 0);
sql(`update public.epi_employees set team_id=${quote(teamA)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
sql(`update public.teams set active=false where id=${quote(teamA)}::uuid`);
check("equipe inativa não mostra colegas e não revoga perfil", (await teamRpc(joao)).data.length === 0 && (await profileRpc(joao)).data.length === 1);
sql(`update public.teams set active=true where id=${quote(teamA)}::uuid`);
sql(`update public.epi_employees set team_id=${quote(teamB)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
j = await teamRpc(joao);
check("troca A→B não mantém colegas da A", j.data[0].team_name === teamBName && !JSON.stringify(j.data).includes("Colega A 3A") && JSON.stringify(j.data).includes("Colega B 3A"));
check("troca A→B atualiza obra pelo mesmo contrato 1C", (await workRpc(joao)).data[0].work_name === j.data[0].work_name);

sql(`update public.epi_employees set team_id=${quote(teamA)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values(${quote(accounts.joao.employeeId)}::uuid,${quote(teamA)}::uuid,now()-interval '2 hours',${quote(accounts.joao.id)}::uuid)`);
sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values(${quote(accounts.joao.employeeId)}::uuid,${quote(teamB)}::uuid,now()-interval '1 hour',${quote(accounts.joao.id)}::uuid)`);
check("vínculo ativo ambíguo falha sem revelar equipe", (await teamRpc(joao)).data.length === 0 && (await workRpc(joao)).data.length === 0);
sql(`update public.employee_assignments set ends_at=now()-interval '1 minute' where employee_id=${quote(accounts.joao.employeeId)}::uuid`);
check("vínculo encerrado não restaura equipe antiga", (await teamRpc(joao)).data.length === 0);
sql(`update public.epi_employees set active=false where id=${quote(accounts.maria.employeeId)}::uuid`);
check("funcionária inativa não recebe equipe", (await teamRpc(maria)).data.length === 0);
await revokePreviewAccount(accounts.joao.identityId, adminAccessToken);
check("token residual revogado não recebe equipe", (await teamRpc(joao)).data.length === 0);
check("token residual revogado não recebe perfil", (await profileRpc(joao)).data.length === 0);

writeFileSync(fileURLToPath(new URL("./resultado-3a.json", import.meta.url)), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ passed: evidence.checks.length, total: evidence.checks.length, scope: evidence.scope }));
