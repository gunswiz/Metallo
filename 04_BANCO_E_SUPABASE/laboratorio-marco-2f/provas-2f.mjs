// Ensaios descartáveis 2F. Contas, banco, JWT e Supabase são locais e sintéticos.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createAuthorization, initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { startLabServer } from '../laboratorio-marco-2b/http-lab.mjs';
import { backupCore, restoreDisposable } from '../laboratorio-marco-2b/backup.mjs';
import { createLocalSource, createReconciler } from './reconciliacao.mjs';

const root=resolve(import.meta.dirname,'../..');
const allowed=resolve(root,'backups/marco-2f-ensaios');
const name=randomUUID(),directory=resolve(allowed,'core-'+name),anchorPath=directory+'.anchor.json',authorizationPath=directory+'.authorization.json';
const backupDir=resolve(allowed,'backup-'+name),restoreDir=resolve(allowed,'restore-'+name),restoreAnchor=restoreDir+'.anchor.json';
const resultPath=new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/resultado-2f.json':process.env.METALLO_EVIDENCE_REVISION==='4c'?'../laboratorio-marco-4c/regressoes/resultado-2f.json':'./resultado-2f.json',import.meta.url),planPath=new URL('./plano-testes-2f.json',import.meta.url);
const sha=b=>createHash('sha256').update(b).digest('hex');
const body=()=>({contract_version:1,idempotency_key:randomUUID()});
const cases=[];const test=(name,run)=>cases.push({name,run});
const report={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL — laboratório local',checks:[],passed:false};
let accounts,adminAccessToken,base,anon,serviceKey,core,server,auth,source,j1,j2,m1,m2,jEvent,mEvent,jBody,mBody,backupCount;
const token=s=>s.access_token;
const claims=s=>JSON.parse(Buffer.from(token(s).split('.')[1],'base64url'));
async function login(account){const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(10000)});return {status:r.status,data:await r.json()};}
async function refresh(s){const r=await fetch(base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token}),signal:AbortSignal.timeout(10000)});return r.status;}
async function request(jwt,path='/lab-point/v1/events',payload){const r=await fetch(`http://127.0.0.1:${server.port}${path}`,{method:payload===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:3101',Authorization:`Bearer ${jwt}`,'Content-Type':'application/json'},body:payload&&typeof payload==='object'?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});return {status:r.status,data:await r.json()};}
async function count(){return Number((await core.db.query('select count(*)::integer as n from lab_time_event')).rows[0].n);}
async function restart(){await server.shutdown();server=null;core=await createLabCore(directory,{anchorPath,authorizationPath,source});server=await startLabServer({core,auth,port:0,logger:()=>{}});}

test('Baseline 2E imutável confere SHA-256',async()=>{const hash=sha(readFileSync(resolve(root,'outputs/Metallo-Marco2E-BaselineAprovada-20260927-R1.zip')));assert.equal(hash,'c0c54b8e29cb0d29f2ebf29bf485d79b52632008a09d6e7261c90fae4c66b0ad');report.origin_sha256=hash;});
test('Origem local e titulares sintéticos preparam núcleo 2F separado',async()=>{
  const preview=await import('../laboratorio-marco-1a/criar-contas-previa-1b.mjs');({base,anon}=preview);({accounts,adminAccessToken}=await preview.createPreviewAccounts());
  const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
  assert.equal(status.API_URL,'http://127.0.0.1:54321');serviceKey=status.SERVICE_ROLE_KEY;source=createLocalSource(serviceKey);auth=createLabAuth(anon,fetch,{requireSession:true,serviceKey});
  const sessions=await Promise.all([login(accounts.joao),login(accounts.joao),login(accounts.maria),login(accounts.maria)]);assert.ok(sessions.every(s=>s.status===200));[j1,j2,m1,m2]=sessions.map(s=>s.data);
  mkdirSync(allowed,{recursive:true});let setup=await createLabCore(directory,{mode:'create',anchorPath});
  for(const kind of ['joao','maria'])await setup.seedSynthetic({authUserId:accounts[kind].id,employeeId:accounts[kind].employeeId,workerRef:'LAB-'+kind.toUpperCase(),employmentRef:'LAB-VINCULO-'+kind.toUpperCase()});
  const id=(await setup.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await setup.close();initializeAuthorization(authorizationPath,id);
  setup=await createLabCore(directory,{anchorPath,authorizationPath});for(const kind of ['joao','maria'])await setup.registerAuthorization(accounts[kind].id,accounts[kind].employeeId);await setup.close();
  core=await createLabCore(directory,{anchorPath,authorizationPath,source});server=await startLabServer({core,auth,port:0,logger:()=>{}});
  assert.equal((await core.inspect()).reconciliation.ready,true);
});
test('Origem usa audit atômico com versão inicial e acesso só service_role',async()=>{
  const snap=await source.snapshot(accounts.joao.id);assert.equal(snap.events.length,1);assert.equal(snap.events[0].version,1);assert.equal(snap.state,'ACTIVE');
  const r=await fetch(base+'/rest/v1/rpc/lab_authz_source_2f',{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${token(j1)}`,'Content-Type':'application/json'},body:JSON.stringify({p_auth_user_id:accounts.maria.id})});assert.ok([401,403,404].includes(r.status));
  const admin=await fetch(base+'/rest/v1/rpc/lab_sessions_before_cutoff_2f',{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${adminAccessToken}`,'Content-Type':'application/json'},body:JSON.stringify({p_auth_user_id:accounts.joao.id,p_cutoff_sec:Math.floor(Date.now()/1000)})});assert.ok([401,403,404].includes(admin.status));
});
test('Reconciliação inicial é IN_SYNC e mantém titulares separados',async()=>{const s=core.authorizationSnapshot();assert.equal(s.people[accounts.joao.id].source_version,1);assert.equal(s.people[accounts.maria.id].source_version,1);assert.equal((await core.reconcileUser(accounts.joao.id)).status,'IN_SYNC');assert.equal((await core.reconcileUser(accounts.maria.id)).status,'IN_SYNC');});
test('Evento repetido é idempotente e não eleva authorization_version',async()=>{const before=core.authorizationSnapshot().people[accounts.joao.id].authorization_version;await core.reconcileUser(accounts.joao.id);await core.reconcileUser(accounts.joao.id);assert.equal(core.authorizationSnapshot().people[accounts.joao.id].authorization_version,before);});
test('Evento fora de ordem e origem anterior falham fechados',async()=>{
  const ledger=createAuthorization(authorizationPath,core.authorizationSnapshot().database_id,{requireSource:true});const real=await source.snapshot(accounts.joao.id);
  assert.throws(()=>ledger.applySourceSnapshot(accounts.joao.id,{...real,events:[{...real.events[0],version:2}]}),e=>e.code==='RECONCILIACAO_NECESSARIA');
  assert.equal(ledger.inspect().people[accounts.joao.id].source_version,1);
});
test('Mesmo número de versão com estado divergente não autoriza',async()=>{
  const path=resolve(allowed,'divergent-'+name+'.json'),dbid=randomUUID();initializeAuthorization(path,dbid);
  try{const ledger=createAuthorization(path,dbid,{requireSource:true});ledger.register(accounts.joao.id,accounts.joao.employeeId);const snap=await source.snapshot(accounts.joao.id);ledger.applySourceSnapshot(accounts.joao.id,snap);ledger.setState(accounts.joao.id,'STALE');assert.throws(()=>ledger.applySourceSnapshot(accounts.joao.id,snap),e=>e.code==='RECONCILIACAO_NECESSARIA');assert.throws(()=>ledger.authorize({authUserId:accounts.joao.id,employeeId:accounts.joao.employeeId,sessionId:claims(j1).session_id,issuedAt:claims(j1).iat}),e=>e.code==='AUTORIZACAO_NAO_COMPROVADA');}finally{rmSync(path,{force:true});}
});
test('JWT ES256 assinado com iat futuro é rejeitado',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const now=Math.floor(Date.now()/1000),kid=randomUUID();
  const header=Buffer.from(JSON.stringify({alg:'ES256',kid})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({iss:base+'/auth/v1',aud:'authenticated',role:'authenticated',sub:accounts.joao.id,session_id:claims(j1).session_id,iat:now+30,exp:now+3600})).toString('base64url');
  const signed=`${header}.${payload}.${sign('sha256',Buffer.from(`${header}.${payload}`),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  const jwk={...publicKey.export({format:'jwk'}),kid,alg:'ES256'};
  const fake=async()=>({ok:true,json:async()=>({keys:[jwk]})});const verifier=createLabAuth(anon,fake);
  await assert.rejects(verifier.verifySigned(signed),e=>e.code==='SESSAO_INVALIDA');
});
test('João e Maria registram originais isolados',async()=>{jBody=body();mBody=body();jEvent=await request(token(j1),undefined,jBody);mEvent=await request(token(m1),undefined,mBody);assert.equal(jEvent.status,201);assert.equal(mEvent.status,201);assert.equal(await count(),2);});
test('Duas abas João veem só João e não a intenção Maria',async()=>{const r=await Promise.all([request(token(j1)),request(token(j1))]);assert.ok(r.every(x=>x.status===200&&x.data.events.length===1));assert.equal((await request(token(j1),'/lab-point/v1/intent/'+mBody.idempotency_key)).status,404);});
test('Maria não consulta a intenção João e admin não marca',async()=>{assert.equal((await request(token(m1),'/lab-point/v1/intent/'+jBody.idempotency_key)).status,404);assert.ok([401,403,503].includes((await request(adminAccessToken,undefined,body())).status));assert.equal(await count(),2);});
test('Backup anterior à revogação registra corte consistente',async()=>{const b=await backupCore(core,backupDir);backupCount=b.state.event_count;assert.equal(backupCount,2);});
test('Revogação na origem propaga sozinha e aumenta versão do núcleo',async()=>{
  const prior=core.authorizationSnapshot().people[accounts.joao.id].authorization_version;
  const {revokePreviewAccount}=await import('../laboratorio-marco-1a/criar-contas-previa-1b.mjs');await revokePreviewAccount(accounts.joao.identityId,adminAccessToken);
  const snapshot=await source.snapshot(accounts.joao.id);assert.equal(snapshot.events.length,2);assert.equal(snapshot.events[1].version,2);assert.equal(snapshot.state,'REVOKED');
  const applied=await core.reconcileUser(accounts.joao.id);assert.equal(applied.status,'REVOKED');assert.equal(applied.beforeVersion,1);assert.equal(applied.sourceVersion,2);assert.equal(applied.nucleusVersion,2);assert.equal(applied.lagDetected,true);assert.equal(core.authorizationSnapshot().people[accounts.joao.id].authorization_version,prior+1);
});
test('Evento antigo não reduz versão nem reativa acesso',async()=>{const ledger=createAuthorization(authorizationPath,core.authorizationSnapshot().database_id,{requireSource:true});const full=await source.snapshot(accounts.joao.id);assert.throws(()=>ledger.applySourceSnapshot(accounts.joao.id,{...full,state:'ACTIVE',events:full.events.slice(0,1)}),e=>e.code==='ORIGEM_ANTERIOR');assert.equal(ledger.inspect().people[accounts.joao.id].state,'REVOKED');});
test('Rollback da origem aparece como AHEAD_INVALID e não reativa João',async()=>{
  const normal=source.snapshot,full=await normal(accounts.joao.id);
  source.snapshot=async id=>id===accounts.joao.id?{...full,state:'ACTIVE',events:full.events.slice(0,1)}:normal(id);
  try{await assert.rejects(core.reconcileUser(accounts.joao.id),e=>e.code==='ORIGEM_ANTERIOR');assert.equal((await core.inspect()).reconciliation.states[accounts.joao.id],'AHEAD_INVALID');assert.equal(core.authorizationSnapshot().people[accounts.joao.id].state,'REVOKED');}finally{source.snapshot=normal;await core.reconcileAll();}
});
test('Token residual e retry POST não criam novo evento',async()=>{assert.ok(claims(j1).exp>Math.floor(Date.now()/1000));const before=await count();assert.ok([401,403,503].includes((await request(token(j1),undefined,body())).status));assert.ok([401,403,503].includes((await request(token(j1),undefined,jBody)).status));assert.equal(await count(),before);});
test('Resultado histórico confirmado permanece consultável apenas pelo titular revogado',async()=>{const r=await request(token(j1),'/lab-point/v1/intent/'+jBody.idempotency_key);assert.equal(r.status,200);assert.deepEqual(r.data.event,jEvent.data.event);assert.equal((await request(token(j1),'/lab-point/v1/intent/'+mBody.idempotency_key)).status,404);assert.equal(await count(),2);});
test('Refresh e novo login de João revogado não recuperam acesso',async()=>{assert.ok((await refresh(j1))>=400);assert.ok((await login(accounts.joao)).status>=400);});
test('Restart reaplica origem, mantém revogação e histórico sem duplicar',async()=>{await restart();assert.equal(core.authorizationSnapshot().people[accounts.joao.id].state,'REVOKED');assert.equal((await request(token(j1),'/lab-point/v1/intent/'+jBody.idempotency_key)).status,200);assert.equal(await count(),2);});
test('Origem indisponível deixa o núcleo STALE e nega marcação',async()=>{
  const normal=source.snapshot;source.snapshot=async()=>{throw Object.assign(Error('OFFLINE'),{code:'ORIGEM_INDISPONIVEL'});};
  try{await assert.rejects(core.reconcileUser(accounts.maria.id));assert.equal((await core.inspect()).reconciliation.states[accounts.maria.id],'STALE');assert.equal((await request(token(m1),undefined,body())).status,503);assert.equal(await count(),2);}finally{source.snapshot=normal;await core.reconcileAll();}
});
test('Identidade ausente na origem deixa UNKNOWN e nega marcação',async()=>{
  const normal=source.snapshot;source.snapshot=async id=>id===accounts.maria.id?null:normal(id);
  try{await assert.rejects(core.reconcileUser(accounts.maria.id),e=>e.code==='AUTORIZACAO_NAO_COMPROVADA');assert.equal((await core.inspect()).reconciliation.states[accounts.maria.id],'UNKNOWN');assert.equal((await request(token(m1),undefined,body())).status,503);assert.equal(await count(),2);}finally{source.snapshot=normal;await core.reconcileAll();}
});
test('Logout global encerra duas abas e duas sessões sem apagar histórico',async()=>{const r=await request(token(m1),'/lab-point/v1/session/global','');assert.equal(r.status,200);assert.equal(r.data.scope,'global');for(const s of [m1,m2])assert.ok([401,403].includes((await request(token(s),undefined,body())).status));assert.equal(await count(),2);});
test('Refresh antigo falha e novo login ativo só funciona após corte',async()=>{assert.ok((await refresh(m2))>=400);await new Promise(ok=>setTimeout(ok,1200));const fresh=await login(accounts.maria);assert.equal(fresh.status,200);m1=fresh.data;assert.equal((await request(token(m1))).status,200);});
test('F2E-09 reproduz pendência e recupera após Auth confirmar logout',async()=>{
  await core.logoutGlobal(accounts.maria.id);assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,true);
  assert.ok([401,503].includes((await request(token(m1),undefined,body())).status));
  await auth.signOut(token(m1),'global');await restart();
  assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,false);
  assert.equal((await core.inspect()).reconciliation.ready,true);
  assert.equal(await count(),2);
});
test('F2E-09 com Auth ainda ativo permite retry seguro do logout global',async()=>{
  await new Promise(ok=>setTimeout(ok,1200));const fresh=await login(accounts.maria);assert.equal(fresh.status,200);m1=fresh.data;
  await core.logoutGlobal(accounts.maria.id);
  const cutoff=core.authorizationSnapshot().people[accounts.maria.id].global_cutoff_sec;
  assert.ok(await source.oldSessions(accounts.maria.id,cutoff)>=1,'Sessão antiga no mesmo segundo deve contar');
  await restart();
  assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,true);
  assert.equal((await core.inspect()).reconciliation.states[accounts.maria.id],'RECONCILIATION_REQUIRED');
  assert.ok([401,503].includes((await request(token(m1),undefined,body())).status));assert.equal(await count(),2);
  const retry=await request(token(m1),'/lab-point/v1/session/global','');assert.equal(retry.status,200,JSON.stringify(retry.data));
  assert.equal((await core.reconcileUser(accounts.maria.id)).status,'IN_SYNC');
  assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,false);
});
test('Logout global só conclui após provar ausência de sessões anteriores',async()=>{
  await new Promise(ok=>setTimeout(ok,1200));const fresh=await login(accounts.maria);assert.equal(fresh.status,200);m1=fresh.data;
  const original=source.oldSessions;source.oldSessions=async()=>1;
  try{
    const response=await request(token(m1),'/lab-point/v1/session/global','');
    assert.equal(response.status,503,JSON.stringify(response.data));
    assert.equal(response.data.error,'RECUPERACAO_NECESSARIA');
    assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,true);
    assert.equal((await core.inspect()).reconciliation.states[accounts.maria.id],'RECONCILIATION_REQUIRED');
    assert.equal(await count(),2);
  }finally{source.oldSessions=original;}
  assert.equal((await core.reconcileUser(accounts.maria.id)).status,'IN_SYNC');
  assert.equal(core.authorizationSnapshot().people[accounts.maria.id].global_logout_pending,false);
});
test('Restore antigo com âncora atual não reativa identidade',async()=>{
  await new Promise(ok=>setTimeout(ok,1200));const fresh=await login(accounts.maria);assert.equal(fresh.status,200);m1=fresh.data;assert.equal((await request(token(m1),undefined,body())).status,201);assert.equal(await count(),3);
  await restoreDisposable(backupDir,restoreDir,{anchorPath:restoreAnchor,referenceAnchor:anchorPath});
  const restored=await createLabCore(restoreDir,{anchorPath:restoreAnchor,authorizationPath,source});
  try{assert.equal((await restored.inspect()).state,'RECOVERY_REQUIRED');assert.equal(restored.authorizationSnapshot().people[accounts.joao.id].state,'REVOKED');await assert.rejects(restored.record(accounts.joao.id,body(),{employeeId:accounts.joao.employeeId,session:{sessionId:claims(j1).session_id,issuedAt:claims(j1).iat}}));}finally{await restored.close();}
});
test('Sem segredos em evidência e endpoints restritos ao loopback',async()=>{assert.equal(server.server.address().address,'127.0.0.1');const text=JSON.stringify(report);assert.ok(!text.includes(token(j1))&&!text.includes(serviceKey)&&!text.includes(j1.refresh_token));});

const names=cases.map(c=>c.name);
if(process.argv.includes('--plan')){writeFileSync(planPath,JSON.stringify({declared_at:new Date().toISOString(),expected:names.length,cases:names},null,2)+'\n');console.log(JSON.stringify({declared:names.length,executed:0,sha256:sha(readFileSync(planPath))}));process.exit(0);}
const plan=JSON.parse(readFileSync(planPath,'utf8'));assert.equal(plan.expected,names.length);assert.deepEqual(plan.cases,names);report.plan_sha256=sha(readFileSync(planPath));report.expected=names.length;
try{for(const c of cases){try{await c.run();report.checks.push({name:c.name,ok:true});console.log('PASS '+c.name);}catch(e){report.checks.push({name:c.name,ok:false,error:e.code??e.message?.slice(0,140)});throw e;}}report.passed=true;}catch(e){report.error=e.code??e.message?.slice(0,140);process.exitCode=1;}
finally{if(server)try{await server.shutdown();}catch{};if(report.passed){for(const path of [directory,anchorPath,authorizationPath,backupDir,restoreDir,restoreAnchor])if(existsSync(path)){assert.ok(path.startsWith(allowed+'\\'));rmSync(path,{recursive:true,force:true});}report.disposable_removed=true;}writeFileSync(resultPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,expected:report.expected,error:report.error??null}));}
