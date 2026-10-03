// Superfície HTTP mínima compartilhada pelo serviço e pelos ensaios em processo separado.
import { createServer } from 'node:http';
import { LabError } from './auth-local.mjs';

export async function startLabServer({core,auth,port=3103,testHook,logger=console.log}) {
  const origin='http://127.0.0.1:3101';let accepting=true,boundPort=port,lastAuth='UNKNOWN';
  const metrics={startup_success:0,startup_failure:0,recovery_required:0,integrity_failure:0,duplicate_intent:0,retry_recovered:0,database_unavailable:0,auth_unavailable:0,graceful_shutdown:0};
  function log(code){if(code in metrics)metrics[code]++;logger(JSON.stringify({lab:true,code}));}
  function respond(res,status,payload){if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
  async function health(){
    let state=core?await core.inspect():{state:'UNAVAILABLE',database_ok:false,schema_ok:false,append_only_ok:false,recovery_state:'DATABASE_UNAVAILABLE',context_state:'UNKNOWN',ready_for_new_events:false};
    try{lastAuth=await auth.checkDependency()?'AVAILABLE':'UNAVAILABLE';}catch{lastAuth='UNAVAILABLE';}
    const ready=accepting&&state.ready_for_new_events&&lastAuth==='AVAILABLE'&&state.context_state==='AVAILABLE';
    return {status:ready?'READY':state.state==='READY'?'DEGRADED':state.state,official:false,process_online:true,
      database_ok:state.database_ok,schema_ok:state.schema_ok,append_only_ok:state.append_only_ok,recovery_state:state.recovery_state,
      auth_dependency:lastAuth,context_state:state.context_state,ready_for_new_events:ready};
  }
  function readBody(req){return new Promise((ok,fail)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1024){fail(new LabError(413,'PEDIDO_INVALIDO'));req.destroy();}});req.on('end',()=>{try{ok(JSON.parse(body));}catch{fail(new LabError(400,'PEDIDO_INVALIDO'));}});req.on('error',fail);});}
  const server=createServer(async(req,res)=>{
    try{
      if(req.headers.host!==`127.0.0.1:${boundPort}`)throw new LabError(403,'DESTINO_INVALIDO');
      if(req.url==='/health'&&req.method==='GET'){const h=await health();respond(res,h.ready_for_new_events?200:503,h);return;}
      if(req.headers.origin!==origin)throw new LabError(403,'ORIGEM_INVALIDA');
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'});res.end();return;}
      if(!accepting||!core){log('database_unavailable');throw new LabError(503,'NUCLEO_INDISPONIVEL');}
      const bearer=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
      if(!bearer)throw new LabError(401,'SESSAO_INVALIDA');
      const historic=req.url?.match(/^\/lab-point\/v1\/intent\/([0-9a-f-]{36})$/i);
      if(historic&&req.method==='GET'&&core.historicalOutcomeEnabled){
        try{
          const person=await auth.verifyPersonal(bearer);
          const session={sessionId:person.sessionId,issuedAt:person.issuedAt};
          const event=await core.outcome(person.authUserId,person.employeeId,historic[1],session);
          if(event)log('retry_recovered');
          respond(res,event?200:404,event?{status:'REGISTRADO_NO_LABORATORIO',event}:{status:'NAO_CONFIRMADO'});return;
        }catch(error){
          if(!(error instanceof LabError)||![401,403].includes(error.status))throw error;
          const signed=await auth.verifySigned(bearer);
          const event=await core.outcomeHistoric(signed.authUserId,historic[1]);
          if(event)log('retry_recovered');
          respond(res,event?200:404,event?{status:'REGISTRADO_NO_LABORATORIO',event}:{status:'NAO_CONFIRMADO'});return;
        }
      }
      const person=await auth.verifyPersonal(bearer);lastAuth='AVAILABLE';
      const session={sessionId:person.sessionId,issuedAt:person.issuedAt};
      if(req.method==='POST'&&['/lab-point/v1/session/current','/lab-point/v1/session/global'].includes(req.url)){
        if(typeof auth.signOut!=='function')throw new LabError(404,'ROTA_NAO_ENCONTRADA');
        const scope=req.url.endsWith('/global')?'global':'local';
        if(scope==='global'){
          try{await core.logoutGlobal(person.authUserId);}
          catch(error){if(!core.historicalOutcomeEnabled||error.code!=='RECUPERACAO_NECESSARIA')throw error;await core.retryGlobalLogout(person.authUserId);}
        }
        else await core.logoutCurrent(person.authUserId,person.sessionId);
        await auth.signOut(bearer,scope);
        if(scope==='global'){
          if(core.historicalOutcomeEnabled){
            const reconciled=await core.reconcileUser(person.authUserId);
            if(reconciled.status!=='IN_SYNC')throw new LabError(503,'RECUPERACAO_NECESSARIA');
          }else await core.completeGlobalLogout(person.authUserId);
        }
        respond(res,200,{status:'SESSAO_ENCERRADA',scope});return;
      }
      if(req.url==='/lab-point/v1/events'&&req.method==='POST'){
        if(req.headers['content-type']!=='application/json')throw new LabError(415,'PEDIDO_INVALIDO');
        const result=await core.record(person.authUserId,await readBody(req),{employeeId:person.employeeId,session,testHook,
          authorizeCurrent:async()=>{const current=await auth.verifyPersonal(bearer);if(current.authUserId!==person.authUserId||current.employeeId!==person.employeeId||current.sessionId!==person.sessionId)throw new LabError(403,'CONTEXTO_INATIVO');}});
        if(result.duplicate)log('duplicate_intent');
        respond(res,result.duplicate?200:201,{status:result.duplicate?'DUPLICADO':'REGISTRADO_NO_LABORATORIO',...result});return;
      }
      if(req.url==='/lab-point/v1/events'&&req.method==='GET'){respond(res,200,{events:await core.history(person.authUserId,person.employeeId,session)});return;}
      const match=req.url?.match(/^\/lab-point\/v1\/intent\/([0-9a-f-]{36})$/i);
      if(match&&req.method==='GET'){const event=await core.outcome(person.authUserId,person.employeeId,match[1],session);if(event)log('retry_recovered');respond(res,event?200:404,event?{status:'REGISTRADO_NO_LABORATORIO',event}:{status:'NAO_CONFIRMADO'});return;}
      throw new LabError(404,'ROTA_NAO_ENCONTRADA');
    }catch(error){
      const known=error instanceof LabError,code=known?error.code:'ERRO_LABORATORIO';
      if(code==='RECUPERACAO_NECESSARIA')log('recovery_required');
      else if(code==='LABORATORIO_INDISPONIVEL'){lastAuth='UNAVAILABLE';log('auth_unavailable');}
      else if(!known)log('database_unavailable');
      if(!res.headersSent)respond(res,known?error.status:503,{error:code});
    }
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok);});boundPort=server.address().port;
  const initial=core?await core.inspect():null;
  log(initial?.ready_for_new_events?'startup_success':'startup_failure');
  if(initial?.state==='RECOVERY_REQUIRED')log('recovery_required');
  if(initial?.reasons.length)log('integrity_failure');
  async function shutdown(){
    accepting=false;
    const closed=new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));server.closeIdleConnections();
    let timer;
    try{await Promise.race([closed,new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('SHUTDOWN_TIMEOUT')),10000);})]);if(core)await core.close();log('graceful_shutdown');}
    finally{clearTimeout(timer);}
  }
  return {server,port:boundPort,health,shutdown,metrics};
}
