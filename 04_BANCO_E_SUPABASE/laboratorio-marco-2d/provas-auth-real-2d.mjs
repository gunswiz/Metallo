// Auth/JWT/PostgREST reais, núcleo persistente e reinício de processo. Nenhum token é gravado.
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createPreviewAccounts, revokePreviewAccount, base, anon } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
const root=resolve(import.meta.dirname,'../..'),allowed=resolve(root,'backups/marco-2d-ensaios');
const directory=resolve(allowed,'auth-'+randomUUID()),anchorPath=directory+'.anchor.json';
const docker=resolve(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
const report={at:new Date().toISOString(),scope:'Auth ES256, JWT, PostgREST e RPC locais reais; PGlite persistente em filho reiniciado',checks:[],passed:false};
const cases=[];let worker,paused=false,accounts,adminAccessToken,j,m,jEvent,mEvent,keyJ,keyM,revokedKey;
const test=(name,run)=>cases.push({name,run});
const fresh=()=>({contract_version:1,idempotency_key:randomUUID()});
function wait(child,predicate){return new Promise((ok,fail)=>{const timer=setTimeout(()=>{cleanup();fail(Error('IPC_TIMEOUT'));},30000);function cleanup(){clearTimeout(timer);child.off('message',receive);child.off('exit',end);}function receive(v){if(predicate(v)){cleanup();ok(v);}}function end(){cleanup();fail(Error('PROCESSO_ENCERROU'));}child.on('message',receive);child.on('exit',end);});}
async function start(){const child=fork(resolve(import.meta.dirname,'processo-ensaio.mjs'),[],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});const ready=wait(child,v=>v.ready||v.error);child.send({command:'init',directory,anchorPath,anonKey:anon});const v=await ready;assert.ok(v.ready);worker={child,port:v.port};}
async function command(command){const id=randomUUID(),result=wait(worker.child,v=>v.id===id);worker.child.send({id,command});const v=await result;assert.ok(!v.error);return v;}
async function stop(){const exit=once(worker.child,'exit');await command('shutdown');await exit;worker=null;}
async function request(token,path='/lab-point/v1/events',body){const response=await fetch(`http://127.0.0.1:${worker.port}${path}`,{method:body?'POST':'GET',headers:{Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});return {status:response.status,data:await response.json()};}
async function login(account){const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});assert.equal(r.status,200);return (await r.json()).access_token;}
const count=async()=> (await command('snapshot')).snapshot.events.length;
test('Preparação sintética autentica João/Maria com ES256 real',async()=>{({accounts,adminAccessToken}=await createPreviewAccounts());j=await login(accounts.joao);m=await login(accounts.maria);assert.equal(JSON.parse(Buffer.from(j.split('.')[0],'base64url')).alg,'ES256');mkdirSync(allowed,{recursive:true});const core=await createLabCore(directory,{mode:'create',anchorPath});for(const kind of ['joao','maria'])await core.seedSynthetic({authUserId:accounts[kind].id,employeeId:accounts[kind].employeeId,workerRef:'LAB-'+kind.toUpperCase(),employmentRef:'LAB-VINCULO-'+kind.toUpperCase()});await core.close();await start();});
test('João registra antes do restart',async()=>{keyJ=fresh();jEvent=await request(j,undefined,keyJ);assert.equal(jEvent.status,201);});
test('Maria registra antes do restart',async()=>{keyM=fresh();mEvent=await request(m,undefined,keyM);assert.equal(mEvent.status,201);});
test('Restart real recupera mesma intenção/ID/hash/timestamp',async()=>{await stop();await start();const r=await request(j,undefined,keyJ);assert.equal(r.status,200);assert.deepEqual(r.data.event,jEvent.data.event);assert.equal(await count(),2);});
test('João vê somente original próprio após restart',async()=>{const r=await request(j);assert.equal(r.status,200);assert.deepEqual(r.data.events,[jEvent.data.event]);});
test('Maria vê somente original próprio após restart',async()=>{const r=await request(m);assert.equal(r.status,200);assert.deepEqual(r.data.events,[mEvent.data.event]);});
test('João → Maria intenção negada após restart',async()=>assert.equal((await request(j,'/lab-point/v1/intent/'+keyM.idempotency_key)).status,404));
test('Maria → João intenção negada após restart',async()=>assert.equal((await request(m,'/lab-point/v1/intent/'+keyJ.idempotency_key)).status,404));
test('Cinco POST reais mesma chave pós-restart geram um original',async()=>{const body=fresh(),results=await Promise.all(Array.from({length:5},()=>request(m,undefined,body)));assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===200).length,4);assert.equal(new Set(results.map(r=>r.data.event.event_id)).size,1);assert.equal(await count(),3);});
test('Auth realmente pausado: health distingue dependência indisponível',async()=>{execFileSync(docker,['pause','supabase_auth_laboratorio-marco-1a'],{stdio:'ignore'});paused=true;const r=await request(j,'/health');assert.equal(r.status,503);assert.equal(r.data.auth_dependency,'UNAVAILABLE');assert.equal(r.data.ready_for_new_events,false);});
test('Auth realmente pausado: POST negado, zero evento novo',async()=>{try{assert.equal((await request(j,undefined,fresh())).status,503);assert.equal(await count(),3);}finally{execFileSync(docker,['unpause','supabase_auth_laboratorio-marco-1a'],{stdio:'ignore'});paused=false;}});
test('Auth recuperado: autorização real volta a funcionar',async()=>{assert.equal((await request(m)).status,200);});
test('João revogado, processo reiniciado, token residual negado',async()=>{await revokePreviewAccount(accounts.joao.identityId,adminAccessToken);await stop();await start();revokedKey=fresh();const local=(await command('snapshot')).snapshot.contexts.find(c=>c.auth_user_id===accounts.joao.id);assert.equal(local.active,true);assert.equal(local.context_status,'active');report.revoked_auth_with_active_local_snapshot_denied=true;const r=await request(j,undefined,revokedKey);assert.ok([401,403].includes(r.status));assert.equal(await count(),3);});
test('Retry do token revogado continua negado e sem original',async()=>{const r=await request(j,undefined,revokedKey);assert.ok([401,403].includes(r.status));assert.equal(await count(),3);});
test('Funcionário inativo não marca após restart',async()=>{const token=await login(accounts.inativo),r=await request(token,undefined,fresh());assert.ok([401,403].includes(r.status));assert.equal(await count(),3);});
test('Maria permanece isolada após revogação de João e restart',async()=>{const r=await request(m);assert.equal(r.status,200);assert.equal(r.data.events.length,2);assert.ok(!r.data.events.some(e=>e.event_id===jEvent.data.event.event_id));});
test('Shutdown gracioso encerra listener e preserva integridade',async()=>{const port=worker.port;await stop();await assert.rejects(fetch(`http://127.0.0.1:${port}/health`));const core=await createLabCore(directory,{anchorPath});assert.equal((await core.inspect()).state,'READY');await core.close();});
const planPath=new URL('./plano-auth-real-2d.json',import.meta.url),names=cases.map(c=>c.name),sha=value=>createHash('sha256').update(value).digest('hex');
if(process.argv.includes('--plan')){
  const prior=existsSync(planPath)?sha(readFileSync(planPath)):null;
  writeFileSync(planPath,JSON.stringify({at:new Date().toISOString(),frozen_before_execution:true,separate_declaration_command:true,previous_plan_sha256:prior,expected:cases.length,cases:names},null,2)+'\n');
  console.log(JSON.stringify({declared:cases.length,sha256:sha(readFileSync(planPath)),tests_executed:0}));process.exit(0);
}
const declared=JSON.parse(readFileSync(planPath,'utf8'));assert.deepEqual(declared.cases,names);assert.equal(declared.expected,cases.length);
report.plan_sha256=sha(readFileSync(planPath));report.plan_read_only_during_execution=true;report.expected=cases.length;
try{for(const c of cases){try{await c.run();report.checks.push({name:c.name,ok:true});console.log('PASS '+c.name);}catch(error){report.checks.push({name:c.name,ok:false,error:error.code??error.name});throw error;}}report.passed=true;}catch(error){report.error=error.code??error.name;process.exitCode=1;}
finally{if(paused)execFileSync(docker,['unpause','supabase_auth_laboratorio-marco-1a'],{stdio:'ignore'});if(worker){try{await stop();}catch{worker?.child.kill('SIGKILL');}}if(report.passed){assert.ok(directory.startsWith(allowed+'\\'));rmSync(directory,{recursive:true,force:true});for(const path of [anchorPath,directory+'.lock'])if(existsSync(path))rmSync(path);report.disposable_environment_removed=true;}const target=new URL(process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/resultado-auth-real-2d-regressao.json':'./resultado-auth-real-2d.json',import.meta.url);if(existsSync(target)){const previous=JSON.parse(readFileSync(target,'utf8'));report.previous_runs=[...(previous.previous_runs??[]),{at:previous.at,passed:previous.passed,checks:previous.checks}];}writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,expected:report.expected,error:report.error??null}));}
