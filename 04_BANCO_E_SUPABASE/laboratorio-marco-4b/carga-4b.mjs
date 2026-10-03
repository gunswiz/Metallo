// Carga HTTP real: 50 identidades distintas, barreiras sem throttle por usuário.
// Mesmos handlers 4A/4B e Next 3101; núcleo descartável, nunca o remoto.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { mkdirSync,writeFileSync,readFileSync,openSync,closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn,execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpus,totalmem,platform,release } from 'node:os';
import { request as nodeRequest } from 'node:http';
import { fixtures,login } from './carga-fixtures.mjs';
import { startPointServer } from '../laboratorio-marco-4a/servidor-4a.mjs';
import { revokePortalAccountLocal } from '../laboratorio-marco-1a/revogar-conta-portal-servidor.mjs';
import { root,status } from '../laboratorio-marco-4a/ambiente.mjs';
const {unzipSync}=createRequire(resolve(root,'01_WEB/package.json'))('fflate');
const profile4c=process.env.METALLO_4C_RUN;
const round2=profile4c&&['2','3','4','5'].includes(process.env.METALLO_4C_ROUND);
assert.ok(!profile4c||['antes','depois','duracao'].includes(profile4c));
const lab=profile4c?resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4c',...(round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]),profile4c):resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4b');
if(profile4c)mkdirSync(lab,{recursive:true});
const trafficProfile=profile4c?(await import('../laboratorio-marco-4c/ambiente-carga.mjs')).loadEnvironment():null;
const report={at:new Date().toISOString(),scope:'50 usuários sintéticos — SIMULAÇÃO SEM VALOR OFICIAL',passed:false,requests:[],phases:[],failures:[],intents:[],downloads:[],revocations:[],limits:['Um writer PGlite serializado; não prova writers distribuídos','Dados históricos fabricados antes da medição','Resposta pós-commit descartada pelo cliente; não falha física de rede','Sem SLA ou extrapolação de produção','Sem remoto, sem baseline 4B']};
const sha=v=>createHash('sha256').update(typeof v==='string'||v instanceof Uint8Array?v:JSON.stringify(v)).digest('hex');
let fixture,running,sampler,web,artifacts,profiler,currentPhase='setup',inFlight=0,requestSerial=0;
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
function transport(port,path,headers,body,discard=false,observation){return new Promise((ok,fail)=>{
 const req=nodeRequest({hostname:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers,signal:AbortSignal.timeout(100000)},res=>{
  const status=res.statusCode,h=new Headers();for(const [key,value] of Object.entries(res.headers))if(value!==undefined)h.set(key,Array.isArray(value)?value.join(','):value);
  if(discard&&[200,201].includes(status)){res.resume();ok({status,headers:h,bytes:Buffer.alloc(0),discarded:true});return;}
  const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',fail);res.on('end',()=>ok({status,headers:h,bytes:Buffer.concat(chunks)}));
 });
 if(observation)req.on('socket',socket=>{observation.reused_socket=req.reusedSocket;observation.keep_alive_agent=req.agent?.options?.keepAlive===true;
  if(socket.connecting){const at=performance.now();socket.once('connect',()=>{observation.socket_connect_ms=performance.now()-at;});}
  else observation.socket_connect_ms=0;
 });
 req.on('error',fail);req.end(body===undefined?undefined:JSON.stringify(body));
});}
function check(ok,message){if(!ok)throw Error(message);}
async function request(u,path,body,{port=3101,discard=false}={}){
 check([3101,3105,...(profile4c?[54321]:[])].includes(port),'Destino de carga fora de loopback');
 const tcpPort=trafficProfile?Number(new URL(port===3101?trafficProfile.base_url:port===3105?trafficProfile.session_url:trafficProfile.auth_url).port):port===3101?3103:3108;
 const id=++requestSerial,correlation=randomUUID(),begin=performance.now(),row={id,...(profile4c?{request_id:correlation}:{}),phase:currentPhase,user:u.index,path,method:body===undefined?'GET':'POST',start_ms:begin,status:0};
 inFlight++;report.max_in_flight=Math.max(report.max_in_flight??0,inFlight);
 try{
  if(round2&&body?.period){row.period=body.period;row.offset=body.offset??0;}
  const r=await transport(tcpPort,path,{...(profile4c?{'X-Metallo-Lab-Request-Id':correlation}:{}),...(port===54321?{apikey:status.ANON_KEY}:{}),Host:`127.0.0.1:${port===3101?3101:port===54321?54321:3108}`,Authorization:`Bearer ${u.token}`,Origin:'http://127.0.0.1:3101','Content-Type':'application/json'},body,discard,round2?row:undefined);
  row.status=r.status;row.headers_ms=performance.now()-begin;
  if(r.discarded){row.intentionally_discarded_after_headers=true;return r;}
  const bytes=r.bytes;row.bytes=bytes.length;
  const json=r.headers.get('content-type')?.includes('json')?JSON.parse(bytes):null;
  if(r.status>=400)row.error_code=json?.error??'HTTP_ERROR';
  return {status:r.status,json,bytes,headers:r.headers};
 }catch(e){row.error_code=e.name==='TimeoutError'||e.cause?.name==='TimeoutError'?'TIMEOUT':e.code??e.name;return {status:0,error:row.error_code};}
 finally{inFlight--;row.end_ms=performance.now();row.latency_ms=row.end_ms-begin;report.requests.push(row);}
}
async function phase(name,work){
 currentPhase=name;const first=report.requests.length,at=performance.now(),startedAt=new Date().toISOString();console.log('PHASE '+name);
 // Todos os 50 callbacks recebem a mesma barreira, sem dormir entre disparos.
 let releaseBarrier;const barrier=new Promise(ok=>releaseBarrier=ok);
 const tasks=fixture.users.map(u=>(async()=>{await barrier;return work(u);})());releaseBarrier();
 const results=await Promise.allSettled(tasks);
 for(let n=0;n<results.length;n++)if(results[n].status==='rejected')report.failures.push({phase:name,user:n,error:results[n].reason.message});
 const rows=report.requests.slice(first),starts=rows.filter(r=>r.phase===name).map(r=>r.start_ms);
 report.phases.push({name,users:50,requests:rows.length,duration_ms:performance.now()-at,...(round2?{started_at:startedAt,finished_at:new Date().toISOString()}:{}),first_request_spread_ms:starts.length?Math.max(...fixture.users.map(u=>rows.find(r=>r.user===u.index)?.start_ms??Math.min(...starts)))-Math.min(...starts):0,failures:results.filter(r=>r.status==='rejected').length});
}
async function begin(u){const key=randomUUID(),intent={user:u.index,key,confirmed:false};report.intents.push(intent);let r=await request(u,'/api/ponto-online/begin',{idempotency_key:key});for(let n=0;n<2&&(r.status===0||r.status>=500);n++){report.retries=(report.retries??0)+1;r=await request(u,'/api/ponto-online/begin',{idempotency_key:key});}check(r.status===200,'Begin '+r.status);intent.marking_at=r.json.marking_at;return intent;}
async function finish(u,intent,{discard=false}={}){
 let r=await request(u,'/api/ponto-online/events',{idempotency_key:intent.key,location:{status:'DENIED'}},{discard});
 // Uma resposta ambígua não vira intenção nova. Consulta/retry mantém a mesma chave.
 for(let attempt=0;attempt<3&&(r.status===0||r.status>=500||discard);attempt++){
  report.retries=(report.retries??0)+1;await wait(250);
  const out=await request(u,'/api/ponto-online/intent/'+intent.key);
  if(out.status===200){r={...out,json:{event:out.json.event}};break;}
  r=await request(u,'/api/ponto-online/events',{idempotency_key:intent.key,location:{status:'DENIED'}});discard=false;
 }
 check([200,201].includes(r.status),'Commit/recovery '+r.status);check(r.json?.event?.marking_at===intent.marking_at,'Horário original alterado');
 intent.confirmed=true;intent.event=r.json.event;return r.json.event;
}
async function list(u,period='60d',offset=0){const r=await request(u,'/api/ponto-registros/list',{period,offset});check(r.status===200,'Lista '+r.status);return r.json;}
function savePDF(u,event,r,label){
 check(r.status===200,'PDF '+r.status);check(r.headers.get('content-type')==='application/pdf','Tipo PDF');check(/no-store/.test(r.headers.get('cache-control')),'PDF cache público');
 const filename=`${label}-u${u.index}-${event.event_id}.pdf`;writeFileSync(resolve(artifacts,filename),r.bytes);
 report.downloads.push({kind:'pdf',user:u.index,file:filename,event,sha256:sha(r.bytes)});
}
function saveZIP(u,events,r,label){
 check(r.status===200,'ZIP '+r.status);check(r.headers.get('content-type')==='application/zip','Tipo ZIP');
 const files=unzipSync(r.bytes),expected=events.map(e=>'recibo-laboratorio-'+e.event_id+'.pdf').sort();
 check(JSON.stringify(Object.keys(files).sort())===JSON.stringify(expected),'ZIP contém conjunto diferente');
 const filename=`${label}-u${u.index}.zip`;writeFileSync(resolve(artifacts,filename),r.bytes);
 report.downloads.push({kind:'zip',user:u.index,file:filename,events,sha256:sha(r.bytes),members:expected});
}
function startSampler(){
 const file=resolve(lab,'carga-recursos.jsonl');writeFileSync(file,'');
 const script=`while(Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue){try{$metalloOs=Get-CimInstance Win32_OperatingSystem;$metalloCpu=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'";$metalloConnections=& 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' exec supabase_db_laboratorio-marco-1a psql -X -q -A -t -U postgres -d postgres -c 'select count(*) from pg_stat_activity';[pscustomobject]@{at=[DateTime]::UtcNow.ToString('o');cpu_percent=$metalloCpu.PercentProcessorTime;free_ram_bytes=([double]$metalloOs.FreePhysicalMemory)*1024;total_ram_bytes=([double]$metalloOs.TotalVisibleMemorySize)*1024;db_connections=[int]$metalloConnections}|ConvertTo-Json -Compress|Add-Content -LiteralPath '${file.replaceAll("'","''")}' -Encoding utf8}catch{};Start-Sleep -Seconds 2}`;
 sampler=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:'ignore'});
}
function metrics(rows){const values=rows.map(r=>r.latency_ms).sort((a,b)=>a-b),pct=n=>values[Math.max(0,Math.ceil(values.length*n)-1)]??0;
 const span=rows.length?Math.max(...rows.map(r=>r.end_ms))-Math.min(...rows.map(r=>r.start_ms)):0;
 return {requests:rows.length,duration_ms:span,rps:span?rows.length*1000/span:0,success:rows.filter(r=>r.status>=200&&r.status<300).length,http4xx:rows.filter(r=>r.status>=400&&r.status<500).length,http5xx:rows.filter(r=>r.status>=500).length,timeouts:rows.filter(r=>r.error_code==='TIMEOUT').length,transport_errors:rows.filter(r=>r.status===0).length,p50_ms:pct(.50),p95_ms:pct(.95),p99_ms:pct(.99),max_ms:values.at(-1)??0};}
