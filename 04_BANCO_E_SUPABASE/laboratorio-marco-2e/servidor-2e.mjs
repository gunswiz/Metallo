// Serviço 2E isolado em loopback. Exige preparação explícita e não renova revogações.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { startLabServer } from '../laboratorio-marco-2b/http-lab.mjs';

const root=resolve(import.meta.dirname,'../..');
const lab=resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a');
assert.ok(!existsSync(resolve(lab,'supabase/.temp/project-ref')));
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',lab,'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const directory=resolve(root,'backups/metallo-ponto-lab-pglite-2e');
const core=await createLabCore(directory,{authorizationPath:directory+'.authorization.json'});
const auth=createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
const service=await startLabServer({core,auth,port:3104});
console.log(JSON.stringify({lab:true,code:'marco_2e_listening',url:'http://127.0.0.1:3104/health'}));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;try{await service.shutdown();process.exit(0);}catch{process.exitCode=1;}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,stop);
process.on('message',message=>{if(message?.command==='shutdown')void stop();});
