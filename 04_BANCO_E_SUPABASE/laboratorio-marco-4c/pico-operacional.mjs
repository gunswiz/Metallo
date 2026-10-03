// Rodada 6: clique simulado -> begin -> GPS vigente -> recibo HTTP validado.
// Agente e sessão próprios por titular. Não representa 30 aparelhos físicos/DOM.
import assert from 'node:assert/strict';
import { Agent,request as httpRequest } from 'node:http';
import { randomUUID,createHash } from 'node:crypto';
import { mkdirSync,existsSync,readFileSync,writeFileSync,openSync,closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fixtures,api } from '../laboratorio-marco-4b/carga-fixtures.mjs';
import { startPointServer } from '../laboratorio-marco-4a/servidor-4a.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { createPointExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { backupCore,restoreDisposable } from '../laboratorio-marco-2b/backup.mjs';
import { acquireEventLocation } from '../../01_WEB/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento.ts';
import { pointReceipt } from '../../01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-online.ts';
import { root,status } from '../laboratorio-marco-4a/ambiente.mjs';
import { createProfiler } from './perfil.mjs';
const smoke=process.argv[2]==='bootstrap-smoke',adoption=process.argv[2]==='adocao'||smoke,mode=adoption?'incremental':process.argv[2];assert.ok(['full','incremental'].includes(mode));if(!adoption)assert.equal(process.env.METALLO_4C_ROUND,'6');else assert.ok(!process.env.METALLO_4C_ROUND,'Adoção deve medir fluxo normal sem flag de rodada');
const dest=resolve(import.meta.dirname,...(smoke?['adocao-controlada','correcao-bootstrap']:adoption?['adocao-controlada']:['rodada-6']),'pico',mode);mkdirSync(dest,{recursive:true});assert.ok(!existsSync(resolve(dest,'resumo.json')),'Não sobrescrever ensaio');
const wait=ms=>new Promise(ok=>setTimeout(ok,Math.max(0,ms))),sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const stats=v=>{const a=[...v].sort((x,y)=>x-y);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1]??null,p95:a[Math.ceil(a.length*.95)-1]??null,p99:a[Math.ceil(a.length*.99)-1]??null,max:a.at(-1)??null};};
const sources=['laboratorio-marco-2b/nucleo.mjs','laboratorio-marco-2b/backup.mjs','laboratorio-marco-4a/extensao.mjs','laboratorio-marco-4c/integridade-incremental.mjs','laboratorio-marco-4c/transporte-local.mjs','laboratorio-marco-4c/pico-operacional.mjs','laboratorio-marco-4c/abrir-laboratorio.mjs','laboratorio-marco-4a/servidor-4a.mjs','laboratorio-marco-4b/carga-fixtures.mjs'];
sources.push('../01_WEB/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio.ts');
const sourceHashes=()=>sources.map(path=>({path,sha256:sha(readFileSync(resolve(root,'04_BANCO_E_SUPABASE',path)).toString())}));
let fixture,running,web,profiler,restored;let devices=[],requests=[],observed=[],downloads=[];
const report={at:new Date().toISOString(),mode,scope:'SIMULAÇÃO SEM VALOR OFICIAL',candidate_adopted:adoption,bootstrap_smoke_only:smoke,normal_preview_assembly:adoption,round_flag_required:!adoption,source_hashes:sourceHashes(),cases:[],passed:false,limitations:['50 contas sintéticas; 30 participantes principais; processos/agentes HTTP lógicos, não celulares físicos','GPS via função vigente e provedor sintético; sem radio, DOM ou atraso real de internet','Cold: gateway recém-iniciado; Auth/banco já preparados; não boot físico Windows/Docker']};
function device(u){return {...u,agent:new Agent({keepAlive:false,maxSockets:2}),locationCalls:0};}
async function request(u,path,body,{management=false}={}){
 const id=randomUUID(),at=performance.now();let code=0,error,assigned,connected;
 try{return await new Promise((ok,fail)=>{
  const coreRequest=path.startsWith('/lab-point/'),req=httpRequest({hostname:'127.0.0.1',port:coreRequest?3107:3103,path,method:body===undefined?'GET':'POST',agent:u.agent,
   headers:{Host:coreRequest?'127.0.0.1:3107':'127.0.0.1:3101',Origin:management?'http://127.0.0.1:3102':'http://127.0.0.1:3101',Authorization:'Bearer '+u.token,'Content-Type':'application/json','X-Metallo-Lab-Request-Id':id},signal:AbortSignal.timeout(65000)},res=>{
    code=res.statusCode;const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',fail);res.on('end',()=>{try{assert.ok([200,201].includes(code),'HTTP_'+code);const bytes=Buffer.concat(chunks);
     if(/application\/(pdf|zip)/.test(res.headers['content-type']??'')){const kind=res.headers['content-type'].includes('pdf')?'pdf':'zip',filename=randomUUID()+'.'+kind;writeFileSync(resolve(fixture.dir+'-downloads',filename),bytes);downloads.push({kind,file:filename,sha256:createHash('sha256').update(bytes).digest('hex'),raw_sha256:createHash('sha256').update(bytes).digest('hex'),artifacts_dir:fixture.dir+'-downloads'});ok({bytes:bytes.length});}
     else ok(JSON.parse(bytes));}catch(e){fail(e);}});
  });req.on('socket',s=>{assigned=performance.now()-at;s.once('connect',()=>{connected=performance.now()-at;});});req.on('error',fail);req.end(body===undefined?undefined:JSON.stringify(body));
 });}catch(e){error=e.code??e.message;throw e;}finally{requests.push({request_id:id,user:u.index,path:path.replace(/[a-f0-9-]{36}/ig,':id'),status:code,latency_ms:performance.now()-at,socket_assigned_ms:assigned,connected_ms:connected,error});}
}
async function location(u){const started=performance.now();let calls=0;const denied=u.index%8===0;
 const geo={getCurrentPosition(ok,fail,options){calls++;u.locationCalls++;assert.deepEqual(options,{enableHighAccuracy:false,maximumAge:0,timeout:8000});setTimeout(()=>denied?fail({code:1}):ok({coords:{latitude:-3.7,longitude:-38.5,accuracy:5},timestamp:Date.now()}),200+u.index%10*20);}};
 const value=await acquireEventLocation(geo,new AbortController().signal);assert.equal(calls,1);return {value,elapsed_ms:performance.now()-started,simulated:true};
}
async function mark(u,key=randomUUID(),doubleClick=false){const click=performance.now(),at=new Date().toISOString();try{
 const intent=await request(u,'/api/ponto-online/begin',{idempotency_key:key});const gps=await location(u),body={idempotency_key:key,location:gps.value};
 const sent=doubleClick?await Promise.all([request(u,'/api/ponto-online/events',body),request(u,'/api/ponto-online/events',body)]):[await request(u,'/api/ponto-online/events',body)];
 const receipt=pointReceipt.parse(sent[0].event);assert.equal(receipt.marking_at,intent.marking_at);assert.equal(receipt.location_status,gps.value.status);
 if(doubleClick){assert.equal(sent[1].event.event_id,receipt.event_id);assert.equal(sent.filter(r=>r.duplicate).length,1);}
 return {user:u.index,click_at:at,click_ms:click,key,event_id:receipt.event_id,receipt,latency_ms:performance.now()-click,gps_elapsed_ms:gps.elapsed_ms,retries:0,duplicate_click_requests:doubleClick?1:0};
 }catch(e){return {user:u.index,click_at:at,click_ms:click,key,latency_ms:performance.now()-click,error:e.code??e.message};}}
