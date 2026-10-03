// Bootstrap do serviço local; toda criação/adopção de banco é uma operação explícita separada.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabAuth } from './auth-local.mjs';
import { createLabCore } from './nucleo.mjs';
import { startLabServer } from './http-lab.mjs';

const root=resolve(import.meta.dirname,'../..');
const lab=resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a');
assert.ok(!existsSync(resolve(lab,'supabase/.temp/project-ref')),'Auth laboratório vinculado a projeto remoto');
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',lab,'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const auth=createLabAuth(status.ANON_KEY);
const credentials=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const directory=resolve(root,'backups/metallo-ponto-lab-pglite-2d');
let core;
try{core=await createLabCore(directory);}catch{console.warn(JSON.stringify({lab:true,code:'startup_failure'}));}
if(core&&(await core.inspect()).ready_for_new_events){
  for(const kind of ['joao','maria','expira']){
    const user=credentials[kind];
    try{
      assert.ok(user?.id&&user?.employeeId);
      const login=await fetch(status.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!login.ok)continue; // Conta revogada não é reativada pelo startup.
      const session=await login.json(),person=await auth.verifyPersonal(session.access_token);
      assert.equal(person.authUserId,user.id);assert.equal(person.employeeId,user.employeeId);
      await core.seedSynthetic({authUserId:user.id,employeeId:user.employeeId,workerRef:`LAB-${kind.toUpperCase()}-${user.id.slice(0,8).toUpperCase()}`,employmentRef:`LAB-VINCULO-${kind.toUpperCase()}-${user.id.slice(0,8).toUpperCase()}`,validMinutes:1440});
    }catch{console.warn(JSON.stringify({lab:true,code:'context_sync_unavailable'}));}
  }
}
const service=await startLabServer({core,auth});
console.log('Metallo Ponto LAB: http://127.0.0.1:3103/health');
let stopping=false;
async function stop(){if(stopping)return;stopping=true;try{await service.shutdown();process.exit(0);}catch{console.error(JSON.stringify({lab:true,code:'shutdown_timeout'}));process.exitCode=1;}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
// IPC só é possível para o processo pai local; não existe rota HTTP de manutenção.
process.on('message',message=>{if(message?.command==='shutdown')void stop();});
