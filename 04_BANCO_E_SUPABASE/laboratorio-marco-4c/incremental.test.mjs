import { backupCore } from '../laboratorio-marco-2b/backup.mjs';
// Provas novas da candidata R5; casos antigos permanecem sem alteração.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { initializeAuthorization,createAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { eventHash } from '../laboratorio-marco-2b/integridade.mjs';
import { randomUUID } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createPointExtension,installExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
const base=resolve(import.meta.dirname,'../../backups/marco-4c-ensaios');mkdirSync(base,{recursive:true});
async function fixture(hook,{authorization=false}={}){
 const dir=resolve(base,'incremental-'+randomUUID()),p={authUserId:randomUUID(),employeeId:randomUUID(),sessionId:randomUUID(),issuedAt:1};
 let core=await createLabCore(dir,{mode:'create'});await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:'LAB-W',employmentRef:'LAB-V',validMinutes:60});await installExtension(core);const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await core.close();
 const authorizationPath=authorization?dir+'.authorization.json':null;let ledger=null;
 if(authorization){initializeAuthorization(authorizationPath,databaseId);core=await createLabCore(dir,{authorizationPath});await core.registerAuthorization(p.authUserId,p.employeeId);await core.close();ledger=createAuthorization(authorizationPath,databaseId);}
 const open=()=>createLabCore(dir,{integrityMode:'incremental',integrityTestHook:hook,authorizationPath});core=await open();let point=createPointExtension(core);
 const mark=async()=>{const idempotency_key=randomUUID();await point.begin(p,{idempotency_key});return point.finish(p,{idempotency_key,location:{status:'DENIED'}});};
 let closed=false;const closeCore=async()=>{if(!closed){closed=true;await core.close();}};
 return {dir,p,ledger,pause:closeCore,get core(){return core;},get point(){return point;},mark,async reopen(){await closeCore();core=await open();closed=false;point=createPointExtension(core);},close:closeCore};
}
test('incremental: append, retry, restart e auditoria integral do mesmo estado',async()=>{
 const f=await fixture();try{const key=randomUUID();await f.point.begin(f.p,{idempotency_key:key});const a=await f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}}),b=await f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});assert.equal(a.event.event_id,b.event.event_id);assert.equal(b.duplicate,true);assert.equal((await f.core.auditIntegrity()).passed,true);await f.reopen();assert.equal((await f.core.inspect()).ready_for_new_events,true);assert.equal((await f.point.verify()).length,1);}finally{await f.close();}
});
for(const position of [0,1,2])test('incremental: original '+position+' adulterado após PASS bloqueia; sem reparo',async()=>{
 const f=await fixture();try{const ids=[];for(let i=0;i<3;i++)ids.push((await f.mark()).event.event_id);assert.equal((await f.core.auditIntegrity()).passed,true);
  await f.core.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');await f.core.db.query("update lab_time_event set collector_version='adulterado' where event_id=$1",[ids[position]]);
  assert.equal((await verifyIntegrity(f.core.db)).passed,false);assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');await assert.rejects(()=>f.mark());assert.ok(readFileSync(f.dir+'.anchor.json.v2/incident.json','utf8').includes('originals_modified'));
  assert.equal((await f.core.db.query('select collector_version from lab_time_event where event_id=$1',[ids[position]])).rows[0].collector_version,'adulterado');
 }finally{await f.close();}
});
test('incremental: remoção detectada por conjunto/epoch, sem falso PASS',async()=>{
 const f=await fixture();try{await f.mark();await f.core.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete;alter table lab4a.receipt disable trigger all');await f.core.db.exec('delete from lab_intent_result;delete from lab4a.receipt;delete from lab_time_event');assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});
test('incremental: resultado incoerente e inserção sem resultado detectados',async()=>{
 const f=await fixture();try{await f.mark();await f.core.db.query('update lab_intent_result set request_hash=$1',['a'.repeat(64)]);assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});
test('incremental: journal antigo adulterado é detectado na auditoria integral',async()=>{
 const f=await fixture();try{await f.mark();const file=resolve(f.dir+'.anchor.json.v2','0000000001.json'),v=JSON.parse(readFileSync(file));v.committed.digest='a'.repeat(64);writeFileSync(file,JSON.stringify(v)+'\n');await assert.rejects(()=>f.core.auditIntegrity());assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});
test('incremental: checkpoint atual adulterado bloqueia guard síncrono',async()=>{
 const f=await fixture();try{await f.mark();const dir=f.dir+'.anchor.json.v2',last=readdirSync(dir).filter(n=>n.endsWith('.json')).sort().at(-1);writeFileSync(resolve(dir,last),'{}\n');assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});
for(const kind of ['receipt','sequence'])test('incremental: corrupção '+kind+' antiga detectada pelo guard após acesso externo',async()=>{
 const f=await fixture();try{for(let i=0;i<3;i++)await f.mark();await f.point.verify();await f.core.db.exec('alter table lab4a.receipt disable trigger all');
  await f.core.db.exec(kind==='receipt'?"update lab4a.receipt set payload_hash=repeat('a',64) where synthetic_sequence=1":"alter table lab4a.receipt alter column synthetic_sequence set generated by default;update lab4a.receipt set synthetic_sequence=20 where synthetic_sequence=1");
  assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');await assert.rejects(()=>f.point.verify());
 }finally{await f.close();}
});
test('incremental: último recibo removido não é silenciosamente recriado',async()=>{
 const f=await fixture();try{await f.mark();await f.core.db.exec('alter table lab4a.receipt disable trigger all;delete from lab4a.receipt');assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');await assert.rejects(()=>f.point.history(f.p));}finally{await f.close();}
});
test('admissão de leitura: callback somente leitura e capacidade expira',async()=>{
 const f=await fixture();try{let saved;await f.core.personalRead(f.p.authUserId,f.p.employeeId,{sessionId:f.p.sessionId,issuedAt:1},async access=>{saved=access;await access.checkpoint(async db=>{await assert.rejects(()=>db.query('delete from lab_time_event'));assert.equal(typeof db.exec,'undefined');});});await assert.rejects(()=>saved.checkpoint(()=>null));assert.equal((await f.core.inspect()).ready_for_new_events,true);}finally{await f.close();}
});
for(const phase of ['during_incremental','during_checkpoint'])test('crash sintético '+phase+': rollback, restart e retry sem duplicar',async()=>{
 let armed=false;const f=await fixture(p=>{if(armed&&p===phase){armed=false;throw Error('FALHA_SINTETICA');}});try{const key=randomUUID();await f.point.begin(f.p,{idempotency_key:key});armed=true;await assert.rejects(()=>f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}}));assert.equal((await f.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n,0);await f.reopen();const result=await f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});assert.equal(result.duplicate,false);assert.equal((await f.point.verify()).length,1);}finally{await f.close();}
});
test('queda após commit/antes resposta: restart preserva original e retry finaliza mesmo recibo',async()=>{
 const f=await fixture();try{const point=createPointExtension(f.core,{testHook:()=>{throw Error('RESPOSTA_PERDIDA');}}),key=randomUUID();await point.begin(f.p,{idempotency_key:key});await assert.rejects(()=>point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}}));const id=(await f.core.db.query('select event_id from lab_time_event')).rows[0].event_id;await f.reopen();const r=await f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});assert.equal(r.event.event_id,id);assert.equal(r.duplicate,true);assert.equal((await f.point.verify()).length,1);}finally{await f.close();}
});

