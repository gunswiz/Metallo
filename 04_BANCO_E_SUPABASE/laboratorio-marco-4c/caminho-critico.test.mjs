// Proteção escrita antes da rodada 3: operação composta e falhas A–F.
// Somente PGlite sintético; sem rede/Auth remoto ou dados reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { initializeAuthorization,createAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { installExtension,createPointExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { createPersonalRecords } from '../laboratorio-marco-4b/registros.mjs';
import { inventory } from '../laboratorio-marco-2b/integridade.mjs';
import { readAnchor,stateOf } from '../laboratorio-marco-2b/recuperacao.mjs';

const dir=resolve(import.meta.dirname,'../../backups/marco-4c-ensaios/protecao-'+randomUUID());mkdirSync(dir,{recursive:true});
let core=await createLabCore(dir,{mode:'create'});
const people=['joao','maria'].map(name=>({name,authUserId:randomUUID(),employeeId:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)}));
for(const p of people)await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:'LAB-4C-'+p.name.toUpperCase(),employmentRef:'LAB-4C-V-'+p.name.toUpperCase()});
const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;
await core.close();const authorizationPath=dir+'.authorization.json';initializeAuthorization(authorizationPath,databaseId);
core=await createLabCore(dir,{authorizationPath});for(const p of people)await core.registerAuthorization(p.authUserId,p.employeeId);
await installExtension(core);const [j,m]=people;const ledger=createAuthorization(authorizationPath,databaseId);
const point=createPointExtension(core),records=createPersonalRecords(core,point);
const rows=async()=>(await core.db.query('select * from lab_time_event order by event_id')).rows;
const digest=r=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
const session=p=>({sessionId:p.sessionId,issuedAt:p.issuedAt});
const body=key=>({idempotency_key:key,location:{status:'DENIED'}});
async function mark(p=j,key=randomUUID(),adapter=point){await adapter.begin(p,{idempotency_key:key});return adapter.finish(p,body(key));}
async function count(key){return (await core.db.query('select event_id from lab_time_event where idempotency_key=$1',[key])).rows;}
try{
 const firstKey=randomUUID(),first=await mark(j,firstKey);
 await test('1 Original imutável: UPDATE/DELETE rejeitados e bytes preservados',async()=>{
  const before=digest(await rows());await assert.rejects(core.db.query('update lab_time_event set payload_hash=$1',['0'.repeat(64)]));await assert.rejects(core.db.query('delete from lab_time_event'));assert.equal(digest(await rows()),before);
 });
 await test('2 Duplo clique / duas abas: exatamente um original e um recibo',async()=>{
  const key=randomUUID();await point.begin(j,{idempotency_key:key});const values=await Promise.all([point.finish(j,body(key)),point.finish(j,body(key))]);assert.equal(values[0].event.event_id,values[1].event.event_id);assert.equal((await count(key)).length,1);
  assert.equal((await core.db.query('select event_id from lab4a.receipt where idempotency_key=$1',[key])).rows.length,1);
 });
 await test('3 Retry conserva intenção, horário e recibo; não adiciona original',async()=>{assert.deepEqual((await point.finish(j,body(firstKey))).event,first.event);assert.equal((await count(firstKey)).length,1);});
 await test('4 Nova intenção cria outro original',async()=>assert.notEqual((await mark()).event.event_id,first.event.event_id));
 await test('5 João/Maria não consultam nem reutilizam intenção/recibo cruzado',async()=>{
  const mk=randomUUID(),mr=await mark(m,mk);await assert.rejects(point.finish(j,body(mk)),e=>e.status===403);await assert.rejects(point.begin(j,{idempotency_key:mk}),e=>e.status===409);
  await assert.rejects(records.receipt(j,mr.event.event_id),e=>e.status===404);await assert.rejects(records.receipt(m,first.event.event_id),e=>e.status===404);assert.equal((await count(mk)).length,1);
 });
 await test('6 Versão/revogação imediatamente pré-commit impede original',async()=>{
  const key=randomUUID();await point.begin(m,{idempotency_key:key});await assert.rejects(point.finish(m,body(key),async()=>ledger.setState(m.authUserId,'REVOKED')),e=>e.status===403);assert.equal((await count(key)).length,0);await assert.rejects(records.list(m,{period:'today'}),e=>e.status===403);
 });
 await test('7/B Commit seguido de falha conserva original; retry completa mesmo recibo',async()=>{
  const key=randomUUID();let fail=true;const faulty=createPointExtension(core,{testHook:async phase=>{if(fail&&phase==='after_core_commit'){fail=false;throw Error('B_AFTER_COMMIT');}}});
  await faulty.begin(j,{idempotency_key:key});await assert.rejects(faulty.finish(j,body(key)),/B_AFTER_COMMIT/);const committed=await count(key);assert.equal(committed.length,1);
  const recovered=await faulty.finish(j,body(key));assert.equal(recovered.duplicate,true);assert.equal(recovered.event.event_id,committed[0].event_id);assert.equal((await count(key)).length,1);
 });
 await test('8 Leituras concorrentes preservam todos os originais',async()=>{const before=digest(await rows());await Promise.all(Array.from({length:8},()=>records.list(j,{period:'60d'})));assert.equal(digest(await rows()),before);});
 await test('9 DTOs concorrentes de download + reautorização preservam original',async()=>{
  const before=digest(await rows());await Promise.all(Array.from({length:4},async()=>{await records.receipt(j,first.event.event_id);await records.last48(j);await records.authorize(j);}));assert.equal(digest(await rows()),before);
 });
 await test('10 Auditoria pós-commit não altera original',async()=>{const before=digest(await rows());await point.verify();await core.inspect();assert.equal(digest(await rows()),before);});
 await test('A Falha antes do commit: rollback, sem falso sucesso',async()=>{
  const key=randomUUID();await point.begin(j,{idempotency_key:key});await assert.rejects(point.finish(j,body(key),async()=>{throw Error('A_PRECOMMIT');}),/A_PRECOMMIT/);assert.equal((await count(key)).length,0);assert.equal((await point.finish(j,body(key))).duplicate,false);
 });
 await test('C Falha antes da resposta: resposta descartada, retry sem duplicar',async()=>{
  const key=randomUUID();let committed;
  await assert.rejects(async()=>{committed=await mark(j,key);throw Error('C_BEFORE_RESPONSE');},/C_BEFORE_RESPONSE/);
  assert.equal((await point.finish(j,body(key))).event.event_id,committed.event.event_id);assert.equal((await count(key)).length,1);
 });
 await test('D Falha de renderização do recibo: original/recibo técnico preservados',async()=>{
  const before=digest(await rows()),dto=await records.receipt(j,first.event.event_id);
  // Node 24 lê TS nativo; resolver somente o alias local usado pelo renderizador
  // existente. Não altera configuração do projeto nem instala um runtime.
  const hooks=registerHooks({resolve(specifier,context,next){return next(specifier.startsWith('@/')?pathToFileURL(resolve(import.meta.dirname,'../../01_WEB',specifier.slice(2)+'.ts')).href:specifier,context);}});
  try{
   const {buildPointReceipt}=await import('../../01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts');
   await assert.rejects(()=>buildPointReceipt(dto,Buffer.from('INVALID_SYNTHETIC_PNG')));
   assert.ok((await buildPointReceipt(dto)).byteLength>0);
  }finally{hooks.deregister();}
  assert.equal(digest(await rows()),before);assert.equal((await point.finish(j,body(firstKey))).event.event_id,first.event.event_id);
 });
 await test('E Falha de verificação após commit: não apaga original',async()=>{
  const before=digest(await rows()),old=(await core.db.query('select request_hash from lab_intent_result where idempotency_key=$1',[firstKey])).rows[0].request_hash;
  await core.db.query('update lab_intent_result set request_hash=$1 where idempotency_key=$2',['0'.repeat(64),firstKey]);
  try{await assert.rejects(point.verify(),e=>e.status===503);assert.equal(digest(await rows()),before);}
  finally{await core.db.query('update lab_intent_result set request_hash=$1 where idempotency_key=$2',[old,firstKey]);}
  assert.equal((await point.finish(j,body(firstKey))).event.event_id,first.event.event_id);
 });
 await test('F Falha de leitura concorrente: próxima marcação conserva uma intenção',async()=>{
  const bad=createPersonalRecords(core,point,{testHook:async()=>{throw Error('F_READ');}}),key=randomUUID(),before=await rows();
  const values=await Promise.allSettled([bad.list(j,{period:'today'}),mark(j,key)]);assert.equal(values[0].status,'rejected');assert.equal(values[1].status,'fulfilled');assert.equal((await count(key)).length,1);
  const after=await rows();assert.equal(digest(after.filter(e=>before.some(o=>o.event_id===e.event_id))),digest(before));
 });
 await test('Operação pessoal: capacidade expira e não aceita titular cruzado',async()=>{
  assert.equal(typeof core.personalOperation,'function','API deliberadamente ainda ausente no teste pré-implementação');let saved;
  await core.personalOperation(j.authUserId,j.employeeId,session(j),async access=>{saved=access;await assert.rejects(access.record(m.authUserId,{contract_version:1,idempotency_key:randomUUID()},{employeeId:m.employeeId,session:session(m)}));});
  await assert.rejects(saved.checkpoint(()=>assert.fail('Capacidade expirada não pode ler')));
 });
 await test('Operação composta detecta trigger desativado após PASS anterior',async()=>{
  await records.list(j,{period:'today'});await core.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');
  try{await assert.rejects(point.begin(j,{idempotency_key:randomUUID()}),e=>e.status===503);await assert.rejects(records.last48(j),e=>e.status===503);}
  finally{await core.db.exec('alter table lab_time_event enable trigger lab_event_no_update_delete');}
 });
 await test('Operação composta detecta resultado idempotente adulterado',async()=>{
  const old=(await core.db.query('select request_hash from lab_intent_result where idempotency_key=$1',[firstKey])).rows[0].request_hash;
  await core.db.query('update lab_intent_result set request_hash=$1 where idempotency_key=$2',['0'.repeat(64),firstKey]);
  try{await assert.rejects(point.finish(j,body(firstKey)),e=>e.status===503);}
  finally{await core.db.query('update lab_intent_result set request_hash=$1 where idempotency_key=$2',[old,firstKey]);}
 });
 await test('Logout durante leitura é observado antes da resposta da operação',async()=>{
  const before=digest(await rows());await assert.rejects(point.readPersonal(j,async()=>ledger.logoutCurrent(j.authUserId,j.sessionId)),e=>e.status===401);assert.equal(digest(await rows()),before);
 });
}finally{await core.close();}