try{
 if(profile4c){check(sha(readFileSync(resolve(root,'outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip')))==='2ff3076d3a9bee5b33a363ae4264dde392bce7f4662273309b5a5085726c3c71','SHA origem 4B');profiler=(await import('../laboratorio-marco-4c/perfil.mjs')).createProfiler(lab);}
 check(sha(readFileSync(resolve(root,'outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip')))==='50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d','SHA origem');
 const output=openSync(resolve(lab,'carga-web.log'),'w'),errors=openSync(resolve(lab,'carga-web-erro.log'),'w');
 web=spawn(process.execPath,[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:resolve(root,'01_WEB'),windowsHide:true,env:{...process.env,...(profile4c?{METALLO_4C_TELEMETRY:'1'}:{}),METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',METALLO_COLABORADOR_LAB_URL:status.API_URL,METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_LOAD_TEST_CORE_PORT:'3107'},stdio:['ignore',output,errors]});closeSync(output);closeSync(errors);
 let ready=false;for(let n=0;n<30;n++){try{const r=await transport(3103,'/api/ponto-registros/last48',{Host:'127.0.0.1:3101'});if(r.status===401){ready=true;break;}}catch{}await wait(250);}check(ready,'Gateway descartável não iniciou');
 fixture=await fixtures({milestone:profile4c?'4C':'4B',...(['4','5'].includes(process.env.METALLO_4C_ROUND)?{telemetry:profiler,incremental:process.env.METALLO_4C_ROUND==='5'&&profile4c==='depois'}: {})});if(profiler){profiler.setUsers(fixture.users);if(fixture.core.integrityMode!=='incremental')profiler.profileDb(fixture.core.db);await profiler.observePostgres(status.DB_URL);}artifacts=resolve(fixture.dir,'downloads');mkdirSync(artifacts);
 report.run=fixture.run;report.artifacts_dir=artifacts;report.users=fixture.users.map(u=>({index:u.index,...u.person,noTeam:u.noTeam,identityId:u.identityId}));
 report.environment={os:platform()+' '+release(),node:process.version,cpu:cpus()[0].model,logical_cpus:cpus().length,total_ram_bytes:totalmem(),users:50,no_team:5,core:'PGlite 0.5.8, relaxedDurability=false, 1 writer serializado',web:'Next start, um processo, sem cluster',ports:[3103,3107,3108,54321,54322],host_header:'127.0.0.1:3101 (contrato da prévia); TCP 3103 exclusivo de carga',loopback_only:true,client_timeout_ms:100000,gateway_mark_timeout_ms:60000,gateway_download_timeout_ms:90000,browser_mark_timeout_ms:65000,browser_download_timeout_ms:95000};
 const before=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;report.before={count:before.length,sha256:sha(before)};
 running=await startPointServer({core:fixture.core,auth:fixture.auth,port:3107,sessionPort:3108,telemetry:profiler});startSampler();
 // Warmup das duas rotas, explícito e excluído das métricas da carga.
 await list(fixture.users[0],'today');await request(fixture.users[0],'/api/ponto-online/clock');report.warmup_requests=report.requests.splice(0);
 await phase('01-burst-50-begin',async u=>{u.primary=await begin(u);});
 await phase('02-burst-50-commit',async u=>{u.event=await finish(u,u.primary);});
 await phase('03-replay-retry',async u=>{
  if(u.index<10){u.retry=await begin(u);const events=await Promise.all([finish(u,u.retry,{discard:u.index<5}),finish(u,u.retry)]);check(events[0].event_id===events[1].event_id,'Duplo POST duplicou evento');}
  else await list(u,'today');
 });
 await phase('04-home-60dias-paginacao',async u=>{
  const today=await list(u,'today'),collected=[];for(let offset=0;offset<100;offset+=20){const p=await list(u,'60d',offset);check(p.events.length<=20,'Página acima de 20');collected.push(...p.events);if(!p.has_more)break;}
  const own=before.filter(e=>e.auth_user_id===u.person.authUserId&&Date.parse(e.server_received_at_utc)>Date.now()-60*24*3600000).map(e=>e.event_id).concat(report.intents.filter(i=>i.user===u.index&&i.confirmed).map(i=>i.event.event_id)).sort();
  check(JSON.stringify(collected.map(e=>e.event_id).sort())===JSON.stringify(own),'Paginação omite/mistura evento');check(today.events.some(e=>e.event_id===u.event.event_id),'Home perdeu evento');
  u.expected48=collected.filter(e=>Date.parse(e.marking_at)>Date.now()-48*3600000);report[`history_${u.index}`]={today:today.events.length,days60:collected.length,pages:Math.ceil(collected.length/20),event_ids:collected.map(e=>e.event_id)};
 });
 await phase('05-50-pdfs',async u=>{savePDF(u,u.event,await request(u,'/api/ponto-registros/receipt/'+u.event.event_id),'pdf50');});
 await phase('06-50-zips48',async u=>{saveZIP(u,u.expected48,await request(u,'/api/ponto-registros/last48'),'zip50');});
 const completeHome=async u=>{const start=performance.now();
  const profilePromise=request(u,'/rest/v1/rpc/my_employee_profile',{}, {port:54321});
  // A UI vigente usa Promise.allSettled para as três pendências independentes.
  const reads=[['my_personal_items_3g',{}],['my_epi_delivery_groups_3d',{}],['my_communications_3h',{p_unread_only:true,p_limit:20,p_offset:0}]];
  const results=await Promise.all([list(u,'today'),profilePromise,...reads.map(([name,args])=>request(u,'/rest/v1/rpc/'+name,args,{port:54321}))]);
  check(results[1].status===200&&results[1].json.length===1&&results[1].json[0].employee_id===u.person.employeeId,'Perfil Home pessoal incorreto');
  if(u.noTeam)check(results[1].json[0].team_name===null,'Sem equipe perdeu regra');
  for(const r of results.slice(2))check(r.status===200&&Array.isArray(r.json),'RPC de pendência não respondeu');
  report[`home_${u.index}`]={profile_own:true,no_team:u.noTeam,day_count:results[0].events.length,pending_counts:results.slice(2).map(r=>r.json.length),parallel_real_rpcs:3};
  if(round2)(report.home_runs??=[]).push({user:u.index,phase:currentPhase,latency_ms:performance.now()-start,own_profile:true,no_team:u.noTeam});
 };
 if(profile4c)await phase('06c-home-completa-50',completeHome);
 if(profile4c==='depois'||profile4c==='duracao'){
  // Ensaio adicional moderado: dez usuários simultâneos, revezando as 50
  // identidades, sem reduzir nenhuma rajada do cenário original comparável.
  currentPhase='06d-duracao-moderada';const start=performance.now(),first=report.requests.length,startedAt=new Date().toISOString(),target=round2?180000:120000;
  report.sustained={target_ms:target,concurrent_users:10,distinct_users:50,rounds:0,samples:[]};
  while(performance.now()-start<target){
   for(let offset=0;offset<50;offset+=10)await Promise.all(fixture.users.slice(offset,offset+10).map(completeHome));
   report.sustained.rounds++;report.sustained.samples.push({elapsed_ms:performance.now()-start,...profiler.retention()});
   await wait(1000);
  }
  const rows=report.requests.slice(first);report.sustained.duration_ms=performance.now()-start;
  report.phases.push({name:currentPhase,users:50,concurrent_users:10,requests:rows.length,duration_ms:report.sustained.duration_ms,...(round2?{started_at:startedAt,finished_at:new Date().toISOString()}:{}),failures:0});
  report.sustained.cooldown_before=profiler.retention();await wait(15000);report.sustained.cooldown_after=profiler.retention();
 }
 const revokeTask=(async()=>{while(currentPhase!=='07-mista-revogacao-ids')await wait(20);await wait(150);
  for(const u of fixture.users.slice(45)){
   const row={user:u.index,start_ms:performance.now()};report.revocations.push(row);
   await revokePortalAccountLocal({apiUrl:status.API_URL,serviceRoleKey:status.SERVICE_ROLE_KEY,adminAccessToken:fixture.adminToken,identityId:u.identityId,reason:'other'});row.complete_ms=performance.now();u.revoked=true;
  }
 })();
 await phase('07-mista-revogacao-ids',async u=>{
  if(u.index<10){const intent=await begin(u);u.mixed=await finish(u,intent);}
  else if(u.index<20){await list(u,'today');await list(u,'60d',20);}
  else if(u.index<30)savePDF(u,u.event,await request(u,'/api/ponto-registros/receipt/'+u.event.event_id),'mixed');
  else if(u.index<40)saveZIP(u,u.expected48,await request(u,'/api/ponto-registros/last48'),'mixed');
  else if(u.index<45){const old=u.token;const r=await request(u,'/lab-point/v1/session/current',{}, {port:3105});check(r.status===200,'Logout falhou');check((await request(u,'/api/ponto-registros/list',{period:'today'})).status===401,'Token antigo depois de logout');const fresh=await login(u);u.token=fresh.access_token;u.refresh=fresh.refresh_token;u.person=await fixture.auth.verifyPersonal(u.token);check(u.token!==old,'Login repetiu token');await list(u,'today');}
  else{for(let n=0;n<6;n++){await request(u,'/api/ponto-registros/list',{period:'today'});await wait(80);}}
  // Tentativas cruzadas e parâmetros injetados sobrepostas ao trabalho válido.
  if(u.index<45){const other=fixture.users[(u.index+1)%45];
   for(const [path,body] of [[`/api/ponto-registros/receipt/${other.event.event_id}`,undefined],['/api/ponto-registros/list',{period:'60d',employee_id:other.person.employeeId}],['/api/ponto-registros/list',{period:'60d',marking_id:other.event.event_id}],['/api/ponto-registros/list',{period:'60d',receipt_id:other.event.event_id}],['/api/ponto-registros/list',{period:'60d',intention_id:other.primary.key}],[`/api/ponto-registros/last48?employee_id=${other.person.employeeId}`,undefined],['/api/ponto-registros/list',{period:'custom',from:'../../',to:'2026-10-01'}],[`/api/ponto-online/intent/${other.primary.key}`,undefined]]){
    const r=await request(u,path,body);check([400,403,404,409].includes(r.status),'Manipulação não negada '+r.status+' '+path);
   }
  }
 });await revokeTask;
 currentPhase='08-pos-revogacao';for(const u of fixture.users.slice(45)){
  const after=await request(u,'/api/ponto-registros/receipt/'+u.event.event_id);check([401,403].includes(after.status),'Download pós revogação');
  const mark=await request(u,'/api/ponto-online/begin',{idempotency_key:randomUUID()});check([401,403].includes(mark.status),'Nova intenção pós revogação');
  const row=report.revocations.find(r=>r.user===u.index),reqs=report.requests.filter(r=>r.user===u.index&&r.phase==='07-mista-revogacao-ids');
  row.last_success_end_ms=Math.max(0,...reqs.filter(r=>r.status===200).map(r=>r.end_ms));row.first_blocked_start_ms=reqs.find(r=>[401,403].includes(r.status))?.start_ms??report.requests.at(-2).start_ms;
  const afterCompletion=report.requests.filter(r=>r.user===u.index&&r.start_ms>=row.complete_ms&&[401,403].includes(r.status)).sort((a,b)=>a.end_ms-b.end_ms)[0];
  row.first_denied_request_after_complete_ms=afterCompletion?.start_ms??null;row.first_denied_response_after_complete_ms=afterCompletion?.end_ms??null;
  row.observed_block_delay_upper_ms=afterCompletion?afterCompletion.end_ms-row.complete_ms:null;row.not_instantaneous_measurement=true;
  row.successes_started_after_completion=reqs.filter(r=>r.start_ms>=row.complete_ms&&r.status===200).length;check(row.successes_started_after_completion===0,'Operação aceita depois da revogação');
 }
 if(round2){
  // Prova adicional APÓS as operações originais: três páginas realmente
  // disponíveis ao mesmo titular, sem alterar a carga comparável anterior.
  currentPhase='09-paginacao-isolada';const u=fixture.users[0];
  for(let n=0;n<20;n++){const intent=await begin(u);await finish(u,intent);}
  report.pagination_probe={user:u.index,added_synthetic_events:20,pages:[]};
  for(const offset of [0,20,40]){const value=await list(u,'60d',offset);const r=report.requests.at(-1);
   report.pagination_probe.pages.push({offset,events:value.events.length,has_more:value.has_more,latency_ms:r.latency_ms,status:r.status});}
  check(report.pagination_probe.pages[1].has_more&&!report.pagination_probe.pages[2].has_more&&report.pagination_probe.pages[2].events>0,'Não comprovou página intermediária/final');
 }
 const after=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows,baseIds=new Set(before.map(e=>e.event_id)),added=after.filter(e=>!baseIds.has(e.event_id));
 const oldAfter=after.filter(e=>baseIds.has(e.event_id));check(sha(oldAfter)===report.before.sha256,'Original pré-carga alterado');
 const confirmed=report.intents.filter(i=>i.confirmed),keys=new Set(confirmed.map(i=>i.key));
 check(added.length===keys.size,'Contagem de novos eventos difere das intenções confirmadas');check(new Set(added.map(e=>e.idempotency_key)).size===added.length,'Duplicação persistente');
 for(const i of confirmed){const event=added.find(e=>e.idempotency_key===i.key),u=fixture.users[i.user];check(event?.auth_user_id===u.person.authUserId,'Evento de outra pessoa');check(event.event_id===i.event.event_id,'ID confirmado diferente do banco');const row=(await fixture.core.db.query('select i.auth_user_id,i.employee_id,i.marking_at,r.recorded_at from lab4a.intent i join lab4a.receipt r using(idempotency_key) where i.idempotency_key=$1',[i.key])).rows[0];check(row.auth_user_id===u.person.authUserId&&row.employee_id===u.person.employeeId,'Recibo cruzado');check(new Date(row.marking_at).toISOString()===i.marking_at&&new Date(row.recorded_at).toISOString()===i.event.recorded_at,'Recibo não reflete originais');}
 const state=await fixture.core.inspect();check(state.ready_for_new_events,'Núcleo não pronto após carga');
 report.integrity={expected_new_intents:keys.size,persisted_new_events:added.length,old_count:before.length,after_count:after.length,old_sha256_after:sha(oldAfter),originals_unchanged:true,duplicates:0,lost_confirmed:0,cross_user:0,ready:state.ready_for_new_events,receipts_verified:confirmed.length};
 report.passed=report.failures.length===0;
}catch(e){report.error=e.code??e.message;report.passed=false;console.error('FAIL '+report.error);}
finally{
 sampler?.kill();report.metrics=metrics(report.requests);for(const p of report.phases)p.metrics=metrics(report.requests.filter(r=>r.phase===p.name));
 if(running)await running.shutdown();else if(fixture?.core)await fixture.core.close();
 web?.kill();
 if(profiler)await profiler.close();
 writeFileSync(resolve(lab,'carga-resultado.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,requests:report.metrics.requests,failures:report.failures.length,error:report.error??null,integrity:report.integrity??null}));process.exitCode=report.passed?0:1;
}
