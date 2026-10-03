// Justiça na fronteira HTTP, sem cache ou alteração do núcleo 2F.
// O writer já é serializado. Cede uma volta do event loop entre operações
// completas para que Auth/rede/cancelamento não fiquem presos nas microtasks.
import { setImmediate } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
export function withHttpScheduling(core,{telemetry}={}){
 let queue=Promise.resolve(),depth=0;
 const schedule=(method,fn)=>{
  const entered=performance.now(),pending=++depth;telemetry?.queue({type:'enter',method});
  const task=queue.then(async()=>{await setImmediate();const start=performance.now();let failed=false;
   try{return await fn();}catch(e){failed=true;throw e;}finally{depth--;telemetry?.queue({type:'complete',method,start,wait:start-entered,depth:pending,failed});}
  });
  queue=task.then(()=>setImmediate(),()=>setImmediate());
  return task;
 };
 const methods=['personalOperation','history','record','checkpoint','inspect','context','logoutCurrent','logoutGlobal','completeGlobalLogout','retryGlobalLogout','reconcileUser','reconcileAll','close'];
 // personalRead tem admissão própria; rede fora do FIFO writer, SQL continua exclusive.
 return {...core,...Object.fromEntries(methods.filter(k=>typeof core[k]==='function').map(k=>[k,(...args)=>schedule(k,()=>core[k](...args))]))};
}
