// A contagem é congelada em plano-testes-2d.json antes do primeiro caso.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import net from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { backupCore, restoreDisposable } from '../laboratorio-marco-2b/backup.mjs';
import { inventory, verifyIntegrity, eventHash, sha256 } from '../laboratorio-marco-2b/integridade.mjs';
import { readAnchor, atomicJson } from '../laboratorio-marco-2b/recuperacao.mjs';
import { verifyDirectory } from '../laboratorio-marco-2b/ferramentas-recuperacao.mjs';

const root=resolve(import.meta.dirname,'../..'),testRoot=resolve(root,'backups/marco-2d-ensaios',randomUUID());
const cases=[],children=new Set();let serial=0;
const report={at:new Date().toISOString(),scope:'2D: processos reais, PGlite persistente, HTTP loopback; Auth simplificado somente nos ensaios de storage. Auth/JWT reais em suíte separada.',checks:[],passed:false,crashes:[]};
const people={'lab-joao':{authUserId:randomUUID(),employeeId:randomUUID()},'lab-maria':{authUserId:randomUUID(),employeeId:randomUUID()}};
const test=(category,name,run)=>cases.push({category,name,run});
const body=()=>({contract_version:1,idempotency_key:randomUUID()});
async function fixture(){const directory=resolve(testRoot,`db-${++serial}`),anchorPath=directory+'.anchor.json';const core=await createLabCore(directory,{mode:'create',anchorPath});for(const [token,person] of Object.entries(people))await core.seedSynthetic({authUserId:person.authUserId,employeeId:person.employeeId,workerRef:token==='lab-joao'?'LAB-JOAO':'LAB-MARIA',employmentRef:token==='lab-joao'?'LAB-VINCULO-JOAO':'LAB-VINCULO-MARIA'});return {directory,anchorPath,core};}
const record=(core,b=body(),token='lab-joao')=>core.record(people[token].authUserId,b,{employeeId:people[token].employeeId});
async function mutate(f,sql){await f.core.close();const db=new PGlite(f.directory);await db.waitReady;try{await db.exec(sql);}finally{await db.close();}}
async function reopen(f){return createLabCore(f.directory,{anchorPath:f.anchorPath});}
function waitMessage(child,predicate,timeout=20000){return new Promise((ok,fail)=>{const timer=setTimeout(()=>{cleanup();fail(Error('IPC_TIMEOUT'));},timeout);function cleanup(){clearTimeout(timer);child.off('message',message);child.off('exit',exit);}function message(value){if(predicate(value)){cleanup();ok(value);}}function exit(){cleanup();fail(Error('PROCESSO_ENCERROU'));}child.on('message',message);child.on('exit',exit);});}
async function start(f,failpoint=null){
  const child=fork(resolve(import.meta.dirname,'processo-ensaio.mjs'),[],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});children.add(child);child.once('exit',()=>children.delete(child));
  child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  const ready=waitMessage(child,value=>value.ready||value.error);child.send({command:'init',directory:f.directory,anchorPath:f.anchorPath,people,failpoint});
  const response=await ready;assert.ok(response.ready);return {child,port:response.port,health:response.health};
}
async function command(worker,command,extra={}){const id=randomUUID(),promise=waitMessage(worker.child,value=>value.id===id);worker.child.send({id,command,...extra});const value=await promise;if(value.error)throw Error(value.error);return value;}
async function stop(worker){const exit=once(worker.child,'exit');const result=await command(worker,'shutdown');await exit;return result;}
async function kill(worker){const exit=once(worker.child,'exit');worker.child.kill('SIGKILL');await exit;}
async function call(worker,path='/lab-point/v1/events',b,token='lab-joao'){
  const response=await fetch(`http://127.0.0.1:${worker.port}${path}`,{method:b?'POST':'GET',headers:{Host:`127.0.0.1:${worker.port}`,Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined,signal:AbortSignal.timeout(15000)});
  return {status:response.status,data:await response.json()};
}

test('A','Banco novo explícito passa validação',async()=>{const f=await fixture();assert.equal((await f.core.inspect()).state,'READY');await f.core.close();});
test('A','Banco ausente não é criado pelo startup',async()=>{const p=resolve(testRoot,'missing');await assert.rejects(createLabCore(p));assert.equal(existsSync(p),false);});
test('A','Segundo processo não abre diretório em uso',async()=>{const f=await fixture();const w=await start(f);assert.equal(w.health.ready_for_new_events,false);await stop(w);await f.core.close();});
test('A','Schema version desconhecida bloqueia',async()=>{const f=await fixture();await mutate(f,'alter table lab_recovery_state drop constraint lab_recovery_state_schema_version_check; update lab_recovery_state set schema_version=99');const c=await reopen(f);assert.equal((await c.inspect()).state,'RECOVERY_REQUIRED');await assert.rejects(record(c));await c.close();});
test('A','Tabela idempotente ausente bloqueia sem recriar',async()=>{const f=await fixture();await mutate(f,'drop table lab_intent_result');const c=await reopen(f);assert.equal((await c.inspect()).ready_for_new_events,false);assert.equal((await c.db.query("select to_regclass('public.lab_intent_result') as relation")).rows[0].relation,null);await c.close();});
test('A','Constraint de vínculo removida bloqueia',async()=>{const f=await fixture();await mutate(f,'alter table lab_intent_result drop constraint lab_intent_result_event_id_fkey');const c=await reopen(f);assert.equal((await c.inspect()).schema_ok,false);await c.close();});
test('B','Health READY expõe somente campos técnicos',async()=>{const f=await fixture();await f.core.close();const w=await start(f);const h=await call(w,'/health');assert.equal(h.status,200);assert.deepEqual(Object.keys(h.data).sort(),['status','official','process_online','database_ok','schema_ok','append_only_ok','recovery_state','auth_dependency','context_state','ready_for_new_events'].sort());assert.ok(!JSON.stringify(h).includes(people['lab-joao'].authUserId));await stop(w);});
test('B','Health distingue banco read-only e recusa POST',async()=>{const f=await fixture();await f.core.close();const w=await start(f);await command(w,'readonly');const h=await call(w,'/health');assert.equal(h.status,503);assert.equal(h.data.database_ok,false);assert.equal((await call(w,undefined,body())).status,503);await stop(w);});
test('B','Health não chama processo online de banco pronto',async()=>{const f=await fixture();await mutate(f,'drop trigger lab_event_no_update_delete on lab_time_event');const w=await start(f);const h=await call(w,'/health');assert.equal(h.data.process_online,true);assert.equal(h.data.append_only_ok,false);assert.equal(h.data.ready_for_new_events,false);await stop(w);});

for(const phase of ['before_insert','after_insert','after_result','after_anchor_before_commit','after_database_commit','after_commit'])test('C',`Kill real em ${phase}; retry preserva atomicidade`,async()=>{
  const f=await fixture();await f.core.close();const w=await start(f,phase),b=body();
  const hook=waitMessage(w.child,value=>value.hook===phase);const request=call(w,undefined,b).catch(()=>({status:0}));const point=await hook;
  await kill(w);await request;
  const next=await start(f),snapshot=(await command(next,'snapshot')).snapshot;
  assert.equal(snapshot.events.length,point.confirmed?1:0);assert.equal(snapshot.results.length,snapshot.events.length);
  const retried=await call(next,undefined,b);assert.equal(retried.status,point.confirmed?200:201);
  if(point.confirmed)assert.equal(retried.data.event.event_id,point.confirmed.events[0].event_id);
  const final=(await command(next,'snapshot')).snapshot;assert.equal(final.events.length,1);assert.equal(final.results.length,1);
  report.crashes.push({phase,hard_process_kill:true,after_restart_count:snapshot.events.length,retry_status:retried.status,same_confirmed_event:!point.confirmed||retried.data.event.event_id===point.confirmed.events[0].event_id,final_count:1});await stop(next);
});
test('D','Cinco requests mesma chave depois de restart criam um original',async()=>{const f=await fixture();await f.core.close();let w=await start(f);await stop(w);w=await start(f);const b=body(),values=await Promise.all(Array.from({length:5},()=>call(w,undefined,b)));assert.equal(values.filter(v=>v.status===201).length,1);assert.equal(new Set(values.map(v=>v.data.event.event_id)).size,1);assert.equal((await command(w,'snapshot')).snapshot.events.length,1);await stop(w);});
test('D','Timestamp/hash e event_id iguais no retry pós-restart',async()=>{const f=await fixture(),b=body(),first=await record(f.core,b);await f.core.close();const c=await reopen(f),second=await record(c,b);assert.deepEqual(first.event,second.event);assert.equal(second.duplicate,true);await c.close();});
test('D','Chave igual com conteúdo diferente não sobrescreve',async()=>{const f=await fixture(),b=body();await record(f.core,b);await f.core.close();const c=await reopen(f);await assert.rejects(record(c,{...b,contract_version:2}),e=>e.code==='INTENCAO_CONFLITANTE');assert.equal((await inventory(c.db)).events.length,1);await c.close();});
test('E','Shutdown gracioso drena transação aceita e encerra listener',async()=>{const f=await fixture();await f.core.close();const w=await start(f,'after_insert'),b=body(),hook=waitMessage(w.child,v=>v.hook==='after_insert');const request=call(w,undefined,b);await hook;const shutdown=command(w,'shutdown');await command(w,'release');assert.equal((await request).status,201);const end=await shutdown;assert.equal(end.metrics.graceful_shutdown,1);await new Promise(ok=>setTimeout(ok,100));await assert.rejects(call(w,'/health'));const c=await reopen(f);assert.equal((await inventory(c.db)).events.length,1);await c.close();});

let backupFixture,backupDir,backupManifest;
test('F','Backup sob exclusão possui manifesto, baseline e SHA verificáveis',async()=>{backupFixture=await fixture();for(let i=0;i<3;i++)await record(backupFixture.core);backupDir=resolve(testRoot,'backup');backupManifest=await backupCore(backupFixture.core,backupDir);assert.equal(backupManifest.state.event_count,3);assert.equal(sha256(readFileSync(resolve(backupDir,'database.tar.gz'))),backupManifest.archive_sha256);assert.equal(backupManifest.origin.id,'METALLO-2B-LAB-20260927-R1');});
test('F','Backup registra pares, timestamps, contexto e geração',async()=>{assert.equal(backupManifest.inventory.events.length,backupManifest.inventory.results.length);assert.equal(backupManifest.state.recovery_epoch,3);assert.ok(backupManifest.inventory.events.every(e=>e.context_version>0&&e.server_received_at_utc&&e.payload_hash));});
test('F','Exportação fica entre gravações na fila exclusiva',async()=>{const b=body(),directory=resolve(testRoot,'backup-concorrente');const jobs=await Promise.all([record(backupFixture.core,b),backupCore(backupFixture.core,directory),record(backupFixture.core)]);assert.equal(jobs[1].state.event_count,4);assert.equal((await inventory(backupFixture.core.db)).events.length,5);});
test('G','Restore descartável reproduz exatamente inventário do corte',async()=>{const destination=resolve(testRoot,'restore-valid'),anchorPath=destination+'.anchor.json',reference=resolve(testRoot,'anchor-cut.json');atomicJson(reference,backupManifest.anchor);const result=await restoreDisposable(backupDir,destination,{anchorPath,referenceAnchor:reference});assert.equal(result.exact_inventory,true);const c=await createLabCore(destination,{anchorPath});assert.deepEqual(await inventory(c.db),backupManifest.inventory);await c.close();});
test('G','Evento do backup é recuperado com mesma chave e hash',async()=>{const destination=resolve(testRoot,'restore-valid'),anchorPath=destination+'.anchor.json',c=await createLabCore(destination,{anchorPath});const event=backupManifest.inventory.events[0],retry=await record(c,{contract_version:1,idempotency_key:event.idempotency_key});assert.equal(retry.duplicate,true);assert.equal(retry.event.event_id,event.event_id);assert.equal(retry.event.payload_hash,event.payload_hash);assert.equal((await inventory(c.db)).events.length,3);await c.close();});
test('G','Backup com bytes adulterados é recusado antes do restore',async()=>{const altered=resolve(testRoot,'backup-alterado');cpSync(backupDir,altered,{recursive:true});const p=resolve(altered,'database.tar.gz'),bytes=readFileSync(p);bytes[20]^=1;writeFileSync(p,bytes);await assert.rejects(restoreDisposable(altered,resolve(testRoot,'restore-bad'),{anchorPath:resolve(testRoot,'bad-anchor.json')}));});
let staleDestination,staleAnchor;
test('H','A/B/C restaurados após D/E são detectados pela âncora atual',async()=>{staleDestination=resolve(testRoot,'restore-old');staleAnchor=staleDestination+'.anchor.json';await restoreDisposable(backupDir,staleDestination,{anchorPath:staleAnchor,referenceAnchor:backupFixture.anchorPath});const c=await createLabCore(staleDestination,{anchorPath:staleAnchor}),h=await c.inspect();assert.equal(h.state,'RECOVERY_REQUIRED');assert.equal(h.anchor.expected_epoch,5);assert.equal(h.anchor.observed_epoch,3);const current=await inventory(backupFixture.core.db),restored=await inventory(c.db);report.temporal_rollback={expected_epoch:5,observed_epoch:3,expected_event_ids:current.events.map(e=>e.event_id),observed_event_ids:restored.events.map(e=>e.event_id),missing_event_ids:current.events.filter(e=>!restored.events.some(r=>r.event_id===e.event_id)).map(e=>e.event_id),writes_blocked:true};await c.close();});
test('H','Chave pós-backup não é tratada como nova em restore antigo',async()=>{const snapshot=await inventory(backupFixture.core.db),oldKeys=new Set(backupManifest.inventory.events.map(e=>e.idempotency_key)),later=snapshot.events.find(e=>!oldKeys.has(e.idempotency_key));const c=await createLabCore(staleDestination,{anchorPath:staleAnchor});await assert.rejects(record(c,{contract_version:1,idempotency_key:later.idempotency_key}),e=>e.code==='RECUPERACAO_NECESSARIA');assert.equal((await inventory(c.db)).events.length,3);await c.close();});
test('H','Chave nunca usada é negada enquanto recovery required',async()=>{const c=await createLabCore(staleDestination,{anchorPath:staleAnchor});await assert.rejects(record(c));assert.equal((await inventory(c.db)).events.length,3);await c.close();});
test('H','Restore sem referência externa não inventa âncora',async()=>{const destination=resolve(testRoot,'restore-no-anchor'),anchorPath=destination+'.anchor.json';await restoreDisposable(backupDir,destination,{anchorPath});assert.equal(existsSync(anchorPath),false);const c=await createLabCore(destination,{anchorPath});assert.equal((await c.inspect()).state,'RECOVERY_REQUIRED');await c.close();});

test('I','Verificador v1 calcula mesmo hash do original',async()=>{const f=await fixture();await record(f.core);const e=(await inventory(f.core.db)).events[0];assert.equal(e.hash_version,1);assert.equal(eventHash(e),e.payload_hash);await f.core.close();});
for(const [label,sql,reason] of [
 ['timestamp',"alter table lab_time_event disable trigger lab_event_no_update_delete; update lab_time_event set server_received_at_utc=server_received_at_utc+interval '1 second'; alter table lab_time_event enable trigger lab_event_no_update_delete",'HASH_DIVERGENTE'],
 ['timestamp sub-milissegundo',"alter table lab_time_event disable trigger lab_event_no_update_delete; update lab_time_event set server_received_at_utc=server_received_at_utc+interval '1 microsecond'; alter table lab_time_event enable trigger lab_event_no_update_delete",'TIMESTAMP_PRECISAO_NAO_SUPORTADA'],
 ['hash',"alter table lab_time_event disable trigger lab_event_no_update_delete; update lab_time_event set payload_hash=repeat('0',64); alter table lab_time_event enable trigger lab_event_no_update_delete",'HASH_DIVERGENTE'],
 ['versão desconhecida',"alter table lab_time_event disable trigger lab_event_no_update_delete; alter table lab_time_event drop constraint lab_time_event_hash_version_check; update lab_time_event set hash_version=99; alter table lab_time_event enable trigger lab_event_no_update_delete",'HASH_VERSION_OU_TIMESTAMP'],
 ['mapping original-resultado',"update lab_intent_result set auth_user_id='00000000-0000-4000-8000-000000000001'",'RESULTADO_INCOERENTE'],
 ['geração',"update lab_recovery_state set recovery_epoch=0",null],
 ['trigger removido','drop trigger lab_event_no_update_delete on lab_time_event','APPEND_ONLY_INVALIDO'],
 ['trigger desabilitado','alter table lab_time_event disable trigger lab_event_no_update_delete','APPEND_ONLY_INVALIDO'],
])test('J',`Adulteração descartável detectada: ${label}`,async()=>{const f=await fixture();await record(f.core);await mutate(f,sql);const result=await verifyDirectory(f.directory,f.anchorPath);assert.equal(result.passed,false);if(reason)assert.ok(result.reasons.includes(reason));const c=await reopen(f);await assert.rejects(record(c));await c.close();});
test('I','UPDATE e DELETE ordinários continuam negados',async()=>{const f=await fixture();await record(f.core);await assert.rejects(f.core.db.exec('update lab_time_event set payload_hash=payload_hash'));await assert.rejects(f.core.db.exec('delete from lab_time_event'));assert.equal((await inventory(f.core.db)).events.length,1);await f.core.close();});
test('I','Verificador somente leitura não corrige adulteração',async()=>{const f=await fixture();await record(f.core);await mutate(f,"update lab_intent_result set request_hash=repeat('0',64)");const first=await verifyDirectory(f.directory,f.anchorPath),second=await verifyDirectory(f.directory,f.anchorPath);assert.equal(first.status,'FAIL');assert.deepEqual(first,second);});
test('K','Revogação de contexto persiste após restart',async()=>{const f=await fixture();await f.core.db.query("update lab_context set active=false,context_status='revoked' where auth_user_id=$1",[people['lab-joao'].authUserId]);await f.core.close();const c=await reopen(f);await assert.rejects(record(c),e=>e.code==='CONTEXTO_INATIVO');assert.equal((await inventory(c.db)).events.length,0);await c.close();});
test('K','Revogação percebida antes do commit reverte evento e resultado',async()=>{const f=await fixture();await assert.rejects(f.core.record(people['lab-joao'].authUserId,body(),{employeeId:people['lab-joao'].employeeId,authorizeCurrent:async()=>{throw Error('revogacao-sintetica');}}));const s=await inventory(f.core.db);assert.equal(s.events.length,0);assert.equal(s.results.length,0);assert.equal((await f.core.inspect()).state,'READY');await f.core.close();});
test('L','João e Maria isolados por HTTP depois do restart',async()=>{const f=await fixture();await record(f.core,body(),'lab-joao');await record(f.core,body(),'lab-maria');await f.core.close();const w=await start(f);const j=await call(w),m=await call(w,undefined,undefined,'lab-maria');assert.equal(j.data.events.length,1);assert.equal(m.data.events.length,1);assert.notEqual(j.data.events[0].event_id,m.data.events[0].event_id);await stop(w);});
test('L','Intenção de Maria não é devolvida a João pós-restart',async()=>{const f=await fixture(),b=body();await record(f.core,b,'lab-maria');await f.core.close();const w=await start(f);assert.equal((await call(w,'/lab-point/v1/intent/'+b.idempotency_key)).status,404);await stop(w);});
test('L','Intenção de João não é devolvida a Maria pós-restart',async()=>{const f=await fixture(),b=body();await record(f.core,b);await f.core.close();const w=await start(f);assert.equal((await call(w,'/lab-point/v1/intent/'+b.idempotency_key,undefined,'lab-maria')).status,404);await stop(w);});
test('M','Dependência fora nega nova marcação sem snapshot permissivo',async()=>{const f=await fixture();await f.core.close();const w=await start(f);await command(w,'dependency',{available:false});const h=await call(w,'/health');assert.equal(h.data.auth_dependency,'UNAVAILABLE');assert.equal(h.data.ready_for_new_events,false);assert.equal((await call(w,undefined,body())).status,503);assert.equal((await command(w,'snapshot')).snapshot.events.length,0);await stop(w);});
test('M','Núcleo parado não confirma HTTP',async()=>{const f=await fixture();await f.core.close();const w=await start(f);await stop(w);await assert.rejects(call(w,undefined,body()));});
test('N','Listener do processo descartável é somente loopback',async()=>{const f=await fixture();await f.core.close();const w=await start(f);assert.equal((await call(w,'/health')).status,200);const interfaces=(await import('node:os')).networkInterfaces();const ips=Object.values(interfaces).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);assert.ok(ips.length);for(const host of ips)assert.equal(await new Promise(ok=>{const s=net.connect({host,port:w.port});s.setTimeout(750);s.once('connect',()=>{s.destroy();ok(true);});s.once('error',()=>ok(false));s.once('timeout',()=>{s.destroy();ok(false);});}),false);await stop(w);});
test('N','Âncora só contém versão, UUID técnico, contagem e digest',async()=>{const value=JSON.stringify(readAnchor(backupFixture.anchorPath));for(const person of Object.values(people))assert.ok(!value.includes(person.authUserId)&&!value.includes(person.employeeId));assert.ok(!/token|password|email|service_role/i.test(value));});

