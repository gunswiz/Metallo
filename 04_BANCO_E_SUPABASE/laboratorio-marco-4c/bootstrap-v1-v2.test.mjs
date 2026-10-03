// Transição de estado técnico sobre histórico local já validado; nunca reescreve eventos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createPointExtension,installExtension,receiptInventoryForBackup } from '../laboratorio-marco-4a/extensao.mjs';
import { verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
import { recoverAnchor,stateOf } from '../laboratorio-marco-2b/recuperacao.mjs';
import { backupCore,restoreDisposable } from '../laboratorio-marco-2b/backup.mjs';

const root=resolve(import.meta.dirname,'../..'),base=resolve(root,'backups/marco-4c-ensaios');mkdirSync(base,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const copy=value=>JSON.stringify(value);
async function historical(count){
 const dir=resolve(base,'bootstrap-v1-'+randomUUID()),p={authUserId:randomUUID(),employeeId:randomUUID(),sessionId:randomUUID(),issuedAt:1};
 let core=await createLabCore(dir,{mode:'create'});
 await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:'LAB-BOOTSTRAP-W',employmentRef:'LAB-BOOTSTRAP-V',validMinutes:1440});
 await installExtension(core);const point=createPointExtension(core);
 for(let i=0;i<count;i++)await mark(point,p);
 const before=await capture(core,dir);await core.close();return {dir,p,before};
}
async function mark(point,p,key=randomUUID()){
 await point.begin(p,{idempotency_key:key});return point.finish(p,{idempotency_key:key,location:{status:'DENIED'}});
}
async function capture(core,dir){
 const originals=(await core.db.query('select * from lab_time_event order by event_id')).rows,receipts=await receiptInventoryForBackup(core.db);
 return {originals:copy(originals),original_sha:sha(copy(originals)),receipts:copy(receipts.receipts),receipt_sha:sha(copy(receipts.receipts)),sequence:Number(receipts.sequence.last_value),sequence_called:receipts.sequence.is_called,
  anchor:readFileSync(dir+'.anchor.json','utf8'),full:(await verifyIntegrity(core.db)).passed,point_count:receipts.receipts.length};
}
function frame(dir){return JSON.parse(readFileSync(dir+'.anchor.json.v2/0000000001.json','utf8'));}
function assertOld(before,after){assert.equal(after.originals,before.originals);assert.equal(after.receipts,before.receipts);assert.equal(after.anchor,before.anchor);assert.equal(after.sequence,before.sequence);assert.equal(after.sequence_called,before.sequence_called);}

for(const count of [0,1,10,100,120])test(`bootstrap v1→v2 ${count}/${count}: auditoria, identidade, idempotência e nova intenção`,async()=>{
 const f=await historical(count);let core;
 try{
  assert.equal(f.before.full,true);assert.equal(f.before.point_count,count);
  core=await createLabCore(f.dir,{integrityMode:'incremental'});const point=createPointExtension(core);
  assert.equal((await core.auditIntegrity()).passed,true);assert.equal((await point.verify()).length,count);
  const baseFrame=frame(f.dir);assert.equal(baseFrame.transition.kind,'BOOTSTRAP_CHECKPOINT_V2');assert.equal(baseFrame.transition.audit_result,'PASS');
  assert.equal(baseFrame.transition.original_count,count);assert.equal(baseFrame.transition.receipt_count,count);
  assert.equal(baseFrame.receipt_checkpoint.count,count);assert.equal(baseFrame.receipt_checkpoint.sequence,count?JSON.parse(f.before.receipts).at(-1).synthetic_sequence:null);
  assertOld(f.before,await capture(core,f.dir));
  const firstHash=sha(readFileSync(f.dir+'.anchor.json.v2/0000000001.json'));await core.close();core=await createLabCore(f.dir,{integrityMode:'incremental'});
  assert.equal(readdirSync(f.dir+'.anchor.json.v2').filter(name=>/^\d{10}\.json$/.test(name)).length,1);
  assert.equal(sha(readFileSync(f.dir+'.anchor.json.v2/0000000001.json')),firstHash);
  const newPoint=createPointExtension(core),added=await mark(newPoint,f.p);assert.ok(added.event.event_id);assert.equal((await core.auditIntegrity()).passed,true);
  const after=await capture(core,f.dir),oldEvents=new Set(JSON.parse(f.before.originals).map(row=>row.event_id));
  assert.equal(JSON.parse(after.originals).filter(row=>oldEvents.has(row.event_id)).length,count);
  assert.equal(copy(JSON.parse(after.originals).filter(row=>oldEvents.has(row.event_id))),f.before.originals);
  assert.equal(copy(JSON.parse(after.receipts).slice(0,count)),f.before.receipts);
  assert.equal(after.point_count,count+1);
  assert.ok(after.sequence>f.before.sequence||!f.before.sequence_called&&after.sequence===f.before.sequence&&after.sequence_called);
  assert.equal(after.anchor,f.before.anchor);
 }finally{await core?.close();}
});

for(const phase of ['bootstrap_before_audit','bootstrap_during_audit','bootstrap_after_audit','bootstrap_during_persistence','bootstrap_after_checkpoint','bootstrap_after_confirmation'])
 test(`interrupção ${phase}: restart determinístico sem duplicar checkpoint ou registro`,async()=>{
  const f=await historical(1);let core;let hit=false;
  try{
   await assert.rejects(()=>createLabCore(f.dir,{integrityMode:'incremental',integrityTestHook:at=>{if(at===phase){hit=true;throw Error('INTERRUPCAO_SINTETICA');}}}),/INTERRUPCAO_SINTETICA/);
   assert.equal(hit,true);core=await createLabCore(f.dir,{integrityMode:'incremental'});const point=createPointExtension(core);
   assert.equal((await point.verify()).length,1);assert.equal((await core.auditIntegrity()).passed,true);
   assertOld(f.before,await capture(core,f.dir));
   assert.equal(readdirSync(f.dir+'.anchor.json.v2').filter(name=>/^\d{10}\.json$/.test(name)).length,1);
   assert.equal(existsSync(f.dir+'.anchor.json.v2/0000000001.json.pending'),false);
  }finally{await core?.close();}
 });

