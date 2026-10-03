// Transporte do laboratório: sockets limitados, corpo drenado, sem cache/retry.
import { Agent, request } from 'node:http';
import { performance } from 'node:perf_hooks';
const origin='http://127.0.0.1:54321';
export function createLocalTransport({telemetry,connections=16,name='local'}={}){
 if(!Number.isInteger(connections)||connections<1||connections>16)throw Error('LIMITE_LOCAL_INVALIDO');
 const agent=new Agent({keepAlive:true,maxSockets:connections,maxTotalSockets:connections,maxFreeSockets:connections});
 let closed=false,active=0,maxActive=0,maxOpenSockets=0;
 const sockets=new WeakMap();let socketSequence=0,requestSequence=0;
 async function fetcher(input,options={}){
  const url=new URL(input);if(url.origin!==origin||url.username||url.password||closed)throw Error('TRANSPORTE_LOCAL_INDISPONIVEL');
  const run=()=>new Promise((ok,fail)=>{
   const requestId=++requestSequence,started=performance.now(),endpoint=url.pathname.replace(/[a-f0-9-]{36}/ig,':id');let socketId;
   const log=(event,extra={})=>{maxOpenSockets=Math.max(maxOpenSockets,Object.values(agent.sockets).reduce((n,a)=>n+a.length,0));telemetry?.transport?.({at:new Date().toISOString(),pool:name,request_id:requestId,socket_id:socketId,operation:options.method??'GET',endpoint,event,elapsed_ms:performance.now()-started,active,queued:Object.values(agent.requests).reduce((n,a)=>n+a.length,0),...extra});};
   log('request');const req=request(url,{agent,method:options.method??'GET',headers:Object.fromEntries(new Headers(options.headers)),signal:options.signal},res=>{
    log('headers',{status:res.statusCode});
    const chunks=[];let bytes=0;res.on('data',chunk=>{bytes+=chunk.length;if(bytes>1048576)res.destroy(Error('RESPOSTA_LOCAL_EXCESSIVA'));else chunks.push(chunk);});
    res.on('error',e=>{log('response_error',{code:e.code??e.name});fail(e);});res.on('end',()=>{
     log('body_drained',{bytes});
     if(res.statusCode>=300&&res.statusCode<400){fail(Error('REDIRECIONAMENTO_LOCAL_PROIBIDO'));return;}
     ok(new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers:res.headers}));
    });
   });req.on('socket',socket=>{active++;maxActive=Math.max(active,maxActive);socketId=sockets.get(socket);if(!socketId){socketId=++socketSequence;sockets.set(socket,socketId);const id=socketId;socket.once('connect',()=>log('connected',{socket_id:id,local_port:socket.localPort,remote_port:socket.remotePort}));socket.once('close',hadError=>log('socket_closed',{socket_id:id,had_error:hadError}));}log('assigned',{reused:req.reusedSocket,connection_limit:connections});req.once('close',()=>{active--;log('request_closed');});});req.on('error',e=>{log('request_error',{code:e.code??e.name,cause_code:e.cause?.code});fail(e);});req.end(options.body);
  });
  return telemetry?.timed?telemetry.timed(url.pathname.startsWith('/auth/')?'Auth':'PostgREST',run):run();
 }
 return {fetch:fetcher,inspect:()=>({connections_limit:connections,active,max_active:maxActive,max_open_sockets:maxOpenSockets,open_sockets:Object.values(agent.sockets).reduce((n,a)=>n+a.length,0),idle_sockets:Object.values(agent.freeSockets).reduce((n,a)=>n+a.length,0),queued:Object.values(agent.requests).reduce((n,a)=>n+a.length,0),retry:false,cache:false}),close:()=>{closed=true;agent.destroy();}};
}
