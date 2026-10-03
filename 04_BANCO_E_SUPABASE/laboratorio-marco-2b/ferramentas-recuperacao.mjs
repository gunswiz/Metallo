// Operações técnicas explícitas. O verificador não repara dados nem executa schema.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { verifyIntegrity } from './integridade.mjs';
import { acquireLabLock, initializeAnchor, recoverAnchor, stateOf } from './recuperacao.mjs';

export async function verifyDirectory(dataDir,anchorPath){
  if(!existsSync(resolve(dataDir,'PG_VERSION')))return {status:'FAIL',passed:false,reasons:['BANCO_EXISTENTE_AUSENTE']};
  const unlock=acquireLabLock(dataDir);let db;
  try{
    db=new PGlite(dataDir);await db.waitReady;
    await db.exec('set default_transaction_read_only=on');
    const result=await verifyIntegrity(db);let anchor={ok:false,comparison:'MISSING_OR_INVALID'};
    if(result.passed)try{anchor=recoverAnchor(anchorPath,stateOf(result.snapshot),{readOnly:true});}catch{}
    const passed=result.passed&&anchor.ok&&anchor.comparison==='MATCH';
    return {status:passed?'PASS':'FAIL',passed,reasons:[...result.reasons,...(!anchor.ok||anchor.comparison!=='MATCH'?['ANCORA_OU_RECUPERACAO_INVALIDA']:[])],
      event_count:result.event_count,digest:result.digest,anchor,logical_read_only:true};
  }finally{if(db)await db.close();unlock();}
}
export async function adoptLegacyCopy(dataDir,anchorPath){
  // Exige nome de cópia 2D em backups, nunca o banco original 2B.
  const root=resolve(import.meta.dirname,'../../backups'),path=resolve(dataDir);
  if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error('ADOPCAO_FORA_DE_BACKUPS');
  if(!path.includes('2d')||!existsSync(resolve(path,'PG_VERSION'))||existsSync(anchorPath))throw Error('ADOPCAO_DESTINO_INVALIDO');
  const unlock=acquireLabLock(path);let db;
  try{
    db=new PGlite(path);await db.waitReady;
    const before=await verifyIntegrity(db,{legacy:true});if(!before.passed)throw Error('LEGADO_INVALIDO:'+before.reasons.join(','));
    await db.transaction(async tx=>{
      await tx.exec('alter table lab_time_event add column hash_version integer not null default 1 check (hash_version=1)');
      await tx.exec('create table lab_recovery_state(singleton boolean primary key check(singleton),schema_version integer not null check(schema_version=2),database_id uuid not null,recovery_epoch integer not null check(recovery_epoch>=0))');
      await tx.query('insert into lab_recovery_state values(true,2,$1,0)',[randomUUID()]);
    });
    const after=await verifyIntegrity(db);if(!after.passed)throw Error('ADOPCAO_VERIFICACAO_INVALIDA');
    const oldEvents=after.snapshot.events.map(({hash_version,...event})=>event);
    if(JSON.stringify(oldEvents)!==JSON.stringify(before.snapshot.events)||JSON.stringify(after.snapshot.results)!==JSON.stringify(before.snapshot.results))throw Error('LEGADO_ALTERADO');
    await db.syncToFs(false);initializeAnchor(anchorPath,stateOf(after.snapshot));
    return {passed:true,event_count:after.event_count,old_event_hashes_preserved:true,explicit_adoption:true};
  }finally{if(db)await db.close();unlock();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [action,dataDir,anchorPath]=process.argv.slice(2);
  if(!dataDir||!anchorPath||!['verificar','adotar-copia-legada'].includes(action))throw Error('Uso: verificar|adotar-copia-legada DIRETORIO ANCORA');
  const result=await(action==='verificar'?verifyDirectory(dataDir,anchorPath):adoptLegacyCopy(dataDir,anchorPath));
  console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}
