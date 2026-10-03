import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { LabError } from './auth-local.mjs';
import { inventory, verifyIntegrity } from './integridade.mjs';
import { acquireLabLock, finishAnchor, initializeAnchor, prepareAnchor, recoverAnchor, stateOf } from './recuperacao.mjs';
import { createAuthorization } from './autorizacao.mjs';
import { createReconciler } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { performance } from 'node:perf_hooks';
import { createIncrementalIntegrity } from '../laboratorio-marco-4c/integridade-incremental.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha=s=>createHash('sha256').update(s).digest('hex');
const canonical=event=>JSON.stringify([event.event_id,event.auth_user_id,event.idempotency_key,event.contract_version,event.worker_snapshot_ref,event.employment_snapshot_ref,event.employer_snapshot_ref,event.establishment_snapshot_ref,event.context_version,event.server_received_at_utc,event.server_committed_at_utc,event.collector_version,event.channel]);
export async function createLabCore(dataDir,{mode='open',anchorPath=dataDir?`${resolve(dataDir)}.anchor.json`:null,authorizationPath=null,source=null,readSource=null,telemetry=null,integrityMode='full',integrityTestHook=null}={}){
 let unlock=()=>{},db,authorization=null,reconciler=null,readReconciler=null,queue=Promise.resolve(),closing=false,incremental=null;
 const measure=(name,fn)=>telemetry?.timed?telemetry.timed(name,fn):fn();
 const digest=value=>telemetry?.synchronous?telemetry.synchronous('core.anchor_digest',()=>stateOf(value)):stateOf(value);
 const exclusive=fn=>{const entered=performance.now();const work=queue.then(async()=>{const start=performance.now();let failed=false;try{return await fn();}catch(e){failed=true;throw e;}finally{telemetry?.queue({type:'complete',scope:'exclusive',method:'PGlite',start,wait:start-entered,depth:1,failed});}});queue=work.catch(()=>{});return work;};
 if(dataDir){
  if(mode==='create'){
   if(existsSync(dataDir)&&readdirSync(dataDir).length)throw Error('CRIACAO_SOBRE_BANCO_EXISTENTE');
   mkdirSync(dataDir,{recursive:true});
  }else if(!existsSync(resolve(dataDir,'PG_VERSION')))throw Error('BANCO_EXISTENTE_AUSENTE');
  unlock=acquireLabLock(dataDir);
 }
 try{
  db=new PGlite(dataDir,{relaxedDurability:false});await db.waitReady;
  if(!dataDir||mode==='create'){
   await db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
   await db.query('insert into lab_recovery_state values(true,2,$1,0)',[randomUUID()]);
   if(anchorPath)initializeAnchor(anchorPath,stateOf(await inventory(db)));
  }
  if(integrityMode==='incremental'){incremental=await createIncrementalIntegrity(db,anchorPath,{measure,testHook:integrityTestHook});telemetry?.profileDb?.(db);}
  if(!incremental&&anchorPath){const initial=await verifyIntegrity(db);if(initial.passed)try{recoverAnchor(anchorPath,stateOf(initial.snapshot));}catch{/* Inspeção retorna falha fechada; não inventa âncora. */}}
  if(authorizationPath){
   const id=(await db.query('select database_id from lab_recovery_state where singleton=true')).rows[0]?.database_id;
   authorization=createAuthorization(authorizationPath,id,{requireSource:!!source});
   authorization.inspect();
   if(source){reconciler=createReconciler(authorization,source);await reconciler.all();if(incremental)readReconciler=createReconciler(authorization,readSource??source);}
  }
 }catch(error){if(db)try{await db.close();}catch{}unlock();throw error;}
 async function inspectInternal({probeWrite=true,personalAuthorized=false,full=false}={},capture){
  let check;try{check=incremental?await (full?incremental.audit():incremental.fast()):await measure('core.integrity_full',()=>verifyIntegrity(db));}catch{check={passed:false,schema_ok:false,append_only_ok:false,reasons:['INCIDENTE_INTEGRIDADE'],event_count:null};}
  let anchor=incremental?{ok:check.passed,comparison:check.passed?'MATCH':'DIVERGENT'}:{ok:!anchorPath,comparison:'EPHEMERAL'},writable=true;
  capture?.(check.snapshot);
  if(check.passed&&!incremental&&anchorPath)try{anchor=recoverAnchor(anchorPath,digest(check.snapshot),{readOnly:true});}catch{anchor={ok:false,comparison:'MISSING_OR_INVALID'};}
  if(check.passed&&probeWrite)try{await db.transaction(async tx=>{await tx.query('update lab_recovery_state set recovery_epoch=recovery_epoch where singleton=true');await tx.rollback();});}catch{writable=false;}
  let authorizationOk=true;
  if(authorization)try{authorization.inspect();}catch{authorizationOk=false;}
  const reconciliation=personalAuthorized?null:reconciler?.inspect();
  const ready=check.passed&&anchor.ok&&anchor.comparison!=='COMMITTED_PENDING'&&anchor.comparison!=='ABORTED_PENDING'&&writable&&authorizationOk&&(!reconciliation||reconciliation.ready)&&!closing;
  return {state:closing?'UNAVAILABLE':!check.passed||!anchor.ok||anchor.comparison.includes('PENDING')||!authorizationOk?'RECOVERY_REQUIRED':!writable||reconciliation&&!reconciliation.ready?'DEGRADED':'READY',
   process_online:true,database_ok:incremental?check.passed&&writable:!!check.snapshot&&writable,schema_ok:check.schema_ok,append_only_ok:check.append_only_ok,
   recovery_state:anchor.comparison,auth_dependency:'CHECKED_PER_REQUEST',context_state:check.snapshot?.contexts.some(c=>c.active&&c.context_status==='active'&&Date.parse(c.valid_until)>Date.now())?'AVAILABLE':'NO_ACTIVE_SNAPSHOT',
   ready_for_new_events:ready,reasons:check.reasons,anchor,event_count:check.event_count,reconciliation:reconciliation??null};
 }
 const inspect=options=>exclusive(async()=>{const state=await inspectInternal(options);if(incremental&&state.database_ok){const row=(await db.query("select exists(select 1 from lab_context where active=true and context_status='active' and valid_until>clock_timestamp()) as available")).rows[0];state.context_state=row.available?'AVAILABLE':'NO_ACTIVE_SNAPSHOT';}return state;});
 const close=async()=>{closing=true;await queue;try{await db.close();}finally{unlock();}};
 const assertReady=async (capture,options={})=>{if(!(await inspectInternal(options,capture)).ready_for_new_events)throw new LabError(503,'RECUPERACAO_NECESSARIA');};
 async function seedInternal({authUserId,employeeId,workerRef,employmentRef,status='active',validMinutes=30}){
  await assertReady();
  if(!uuid.test(authUserId)||!uuid.test(employeeId)||!/^LAB-[A-Z0-9-]+$/.test(workerRef)||!/^LAB-[A-Z0-9-]+$/.test(employmentRef))throw Error('Snapshot não sintético');
  const now=new Date(),until=new Date(now.getTime()+validMinutes*60000);
  await db.query(`insert into lab_context(auth_user_id,source_employee_id,worker_ref,employment_ref,employer_ref,establishment_ref,active,context_status,context_version,context_updated_at,valid_until)
   values($1,$2,$3,$4,'LAB-EMPREGADOR','LAB-ESTABELECIMENTO',$5,$6,1,$7,$8)
   on conflict(auth_user_id) do update set context_updated_at=excluded.context_updated_at,valid_until=excluded.valid_until,context_version=lab_context.context_version+1
   where lab_context.source_employee_id=excluded.source_employee_id and lab_context.active=true and lab_context.context_status='active'`,
   [authUserId,employeeId,workerRef,employmentRef,status==='active',status,now.toISOString(),until.toISOString()]);
 }
 const seedSynthetic=options=>exclusive(()=>seedInternal(options));
 async function context(authUserId){const q=await db.query('select * from lab_context where auth_user_id=$1',[authUserId]);return q.rows[0]??null;}
 function checkContext(c,employeeId){if(!c||!c.active||c.context_status!=='active'||(employeeId&&c.source_employee_id!==employeeId))throw new LabError(403,'CONTEXTO_INATIVO');if(new Date(c.valid_until).getTime()<=Date.now())throw new LabError(409,'CONTEXTO_INDISPONIVEL_PARA_SIMULACAO');}
 const authorize=(authUserId,employeeId,session)=>authorization?.authorize({authUserId,employeeId,...session});
 async function recordInternal(authUserId,body,{employeeId,session,failpoint,authorizeCurrent,testHook}={},operationSnapshot){
  // Snapshot privado só vem da operação exclusiva abaixo, nunca do cliente.
  // Nenhuma outra operação do núcleo pode intercalar entre guard e record.
  if(!operationSnapshot){if(reconciler)await reconciler.one(authUserId);await assertReady();}
  const admittedVersion=authorize(authUserId,employeeId,session);
  if(!body||Object.keys(body).sort().join()!=='contract_version,idempotency_key'||!Number.isInteger(body.contract_version)||!uuid.test(body.idempotency_key??''))throw new LabError(400,'PEDIDO_INVALIDO');
  const received=new Date().toISOString(),requestHash=sha(JSON.stringify([body.contract_version]));
  const before=incremental?null:digest(operationSnapshot??await inventory(db));let created=false;
  let result;
  try{result=await db.transaction(async tx=>{
   const c=(await tx.query('select * from lab_context where auth_user_id=$1',[authUserId])).rows[0];checkContext(c,employeeId);
   const prior=(await tx.query('select r.request_hash,r.auth_user_id,e.* from lab_intent_result r join lab_time_event e using(event_id) where r.idempotency_key=$1',[body.idempotency_key])).rows[0];
   if(prior){if(prior.auth_user_id!==authUserId||prior.request_hash!==requestHash)throw new LabError(409,'INTENCAO_CONFLITANTE');return {event:publicEvent(prior),duplicate:true};}
   if(body.contract_version!==1)throw new LabError(400,'PEDIDO_INVALIDO');
   await testHook?.('before_insert');
   if(failpoint==='before_insert')throw Error('Falha sintética antes do insert');
   const event={event_id:randomUUID(),auth_user_id:authUserId,idempotency_key:body.idempotency_key,contract_version:1,worker_snapshot_ref:c.worker_ref,employment_snapshot_ref:c.employment_ref,employer_snapshot_ref:c.employer_ref,establishment_snapshot_ref:c.establishment_ref,context_version:c.context_version,server_received_at_utc:received,server_committed_at_utc:new Date().toISOString(),collector_version:'metallo-colaborador-lab-2b',channel:'metallo-colaborador-lab'};
   const hash=sha(canonical(event));
   await tx.query(`insert into lab_time_event(event_id,auth_user_id,idempotency_key,contract_version,worker_snapshot_ref,employment_snapshot_ref,employer_snapshot_ref,establishment_snapshot_ref,context_version,server_received_at_utc,server_committed_at_utc,collector_version,channel,payload_hash)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,Object.values(event).concat(hash));
   if(failpoint==='after_insert')throw Error('Falha sintética após insert');
   await testHook?.('after_insert');
   await tx.query('insert into lab_intent_result(idempotency_key,auth_user_id,request_hash,event_id) values($1,$2,$3,$4)',[body.idempotency_key,authUserId,requestHash,event.event_id]);
   await testHook?.('after_result');
   if(failpoint==='before_commit')throw Error('Falha sintética antes do commit');
   if(authorizeCurrent)await authorizeCurrent();
   if(reconciler)await measure('core.reconcile_precommit',()=>reconciler.one(authUserId));
   if(authorize(authUserId,employeeId,session)!==admittedVersion)throw new LabError(409,'AUTORIZACAO_DESATUALIZADA');
   await tx.query('update lab_recovery_state set recovery_epoch=recovery_epoch+1 where singleton=true');
   if(incremental)await incremental.prepare(tx,event.event_id);else if(anchorPath)prepareAnchor(anchorPath,before,digest(await measure('core.inventory_precommit',()=>inventory(tx))));
   await testHook?.('after_anchor_before_commit');
   created=true;
   return {event:publicEvent({...event,payload_hash:hash}),duplicate:false};
  });}catch(error){
   if(incremental)try{await incremental.audit({recover:true});}catch{}
   else if(anchorPath)try{const check=await verifyIntegrity(db);if(check.passed)recoverAnchor(anchorPath,stateOf(check.snapshot));}catch{}
   throw error;
  }
  // Rodada 4: candidata sem esta releitura foi rejeitada por disponibilidade.
  // Preservar o caminho validado da rodada 3, inclusive após syncToFs.
  if(created){await db.syncToFs(false);await testHook?.('after_database_commit');if(incremental)await incremental.finish();else if(anchorPath)finishAnchor(anchorPath,digest(await measure('core.inventory_postcommit',()=>inventory(db))));await testHook?.('after_commit');}
  return result;
 }
 const record=(...args)=>exclusive(()=>recordInternal(...args));
 async function history(authUserId,employeeId,session){authorize(authUserId,employeeId,session);const c=await context(authUserId);checkContext(c,employeeId);const rows=(await db.query("select event_id,server_received_at_utc,payload_hash from lab_time_event where auth_user_id=$1 and (server_received_at_utc at time zone 'America/Fortaleza')::date=(clock_timestamp() at time zone 'America/Fortaleza')::date order by server_received_at_utc desc limit 50",[authUserId])).rows;return rows.map(publicEvent);}
 async function outcome(authUserId,employeeId,key,session){if(!uuid.test(key))throw new LabError(400,'PEDIDO_INVALIDO');authorize(authUserId,employeeId,session);const c=await context(authUserId);checkContext(c,employeeId);const rows=(await db.query('select e.* from lab_time_event e where e.idempotency_key=$1 and e.auth_user_id=$2',[key,authUserId])).rows;return rows[0]?publicEvent(rows[0]):null;}
 const guarded=fn=>(...args)=>exclusive(async()=>{if(reconciler)await reconciler.one(args[0]);await assertReady();return fn(...args);});
 // Uma admissão protegida por operação pessoal. Capacidade interna limitada
 // ao titular, à sessão e à vida do callback; sem PASS entre requisições.
 const personalOperation=(authUserId,employeeId,session,run)=>exclusive(async()=>{
  if(reconciler)await measure('core.reconcile_entry',()=>reconciler.one(authUserId));
  let snapshot;await assertReady(value=>{snapshot=value;},{personalAuthorized:!!incremental&&!!reconciler});if(incremental)snapshot={incremental:true};
  const version=authorize(authUserId,employeeId,session);
  checkContext(await context(authUserId),employeeId);
  let active=true;
  const check=()=>{if(!active)throw new LabError(503,'OPERACAO_ENCERRADA');};
  const own=(id,emp,s)=>{check();if(id!==authUserId||emp!==employeeId||s?.sessionId!==session?.sessionId||s?.issuedAt!==session?.issuedAt)throw new LabError(403,'CONTEXTO_INATIVO');};
  const access={
   checkpoint:async(fn,{includeInventory=true}={})=>{check();return fn(db,includeInventory?await inventory(db):undefined,anchorPath);},
   record:async(id,body,options={})=>{own(id,options.employeeId,options.session);
    const result=await recordInternal(id,body,options,snapshot);
    // Não reutilizar snapshot anterior se um chamador interno pedir novo record.
    // O próximo recordInternal fará novamente o guard integral.
    snapshot=null;return result;
   },
   outcome:async(id,emp,key,s)=>{own(id,emp,s);return outcome(id,emp,key,s);}
  };
  try{
   const value=await run(access);
   if(reconciler)await measure('core.reconcile_exit',()=>reconciler.one(authUserId));
   if(authorize(authUserId,employeeId,session)!==version)throw new LabError(409,'AUTORIZACAO_DESATUALIZADA');
   checkContext(await context(authUserId),employeeId);return value;
  }finally{active=false;}
 });
 const personalRead=incremental?async(authUserId,employeeId,session,run)=>{
  if(readReconciler)await measure('read.reconcile_entry',()=>readReconciler.one(authUserId));
  const version=authorize(authUserId,employeeId,session);
  const value=await exclusive(async()=>{
   await assertReady(undefined,{personalAuthorized:!!reconciler});checkContext(await context(authUserId),employeeId);
   let active=true;const read=async(fn)=>{if(!active)throw new LabError(503,'OPERACAO_ENCERRADA');return db.transaction(async tx=>{await tx.exec('set transaction read only');return fn({query:tx.query.bind(tx)});});};
   try{return await run({checkpoint:fn=>read(fn)});}finally{active=false;}
  });
  if(readReconciler)await measure('read.reconcile_exit',()=>readReconciler.one(authUserId));
  return exclusive(async()=>{await assertReady(undefined,{personalAuthorized:!!reconciler});if(authorize(authUserId,employeeId,session)!==version)throw new LabError(409,'AUTORIZACAO_DESATUALIZADA');checkContext(await context(authUserId),employeeId);return value;});
 }:undefined;
 const outcomeHistoric=(authUserId,key)=>exclusive(async()=>{
  if(!reconciler||!uuid.test(key))throw new LabError(400,'PEDIDO_INVALIDO');
  await reconciler.one(authUserId);
  await assertReady();
  const person=authorization.inspect().people[authUserId];
  if(!person||person.state!=='REVOKED')throw new LabError(403,'ACESSO_NAO_AUTORIZADO');
  const rows=(await db.query('select e.* from lab_time_event e where e.idempotency_key=$1 and e.auth_user_id=$2',[key,authUserId])).rows;
  return rows[0]?publicEvent(rows[0]):null;
 });
 // O guard continua integral; somente o segundo snapshot, quando não consumido,
 // pode ser omitido. Backup/restore e os demais chamadores conservam o padrão.
 const checkpoint=(fn,{includeInventory=true}={})=>exclusive(async()=>{await assertReady(undefined,{full:!!incremental});try{return await fn(db,includeInventory?await inventory(db):undefined,anchorPath);}finally{incremental?.invalidate();}});
 const registerAuthorization=(authUserId,employeeId)=>exclusive(async()=>{await assertReady();if(!authorization)throw Error('AUTORIZACAO_2E_INATIVA');return authorization.register(authUserId,employeeId);});
 const applyAuthorizationState=(authUserId,state)=>exclusive(async()=>{await assertReady();if(!authorization)throw Error('AUTORIZACAO_2E_INATIVA');return authorization.setState(authUserId,state);});
 const logoutCurrent=(authUserId,sessionId)=>exclusive(async()=>{await assertReady();if(!authorization)throw Error('AUTORIZACAO_2E_INATIVA');return authorization.logoutCurrent(authUserId,sessionId);});
 const logoutGlobal=authUserId=>exclusive(async()=>{await assertReady();if(!authorization)throw Error('AUTORIZACAO_2E_INATIVA');return authorization.logoutGlobal(authUserId);});
 const completeGlobalLogout=authUserId=>exclusive(async()=>{await assertReady();if(!authorization)throw Error('AUTORIZACAO_2E_INATIVA');return authorization.completeGlobalLogout(authUserId);});
 const retryGlobalLogout=authUserId=>exclusive(async()=>{
  if(!reconciler)throw new LabError(404,'ROTA_NAO_ENCONTRADA');
  const storage=await inspectInternal();
  if(!storage.database_ok||!storage.schema_ok||!storage.append_only_ok||!storage.anchor.ok||storage.recovery_state!=='MATCH')throw new LabError(503,'RECUPERACAO_NECESSARIA');
  await reconciler.one(authUserId);
  const p=authorization.inspect().people[authUserId];
  if(!p||p.state!=='ACTIVE'||!p.global_logout_pending)throw new LabError(403,'ACESSO_NAO_AUTORIZADO');
 });
 const exposedDb=incremental?new Proxy(db,{get(target,key){const value=target[key];if(typeof value!=='function')return value;return (...args)=>{incremental.invalidate();return value.apply(target,args);};}}):db;
 return {db:exposedDb,integrityMode,personalRead,integrityRevision:()=>incremental?.revision??0,receiptCheckpoint:()=>incremental?.receiptCheckpoint,commitReceiptCheckpoint:value=>incremental?.commitReceipt(value),registerIntegrityVerifier:fn=>incremental?.setExtra(fn),auditIntegrity:()=>exclusive(()=>incremental?incremental.audit():verifyIntegrity(db)),incident:reason=>incremental?.incident(reason),close,seedSynthetic,context,record,personalOperation,history:guarded(history),outcome:guarded(outcome),outcomeHistoric,historicalOutcomeEnabled:!!reconciler,inspect,checkpoint,registerAuthorization,applyAuthorizationState,logoutCurrent,logoutGlobal,completeGlobalLogout,retryGlobalLogout,reconcileAll:()=>reconciler?.all(),reconcileUser:id=>reconciler?.one(id),authorizationSnapshot:()=>authorization?.inspect()};
}
function publicEvent(e){return {event_id:e.event_id,server_received_at_utc:new Date(e.server_received_at_utc).toISOString(),payload_hash:e.payload_hash};}
