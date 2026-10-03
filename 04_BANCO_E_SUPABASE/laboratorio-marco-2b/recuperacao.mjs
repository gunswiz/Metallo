// Âncora técnica local sem identidade/token. Não é assinatura nem proteção contra o dono do host.
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { eventDigest } from './integridade.mjs';

export function atomicJson(path, value) {
  mkdirSync(dirname(path), {recursive:true});
  const temporary = `${path}.${randomUUID()}.pending`;
  const fd = openSync(temporary,'wx');
  try { writeFileSync(fd,JSON.stringify(value,null,2)+'\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary,path);
  // Persistência de rename/diretório depende do Windows/filesystem; não é prova de queda de energia.
}
export function acquireLabLock(dataDir) {
  const path = `${resolve(dataDir)}.lock`;
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path,'utf8'));
    if (!Number.isInteger(old.pid) || old.pid <= 0) throw Error('LOCK_INVALIDO');
    try { process.kill(old.pid,0); throw Error('BANCO_EM_USO'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(path); // Somente o lock exato cujo processo foi comprovadamente encerrado.
  }
  mkdirSync(dirname(path),{recursive:true});
  const token=randomUUID(); writeFileSync(path,JSON.stringify({pid:process.pid,token}),{flag:'wx'});
  return () => { if (existsSync(path) && JSON.parse(readFileSync(path,'utf8')).token === token) unlinkSync(path); };
}
export function stateOf(snapshot) {
  const meta = snapshot.metadata[0];
  return {database_id:meta.database_id,recovery_epoch:meta.recovery_epoch,event_count:snapshot.events.length,digest:eventDigest(snapshot)};
}
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function readAnchor(path) {
  const anchor=JSON.parse(readFileSync(path,'utf8'));
  const validState = state => state && Object.keys(state).sort().join() === 'database_id,digest,event_count,recovery_epoch' && /^[\da-f-]{36}$/.test(state.database_id) && /^[\da-f]{64}$/.test(state.digest) && Number.isSafeInteger(state.recovery_epoch) && state.recovery_epoch>=0 && Number.isSafeInteger(state.event_count) && state.event_count>=0;
  if (Object.keys(anchor).sort().join()!=='committed,format_version,pending' || anchor.format_version!==1 || !validState(anchor.committed) || (anchor.pending && (!validState(anchor.pending) || anchor.pending.database_id!==anchor.committed.database_id || anchor.pending.recovery_epoch!==anchor.committed.recovery_epoch+1 || anchor.pending.event_count!==anchor.committed.event_count+1))) throw Error('ANCORA_INVALIDA');
  return anchor;
}
export function compareAnchor(anchor, state) {
  if (equal(anchor.committed,state)) return anchor.pending ? 'ABORTED_PENDING' : 'MATCH';
  if (anchor.pending && equal(anchor.pending,state)) return 'COMMITTED_PENDING';
  return 'DIVERGENT';
}
export function recoverAnchor(path,state,{readOnly=false}={}) {
  const anchor=readAnchor(path),comparison=compareAnchor(anchor,state);
  if (comparison==='DIVERGENT') return {ok:false,comparison,expected_epoch:anchor.committed.recovery_epoch,observed_epoch:state.recovery_epoch,expected_count:anchor.committed.event_count,observed_count:state.event_count};
  if (comparison!=='MATCH' && !readOnly) atomicJson(path,{format_version:1,committed:state,pending:null});
  return {ok:true,comparison};
}
export function initializeAnchor(path,state) {
  if (existsSync(path)) throw Error('ANCORA_JA_EXISTE');
  atomicJson(path,{format_version:1,committed:state,pending:null});
}
export function prepareAnchor(path,before,after) {
  const anchor=readAnchor(path);
  if (compareAnchor(anchor,before)!=='MATCH') throw Error('RECUPERACAO_NECESSARIA');
  atomicJson(path,{format_version:1,committed:before,pending:after});
}
export function finishAnchor(path,state) { atomicJson(path,{format_version:1,committed:state,pending:null}); }
