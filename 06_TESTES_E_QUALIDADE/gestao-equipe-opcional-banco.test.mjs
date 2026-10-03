import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ids = Object.fromEntries(['admin','engineer','globalEngineer','leader','leaderDefault','collaborator','collaboratorDefault','emptyScope','ownTeam','otherTeam','own','other','unassigned','item','batch','delivery','request','movement'].map(k=>[k,randomUUID()]));
async function as(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); }
async function owner() { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids.admin]); }
const one = async (q,args=[]) => Object.values((await db.query(q,args)).rows[0])[0];

before(async()=>{
  for (const path of ['./fixtures/metallo-0.9.8-schema.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260926224000_unassigned_employee_management_scope.sql',
    '../04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql']) {
    await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
  }
  // Fixture historica omite DML de ack. Reproduzir o GRANT ja existente na
  // baseline real 20260902231312, para testar RLS e nao falhar antes no privilegio.
  await db.exec('grant insert,update,delete on public.epi_monthly_acknowledgements to authenticated');
  await db.query("insert into public.teams(id,name,location_type) values ($1,'T05 própria','field'),($2,'T05 alheia','field')",[ids.ownTeam,ids.otherTeam]);
  for (const [key,role,permissions,teams] of [
    ['admin','admin',null,null],['engineer','engineer',['epi:write'],[ids.ownTeam]],
    ['globalEngineer','engineer',null,null],['leader','leader',['epi:write'],[ids.ownTeam]],
    ['leaderDefault','leader',null,null],['collaborator','collaborator',['epi:write'],[ids.ownTeam]],
    ['collaboratorDefault','collaborator',null,null],['emptyScope','engineer',['epi:write'],[]],
  ]) {
    await db.query('insert into auth.users(id) values($1)',[ids[key]]);
    await db.query('insert into public.profiles(id,full_name,role,team_id,active,operation_permissions,operation_team_ids) values($1,$2,$3,$4,true,$5,$6)',[ids[key],key,role,ids.ownTeam,permissions,teams]);
  }
  await owner();
  for (const [key,team] of [['own',ids.ownTeam],['other',ids.otherTeam],['unassigned',ids.otherTeam]]) {
    await db.query("insert into public.epi_employees(id,full_name,profession,team_id,created_by,aso_exam_date) values($1,$2,'Teste',$3,$4,'2026-01-01')",[ids[key],key,team,ids.admin]);
  }
  await db.query("insert into public.epi_items(id,code,name,item_kind,created_by) values($1,'T05-EPI','Teste','epi',$2)",[ids.item,ids.admin]);
  await db.query('insert into public.epi_stock_batches(id,item_id,quantity,created_by) values($1,$2,20,$3)',[ids.batch,ids.item,ids.admin]);
  await db.query('insert into public.epi_deliveries(id,employee_id,team_id,item_id,stock_batch_id,quantity,delivered_by) values($1,$2,$3,$4,$5,2,$6)',[ids.delivery,ids.unassigned,ids.otherTeam,ids.item,ids.batch,ids.admin]);
  await db.query('insert into public.epi_requests(id,employee_id,team_id,item_id,quantity,requested_by) values($1,$2,$3,$4,1,$5)',[ids.request,ids.unassigned,ids.otherTeam,ids.item,ids.admin]);
  await db.query('update public.epi_employees set team_id=null where id=$1',[ids.unassigned]);
  for(const employee of [ids.own,ids.other,ids.unassigned]){
    await db.query('insert into public.epi_employee_items(employee_id,item_id) values($1,$2)',[employee,ids.item]);
    await db.query('insert into public.epi_employee_item_sets(employee_id,updated_by) values($1,$2)',[employee,ids.admin]);
    await db.query("insert into public.epi_monthly_acknowledgements(employee_id,reference_month) values($1,'2026-01-01')",[employee]);
  }
});
after(async()=>db.close());

test('T05 matriz de leitura preserva escopo da Gestão e nega sem equipe a não-admin',async()=>{
  for(const [actor,expected] of [['admin',['own','other','unassigned']],['engineer',['own']],['globalEngineer',['own','other']],['leader',['own']],['leaderDefault',[]],['collaborator',['own']],['collaboratorDefault',[]],['emptyScope',[]]]) {
    await as(ids[actor]);
    const rows=(await db.query('select id from public.epi_employees')).rows.map(r=>r.id).sort();
    assert.deepEqual(rows,expected.map(k=>ids[k]).sort(),actor);
    const dashboard=await one('select public.site_dashboard()');
    assert.deepEqual(dashboard.employees.map(e=>e.id).sort(),expected.map(k=>ids[k]).sort(),actor+' dashboard');
  }
});

test('T05 can_operate sem equipe continua consulta de capacidade e histórico não ganha alcance',async()=>{
  await as(ids.engineer);
  assert.equal(await one("select public.can_operate('epi:write',null)"),true);
  assert.equal(await one("select public.can_operate('epi:write',$1)",[ids.otherTeam]),false);
  assert.equal(await one('select count(*)::int from public.epi_deliveries where id=$1',[ids.delivery]),0);
  await as(ids.globalEngineer);
  assert.equal(await one('select count(*)::int from public.epi_deliveries where id=$1',[ids.delivery]),1,'histórico com equipe explícita conserva permissão anterior');
});