for(const kind of ['before','precommit','read','logout'])test('incremental authorization: '+kind+' impede acesso sem novo original',async()=>{
 const f=await fixture(null,{authorization:true});try{
  const key=randomUUID();await f.point.begin(f.p,{idempotency_key:key});
  if(kind==='before'){f.ledger.setState(f.p.authUserId,'REVOKED');await assert.rejects(()=>f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}}),e=>e.status===403);}
  if(kind==='precommit')await assert.rejects(()=>f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}},async()=>f.ledger.setState(f.p.authUserId,'REVOKED')),e=>e.status===403);
  if(kind==='read')await assert.rejects(()=>f.point.readPersonal(f.p,async()=>f.ledger.setState(f.p.authUserId,'REVOKED')),e=>e.status===403);
  if(kind==='logout')await assert.rejects(()=>f.point.readPersonal(f.p,async()=>f.ledger.logoutCurrent(f.p.authUserId,f.p.sessionId)),e=>e.status===401);
  assert.equal((await f.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n,0);
 }finally{await f.close();}
});
test('incremental: employee_id cruzado não amplia contrato pessoal',async()=>{
 const f=await fixture(null,{authorization:true});try{await assert.rejects(()=>f.point.readPersonal({...f.p,employeeId:randomUUID()},()=>assert.fail()),e=>e.status>=400);await assert.rejects(()=>f.point.readPersonal({...f.p,authUserId:randomUUID()},()=>assert.fail()),e=>e.status>=400);}finally{await f.close();}
});
test('incremental: insert original/result válido fora da capacidade invalida raiz anterior',async()=>{
 const f=await fixture();try{await f.mark();const old=(await f.core.db.query('select * from lab_time_event')).rows[0],newEvent={...old,event_id:randomUUID(),idempotency_key:randomUUID()};newEvent.payload_hash=eventHash(newEvent);const keys=Object.keys(newEvent);await f.core.db.query('insert into lab_time_event('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(newEvent));await f.core.db.query('insert into lab_intent_result values($1,$2,$3,$4)',[newEvent.idempotency_key,newEvent.auth_user_id,(await f.core.db.query('select request_hash from lab_intent_result limit 1')).rows[0].request_hash,newEvent.event_id]);assert.equal((await verifyIntegrity(f.core.db)).passed,true);assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});
for(const phase of ['after_anchor_before_commit','after_database_commit'])test('process crash '+phase+': pending recuperado com prova integral e retry único',async()=>{
 const f=await fixture();try{const key=randomUUID();await f.point.begin(f.p,{idempotency_key:key});await f.pause();
  const code=`import {createLabCore} from './04_BANCO_E_SUPABASE/laboratorio-marco-2b/nucleo.mjs';const [dir,id,emp,key,phase]=process.argv.slice(1);const c=await createLabCore(dir,{integrityMode:'incremental'});await c.record(id,{contract_version:1,idempotency_key:key},{employeeId:emp,testHook:async p=>{if(p===phase)process.exit(71);}});process.exit(99);`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code,f.dir,f.p.authUserId,f.p.employeeId,key,phase],{cwd:resolve(import.meta.dirname,'../..'),encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(child.status,71,child.stderr);
  await f.reopen();assert.equal((await f.core.inspect()).ready_for_new_events,true);const result=await f.point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});assert.equal(result.duplicate,phase==='after_database_commit');assert.equal((await f.point.verify()).length,1);assert.equal((await f.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n,1);
 }finally{await f.close();}
});
test('crash auditoria completa: incidente preserva originais e impede novo sucesso',async()=>{
 let armed=false;const f=await fixture(p=>{if(armed&&p==='during_full_audit')throw Error('FALHA_AUDITORIA');});try{await f.mark();const before=JSON.stringify((await f.core.db.query('select * from lab_time_event')).rows);armed=true;await assert.rejects(()=>f.core.auditIntegrity());assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');assert.equal(JSON.stringify((await f.core.db.query('select * from lab_time_event')).rows),before);}finally{await f.close();}
});
test('falha de leitor concorrente não perde nem duplica marcação',async()=>{
 const f=await fixture();try{const values=await Promise.allSettled([f.point.readPersonal(f.p,()=>{throw Error('LEITOR_FALHOU');}),f.mark()]);assert.equal(values[0].status,'rejected');assert.equal(values[1].status,'fulfilled');assert.equal((await f.point.verify()).length,1);}finally{await f.close();}
});

test('dois adaptadores compartilham checkpoint de recibos sem falso incidente',async()=>{const f=await fixture();try{const other=createPointExtension(f.core);await f.mark();await other.readPersonal(f.p,()=>true);const key=randomUUID();await other.begin(f.p,{idempotency_key:key});await other.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});await f.point.readPersonal(f.p,()=>true);assert.equal((await f.core.inspect()).ready_for_new_events,true);assert.equal((await f.point.verify()).length,2);}finally{await f.close();}});

