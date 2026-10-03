import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const ids = {
  admin: "10000000-0000-4000-8000-000000000011",
  joao: "10000000-0000-4000-8000-000000000012",
  maria: "10000000-0000-4000-8000-000000000013",
  desligada: "10000000-0000-4000-8000-000000000014",
  team: "20000000-0000-4000-8000-000000000011",
  employeeJoao: "40000000-0000-4000-8000-000000000011",
  employeeMaria: "40000000-0000-4000-8000-000000000012",
  employeeDesligada: "40000000-0000-4000-8000-000000000013",
};
let desligadaLink;

async function as(userId) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
}

async function owner() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

async function one(sql, parameters = []) {
  return Object.values((await db.query(sql, parameters)).rows[0])[0];
}

async function link(user, employee, name, registration, method) {
  return one("select public.admin_link_employee_identity($1,$2,$3,$4,$5)", [
    user, employee, name, registration, method,
  ]);
}

before(async () => {
  for (const path of [
    "./fixtures/metallo-0.9.8-schema.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql",
  ]) {
    await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  await db.query(
    `insert into auth.users(id,raw_app_meta_data) values
     ($1,'{}'::jsonb),
     ($2,'{"metallo_account_type":"employee_portal"}'::jsonb),
     ($3,'{"metallo_account_type":"employee_portal"}'::jsonb),
     ($4,'{"metallo_account_type":"employee_portal"}'::jsonb)`,
    [ids.admin, ids.joao, ids.maria, ids.desligada],
  );
  await db.query(
    "insert into public.teams(id,name,location_type) values ($1,'Obra sintética','field')",
    [ids.team],
  );
  await db.query(
    `insert into public.profiles(id, full_name, role, team_id, active) values
     ($1, 'Administrador sintético', 'admin', $5, true),
     ($2, 'João sintético', 'collaborator', $5, false),
     ($3, 'Maria sintética', 'collaborator', $5, false),
     ($4, 'Desligada sintética', 'collaborator', $5, false)`,
    [ids.admin, ids.joao, ids.maria, ids.desligada, ids.team],
  );
  await db.query(
    `insert into public.epi_employees(id, full_name, registration_code, profession, team_id, created_by, aso_exam_date) values
     ($1, 'João sintético', 'J-001', 'Soldador', $4, $5, '2026-01-01'),
     ($2, 'Maria sintética', 'M-002', 'Soldadora', $4, $5, '2026-01-02'),
     ($3, 'Desligada sintética', 'D-003', 'Soldadora', $4, $5, '2026-01-03')`,
    [ids.employeeJoao, ids.employeeMaria, ids.employeeDesligada, ids.team, ids.admin],
  );
});

after(async () => db.close());

test("conta pessoal exige fluxo distinto da Gestão e administrador ativo", async () => {
  await as(ids.joao);
  await assert.rejects(
    db.query("select public.admin_register_portal_account($1)", [ids.joao]),
    /admin_required/,
  );
  await as(ids.admin);
  await assert.rejects(
    db.query("select public.admin_register_portal_account($1)", [ids.admin]),
    /dedicated_portal_account_required/,
  );
  for (const id of [ids.joao, ids.maria, ids.desligada]) {
    await db.query("select public.admin_register_portal_account($1)", [id]);
  }
  await owner(); // Simulates a privileged maintenance path; the DB trigger still applies.
  await assert.rejects(
    db.query("update public.profiles set active=true where id=$1", [ids.joao]),
    /portal_account_cannot_be_management_active/,
  );
});

test("associação exige UUID, nome e matrícula conferidos; anônimo e trabalhador não vinculam", async () => {
  await owner();
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select public.admin_link_employee_identity($1,$2,$3,$4,$5)", [
      ids.joao, ids.employeeJoao, "João sintético", "J-001", "in_person",
    ]),
    /permission denied/,
  );
  await assert.rejects(db.query("select * from public.my_employee_profile()"), /permission denied/);
  await as(ids.joao);
  await assert.rejects(
    link(ids.joao, ids.employeeJoao, "João sintético", "J-001", "in_person"),
    /admin_required/,
  );
  await as(ids.admin);
  for (const args of [
    [ids.joao, ids.employeeJoao, null, "J-001", "in_person"],
    [ids.joao, ids.employeeJoao, "João sintético", null, "in_person"],
    [ids.joao, ids.employeeJoao, "João sintético", "J-001", null],
  ]) {
    await assert.rejects(link(...args), /invalid_identity_request/);
  }
  await assert.rejects(
    link(ids.joao, ids.employeeJoao, "Maria sintética", "J-001", "in_person"),
    /employee_confirmation_mismatch/,
  );
  await assert.rejects(
    link(ids.joao, ids.employeeJoao, "João sintético", "M-002", "in_person"),
    /employee_confirmation_mismatch/,
  );
  await assert.rejects(
    link(ids.admin, ids.employeeJoao, "João sintético", "J-001", "in_person"),
    /registered_portal_account_required/,
  );
  assert.ok(await link(ids.joao, ids.employeeJoao, "João sintético", "J-001", "in_person"));
});

