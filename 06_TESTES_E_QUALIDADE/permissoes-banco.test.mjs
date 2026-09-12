import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const uid = "10000000-0000-4000-8000-000000000001";
const leader = "10000000-0000-4000-8000-000000000002";
const team = "20000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const item = "30000000-0000-4000-8000-000000000001";
const epi = "30000000-0000-4000-8000-000000000002";
const employee = "40000000-0000-4000-8000-000000000001";
const employeeOther = "40000000-0000-4000-8000-000000000002";
const batch = "50000000-0000-4000-8000-000000000001";
async function actor(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
before(async () => {
  await db.exec(
    await readFile(
      new URL("./fixtures/metallo-0.9.8-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values($1),($2)", [uid, leader]);
  await db.query(
    "insert into public.teams(id,name,location_type) values($1,'Obra A','field'),($2,'Obra B','field')",
    [team, other],
  );
  await db.query(
    "insert into public.profiles(id,full_name,role,team_id,active) values($1,'ADM Teste','admin',$3,true),($2,'Encarregado Teste','leader',$3,true)",
    [uid, leader, team],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.query(
    "insert into public.items(id,code,name,item_type,unit) values($1,'MAT-TEST','Material de teste','material','un')",
    [item],
  );
  await db.query(
    "insert into public.inventory(item_id,team_id,quantity) values($1,$2,10),($1,$3,10)",
    [item, team, other],
  );
  await db.query(
    "insert into public.epi_items(id,code,name,item_kind) values($1,'EPI-TEST','EPI de teste','epi')",
    [epi],
  );
  await db.query(
    "insert into public.epi_employees(id,full_name,profession,team_id,created_by) values($1,'Funcionário Teste','Soldador',$3,$5),($2,'Funcionário Outro','Soldador',$4,$5)",
    [employee, employeeOther, team, other, uid],
  );
  await db.query(
    "insert into public.epi_stock_batches(id,item_id,quantity,ca_number,created_by) values($1,$2,10,'12345',$3)",
    [batch, epi, uid],
  );
});
after(async () => {
  await db.close();
});
test("preserva direitos anteriores e impede operação fora da equipe", async () => {
  await actor(leader);
  assert.equal(
    await scalar("select public.can_operate('consumption:write',$1)", [team]),
    true,
  );
  assert.equal(
    await scalar("select public.can_operate('epi:write',$1)", [team]),
    false,
  );
  await assert.rejects(
    db.query("select public.consume_material($1,$2,1)", [item, other]),
    /forbidden_team/,
  );
});
test("operador não pode alterar o próprio acesso nem promover usuários", async () => {
  await actor(leader);
  await assert.rejects(
    db.query(
      "select public.admin_update_profile_access($1,'Escalada','admin',$2,true,null,null)",
      [leader, team],
    ),
    /admin_required/,
  );
  await assert.rejects(
    db.query(
      "update public.profiles set operation_permissions=array['epi:write'] where id=$1",
      [leader],
    ),
    /permission denied/,
  );
});
test("ADM concede EPI sem alterar cargo e a entrega mantém C.A. e baixa atômica", async () => {
  await actor(uid);
  await db.query(
    "select public.admin_update_profile_access($1,'Encarregado Teste','leader',$2,true,array['epi:write'],array[$2]::uuid[])",
    [leader, team],
  );
  await actor(leader);
  assert.equal(
    await scalar("select public.can_operate('consumption:write',$1)", [team]),
    false,
  );
  await assert.rejects(
    db.query("select public.consume_material($1,$2,1)", [item, team]),
    /forbidden_role/,
  );
  assert.equal(
    await scalar("select count(*)::int from public.epi_employees"),
    1,
  );
  await assert.rejects(
    db.query("select public.register_epi_delivery($1,$2,$3,1)", [
      employeeOther,
      epi,
      batch,
    ]),
    /forbidden_team/,
  );
  const delivered = await scalar(
    "select public.register_epi_delivery($1,$2,$3,2)",
    [employee, epi, batch],
  );
  assert.equal(
    await scalar("select ca_snapshot from public.epi_deliveries where id=$1", [
      delivered,
    ]),
    "12345",
  );
  assert.equal(
    await scalar("select quantity from public.epi_stock_batches where id=$1", [
      batch,
    ]),
    8,
  );
  await assert.rejects(
    db.query("select public.register_epi_delivery($1,$2,$3,9)", [
      employee,
      epi,
      batch,
    ]),
    /insufficient_epi_stock/,
  );
  assert.equal(
    await scalar("select quantity from public.epi_stock_batches where id=$1", [
      batch,
    ]),
    8,
  );
});
test("equipes adicionais são explícitas e revogação vale imediatamente", async () => {
  await actor(uid);
  await db.query(
    "select public.admin_update_profile_access($1,'Encarregado Teste','leader',$2,true,array['epi:write'],array[$2,$3]::uuid[])",
    [leader, team, other],
  );
  await actor(leader);
  assert.equal(
    await scalar("select count(*)::int from public.epi_employees"),
    2,
  );
  await actor(uid);
  await db.query(
    "select public.admin_update_profile_access($1,'Encarregado Teste','leader',$2,true,array[]::text[],array[]::uuid[])",
    [leader, team],
  );
  await actor(leader);
  assert.equal(
    await scalar("select count(*)::int from public.epi_employees"),
    0,
  );
  await assert.rejects(
    db.query("select public.register_epi_delivery($1,$2,$3,1)", [
      employee,
      epi,
      batch,
    ]),
    /forbidden/,
  );
});
test("validação rejeita permissões inventadas e mantém o último ADM", async () => {
  await actor(uid);
  await assert.rejects(
    db.query(
      "select public.admin_update_profile_access($1,'Encarregado Teste','leader',$2,true,array['admin:manage'],null)",
      [leader, team],
    ),
    /profiles_operation_permissions_valid/,
  );
  await assert.rejects(
    db.query(
      "select public.admin_update_profile_access($1,'ADM Teste','leader',$2,true,null,null)",
      [uid, team],
    ),
    /last_admin_required/,
  );
  assert.equal(
    await scalar("select role from public.profiles where id=$1", [uid]),
    "admin",
  );
  assert.ok(
    (await scalar("select count(*)::int from public.profile_access_audit")) > 0,
  );
});
