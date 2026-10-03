import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createCurrentResources } from '../laboratorio-marco-4c/abrir-laboratorio.mjs';
import { startSessionServer } from './sessao-http.mjs';
import { createPointExtension,installExtension } from './extensao.mjs';
import { createPersonalRecords } from '../laboratorio-marco-4b/registros.mjs';
import { withHttpScheduling } from '../laboratorio-marco-4b/agendamento-http.mjs';
import { root,status,local } from './ambiente.mjs';

async function openPreview() {
const dir=resolve(root,'backups/metallo-ponto-lab-pglite-4a'),authorizationPath=dir+'.authorization.json';
const resources=createCurrentResources({anonKey:status.ANON_KEY,serviceKey:status.SERVICE_ROLE_KEY}),{auth}=resources;
const people=[];
const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-3h.json'),'utf8'));
for(const kind of ['joao','maria','semEquipe']){
 const user=saved[kind];const response=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:user.email,password:user.password});
 assert.equal(response.status,200);const login=await response.json();people.push({...await auth.verifyPersonal(login.access_token),kind});
}
if(!existsSync(dir)){
 let initial=await createLabCore(dir,{mode:'create'});let databaseId;
 try{for(const p of people)await initial.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:`LAB-4A-${p.authUserId.toUpperCase()}`,employmentRef:`LAB-VINCULO-4A-${p.authUserId.toUpperCase()}`,validMinutes:1440});databaseId=(await initial.db.query('select database_id from lab_recovery_state')).rows[0].database_id;}finally{await initial.close();}
 initializeAuthorization(authorizationPath,databaseId);
 initial=await createLabCore(dir,{authorizationPath});try{for(const p of people)await initial.registerAuthorization(p.authUserId,p.employeeId);}finally{await initial.close();}
}
const core=await resources.openCore(dir,{authorizationPath});
for(const p of people)await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:`LAB-4A-${p.authUserId.toUpperCase()}`,employmentRef:`LAB-VINCULO-4A-${p.authUserId.toUpperCase()}`,validMinutes:1440});
console.log(JSON.stringify({lab:true,current_architecture:'4C_INCREMENTAL_V2',integrity_mode:core.integrityMode,transport:resources.transport.inspect(),selection:'NORMAL_PREVIEW_NO_ROUND_FLAG'}));
return {core,auth};
}
// O ensaio de carga reutiliza exatamente os handlers e portas da prévia,
// com núcleo descartável. Não há endpoint de teste ou bypass de autorização.
export async function startPointServer({core,auth,port=3106,sessionPort=3105,telemetry,testHook}) {
assert.ok((port===3106&&sessionPort===3105)||(port===3107&&sessionPort===3108),'Somente pares locais de prévia/carga');
core=withHttpScheduling(core,{telemetry});
await installExtension(core);const point=createPointExtension(core,{telemetry,testHook});
const records=createPersonalRecords(core,point);
const legacy=await startSessionServer({core,auth,port:sessionPort});
let accepting=true;
function respond(res,status,body){const value=telemetry?.synchronous?telemetry.synchronous('serialization.json',()=>JSON.stringify(body)):JSON.stringify(body);telemetry?.response(body);res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(value);}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>2048)throw new LabError(413,'PEDIDO_INVALIDO');}try{return JSON.parse(text);}catch{throw new LabError(400,'PEDIDO_INVALIDO');}}
const handle=async(req,res)=>{
 try{
  if(!accepting)throw new LabError(503,'LABORATORIO_INDISPONIVEL');
  if(req.headers.host!==`127.0.0.1:${port}`||req.url.includes('?'))throw new LabError(400,'PEDIDO_INVALIDO');
  if(req.url==='/health'&&req.method==='GET'){const h=await legacy.health();await point.verify();return respond(res,h.ready_for_new_events?200:503,{...h,integrity_mode:core.integrityMode,architecture:core.integrityMode==='incremental'?'4C_INCREMENTAL_V2':'HISTORICAL_FULL_V1'});}
  const management=req.url==='/lab-point/v4a/management';
  if(req.headers.origin!==(management?'http://127.0.0.1:3102':'http://127.0.0.1:3101'))throw new LabError(403,'ORIGEM_INVALIDA');
  const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)throw new LabError(401,'SESSAO_INVALIDA');
  if(management){
   if(req.method!=='GET')throw new LabError(405,'PEDIDO_INVALIDO');
   const signed=await auth.verifySigned(token),user=await local('/auth/v1/user',token),allowed=await local('/rest/v1/rpc/is_active_admin',token,{});
   const active=await local('/rest/v1/rpc/lab_active_session_2e',status.SERVICE_ROLE_KEY,{p_session_id:signed.sessionId,p_auth_user_id:signed.authUserId},status.SERVICE_ROLE_KEY);
   if(!user.ok||!allowed.ok||await allowed.json()!==true||!active.ok||await active.json()!==true)throw new LabError(403,'ACESSO_NAO_AUTORIZADO');
   const events=await point.management();
   const ids=[...new Set(events.map(event=>event.employee_id))];
   const byId=new Map();
   if(ids.length){
    const names=await local(`/rest/v1/epi_employees?select=id,full_name&id=in.(${ids.join(',')})`,status.SERVICE_ROLE_KEY,undefined,status.SERVICE_ROLE_KEY);
    if(!names.ok)throw new LabError(503,'LABORATORIO_INDISPONIVEL');
    for(const p of await names.json())byId.set(p.id,p.full_name);
   }
   return respond(res,200,{events:events.map(({employee_id,...event})=>({...event,employee_name:byId.get(employee_id)??'Nome não disponível'}))});
  }
  const readAuth=req.url.startsWith('/lab-point/v4b/')||req.url==='/lab-point/v4a/clock'?auth.read??auth:auth;
  const person=await readAuth.verifyPersonal(token);
  telemetry?.person(person);
  if(req.url.startsWith('/lab-point/v4b/')){
   if((req.headers['content-length']??'0')!=='0'&&req.method==='GET')throw new LabError(400,'PEDIDO_INVALIDO');
   let result;
   if(req.method==='POST'&&req.url==='/lab-point/v4b/list'){
    if(req.headers['content-type']!=='application/json')throw new LabError(415,'PEDIDO_INVALIDO');
    result=await records.list(person,await body(req));
   }else if(req.method==='GET'&&req.url==='/lab-point/v4b/authorize'){result={authorized:true};}
   else if(req.method==='GET'&&req.url==='/lab-point/v4b/last48')result=await records.last48(person);
   else {const id=req.url.match(/^\/lab-point\/v4b\/receipt\/([a-f0-9-]{36})$/i);if(req.method!=='GET'||!id)throw new LabError(404,'ROTA_NAO_ENCONTRADA');result=await records.receipt(person,id[1]);}
   const current=await readAuth.verifyPersonal(token);
   if(current.authUserId!==person.authUserId||current.employeeId!==person.employeeId||current.sessionId!==person.sessionId)throw new LabError(403,'CONTEXTO_INATIVO');
   await records.authorize(current);return respond(res,200,result);
  }
  if(req.method==='GET'&&req.url==='/lab-point/v4a/clock')return respond(res,200,await point.clock(person));
  if(req.method==='GET'&&req.url==='/lab-point/v4a/events')return respond(res,200,{events:await point.history(person)});
  const match=req.url.match(/^\/lab-point\/v4a\/intent\/([a-f0-9-]{36})$/i);
  if(req.method==='GET'&&match){const event=await point.outcome(person,match[1]);return respond(res,event?200:404,event?{event}:{status:'NAO_CONFIRMADO'});}
  if(req.method==='POST'&&['/lab-point/v4a/begin','/lab-point/v4a/events'].includes(req.url)){
   if(req.headers['content-type']!=='application/json')throw new LabError(415,'PEDIDO_INVALIDO');const input=await body(req);
   if(req.url.endsWith('/begin'))return respond(res,200,await point.begin(person,input));
   const result=await point.finish(person,input,async()=>{const current=await auth.verifyPersonal(token);if(current.authUserId!==person.authUserId||current.employeeId!==person.employeeId||current.sessionId!==person.sessionId)throw new LabError(403,'CONTEXTO_INATIVO');});
   return respond(res,result.duplicate?200:201,result);
  }
  throw new LabError(404,'ROTA_NAO_ENCONTRADA');
 }catch(error){telemetry?.failure?.(error);respond(res,error instanceof LabError?error.status:503,{error:error instanceof LabError?error.code:'LABORATORIO_INDISPONIVEL'});}
};
const server=createServer((req,res)=>telemetry?telemetry.request(req,res,()=>handle(req,res)):handle(req,res));
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
console.log(JSON.stringify({lab:true,marco:'4A',url:`http://127.0.0.1:${port}/health`,scope:'SIMULAÇÃO SEM VALOR OFICIAL'}));
let stopping=false;async function stop(){if(stopping)return;stopping=true;accepting=false;await new Promise(ok=>{server.close(ok);server.closeIdleConnections();});await legacy.shutdown();}
return {server,legacy,shutdown:stop};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const running=await startPointServer(await openPreview());
 for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>void running.shutdown().then(()=>process.exit(0)));
}
