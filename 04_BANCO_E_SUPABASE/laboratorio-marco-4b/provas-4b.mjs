// Auth/JWT/PostgREST reais locais; núcleo descartável e downloads pela prévia.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPreviewAccounts,sql,quote } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { createPointExtension,installExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { createPersonalRecords } from './registros.mjs';
import { revokePortalAccountLocal } from '../laboratorio-marco-1a/revogar-conta-portal-servidor.mjs';
import { root,status,local,regressionFetch as fetch } from '../laboratorio-marco-4a/ambiente.mjs';
const report={at:new Date().toISOString(),scope:'4B LOCAL — SIMULAÇÃO SEM VALOR OFICIAL',checks:[],passed:false};
const evidence=name=>new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/'+name:process.env.METALLO_EVIDENCE_REVISION==='4c'?'../laboratorio-marco-4c/regressoes/'+name:'./'+name,import.meta.url);
const {unzipSync}=createRequire(resolve(root,'01_WEB/package.json'))('fflate');
const test=async(name,run)=>{await run();report.checks.push({name,ok:true});console.log('PASS '+name);};
const rejected=(run,code)=>assert.rejects(run,e=>e.code===code);
async function login(account){const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:account.email,password:account.password});assert.equal(r.status,200);return (await r.json()).access_token;}
async function http(token,path,body,port=3101,origin='http://127.0.0.1:3101',method=body===undefined?'GET':'POST'){
 const r=await fetch(`http://127.0.0.1:${port}${port===3101?'/api/ponto-registros':'/lab-point/v4b'}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',redirect:'manual'});
 return {status:r.status,headers:r.headers,bytes:Buffer.from(await r.arrayBuffer())};
}
let core;
try{
 await test('Origem 4A imutável confere SHA',async()=>assert.equal(createHash('sha256').update(readFileSync(resolve(root,'outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip'))).digest('hex'),'50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d'));
 const {accounts,adminAccessToken}=await createPreviewAccounts(),auth=createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
 sql(`update public.epi_employees set team_id=null where id=${quote(accounts.expira.employeeId)}::uuid`);
 const jwt={},people={};for(const kind of ['joao','maria','expira']){jwt[kind]=await login(accounts[kind]);people[kind]=await auth.verifyPersonal(jwt[kind]);}
 const dir=resolve(root,'backups/marco-4b-ensaios/core-'+randomUUID()),authorizationPath=dir+'.authorization.json';
 core=await createLabCore(dir,{mode:'create'});for(const [k,p] of Object.entries(people))await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:`LAB-4B-${k.toUpperCase()}`,employmentRef:`LAB-4B-V-${k.toUpperCase()}`,validMinutes:60});
 const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await core.close();initializeAuthorization(authorizationPath,databaseId);
 core=await createLabCore(dir,{authorizationPath});for(const p of Object.values(people))await core.registerAuthorization(p.authUserId,p.employeeId);await core.close();
 core=await createLabCore(dir,{authorizationPath,source:createLocalSource(status.SERVICE_ROLE_KEY)});await installExtension(core);const point=createPointExtension(core),records=createPersonalRecords(core,point);
 async function mark(k){const key=randomUUID(),p=people[k];await point.begin(p,{idempotency_key:key});return (await point.finish(p,{idempotency_key:key,location:{status:'DENIED'}},async()=>auth.verifyPersonal(jwt[k]))).event;}
 const j=await mark('joao'),m=await mark('maria');await mark('expira');
 const snapshot=async()=>createHash('sha256').update(JSON.stringify((await core.db.query('select * from lab_time_event order by event_id')).rows)).digest('hex');
 let before=await snapshot();
 await test('JWT real e identidade pessoal leem só João',async()=>{const list=await records.list(people.joao,{period:'today'});assert.equal(list.events.length,1);assert.equal(list.events[0].event_id,j.event_id);});
 await test('Maria lê só Maria',async()=>assert.equal((await records.list(people.maria,{period:'60d'})).events[0].event_id,m.event_id));
 await test('João → recibo de Maria negado',async()=>rejected(()=>records.receipt(people.joao,m.event_id),'REGISTRO_NAO_ENCONTRADO'));
 await test('Maria → recibo de João negado',async()=>rejected(()=>records.receipt(people.maria,j.event_id),'REGISTRO_NAO_ENCONTRADO'));
 await test('Manipulação de employee_id em corpo negada',async()=>rejected(()=>records.list(people.joao,{period:'today',employee_id:people.maria.employeeId}),'PEDIDO_INVALIDO'));
 for(const id of [people.joao.employeeId,randomUUID(),'../../senha','invalid',"' OR 1=1 --"]){await test('ID direto desconhecido/injetado negado '+(id.includes('-')?'UUID ou SQL':'formato'),async()=>assert.rejects(()=>records.receipt(people.joao,id)));}
 await test('Sem equipe continua lendo próprio histórico',async()=>assert.equal((await records.list(people.expira,{period:'today'})).events.length,1));
 await test('Recibo preserva marking_at e recorded_at originais',async()=>{const r=await records.receipt(people.joao,j.event_id);assert.equal(r.marking_at,j.marking_at);assert.equal(r.recorded_at,j.recorded_at);assert.equal(r.historical_data,'LIMITED');assert.equal(r.timezone,'America/Fortaleza');});
 await test('DTO não expõe GPS, IDs de pessoas, hash nem snapshots mutáveis',async()=>{const r=JSON.stringify(await records.receipt(people.joao,j.event_id));assert.ok(!/latitude|longitude|auth_user|employee_id|payload_hash|full_name|worker_snapshot/.test(r));});
 for(const period of ['today','48h','7d','30d','60d'])await test('Filtro pessoal '+period,async()=>assert.equal((await records.list(people.joao,{period})).events.length,1));
 for(const f of [{period:'custom',from:'2026-02-30',to:'2026-03-01'},{period:'custom',from:'2026-10-02',to:'2026-10-01'},{period:'custom',from:'2020-01-01',to:'2026-01-01'},{period:'today',from:'2026-10-01'},{period:'60d',offset:-1},{period:'60d',offset:1.1},{period:'48h',marking_id:j.event_id}])await test('Filtro inválido/injetado rejeitado '+report.checks.length,async()=>assert.rejects(()=>records.list(people.joao,f)));
 await test('48h só contém recibos de João',async()=>assert.deepEqual((await records.last48(people.joao)).events.map(e=>e.event_id),[j.event_id]));
 await test('Leituras simultâneas, retries e dois pacotes não alteram originais',async()=>{const results=await Promise.all([records.receipt(people.joao,j.event_id),records.receipt(people.joao,j.event_id),records.last48(people.joao),records.last48(people.joao)]);assert.deepEqual(results[0],results[1]);assert.deepEqual(results[2].events,results[3].events);assert.equal(await snapshot(),before);});
 await test('Nome/equipe atual alterados não reconstroem recibo histórico',async()=>{const one=await records.receipt(people.joao,j.event_id);sql(`update public.epi_employees set full_name='Nome alterado sintético',team_id=null where id=${quote(people.joao.employeeId)}::uuid`);assert.deepEqual(await records.receipt(people.joao,j.event_id),one);});
 await test('Funcionário inativo perde acesso no contrato HTTP autenticado',async()=>{sql(`update public.epi_employees set active=false where id=${quote(people.maria.employeeId)}::uuid`);await rejected(()=>auth.verifyPersonal(jwt.maria),'CONTEXTO_INATIVO');assert.equal((await http(jwt.maria,'/receipt/'+m.event_id,undefined,3106)).status,403);assert.equal((await http(jwt.maria,'/last48')).status,403);});
 await test('Revogação durante leitura falha antes de devolver conteúdo',async()=>{const hooked=createPersonalRecords(core,point,{testHook:async()=>core.logoutCurrent(people.expira.authUserId,people.expira.sessionId)});await assert.rejects(()=>hooked.last48(people.expira));});
 await test('Novo retry com sessão encerrada não devolve recibo',async()=>assert.rejects(()=>records.list(people.expira,{period:'today'})));
 // Provas de janelas históricas em fixture SQL NOVA/isolada, sem alterar registro real.
 await test('60 dias e limite móvel de 48h selecionam datas pela marcação no servidor',async()=>{
  const db=new PGlite();await db.waitReady;try{
   await db.exec('create schema lab4a; create table lab_time_event(event_id uuid,auth_user_id uuid,idempotency_key uuid,server_received_at_utc timestamptz,server_committed_at_utc timestamptz); create table lab4a.receipt(event_id uuid,idempotency_key uuid,synthetic_sequence bigint,recorded_at timestamptz); create table lab4a.intent(idempotency_key uuid,auth_user_id uuid,marking_at timestamptz,timezone text);');
   const now=new Date((await db.query('select clock_timestamp() as now')).rows[0].now).getTime();
   for(const hours of [0,47,49,30*24,59*24,61*24])await db.query('insert into lab_time_event values($1,$2,$3,$4,$4)',[randomUUID(),people.joao.authUserId,randomUUID(),new Date(now-hours*3600000).toISOString()]);
   const fixture=createPersonalRecords({history:async()=>{}},{verify:async()=>{},readPersonal:(_p,fn)=>fn(db)});
   assert.equal((await fixture.last48(people.joao)).events.length,2);assert.equal((await fixture.list(people.joao,{period:'60d'})).events.length,5);assert.equal((await fixture.list(people.joao,{period:'custom',from:'2020-01-01',to:'2020-01-02'})).events.length,0);
   await rejected(()=>fixture.last48(people.maria),'SEM_REGISTROS_48H');
   for(let index=0;index<61;index++)await db.query('insert into lab_time_event values($1,$2,$3,$4,$4)',[randomUUID(),people.joao.authUserId,randomUUID(),new Date(now-72*3600000).toISOString()]);
   const collected=[];for(let offset=0;offset<100;offset+=20){const page=await fixture.list(people.joao,{period:'60d',offset});collected.push(...page.events);if(!page.has_more)break;}
   assert.equal(collected.length,66);assert.equal(new Set(collected.map(e=>e.event_id)).size,66);assert.equal((await fixture.last48(people.joao)).events.length,2);
  }finally{await db.close();}
 });
 // HTTP/PDF/ZIP reais na prévia, credenciais sintéticas existentes apenas em memória.
 const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-3h.json'),'utf8'));
 const tokens={};for(const k of ['joao','maria','semEquipe','admin'])tokens[k]=await login(saved[k]);
 let previewJ,previewM;
 await test('Gateway real permite POST pessoal e nega ID administrativo',async()=>{const r=await http(tokens.joao,'/list',{period:'60d'});assert.equal(r.status,200);previewJ=JSON.parse(r.bytes).events;assert.equal((await http(tokens.joao,'/list',{period:'60d',employee_id:randomUUID()})).status,400);});
 await test('Gateway real Maria tem sua própria lista',async()=>{const r=await http(tokens.maria,'/list',{period:'60d'});assert.equal(r.status,200);previewM=JSON.parse(r.bytes).events;assert.ok(previewJ.every(j=>!previewM.some(m=>j.event_id===m.event_id)));});
 await test('Download direto João → Maria/Maria → João negado',async()=>{assert.ok(previewJ.length&&previewM.length,'Prévia deve conter marcações sintéticas 4A');assert.equal((await http(tokens.joao,'/receipt/'+previewM[0].event_id)).status,404);assert.equal((await http(tokens.maria,'/receipt/'+previewJ[0].event_id)).status,404);});
 await test('PDF real autenticado é privado e repetível',async()=>{const [one,two]=await Promise.all([http(tokens.joao,'/receipt/'+previewJ[0].event_id),http(tokens.joao,'/receipt/'+previewJ[0].event_id)]);assert.equal(one.status,200);assert.equal(one.headers.get('content-type'),'application/pdf');assert.match(one.headers.get('cache-control'),/no-store/);assert.deepEqual(one.bytes,two.bytes);writeFileSync(evidence('recibo-4a-sintetico.pdf'),one.bytes);});
 await test('ZIP real 48h só contém eventos pessoais, sem misturar Maria',async()=>{
  const one=await http(tokens.joao,'/last48'),two=await http(tokens.joao,'/last48');assert.equal(one.status,200);assert.equal(one.headers.get('content-type'),'application/zip');assert.deepEqual(one.bytes,two.bytes);
  const files=unzipSync(new Uint8Array(one.bytes)),own=await http(tokens.joao,'/last48',undefined,3106);assert.equal(own.status,200);
  const expected=JSON.parse(own.bytes).events.map(e=>`recibo-laboratorio-${e.event_id}.pdf`).sort();
  assert.deepEqual(Object.keys(files).sort(),expected);assert.ok(!Object.keys(files).some(name=>previewM.some(event=>name.includes(event.event_id))));
  report.download_members={count:expected.length,files:expected};writeFileSync(evidence('recibos-48h-sinteticos.zip'),one.bytes);
 });
 await test('Refresh real mantém leitura só após autenticação e sessão ativa',async()=>{
  const initial=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:saved.joao.email,password:saved.joao.password});assert.equal(initial.status,200);const session=await initial.json();
  const refreshed=await local('/auth/v1/token?grant_type=refresh_token',status.ANON_KEY,{refresh_token:session.refresh_token});assert.equal(refreshed.status,200);const current=await refreshed.json();assert.equal((await http(current.access_token,'/receipt/'+previewJ[0].event_id)).status,200);await auth.signOut(current.access_token,'local');
 });
 await test('Identidade revogada bloqueia download com access token antigo',async()=>{await revokePortalAccountLocal({apiUrl:status.API_URL,serviceRoleKey:status.SERVICE_ROLE_KEY,adminAccessToken,identityId:accounts.joao.identityId,reason:'other'});assert.ok((await http(jwt.joao,'/receipt/'+j.event_id)).status>=400);assert.ok((await http(jwt.joao,'/last48')).status>=400);});
 for(const path of ['/receipt/'+randomUUID(),'/receipt/../../senha','/receipt/'+previewJ[0].event_id+'?employee_id='+randomUUID(),'/last48?receipt_id='+randomUUID(),'/list?from=../../','/authorize'])await test('Gateway URL/query direta manipulada negada '+report.checks.length,async()=>assert.ok((await http(tokens.joao,path)).status>=400));
 await test('JWT inválido/expirado não baixa PDF; JWT assinado real expira no guard controlado',async()=>{
  const pieces=tokens.joao.split('.'),claims=JSON.parse(Buffer.from(pieces[1],'base64url'));
  await auth.verifySigned(tokens.joao); // Mesmos bytes e assinatura ES256 válidos no instante atual.
  const now=Date.now;try{Date.now=()=>1000*(claims.exp+1);await rejected(()=>auth.verifyPersonal(tokens.joao),'SESSAO_INVALIDA');}finally{Date.now=now;}
  // O relógio controlado pertence apenas a este processo de ensaio, não ao host/serviço.
  claims.exp=1;pieces[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');assert.equal((await http(pieces.join('.'),'/last48')).status,401);assert.equal((await http('invalid','/last48')).status,401);
 });
 await test('Admin Gestão não recebe download pessoal',async()=>assert.equal((await http(tokens.admin,'/last48')).status,403));
 await test('Rota antiga de marcação continua bloqueada',async()=>{const r=await fetch('http://127.0.0.1:3105/lab-point/v1/events',{method:'POST',headers:{Authorization:`Bearer ${tokens.joao}`,Origin:'http://127.0.0.1:3101','Content-Type':'application/json'},body:JSON.stringify({contract_version:1,idempotency_key:randomUUID()})});assert.equal(r.status,404);});
 await test('Logout real torna PDF e ZIP diretos inacessíveis com token antigo',async()=>{await auth.signOut(tokens.joao,'local');assert.equal((await http(tokens.joao,'/receipt/'+previewJ[0].event_id)).status,401);assert.equal((await http(tokens.joao,'/last48')).status,401);});
 await test('Originais descartáveis preservados ao fim dos ensaios',async()=>assert.equal(await snapshot(),before));
 report.passed=true;
}catch(error){report.error=error.code??error.message;process.exitCode=1;console.error(report.error);console.error(error.message);console.error(error.stack?.split('\n').filter(line=>line.includes('provas-4b.mjs')).join('\n'));}
finally{if(core)await core.close();writeFileSync(evidence('resultado-4b.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error??null}));}