const planPath=new URL('./plano-testes-2d.json',import.meta.url),names=cases.map(({category,name})=>({category,name}));
if(process.argv.includes('--plan')){
  const prior=existsSync(planPath)?sha256(readFileSync(planPath)):null;
  writeFileSync(planPath,JSON.stringify({at:new Date().toISOString(),frozen_before_execution:true,separate_declaration_command:true,previous_plan_sha256:prior,expected:cases.length,cases:names,separate_real_auth_suite:true},null,2)+'\n');
  console.log(JSON.stringify({declared:cases.length,sha256:sha256(readFileSync(planPath)),tests_executed:0}));process.exit(0);
}
const declared=JSON.parse(readFileSync(planPath,'utf8'));assert.deepEqual(declared.cases,names);assert.equal(declared.expected,cases.length);
report.plan_sha256=sha256(readFileSync(planPath));report.plan_read_only_during_execution=true;
mkdirSync(testRoot,{recursive:true});
report.expected=cases.length;
console.log(JSON.stringify({plan:cases.length,categories:[...new Set(cases.map(c=>c.category))]}));
try{
  for(const item of cases){const start=Date.now();try{await item.run();report.checks.push({category:item.category,name:item.name,ok:true,ms:Date.now()-start});console.log('PASS '+item.category+' '+item.name);}catch(error){report.checks.push({category:item.category,name:item.name,ok:false,error:String(error.message),ms:Date.now()-start});throw error;}}
  if(backupFixture){
    const delivery=resolve(import.meta.dirname,'backup-sintetico-2d');
    if(!existsSync(delivery))cpSync(backupDir,delivery,{recursive:true});
    report.delivered_backup_sha256=JSON.parse(readFileSync(resolve(delivery,'manifesto.json'),'utf8')).archive_sha256;
    report.this_run_backup_sha256=backupManifest.archive_sha256;
    await backupFixture.core.close();
  }
  report.passed=report.checks.length===cases.length&&report.checks.every(c=>c.ok);
}catch(error){report.error=String(error.message);process.exitCode=1;}
finally{
  for(const child of children)child.kill('SIGKILL');
  report.at_end=new Date().toISOString();
  if(report.passed){const allowed=resolve(root,'backups/marco-2d-ensaios');assert.ok(testRoot.startsWith(allowed+'\\')||testRoot.startsWith(allowed+'/'));rmSync(testRoot,{recursive:true,force:true});report.disposable_environment_removed=true;}
  const target=new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/resultado-2d.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/resultado-2d.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/resultado-2d.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/resultado-2d.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/resultado-2d.json':process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/resultado-2d-regressao.json':'./resultado-2d.json',import.meta.url);
  if(existsSync(target)){const previous=JSON.parse(readFileSync(target,'utf8'));report.previous_runs=[...(previous.previous_runs??[]),{at:previous.at,expected:previous.expected,passed:previous.passed,checks:previous.checks,error:previous.error??null}];}
  writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,expected:cases.length,error:report.error??null}));
}
