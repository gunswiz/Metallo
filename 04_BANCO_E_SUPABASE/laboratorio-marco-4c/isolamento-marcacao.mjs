// Ensaio causal da rodada 4: fluxo HTTP completo, competição e volume histórico.
// Cada caso começa em banco descartável novo. Não substitui a carga comparável.
import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync,openSync,closeSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomUUID,createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { fixtures } from '../laboratorio-marco-4b/carga-fixtures.mjs';
import { startPointServer } from '../laboratorio-marco-4a/servidor-4a.mjs';
import { status,root } from '../laboratorio-marco-4a/ambiente.mjs';
import { createProfiler } from './perfil.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
const stage=process.argv[2];assert.ok(['antes','depois'].includes(stage));assert.ok(['4','5'].includes(process.env.METALLO_4C_ROUND));
const base=resolve(import.meta.dirname,'rodada-'+process.env.METALLO_4C_ROUND,'isolamento',stage);mkdirSync(base,{recursive:true});
const wait=ms=>new Promise(ok=>setTimeout(ok,ms)),hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const stats=values=>{const v=[...values].sort((a,b)=>a-b);return {n:v.length,p50:v[Math.ceil(v.length*.5)-1]??null,p95:v[Math.ceil(v.length*.95)-1]??null,p99:v[Math.ceil(v.length*.99)-1]??null,max:v.at(-1)??null};};
const sourcePaths=['laboratorio-marco-2b/nucleo.mjs','laboratorio-marco-4a/extensao.mjs','laboratorio-marco-4b/registros.mjs','laboratorio-marco-4b/agendamento-http.mjs','laboratorio-marco-4c/perfil.mjs','laboratorio-marco-4c/integridade-incremental.mjs','laboratorio-marco-4c/transporte-local.mjs','laboratorio-marco-2b/auth-local.mjs'];
const sourceHashes=()=>sourcePaths.map(path=>({path,sha256:hash(readFileSync(resolve(root,'04_BANCO_E_SUPABASE',path)).toString())}));
let identities,web,profiler,fixture,running,rows=[],observed=[];
async function request(u,path,body){
 const id=randomUUID(),at=performance.now();let code=0,socketAssigned,connected,reused;
 try{return await new Promise((ok,fail)=>{
  const req=httpRequest({hostname:'127.0.0.1',port:3103,path,method:body===undefined?'GET':'POST',headers:{Host:'127.0.0.1:3101',Origin:'http://127.0.0.1:3101',Authorization:'Bearer '+u.token,'Content-Type':'application/json','X-Metallo-Lab-Request-Id':id},signal:AbortSignal.timeout(100000)},res=>{
   code=res.statusCode;const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',fail);res.on('end',()=>{try{assert.ok([200,201].includes(code),`HTTP ${code} ${path}`);const bytes=Buffer.concat(chunks);ok(/application\/(pdf|zip)/.test(res.headers['content-type']??'')?{bytes:bytes.length}:JSON.parse(bytes));}catch(e){fail(e);}});
  });req.on('socket',s=>{socketAssigned=performance.now()-at;reused=req.reusedSocket;s.once('connect',()=>{connected=performance.now()-at;});});req.on('error',fail);req.end(body===undefined?undefined:JSON.stringify(body));
 });}finally{rows.push({request_id:id,user:u.index,path,status:code,latency_ms:performance.now()-at,socket_assigned_ms:socketAssigned,connected_ms:connected,reused_socket:reused});}
}
async function rpc(u,name,body={}){const at=performance.now(),r=await fetch(status.API_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+u.token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);const data=await r.json();rows.push({user:u.index,path:'/rest/v1/rpc/'+name,status:r.status,latency_ms:performance.now()-at});return data;}
async function home(u){const p=await rpc(u,'my_employee_profile');assert.equal(p[0].employee_id,u.person.employeeId);if(u.noTeam)assert.equal(p[0].team_name,null);
 const pending=Promise.all([rpc(u,'my_personal_items_3g'),rpc(u,'my_epi_delivery_groups_3d'),rpc(u,'my_communications_3h',{p_unread_only:true,p_limit:20,p_offset:0})]);
 await request(u,'/api/ponto-online/clock');await wait(250);const list=await request(u,'/api/ponto-registros/list',{period:'today',offset:0});observed.push({user:u.index,events:list.events});await pending;
}
const plan=[...[10,20,30,40,50].map(n=>({name:'incremental-'+n,n,history:22,kind:'A'})),...['A','B','C','D','E','F'].map(kind=>({name:'concorrencia-'+kind,n:50,history:22,kind})),{name:'historico-100',n:50,history:2,kind:'A'},{name:'historico-3300',n:50,history:66,kind:'A'}];
const selection=process.argv[3];const cases=selection?plan.filter(c=>selection.split(',').includes(c.name)):plan;assert.ok(cases.length);
const summary={at:new Date().toISOString(),stage,scope:'SIMULAÇÃO SEM VALOR OFICIAL; HTTP real local, sem medição de GPS físico ou DOM',cases:[],source_hashes:sourceHashes(),passed:false};
try{
 const out=openSync(resolve(base,'gateway-'+Date.now()+'.log'),'w'),err=openSync(resolve(base,'gateway-'+Date.now()+'.erro.log'),'w');
 web=spawn(process.execPath,[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:resolve(root,'01_WEB'),windowsHide:true,env:{...process.env,METALLO_4C_TELEMETRY:'1',METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',METALLO_COLABORADOR_LAB_URL:status.API_URL,METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_LOAD_TEST_CORE_PORT:'3107'},stdio:['ignore',out,err]});closeSync(out);closeSync(err);
 for(const c of cases){
  const dir=resolve(base,c.name);assert.ok(!existsSync(resolve(dir,'resultado.json')),'Não sobrescrever caso existente');mkdirSync(dir,{recursive:true});
  profiler=createProfiler(dir);fixture=await fixtures({milestone:'4C',historicalPerUser:c.history,reuseIdentities:identities,telemetry:profiler,incremental:process.env.METALLO_4C_ROUND==='5'&&stage==='depois'});identities=fixture.users;profiler.setUsers(identities);if(fixture.core.integrityMode!=='incremental')profiler.profileDb(fixture.core.db);await profiler.observePostgres(status.DB_URL);
  // Uma marca prévia por titular permite downloads próprios em todos os casos.
  const {createPointExtension}=await import('../laboratorio-marco-4a/extensao.mjs');let point=createPointExtension(fixture.core);const bootstrapRecoveries=[];
  for(const u of identities){const key=randomUUID();await point.begin(u.person,{idempotency_key:key});
   try{await point.finish(u.person,{idempotency_key:key,location:{status:'DENIED'}},()=>fixture.auth.verifyPersonal(u.token));}
   catch(e){
    // Somente bootstrap não cronometrado. Não repetir/ocultar falha na carga.
    // Mesma base, original e intenção; recuperação suportada já testada em 2D.
    if(e.code!=='EPERM'||e.syscall!=='rename'||!e.path?.startsWith(fixture.dir+'.anchor.json.'))throw e;
    bootstrapRecoveries.push({user:u.index,code:e.code,syscall:e.syscall,at:new Date().toISOString(),same_key:true,measured:false});
    await fixture.core.close();await wait(100);
    fixture.core=await createLabCore(fixture.dir,{authorizationPath:fixture.dir+'.authorization.json',source:createLocalSource(status.SERVICE_ROLE_KEY),telemetry:profiler});if(fixture.core.integrityMode!=='incremental')profiler.profileDb(fixture.core.db);point=createPointExtension(fixture.core);
    assert.equal((await fixture.core.inspect()).ready_for_new_events,true);
    await point.finish(u.person,{idempotency_key:key,location:{status:'DENIED'}},()=>fixture.auth.verifyPersonal(u.token));
   }
  }
  const old=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;
  for(const u of identities)u.owned=old.filter(e=>e.auth_user_id===u.person.authUserId).map(e=>e.event_id);
  const receipts=(await fixture.core.db.query('select event_id from lab4a.receipt order by synthetic_sequence')).rows;
  for(const u of identities)u.downloadId=receipts.find(r=>u.owned.includes(r.event_id)).event_id;
  running=await startPointServer({core:fixture.core,auth:fixture.auth,port:3107,sessionPort:3108,telemetry:profiler});
  let ready=false;for(let n=0;n<40;n++){try{await request(identities[0],'/api/ponto-online/clock');ready=true;break;}catch{}await wait(250);}assert.ok(ready);rows=[];observed=[];
  const start=performance.now(),startedAt=new Date().toISOString();
  const marking=Promise.all(identities.slice(0,c.n).map(async u=>{const begin=performance.now(),key=randomUUID();try{const intent=await request(u,'/api/ponto-online/begin',{idempotency_key:key});const result=await request(u,'/api/ponto-online/events',{idempotency_key:key,location:{status:'DENIED'}});assert.equal(result.event.marking_at,intent.marking_at);u.owned.push(result.event.event_id);return {user:u.index,idempotency_key:key,event_id:result.event.event_id,latency_ms:performance.now()-begin};}catch(e){return {user:u.index,idempotency_key:key,error:e.code??e.message,latency_ms:performance.now()-begin};}}));
  const competing=Promise.all(identities.map(async u=>{const jobs=[];if(['B','F'].includes(c.kind))jobs.push(home(u));if(['C','F'].includes(c.kind))jobs.push(request(u,'/api/ponto-registros/list',{period:'60d',offset:0}).then(l=>observed.push({user:u.index,events:l.events})));if(['D','F'].includes(c.kind))jobs.push(request(u,`/api/ponto-registros/receipt/${u.downloadId}`));if(['E','F'].includes(c.kind))jobs.push(request(u,'/api/ponto-registros/last48'));return Promise.allSettled(jobs);}));
  const marks=await marking;const marksFinishedAt=new Date().toISOString();const competingResults=await competing;const errors=[...marks.filter(m=>m.error).map(m=>m.error),...competingResults.flat().filter(r=>r.status==='rejected').map(r=>r.reason.code??r.reason.message)];const finishedAt=new Date().toISOString(),elapsed=performance.now()-start;
  const measuredRows=[...rows],trace=profiler.snapshot();
  const after=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows,oldIds=new Set(old.map(e=>e.event_id));
  assert.equal(hash(after.filter(e=>oldIds.has(e.event_id))),hash(old));if(!errors.length)assert.equal(after.length,old.length+c.n);assert.equal(new Set(after.map(e=>e.idempotency_key)).size,after.length);
  for(const m of marks.filter(m=>!m.error))assert.ok(after.some(e=>e.event_id===m.event_id&&e.auth_user_id===identities[m.user].person.authUserId&&e.idempotency_key===m.idempotency_key));
  for(const l of observed)assert.ok(l.events.every(e=>after.some(row=>row.event_id===e.event_id&&row.auth_user_id===identities[l.user].person.authUserId)));
  if(!errors.length)assert.equal((await fixture.core.db.query('select count(*)::int as n from lab4a.receipt')).rows[0].n,50+c.n);const readiness=await fixture.core.inspect();
  const relevant=trace.traces.filter(t=>new Date(t.start)>=new Date(startedAt)&&new Date(t.start)<=new Date(finishedAt));const ids=new Set(relevant.map(t=>t.request_id));
  const queues=trace.queues.filter(q=>ids.has(q.request_id)),writer=queues.filter(q=>q.scope==='writer'),exclusive=queues.filter(q=>q.scope==='exclusive');const spanNames=[...new Set(relevant.flatMap(t=>t.spans.map(s=>s.name)))];
  const resource=trace.resources.filter(r=>r.at&&r.at>=startedAt&&r.at<=finishedAt),pg=trace.postgres.filter(r=>r.at>=startedAt&&r.at<=finishedAt);
  const result={...c,transport:fixture.transport?.inspect(),bootstrap_recoveries:bootstrapRecoveries,started_at:startedAt,marks_finished_at:marksFinishedAt,finished_at:finishedAt,duration_ms:elapsed,historical_originals:50*c.history,events_before:old.length,events_after:after.length,marking:stats(marks.map(m=>m.latency_ms)),writer_wait:stats(writer.map(q=>q.wait_ms)),writer_execution:stats(writer.map(q=>q.service_ms)),exclusive_wait:stats(exclusive.map(q=>q.wait_ms)),exclusive_region:stats(exclusive.map(q=>q.service_ms)),steps:Object.fromEntries(spanNames.map(name=>[name,stats(relevant.flatMap(t=>t.spans.filter(s=>s.name===name).map(s=>s.ms)))])),event_loop:stats(resource.map(r=>r.event_loop_max_ms)),cpu:stats(resource.map(r=>r.cpu_one_core_percent)),postgres_connections:stats(pg.map(p=>Number(p.activity.connections))),lock_waiters:Math.max(0,...pg.map(p=>Number(p.activity.waiting_lock))),client_socket_wait:stats(measuredRows.filter(r=>r.socket_assigned_ms!==undefined).map(r=>r.socket_assigned_ms)),new_client_connections:measuredRows.filter(r=>r.connected_ms!==undefined).length,reused_client_sends:measuredRows.filter(r=>r.reused_socket).length,gc:trace.gc.filter(g=>g.start_ms>=start&&g.start_ms<=start+elapsed),marks,requests:measuredRows,original_before_sha256:hash(old),original_after_sha256:hash(after.filter(e=>oldIds.has(e.event_id))),duplicates:0,lost:errors.length?null:0,cross_user:0,errors,readiness,passed:errors.length===0&&readiness.ready_for_new_events};
  await running.shutdown();running=null;fixture=null;await profiler.close();profiler=null;
  writeFileSync(resolve(dir,'resultado.json'),JSON.stringify(result,null,2)+'\n');summary.cases.push({...result,marks:undefined,requests:undefined,steps:result.steps,gc_count:result.gc.length,gc:undefined});console.log(JSON.stringify({case:c.name,p95:result.marking.p95,writer:result.writer_wait.p95,exclusive:result.exclusive_region.p95,history:result.events_before}));
 }
 assert.deepEqual(sourceHashes(),summary.source_hashes,'Código medido não pode mudar durante ensaio');summary.passed=summary.cases.every(c=>c.passed);
}catch(e){summary.error=e.code??e.message;summary.error_context={syscall:e.syscall,path:e.path?.startsWith(root)?e.path.slice(root.length):undefined,frames:e.stack?.split('\n').slice(1)};console.error(JSON.stringify({error:summary.error,...summary.error_context}));}
finally{if(running)await running.shutdown();else if(fixture)await fixture.core.close();if(profiler)await profiler.close();web?.kill();summary.finished_at=new Date().toISOString();writeFileSync(resolve(base,'resumo-'+Date.now()+'.json'),JSON.stringify(summary,null,2)+'\n');process.exitCode=summary.passed?0:1;}