test("uma conta nunca pertence a duas pessoas e empregado tem uma identidade ativa", async () => {
  await as(ids.admin);
  await assert.rejects(
    link(ids.joao, ids.employeeMaria, "Maria sintética", "M-002", "hr_record"),
    /duplicate key/,
  );
  await assert.rejects(
    link(ids.maria, ids.employeeJoao, "João sintético", "J-001", "hr_record"),
    /duplicate key/,
  );
  assert.ok(await link(ids.maria, ids.employeeMaria, "Maria sintética", "M-002", "hr_record"));
  desligadaLink = await link(
    ids.desligada, ids.employeeDesligada, "Desligada sintética", "D-003", "in_person",
  );
});

test("João e Maria com identidade ativa leem somente o próprio DTO sem ASO", async () => {
  for (const [userId, employeeId, name] of [
    [ids.joao, ids.employeeJoao, "João sintético"],
    [ids.maria, ids.employeeMaria, "Maria sintética"],
  ]) {
    await as(userId);
    const rows = (await db.query("select * from public.my_employee_profile()")).rows;
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["employee_id", "full_name", "profession", "team_name"]);
    assert.equal(rows[0].employee_id, employeeId);
    assert.equal(rows[0].full_name, name);
    await assert.rejects(
      db.query("select * from public.my_employee_profile($1)", [
        userId === ids.joao ? ids.employeeMaria : ids.employeeJoao,
      ]),
      /does not exist/,
    );
    assert.equal(await one("select count(*)::int from public.profiles where id <> auth.uid()"), 0);
    assert.equal(await one("select count(*)::int from public.epi_employees"), 0);
    assert.equal(await one("select count(*)::int from public.epi_employees where id=$1", [
      userId === ids.joao ? ids.employeeMaria : ids.employeeJoao,
    ]), 0);
    await assert.rejects(db.query("select * from private.employee_identity"), /permission denied/);
    await assert.rejects(db.query("select * from private.employee_portal_accounts"), /permission denied/);
    await assert.rejects(
      db.query("select public.admin_revoke_employee_identity($1,$2)", [desligadaLink, "other"]),
      /admin_required/,
    );
  }
});

test("portal não usa helpers de equipe alheia nem operações administrativas", async () => {
  await as(ids.joao);
  assert.equal(await one("select public.employee_work_team($1)", [ids.employeeMaria]), null);
  assert.equal(await one("select public.stock_team($1)", [ids.team]), null);
  assert.equal(await one("select public.can_operate('epi:write',$1)", [ids.team]), false);
  const dashboard = await one("select public.site_dashboard()");
  for (const section of ["works", "teams", "employees", "assignments", "epi_items", "batches", "orders", "alerts"]) {
    assert.deepEqual(dashboard[section], [], `site_dashboard.${section} must be empty for portal accounts`);
  }
  await assert.rejects(
    db.query("select public.run_site_operation('noop','{}'::jsonb,gen_random_uuid(),now())"),
    /authentication_required/,
  );
});

