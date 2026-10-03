// Auth/JWT/PostgREST/RPC reais, contas e dados exclusivamente sintéticos locais.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPreviewAccounts, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const result = { scope: "Marco 3H — laboratório local sintético", at: new Date().toISOString(), checks: [] };
function check(name, condition) { const ok = Boolean(condition); result.checks.push({ name, ok }); assert.ok(ok, name); }
async function call(path, token, body, method = "POST") {
  const response = await fetch(`${base}${path}`, { method, headers: { apikey: anon,
    Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
const rpc = (name, token, body = {}) => call(`/rest/v1/rpc/${name}`, token, body);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon,
    { email: account.email, password: account.password });
  assert.equal(response.status, 200, `login ${account.name}`); return response.data.access_token;
}
const key = () => randomUUID();
function payload(title, audience = "ALL", targetId = null, idempotencyKey = key()) {
  return { p_id: null, p_title: title, p_message: `Mensagem sintética: ${title}`,
    p_audience: audience, p_team_id: audience === "TEAM" ? targetId : null,
    p_work_id: audience === "WORK" ? targetId : null, p_pinned: false,
    p_expires_at: null, p_idempotency_key: idempotencyKey, p_expected_version: null };
}
async function create(token, data) {
  const response = await rpc("save_communication_3h", token, data);
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data;
}
async function publish(token, id, version = 1) {
  const response = await rpc("publish_communication_3h", token, { p_id: id, p_expected_version: version });
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response;
}
async function list(token, unreadOnly = false, limit = 30, offset = 0) {
  const response = await rpc("my_communications_3h", token,
    { p_unread_only: unreadOnly, p_limit: limit, p_offset: offset });
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data;
}
const visible = (rows, id) => rows.some(row => row.id === id);

const { accounts, team: joaoTeam, admin: adminUser, adminAccessToken: admin } = await createPreviewAccounts();
const adminId = sql(`select id from public.profiles where role='admin' and active order by created_at desc limit 1`);
const mariaTeam = sql(`insert into public.teams(name,location_type,active) values(${quote(`Equipe Maria 3H ${key().slice(0,8)}`)},'field',true) returning id`);
const joaoWork = sql(`insert into public.worksites(name,stock_team_id,created_by) values(${quote(`Obra João 3H ${key().slice(0,8)}`)},${quote(joaoTeam)}::uuid,${quote(adminId)}::uuid) returning id`);
const mariaWork = sql(`insert into public.worksites(name,stock_team_id,created_by) values(${quote(`Obra Maria 3H ${key().slice(0,8)}`)},${quote(mariaTeam)}::uuid,${quote(adminId)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(joaoWork)}::uuid where id=${quote(joaoTeam)}::uuid`);
sql(`update public.teams set worksite_id=${quote(mariaWork)}::uuid where id=${quote(mariaTeam)}::uuid`);
sql(`update public.epi_employees set team_id=${quote(mariaTeam)}::uuid where id=${quote(accounts.maria.employeeId)}::uuid`);
sql(`update public.epi_employees set team_id=null where id=${quote(accounts.expira.employeeId)}::uuid`);
const joao = await login(accounts.joao), maria = await login(accounts.maria), noTeam = await login(accounts.expira), inactive = await login(accounts.inativo);

try {
  const draftPayload = payload("Rascunho sintético 3H");
  const draft = await create(admin, draftPayload);
  check("A: criar rascunho", /^[0-9a-f-]{36}$/i.test(draft));
  check("rascunho não aparece ao funcionário", !visible(await list(joao), draft));
  check("idempotência de criação", (await create(admin, draftPayload)) === draft);
  check("título vazio recusado", (await rpc("save_communication_3h", admin, { ...payload("   ") })).status >= 400);
  check("mensagem vazia recusada", (await rpc("save_communication_3h", admin, { ...payload("Título"), p_message: "  " })).status >= 400);
  check("HTML/script recusado", (await rpc("save_communication_3h", admin, { ...payload("XSS"), p_message: "<script>alert(1)</script>" })).status >= 400);
  const htmlTitle = await rpc("save_communication_3h", admin, { ...payload("Título"), p_title: "<b>x</b>" });
  check("F02: título HTML recusado pela RPC", htmlTitle.status >= 400 && htmlTitle.data.message === "invalid_communication_text");
  check("título longo recusado", (await rpc("save_communication_3h", admin, payload("A".repeat(121)))).status >= 400);
  check("mensagem longa recusada", (await rpc("save_communication_3h", admin, { ...payload("Longa"), p_message: "A".repeat(4001) })).status >= 400);
  check("funcionário não cria", (await rpc("save_communication_3h", joao, payload("Invasão"))).status >= 400);
  check("funcionário não publica", (await rpc("publish_communication_3h", joao, { p_id: draft, p_expected_version: 1 })).status >= 400);
  check("público inválido recusado", (await rpc("save_communication_3h", admin, payload("Inválido", "TEAM", key()))).status >= 400);
  await publish(admin, draft);
  check("D: publicado para Todos", visible(await list(joao), draft) && visible(await list(maria), draft));
  check("funcionário sem equipe vê Todos", visible(await list(noTeam), draft));
  check("inativo não lista", (await rpc("my_communications_3h", inactive, {})).status >= 400);
  const joaoTeamId = await create(admin, payload("Equipe João", "TEAM", joaoTeam)); await publish(admin, joaoTeamId);
  const mariaTeamId = await create(admin, payload("Equipe Maria", "TEAM", mariaTeam)); await publish(admin, mariaTeamId);
  const joaoWorkId = await create(admin, payload("Obra João", "WORK", joaoWork)); await publish(admin, joaoWorkId);
  const mariaWorkId = await create(admin, payload("Obra Maria", "WORK", mariaWork)); await publish(admin, mariaWorkId);
  const jl = await list(joao), ml = await list(maria), nl = await list(noTeam);
  check("Equipe João isolada", visible(jl, joaoTeamId) && !visible(ml, joaoTeamId));
  check("Equipe Maria isolada", visible(ml, mariaTeamId) && !visible(jl, mariaTeamId));
  check("Obra João isolada", visible(jl, joaoWorkId) && !visible(ml, joaoWorkId));
  check("Obra Maria isolada", visible(ml, mariaWorkId) && !visible(jl, mariaWorkId));
  check("sem equipe não vê públicos específicos", !visible(nl, joaoTeamId) && !visible(nl, joaoWorkId));
  check("IDOR João→Maria", (await rpc("open_communication_3h", joao, { p_id: mariaTeamId })).status >= 400);
  check("IDOR Maria→João", (await rpc("open_communication_3h", maria, { p_id: joaoWorkId })).status >= 400);
  check("team_id injetado não concede acesso", (await rpc("my_communications_3h", maria, { p_team_id: joaoTeam })).status >= 400);
  check("work_id injetado não concede acesso", (await rpc("my_communications_3h", maria, { p_work_id: joaoWork })).status >= 400);
  check("F10: João não lista por employee_id da Maria", (await rpc("my_communications_3h", joao, { p_employee_id: accounts.maria.employeeId })).status >= 400);
  check("F10: João não abre por employee_id da Maria", (await rpc("open_communication_3h", joao, { p_id: draft, p_employee_id: accounts.maria.employeeId })).status >= 400);
  check("F10: view_id injetado é recusado", (await rpc("open_communication_3h", joao, { p_id: draft, p_view_id: key() })).status >= 400);
  check("F10: target_id injetado é recusado", (await rpc("open_communication_3h", joao, { p_id: mariaTeamId, p_target_id: accounts.maria.employeeId })).status >= 400);
  check("F10: tentativas não registram visualização da Maria", Number(sql(`select count(*) from private.communication_views_3h where employee_id=${quote(accounts.maria.employeeId)}::uuid`)) === 0);
  check("tabela privada não exposta pelo PostgREST", (await call("/rest/v1/communications_3h?select=*", joao, undefined, "GET")).status >= 400);
  const opened = await rpc("open_communication_3h", joao, { p_id: draft });
  check("abertura retorna mensagem", opened.status === 200 && opened.data.message.includes("sintética"));
  check("primeira abertura registra viewed_at", !!opened.data.first_viewed_at);
  check("não lidos remove aberto", !visible(await list(joao, true), draft));
  check("Todos mantém aberto", visible(await list(joao, false), draft));
  const again = await rpc("open_communication_3h", joao, { p_id: draft });
  check("reabertura preserva primeira hora", again.data.first_viewed_at === opened.data.first_viewed_at);
  await Promise.all([rpc("open_communication_3h", joao, { p_id: joaoTeamId }), rpc("open_communication_3h", joao, { p_id: joaoTeamId })]);
  check("duas abas geram uma visualização", Number(sql(`select count(*) from private.communication_views_3h where communication_id=${quote(joaoTeamId)}::uuid and employee_id=${quote(accounts.joao.employeeId)}::uuid`)) === 1);
  const pinnedPayload = { ...payload("Fixado 3H"), p_pinned: true };
  const pinned = await create(admin, pinnedPayload); await publish(admin, pinned);
  check("fixado ordenado acima", (await list(joao))[0]?.id === pinned);
  const future = new Date(Date.now() + 86400000).toISOString();
  const expiryPayload = { ...payload("Fuso Fortaleza 3H"), p_expires_at: "2035-09-30T18:00:00-03:00" };
  const timezoneNotice = await create(admin, expiryPayload);
  check("F01: banco guarda 18h Fortaleza como 21h UTC", sql(`select extract(epoch from expires_at)::bigint from private.communications_3h where id=${quote(timezoneNotice)}::uuid`) === String(Date.parse("2035-09-30T21:00:00Z") / 1000));
  await rpc("save_communication_3h", admin, { ...expiryPayload, p_id: timezoneNotice, p_expires_at: "2035-09-30T21:00:00.000Z", p_expected_version: 1 });
  check("F01: correção conserva o instante de expiração", sql(`select extract(epoch from expires_at)::bigint from private.communications_3h where id=${quote(timezoneNotice)}::uuid`) === String(Date.parse("2035-09-30T21:00:00Z") / 1000));
  const expiring = await create(admin, { ...payload("Expiração 3H"), p_expires_at: future }); await publish(admin, expiring);
  check("antes da expiração aparece", visible(await list(joao), expiring));
  await rpc("open_communication_3h", joao, { p_id: expiring });
  sql(`update private.communications_3h set expires_at=now()-interval '1 second' where id=${quote(expiring)}::uuid`);
  check("depois da expiração desaparece", !visible(await list(joao), expiring));
  check("expiração preserva visualização", Number(sql(`select count(*) from private.communication_views_3h where communication_id=${quote(expiring)}::uuid`)) === 1);
  const revision = await rpc("save_communication_3h", admin, { ...draftPayload, p_id: draft,
    p_title: "Rascunho sintético corrigido", p_idempotency_key: key(), p_expected_version: 2 });
  check("correção publicada autorizada", revision.status === 200 && revision.data === draft);
  const corrected = await rpc("open_communication_3h", joao, { p_id: draft });
  check("correção visível com versão e data", corrected.data.version === 3 && !!corrected.data.updated_at);
  check("revisão append-only preserva anterior", Number(sql(`select count(*) from private.communication_revisions_3h where communication_id=${quote(draft)}::uuid`)) === 3);
  check("troca silenciosa do público negada", (await rpc("save_communication_3h", admin,
    { ...draftPayload, p_id: draft, p_audience: "TEAM", p_team_id: joaoTeam, p_expected_version: 3 })).status >= 400);
  const correctionPayload = { ...draftPayload, p_id: draft, p_title: "Correção concorrente", p_expected_version: 3 };
  const simultaneous = await Promise.all([rpc("save_communication_3h", admin, correctionPayload), rpc("save_communication_3h", admin, correctionPayload)]);
  check("F04: correção concorrente tem um sucesso e um conflito explícito", simultaneous.filter(r => r.status === 200).length === 1 && simultaneous.filter(r => r.status >= 400 && r.data.message === "communication_version_conflict").length === 1);
  check("F04: correção concorrente não cria revisão extra", Number(sql(`select count(*) from private.communication_revisions_3h where communication_id=${quote(draft)}::uuid`)) === 4);
  const archived = await rpc("archive_communication_3h", admin, { p_id: draft, p_expected_version: 4 });
  check("arquivamento autorizado", archived.status === 200);
  check("arquivado não abre nem lista", !visible(await list(joao), draft) && (await rpc("open_communication_3h", joao, { p_id: draft })).status >= 400);
  check("arquivamento preserva histórico", Number(sql(`select count(*) from private.communication_views_3h where communication_id=${quote(draft)}::uuid`)) === 1);
  check("funcionário não arquiva", (await rpc("archive_communication_3h", maria, { p_id: joaoTeamId, p_expected_version: 2 })).status >= 400);
  check("paginação limita resultado", (await list(joao, false, 1)).length === 1 && (await list(joao, false, 1, 1)).length === 1);
  check("limite excessivo recusado", (await rpc("my_communications_3h", joao, { p_limit: 1000 })).status >= 400);
  const summary = await rpc("admin_communications_3h", admin, { p_limit: 20, p_offset: 0 });
  check("Gestão vê resumo sem lista nominal", summary.status === 200 && summary.data.some(row => row.id === joaoTeamId && row.recipient_count >= 1 && row.viewed_count >= 1));
  check("funcionário não vê resumo Gestão", (await rpc("admin_communications_3h", joao, {})).status >= 400);
  sql(`update public.epi_employees set team_id=${quote(mariaTeam)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
  check("mudança de equipe revoga acesso anterior", !visible(await list(joao), joaoTeamId) && !visible(await list(joao), joaoWorkId));
  check("mudança de equipe revoga ID direto", (await rpc("open_communication_3h", joao, { p_id: joaoTeamId })).status >= 400);
  check("novo público atual passa a aparecer", visible(await list(joao), mariaTeamId));
  sql(`update public.epi_employees set team_id=${quote(joaoTeam)}::uuid where id=${quote(accounts.joao.employeeId)}::uuid`);
  const assignment1 = sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values(${quote(accounts.joao.employeeId)}::uuid,${quote(joaoTeam)}::uuid,now()-interval '1 day',${quote(adminId)}::uuid) returning id`);
  const assignment2 = sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values(${quote(accounts.joao.employeeId)}::uuid,${quote(mariaTeam)}::uuid,now()-interval '1 day',${quote(adminId)}::uuid) returning id`);
  check("vínculo ambíguo falha seguro", !visible(await list(joao), joaoTeamId) && !visible(await list(joao), mariaTeamId) && visible(await list(joao), pinned));
  sql(`update public.employee_assignments set ends_at=now()-interval '1 minute' where id in (${quote(assignment1)}::uuid,${quote(assignment2)}::uuid)`);
  check("vínculo encerrado falha seguro", !visible(await list(joao), joaoTeamId) && visible(await list(joao), pinned));
  check("sem equipe continua no portal", (await rpc("my_employee_profile", noTeam, {})).status === 200);
  const doubled = payload("Duplo clique 3H");
  const concurrent = await Promise.all([rpc("save_communication_3h", admin, doubled),rpc("save_communication_3h", admin, doubled)]);
  check("duplo clique não duplica comunicado", concurrent.every(value => value.status === 200 && value.data === concurrent[0].data));
  await Promise.all([publish(admin, concurrent[0].data),publish(admin, concurrent[0].data)]);
  check("dupla publicação não duplica evento", Number(sql(`select count(*) from private.communication_revisions_3h where communication_id=${quote(concurrent[0].data)}::uuid and event='PUBLISHED'`)) === 1);
  sql(`update public.profiles set role='engineer' where id=${quote(adminUser.id)}::uuid`);
  try {
    check("Gestão engenheiro não cria", (await rpc("save_communication_3h", admin, payload("Sem permissão"))).status >= 400);
    check("Gestão engenheiro não publica", (await rpc("publish_communication_3h", admin, { p_id: joaoTeamId,p_expected_version: 2 })).status >= 400);
    check("Gestão engenheiro não arquiva", (await rpc("archive_communication_3h", admin, { p_id: joaoTeamId,p_expected_version: 2 })).status >= 400);
    check("Gestão engenheiro não recebe resumo", (await rpc("admin_communications_3h", admin, {})).status >= 400);
  } finally { sql(`update public.profiles set role='admin' where id=${quote(adminUser.id)}::uuid`); }
  const revoked = await rpc("admin_revoke_employee_identity", admin, { p_identity_id: accounts.joao.identityId, p_reason: "other" });
  assert.equal(revoked.status, 200);
  check("identidade revogada com JWT antigo não lista comunicados", (await rpc("my_communications_3h", joao, {})).status >= 400);
  check("identidade revogada com JWT antigo não abre comunicado", (await rpc("open_communication_3h", joao, { p_id: pinned })).status >= 400);
  const createdIds = [draft,joaoTeamId,mariaTeamId,joaoWorkId,mariaWorkId,pinned,expiring,timezoneNotice,concurrent[0].data];
  const idsSql = createdIds.map(id => `${quote(id)}::uuid`).join(",");
  sql(`delete from private.communication_views_3h where communication_id in (${idsSql})`);
  sql(`delete from private.communication_revisions_3h where communication_id in (${idsSql})`);
  sql(`delete from private.communications_3h where id in (${idsSql})`);
  writeFileSync(new URL("./resultado-3h.json", import.meta.url), JSON.stringify({ ...result, passed: result.checks.length, failed: 0 }, null, 2) + "\n");
  console.log(`Marco 3H: ${result.checks.length}/${result.checks.length} verificações reais; Auth/JWT/PostgREST/RPC locais.`);
} catch (error) {
  writeFileSync(new URL("./resultado-3h.json", import.meta.url), JSON.stringify({ ...result, failed: 1, error: String(error) }, null, 2) + "\n");
  throw error;
}
