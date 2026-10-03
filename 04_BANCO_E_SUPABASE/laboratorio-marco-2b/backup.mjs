// Backup consistente sob a fila exclusiva do núcleo. Restore sempre em diretório novo.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { inventory, sha256, verifyIntegrity } from './integridade.mjs';
import { atomicJson, initializeAnchor, readAnchor, stateOf } from './recuperacao.mjs';
import { createIncrementalIntegrity } from '../laboratorio-marco-4c/integridade-incremental.mjs';
import { receiptInventoryForBackup } from '../laboratorio-marco-4a/extensao.mjs';

export const BASELINE = {id:'METALLO-2B-LAB-20260927-R1',sha256:'7df0935cd75e5b1e822b08fbaf40f53f2b1f4f8c98b5d2dcdb10610c4928b1d0'};
export async function backupCore(core,directory,{formatVersion=core.integrityMode==='incremental'?2:1,testHook}={}) {
  if(existsSync(directory))throw Error('DESTINO_BACKUP_JA_EXISTE');
  if(formatVersion===2)return backupV2(core,directory,testHook);
  if(formatVersion!==1)throw Error('FORMATO_BACKUP_INVALIDO');
  return core.checkpoint(async(db,snapshot,anchorPath)=>{
    const validation=await verifyIntegrity(db);if(!validation.passed)throw Error('INTEGRIDADE_INVALIDA');
    const state=stateOf(snapshot),anchor=anchorPath?readAnchor(anchorPath):{format_version:1,committed:state,pending:null};
    if(anchor.pending||JSON.stringify(anchor.committed)!==JSON.stringify(state))throw Error('ANCORA_DIVERGENTE');
    await db.syncToFs(false);
    const dump=Buffer.from(await (await db.dumpDataDir('gzip')).arrayBuffer());
    const manifest={format_version:1,scope:'SIMULAÇÃO SEM VALOR OFICIAL',origin:BASELINE,at:new Date().toISOString(),
      runtime:{pglite:'0.5.8',node:process.version},state,anchor,inventory:snapshot,archive:'database.tar.gz',archive_sha256:sha256(dump),
      mechanism:'dumpDataDir com fila exclusiva: nenhum writer concorrente; snapshot E/R/metadados e âncora conferidos no mesmo corte',
      contains_auth_database:false,contains_credentials:false};
    mkdirSync(directory,{recursive:true});
    const fd=openSync(resolve(directory,'database.tar.gz'),'wx');try{writeFileSync(fd,dump);fsyncSync(fd);}finally{closeSync(fd);}
    atomicJson(resolve(directory,'manifesto.json'),manifest);
    if(sha256(readFileSync(resolve(directory,'database.tar.gz')))!==manifest.archive_sha256)throw Error('BACKUP_RELEITURA_DIVERGENTE');
    return manifest;
  });
}
export async function restoreDisposable(backupDir,destination,{anchorPath,referenceAnchor,testHook}={}) {
  if(existsSync(destination))throw Error('RESTORE_DESTINO_JA_EXISTE');
  if(!anchorPath||existsSync(anchorPath))throw Error('RESTORE_ANCORA_DESTINO_INVALIDA');
  const manifest=JSON.parse(readFileSync(resolve(backupDir,'manifesto.json'),'utf8'));
  if(manifest.format_version===2)return restoreV2(backupDir,destination,manifest,{anchorPath,referenceAnchor,testHook});
  if(manifest.format_version!==1||manifest.archive!=='database.tar.gz'||manifest.origin?.sha256!==BASELINE.sha256)throw Error('MANIFESTO_INVALIDO');
  const dump=readFileSync(resolve(backupDir,'database.tar.gz'));
  if(sha256(dump)!==manifest.archive_sha256)throw Error('BACKUP_HASH_INVALIDO');
  mkdirSync(destination,{recursive:true});
  const db=new PGlite(destination,{loadDataDir:new Blob([dump]),relaxedDurability:false});
  try{
    await db.waitReady;const check=await verifyIntegrity(db);
    if(!check.passed||JSON.stringify(await inventory(db))!==JSON.stringify(manifest.inventory))throw Error('RESTORE_CONTEUDO_DIVERGENTE');
  }finally{await db.close();}
  // A referência atual é obrigatória para retomada. A âncora antiga só identifica o corte restaurado.
  if(referenceAnchor)atomicJson(anchorPath,readAnchor(referenceAnchor));
  return {passed:true,exact_inventory:true,event_count:manifest.state.event_count,recovery_epoch:manifest.state.recovery_epoch,
    ready_authorized:false,reference_anchor_available:Boolean(referenceAnchor),anchor_source:referenceAnchor?'referência externa atual; startup ainda deve confrontá-la':'ausente; RECOVERY_REQUIRED',manifest};
}

