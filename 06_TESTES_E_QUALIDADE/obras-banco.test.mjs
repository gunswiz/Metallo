import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const admin = randomUUID(),
  operator = randomUUID(),
  team = randomUUID(),
  other = randomUUID(),
  material = randomUUID(),
  epi = randomUUID(),
  employee = randomUUID();
let actorId = admin,
  work,
  order,
  line;
const happened = new Date(Date.now() - 86400000).toISOString();
async function actor(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  actorId = id;
}
async function value(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
async function run(command, data, id = randomUUID(), at = happened) {
  return value("select public.run_site_operation($1,$2,$3,$4)", [
    command,
    { ...data, actor_id: actorId },
    id,
    at,
  ]);
}
before(async () => {
  for (const path of [
    "./fixtures/metallo-0.9.8-schema.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql",
    "../04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql",
  ])
    await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [
    admin,
    operator,
  ]);
  await db.query(
    "insert into public.teams(id,name,location_type) values($1,'Equipe A','field'),($2,'Equipe B','field')",
    [team, other],
  );
  await db.query(
    "insert into public.profiles(id,full_name,role,team_id,active) values($1,'ADM Teste','admin',$3,true),($2,'Responsável Teste','engineer',$4,true)",
    [admin, operator, team, other],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    admin,
  ]);
  await db.query(
    "insert into public.items(id,code,name,item_type,unit) values($1,'MAT-T','Disco de teste','material','un')",
    [material],
  );
  await db.query(
    "insert into public.inventory(item_id,team_id,quantity) values($1,$2,10),($1,$3,5)",
    [material, team, other],
  );
  await db.query(
    "insert into public.epi_items(id,code,name,item_kind) values($1,'EPI-T','Luva de teste','epi')",
    [epi],
  );
  await db.query(
    "insert into public.epi_employees(id,full_name,profession,team_id) values($1,'Funcionário Teste','Soldador',$2)",
    [employee, team],
  );
  await actor(admin);
});
after(async () => db.close());
test("unifica estoque de duas equipes sem perder saldo e preserva quem consumiu", async () => {
  work = (await run("create_worksite", { name: "Obra Teste", team_id: team }))
    .id;
  await run("link_team", { worksite_id: work, team_id: other });
  assert.equal(
    await value(
      "select sum(quantity)::int from public.inventory where item_id=$1",
      [material],
    ),
    15,
  );
  assert.equal(
    await value("select count(*)::int from public.inventory where item_id=$1", [
      material,
    ]),
    1,
  );
  await actor(operator);
  await run("consume", {
    team_id: other,
    item_id: material,
    quantity: 2,
    note: "Consumo diário",
  });
  assert.equal(
    await value(
      "select quantity from public.inventory where item_id=$1 and team_id=$2",
      [material, team],
    ),
    13,
  );
  const movement = (
    await db.query(
      "select origin_team_id,occurred_at,created_at from public.movements where movement_type='consumption'",
    )
  ).rows[0];
  assert.equal(movement.origin_team_id, other);
  assert.equal(new Date(movement.occurred_at).toISOString(), happened);
  assert.ok(new Date(movement.created_at) > new Date(movement.occurred_at));
});
test("reenvio do mesmo lançamento não duplica consumo e ID reutilizado com outro conteúdo é rejeitado", async () => {
  const id = randomUUID(),
    data = { team_id: other, item_id: material, quantity: 1 };
  await run("consume", data, id);
  await run("consume", data, id);
  assert.equal(
    await value("select quantity from public.inventory where item_id=$1", [
      material,
    ]),
    12,
  );
  await assert.rejects(
    run("consume", { ...data, quantity: 2 }, id),
    /operation_id_conflict/,
  );
});
test("pedido segue ADM e patrão; operador não aprova a própria compra", async () => {
  order = (
    await run("create_order", {
      team_id: other,
      lines: [
        {
          kind: "material",
          item_id: material,
          description: "Disco de teste",
          quantity: 5,
        },
      ],
    })
  ).id;
  await assert.rejects(
    run("order_status", { order_id: order, status: "approved" }),
    /admin_required/,
  );
  await actor(admin);
  await assert.rejects(
    run("order_status", { order_id: order, status: "ordered" }),
    /invalid_order_transition/,
  );
  for (const status of ["awaiting_owner", "approved", "ordered"])
    await run("order_status", { order_id: order, status });
  line = await value(
    "select id from public.supply_order_lines where order_id=$1",
    [order],
  );
});
test("recebimento parcial mantém faltantes e só adiciona o que chegou", async () => {
  await actor(operator);
  await run("receive_order", { order_id: order, line_id: line, quantity: 2 });
  assert.equal(
    await value("select status from public.supply_orders where id=$1", [order]),
    "partial",
  );
  assert.equal(
    await value(
      "select quantity-received_quantity from public.supply_order_lines where id=$1",
      [line],
    ),
    3,
  );
  await assert.rejects(
    run("receive_order", { order_id: order, line_id: line, quantity: 4 }),
    /invalid_quantity/,
  );
  await run("receive_order", { order_id: order, line_id: line, quantity: 3 });
  assert.equal(
    await value("select status from public.supply_orders where id=$1", [order]),
    "received",
  );
  assert.equal(
    await value("select quantity from public.inventory where item_id=$1", [
      material,
    ]),
    17,
  );
});
test("máquina recebida mantém locadora e numeração; aviso não encerra locação nem cobrança", async () => {
  const id = (
    await run("create_order", {
      team_id: other,
      lines: [{ kind: "rental", description: "Máquina de teste", quantity: 1 }],
    })
  ).id;
  await actor(admin);
  for (const status of ["awaiting_owner", "approved", "ordered"])
    await run("order_status", { order_id: id, status });
  const rentalLine = await value(
    "select id from public.supply_order_lines where order_id=$1",
    [id],
  );
  await actor(operator);
  await run("receive_order", {
    order_id: id,
    line_id: rentalLine,
    quantity: 1,
    rental_company: "Locadora Teste",
    asset_codes: ["ABC-123"],
  });
  const asset = (
    await db.query("select * from public.assets where serial_number='ABC-123'")
  ).rows[0];
  assert.equal(asset.ownership_type, "rented");
  assert.equal(asset.rental_company, "Locadora Teste");
  const request = (
    await run("rental_notify", {
      asset_id: asset.id,
      note: "Serviço concluído",
    })
  ).id;
  assert.equal(
    await value("select active from public.assets where id=$1", [asset.id]),
    true,
  );
  await actor(admin);
  await run("rental_details", {
    asset_id: asset.id,
    amount: 100,
    billing_period: "day",
  });
  await run("rental_resolve", { request_id: request, status: "returned" });
  assert.equal(
    await value("select active from public.assets where id=$1", [asset.id]),
    false,
  );
  assert.equal(
    await value(
      "select billing_closed_on from public.rental_admin_details where asset_id=$1",
      [asset.id],
    ),
    null,
  );
  await actor(operator);
  assert.equal(
    await value("select count(*)::int from public.rental_admin_details"),
    0,
  );
});
test("funcionário em apoio mantém equipe de origem e a alocação respeita datas", async () => {
  await actor(admin);
  const assignment = (
    await run("assign_employee", {
      employee_id: employee,
      team_id: other,
      note: "Apoio temporário",
    })
  ).id;
  assert.equal(
    await value("select team_id from public.epi_employees where id=$1", [
      employee,
    ]),
    team,
  );
  assert.equal(
    await value("select public.employee_work_team($1)", [employee]),
    other,
  );
  await run(
    "end_assignment",
    { assignment_id: assignment },
    randomUUID(),
    new Date().toISOString(),
  );
  assert.equal(
    await value("select public.employee_work_team($1)", [employee]),
    team,
  );
});
test("painel de alertas e dados financeiros aparecem somente para ADM", async () => {
  await actor(admin);
  const adminSnapshot = await value("select public.site_dashboard()");
  assert.ok(adminSnapshot.works.length);
  assert.ok(Array.isArray(adminSnapshot.alerts));
  await actor(operator);
  const snapshot = await value("select public.site_dashboard()");
  assert.deepEqual(snapshot.alerts, []);
  assert.deepEqual(snapshot.rental_details, []);
});

