// Autoridade de corte do núcleo sintético 2E. Arquivo fora do PGlite restaurável.
// Não contém JWT, refresh token, senha ou chave. Não protege contra o dono do host.
import { existsSync, readFileSync } from 'node:fs';
import { atomicJson } from './recuperacao.mjs';
import { LabError } from './auth-local.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const states=new Set(['ACTIVE','STALE','REVOKED','SUSPENDED','UNKNOWN']);

export function initializeAuthorization(path,databaseId) {
  if(existsSync(path))throw Error('AUTORIZACAO_JA_EXISTE');
  if(!uuid.test(databaseId))throw Error('BANCO_INVALIDO');
  atomicJson(path,{format_version:1,database_id:databaseId,people:{}});
}

export function createAuthorization(path,databaseId,{requireSource=false}={}) {
  if(!path||!existsSync(path))throw Error('AUTORIZACAO_AUSENTE');
  function read() {
    let data;
    try{data=JSON.parse(readFileSync(path,'utf8'));}catch{throw Error('AUTORIZACAO_INVALIDA');}
    if(data.format_version!==1||data.database_id!==databaseId||!data.people||typeof data.people!=='object'||Array.isArray(data.people))throw Error('AUTORIZACAO_DIVERGENTE');
    for(const [id,p] of Object.entries(data.people)){
      if(!uuid.test(id)||!uuid.test(p.employee_id)||!Number.isSafeInteger(p.authorization_version)||p.authorization_version<1||!states.has(p.state)||!Number.isSafeInteger(p.global_cutoff_sec)||p.global_cutoff_sec<0||(p.global_logout_pending!==undefined&&typeof p.global_logout_pending!=='boolean')||!Array.isArray(p.blocked_sessions)||p.blocked_sessions.some(s=>!uuid.test(s))||new Set(p.blocked_sessions).size!==p.blocked_sessions.length||
        (p.source_version!==undefined&&(!Number.isSafeInteger(p.source_version)||p.source_version<0||!Array.isArray(p.source_events)||p.source_events.length!==p.source_version||p.source_events.some(e=>!uuid.test(e))||new Set(p.source_events).size!==p.source_events.length)))throw Error('AUTORIZACAO_INVALIDA');
    }
    return data;
  }
  function change(id,fn){const data=read(),current=data.people[id];const next=fn(current);if(current&&next.authorization_version<=current.authorization_version)throw Error('VERSAO_NAO_MONOTONICA');data.people[id]=next;atomicJson(path,data);return next.authorization_version;}
  return {
    inspect:read,
    register(id,employeeId){
      if(!uuid.test(id)||!uuid.test(employeeId))throw Error('TITULAR_INVALIDO');
      return change(id,current=>{
        if(current)throw Error('TITULAR_JA_REGISTRADO');
        return {employee_id:employeeId,authorization_version:1,state:'ACTIVE',global_cutoff_sec:0,global_logout_pending:false,blocked_sessions:[]};
      });
    },
    authorize({authUserId,employeeId,sessionId,issuedAt}){
      const person=read().people[authUserId];
      if(!person||person.employee_id!==employeeId||person.state==='UNKNOWN'||person.state==='STALE'||(requireSource&&!person.source_version))throw new LabError(503,'AUTORIZACAO_NAO_COMPROVADA');
      if(person.state==='REVOKED')throw new LabError(403,'ACESSO_REVOGADO');
      if(person.state==='SUSPENDED')throw new LabError(403,'ACESSO_SUSPENSO');
      if(person.global_logout_pending)throw new LabError(401,'SESSAO_ENCERRADA');
      if(!uuid.test(sessionId??'')||!Number.isSafeInteger(issuedAt)||issuedAt<=0)throw new LabError(401,'SESSAO_INVALIDA');
      if(person.blocked_sessions.includes(sessionId)||issuedAt<=person.global_cutoff_sec)throw new LabError(401,'SESSAO_ENCERRADA');
      return person.authorization_version;
    },
    setState(id,state){if(!states.has(state)||state==='ACTIVE')throw Error('ESTADO_INVALIDO');return change(id,current=>{
      if(!current)throw Error('TITULAR_AUSENTE');
      return {...current,authorization_version:current.authorization_version+1,state};
    });},
    logoutCurrent(id,sessionId){if(!uuid.test(sessionId))throw Error('SESSAO_INVALIDA');return change(id,current=>{
      if(!current||current.state!=='ACTIVE')throw Error('TITULAR_INATIVO');
      if(current.blocked_sessions.includes(sessionId))throw Error('SESSAO_JA_ENCERRADA');
      return {...current,authorization_version:current.authorization_version+1,blocked_sessions:[...current.blocked_sessions,sessionId]};
    });},
    logoutGlobal(id){return change(id,current=>{
      if(!current||current.state!=='ACTIVE')throw Error('TITULAR_INATIVO');
      return {...current,authorization_version:current.authorization_version+1,global_cutoff_sec:Math.max(current.global_cutoff_sec,Math.floor(Date.now()/1000)),global_logout_pending:true};
    });},
    completeGlobalLogout(id){return change(id,current=>{
      if(!current||current.state!=='ACTIVE'||!current.global_logout_pending)throw Error('ENCERRAMENTO_NAO_PENDENTE');
      return {...current,authorization_version:current.authorization_version+1,global_logout_pending:false};
    });},
    applySourceSnapshot(id,snapshot){
      const data=read(),current=data.people[id];
      if(!current||!snapshot||snapshot.auth_user_id!==id||snapshot.employee_id!==current.employee_id||!['ACTIVE','REVOKED'].includes(snapshot.state)||!Array.isArray(snapshot.events)||snapshot.events.length<1||snapshot.events.length>2)throw new LabError(503,'RECONCILIACAO_NECESSARIA');
      const prior=current.source_events??[];
      if(snapshot.events.length<prior.length)throw new LabError(503,'ORIGEM_ANTERIOR');
      let last='ACTIVE';
      for(let n=0;n<snapshot.events.length;n++){
        const e=snapshot.events[n];
        if(!e||!uuid.test(e.event_id??'')||e.version!==n+1||e.auth_user_id!==id||e.employee_id!==current.employee_id||!['ACTIVE','REVOKED'].includes(e.state)||
          (n===0&&e.state!=='ACTIVE')||(n===1&&e.state!=='REVOKED')||(n<prior.length&&prior[n]!==e.event_id))throw new LabError(503,'RECONCILIACAO_NECESSARIA');
        last=e.state;
      }
      if(last!==snapshot.state||current.state==='REVOKED'&&last!=='REVOKED')throw new LabError(503,'RECONCILIACAO_NECESSARIA');
      if(snapshot.events.length===prior.length){
        if(current.state!==last)throw new LabError(503,'RECONCILIACAO_NECESSARIA');
        return {status:last==='REVOKED'?'REVOKED':'IN_SYNC',version:prior.length,authorizationVersion:current.authorization_version};
      }
      const next={...current,source_version:snapshot.events.length,source_events:snapshot.events.map(e=>e.event_id),state:last,authorization_version:current.authorization_version+snapshot.events.length-prior.length};
      data.people[id]=next;atomicJson(path,data);
      return {status:last==='REVOKED'?'REVOKED':'IN_SYNC',version:next.source_version,authorizationVersion:next.authorization_version};
    }
  };
}