async function rpc(u,name,body={}){const at=performance.now(),r=await fetch(status.API_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+u.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});const result=await r.json();requests.push({user:u.index,path:'/rest/v1/rpc/'+name,status:r.status,latency_ms:performance.now()-at});assert.equal(r.status,200);return result;}
async function normalLoad(start){const jobs=[];
 for(let i=0;i<6;i++)jobs.push((async()=>{await wait(start+500+i*700-performance.now());const u=devices[i];const p=await rpc(u,'my_employee_profile');assert.equal(p[0].employee_id,u.person.employeeId);await Promise.all([rpc(u,'my_personal_items_3g'),request(u,'/api/ponto-online/clock')]);})());
 for(let i=0;i<4;i++)jobs.push((async()=>{await wait(start+900+i*900-performance.now());const u=devices[10+i],v=await request(u,'/api/ponto-registros/list',{period:'60d',offset:0});observed.push({user:u.index,events:v.events});})());
 for(let i=0;i<2;i++)jobs.push((async()=>{await wait(start+1200+i*1300-performance.now());await request(devices[i],'/api/ponto-registros/receipt/'+devices[i].downloadId);})());
 jobs.push((async()=>{await wait(start+2500-performance.now());await request(devices[2],'/api/ponto-registros/last48');})());
 const admin={index:'admin',token:fixture.adminToken,agent:new Agent({keepAlive:false,maxSockets:1})};
 jobs.push((async()=>{try{await wait(start+1800-performance.now());await request(admin,'/lab-point/v4a/management',undefined,{management:true});}finally{admin.agent.destroy();}})());return Promise.allSettled(jobs);
}
function offset(i,n,window,seed){if(i===0)return 0;if(i===n-1)return window;let x=(seed+i*2654435761)>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967295*window;}
async function runCase(name,window,{n=30,temperature='warm',repeat=1,mixed=false}={}){
 const caseDir=resolve(dest,name+'-'+temperature+'-'+repeat);assert.ok(!existsSync(caseDir));mkdirSync(caseDir);
 requests=[];observed=[];downloads=[];
 const old=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;await fixture.core.auditIntegrity();
 const start=performance.now(),startAt=new Date().toISOString();const competing=mixed?normalLoad(start):Promise.resolve([]);
 const marks=await Promise.all(devices.slice(0,n).map(async(u,i)=>{await wait(start+offset(i,n,window,repeat*997+name.charCodeAt(0))-performance.now());return mark(u,randomUUID(),name==='B'&&repeat===1&&temperature==='warm'&&i===0);}));const competingResults=await competing;
 const markedAt=new Date().toISOString(),oldIds=new Set(old.map(e=>e.event_id)),after=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;
 const added=after.filter(e=>!oldIds.has(e.event_id)),success=marks.filter(m=>!m.error),errors=[...marks.filter(m=>m.error).map(m=>m.error),...competingResults.filter(r=>r.status==='rejected').map(r=>r.reason.code??r.reason.message)];
 let cross=0,falseSuccess=0,lost=0;for(const m of success){const expected=added.find(e=>e.event_id===m.event_id&&e.idempotency_key===m.key);if(!expected){lost++;falseSuccess++;}else if(expected.auth_user_id!==devices[m.user].person.authUserId)cross++;}
 for(const l of observed)if(!l.events.every(e=>after.some(a=>a.event_id===e.event_id&&a.auth_user_id===devices[l.user].person.authUserId)))cross++;
 const duplicate=added.length-new Set(added.map(e=>e.idempotency_key)).size,unchanged=sha(after.filter(e=>oldIds.has(e.event_id)))===sha(old);
 const point=createPointExtension(fixture.core);const receipts=await point.verify();const sequenceValid=receipts.every((r,i)=>!i||r.synthetic_sequence>receipts[i-1].synthetic_sequence);
 const integral=await fixture.core.auditIntegrity(),health=await fixture.core.inspect();const finishedAt=new Date().toISOString(),trace=profiler.snapshot();
 const results={name,repeat,temperature,n,window_ms:window,observed_click_window_ms:Math.max(...marks.map(m=>m.click_ms))-Math.min(...marks.map(m=>m.click_ms)),started_at:startAt,marks_finished_at:markedAt,finished_at:finishedAt,
  marking:stats(marks.map(m=>m.latency_ms)),gps:stats(success.map(m=>m.gps_elapsed_ms)),successes:success.length,errors,http_503:requests.filter(r=>r.status===503).length,timeouts:errors.filter(e=>/TIMEOUT|ABORT/i.test(e)).length,retries:0,
  originals_before:old.length,originals_after:after.length,expected_new:n,observed_new:added.length,duplicates:duplicate,lost,cross_user:cross,false_success:falseSuccess,originals_unchanged:unchanged,
  integral_passed:integral.passed,receipt_count:receipts.length,sequence_valid:sequenceValid,health,transport:fixture.transport?.inspect(),marks:marks.map(m=>({...m,click_ms:undefined})),requests:[...requests],downloads:[...downloads],
  event_loop:stats(trace.resources.filter(r=>r.at>=startAt&&r.at<=markedAt).map(r=>r.event_loop_max_ms)),postgres_connections:stats(trace.postgres.filter(r=>r.at>=startAt&&r.at<=markedAt).map(r=>Number(r.activity.connections)))};
 results.passed=success.length===n&&(!adoption||!['B','C','D'].includes(name)||results.marking.p95<15000)&&!results.timeouts&&!errors.length&&!results.http_503&&!duplicate&&!lost&&!cross&&!falseSuccess&&unchanged&&added.length===n&&integral.passed&&sequenceValid&&health.ready_for_new_events;
 writeFileSync(resolve(caseDir,'resultado.json'),JSON.stringify(results,null,2)+'\n');report.cases.push(results);console.log(JSON.stringify({mode,case:name,temperature,repeat,p95_ms:results.marking.p95,max_ms:results.marking.max,successes:success.length,http_503:results.http_503,passed:results.passed}));if(adoption)assert.equal(results.passed,true,'Gate de pico falhou: '+name);
}
try{
 profiler=createProfiler(dest);fixture=await fixtures({milestone:'4C',telemetry:profiler,incremental:mode==='incremental'});profiler.setUsers(fixture.users);if(mode==='full')profiler.profileDb(fixture.core.db);await profiler.observePostgres(status.DB_URL);
 devices=fixture.users.map(device);report.distinct={auth_users:new Set(devices.map(u=>u.person.authUserId)).size,employees:new Set(devices.map(u=>u.person.employeeId)).size,sessions:new Set(devices.map(u=>u.person.sessionId)).size,agents:new Set(devices.map(u=>u.agent)).size};assert.equal(report.distinct.sessions,50);
 mkdirSync(fixture.dir+'-downloads');const point=createPointExtension(fixture.core);for(const u of devices){const key=randomUUID();await point.begin(u.person,{idempotency_key:key});const r=await point.finish(u.person,{idempotency_key:key,location:{status:'DENIED'}});u.downloadId=r.event.event_id;}
 running=await startPointServer({core:fixture.core,auth:fixture.auth,port:3107,sessionPort:3108,telemetry:profiler});
 const out=openSync(resolve(dest,'gateway.log'),'wx'),err=openSync(resolve(dest,'gateway.erro.log'),'wx'),boot=performance.now();
 web=spawn(process.execPath,[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:resolve(root,'01_WEB'),windowsHide:true,env:{...process.env,METALLO_4C_ROUND:adoption?'':mode==='incremental'?'6':'4',METALLO_4C_TELEMETRY:'1',METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',METALLO_COLABORADOR_LAB_URL:status.API_URL,METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_LOAD_TEST_CORE_PORT:'3107'},stdio:['ignore',out,err]});closeSync(out);closeSync(err);
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:3103/colaborador/login');await r.arrayBuffer();if(r.ok){ready=true;break;}}catch{}await wait(250);}assert.ok(ready);report.gateway_startup_ms=performance.now()-boot;
 if(mode==='incremental'){
  if(!adoption)await runCase('A',1000,{temperature:'cold'});
  if(smoke){await runCase('B',5000);await runCase('A',1000);await runCase('HEADROOM50',1000,{n:50});}
  else{
   for(const [name,window,mixed] of [['A',1000,false],['B',5000,false],['C',15000,false],['D',5000,true]])for(let repeat=1;repeat<=(adoption?3:5);repeat++)await runCase(name,window,{repeat,mixed});
   for(let repeat=1;repeat<=(adoption?3:5);repeat++)await runCase('HEADROOM50',1000,{repeat,n:50});
  }
 }else{await runCase('B',5000,{temperature:'cold'});for(let repeat=1;repeat<=(adoption?3:5);repeat++)await runCase('B',5000,{repeat});}
 if(!smoke){
 // Idempotência fora da distribuição das rodadas: replay idêntico, depois intenção nova.
 const u=devices[0],oldCount=(await fixture.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n;const first=await mark(u,randomUUID(),true);assert.ok(!first.error);const second=await mark(u);assert.ok(!second.error);const newCount=(await fixture.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n;assert.equal(newCount-oldCount,2);report.idempotency={passed:true,same_intent_same_event:true,new_intention_new_event:true,originals_added:2};
 if(mode==='incremental'){
  const backupDir=fixture.dir+(adoption?'-backup-adocao':'-backup-r6'),restoreDir=fixture.dir+(adoption?'-restore-adocao':'-restore-r6'),anchorPath=restoreDir+'.anchor.json';const originals=JSON.stringify((await fixture.core.db.query('select * from lab_time_event order by event_id')).rows);
  const m=await backupCore(fixture.core,backupDir),r=await restoreDisposable(backupDir,restoreDir,{anchorPath,referenceAnchor:fixture.dir+'.anchor.json'});
  restored=await createLabCore(restoreDir,{anchorPath,authorizationPath:fixture.dir+'.authorization.json',source:createLocalSource(status.SERVICE_ROLE_KEY),integrityMode:'incremental'});const rp=createPointExtension(restored);
  assert.equal(JSON.stringify((await restored.db.query('select * from lab_time_event order by event_id')).rows),originals);const rr=await rp.verify();assert.equal((await restored.auditIntegrity()).passed,true);assert.equal((await restored.inspect()).ready_for_new_events,true);
  const realPerson=await fixture.auth.verifyPersonal(u.token);await rp.readPersonal(realPerson,()=>true);
  report.restore={passed:true,format_version:m.format_version,originals:r.event_count,receipts:rr.length,exact_originals:true,integral:true,checkpoint_reference_current:true,sequence_before:r.receipt_sequence_before,sequence_after:r.receipt_sequence,authorization:'CURRENT external ledger + fresh real Auth; no Auth/token database restored',backup_directory:backupDir.replace(root,'<workspace>'),restore_directory:restoreDir.replace(root,'<workspace>')};
  const token=await api('/auth/v1/token?grant_type=refresh_token',{refresh_token:u.refresh},status.ANON_KEY);const verified=await fixture.auth.verifyPersonal(token.access_token);assert.equal(verified.authUserId,u.person.authUserId);report.refresh={passed:true,same_identity:true,token_persisted:false};
 }
 }
 assert.deepEqual(sourceHashes(),report.source_hashes,'Fonte medida mudou durante ensaio');report.passed=report.cases.every(c=>c.passed)&&(smoke||report.idempotency.passed&&(mode==='full'||report.restore.passed));
}catch(e){report.error={code:e.code??e.message,name:e.name};console.error(JSON.stringify(report.error));}
finally{for(const u of devices)u.agent.destroy();await restored?.close();if(running)await running.shutdown();else await fixture?.core.close();web?.kill();await profiler?.close();report.finished_at=new Date().toISOString();writeFileSync(resolve(dest,'resumo.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=report.passed?0:1;}