test("entrada e transferência de EPI preservam C.A., lote e saldo; baixa parcial mantém a data da entrega", async () => {
  await actor(admin);
  await assert.rejects(
    run("epi_entry", { team_id: team, item_id: epi, quantity: 10 }),
    /ca_required/,
  );
  const batch = (
    await run("epi_entry", {
      team_id: team,
      item_id: epi,
      quantity: 10,
      ca_number: "12345",
      brand_model: "Modelo teste",
      lot_number: "LOTE-T",
    })
  ).id;
  const central = randomUUID();
  await db.exec("reset role");
  await db.query(
    "insert into public.teams(id,name,location_type) values($1,'COSEM Teste','central')",
    [central],
  );
  await actor(admin);
  const moved = (
    await run("epi_transfer", {
      stock_batch_id: batch,
      team_id: central,
      quantity: 3,
    })
  ).id;
  assert.equal(
    await value("select quantity from public.epi_stock_batches where id=$1", [
      batch,
    ]),
    7,
  );
  const copy = (
    await db.query("select * from public.epi_stock_batches where id=$1", [
      moved,
    ])
  ).rows[0];
  assert.equal(copy.ca_number, "12345");
  assert.equal(copy.lot_number, "LOTE-T");
  assert.equal(copy.worksite_id, null);
  await run("deliver_epi", {
    employee_id: employee,
    lines: [{ item_id: epi, stock_batch_id: batch, quantity: 2 }],
  });
  const delivery = await value(
    "select id from public.epi_deliveries where employee_id=$1 order by created_at desc limit 1",
    [employee],
  );
  const closed = (
    await run(
      "close_epi",
      { delivery_id: delivery, quantity: 1, status: "damaged" },
      randomUUID(),
      new Date().toISOString(),
    )
  ).id;
  assert.equal(
    new Date(
      await value(
        "select delivered_at from public.epi_deliveries where id=$1",
        [closed],
      ),
    ).toISOString(),
    happened,
  );
  assert.equal(
    await value(
      "select sum(quantity)::int from public.epi_deliveries where employee_id=$1",
      [employee],
    ),
    2,
  );
});

