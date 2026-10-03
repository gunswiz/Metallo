// Reproduz o ciclo 1 em núcleo descartável e comprova a correção sem alterar 2F.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPreviewAccounts,sql,quote } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { startLabServer } from '../laboratorio-marco-2b/http-lab.mjs';
import { startSessionServer } from './sessao-http.mjs';
import { installExtension,createPointExtension } from './extensao.mjs';
import { root,status,local } from './ambiente.mjs';

const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; antes/depois em instância descartável',checks:[],passed:false};
const test=async(name,run)=>{await run();report.checks.push({name,ok:true});console.log('PASS '+name);};
const dir=resolve(root,'backups/marco-4a-auditoria/core-'+randomUUID()),authPath=dir+'.authorization.json';
let core,service;
async function login(account){const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:account.email,password:account.password});assert.equal(r.status,200);return (await r.json()).access_token;}
async function http(token,path,data,method=data===undefined?'GET':'POST'){
 const r=await fetch(`http://127.0.0.1:${service.port}/lab-point/v1${path}`,{method,headers:{Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 const {accounts,admin,adminAccessToken}=await createPreviewAccounts();
 const auth=createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY}),source=createLocalSource(status.SERVICE_ROLE_KEY);
 const token=await login(accounts.joao),otherToken=await login(accounts.joao),person=await auth.verifyPersonal(token);
 core=await createLabCore(dir,{mode:'create'});
 await core.seedSynthetic({authUserId:person.authUserId,employeeId:person.employeeId,workerRef:'LAB-AUDIT-4A',employmentRef:'LAB-VINCULO-AUDIT-4A',validMinutes:60});
 const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;
 await core.close();initializeAuthorization(authPath,databaseId);
 core=await createLabCore(dir,{authorizationPath:authPath});await core.registerAuthorization(person.authUserId,person.employeeId);await core.close();
 core=await createLabCore(dir,{authorizationPath:authPath,source});await installExtension(core);
 service=await startLabServer({core,auth,port:0,logger:()=>{}});
 const shadowKey=randomUUID();
 await test('F-4A-01 ANTES: rota v1 grava original sem intenção/contexto/recibo 4A',async()=>{
  const result=await http(token,'/events',{contract_version:1,idempotency_key:shadowKey});assert.equal(result.status,201);
  const count=(await core.db.query('select count(*)::integer as n from lab_time_event where idempotency_key=$1',[shadowKey])).rows[0].n;
  assert.equal(count,1);assert.equal((await core.db.query('select count(*)::integer as n from lab4a.intent')).rows[0].n,0);
  assert.equal((await createPointExtension(core).management()).length,0);
  report.before={legacy_http_status:201,core_events:1,intents:0,receipts:0,management_events:0};
 });
 await service.shutdown();service=null;core=null;
 core=await createLabCore(dir,{authorizationPath:authPath,source});service=await startSessionServer({core,auth,port:0,logger:()=>{}});
 await test('F-4A-01 DEPOIS: gravação v1 negada sem aumentar originais',async()=>{
  const result=await http(token,'/events',{contract_version:1,idempotency_key:randomUUID()});assert.equal(result.status,404);
  assert.equal((await core.db.query('select count(*)::integer as n from lab_time_event')).rows[0].n,1);
  report.after={legacy_http_status:404,core_events:1,added_events:0};
 });
 await test('F-4A-01: histórico e consulta v1 também fechados na instância 4A',async()=>{
  assert.equal((await http(token,'/events')).status,404);assert.equal((await http(token,'/intent/'+shadowKey)).status,404);
 });
 await test('F-4A-01: fluxo extensão 4A permanece funcional',async()=>{
  const point=createPointExtension(core),key=randomUUID();await point.begin(person,{idempotency_key:key});
  const result=await point.finish(person,{idempotency_key:key,location:{status:'DENIED'}},()=>auth.verifyPersonal(token));
  assert.equal(result.event.location_status,'DENIED');assert.equal((await point.management()).length,1);
 });
 await test('Logout atual 2F preservado: encerra uma sessão e mantém outra',async()=>{
  assert.equal((await http(token,'/session/current',{})).status,200);await assert.rejects(auth.verifyPersonal(token));assert.ok(await auth.verifyPersonal(otherToken));
 });
 await test('Logout global 2F preservado: encerra sessões restantes',async()=>{
  const third=await login(accounts.joao);assert.equal((await http(otherToken,'/session/global',{})).status,200);
  await assert.rejects(auth.verifyPersonal(otherToken));await assert.rejects(auth.verifyPersonal(third));
 });
 const catalog=JSON.parse(readFileSync(new URL('./catalogo-autorizacao-local.json',import.meta.url),'utf8'));
 await test('F-4A-02: catálogo real não contém status em employee_portal_accounts',async()=>{
  const account=catalog.tables.find(t=>t.table==='employee_portal_accounts');assert.ok(account);assert.ok(!account.columns.some(c=>c.name==='status'));
  report.portal_account_columns=account.columns.map(c=>c.name);
 });
 await test('F-4A-04: definição, search_path e ACL de is_active_admin já constam do catálogo',async()=>{
  const fn=catalog.functions.find(f=>f.signature==='is_active_admin()');assert.ok(fn);assert.match(fn.definition,/p\.active = true and p\.role = 'admin'/);assert.ok(fn.acl);
  report.catalog_sha256=createHash('sha256').update(readFileSync(new URL('./catalogo-autorizacao-local.json',import.meta.url))).digest('hex');
 });
 async function management(){const r=await fetch('http://127.0.0.1:3106/lab-point/v4a/management',{headers:{Origin:'http://127.0.0.1:3102',Authorization:`Bearer ${adminAccessToken}`}});return r.status;}
 await test('F-4A-04: administrador global ativo pode consultar Gestão',async()=>assert.equal(await management(),200));
 await test('F-4A-04: administrador inativo não consulta Gestão',async()=>{
  sql(`update public.profiles set active=false where id=${quote(admin.id)}::uuid`);
  try{assert.equal(await management(),403);}finally{sql(`update public.profiles set active=true where id=${quote(admin.id)}::uuid`);}
 });
 await test('F-4A-04: JWT residual do admin sem sessão ativa não consulta Gestão',async()=>{
  const r=await local('/auth/v1/logout?scope=local',adminAccessToken,{});assert.ok(r.ok);assert.equal(await management(),403);
 });
 await test('F-4A-03: ordem de chaves diferente produz mesmo jsonb no driver atual',async()=>{
  const a={status:'DENIED',latitude:null,longitude:null,accuracy_meters:null,captured_at:null,provider:'BROWSER_GEOLOCATION',mock_signal:'NOT_EXPOSED'};
  const b=Object.fromEntries(Object.entries(a).reverse());assert.notEqual(JSON.stringify(a),JSON.stringify(b));
  const ra=(await core.db.query('select $1::jsonb as location',[a])).rows[0].location;
  const rb=(await core.db.query('select $1::jsonb as location',[b])).rows[0].location;
  assert.equal(JSON.stringify(ra),JSON.stringify(rb));await createPointExtension(core).verify();
  report.hash_driver_limit='Driver PGlite atual comprovado; portabilidade para outro driver e tipos permanece risco futuro';
 });
 await test('F-4A-10: employee_id de origem é uuid e valor malformado é rejeitado pelo banco',async()=>{
  assert.equal((await core.db.query("select format_type(atttypid,atttypmod) as type from pg_attribute where attrelid='lab4a.intent'::regclass and attname='employee_id'")).rows[0].type,'uuid');
  await assert.rejects(core.db.query("select 'malformed-filter'::uuid"));
 });
 report.passed=true;
}catch(error){report.error=error.code??error.message;process.exitCode=1;console.error(report.error);}
finally{
 if(service){await service.shutdown();core=null;}if(core)await core.close();
 writeFileSync(new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/resultado-auditoria-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c'?'../laboratorio-marco-4c/regressoes/resultado-auditoria-4a.json':'./resultado-auditoria-4a.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error??null}));
}
