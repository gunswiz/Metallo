// Verifica o caminho do navegador: prévia local -> transporte 3101 -> API isolada (2B/2E).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const creds=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8'}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const offline=process.argv.includes('--offline');
const report={at:new Date().toISOString(),scope:offline?'Indisponibilidade isolada do núcleo local':process.env.METALLO_EVIDENCE_REVISION==='2e'?'Transporte local para o núcleo 2E; não somar ao núcleo':'Transporte local 2B pelo navegador; não somar ao núcleo',checks:[],passed:false};
function check(name,ok){report.checks.push({name,ok:Boolean(ok)});if(!ok)throw Error(name);}
async function login(account){const r=await fetch(status.API_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});assert.equal(r.status,200);return (await r.json()).access_token;}
async function call(path,token,body){const r=await fetch('http://127.0.0.1:3101/api/ponto-lab'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
try{
 if(offline){
  const joao=await login(creds.joao);
  const unavailable=await call('/events',joao);
  check('Núcleo desligado retorna indisponibilidade sem fallback',unavailable.status===503&&unavailable.data.error==='LABORATORIO_INDISPONIVEL');
  report.passed=true;
 }else{
 const joao=await login(creds.joao),maria=await login(creds.maria),key=randomUUID();
 check('Sem JWT pessoal retorna 401',(await call('/events')).status===401);
 const before=await call('/events',joao),otherBefore=await call('/events',maria);
 check('João lê histórico via transporte',before.status===200&&Array.isArray(before.data.events));
 check('Maria lê histórico via transporte',otherBefore.status===200&&Array.isArray(otherBefore.data.events));
 const created=await call('/events',joao,{contract_version:1,idempotency_key:key});
 check('João registra via transporte',created.status===201&&created.data.status==='REGISTRADO_NO_LABORATORIO');
 const same=await call('/events',joao,{contract_version:1,idempotency_key:key});
 check('Retry via transporte devolve original',same.status===200&&same.data.event.event_id===created.data.event.event_id);
 check('Maria não consulta intenção João',(await call('/intent/'+key,maria)).status===404);
 check('Body com titular escolhido é rejeitado',(await call('/events',joao,{contract_version:1,idempotency_key:randomUUID(),employee_id:creds.maria.employeeId})).status===400);
 const after=await call('/events',joao);
 check('Histórico João contém marcação nova',after.status===200&&after.data.events.some(e=>e.event_id===created.data.event.event_id));
 const otherAfter=await call('/events',maria);
 check('Histórico Maria após POST João não contém João',otherAfter.status===200&&Array.isArray(otherAfter.data.events)&&!otherAfter.data.events.some(e=>e.event_id===created.data.event.event_id));
 const mariaKey=randomUUID();
 const mariaCreated=await call('/events',maria,{contract_version:1,idempotency_key:mariaKey});
 check('Maria registra via transporte',mariaCreated.status===201&&mariaCreated.data.status==='REGISTRADO_NO_LABORATORIO');
 const mariaLatest=await call('/events',maria),joaoLatest=await call('/events',joao);
 check('Histórico Maria contém marcação própria nova',mariaLatest.status===200&&mariaLatest.data.events.some(e=>e.event_id===mariaCreated.data.event.event_id));
 check('Histórico João após POST Maria não contém Maria',joaoLatest.status===200&&Array.isArray(joaoLatest.data.events)&&!joaoLatest.data.events.some(e=>e.event_id===mariaCreated.data.event.event_id));
 check('João não consulta intenção Maria',(await call('/intent/'+mariaKey,joao)).status===404);
 report.passed=true;
 }
}catch(error){report.error=String(error?.message??error);process.exitCode=1;}finally{
 writeFileSync(new URL((process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/':process.env.METALLO_EVIDENCE_REVISION==='2d'?'../laboratorio-marco-2d/':'./')+(offline?'resultado-indisponibilidade-2b.json':'resultado-transporte-2b.json'),import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,count:report.checks.length,error:report.error??null}));
}
