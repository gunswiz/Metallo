// Dados exclusivamente fictícios para a avaliação visual local do Marco 3H.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPreviewAccounts, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

assert.equal(base, "http://127.0.0.1:54321");
const credentials = fileURLToPath(new URL("../../backups/credenciais-previa-3h.json", import.meta.url));
assert.ok(!existsSync(credentials), "Prévia 3H já preparada. Preserve as credenciais locais existentes.");
const { accounts, team: joaoTeam, admin: previewAdmin, adminAccessToken: admin } = await createPreviewAccounts();
const adminId = sql(`select id from public.profiles where role='admin' and active order by created_at desc limit 1`);
const mariaTeam = sql(`insert into public.teams(name,location_type,active)
  values(${quote(`Equipe Maria Prévia 3H ${randomUUID().slice(0,8)}`)},'field',true) returning id`);
const joaoWork = sql(`insert into public.worksites(name,stock_team_id,created_by)
  values(${quote(`Obra João Prévia 3H ${randomUUID().slice(0,8)}`)},${quote(joaoTeam)}::uuid,${quote(adminId)}::uuid) returning id`);
const mariaWork = sql(`insert into public.worksites(name,stock_team_id,created_by)
  values(${quote(`Obra Maria Prévia 3H ${randomUUID().slice(0,8)}`)},${quote(mariaTeam)}::uuid,${quote(adminId)}::uuid) returning id`);
sql(`update public.teams set worksite_id=${quote(joaoWork)}::uuid where id=${quote(joaoTeam)}::uuid`);
sql(`update public.teams set worksite_id=${quote(mariaWork)}::uuid where id=${quote(mariaTeam)}::uuid`);
sql(`update public.epi_employees set team_id=${quote(mariaTeam)}::uuid where id=${quote(accounts.maria.employeeId)}::uuid`);
sql(`update public.epi_employees set team_id=null where id=${quote(accounts.expira.employeeId)}::uuid`);
async function rpc(name, body) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${admin}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const raw = await response.text();
  assert.equal(response.status, 200, `${name}: ${raw.slice(0,200)}`);
  return JSON.parse(raw);
}
async function notice(title, message, audience, target, options = {}) {
  const id = await rpc("save_communication_3h", {
    p_id: null,p_title: title,p_message: message,p_audience: audience,
    p_team_id: audience === "TEAM" ? target : null,p_work_id: audience === "WORK" ? target : null,
    p_pinned: options.pinned ?? false,p_expires_at: options.expiresAt ?? null,
    p_idempotency_key: randomUUID(),p_expected_version: null,
  });
  await rpc("publish_communication_3h", { p_id: id,p_expected_version: 1 });
  return id;
}
const ids = {
  all: await notice("Boas-vindas ao laboratório 3H", "Este é um comunicado de teste.\nNenhum dado real ou aviso oficial está sendo enviado.", "ALL"),
  joaoTeam: await notice("Orientação da equipe de João", "Somente a equipe sintética de João deve receber este aviso.", "TEAM", joaoTeam),
  mariaTeam: await notice("Orientação da equipe de Maria", "Somente a equipe sintética de Maria deve receber este aviso.", "TEAM", mariaTeam),
  joaoWork: await notice("Informação da obra de João", "Somente a obra sintética de João deve receber este aviso.", "WORK", joaoWork),
  pinned: await notice("Aviso fixado de teste", "Este aviso deve permanecer no topo da lista.", "ALL", null, { pinned: true }),
  expiring: await notice("Aviso com expiração de teste", "Este aviso expira amanhã no horário definido pelo servidor.", "ALL", null,
    { expiresAt: new Date(Date.now() + 86400000).toISOString() }),
};
writeFileSync(credentials, JSON.stringify({ note: "SOMENTE LABORATÓRIO LOCAL. Contas fictícias; não incluir em pacotes de auditoria.",
  created_at: new Date().toISOString(), admin: { email: previewAdmin.email,password: previewAdmin.password },
  joao: { email: accounts.joao.email,password: accounts.joao.password },
  maria: { email: accounts.maria.email,password: accounts.maria.password },
  semEquipe: { email: accounts.expira.email,password: accounts.expira.password }, ids }, null, 2) + "\n", { mode: 0o600 });
console.log(`Prévia 3H pronta: 6 comunicados sintéticos. Credenciais ignoradas pelo Git em ${credentials}`);