test("payload vazio, outro usuário e permissão revogada são recusados sem alterar estoque", async () => {
  await actor(operator);
  await assert.rejects(
    run("create_order", { team_id: other }),
    /invalid_lines/,
  );
  await assert.rejects(
    value("select public.run_site_operation($1,$2,$3,$4)", [
      "consume",
      { actor_id: admin, team_id: other, item_id: material, quantity: 1 },
      randomUUID(),
      happened,
    ]),
    /operation_actor_mismatch/,
  );
  await actor(admin);
  await db.query(
    "select public.admin_update_profile_access($1,$2,$3,$4,$5,$6,$7)",
    [operator, "Responsável Teste", "engineer", other, true, [], null],
  );
  await actor(operator);
  await assert.rejects(
    run("consume", { team_id: other, item_id: material, quantity: 1 }),
    /not authorized|forbidden/,
  );
  await actor(admin);
  await db.query(
    "select public.admin_update_profile_access($1,$2,$3,$4,$5,$6,$7)",
    [operator, "Responsável Teste", "engineer", other, true, null, null],
  );
});

test("mover equipe para outra obra não muda o estoque a corrigir no histórico anterior", async () => {
  await actor(admin);
  const before = await value(
    "select quantity from public.inventory where item_id=$1 and team_id=$2",
    [material, team],
  );
  await run("consume", { team_id: other, item_id: material, quantity: 2 });
  const movement = await value(
    "select id from public.movements where movement_type='consumption' order by created_at desc limit 1",
  );
  const third = randomUUID();
  await db.exec("reset role");
  await db.query(
    "insert into public.teams(id,name,location_type) values($1,'Equipe C','field')",
    [third],
  );
  await actor(admin);
  const secondWork = (
    await run("create_worksite", { name: "Outra obra", team_id: third })
  ).id;
  await run("link_team", { worksite_id: secondWork, team_id: other });
  await value("select public.admin_delete_material_movement($1)", [movement]);
  assert.equal(
    await value(
      "select quantity from public.inventory where item_id=$1 and team_id=$2",
      [material, team],
    ),
    before,
  );
  assert.equal(
    await value(
      "select count(*)::int from public.inventory where item_id=$1 and team_id=$2",
      [material, third],
    ),
    0,
  );
  await assert.rejects(
    value("select public.delete_team_admin($1)", [team]),
    /team_linked_to_worksite/,
  );
});
