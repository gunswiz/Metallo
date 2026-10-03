// Provas do formato v2. Diretórios novos sintéticos; v1 permanece selecionável.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cpSync,mkdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { backupCore,restoreDisposable } from '../laboratorio-marco-2b/backup.mjs';
import { createPointExtension,installExtension } from '../laboratorio-marco-4a/extensao.mjs';
const root=resolve(import.meta.dirname,'../..'),base=resolve(root,'backups/marco-4c-ensaios');mkdirSync(base,{recursive:true});
async function fixture(){
 const dir=resolve(base,'backup-v2-'+randomUUID()),p={authUserId:randomUUID(),employeeId:randomUUID(),sessionId:randomUUID(),issuedAt:1};
 let core=await createLabCore(dir,{mode:'create'});await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:'LAB-W',employmentRef:'LAB-V',validMinutes:60});await installExtension(core);await core.close();
 core=await createLabCore(dir,{integrityMode:'incremental'});const point=createPointExtension(core);
 const mark=async()=>{const key=randomUUID();await point.begin(p,{idempotency_key:key});return point.finish(p,{idempotency_key:key,location:{status:'DENIED'}});};await mark();await mark();
 return {dir,p,core,point,mark,backup:dir+'-backup',destination:dir+'-restore'};
}
test('v2 backup/restore integral: originais, recibos, sequence e checkpoint; novo append/retry',async()=>{
 const f=await fixture();let restored;try{
  const before=JSON.stringify((await f.core.db.query('select * from lab_time_event order by event_id')).rows),m=await backupCore(f.core,f.backup);assert.equal(m.format_version,2);
  const anchorPath=f.destination+'.anchor.json';const r=await restoreDisposable(f.backup,f.destination,{anchorPath,referenceAnchor:f.dir+'.anchor.json'});assert.equal(r.exact_inventory,true);assert.equal(r.receipts,2);assert.equal(r.ready_authorized,false);
  restored=await createLabCore(f.destination,{anchorPath,integrityMode:'incremental'});const point=createPointExtension(restored);
  assert.equal((await restored.auditIntegrity()).passed,true);assert.equal(JSON.stringify((await restored.db.query('select * from lab_time_event order by event_id')).rows),before);assert.equal((await point.verify()).length,2);
  const key=randomUUID();await point.begin(f.p,{idempotency_key:key});const a=await point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}}),b=await point.finish(f.p,{idempotency_key:key,location:{status:'DENIED'}});assert.equal(a.event.event_id,b.event.event_id);assert.equal(b.duplicate,true);assert.equal((await point.verify()).length,3);
 }finally{await restored?.close();await f.core.close();}
});
test('v1 explícito continua recusando nova raiz v2 sem criar backup falso',async()=>{const f=await fixture();try{await assert.rejects(()=>backupCore(f.core,f.backup,{formatVersion:1}),/ANCORA_DIVERGENTE/);assert.equal(existsSync(f.backup),false);}finally{await f.core.close();}});
for(const kind of ['dump','journal','receipt','sequence'])test('backup v2 adulterado '+kind+' não produz restore aprovado',async()=>{
 const f=await fixture();try{await backupCore(f.core,f.backup);const copy=f.backup+'-tampered';cpSync(f.backup,copy,{recursive:true,errorOnExist:true,force:false});
  if(kind==='dump')writeFileSync(resolve(copy,'database.tar.gz'),'CORRUPCAO');
  else if(kind==='journal')writeFileSync(resolve(copy,'journal/0000000001.json'),'{}\n');
  else {const path=resolve(copy,'manifesto.json'),m=JSON.parse(readFileSync(path));if(kind==='receipt')m.receipt_sha256='a'.repeat(64);else m.receipt_snapshot.sequence.last_value=999; // estado esperado falsificado sem rehash: restore deve confrontar
   writeFileSync(path,JSON.stringify(m));}
  await assert.rejects(()=>restoreDisposable(copy,f.destination,{anchorPath:f.destination+'.anchor.json',referenceAnchor:f.dir+'.anchor.json'}));assert.equal(existsSync(f.destination+'.anchor.json'),false);
 }finally{await f.core.close();}
});
test('restore antigo usa referência atual e falha fechado; não rebaixa epoch',async()=>{const f=await fixture();try{await backupCore(f.core,f.backup);await f.mark();const r=await restoreDisposable(f.backup,f.destination,{anchorPath:f.destination+'.anchor.json',referenceAnchor:f.dir+'.anchor.json'});assert.equal(r.ready_authorized,false);await assert.rejects(()=>createLabCore(f.destination,{integrityMode:'incremental'}),e=>e.status===503);}finally{await f.core.close();}});
test('restore sem referência externa não autoriza retomada',async()=>{const f=await fixture();try{await backupCore(f.core,f.backup);const r=await restoreDisposable(f.backup,f.destination,{anchorPath:f.destination+'.anchor.json'});assert.equal(r.reference_anchor_available,false);assert.equal(r.ready_authorized,false);assert.equal(existsSync(f.destination+'.anchor.json'),false);await assert.rejects(()=>createLabCore(f.destination,{integrityMode:'incremental'}));}finally{await f.core.close();}});
for(const phase of ['backup_after_dump','backup_before_manifest'])test('interrupção backup '+phase+': nenhum manifesto de sucesso',async()=>{const f=await fixture();try{let hit=false;await assert.rejects(()=>backupCore(f.core,f.backup,{testHook:p=>{if(p===phase){hit=true;throw Error('INTERRUPCAO_SINTETICA');}}}),/INTERRUPCAO_SINTETICA/);assert.equal(hit,true);assert.equal(existsSync(resolve(f.backup,'manifesto.json')),false);await assert.rejects(()=>restoreDisposable(f.backup,f.destination,{anchorPath:f.destination+'.anchor.json'}));assert.equal((await f.core.inspect()).ready_for_new_events,true);}finally{await f.core.close();}});
for(const phase of ['restore_after_database','restore_during_reference','restore_before_completion'])test('interrupção restore '+phase+': startup parcial bloqueado',async()=>{const f=await fixture();try{await backupCore(f.core,f.backup);let hit=false;await assert.rejects(()=>restoreDisposable(f.backup,f.destination,{anchorPath:f.destination+'.anchor.json',referenceAnchor:f.dir+'.anchor.json',testHook:p=>{if(p===phase){hit=true;throw Error('INTERRUPCAO_SINTETICA');}}}),/INTERRUPCAO_SINTETICA/);assert.equal(hit,true);await assert.rejects(()=>createLabCore(f.destination,{integrityMode:'incremental'}));}finally{await f.core.close();}});
for(const kind of ['backup','restore'])test('encerramento abrupto de processo durante '+kind+' não permite falso READY',async()=>{
 const f=await fixture();try{await backupCore(f.core,f.backup);await f.core.close();
  const code=kind==='backup'?`import {createLabCore} from './04_BANCO_E_SUPABASE/laboratorio-marco-2b/nucleo.mjs';import {backupCore} from './04_BANCO_E_SUPABASE/laboratorio-marco-2b/backup.mjs';const [d,b]=process.argv.slice(1);const c=await createLabCore(d,{integrityMode:'incremental'});await backupCore(c,b,{testHook:p=>{if(p==='backup_before_manifest')process.exit(72)}});`:
   `import {restoreDisposable} from './04_BANCO_E_SUPABASE/laboratorio-marco-2b/backup.mjs';const [b,d,ref]=process.argv.slice(1);await restoreDisposable(b,d,{anchorPath:d+'.anchor.json',referenceAnchor:ref,testHook:p=>{if(p==='restore_before_completion')process.exit(72)}});`;
  const args=kind==='backup'?[f.dir,f.backup+'-abrupt']:[f.backup,f.destination,f.dir+'.anchor.json'];const child=spawnSync(process.execPath,['--input-type=module','-e',code,...args],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(child.status,72,child.stderr);
  if(kind==='backup')assert.equal(existsSync(resolve(f.backup+'-abrupt','manifesto.json')),false);else await assert.rejects(()=>createLabCore(f.destination,{integrityMode:'incremental'}));
 }finally{try{await f.core.close();}catch{}}
});