for(const kind of ['original_old','original_last','receipt_old','receipt_last','sequence','anchor','chain','inventory'])
 test(`histórico ${kind} adulterado: nenhum checkpoint v2 é criado`,async()=>{
  const f=await historical(2);const db=await createLabCore(f.dir,{integrityMode:'full'});
  try{
   if(kind.startsWith('original')){
    await db.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');
    const rows=(await db.db.query('select event_id from lab_time_event order by event_id')).rows;
    await db.db.query("update lab_time_event set collector_version='ADULTERADO' where event_id=$1",[rows[kind==='original_old'?0:1].event_id]);
   }else if(kind.startsWith('receipt')||kind==='chain'){
    await db.db.exec('alter table lab4a.receipt disable trigger all');
    const seq=(await db.db.query('select synthetic_sequence from lab4a.receipt order by synthetic_sequence')).rows;
    await db.db.query(kind==='chain'?"update lab4a.receipt set previous_hash='x' where synthetic_sequence=$1":"update lab4a.receipt set payload_hash=repeat('a',64) where synthetic_sequence=$1",[seq[kind==='receipt_old'?0:1].synthetic_sequence]);
   }else if(kind==='sequence'){
    const row=(await db.db.query("select pg_get_serial_sequence('lab4a.receipt','synthetic_sequence') as name")).rows[0];
    await db.db.query('select setval($1,1,true)',[row.name]);
   }else if(kind==='inventory'){
    await db.db.query("update lab_intent_result set request_hash=repeat('a',64) where event_id=(select event_id from lab_time_event order by event_id limit 1)");
   }
  }finally{await db.close();}
  if(kind==='anchor'){
   const path=f.dir+'.anchor.json',value=JSON.parse(readFileSync(path,'utf8'));value.committed.digest='a'.repeat(64);writeFileSync(path,JSON.stringify(value)+'\n');
  }
  await assert.rejects(()=>createLabCore(f.dir,{integrityMode:'incremental'}));
  assert.equal(existsSync(f.dir+'.anchor.json.v2/0000000001.json'),false);
  assert.equal(existsSync(f.dir+'.anchor.json.v2/0000000001.json.pending'),false);
 });

test('arquivo pending incompleto bloqueia; não promove parcial nem apaga evidência',async()=>{
 const f=await historical(1),dir=f.dir+'.anchor.json.v2';mkdirSync(dir);writeFileSync(resolve(dir,'0000000001.json.pending'),'{"partial":true');
 await assert.rejects(()=>createLabCore(f.dir,{integrityMode:'incremental'}));
 assert.equal(existsSync(resolve(dir,'0000000001.json')),false);assert.equal(readFileSync(resolve(dir,'0000000001.json.pending'),'utf8'),'{"partial":true');
});

test('checkpoint legítimo não silencia RECIBO_ATUAL_DIVERGENTE após adulteração posterior',async()=>{
 const f=await historical(1);const core=await createLabCore(f.dir,{integrityMode:'incremental'});const point=createPointExtension(core);
 try{
  await point.verify();let raw;await core.personalOperation(f.p.authUserId,f.p.employeeId,{sessionId:f.p.sessionId,issuedAt:1},access=>access.checkpoint(db=>{raw=db;}));
  await point.begin(f.p,{idempotency_key:randomUUID()});
  await raw.exec('alter table lab4a.receipt disable trigger all');
  await raw.query("update lab4a.receipt set payload_hash=repeat('a',64) where synthetic_sequence=(select max(synthetic_sequence) from lab4a.receipt)");
  await assert.rejects(()=>point.clock(f.p),error=>error.status===503);
  assert.equal(JSON.parse(readFileSync(f.dir+'.anchor.json.v2/incident.json')).reason,'RECIBO_ATUAL_DIVERGENTE');
 }finally{await core.close();}
});

test('backup v2 após bootstrap 10/10: restore limpo, auditoria e 11ª marcação',async()=>{
 const f=await historical(10),backup=f.dir+'-backup-v2',destination=f.dir+'-restore';let core,restored;
 try{
  core=await createLabCore(f.dir,{integrityMode:'incremental'});createPointExtension(core);assert.equal((await core.auditIntegrity()).passed,true);
  const manifest=await backupCore(core,backup);assert.equal(manifest.format_version,2);
  const result=await restoreDisposable(backup,destination,{anchorPath:destination+'.anchor.json',referenceAnchor:f.dir+'.anchor.json'});
  assert.equal(result.receipts,10);restored=await createLabCore(destination,{integrityMode:'incremental'});
  const point=createPointExtension(restored);assert.equal((await restored.auditIntegrity()).passed,true);
  const before=await capture(restored,destination);assert.equal(before.originals,f.before.originals);assert.equal(before.receipts,f.before.receipts);
  assert.equal(frame(destination).transition.kind,'BOOTSTRAP_CHECKPOINT_V2');
  const added=await mark(point,f.p);assert.ok(added.event.event_id);assert.equal((await restored.auditIntegrity()).passed,true);
  const after=await capture(restored,destination);assert.equal(JSON.parse(after.originals).length,11);assert.equal(JSON.parse(after.receipts).length,11);assert.ok(after.sequence>before.sequence);
 }finally{await restored?.close();await core?.close();}
});
