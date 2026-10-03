import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

test("restaura snapshot local isolado sem tocar o banco conectado", async (t) => {
  const started = performance.now();
  const source = new PGlite();
  let target;
  try {
    await source.exec(`
      create table synthetic_identity (
        auth_user_id uuid primary key,
        employee_id uuid not null unique,
        status text not null
      );
      insert into synthetic_identity values
        ('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','active'),
        ('10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','revoked');
    `);
    const original = (await source.query("select * from synthetic_identity order by auth_user_id")).rows;
    const snapshot = await source.dumpDataDir("gzip");
    target = await PGlite.create({ loadDataDir: snapshot });
    const restored = (await target.query("select * from synthetic_identity order by auth_user_id")).rows;
    assert.deepEqual(restored, original);
    assert.equal(restored.length, 2);
    t.diagnostic(`origem=PGlite A destino=PGlite B; bytes=${snapshot.size}; duracao_ms=${Math.round(performance.now() - started)}; resultado=confere`);
  } finally {
    await target?.close();
    await source.close();
  }
});