test('T05 RPCs DEFINER recusam gravação sem equipe e conservam estoque e histórico',async()=>{
  await owner();
  // Uma alocação explícita não autoriza operar cadastro sem equipe-base por acidente.
  const assignment=await one("insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values($1,$2,now()-interval '1 day',$3) returning id",[ids.unassigned,ids.ownTeam,ids.admin]);
  const snapshot=async()=>({stock:await one('select quantity from public.epi_stock_batches where id=$1',[ids.batch]),deliveries:(await db.query('select * from public.epi_deliveries order by id')).rows,requests:(await db.query('select * from public.epi_requests order by id')).rows});
  const beforeState=await snapshot();
  for(const [q,args] of [
    ['select public.register_epi_delivery($1,$2,$3,1)',[ids.unassigned,ids.item,ids.batch]],
    ['select public.register_epi_delivery_batch($1,$2::jsonb)',[ids.unassigned,JSON.stringify([{item_id:ids.item,stock_batch_id:ids.batch,quantity:1}])]],
    ['select public.request_epi_item($1,$2,1)',[ids.unassigned,ids.item]],
    ['select public.fulfill_epi_request($1,$2)',[ids.request,ids.batch]],
    ["select public.close_epi_delivery_quantity($1,1,'returned')",[ids.delivery]],
  ]) {
    await as(ids.engineer);
    await assert.rejects(db.query(q,args),/unassigned_employee_admin_required/);
    await owner(); assert.deepEqual(await snapshot(),beforeState);
  }
  await db.query('delete from public.employee_assignments where id=$1',[assignment]);
});

test('T05 admin conserva operação no histórico sem equipe e operador conserva entrega própria',async()=>{
  await as(ids.admin);
  assert.ok(await one("select public.close_epi_delivery_quantity($1,1,'returned')",[ids.delivery]));
  await as(ids.engineer);
  assert.ok(await one('select public.register_epi_delivery($1,$2,$3,1)',[ids.own,ids.item,ids.batch]));
});

test('T10 equipe com movimentos não é apagada e nenhum CASCADE é introduzido',async()=>{
  await owner();
  const team=await one("insert into public.teams(name,location_type) values('Equipe com histórico T10','field') returning id");
  const item=await one("insert into public.items(code,name,item_type) values('MAT-T10','Material T10','material') returning id");
  await db.query("insert into public.movements(id,item_id,quantity,movement_type,origin_team_id,performed_by) values($1,$2,1,'consumption',$3,$4)",[ids.movement,item,team,ids.admin]);
  await assert.rejects(db.query('delete from public.teams where id=$1',[team]),/foreign key/);
  assert.equal(await one('select count(*)::int from public.movements where id=$1',[ids.movement]),1);
  assert.equal(await one('select count(*)::int from public.teams where id=$1',[team]),1);
});

test('T15 itens kits e acknowledgements preservam recorte próprio e negam NULL para não-admin',async()=>{
  for(const [actor,expected] of [['admin',['own','other','unassigned']],['engineer',['own']],['globalEngineer',['own','other']],['leader',['own']],['collaborator',['own']],['leaderDefault',[]],['collaboratorDefault',[]],['emptyScope',[]]]){
    await as(ids[actor]);
    for(const table of ['epi_employee_items','epi_employee_item_sets','epi_monthly_acknowledgements']){
      assert.deepEqual((await db.query(`select employee_id from public.${table}`)).rows.map(r=>r.employee_id).sort(),expected.map(k=>ids[k]).sort(),actor+' '+table);
    }
  }
});

test('T15 escrita ack mantém permissões anteriores e tentativas negadas não alteram dados',async()=>{
  for(const actor of ['engineer','leader','collaborator','admin'])for(const state of ['own','other','unassigned']){
    const permitted=actor==='admin'||state==='own';
    await owner();
    const beforeState=(await db.query('select * from public.epi_monthly_acknowledgements order by id')).rows;
    await as(ids[actor]);
    const insert=()=>db.query("insert into public.epi_monthly_acknowledgements(employee_id,reference_month,signed_name) values($1,'2026-02-01','T15') returning id",[ids[state]]);
    if(permitted)assert.equal((await insert()).rows.length,1);else await assert.rejects(insert(),{code:'42501'});
    assert.equal((await db.query("update public.epi_monthly_acknowledgements set signed_name='Mudou' where employee_id=$1 and reference_month='2026-01-01' returning id",[ids[state]])).rows.length,permitted?1:0);
    assert.equal((await db.query("delete from public.epi_monthly_acknowledgements where employee_id=$1 and reference_month='2026-01-01' returning id",[ids[state]])).rows.length,permitted?1:0);
    await owner();
    if(!permitted)assert.deepEqual((await db.query('select * from public.epi_monthly_acknowledgements order by id')).rows,beforeState);
    else {await db.query('delete from public.epi_monthly_acknowledgements where employee_id=$1',[ids[state]]);await db.query("insert into public.epi_monthly_acknowledgements(employee_id,reference_month) values($1,'2026-01-01')",[ids[state]]);}
  }
});

test('T15 WITH CHECK nega transferência de acknowledgement próprio para alvo sem autorização',async()=>{
  await owner();
  const id=await one("insert into public.epi_monthly_acknowledgements(employee_id,reference_month) values($1,'2026-03-01') returning id",[ids.own]);
  for(const target of [ids.other,ids.unassigned]){
    await as(ids.engineer);
    await assert.rejects(db.query('update public.epi_monthly_acknowledgements set employee_id=$1 where id=$2',[target,id]),{code:'42501'});
    await owner();assert.equal(await one('select employee_id from public.epi_monthly_acknowledgements where id=$1',[id]),ids.own);
  }
});
