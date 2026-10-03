// Prova pela prévia normal 3101/3106 com Auth local real e cinco eventos sintéticos.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {status,local,root} from '../laboratorio-marco-4a/ambiente.mjs';
import {createLabAuth} from '../laboratorio-marco-2b/auth-local.mjs';

const evidence=resolve(import.meta.dirname,'adocao-controlada/correcao-bootstrap');
const planPath=resolve(evidence,'plano-cinco-marcas.json'),reportPath=resolve(evidence,'prova-http-cinco-marcas.json');
const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-3h.json'),'utf8'));
const auth=createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
const sha=v=>createHash('sha256').update(v).digest('hex');
const plan=existsSync(planPath)?JSON.parse(readFileSync(planPath,'utf8')):{at:new Date().toISOString(),scope:'cinco intenções sintéticas fixas; sem credenciais',
 keys:{joao:Array.from({length:3},()=>randomUUID()),maria:Array.from({length:2},()=>randomUUID())}};
if(!existsSync(planPath))writeFileSync(planPath,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
assert.equal(existsSync(reportPath),false,'PROVA_HTTP_JA_EXISTE');

async function login(kind){
 const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:saved[kind].email,password:saved[kind].password});
 assert.equal(r.status,200,`LOGIN_${kind}`);const json=await r.json();
 const person=await auth.verifyPersonal(json.access_token);return {token:json.access_token,person};
}
async function call(u,path,body){
 const r=await fetch('http://127.0.0.1:3101'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+u.token,
  ...(body===undefined?{}:{Origin:'http://127.0.0.1:3101','Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 const contentType=r.headers.get('content-type')??'',value=contentType.includes('json')?await r.json():await r.arrayBuffer();
 return {status:r.status,value};
}
function success(response,codes=[200]){assert.ok(codes.includes(response.status),`HTTP_${response.status}: ${JSON.stringify(response.value)}`);return response.value;}
const people={joao:await login('joao'),maria:await login('maria')};
assert.notEqual(people.joao.person.authUserId,people.maria.person.authUserId);
const web=await fetch('http://127.0.0.1:3101/colaborador/ponto');assert.equal(web.status,200);
const health=await fetch('http://127.0.0.1:3106/health');assert.equal(health.status,200);
const h=await health.json();assert.equal(h.ready_for_new_events,true);assert.equal(h.integrity_mode,'incremental');
assert.equal(h.architecture,'4C_INCREMENTAL_V2');
for(const u of Object.values(people))success(await call(u,'/api/ponto-online/clock'));

const observed=[];for(const [kind,keys] of Object.entries(plan.keys))for(const key of keys){
 const u=people[kind],begin=success(await call(u,'/api/ponto-online/begin',{idempotency_key:key}));
 const payload={idempotency_key:key,location:{status:'DENIED'}};
 const firstResponse=await call(u,'/api/ponto-online/events',payload),first=success(firstResponse,[200,201]);
 const secondResponse=await call(u,'/api/ponto-online/events',payload),second=success(secondResponse,[200,201]);
 assert.equal(first.event.event_id,second.event.event_id);assert.equal(second.duplicate,true);
 assert.equal(begin.marking_at,first.event.marking_at);
 observed.push({kind,key_hash:sha(key),event_id:first.event.event_id,reference:first.event.synthetic_reference,
  first_http_status:firstResponse.status,duplicate_http_status:secondResponse.status,location_status:first.event.location_status});
}
assert.equal(new Set(observed.map(row=>row.event_id)).size,5);
const joaoHistory=success(await call(people.joao,'/api/ponto-online/events')).events;
const mariaHistory=success(await call(people.maria,'/api/ponto-online/events')).events;
for(const row of observed){const owner=row.kind==='joao'?joaoHistory:mariaHistory,other=row.kind==='joao'?mariaHistory:joaoHistory;
 assert.ok(owner.some(item=>item.event_id===row.event_id));assert.ok(!other.some(item=>item.event_id===row.event_id));}
const crossed=await call(people.maria,'/api/ponto-online/intent/'+plan.keys.joao[0]);assert.equal(crossed.status,404);
const list=success(await call(people.joao,'/api/ponto-registros/list',{period:'60d',offset:0}));
assert.ok(Array.isArray(list.events));for(const row of observed.filter(row=>row.kind==='joao'))assert.ok(list.events.some(item=>item.event_id===row.event_id));
const logout=await local('/auth/v1/logout',people.joao.token,{});assert.ok([200,204].includes(logout.status));
const oldToken=await call(people.joao,'/api/ponto-online/clock');assert.ok([401,403].includes(oldToken.status));
people.joao=await login('joao');success(await call(people.joao,'/api/ponto-online/clock'));
const after=await fetch('http://127.0.0.1:3106/health');assert.equal(after.status,200);
const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; Auth/JWT reais somente Supabase local; sem segredo persistido',
 architecture:'4C_INCREMENTAL_V2',normal_preview_no_round_flag:!process.env.METALLO_4C_ROUND,
 web_page_status:web.status,health_before:health.status,health_after:after.status,marks:5,joao:3,maria:2,
 same_intent_same_event:5,new_intentions_distinct:true,personal_histories_isolated:true,cross_intent_denied:crossed.status,
 list_60_days:true,logout_old_token_denied:oldToken.status,new_login_ready:true,
 receipts:observed,remote:false,passed:true};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,architecture:report.architecture,marks:5,joao:3,maria:2,old_token_denied:oldToken.status,remote:false}));
