// Provas exclusivas do 2B; contas fictícias e endpoints exclusivamente em loopback.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from './nucleo.mjs';
import { LabError, createLabAuth } from './auth-local.mjs';
import { startLabServer } from './http-lab.mjs';
import { createPreviewAccounts, createPreviewAdminSession, revokePreviewAccount } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';

const root=resolve(import.meta.dirname,'../..');
let creds=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8'}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
let base='http://127.0.0.1:3103';const origin='http://127.0.0.1:3101';
const report={at:new Date().toISOString(),scope:'Marco 2B real local; separado dos 683 checks históricos',checks:[],passed:false};
function check(category,name,condition,detail=''){report.checks.push({category,name,ok:Boolean(condition),detail});if(!condition)throw Error(`${category} ${name}: ${detail}`);}
async function login(account){const r=await fetch(status.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});return {status:r.status,data:await r.json()};}
async function api(path,token,{method='GET',body,headers={}}={}){const r=await fetch(base+path,{method,headers:{Origin:origin,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data};}
const newBody=()=>({contract_version:1,idempotency_key:randomUUID()});
async function deny(promise,code){try{await promise;return false;}catch(e){return e?.code===code||String(e?.message??'').includes(code);}}
let isolated,previewCore,previewService,transientAdminToken;
try{
 if(process.env.METALLO_EVIDENCE_REVISION==='2e'){
  // A conta de revogação do ensaio histórico já foi consumida. Repetir em
  // serviço descartável e contas novas preserva as 64 asserções originais.
  const prepared=await createPreviewAccounts();creds=prepared.accounts;transientAdminToken=prepared.adminAccessToken;
  previewCore=await createLabCore();
  for(const kind of ['joao','maria','expira']){
   const p=creds[kind];await previewCore.seedSynthetic({authUserId:p.id,employeeId:p.employeeId,workerRef:`LAB-${kind.toUpperCase()}`,employmentRef:`LAB-VINCULO-${kind.toUpperCase()}`});
  }
  previewService=await startLabServer({core:previewCore,auth:createLabAuth(status.ANON_KEY),port:0,logger:()=>{}});
  base=`http://127.0.0.1:${previewService.port}`;
  report.scope='Regressão 2B em núcleo descartável e contas sintéticas novas; não somar ao 2E';
 }
 const joao=await login(creds.joao),maria=await login(creds.maria),expira=await login(creds.expira);
 check('A','João autentica no Auth local',joao.status===200&&!!joao.data.access_token);
 check('A','Maria autentica no Auth local',maria.status===200&&!!maria.data.access_token);
 check('A','Conta de revogação autentica inicialmente',expira.status===200&&!!expira.data.access_token);
 const j=joao.data.access_token,m=maria.data.access_token,x=expira.data.access_token;
 const anon=await api('/lab-point/v1/events',status.ANON_KEY);
 check('A','chave anon não autentica pessoa',anon.status===401);
 const tampered=j.slice(0,-2)+'xx';
 check('A','JWT adulterado negado',(await api('/lab-point/v1/events',tampered)).status===401);
 check('A','Origin externo negado',(await api('/lab-point/v1/events',j,{headers:{Origin:'http://192.168.0.3:3101'}})).status===403);
 const {adminSession}=transientAdminToken?{adminSession:{access_token:transientAdminToken}}:await createPreviewAdminSession();
 check('A','admin Gestão não acessa histórico pessoal',(await api('/lab-point/v1/events',adminSession.access_token)).status===403);
 check('A','admin Gestão não marca por trabalhador',(await api('/lab-point/v1/events',adminSession.access_token,{method:'POST',body:newBody()})).status===403);
 const start=Date.now();const bodyJ=newBody(),bodyM=newBody();
 const first=await api('/lab-point/v1/events',j,{method:'POST',body:bodyJ});
 const second=await api('/lab-point/v1/events',m,{method:'POST',body:bodyM});
 check('B','João registra evento próprio',first.status===201&&first.data.status==='REGISTRADO_NO_LABORATORIO');
 check('B','Maria registra evento próprio',second.status===201&&second.data.status==='REGISTRADO_NO_LABORATORIO');
 check('B','eventos diferentes',first.data.event.event_id!==second.data.event.event_id);
 check('G','timestamp deriva do servidor',Math.abs(Date.parse(first.data.event.server_received_at_utc)-start)<15000);
 check('G','timestamp UTC',first.data.event.server_received_at_utc.endsWith('Z'));
 const listJ=await api('/lab-point/v1/events',j),listM=await api('/lab-point/v1/events',m);
 check('A','João vê seu evento',listJ.status===200&&listJ.data.events.some(e=>e.event_id===first.data.event.event_id));
 check('A','Maria vê seu evento',listM.status===200&&listM.data.events.some(e=>e.event_id===second.data.event.event_id));
 check('A','João não vê Maria',!listJ.data.events.some(e=>e.event_id===second.data.event.event_id));
 check('A','Maria não vê João',!listM.data.events.some(e=>e.event_id===first.data.event.event_id));
 check('A','João não consulta intenção de Maria',(await api(`/lab-point/v1/intent/${bodyM.idempotency_key}`,j)).status===404);
 check('A','Maria não consulta intenção de João',(await api(`/lab-point/v1/intent/${bodyJ.idempotency_key}`,m)).status===404);
 for(const field of ['employee_id','worker_id','server_received_at_utc','client_time']){
  check('A',`campo cliente ${field} rejeitado`,(await api('/lab-point/v1/events',j,{method:'POST',body:{...newBody(),[field]:'maria'}})).status===400);
 }
 check('A','querystring não escolhe titular',(await api('/lab-point/v1/events?employee_id='+creds.maria.employeeId,j,{method:'POST',body:newBody()})).status===404);
 check('A','URL com ID de Maria rejeitada',(await api('/lab-point/v1/events/'+creds.maria.employeeId,j,{method:'POST',body:newBody()})).status===404);
 const replay=await api('/lab-point/v1/events',j,{method:'POST',body:bodyJ});
 check('C','mesma chave retorna duplicado',replay.status===200&&replay.data.status==='DUPLICADO');
 check('C','duplicado devolve mesmo evento',replay.data.event.event_id===first.data.event.event_id);
 check('C','chave de João não transfere para Maria',(await api('/lab-point/v1/events',m,{method:'POST',body:bodyJ})).status===409);
 check('C','mesma chave e versão alterada conflita',(await api('/lab-point/v1/events',j,{method:'POST',body:{...bodyJ,contract_version:2}})).status===409);
 const beforeCount=listJ.data.events.length;
 const parallelBody=newBody();
 const parallel=await Promise.all(Array.from({length:5},()=>api('/lab-point/v1/events',j,{method:'POST',body:parallelBody})));
 check('D','cinco requests concorrentes têm um create',parallel.filter(r=>r.status===201).length===1);
 check('D','cinco requests retornam o mesmo evento',new Set(parallel.map(r=>r.data.event?.event_id)).size===1);
 const different=await Promise.all([api('/lab-point/v1/events',j,{method:'POST',body:newBody()}),api('/lab-point/v1/events',j,{method:'POST',body:newBody()})]);
 check('D','chaves distintas concorrentes geram eventos distintos',different.every(r=>r.status===201)&&different[0].data.event.event_id!==different[1].data.event.event_id);
 const after=await api('/lab-point/v1/events',j);
 check('D','cinco requests criaram só uma linha',after.data.events.length===beforeCount+3);
 const lostBody=newBody();const lost=await api('/lab-point/v1/events',j,{method:'POST',body:lostBody});
 const recovered=await api('/lab-point/v1/events',j,{method:'POST',body:lostBody});
 check('D','resposta perdida após commit é recuperável',lost.status===201&&recovered.status===200&&lost.data.event.event_id===recovered.data.event.event_id);
 check('D','consulta da intenção retorna original',(await api(`/lab-point/v1/intent/${lostBody.idempotency_key}`,j)).data.event.event_id===lost.data.event.event_id);
 for(const clientTime of ['+2h','-2h','dia-errado','fuso-diferente']){
  check('G',`horário cliente ${clientTime} rejeitado`,(await api('/lab-point/v1/events',j,{method:'POST',body:{...newBody(),client_observed_at:clientTime}})).status===400);
 }
 check('I','rota inexistente não faz fallback',(await api('/rest/v1/rpc/run_site_operation',j,{method:'POST',body:newBody()})).status===404);

 isolated=await createLabCore();
 const user=randomUUID(),employee=randomUUID();
 await isolated.seedSynthetic({authUserId:user,employeeId:employee,workerRef:'LAB-ISOLADO',employmentRef:'LAB-VINCULO-ISOLADO'});
 const b=newBody();
 for(const failpoint of ['before_insert','after_insert','before_commit']){
  check('D',`falha ${failpoint} gera rollback`,await deny(isolated.record(user,b,{employeeId:employee,failpoint}),`Falha sintética ${failpoint==='before_insert'?'antes do insert':failpoint==='after_insert'?'após insert':'antes do commit'}`));
  const q=await isolated.db.query('select count(*)::int as n from lab_time_event');
  check('D',`falha ${failpoint} não deixa evento parcial`,q.rows[0].n===0);
 }
 check('E','revogação percebida após insert bloqueia commit',await deny(isolated.record(user,b,{employeeId:employee,authorizeCurrent:async()=>{throw new LabError(403,'CONTEXTO_INATIVO');}}),'CONTEXTO_INATIVO'));
 check('E','revogação entre insert e commit não deixa original',(await isolated.db.query('select count(*)::int as n from lab_time_event')).rows[0].n===0);
 const committed=await isolated.record(user,b,{employeeId:employee});
 check('C','core devolve evento confirmado',!!committed.event.event_id);
 const original=(await isolated.db.query('select * from lab_time_event where event_id=$1',[committed.event.event_id])).rows[0];
 const canonical=JSON.stringify([original.event_id,original.auth_user_id,original.idempotency_key,original.contract_version,original.worker_snapshot_ref,original.employment_snapshot_ref,original.employer_snapshot_ref,original.establishment_snapshot_ref,original.context_version,new Date(original.server_received_at_utc).toISOString(),new Date(original.server_committed_at_utc).toISOString(),original.collector_version,original.channel]);
 check('J','hash SHA-256 canônico confere',createHash('sha256').update(canonical).digest('hex')===original.payload_hash);
 check('F','UPDATE original negado',await deny(isolated.db.query('update lab_time_event set server_received_at_utc=clock_timestamp()'),'Original sintético imutável'));
 check('F','DELETE original negado',await deny(isolated.db.query('delete from lab_time_event'),'Original sintético imutável'));
 check('F','original preservado após negativas',(await isolated.db.query('select count(*)::int as n from lab_time_event')).rows[0].n===1);
 await isolated.db.query("update lab_context set context_status='revoked',active=false,context_version=context_version+1 where auth_user_id=$1",[user]);
 check('E','contexto revogado impede nova marcação',await deny(isolated.record(user,newBody(),{employeeId:employee}),'CONTEXTO_INATIVO'));
 check('E','contexto revogado impede histórico',await deny(isolated.history(user,employee),'CONTEXTO_INATIVO'));
 await isolated.db.query("update lab_context set context_status='active',active=true,valid_until=clock_timestamp()-interval '1 second' where auth_user_id=$1",[user]);
 check('E','snapshot stale falha fechado',await deny(isolated.record(user,newBody(),{employeeId:employee}),'CONTEXTO_INDISPONIVEL_PARA_SIMULACAO'));
 await isolated.db.query("update lab_context set valid_until=clock_timestamp()+interval '1 hour',context_status='ambiguous' where auth_user_id=$1",[user]);
 check('E','snapshot ambíguo falha fechado',await deny(isolated.record(user,newBody(),{employeeId:employee}),'CONTEXTO_INATIVO'));
 check('A','employee ID divergente não passa',await deny(isolated.record(user,newBody(),{employeeId:randomUUID()}),'CONTEXTO_INATIVO'));
 const xBefore=await api('/lab-point/v1/events',x,{method:'POST',body:newBody()});
 check('E','conta de ensaio ativa antes da revogação',xBefore.status===201);
 const revoke=await revokePreviewAccount(creds.expira.identityId,adminSession.access_token);
 check('E','revogação local concluída',revoke!==undefined);
 check('E','token antigo não grava após revogação',(await api('/lab-point/v1/events',x,{method:'POST',body:newBody()})).status>=400);
 check('E','token antigo não lê histórico',(await api('/lab-point/v1/events',x)).status>=400);
 const refresh=await fetch(status.API_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:expira.data.refresh_token})});
 check('E','refresh revogado negado',refresh.status>=400);
 check('E','novo login revogado negado',(await login(creds.expira)).status>=400);
 report.passed=report.checks.every(c=>c.ok);
}catch(error){report.error=String(error?.message??error);process.exitCode=1;console.error(report.error);}finally{
 if(isolated)await isolated.close();
 if(previewService)await previewService.shutdown();else if(previewCore)await previewCore.close();
 report.count=report.checks.length;
 const target=new URL(process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/resultado-2b-regressao.json':process.env.METALLO_EVIDENCE_REVISION==='2d'?'../laboratorio-marco-2d/resultado-2b.json':'./resultado-2b.json',import.meta.url);
 if(process.env.METALLO_EVIDENCE_REVISION==='2e')try{const prior=JSON.parse(readFileSync(target,'utf8'));report.previous_runs=[...(prior.previous_runs??[]),{at:prior.at,passed:prior.passed,count:prior.count,error:prior.error??null,checks:prior.checks}];}catch{}
 writeFileSync(target,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,count:report.count,categories:[...new Set(report.checks.map(c=>c.category))],error:report.error??null}));
}
