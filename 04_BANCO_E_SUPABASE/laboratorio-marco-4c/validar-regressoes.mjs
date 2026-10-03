// Reexecuta suítes existentes em portas/núcleo descartáveis, preservando provas
// anteriores e a prévia manual. Não altera SQL remoto ou guard de produção.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync,openSync,closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { root,status,local,regressionFetch } from '../laboratorio-marco-4a/ambiente.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { installExtension,createPointExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { createLocalTransport } from './transporte-local.mjs';
import { createCurrentResources } from './abrir-laboratorio.mjs';
import { startPointServer } from '../laboratorio-marco-4a/servidor-4a.mjs';

const bootstrap=process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap',adoption=bootstrap||process.env.METALLO_EVIDENCE_REVISION==='4c-adocao';
const round2=['2','3','4','5','6'].includes(process.env.METALLO_4C_ROUND),revision=bootstrap?'4c-bootstrap':adoption?'4c-adocao':round2?'4c-r'+process.env.METALLO_4C_ROUND:'4c';
const folder=resolve(import.meta.dirname,...(bootstrap?['adocao-controlada','correcao-bootstrap']:adoption?['adocao-controlada']:round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]),'regressoes');mkdirSync(folder,{recursive:true});
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const historical=['laboratorio-marco-4b/resultado-4b.json','laboratorio-marco-4a/resultado-4a.json',
 'laboratorio-marco-4a/resultado-auditoria-4a.json','laboratorio-marco-2f/resultado-2f.json','laboratorio-marco-4b/rede.json'];
const before=historical.map(path=>({path,sha256:hash(readFileSync(resolve(root,'04_BANCO_E_SUPABASE',path)))}));
const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; local descartável',commands:[],historical_before:before,remote:false};
const completing=process.argv[2]==='completar';
const retry4b=process.argv[2]==='retomar-4b';
const retry4a=process.argv[2]==='retomar-4a';
if(completing||retry4b||retry4a)Object.assign(report,JSON.parse(readFileSync(resolve(folder,'execucao.json'),'utf8')));
const env={...process.env,METALLO_EVIDENCE_REVISION:revision,METALLO_4C_TELEMETRY:'1',METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',
 METALLO_COLABORADOR_LAB_URL:status.API_URL,METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_LOAD_TEST_CORE_PORT:'3107'};