test('guard incremental detecta adulteração da cauda mesmo sem sinal de invalidation externo',async()=>{
 const f=await fixture();try{await f.mark();let raw;let id;await f.core.personalOperation(f.p.authUserId,f.p.employeeId,{sessionId:f.p.sessionId,issuedAt:1},a=>a.checkpoint(async db=>{raw=db;id=(await db.query('select event_id from lab_time_event')).rows[0].event_id;}));await raw.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');await raw.query("update lab_time_event set collector_version='adulterado' where event_id=$1",[id]);assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');assert.equal(JSON.parse(readFileSync(f.dir+'.anchor.json.v2/incident.json')).reason,'FOLHA_INVALIDA');}finally{await f.close();}
});
test('limite explícito: adulteração antiga fora do processo exige auditoria integral, que bloqueia',async()=>{
 const f=await fixture();try{const first=(await f.mark()).event.event_id;await f.mark();let raw;await f.core.personalOperation(f.p.authUserId,f.p.employeeId,{sessionId:f.p.sessionId,issuedAt:1},a=>a.checkpoint(db=>{raw=db;}));await raw.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');await raw.query("update lab_time_event set collector_version='adulterado' where event_id=$1",[first]);assert.equal((await f.core.inspect()).state,'READY','Guard de cauda não reivindica verificar o passado fora do processo');await assert.rejects(()=>f.core.auditIntegrity());assert.equal((await f.core.inspect()).state,'RECOVERY_REQUIRED');}finally{await f.close();}
});

test('health incremental informa disponibilidade de contexto a partir do SQL real',async()=>{const f=await fixture();try{await f.mark();assert.equal((await f.core.inspect()).context_state,'AVAILABLE');await f.core.db.query("update lab_context set valid_until='2020-01-01T00:00:00Z'");assert.equal((await f.core.inspect()).context_state,'NO_ACTIVE_SNAPSHOT');await assert.rejects(()=>f.mark(),e=>e.status===409);}finally{await f.close();}});

test('bloqueador de adoção: backup v1 rejeita estado v2 sem produzir backup falso',async()=>{
 const f=await fixture();try{await f.mark();const before=JSON.stringify((await f.core.db.query('select * from lab_time_event')).rows);let observed;await assert.rejects(()=>backupCore(f.core,f.dir+'-backup-v1',{formatVersion:1}),e=>{observed=e.message;return e.message==='ANCORA_DIVERGENTE';});const unchanged=JSON.stringify((await f.core.db.query('select * from lab_time_event')).rows)===before;assert.equal(unchanged,true);assert.equal((await f.core.inspect()).ready_for_new_events,true);writeFileSync(resolve(import.meta.dirname,process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'adocao-controlada/correcao-bootstrap/compatibilidade-v1.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'adocao-controlada/compatibilidade-v1.json':process.env.METALLO_4C_ROUND==='6'?'rodada-6/compatibilidade-v1.json':'rodada-5/bloqueador-backup.json'),JSON.stringify({at:new Date().toISOString(),candidate_format:2,helper_format:1,error:observed,compatible:false,false_success:false,originals_preserved:unchanged,original_count:1,scope:(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'||process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'||process.env.METALLO_4C_ROUND==='6')?'Synthetic current v2: explicit formatVersion:1 rejection; version2 is tested separately':'Synthetic R5; adoption blocked; default full/v1 remains supported'},null,2)+'\n');}finally{await f.close();}
});
