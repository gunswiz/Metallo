// Montagem vigente do laboratório: mesma arquitetura aprovada na Rodada 6.
// Sem seleção por rodada. Credenciais recebidas somente em memória.
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { createLocalTransport } from './transporte-local.mjs';

export function createCurrentResources({anonKey,serviceKey,telemetry}) {
 const pools=Object.fromEntries(['auth_write','auth_read','source_write','source_read'].map(name=>[name,createLocalTransport({connections:8,name,telemetry})]));
 const transport={inspect:()=>Object.fromEntries(Object.entries(pools).map(([name,pool])=>[name,pool.inspect()])),close:()=>Object.values(pools).forEach(pool=>pool.close())};
 const auth=createLabAuth(anonKey,pools.auth_write.fetch,{requireSession:true,serviceKey});
 auth.read=createLabAuth(anonKey,pools.auth_read.fetch,{requireSession:true,serviceKey});
 const source=createLocalSource(serviceKey,pools.source_write.fetch),readSource=createLocalSource(serviceKey,pools.source_read.fetch);
 async function openCore(directory,options={}) {
  try {
   const core=await createLabCore(directory,{...options,source,readSource,telemetry,integrityMode:'incremental'});
   const close=core.close;core.close=async()=>{try{await close();}finally{transport.close();}};
   return core;
  } catch(error) {transport.close();throw error;}
 }
 return {auth,transport,openCore};
}