test("equipe inativa ausente ou removida preserva perfil pessoal sem dados cruzados", async () => {
  await owner();
  const before = (await db.query("select * from private.employee_identity_audit order by id")).rows;
  const temporaryTeam = await one("insert into public.teams(name,location_type) values ('Equipe temporária sintética','field') returning id");
  try {
    await db.query("update public.epi_employees set team_id=$1 where id=$2", [temporaryTeam, ids.employeeMaria]);
    for (const state of ["ativa", "inativa", "ausente", "removida"]) {
      await owner();
      if (state === "inativa") await db.query("update public.teams set active=false where id=$1", [temporaryTeam]);
      if (state === "ausente") await db.query("update public.epi_employees set team_id=null where id=$1", [ids.employeeMaria]);
      if (state === "removida") await db.query("delete from public.teams where id=$1", [temporaryTeam]);
      await as(ids.maria);
      assert.deepEqual((await db.query("select * from public.my_employee_profile()")).rows, [{
        employee_id: ids.employeeMaria, full_name: "Maria sintética", profession: "Soldadora",
        team_name: state === "ativa" ? "Equipe temporária sintética" : null,
      }]);
      assert.equal(await one("select count(*)::int from public.my_employee_profile() where employee_id=$1", [ids.employeeJoao]), 0);
      assert.equal(await one("select count(*)::int from public.epi_employees"), 0);
      assert.equal(await one("select public.can_operate('epi:write',null)"), false);
      await assert.rejects(db.query("select * from private.employee_identity"), /permission denied/);
    }
    await owner();
    assert.deepEqual((await db.query("select * from private.employee_identity_audit order by id")).rows, before);
    // A FK continua existindo: equipe ausente e NULL, nunca UUID orfao.
    await assert.rejects(db.query("update public.epi_employees set team_id='20000000-0000-4000-8000-000000000099' where id=$1", [ids.employeeMaria]), /foreign key/);
    await db.query("update public.epi_employees set active=false where id=$1", [ids.employeeMaria]);
    await as(ids.maria);
    assert.deepEqual((await db.query("select * from public.my_employee_profile()")).rows, []);
  } finally {
    await owner();
    await db.query("update public.epi_employees set active=true,team_id=$1 where id=$2", [ids.team, ids.employeeMaria]);
    await db.query("delete from public.teams where id=$1", [temporaryTeam]);
  }
});

test("identidade revogada sem equipe nega DTO ao mesmo token antigo e conserva auditoria", async () => {
  await owner();
  await db.query("update public.epi_employees set team_id=null where id=$1", [ids.employeeDesligada]);
  await as(ids.desligada);
  assert.equal((await db.query("select * from public.my_employee_profile()")).rows.length, 1);
  await as(ids.admin);
  await db.query("select public.admin_revoke_employee_identity($1,$2)", [
    desligadaLink, "employment_ended",
  ]);
  await as(ids.desligada); // Same authenticated subject simulates an unexpired old JWT.
  assert.equal((await db.query("select * from public.my_employee_profile()")).rows.length, 0);
  assert.equal(await one("select count(*)::int from public.epi_employees"), 0);
  await owner();
  assert.equal(await one("select status from private.employee_identity where id=$1", [desligadaLink]), "revoked");
  assert.deepEqual(
    (await db.query("select auth_user_id,employee_id,status from private.employee_identity_audit where identity_id=$1 order by event_at", [desligadaLink])).rows.map(({ auth_user_id, employee_id, status }) => [auth_user_id, employee_id, status]),
    [[ids.desligada, ids.employeeDesligada, "active"], [ids.desligada, ids.employeeDesligada, "revoked"]],
  );
  await assert.rejects(
    db.query("delete from private.employee_identity where id=$1", [desligadaLink]),
    /identity_history_is_immutable/,
  );
  await assert.rejects(
    db.query("update private.employee_identity_audit set reason='other' where identity_id=$1", [desligadaLink]),
    /identity_audit_is_immutable/,
  );
  await as(ids.admin);
  await assert.rejects(
    link(ids.desligada, ids.employeeDesligada, "Desligada sintética", "D-003", "hr_record"),
    /duplicate key/,
  );
});

test("administrador da Gestão mantém permissão e helpers existentes", async () => {
  await as(ids.admin);
  assert.equal(await one("select public.can_operate('epi:write',$1)", [ids.team]), true);
  assert.equal(await one("select public.stock_team($1)", [ids.team]), ids.team);
  assert.equal(await one("select public.employee_work_team($1)", [ids.employeeMaria]), ids.team);
  assert.equal(await one("select count(*)::int from public.epi_employees"), 3);
});
