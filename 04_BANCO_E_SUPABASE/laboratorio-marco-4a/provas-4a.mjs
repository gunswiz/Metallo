// Ensaios locais reais e extensão no núcleo descartável. Não escreve baseline histórica.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPreviewAccounts,sql,quote } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { createPointExtension,installExtension,normalizeLocation } from './extensao.mjs';
import { root,status,local,regressionFetch as fetch } from './ambiente.mjs';
const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL — 4A local',checks:[],passed:false};
const reportPath=new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/resultado-4a.json':process.env.METALLO_EVIDENCE_REVISION==='4c'?'../laboratorio-marco-4c/regressoes/resultado-4a.json':'./resultado-4a.json',import.meta.url);
if(existsSync(reportPath)){const previous=JSON.parse(readFileSync(reportPath));report.previous_attempts=[...(previous.previous_attempts??[]),{at:previous.at,passed:previous.passed,checks:previous.checks.length,error:previous.error??null}];}
const test=async(name,run)=>{await run();report.checks.push({name,ok:true});console.log('PASS '+name);};
const denied={status:'DENIED'},good={status:'AVAILABLE',latitude:-3.7,longitude:-38.5,accuracy_meters:12,captured_at:'2026-10-01T12:00:00.000Z'};
const dir=resolve(root,'backups/marco-4a-ensaios/core-'+randomUUID()),authPath=dir+'.authorization.json';
let core;
async function login(account){const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:account.email,password:account.password});assert.equal(r.status,200);return (await r.json()).access_token;}
try{
 await test('Baseline 3H confere e permanece imutável',async()=>assert.equal(createHash('sha256').update(readFileSync(resolve(root,'outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip'))).digest('hex'),'389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd'));
 const {accounts,adminAccessToken}=await createPreviewAccounts();
 sql(`update public.epi_employees set team_id=null where id=${quote(accounts.expira.employeeId)}::uuid`);
 const auth=createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY}),source=createLocalSource(status.SERVICE_ROLE_KEY);
 const jwt={};const people={};for(const kind of ['joao','maria','expira']){jwt[kind]=await login(accounts[kind]);people[kind]=await auth.verifyPersonal(jwt[kind]);}
 core=await createLabCore(dir,{mode:'create'});for(const [kind,p] of Object.entries(people))await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:`LAB-4A-${kind.toUpperCase()}`,employmentRef:`LAB-4A-V-${kind.toUpperCase()}`,validMinutes:60});
 const id=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await core.close();initializeAuthorization(authPath,id);
 core=await createLabCore(dir,{authorizationPath:authPath});for(const p of Object.values(people))await core.registerAuthorization(p.authUserId,p.employeeId);await core.close();
 core=await createLabCore(dir,{authorizationPath:authPath,source});await installExtension(core);let point=createPointExtension(core);
 async function mark(kind,location=denied,key=randomUUID()){const p=await auth.verifyPersonal(jwt[kind]);await point.begin(p,{idempotency_key:key});return point.finish(p,{idempotency_key:key,location},async()=>{await auth.verifyPersonal(jwt[kind]);});}
 let joao,maria;
 await test('Auth/JWT/PostgREST real + João registra com GPS sintético',async()=>{joao=await mark('joao',good);assert.equal(joao.event.location_status,'AVAILABLE');assert.equal(joao.event.online,true);});
 await test('Maria registra com GPS negado sem bloqueio',async()=>{maria=await mark('maria');assert.equal(maria.event.location_status,'DENIED');});
 for(const s of ['UNAVAILABLE','TIMEOUT','UNKNOWN'])await test('GPS '+s+' preserva marcação',async()=>assert.equal((await mark('joao',{status:s})).event.location_status,s));
 await test('Precisão baixa não impede marcação',async()=>assert.equal((await mark('joao',{...good,accuracy_meters:500})).event.location_status,'LOW_ACCURACY'));
 await test('Precisão alta preservada sem inventar',async()=>assert.equal((await mark('joao',{...good,accuracy_meters:1})).event.accuracy_meters,1));
 for(const [name,value] of Object.entries({lat91:{...good,latitude:91},lon181:{...good,longitude:181},nan:{...good,latitude:NaN},null:{...good,latitude:null},negativeAccuracy:{...good,accuracy_meters:-1},badTime:{...good,captured_at:'ontem'},infinity:{...good,longitude:Infinity},mock:{...good,status:'POSSIBLE_MOCK'}}))await test('Contexto inválido '+name+' vira UNKNOWN sem fraude/bloqueio',async()=>assert.equal((await mark('joao',value)).event.location_status,'UNKNOWN'));
 await test('Funcionário ativo sem equipe marca normalmente',async()=>assert.equal((await mark('expira')).event.online,true));
 await test('João só consulta seus eventos',async()=>{const rows=await point.history(people.joao);assert.ok(rows.some(r=>r.event_id===joao.event.event_id));assert.ok(!rows.some(r=>r.event_id===maria.event.event_id));});
 await test('Maria só consulta seus eventos',async()=>{const rows=await point.history(people.maria);assert.equal(rows.length,1);assert.equal(rows[0].event_id,maria.event.event_id);});
 const key=randomUUID();const started=await point.begin(people.joao,{idempotency_key:key});
 await test('Horário vem do servidor, não de captured_at antigo',async()=>{const e=(await point.finish(people.joao,{idempotency_key:key,location:good})).event;assert.equal(e.marking_at,started.marking_at);assert.notEqual(e.marking_at,good.captured_at);assert.ok(Date.parse(e.recorded_at)>=Date.parse(e.marking_at));assert.equal(e.timezone,'America/Fortaleza');});
 await test('Retry retorna mesmo evento e não muda horário original',async()=>{const r=await point.finish(people.joao,{idempotency_key:key,location:good});assert.equal(r.duplicate,true);assert.equal(r.event.marking_at,started.marking_at);});
 await test('Reuso de chave alterando geo negado',async()=>assert.rejects(point.finish(people.joao,{idempotency_key:key,location:denied}),e=>e.code==='INTENCAO_CONFLITANTE'));
 await test('Maria não reutiliza intenção de João',async()=>assert.rejects(point.begin(people.maria,{idempotency_key:key}),e=>e.code==='INTENCAO_CONFLITANTE'));
 await test('Maria não confirma intenção de João',async()=>assert.rejects(point.finish(people.maria,{idempotency_key:key,location:good}),e=>e.code==='INTENCAO_NAO_AUTORIZADA'));
 await test('Resultado João não é consultável por Maria',async()=>assert.equal(await point.outcome(people.maria,key),null));
 for(const field of ['employee_id','punch_id','account_id','identity_id','team_id','work_id','marking_at','recorded_at','collector','hash','online'])await test('Injeção '+field+' rejeitada',async()=>assert.rejects(point.begin(people.joao,{idempotency_key:randomUUID(),[field]:accounts.maria.employeeId}),e=>e.code==='PEDIDO_INVALIDO'));
 await test('Injeção no contexto geo rejeitada',async()=>assert.throws(()=>normalizeLocation({...good,employee_id:accounts.maria.employeeId}),e=>e.code==='PEDIDO_INVALIDO'));
 await test('Intenção não iniciada falha fechada',async()=>assert.rejects(point.finish(people.joao,{idempotency_key:randomUUID(),location:denied}),e=>e.code==='INTENCAO_NAO_AUTORIZADA'));
 for(const withContext of [false,true])await test('Intenção antiga sem commit expira'+(withContext?' mesmo com contexto durável':''),async()=>{const k=randomUUID(),p=people.joao;await core.checkpoint(async db=>{await db.query("insert into lab4a.intent(idempotency_key,auth_user_id,employee_id,marking_at) values($1,$2,$3,clock_timestamp()-interval '3 minutes')",[k,p.authUserId,p.employeeId]);if(withContext){const location=normalizeLocation(denied),hash=createHash('sha256').update(JSON.stringify(location)).digest('hex');await db.query('insert into lab4a.context values($1,$2,$3)',[k,location,hash]);}});await assert.rejects(point.finish(p,{idempotency_key:k,location:denied}),e=>e.code==='INTENCAO_EXPIRADA');});
 await test('Duplo envio concorrente cria um evento',async()=>{const k=randomUUID();await point.begin(people.joao,{idempotency_key:k});const results=await Promise.all([point.finish(people.joao,{idempotency_key:k,location:good}),point.finish(people.joao,{idempotency_key:k,location:good})]);assert.equal(results[0].event.event_id,results[1].event.event_id);});
 await test('Nova intenção voluntária é aceita',async()=>{const a=await mark('joao'),b=await mark('joao');assert.notEqual(a.event.event_id,b.event.event_id);});
 let lostKey;
 await test('Queda após commit 2F recupera recibo sem duplicação',async()=>{lostKey=randomUUID();point=createPointExtension(core,{testHook:async()=>{throw Error('resposta perdida');}});await point.begin(people.joao,{idempotency_key:lostKey});await assert.rejects(point.finish(people.joao,{idempotency_key:lostKey,location:denied}));point=createPointExtension(core);const r=await point.outcome(people.joao,lostKey);assert.ok(r);const r2=await point.finish(people.joao,{idempotency_key:lostKey,location:denied});assert.equal(r2.event.event_id,r.event_id);});
 for(const table of ['lab4a.intent','lab4a.context','lab4a.receipt','public.lab_time_event']){
  await test(table+' UPDATE original negado',async()=>assert.rejects(core.db.exec(`update ${table} set idempotency_key=idempotency_key`)));
  await test(table+' DELETE original negado',async()=>assert.rejects(core.db.exec(`delete from ${table}`)));
 }
 await test('RLS e ausência de políticas/grants públicos da extensão',async()=>{const r=await core.db.query("select relrowsecurity from pg_class where oid in ('lab4a.intent'::regclass,'lab4a.context'::regclass,'lab4a.receipt'::regclass)");assert.ok(r.rows.every(x=>x.relrowsecurity));assert.equal((await core.db.query("select count(*)::integer as n from pg_policies where schemaname='lab4a'")).rows[0].n,0);});
 await test('Restart mantém originais e geo sem alteração',async()=>{const before=await point.history(people.joao);await core.close();core=await createLabCore(dir,{authorizationPath:authPath,source});point=createPointExtension(core);assert.deepEqual(await point.history(people.joao),before);});
 await test('Auth inativo/revogado não consegue identidade pessoal',async()=>{await assert.rejects(auth.verifyPersonal(await login(accounts.inativo)));const revoked=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:accounts.revogada.email,password:accounts.revogada.password});assert.ok(revoked.status>=400);});
 await test('Revogação durante transação aborta evento e mantém contexto sem sucesso',async()=>{const p=people.expira,k=randomUUID();await point.begin(p,{idempotency_key:k});await assert.rejects(point.finish(p,{idempotency_key:k,location:denied},async()=>{sql(`update public.epi_employees set active=false where id=${quote(p.employeeId)}::uuid`);await auth.verifyPersonal(jwt.expira);}));assert.equal((await core.db.query('select count(*)::integer as n from lab_time_event where idempotency_key=$1',[k])).rows[0].n,0);});
 await test('Token residual não recupera acesso após desligamento',async()=>assert.rejects(auth.verifyPersonal(jwt.expira)));
 // Superfície HTTP efetiva da prévia, somente contas já sintéticas do 3H.
 const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-3h.json'),'utf8'));
 const j=await login(saved.joao),m=await login(saved.maria),a=await login(saved.admin),n=await login(saved.semEquipe);
 async function http(token,path,data,method=data===undefined?'GET':'POST',origin='http://127.0.0.1:3101'){const r=await fetch('http://127.0.0.1:3106/lab-point/v4a'+path,{method,headers:{Authorization:`Bearer ${token}`,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:r.status,body:await r.json()};}
 let jk,mk;
 await test('HTTP real begin/event João',async()=>{jk=randomUUID();assert.equal((await http(j,'/begin',{idempotency_key:jk})).status,200);assert.equal((await http(j,'/events',{idempotency_key:jk,location:denied})).status,201);});
 await test('HTTP real begin/event Maria',async()=>{mk=randomUUID();await http(m,'/begin',{idempotency_key:mk});assert.equal((await http(m,'/events',{idempotency_key:mk,location:denied})).status,201);});
 for(const [name,url] of [['servidor','http://127.0.0.1:3105/lab-point/v1/events'],['gateway Web','http://127.0.0.1:3101/api/ponto-lab/events']])await test('F-4A-01 HTTP real '+name+' não permite gravação v1',async()=>{
  const before=(await http(j,'/events')).body.events;
  const r=await fetch(url,{method:'POST',headers:{Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${j}`,'Content-Type':'application/json'},body:JSON.stringify({contract_version:1,idempotency_key:randomUUID()})});
  assert.equal(r.status,404);assert.deepEqual((await http(j,'/events')).body.events,before);
 });
 await test('F-4A-01 HTTP real legado não expõe histórico/resultado do núcleo',async()=>{
  for(const path of ['/events','/intent/'+jk]){const r=await fetch('http://127.0.0.1:3105/lab-point/v1'+path,{headers:{Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${j}`}});assert.equal(r.status,404);}
 });
 await test('HTTP João não consulta intenção Maria',async()=>assert.equal((await http(j,'/intent/'+mk)).status,404));
 await test('HTTP Maria não consulta intenção João',async()=>assert.equal((await http(m,'/intent/'+jk)).status,404));
 await test('HTTP funcionário sem equipe é autorizado',async()=>assert.equal((await http(n,'/events')).status,200));
 for(const field of ['employee_id','punch_id','account_id','identity_id','team_id','work_id','marking_at','collector'])await test('HTTP injeção '+field,async()=>assert.equal((await http(j,'/begin',{idempotency_key:randomUUID(),[field]:randomUUID()})).status,400));
 await test('HTTP querystring manipulada negada',async()=>assert.equal((await http(j,'/events?employee_id='+randomUUID())).status,400));
 await test('HTTP UPDATE/DELETE não oferecidos',async()=>{assert.equal((await http(j,'/events',undefined,'PATCH')).status,404);assert.equal((await http(j,'/events',undefined,'DELETE')).status,404);});
 await test('Gestão global autorizada com nomes corretos e sem latitude/longitude/hash',async()=>{const r=await http(a,'/management',undefined,'GET','http://127.0.0.1:3102');assert.equal(r.status,200);assert.ok(r.body.events.length>0);assert.ok(r.body.events.every(e=>!('latitude'in e)&&!('longitude'in e)&&!('payload_hash'in e)));assert.ok(r.body.events.some(e=>e.employee_name==='João Sintético'));assert.ok(r.body.events.some(e=>e.employee_name==='Maria Sintética'));});
 await test('Funcionário não recebe permissão Gestão',async()=>assert.equal((await http(j,'/management',undefined,'GET','http://127.0.0.1:3102')).status,403));
 await test('Admin Gestão não marca ponto sem identidade pessoal',async()=>assert.equal((await http(a,'/events',{idempotency_key:randomUUID(),location:denied})).status,403));
 await test('Origem externa negada',async()=>assert.equal((await http(j,'/events',undefined,'GET','http://192.168.0.3:3101')).status,403));
 await test('Nenhuma RPC/tabela 4A exposta no PostgREST',async()=>{const r=await local('/rest/v1/lab4a.receipt?select=*',j);assert.ok(r.status>=400);});
 await test('Núcleo 2F permanece íntegro',async()=>assert.equal((await core.inspect()).schema_ok,true));
 report.passed=true;
}catch(error){report.error=error.code??error.message;process.exitCode=1;console.error(report.error);}
finally{if(core)await core.close();writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error??null}));}
