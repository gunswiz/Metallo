// Investigação de RAM: mesmas 50 identidades/dataset, sem reter todos os spans.
// Ensaio adicional de leitura do núcleo e RPCs; não substitui a carga completa.
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,openSync,closeSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomUUID,createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { fixtures } from '../laboratorio-marco-4b/carga-fixtures.mjs';
import { startPointServer } from '../laboratorio-marco-4a/servidor-4a.mjs';
import { status,root } from '../laboratorio-marco-4a/ambiente.mjs';
import { createProfiler } from './perfil.mjs';
const round2=['2','3','4','5'].includes(process.env.METALLO_4C_ROUND);
const dir=resolve(import.meta.dirname,...(round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]),'memoria');mkdirSync(dir,{recursive:true});
if(['4','5'].includes(process.env.METALLO_4C_ROUND))assert.ok(!existsSync(resolve(dir,'resultado.json')),'Não sobrescrever prova completa de 50 marcações');
const profiler=createProfiler(dir,{retainTraces:false}),report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; leitura local moderada; sem retenção integral de traces',passed:false,samples:[],operations:0,requests:0};
let fixture,running,web;
const wait=ms=>new Promise(ok=>setTimeout(ok,ms));
const clientRows=[];
async function webRequest(u,path,body){const at=performance.now();let statusCode=0;
 try{return await new Promise((ok,fail)=>{const req=httpRequest({hostname:'127.0.0.1',port:3103,path,method:body===undefined?'GET':'POST',headers:{Host:'127.0.0.1:3101',Origin:'http://127.0.0.1:3101',Authorization:'Bearer '+u.token,'Content-Type':'application/json'},signal:AbortSignal.timeout(100000)},res=>{statusCode=res.statusCode;const chunks=[];res.on('data',v=>chunks.push(v));res.on('error',fail);res.on('end',()=>{try{assert.equal(statusCode,200===statusCode?200:201);ok(JSON.parse(Buffer.concat(chunks)));}catch(e){fail(e);}});});req.on('error',fail);req.end(body===undefined?undefined:JSON.stringify(body));});}
 finally{clientRows.push({user:u.index,path,method:body===undefined?'GET':'POST',status:statusCode,latency_ms:performance.now()-at});}
}
async function homeFlow(u){const at=performance.now();
 const rpc=async(name,body={})=>{const start=performance.now(),r=await fetch(status.API_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+u.token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);const value=await r.json();clientRows.push({user:u.index,path:'/rest/v1/rpc/'+name,status:r.status,latency_ms:performance.now()-start});return value;};
 const profile=await rpc('my_employee_profile');assert.equal(profile[0].employee_id,u.person.employeeId);if(u.noTeam)assert.equal(profile[0].team_name,null);
 const pending=Promise.all([rpc('my_personal_items_3g'),rpc('my_epi_delivery_groups_3d'),rpc('my_communications_3h',{p_unread_only:true,p_limit:20,p_offset:0})]);
 const clock=await webRequest(u,'/api/ponto-online/clock');assert.ok(clock.server_at);await wait(250);
 const day=await webRequest(u,'/api/ponto-registros/list',{period:'today',offset:0});
 assert.ok(day.events.every(e=>u.owned.includes(e.event_id)));assert.ok((await pending).every(Array.isArray));
 return {user:u.index,latency_ms:performance.now()-at,no_team:u.noTeam,requests:6};
}
try{
 fixture=await fixtures({milestone:'4C',...(['4','5'].includes(process.env.METALLO_4C_ROUND)?{telemetry:profiler,incremental:process.env.METALLO_4C_ROUND==='5'}:{})});profiler.setUsers(fixture.users);if(['4','5'].includes(process.env.METALLO_4C_ROUND))if(fixture.core.integrityMode!=='incremental')profiler.profileDb(fixture.core.db);await profiler.observePostgres(status.DB_URL);
 running=await startPointServer({core:fixture.core,auth:fixture.auth,port:3107,sessionPort:3108,telemetry:profiler});
 if(round2){
  const out=openSync(resolve(dir,'gateway.log'),'w'),err=openSync(resolve(dir,'gateway.erro.log'),'w');
  web=spawn(process.execPath,[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:resolve(root,'01_WEB'),windowsHide:true,env:{...process.env,METALLO_4C_TELEMETRY:'1',METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',METALLO_COLABORADOR_LAB_URL:status.API_URL,METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_LOAD_TEST_CORE_PORT:'3107'},stdio:['ignore',out,err]});closeSync(out);closeSync(err);
  let ready=false;for(let n=0;n<40;n++){try{await webRequest(fixture.users[0],'/api/ponto-online/clock');ready=true;break;}catch{}await wait(250);}assert.ok(ready);clientRows.length=0;
  const old=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;
  report.original_sha256=createHash('sha256').update(JSON.stringify(old)).digest('hex');
  report.marking_50=await Promise.all(fixture.users.map(async u=>{const start=performance.now(),key=randomUUID(),intent=await webRequest(u,'/api/ponto-online/begin',{idempotency_key:key});
   const result=await webRequest(u,'/api/ponto-online/events',{idempotency_key:key,location:{status:'DENIED'}});assert.equal(result.event.marking_at,intent.marking_at);
   return {user:u.index,key,event_id:result.event.event_id,latency_ms:performance.now()-start};}));
  const after=(await fixture.core.db.query('select * from lab_time_event order by event_id')).rows;
  assert.equal(after.length,1150);assert.equal(new Set(after.map(e=>e.idempotency_key)).size,1150);
  assert.equal(createHash('sha256').update(JSON.stringify(after.filter(e=>old.some(o=>o.event_id===e.event_id)))).digest('hex'),report.original_sha256);
  for(const u of fixture.users){u.owned=after.filter(e=>e.auth_user_id===u.person.authUserId).map(e=>e.event_id);assert.ok(u.owned.includes(report.marking_50.find(m=>m.user===u.index).event_id));}
  const begun=new Date().toISOString();report.home_50=await Promise.all(fixture.users.map(homeFlow));report.home_50_started_at=begun;report.home_50_finished_at=new Date().toISOString();
  report.client_rows_burst=clientRows.splice(0);
 }
 report.before=profiler.retention();const start=performance.now();report.identities=50;report.no_team=5;report.concurrent_users=10;report.data_events=1100;
 while(performance.now()-start<180000){
  for(let offset=0;offset<50;offset+=10)await Promise.all(fixture.users.slice(offset,offset+10).map(async u=>{
   if(round2){await homeFlow(u);report.operations++;report.requests+=6;return;}
   const reads=[fetch('http://127.0.0.1:3107/lab-point/v4b/list',{method:'POST',headers:{Authorization:'Bearer '+u.token,Origin:'http://127.0.0.1:3101','Content-Type':'application/json'},body:JSON.stringify({period:'60d',offset:0})}),
    ...[['my_employee_profile',{}],['my_personal_items_3g',{}],['my_epi_delivery_groups_3d',{}],['my_communications_3h',{p_unread_only:true,p_limit:20,p_offset:0}]].map(([name,body])=>fetch(status.API_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+u.token,'Content-Type':'application/json'},body:JSON.stringify(body)}))];
   const responses=await Promise.all(reads);assert.ok(responses.every(r=>r.status===200));const data=await Promise.all(responses.map(r=>r.json()));
   const own=(await fixture.core.db.query('select event_id from lab_time_event where auth_user_id=$1',[u.person.authUserId])).rows.map(e=>e.event_id);
   assert.ok(data[0].events.every(e=>own.includes(e.event_id)));assert.equal(data[1][0].employee_id,u.person.employeeId);if(u.noTeam)assert.equal(data[1][0].team_name,null);
   assert.ok(data.slice(2).every(Array.isArray));report.operations++;report.requests+=5;
  }));
  report.samples.push({elapsed_ms:performance.now()-start,...profiler.retention()});await wait(1000);
 }
 report.duration_ms=performance.now()-start;report.after_load=profiler.retention();await wait(30000);report.after_cooldown=profiler.retention();
 assert.equal(report.after_cooldown.active_requests,0);assert.equal(report.after_cooldown.retained_spans,0);
 report.ready=(await fixture.core.inspect()).ready_for_new_events;assert.equal(report.ready,true);
 report.events_after=(await fixture.core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n;assert.equal(report.events_after,round2?1150:1100);
 if(round2){report.continuous_client_rows=clientRows;report.home_dependencies='Profile first; three pending RPCs + clock in parallel; today list only after clock + 250ms tick. No unused recent-history GET in Home.';report.duplicates=0;report.lost=0;report.cross_user=0;}
 report.passed=true;
}catch(e){report.error=e.code??e.message;console.error(report.error);}
finally{
 if(running)await running.shutdown();else if(fixture?.core)await fixture.core.close();web?.kill();await profiler.close();
 writeFileSync(resolve(dir,'resultado.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,duration_ms:report.duration_ms,requests:report.requests,operations:report.operations,error:report.error??null}));process.exitCode=report.passed?0:1;
}
