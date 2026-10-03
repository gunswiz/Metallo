// Processo filho descartável: barreiras por IPC, nunca endpoints de falha/manutenção.
import { resolve } from 'node:path';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { startLabServer } from '../laboratorio-marco-2b/http-lab.mjs';
import { createLabAuth, LabError } from '../laboratorio-marco-2b/auth-local.mjs';
import { inventory } from '../laboratorio-marco-2b/integridade.mjs';
import { backupCore } from '../laboratorio-marco-2b/backup.mjs';
let core,service,config,release,dependency=true,failSignOut=false;
const send=value=>process.send?.(value);
process.on('message',async message=>{
  try{
    if(message.command==='init'){
      config=message;
      const allowed=[resolve(import.meta.dirname,'../../backups/marco-2d-ensaios'),resolve(import.meta.dirname,'../../backups/marco-2e-ensaios')];
      if(!allowed.some(dir=>resolve(config.directory).startsWith(dir+'\\')||resolve(config.directory).startsWith(dir+'/')))throw Error('DIRETORIO_FORA_DO_ENSAIO');
      try{core=await createLabCore(config.directory,{anchorPath:config.anchorPath,authorizationPath:config.authorizationPath??null});}catch{core=null;}
      const auth=config.anonKey?createLabAuth(config.anonKey,fetch,{requireSession:!!config.authorizationPath,serviceKey:config.serviceKey??null}):{
        checkDependency:async()=>dependency,
        verifyPersonal:async token=>{if(!dependency)throw new LabError(503,'LABORATORIO_INDISPONIVEL');const person=config.people[token];if(!person)throw new LabError(401,'SESSAO_INVALIDA');return person;},
      };
      if(config.authorizationPath){const realSignOut=auth.signOut.bind(auth);auth.signOut=async(...args)=>{if(failSignOut)throw new LabError(503,'ENCERRAMENTO_PENDENTE');return realSignOut(...args);};}
      service=await startLabServer({core,auth,port:0,logger:value=>send({log:value}),testHook:async phase=>{
        if(phase===config.failpoint){
          const confirmed=['after_database_commit','after_commit'].includes(phase)?await inventory(core.db):null;
          send({hook:phase,confirmed});await new Promise(ok=>{release=ok;});
        }
      }});
      send({ready:true,port:service.port,health:await service.health()});return;
    }
    if(message.command==='release'){config.failpoint=null;release?.();send({id:message.id,ok:true});return;}
    if(message.command==='set_failpoint'){config.failpoint=message.phase;send({id:message.id,ok:true});return;}
    if(message.command==='dependency'){dependency=message.available;send({id:message.id,ok:true});return;}
    if(message.command==='signout_failure'){failSignOut=!!message.enabled;send({id:message.id,ok:true});return;}
    if(message.command==='readonly'){await core.db.exec('set default_transaction_read_only=on');send({id:message.id,ok:true});return;}
    if(message.command==='snapshot'){send({id:message.id,snapshot:await inventory(core.db)});return;}
    if(message.command==='backup'){const manifest=await backupCore(core,message.directory);send({id:message.id,epoch:manifest.state.recovery_epoch,eventCount:manifest.state.event_count});return;}
    if(message.command==='authorization_snapshot'){send({id:message.id,snapshot:core.authorizationSnapshot()});return;}
    if(message.command==='authorization_state'){const version=await core.applyAuthorizationState(message.authUserId,message.state);send({id:message.id,version});return;}
    if(message.command==='shutdown'){await service.shutdown();send({id:message.id,ok:true,metrics:service.metrics});process.disconnect();return;}
  }catch(error){send({id:message.id,error:error?.code??'ENSAIO_FALHOU'});}
});
