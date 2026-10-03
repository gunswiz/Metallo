// Bootstrap explícito do banco sintético 2E. Não copia nem altera o banco 2D.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { base, anon } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';

const root=resolve(import.meta.dirname,'../..');
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
const baseline=readFileSync(resolve(root,'outputs/Metallo-Marco2D-BaselineAprovada-20260927-R1.zip'));
assert.equal(createHash('sha256').update(baseline).digest('hex'),'15d5e791c3237f8c7c98d316ddef7220c256ddc8b5b011f9c289741ab1691dd3');
assert.equal(base,'http://127.0.0.1:54321');
assert.equal(status.API_URL,base);
assert.ok(!existsSync(resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref')));
const directory=resolve(root,'backups/metallo-ponto-lab-pglite-2e');
const authorizationPath=directory+'.authorization.json';
assert.ok(!existsSync(directory)&&!existsSync(authorizationPath),'2E já preparado; startup nunca recria banco ou autorização');
const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const auth=createLabAuth(anon,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
const people=[];
for(const kind of ['joao','maria']){
  const user=saved[kind];assert.ok(user?.id&&user.employeeId&&user.email&&user.password);
  const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),signal:AbortSignal.timeout(5000)});
  assert.equal(r.status,200,'Conta sintética de prévia indisponível');
  const session=await r.json(),person=await auth.verifyPersonal(session.access_token);
  assert.equal(person.authUserId,user.id);assert.equal(person.employeeId,user.employeeId);
  people.push({kind,id:user.id,employeeId:user.employeeId});
}
const core=await createLabCore(directory,{mode:'create'});
let id;
try{
  for(const person of people)await core.seedSynthetic({authUserId:person.id,employeeId:person.employeeId,workerRef:`LAB-${person.kind.toUpperCase()}-${person.id.slice(0,8).toUpperCase()}`,employmentRef:`LAB-VINCULO-${person.kind.toUpperCase()}-${person.id.slice(0,8).toUpperCase()}`,validMinutes:1440});
  id=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;
}finally{await core.close();}
initializeAuthorization(authorizationPath,id);
const ready=await createLabCore(directory,{authorizationPath});
try{for(const person of people)await ready.registerAuthorization(person.id,person.employeeId);assert.equal((await ready.inspect()).state,'READY');}
finally{await ready.close();}
console.log(JSON.stringify({prepared:true,scope:'SIMULAÇÃO SEM VALOR OFICIAL',registered:people.length,source:'METALLO-2D-LAB-20260927-R1',remote:false}));
