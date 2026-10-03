// Prova do banco 10/10 real da prévia e de um restore descartável v2.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createLabCore} from '../laboratorio-marco-2b/nucleo.mjs';
import {backupCore,restoreDisposable} from '../laboratorio-marco-2b/backup.mjs';
import {createPointExtension} from '../laboratorio-marco-4a/extensao.mjs';
import {receiptInventoryForBackup} from '../laboratorio-marco-4a/extensao.mjs';

const root=resolve(import.meta.dirname,'../..'),dir=resolve(root,'backups/metallo-ponto-lab-pglite-4a');
const backup=resolve(root,'backups/marco-4c-ensaios/previa-bootstrap-10-10-backup-20261002');
const restoredDir=resolve(root,'backups/marco-4c-ensaios/previa-bootstrap-10-10-restore-20261002');
const evidence=resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap/prova-backup-restore-10-10.json');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const capture=async core=>{
 const originals=(await core.db.query('select * from lab_time_event order by event_id')).rows;
 const receipts=await receiptInventoryForBackup(core.db);
 return {originals,receipts:receipts.receipts,originals_sha256:hash(originals),receipts_sha256:hash(receipts.receipts),sequence:receipts.sequence};
};
let core,restored;
if(process.argv[2]==='auditoria-final'){
 const finalPath=resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap/auditoria-final-15-15.json');
 try{
  assert.equal(existsSync(finalPath),false,'AUDITORIA_FINAL_JA_EXISTE');
  const original=JSON.parse(readFileSync(evidence,'utf8'));
  const http=JSON.parse(readFileSync(resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap/prova-http-cinco-marcas.json'),'utf8'));
  const manifest=JSON.parse(readFileSync(resolve(backup,'manifesto.json'),'utf8'));
  core=await createLabCore(dir,{integrityMode:'incremental',authorizationPath:dir+'.authorization.json'});
  const point=createPointExtension(core),integral=await core.auditIntegrity(),data=await capture(core);
  assert.equal(integral.passed,true);assert.equal((await point.verify()).length,15);
  assert.equal(data.originals.length,15);assert.equal(data.receipts.length,15);
  const oldIds=new Set(manifest.inventory.events.map(row=>row.event_id));
  const historical=data.originals.filter(row=>oldIds.has(row.event_id));
  assert.equal(historical.length,10);assert.equal(hash(historical),original.actual_preview.originals_sha256);
  assert.equal(hash(data.receipts.slice(0,10)),original.actual_preview.receipts_sha256);
  assert.ok(Number(data.sequence.last_value)>original.actual_preview.sequence_before);
  const newIds=new Set(http.receipts.map(row=>row.event_id));assert.equal(newIds.size,5);
  assert.equal(data.originals.filter(row=>newIds.has(row.event_id)).length,5);
  assert.equal(data.receipts.filter(row=>newIds.has(row.event_id)).length,5);
  const first=readFileSync(resolve(dir+'.anchor.json.v2','0000000001.json'));
  const adoption=JSON.parse(readFileSync(resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap/adocao-10-10.json'),'utf8'));
  assert.equal(createHash('sha256').update(first).digest('hex'),adoption.checkpoint_sha256);
  assert.equal(existsSync(resolve(dir+'.anchor.json.v2','incident.json')),false);
  const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; Supabase remoto intocado',
   originals:15,receipts:15,old_originals:10,old_receipts:10,new_originals:5,new_receipts:5,
   historical_originals_unchanged:true,historical_receipts_unchanged:true,
   old_checkpoint_unchanged:true,sequence_before:original.actual_preview.sequence_before,
   sequence_after:Number(data.sequence.last_value),sequence_monotonic:true,full_audit:integral.passed,
   incident:false,remote:false,passed:true};
  writeFileSync(finalPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({passed:true,originals:15,receipts:15,old:'10/10',new:'5/5',sequence:report.sequence_after}));
 }finally{await core?.close();}
}else{
try{
 assert.equal(existsSync(backup),false,'BACKUP_DESTINO_JA_EXISTE');
 assert.equal(existsSync(restoredDir),false,'RESTORE_DESTINO_JA_EXISTE');
 assert.equal(existsSync(evidence),false,'PROVA_JA_EXISTE');
 core=await createLabCore(dir,{integrityMode:'incremental',authorizationPath:dir+'.authorization.json'});
 const point=createPointExtension(core);
 assert.equal((await core.auditIntegrity()).passed,true);
 assert.equal((await point.verify()).length,10);
 assert.deepEqual(readdirSync(dir+'.anchor.json.v2'),['0000000001.json']);
 const before=await capture(core);assert.equal(before.originals.length,10);assert.equal(before.receipts.length,10);
 const manifest=await backupCore(core,backup);assert.equal(manifest.format_version,2);
 const restore=await restoreDisposable(backup,restoredDir,{anchorPath:restoredDir+'.anchor.json',referenceAnchor:dir+'.anchor.json'});
 assert.equal(restore.receipts,10);
 restored=await createLabCore(restoredDir,{integrityMode:'incremental'});
 const restoredPoint=createPointExtension(restored);
 const recovered=await capture(restored);assert.equal(recovered.originals_sha256,before.originals_sha256);
 assert.equal(recovered.receipts_sha256,before.receipts_sha256);
 assert.equal((await restored.auditIntegrity()).passed,true);assert.equal((await restoredPoint.verify()).length,10);
 const person=(await restored.db.query('select * from lab_context order by auth_user_id limit 1')).rows[0];
 assert.ok(person);await restored.seedSynthetic({authUserId:person.auth_user_id,employeeId:person.source_employee_id,
  workerRef:person.worker_ref,employmentRef:person.employment_ref,validMinutes:1440});
 const p={authUserId:person.auth_user_id,employeeId:person.source_employee_id,sessionId:randomUUID(),issuedAt:1};
 const idempotency_key=randomUUID();await restoredPoint.begin(p,{idempotency_key});
 const result=await restoredPoint.finish(p,{idempotency_key,location:{status:'DENIED'}});
 assert.ok(result.event.event_id);assert.equal((await restored.auditIntegrity()).passed,true);
 const next=await capture(restored);assert.equal(next.originals.length,11);assert.equal(next.receipts.length,11);
 assert.equal(hash(next.originals.filter(row=>before.originals.some(old=>old.event_id===row.event_id))),before.originals_sha256);
 assert.equal(hash(next.receipts.slice(0,10)),before.receipts_sha256);
 assert.ok(Number(next.sequence.last_value)>Number(before.sequence.last_value));
 const actualAfter=await capture(core);assert.equal(actualAfter.originals_sha256,before.originals_sha256);
 assert.equal(actualAfter.receipts_sha256,before.receipts_sha256);
 const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; restore descartável, Supabase remoto intocado',
  actual_preview:{originals:10,receipts:10,originals_sha256:before.originals_sha256,receipts_sha256:before.receipts_sha256,
   sequence_before:Number(before.sequence.last_value),sequence_after:Number(actualAfter.sequence.last_value),full_audit:true},
  backup:{format_version:manifest.format_version,archive_sha256:manifest.archive_sha256,reference:manifest.reference,
   path:backup.replace(root,'<workspace>')},
  disposable_restore:{originals_before:10,receipts_before:10,originals_after:11,receipts_after:11,
   exact_originals:true,exact_receipts:true,new_marking:true,full_audit:true,sequence_after:Number(next.sequence.last_value),
   path:restoredDir.replace(root,'<workspace>')},remote:false,passed:true};
 writeFileSync(evidence,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({passed:true,backup_format:2,actual:'10/10',restored:'10/10 + 1',sequence:Number(next.sequence.last_value)}));
}finally{await restored?.close();await core?.close();}
}
