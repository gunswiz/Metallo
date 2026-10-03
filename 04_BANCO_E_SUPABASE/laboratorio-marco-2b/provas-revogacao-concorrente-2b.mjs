// Interleaving controlado: revogação percebida após INSERT, antes do COMMIT.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createLabCore } from './nucleo.mjs';
import { LabError } from './auth-local.mjs';

const report={at:new Date().toISOString(),scope:'Concorrência de revogação 2B, simulada no limite da transação',checks:[],passed:false};
function check(name,ok){report.checks.push({name,ok:Boolean(ok)});if(!ok)throw Error(name);}
const core=await createLabCore(),user=randomUUID(),employee=randomUUID(),key=randomUUID();
try{
 await core.seedSynthetic({authUserId:user,employeeId:employee,workerRef:'LAB-RACE',employmentRef:'LAB-VINCULO-RACE'});
 const body={contract_version:1,idempotency_key:key};
 let rejected=false;
 try{await core.record(user,body,{employeeId:employee,authorizeCurrent:async()=>{throw new LabError(403,'CONTEXTO_INATIVO');}});}catch(error){rejected=error?.code==='CONTEXTO_INATIVO';}
 check('Revogação observada antes do commit nega evento',rejected);
 check('Revogação durante transação faz rollback completo',(await core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n===0 && (await core.db.query('select count(*)::int as n from lab_intent_result')).rows[0].n===0);
 const confirmed=await core.record(user,body,{employeeId:employee,authorizeCurrent:async()=>{}});
 check('Intenção rejeitada pode ser confirmada depois de autorização vigente',!!confirmed.event.event_id&&!confirmed.duplicate);
 await core.db.query("update lab_context set active=false,context_status='revoked' where auth_user_id=$1",[user]);
 let denied=false;try{await core.record(user,{contract_version:1,idempotency_key:randomUUID()},{employeeId:employee});}catch(error){denied=error?.code==='CONTEXTO_INATIVO';}
 check('Revogação confirmada antes do pedido nega nova intenção',denied);
 check('Original anterior à revogação preservado',(await core.db.query('select count(*)::int as n from lab_time_event')).rows[0].n===1);
 report.passed=true;
}catch(error){report.error=String(error?.message??error);process.exitCode=1;}finally{
 await core.close();
 writeFileSync(new URL(process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='4c'?'../laboratorio-marco-4c/regressoes/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/resultado-revogacao-concorrente-2b.json':process.env.METALLO_EVIDENCE_REVISION==='2d'?'../laboratorio-marco-2d/resultado-revogacao-concorrente-2b.json':'./resultado-revogacao-concorrente-2b.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,count:report.checks.length,error:report.error??null}));
}