await test('R4 Âncora confirmada equivale ao inventário SQL real após três commits e replay',async()=>{
 const path=resolve(dir,'ancora-r4'),anchorPath=path+'.anchor.json';const c=await createLabCore(path,{mode:'create',anchorPath});
 try{
  await c.seedSynthetic({authUserId:j.authUserId,employeeId:j.employeeId,workerRef:'LAB-R4-JOAO',employmentRef:'LAB-R4-VINCULO'});
  for(let n=0;n<3;n++){
   const input={contract_version:1,idempotency_key:randomUUID()},r=await c.record(j.authUserId,input,{employeeId:j.employeeId});
   const expected=stateOf(await inventory(c.db));assert.deepEqual(readAnchor(anchorPath),{format_version:1,committed:expected,pending:null});
   const replay=await c.record(j.authUserId,input,{employeeId:j.employeeId});assert.equal(replay.event.event_id,r.event.event_id);assert.deepEqual(readAnchor(anchorPath).committed,expected);
  }
 }finally{await c.close();}
});
await test('R4 Falha após DB durável preserva pending real; restart recupera e retry não duplica',async()=>{
 const path=resolve(dir,'crash-r4'),anchorPath=path+'.anchor.json';let c=await createLabCore(path,{mode:'create',anchorPath});
 const input={contract_version:1,idempotency_key:randomUUID()};let eventId;
 try{
  await c.seedSynthetic({authUserId:j.authUserId,employeeId:j.employeeId,workerRef:'LAB-R4-CRASH',employmentRef:'LAB-R4-V-CRASH'});
  await assert.rejects(c.record(j.authUserId,input,{employeeId:j.employeeId,testHook:async phase=>{if(phase==='after_database_commit')throw Error('R4_AFTER_DURABLE');}}),/R4_AFTER_DURABLE/);
  const actual=await inventory(c.db);assert.equal(actual.events.length,1);eventId=actual.events[0].event_id;assert.deepEqual(readAnchor(anchorPath).pending,stateOf(actual));
  await c.close();c=await createLabCore(path,{anchorPath});assert.equal((await c.inspect()).ready_for_new_events,true);
  assert.deepEqual(readAnchor(anchorPath).committed,stateOf(await inventory(c.db)));assert.equal(readAnchor(anchorPath).pending,null);
  const replay=await c.record(j.authUserId,input,{employeeId:j.employeeId});assert.equal(replay.duplicate,true);assert.equal(replay.event.event_id,eventId);assert.equal((await inventory(c.db)).events.length,1);
 }finally{await c.close();}
});
