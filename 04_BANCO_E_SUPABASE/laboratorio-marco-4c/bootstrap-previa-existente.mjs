// Transição única da prévia sintética 10/10. O journal falho fica arquivado,
// com os bytes intactos; somente um histórico integralmente válido é promovido.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {acquireLabLock,recoverAnchor,stateOf} from '../laboratorio-marco-2b/recuperacao.mjs';
import {verifyIntegrity} from '../laboratorio-marco-2b/integridade.mjs';
import {receiptInventoryForBackup} from '../laboratorio-marco-4a/extensao.mjs';
import {createIncrementalIntegrity} from './integridade-incremental.mjs';

const root=resolve(import.meta.dirname,'../..');
const database=resolve(root,'backups/metallo-ponto-lab-pglite-4a');
const anchor=database+'.anchor.json',journal=anchor+'.v2';
const archive=journal+'.failed-20261002-bootstrap-v1';
const evidence=resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap');
const preservation=JSON.parse(readFileSync(resolve(evidence,'preservacao-antes.json'),'utf8'));
const expected=new Map(preservation.files.map(row=>[resolve(root,row.path),row.sha256]));
const hash=value=>createHash('sha256').update(value).digest('hex');
const strictHash=path=>{const actual=hash(readFileSync(path));assert.equal(actual,expected.get(path),'EVIDENCIA_ANTERIOR_DIVERGENTE: '+path);return actual;};
const capture=async db=>{
 const integral=await verifyIntegrity(db);assert.equal(integral.passed,true,'AUDITORIA_INTEGRAL_FALHOU');
 const previous=recoverAnchor(anchor,stateOf(integral.snapshot),{readOnly:true});
 assert.equal(previous.ok,true,'ANCORA_INVALIDA');assert.equal(previous.comparison,'MATCH','ANCORA_DIVERGENTE');
 const receipts=await receiptInventoryForBackup(db);assert.ok(receipts,'RECIBOS_AUSENTES');
 const originals=(await db.query('select * from lab_time_event order by event_id')).rows;
 return {integral,receipts,originals,originals_hash:hash(JSON.stringify(originals)),receipts_hash:hash(JSON.stringify(receipts.receipts)),
  sequence:{last_value:Number(receipts.sequence.last_value),is_called:receipts.sequence.is_called},anchor_hash:hash(readFileSync(anchor))};
};
function archiveState(){
 const originalFiles=['0000000001.json','incident.json'];
 if(existsSync(journal)){
  assert.equal(existsSync(archive),false,'ARQUIVO_FALHO_DUPLICADO');
  assert.deepEqual(readdirSync(journal).sort(),originalFiles.sort(),'JOURNAL_FALHO_INESPERADO');
  const frame=JSON.parse(readFileSync(resolve(journal,'0000000001.json'),'utf8'));
  const incident=JSON.parse(readFileSync(resolve(journal,'incident.json'),'utf8'));
  assert.equal(frame.kind,'base');assert.equal(frame.receipt_checkpoint,null);
  assert.equal(incident.reason,'RECIBO_ATUAL_DIVERGENTE');
  for(const name of originalFiles)strictHash(resolve(journal,name));
  renameSync(journal,archive);
 }else{
  assert.equal(existsSync(archive),true,'JOURNAL_ANTIGO_AUSENTE');
 }
 assert.deepEqual(readdirSync(archive).sort(),originalFiles.sort());
 for(const name of originalFiles){const old=resolve(journal,name),preserved=resolve(archive,name);assert.equal(hash(readFileSync(preserved)),expected.get(old),'ARQUIVO_FALHO_ALTERADO');}
 return originalFiles.map(name=>({name,sha256:hash(readFileSync(resolve(archive,name)))}));
}

let db,unlock;
try{
 assert.ok(existsSync(database)&&existsSync(anchor));
 unlock=acquireLabLock(database);db=new PGlite(database,{relaxedDurability:false});await db.waitReady;
 const before=await capture(db);assert.equal(before.originals.length,10);assert.equal(before.receipts.receipts.length,10);
 assert.equal(before.originals_hash,'4b84d9911964d935f717c38ff17acef769a833c249317a99367c6f3f649f101f');
 assert.deepEqual(before.sequence,{last_value:134,is_called:true});strictHash(anchor);
 mkdirSync(evidence,{recursive:true});
 const preflight=resolve(evidence,'preflight-10-10.json');
 if(!existsSync(preflight))writeFileSync(preflight,JSON.stringify({at:new Date().toISOString(),scope:'LOCAL SYNTHETIC 10/10; no remote',
  originals:10,receipts:10,originals_sha256:before.originals_hash,receipts_sha256:before.receipts_hash,
  sequence:before.sequence,anchor_sha256:before.anchor_hash,integral:true,anchor_match:true},null,2)+'\n',{flag:'wx'});
 else{
  const prior=JSON.parse(readFileSync(preflight,'utf8'));
  assert.equal(prior.originals_sha256,before.originals_hash);assert.equal(prior.receipts_sha256,before.receipts_hash);assert.equal(prior.anchor_sha256,before.anchor_hash);
 }
 const failedFiles=archiveState();
 const integrity=await createIncrementalIntegrity(db,anchor);assert.equal((await integrity.audit()).passed,true);
 const frame=JSON.parse(readFileSync(resolve(journal,'0000000001.json'),'utf8'));
 assert.equal(frame.transition.kind,'BOOTSTRAP_CHECKPOINT_V2');assert.equal(frame.receipt_checkpoint.count,10);
 const after=await capture(db);assert.deepEqual(after.originals,before.originals);assert.deepEqual(after.receipts,before.receipts);
 assert.equal(after.originals_hash,before.originals_hash);assert.equal(after.receipts_hash,before.receipts_hash);
 assert.deepEqual(after.sequence,before.sequence);assert.equal(after.anchor_hash,before.anchor_hash);
 const result={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; Supabase remoto intocado',
  old_journal_archive:archive.replace(root,'<workspace>'),old_journal_files:failedFiles,
  originals_before:10,originals_after:10,originals_sha256:after.originals_hash,
  receipts_before:10,receipts_after:10,receipts_sha256:after.receipts_hash,
  sequence_before:before.sequence,sequence_after:after.sequence,legacy_anchor_sha256:after.anchor_hash,
  checkpoint_sha256:hash(readFileSync(resolve(journal,'0000000001.json'))),transition:frame.transition,
  full_audit_passed:true,source_unchanged:true,remote:false};
 writeFileSync(resolve(evidence,'adocao-10-10.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({passed:true,originals:10,receipts:10,sequence:after.sequence.last_value,checkpoint:result.checkpoint_sha256,old_journal_preserved:true}));
}finally{if(db)await db.close();unlock?.();}
