// Prova indutiva opt-in R5. Auditoria integral continua sendo autoridade do passado.
// Journal v2 usa arquivos novos wx/fsync/close: não substitui arquivo aberto.
import { existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { eventDigest,eventHash,sha256,verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
import { recoverAnchor,stateOf } from '../laboratorio-marco-2b/recuperacao.mjs';
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';
import { receiptInventoryForBackup } from '../laboratorio-marco-4a/extensao.mjs';
const digest=v=>sha256(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=v=>JSON.parse(JSON.stringify(v));
export async function createIncrementalIntegrity(db,anchorPath,{measure=(n,f)=>f(),testHook}={}){
 if(!anchorPath)throw Error('INCREMENTAL_EXIGE_ANCORA_PERSISTENTE');
 const dir=anchorPath+'.v2',incidentPath=resolve(dir,'incident.json');let head,number=0,headHash,dirty=true,revision=0,checkExtra=null,receiptCheckpoint=null,bootstrapped=false;
 const file=n=>resolve(dir,String(n).padStart(10,'0')+'.json');
 function incident(reason){if(!existsSync(incidentPath))writeFileSync(incidentPath,JSON.stringify({at:new Date().toISOString(),reason,action:'RECOVERY_REQUIRED',originals_modified:false})+'\n',{flag:'wx'});throw new LabError(503,'RECUPERACAO_NECESSARIA');}
 function append(value){const frame={format_version:2,revision:number+1,previous_frame_hash:headHash??null,receipt_checkpoint:receiptCheckpoint,...value};const text=JSON.stringify(frame)+'\n',fd=openSync(file(number+1),'wx');try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}number++;head=frame;headHash=sha256(text);return frame;}
 const receiptState=value=>value?{count:value.receipts.length,sequence:value.receipts.at(-1)?.synthetic_sequence??null,hash:value.receipts.at(-1)?.payload_hash??null}:null;
 const pendingBase=resolve(dir,'0000000001.json.pending');
 async function bootstrap(){
  const files=readdirSync(dir);if(files.some(name=>name!=='0000000001.json.pending'))throw Error('JOURNAL_INCOMPLETO');
  await testHook?.('bootstrap_before_audit');
  const check=await verifyIntegrity(db);await testHook?.('bootstrap_during_audit');
  if(!check.passed)throw Error('BASE_INICIAL_NAO_COMPROVADA');
  const committed=stateOf(check.snapshot),anchor=recoverAnchor(anchorPath,committed,{readOnly:true});
  if(!anchor.ok||anchor.comparison!=='MATCH')throw Error('BASE_INICIAL_ANCORA_DIVERGENTE');
  const receipts=await receiptInventoryForBackup(db),checkpoint=receiptState(receipts);
  // A cadeia, os vínculos e a sequência já foram validados pelo inventário de recibos.
  // O frame inicial só descreve este corte; nunca escreve no banco ou na âncora v1.
  const evidence={previous_format:1,new_format:2,previous_anchor_sha256:sha256(readFileSync(anchorPath)),original_count:check.snapshot.events.length,
   receipt_count:receipts?.receipts.length??0,receipt_inventory_sha256:receipts?digest(receipts):null,audit_result:'PASS',audit_digest:committed.digest};
  await testHook?.('bootstrap_after_audit');
  let frame,text;
  if(existsSync(pendingBase)){
   text=readFileSync(pendingBase,'utf8');frame=JSON.parse(text);
   if(frame.format_version!==2||frame.revision!==1||frame.previous_frame_hash!==null||frame.kind!=='base'||!same(frame.committed,committed)||!same(frame.receipt_checkpoint,checkpoint)||
    !frame.transition||Object.entries(evidence).some(([key,value])=>!same(frame.transition[key],value)))throw Error('BOOTSTRAP_PARCIAL_DIVERGENTE');
  }else{
   frame={format_version:2,revision:1,previous_frame_hash:null,receipt_checkpoint:checkpoint,kind:'base',committed,tail:null,
    transition:{kind:'BOOTSTRAP_CHECKPOINT_V2',server_at:new Date().toISOString(),...evidence}};
   text=JSON.stringify(frame)+'\n';const fd=openSync(pendingBase,'wx');try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}
  }
  await testHook?.('bootstrap_during_persistence');
  renameSync(pendingBase,file(1));number=1;head=frame;headHash=sha256(text);receiptCheckpoint=checkpoint;bootstrapped=true;
  await testHook?.('bootstrap_after_checkpoint');
 }
 function load(){
  const names=readdirSync(dir).filter(n=>/^\d{10}\.json$/.test(n)).sort();if(!names.length)throw Error('JOURNAL_AUSENTE');
  const guardPath=resolve(dir,'restore-guard.json');if(existsSync(guardPath)){
   const guard=JSON.parse(readFileSync(guardPath)),complete=resolve(dir,'restore-complete.json');
   if(!existsSync(complete)||!same(JSON.parse(readFileSync(complete)),guard)||!Number.isInteger(guard.revision)||guard.revision<1||guard.revision>names.length||sha256(readFileSync(file(guard.revision)))!==guard.sha256)throw Error('RESTORE_INCOMPLETO');
  }
  let prior=null,frames=[];for(let i=0;i<names.length;i++){if(names[i]!==String(i+1).padStart(10,'0')+'.json')throw Error('SEQUENCIA_CHECKPOINT');
   const text=readFileSync(resolve(dir,names[i]),'utf8'),frame=JSON.parse(text);if(frame.format_version!==2||frame.revision!==i+1||frame.previous_frame_hash!==prior)throw Error('CADEIA_CHECKPOINT');frames.push(frame);prior=sha256(text);}
  number=frames.length;head=frames.at(-1);headHash=prior;return frames;
 }
 const pair=s=>({event:s.event,result:s.result});
 const leaf=s=>digest(pair(s));
 async function eventPair(handle,id){const event=(await handle.query('select * from lab_time_event where event_id=$1',[id])).rows[0],result=(await handle.query('select * from lab_intent_result where event_id=$1',[id])).rows[0];
  const imprecise=(await handle.query("select count(*)::int as n from lab_time_event where event_id=$1 and (date_trunc('milliseconds',server_received_at_utc)<>server_received_at_utc or date_trunc('milliseconds',server_committed_at_utc)<>server_committed_at_utc)",[id])).rows[0].n;
  if(imprecise||!event||!result||eventHash(event)!==event.payload_hash||result.event_id!==event.event_id||result.auth_user_id!==event.auth_user_id||result.idempotency_key!==event.idempotency_key||result.request_hash!==sha256('[1]'))throw Error('FOLHA_INVALIDA');return plain({event,result});}
 function next(before,id,hash){return {database_id:before.database_id,recovery_epoch:before.recovery_epoch+1,event_count:before.event_count+1,digest:digest([2,before.digest,id,hash])};}
 async function audit({recover=false}={}){return measure('core.integrity_full',async()=>{
  if(existsSync(incidentPath))throw new LabError(503,'RECUPERACAO_NECESSARIA');
  try{
   await testHook?.('during_full_audit');const check=await verifyIntegrity(db);if(!check.passed)throw Error('AUDITORIA_ORIGINAL_INVALIDA');
   const snapshot=check.snapshot,frames=load(),base=frames[0];if(base.kind!=='base'||!same(base.committed,stateOf({...snapshot,events:snapshot.events.filter(e=>!frames.some(f=>f.kind==='prepare'&&f.event_id===e.event_id)),results:snapshot.results.filter(r=>!frames.some(f=>f.kind==='prepare'&&f.event_id===r.event_id)),metadata:[{...snapshot.metadata[0],recovery_epoch:base.committed.recovery_epoch}]})))throw Error('BASE_DIVERGENTE');
   if(base.transition&&(base.transition.kind!=='BOOTSTRAP_CHECKPOINT_V2'||base.transition.previous_format!==1||base.transition.new_format!==2||base.transition.original_count!==base.committed.event_count||base.transition.receipt_count!==(base.receipt_checkpoint?.count??0)||base.transition.audit_result!=='PASS'||base.transition.audit_digest!==base.committed.digest))throw Error('TRANSICAO_CHECKPOINT_INVALIDA');
   receiptCheckpoint=base.receipt_checkpoint??null;let committed=base.committed,pending=null,tail=null;const map=new Map(snapshot.events.map(e=>[e.event_id,e])),results=new Map(snapshot.results.map(r=>[r.event_id,r]));
   for(const frame of frames.slice(1)){
    if(frame.kind==='prepare'){
     if(pending||!same(frame.before,committed)||!same(frame.pending,next(committed,frame.event_id,frame.leaf)))throw Error('CHECKPOINT_DIVERGENTE');pending=frame;
    }else if(frame.kind==='commit'){
     if(!pending||!same(frame.committed,pending.pending))throw Error('COMMIT_CHECKPOINT_INVALIDO');const p={event:map.get(pending.event_id),result:results.get(pending.event_id)};
     if(!p.event||!p.result||leaf(p)!==pending.leaf)throw Error('ORIGINAL_CHECKPOINT_DIVERGENTE');committed=frame.committed;tail={id:pending.event_id,leaf:pending.leaf};pending=null;
    }else if(frame.kind==='abort'){if(!pending||!same(frame.committed,committed)||map.has(pending.event_id))throw Error('ABORT_CHECKPOINT_INVALIDO');pending=null;}
    else if(frame.kind==='receipt'){if(pending||!same(frame.committed,committed)||!frame.receipt_checkpoint)throw Error('RECIBO_CHECKPOINT_INVALIDO');}
    else throw Error('FORMATO_CHECKPOINT_INVALIDO');
    receiptCheckpoint=frame.receipt_checkpoint??null;
   }
   const meta=snapshot.metadata[0],actual={database_id:meta.database_id,recovery_epoch:meta.recovery_epoch,event_count:snapshot.events.length};
   const expected=s=>same(actual,{database_id:s.database_id,recovery_epoch:s.recovery_epoch,event_count:s.event_count});
   if(pending){
    if(expected(committed)&&!map.has(pending.event_id)){if(!recover)throw Error('PENDING_ABORTADO');append({kind:'abort',committed,tail});}
    else if(expected(pending.pending)&&leaf({event:map.get(pending.event_id),result:results.get(pending.event_id)})===pending.leaf){if(!recover)throw Error('PENDING_COMMITADO');committed=pending.pending;tail={id:pending.event_id,leaf:pending.leaf};append({kind:'commit',committed,tail});}
    else throw Error('PENDING_BANCO_DIVERGENTE');
   }else if(!expected(committed))throw Error('EPOCH_OU_CONTAGEM_DIVERGENTE');
   const actualReceipts=receiptState(await receiptInventoryForBackup(db));
   // Base v2 antiga sem recibos continua válida; recibos preexistentes exigem
   // checkpoint explícito, nunca uma correção silenciosa em caso de diferença.
   if(!same(receiptCheckpoint,actualReceipts)&&!(receiptCheckpoint===null&&actualReceipts?.count===0))throw Error('RECIBO_CHECKPOINT_DIVERGENTE');
   if(checkExtra)await checkExtra(db,true,receiptCheckpoint);dirty=false;return {...check,incremental:true,root:committed.digest,revision};
  }catch(e){if(e instanceof LabError)throw e;incident(/^[A-Z_]+$/.test(e.message)?e.message:'AUDITORIA_INACESSIVEL');}
 });}
 mkdirSync(dir,{recursive:true});
 if(!existsSync(file(1)))await bootstrap();
 await audit({recover:true});if(bootstrapped)await testHook?.('bootstrap_after_confirmation');
 async function fast(){return measure('core.integrity_incremental',async()=>{
  if(dirty)return audit();if(existsSync(incidentPath))throw new LabError(503,'RECUPERACAO_NECESSARIA');
  try{
   if(sha256(readFileSync(file(number)))!==headHash||existsSync(file(number+1))||!head.committed)throw Error('CHECKPOINT_ATUAL_DIVERGENTE');
   const m=(await db.query('select * from lab_recovery_state')).rows[0],counts=(await db.query('select (select count(*)::int from lab_time_event) as e,(select count(*)::int from lab_intent_result) as r')).rows[0];
   if(m.database_id!==head.committed.database_id||m.schema_version!==2||m.recovery_epoch!==head.committed.recovery_epoch||counts.e!==head.committed.event_count||counts.r!==counts.e)throw Error('CONTAGEM_OU_EPOCH_INVALIDO');
   if(head.tail&&leaf(await eventPair(db,head.tail.id))!==head.tail.leaf)throw Error('ULTIMO_ORIGINAL_DIVERGENTE');
   return {passed:true,schema_ok:true,append_only_ok:true,reasons:[],event_count:counts.e,incremental:true,root:head.committed.digest,revision};
  }catch(e){if(e instanceof LabError)throw e;incident(/^[A-Z_]+$/.test(e.message)?e.message:'GUARD_INACESSIVEL');}
 });}
 async function prepare(tx,id){await testHook?.('during_incremental');const p=await eventPair(tx,id),before=head.committed;if(!before)throw Error('CHECKPOINT_PENDING');const after=next(before,id,leaf(p));
  const meta=(await tx.query('select recovery_epoch from lab_recovery_state')).rows[0];if(meta.recovery_epoch!==after.recovery_epoch)throw Error('EPOCH_NOVO_INVALIDO');append({kind:'prepare',before,pending:after,event_id:id,leaf:leaf(p)});await testHook?.('during_checkpoint');}
 async function finish(){return measure('core.incremental_postcommit',async()=>{
  try{if(head.kind!=='prepare')throw Error('CHECKPOINT_PENDING_AUSENTE');const p=await eventPair(db,head.event_id),m=(await db.query('select recovery_epoch from lab_recovery_state')).rows[0];if(leaf(p)!==head.leaf||m.recovery_epoch!==head.pending.recovery_epoch)throw Error('RELEITURA_POSCOMMIT_DIVERGENTE');const tail={id:head.event_id,leaf:head.leaf};append({kind:'commit',committed:head.pending,tail});dirty=false;}catch(e){incident(/^[A-Z_]+$/.test(e.message)?e.message:'CHECKPOINT_INACESSIVEL');}
 });}
 return {fast,audit,prepare,finish,invalidate(){dirty=true;revision++;},get revision(){return revision;},setExtra(fn){checkExtra=fn;dirty=true;},get receiptCheckpoint(){return receiptCheckpoint;},commitReceipt(value){receiptCheckpoint=value;append({kind:'receipt',committed:head.committed,tail:head.tail});},incident,dir};
}