function durable(path,raw){const fd=openSync(path,'wx');try{writeFileSync(fd,raw);fsyncSync(fd);}finally{closeSync(fd);}}
function journal(anchorPath){
 const dir=anchorPath+'.v2';if(existsSync(resolve(dir,'incident.json')))throw Error('JOURNAL_INCIDENTE');
 const names=readdirSync(dir).filter(n=>/^\d{10}\.json$/.test(n)).sort();if(!names.length)throw Error('JOURNAL_AUSENTE');let previous=null;
 const files=names.map((name,i)=>{const raw=readFileSync(resolve(dir,name)),value=JSON.parse(raw);
  if(name!==String(i+1).padStart(10,'0')+'.json'||value.format_version!==2||value.revision!==i+1||value.previous_frame_hash!==previous)throw Error('CADEIA_CHECKPOINT_INVALIDA');
  previous=sha256(raw);return {name,sha256:previous,raw,value};});
 if(files.at(-1).value.kind==='prepare')throw Error('JOURNAL_PENDING');return files;
}
async function backupV2(core,directory,testHook){
 if(core.integrityMode!=='incremental')throw Error('BACKUP_V2_EXIGE_INCREMENTAL');
 return core.checkpoint(async(db,snapshot,anchorPath)=>{
  const validation=await verifyIntegrity(db);if(!validation.passed)throw Error('INTEGRIDADE_INVALIDA');
  const frames=journal(anchorPath),receiptSnapshot=await receiptInventoryForBackup(db),head=frames.at(-1).value;
  if(head.committed.event_count!==snapshot.events.length||head.committed.recovery_epoch!==snapshot.metadata[0].recovery_epoch)throw Error('JOURNAL_BANCO_DIVERGENTE');
  await db.syncToFs(false);const dump=Buffer.from(await (await db.dumpDataDir('gzip')).arrayBuffer());
  const manifest={format_version:2,completed:true,scope:'SIMULAÇÃO SEM VALOR OFICIAL',origin:BASELINE,at:new Date().toISOString(),
   archive:'database.tar.gz',archive_sha256:sha256(dump),inventory:snapshot,state:head.committed,legacy_anchor:readAnchor(anchorPath),
   receipt_snapshot:receiptSnapshot,receipt_sha256:sha256(JSON.stringify(receiptData(receiptSnapshot))),
   sequence_policy:'MONOTONIC_NO_REUSE; recuperação física pode avançar contador reservado, sem alterar recibos históricos',
   journal:frames.map(f=>({name:f.name,sha256:f.sha256})),reference:{revision:frames.length,sha256:frames.at(-1).sha256},
   mechanism:'Corte exclusivo + auditoria integral; arquivos novos duráveis; manifesto publicado por último',
   contains_auth_database:false,contains_credentials:false,authorization_restored:false};
  mkdirSync(directory,{recursive:true});mkdirSync(resolve(directory,'journal'));
  durable(resolve(directory,'database.tar.gz'),dump);await testHook?.('backup_after_dump');
  for(const f of frames)durable(resolve(directory,'journal',f.name),f.raw);
  if(sha256(readFileSync(resolve(directory,'database.tar.gz')))!==manifest.archive_sha256)throw Error('BACKUP_RELEITURA_DIVERGENTE');
  await testHook?.('backup_before_manifest');durable(resolve(directory,'manifesto.json'),JSON.stringify(manifest)+'\n');return manifest;
 });
}
async function restoreV2(backupDir,destination,manifest,{anchorPath,referenceAnchor,testHook}){
 if(!manifest.completed||manifest.archive!=='database.tar.gz'||manifest.origin?.sha256!==BASELINE.sha256||!Array.isArray(manifest.journal)||!manifest.journal.length)throw Error('MANIFESTO_INVALIDO');
 const dump=readFileSync(resolve(backupDir,manifest.archive));if(sha256(dump)!==manifest.archive_sha256)throw Error('BACKUP_HASH_INVALIDO');
 for(const [i,row] of manifest.journal.entries()){
  if(row.name!==String(i+1).padStart(10,'0')+'.json'||sha256(readFileSync(resolve(backupDir,'journal',row.name)))!==row.sha256)throw Error('BACKUP_JOURNAL_INVALIDO');
 }
 if(manifest.reference?.revision!==manifest.journal.length||manifest.reference.sha256!==manifest.journal.at(-1).sha256)throw Error('BACKUP_REFERENCIA_INVALIDA');
 // Primeiro guard e somente depois os frames. Restore parcial nunca pode ser READY.
 const verification=destination+'.verification.anchor.json';durable(verification,JSON.stringify(manifest.legacy_anchor)+'\n');
 const verificationDir=verification+'.v2';mkdirSync(verificationDir,{recursive:true});
 for(const row of manifest.journal)durable(resolve(verificationDir,row.name),readFileSync(resolve(backupDir,'journal',row.name)));
 mkdirSync(destination,{recursive:true});const db=new PGlite(destination,{loadDataDir:new Blob([dump]),relaxedDurability:false});
 try{
  await db.waitReady;await testHook?.('restore_after_database');const check=await verifyIntegrity(db);
  if(!check.passed||JSON.stringify(await inventory(db))!==JSON.stringify(manifest.inventory))throw Error('RESTORE_CONTEUDO_DIVERGENTE');
  const restoredReceipts=await receiptInventoryForBackup(db);
  if(sha256(JSON.stringify(receiptData(restoredReceipts)))!==manifest.receipt_sha256)throw Error('RESTORE_RECIBO_DIVERGENTE');
  const expectedSequence=manifest.receipt_snapshot?.sequence,actualSequence=restoredReceipts?.sequence;
  if(expectedSequence&&(!actualSequence||Number(actualSequence.last_value)<Number(expectedSequence.last_value)||expectedSequence.is_called&&!actualSequence.is_called))throw Error('RESTORE_SEQUENCIA_REGREDIDA');
  manifest.restored_sequence_observed=actualSequence;
  const integrity=await createIncrementalIntegrity(db,verification);await integrity.audit();
 }finally{await db.close();}
 if(referenceAnchor){
  const reference=journal(referenceAnchor),dir=anchorPath+'.v2';if(existsSync(dir))throw Error('RESTORE_JOURNAL_DESTINO_EXISTE');mkdirSync(dir,{recursive:true});
  const guard={format_version:2,revision:reference.length,sha256:reference.at(-1).sha256};
  durable(resolve(dir,'restore-guard.json'),JSON.stringify(guard)+'\n');
  for(const f of reference){durable(resolve(dir,f.name),f.raw);await testHook?.('restore_during_reference');}
  durable(anchorPath,JSON.stringify(readAnchor(referenceAnchor))+'\n');
  await testHook?.('restore_before_completion');durable(resolve(dir,'restore-complete.json'),JSON.stringify(guard)+'\n');
 }
 return {passed:true,format_version:2,exact_inventory:true,event_count:manifest.state.event_count,recovery_epoch:manifest.state.recovery_epoch,
  receipts:manifest.receipt_snapshot?.receipts.length??0,receipt_sequence_before:manifest.receipt_snapshot?.sequence,receipt_sequence:manifest.restored_sequence_observed,
  ready_authorized:false,reference_anchor_available:Boolean(referenceAnchor),authorization_restored:false,
  anchor_source:referenceAnchor?'referência externa atual v2; startup deve confrontar banco e Auth atuais':'ausente; RECOVERY_REQUIRED',manifest};
}
function receiptData(value){return value?{intents:value.intents,contexts:value.contexts,receipts:value.receipts}:null;}
