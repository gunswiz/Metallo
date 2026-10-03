// Cria um núcleo 2F próprio, sem copiar nem alterar o diretório/baseline 2E.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLocalSource } from './reconciliacao.mjs';
import { base, anon } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';

const root=resolve(import.meta.dirname,'../..');
const directory=resolve(root,'backups/metallo-ponto-lab-pglite-2f'),authorizationPath=directory+'.authorization.json';
assert.ok(!existsSync(directory)&&!existsSync(authorizationPath),'2F já preparado; nunca sobrescrever');
assert.equal(base,'http://127.0.0.1:54321');
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
assert.equal(status.API_URL,base);
const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const source=createLocalSource(status.SERVICE_ROLE_KEY),auth=createLabAuth(anon,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
const people=[];
for(const kind of ['joao','maria']){
  const user=saved[kind];assert.ok(user?.id&&user.employeeId&&user.email&&user.password);
  const snapshot=await source.snapshot(user.id);assert.equal(snapshot?.state,'ACTIVE');assert.equal(snapshot.employee_id,user.employeeId);
  const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200);const session=await r.json(),person=await auth.verifyPersonal(session.access_token);
  assert.equal(person.authUserId,user.id);people.push({kind,id:user.id,employeeId:user.employeeId});
}
let core=await createLabCore(directory,{mode:'create'});let databaseId;
try{for(const p of people)await core.seedSynthetic({authUserId:p.id,employeeId:p.employeeId,workerRef:`LAB-${p.kind.toUpperCase()}-${p.id.slice(0,8).toUpperCase()}`,employmentRef:`LAB-VINCULO-${p.kind.toUpperCase()}-${p.id.slice(0,8).toUpperCase()}`,validMinutes:1440});databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;}
finally{await core.close();}
initializeAuthorization(authorizationPath,databaseId);
core=await createLabCore(directory,{authorizationPath});try{for(const p of people)await core.registerAuthorization(p.id,p.employeeId);}finally{await core.close();}
core=await createLabCore(directory,{authorizationPath,source});try{assert.equal((await core.inspect()).reconciliation.ready,true);}finally{await core.close();}
console.log(JSON.stringify({prepared:true,scope:'SIMULAÇÃO SEM VALOR OFICIAL',people:people.length,remote:false}));
