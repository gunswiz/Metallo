// Ponte estritamente local 2F: audit imutável da origem -> registro externo ao PGlite.
// Estado verificado é volátil: restart exige leitura nova da origem antes de marcar.
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';

const origin='http://127.0.0.1:54321';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createLocalSource(serviceKey,fetcher=fetch){
  if(!serviceKey)throw Error('FONTE_LOCAL_AUSENTE');
  async function rpc(name,body){
    let response;
    try{response=await fetcher(`${origin}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});}catch{throw new LabError(503,'ORIGEM_INDISPONIVEL');}
    if(!response.ok)throw new LabError(503,'ORIGEM_INDISPONIVEL');
    try{return await response.json();}catch{throw new LabError(503,'ORIGEM_INDISPONIVEL');}
  }
  return {
    snapshot:id=>rpc('lab_authz_source_2f',{p_auth_user_id:id}),
    oldSessions:(id,cutoff)=>rpc('lab_sessions_before_cutoff_2f',{p_auth_user_id:id,p_cutoff_sec:cutoff})
  };
}

export function createReconciler(ledger,source){
  const observations=new Map();
  const known=()=>Object.keys(ledger.inspect().people);
  async function one(id){
    if(!uuid.test(id)||!known().includes(id))throw new LabError(503,'AUTORIZACAO_NAO_COMPROVADA');
    observations.set(id,'UNKNOWN');
    try{
      const snapshot=await source.snapshot(id);
      if(!snapshot){observations.set(id,'UNKNOWN');throw new LabError(503,'AUTORIZACAO_NAO_COMPROVADA');}
      const beforeVersion=ledger.inspect().people[id].source_version??0;
      const applied=ledger.applySourceSnapshot(id,snapshot);
      const person=ledger.inspect().people[id];
      if(person.global_logout_pending&&person.state==='ACTIVE'){
        const remaining=await source.oldSessions(id,person.global_cutoff_sec);
        if(!Number.isSafeInteger(remaining)||remaining<0)throw new LabError(503,'RECONCILIACAO_NECESSARIA');
        if(remaining===0&&person.state==='ACTIVE')ledger.completeGlobalLogout(id);
      }
      const final=ledger.inspect().people[id];
      const status=final.state==='REVOKED'?'REVOKED':final.global_logout_pending?'RECONCILIATION_REQUIRED':applied.status;
      observations.set(id,status);
      return {status,sourceVersion:applied.version,nucleusVersion:ledger.inspect().people[id].source_version,beforeVersion,lagDetected:applied.version>beforeVersion,authorizationVersion:ledger.inspect().people[id].authorization_version};
    }catch(error){
      const status=error.code==='ORIGEM_ANTERIOR'?'AHEAD_INVALID':error.code==='ORIGEM_INDISPONIVEL'?'STALE':error.code==='RECONCILIACAO_NECESSARIA'?'RECOVERY_REQUIRED':'UNKNOWN';
      observations.set(id,status);
      throw error;
    }
  }
  async function all(){const result={};for(const id of known())try{result[id]=await one(id);}catch{result[id]={status:observations.get(id)};}return result;}
  function inspect(){const people=known();const states=Object.fromEntries(people.map(id=>[id,observations.get(id)??'UNKNOWN']));return {ready:people.length>0&&people.every(id=>['IN_SYNC','REVOKED'].includes(states[id])),states};}
  return {one,all,inspect};
}