process.env.METALLO_EVIDENCE_REVISION=revision;
let core,running,compatibility,web,injectFault=false,pools=null,resources=null;
async function command(name,args,cwd=root){
 const stdout=openSync(resolve(folder,name+'.log'),'w'),stderr=openSync(resolve(folder,name+'.erro.log'),'w');
 const row={name,args:args.map(arg=>arg.replace(root,'<workspace>')),started_at:new Date().toISOString()};
 const childEnv={...env};if(name.startsWith('web'))for(const key of Object.keys(childEnv))if(key.startsWith('METALLO_'))delete childEnv[key];
 const child=spawn(process.execPath,args,{cwd,windowsHide:true,env:childEnv,stdio:['ignore',stdout,stderr]});closeSync(stdout);closeSync(stderr);
 const exit=await new Promise(ok=>child.once('exit',(code,signal)=>ok({code,signal})));
 Object.assign(row,exit,{finished_at:new Date().toISOString(),log_sha256:hash(readFileSync(resolve(folder,name+'.log'))),error_sha256:hash(readFileSync(resolve(folder,name+'.erro.log')))});
 report.commands.push(row);writeFileSync(resolve(folder,'execucao.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(row));if(adoption)assert.equal(row.code,0,'Gate de regressão falhou: '+name);
}
try{
 if(completing){
  await command('web-final',[resolve(root,'01_WEB/node_modules/vitest/vitest.mjs'),'run'],resolve(root,'01_WEB'));
  await command('lint-final',[resolve(root,'01_WEB/node_modules/eslint/bin/eslint.js'),'.','--max-warnings=0'],resolve(root,'01_WEB'));
 }else{
 assert.equal(hash(readFileSync(resolve(root,'outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip'))),'2ff3076d3a9bee5b33a363ae4264dde392bce7f4662273309b5a5085726c3c71');
 const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-3h.json'),'utf8'));
 pools=['5','6'].includes(process.env.METALLO_4C_ROUND)?Object.fromEntries(['auth_write','auth_read','source_write','source_read'].map(k=>[k,createLocalTransport({connections:8})])):null;
 resources=adoption?createCurrentResources({anonKey:status.ANON_KEY,serviceKey:status.SERVICE_ROLE_KEY}):null;
 const auth=resources?.auth??createLabAuth(status.ANON_KEY,pools?.auth_write.fetch??fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY}),people=[];if(pools)auth.read=createLabAuth(status.ANON_KEY,pools.auth_read.fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
 for(const kind of ['joao','maria','semEquipe']){
  const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:saved[kind].email,password:saved[kind].password});assert.equal(r.status,200);
  const login=await r.json();people.push(await auth.verifyPersonal(login.access_token));
 }
 const dir=resolve(root,'backups/marco-4c-ensaios/regressao-'+randomUUID()),authorizationPath=dir+'.authorization.json';
 core=await createLabCore(dir,{mode:'create'});
 for(const p of people)await core.seedSynthetic({authUserId:p.authUserId,employeeId:p.employeeId,workerRef:'LAB-4C-'+p.authUserId.toUpperCase(),employmentRef:'LAB-4C-V-'+p.authUserId.toUpperCase(),validMinutes:60});
 const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await core.close();initializeAuthorization(authorizationPath,databaseId);
 core=await createLabCore(dir,{authorizationPath});for(const p of people)await core.registerAuthorization(p.authUserId,p.employeeId);await core.close();
 core=resources?await resources.openCore(dir,{authorizationPath}):await createLabCore(dir,{authorizationPath,source:createLocalSource(status.SERVICE_ROLE_KEY,pools?.source_write.fetch??fetch),readSource:pools?createLocalSource(status.SERVICE_ROLE_KEY,pools.source_read.fetch):null,integrityMode:pools?'incremental':'full'});await installExtension(core);
 const point=createPointExtension(core);
 for(const p of people){const idempotency_key=randomUUID();await point.begin(p,{idempotency_key});await point.finish(p,{idempotency_key,location:{status:'DENIED'}});}
 running=await startPointServer({core,auth,port:3107,sessionPort:3108,testHook:async phase=>{
  if(injectFault&&phase==='after_core_commit'){injectFault=false;throw Error('FALHA_SINTETICA_APOS_COMMIT');}
 }});
 if(adoption||['3','4','5','6'].includes(process.env.METALLO_4C_ROUND)){
  // Provas antigas e gateway v1 usam 3105/3106 fixas. Atender essas portas
  // com o MESMO núcleo descartável; jamais depender da prévia manual.
  // Este adaptador não é dono do banco e não pode fechá-lo no shutdown.
  compatibility=await startPointServer({core:{...core,close:async()=>{}},auth,port:3106,sessionPort:3105});
  report.legacy_test_ports={ports:[3105,3106],same_disposable_database:true,manual_preview_dependency:false};
 }
 const out=openSync(resolve(folder,'gateway.log'),'w'),err=openSync(resolve(folder,'gateway.erro.log'),'w');
 web=spawn(process.execPath,[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:resolve(root,'01_WEB'),windowsHide:true,env,stdio:['ignore',out,err]});closeSync(out);closeSync(err);
 let ready=false;for(let n=0;n<40;n++){try{const r=await regressionFetch('http://127.0.0.1:3101/api/ponto-registros/last48');if(r.status===401){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,250));}assert.ok(ready,'Gateway descartável pronto');
 if(retry4a){
  await command('4a-final',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4a/provas-4a.mjs')]);
  await command('confronto-4a-final',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4a/provas-auditoria-4a.mjs')]);
 }
 else if(retry4b){await command('4b-final',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4b/provas-4b.mjs')]);}
 else{
 await command('4a',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4a/provas-4a.mjs')]);
 await command('4b',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4b/provas-4b.mjs')]);
 await command('confronto-4a',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4a/provas-auditoria-4a.mjs')]);
 await command('2f',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-2f/provas-2f.mjs')]);
 if(adoption||['4','5','6'].includes(process.env.METALLO_4C_ROUND))await command('2d',[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-2d/provas-2d.mjs')]);
 await command('revogacao-concorrente',['--test',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-2b/provas-revogacao-concorrente-2b.mjs')]);
 // Falha explícita fora das métricas de desempenho: commit persiste, HTTP 503,
 // retry com resposta descartada, novo retry, exatamente um original/recibo.
 const loginResponse=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:saved.joao.email,password:saved.joao.password});assert.equal(loginResponse.status,200);
 const login=await loginResponse.json(),key=randomUUID();
 const post=(path)=>regressionFetch('http://127.0.0.1:3101/api/ponto-online/'+path,{method:'POST',headers:{Origin:'http://127.0.0.1:3101',Authorization:'Bearer '+login.access_token,'Content-Type':'application/json'},body:JSON.stringify(path==='begin'?{idempotency_key:key}:{idempotency_key:key,location:{status:'DENIED'}})});
 assert.equal((await post('begin')).status,200);injectFault=true;
 const failed=await post('events');assert.equal(failed.status,503);
 const count=async()=>({events:(await core.db.query('select event_id from lab_time_event where idempotency_key=$1',[key])).rows,receipts:(await core.db.query('select event_id from lab4a.receipt where idempotency_key=$1',[key])).rows});
 const committed=await count();assert.equal(committed.events.length,1);assert.equal(committed.receipts.length,0);
 const lost=await post('events');assert.equal(lost.status,200);await lost.body.cancel();
 const recovered=await post('events');assert.equal(recovered.status,200);const result=await recovered.json();assert.equal(result.duplicate,true);
 const final=await count();assert.equal(final.events.length,1);assert.equal(final.receipts.length,1);assert.equal(final.events[0].event_id,final.receipts[0].event_id);assert.equal(result.event.event_id,final.events[0].event_id);
 report.fault_recovery={passed:true,injected_after_commit:true,first_status:503,retry_discarded_after_headers:true,recovered_status:200,same_key:true,same_event:true,events:1,receipts:1,duplicates:0,scope:'Injected locally outside load metrics; no physical network/power failure claim'};
 writeFileSync(resolve(folder,'falha-503-resposta-perdida.json'),JSON.stringify(report.fault_recovery,null,2)+'\n');
 if(adoption||process.env.METALLO_4C_ROUND==='6')await command('backup-v2',['--test',resolve(import.meta.dirname,'backup-v2.test.mjs')]);
 if(resources||pools)await command(adoption?'incremental-adocao':'incremental-r'+process.env.METALLO_4C_ROUND,['--test',resolve(import.meta.dirname,'incremental.test.mjs')]);
 await command('paridade-4c',['--test',resolve(import.meta.dirname,'integridade-paridade.test.mjs')]);
 if(adoption||['3','4','5','6'].includes(process.env.METALLO_4C_ROUND))await command('caminho-critico',['--test',resolve(import.meta.dirname,'caminho-critico.test.mjs')]);
 await command('agendamento',['--test',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4b/agendamento-http.test.mjs')]);
 await command('web',[resolve(root,'01_WEB/node_modules/vitest/vitest.mjs'),'run'],resolve(root,'01_WEB'));
 await command('banco',['--test','06_TESTES_E_QUALIDADE/*-banco.test.mjs']);
 await command('qualidade',['--test','06_TESTES_E_QUALIDADE/*.test.mjs']);
 await command('typecheck',[resolve(root,'01_WEB/node_modules/typescript/bin/tsc'),'--noEmit'],resolve(root,'01_WEB'));
 await command('lint',[resolve(root,'01_WEB/node_modules/eslint/bin/eslint.js'),'.','--max-warnings=0'],resolve(root,'01_WEB'));
 await command('build',[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'build'],resolve(root,'01_WEB'));
 }
 }
}catch(e){report.error=e.code??e.message;console.error(report.error);}
finally{
 if(compatibility)await compatibility.shutdown();
 if(running)await running.shutdown();else if(core)await core.close();web?.kill();if(pools)Object.values(pools).forEach(p=>p.close());
 report.historical_after=historical.map(path=>({path,sha256:hash(readFileSync(resolve(root,'04_BANCO_E_SUPABASE',path)))}));
 report.historical_preserved=JSON.stringify(report.historical_after)===JSON.stringify(before);
 report.final_commands=[...new Map(report.commands.map(r=>[r.name.replace(/-final$/,''),r])).values()];
 report.passed=!report.error&&report.historical_preserved&&report.final_commands.every(r=>r.code===0);
 report.finished_at=new Date().toISOString();writeFileSync(resolve(folder,'execucao.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,commands:report.commands.length,historical_preserved:report.historical_preserved,error:report.error??null}));process.exitCode=report.passed?0:1;
}
