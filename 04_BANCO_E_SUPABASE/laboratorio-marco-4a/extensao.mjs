// Adaptador das fronteiras record/outcome/checkpoint do núcleo 2F, sem reescrevê-lo.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const TZ='America/Fortaleza';
export function normalizeLocation(value) {
 const empty=status=>({status,latitude:null,longitude:null,accuracy_meters:null,captured_at:null,provider:'BROWSER_GEOLOCATION',mock_signal:'NOT_EXPOSED'});
 if(!value||typeof value!=='object'||Array.isArray(value))return empty('UNKNOWN');
 if(Object.keys(value).some(k=>!['status','latitude','longitude','accuracy_meters','captured_at'].includes(k)))throw new LabError(400,'PEDIDO_INVALIDO');
 if(['DENIED','UNAVAILABLE','TIMEOUT','UNKNOWN'].includes(value.status))return empty(value.status);
 // Browser não expõe sinal confiável de mock: alegação POSSIBLE_MOCK é UNKNOWN.
 if(!['AVAILABLE','LOW_ACCURACY'].includes(value.status))return empty('UNKNOWN');
 const {latitude:lat,longitude:lon,accuracy_meters:acc,captured_at:at}=value;
 if(![lat,lon,acc].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(lat)>90||Math.abs(lon)>180||acc<0||typeof at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(at)||!Number.isFinite(Date.parse(at)))return empty('UNKNOWN');
 return {...empty(acc>100?'LOW_ACCURACY':'AVAILABLE'),latitude:lat,longitude:lon,accuracy_meters:acc,captured_at:new Date(at).toISOString()};
}
const session=p=>({sessionId:p.sessionId,issuedAt:p.issuedAt});
function keyOf(body,keys){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join()!==keys.sort().join()||!uuid.test(body.idempotency_key??''))throw new LabError(400,'PEDIDO_INVALIDO');return body.idempotency_key;}
export async function installExtension(core) {
 await core.checkpoint(async db=>{const row=(await db.query("select to_regclass('lab4a.intent') as t")).rows[0];if(!row.t)await db.exec(readFileSync(new URL('./extensao.sql',import.meta.url),'utf8'));},{includeInventory:false});
}
function canonical(row){return [1,row.synthetic_sequence,row.event_id,row.auth_user_id,row.employee_id,row.idempotency_key,new Date(row.marking_at).toISOString(),new Date(row.recorded_at).toISOString(),row.timezone,row.collector,row.online,row.location,row.core_hash,row.previous_hash];}
function publicReceipt(row){return {event_id:row.event_id,synthetic_reference:`LAB-4A-${row.synthetic_sequence}`,marking_at:new Date(row.marking_at).toISOString(),recorded_at:new Date(row.recorded_at).toISOString(),timezone:row.timezone,collector:row.collector,online:true,location_status:row.location.status,accuracy_meters:row.location.accuracy_meters};}
const joined=`select r.*,i.auth_user_id,i.employee_id,i.marking_at,i.timezone,i.collector,i.online,c.location,e.payload_hash as core_hash
 from lab4a.receipt r join lab4a.intent i using(idempotency_key) join lab4a.context c using(idempotency_key) join public.lab_time_event e using(event_id)`;
// Corte completo para backup/restore; não participa do guard quente da marcação.
export async function receiptInventoryForBackup(db) {
 const present=(await db.query("select to_regclass('lab4a.receipt') as t")).rows[0].t;
 if(!present)return null;
 const receipts=(await db.query('select * from lab4a.receipt order by synthetic_sequence')).rows;
 const rows=(await db.query(joined+' order by r.synthetic_sequence')).rows;let previous=null;
 if(rows.length!==receipts.length)throw Error('BACKUP_RECIBO_ORFAO');
 for(const row of rows){if(row.previous_hash!==previous||sha(canonical(row))!==row.payload_hash)throw Error('BACKUP_RECIBO_INVALIDO');previous=row.payload_hash;}
 const sequenceName=(await db.query("select pg_get_serial_sequence('lab4a.receipt','synthetic_sequence') as name")).rows[0].name;
 if(!/^lab4a\.[a-z0-9_]+$/.test(sequenceName))throw Error('SEQUENCIA_INVALIDA');
 const sequence=(await db.query('select last_value,is_called from '+sequenceName)).rows[0];
 if(rows.length&&Number(sequence.last_value)<Number(rows.at(-1).synthetic_sequence))throw Error('BACKUP_SEQUENCIA_INVALIDA');
 return {intents:(await db.query('select * from lab4a.intent order by idempotency_key')).rows,
  contexts:(await db.query('select * from lab4a.context order by idempotency_key')).rows,receipts,sequence};
}
export function createPointExtension(core,{testHook,telemetry}={}) {
 // Estes callbacks consomem apenas db; o guard integral do núcleo é mantido.
 const checkpoint=fn=>core.checkpoint(fn,{includeInventory:false});
 // Cada fluxo possui uma admissão exclusiva no núcleo; sem fila de fluxos.
 const personal=(p,run)=>core.personalOperation(p.authUserId,p.employeeId,session(p),run);
 const within=(access,run)=>access.checkpoint(run,{includeInventory:false});
 const personalRead=(p,run)=>core.personalRead?core.personalRead(p.authUserId,p.employeeId,session(p),run):personal(p,run);
 let verifiedRevision=-1,tail=null,receiptCount=0;
 core.registerIntegrityVerifier?.((db,full,expected)=>verify(db,true,expected));
 async function verify(db,full=false,expected=core.receiptCheckpoint?.()){
  if(core.integrityMode==='incremental'&&!full&&verifiedRevision===core.integrityRevision()){
   const row=(await db.query(joined+' order by r.synthetic_sequence desc limit 1')).rows[0]??null;
   const expected=core.receiptCheckpoint();if((row?.payload_hash??null)!==(expected?.hash??null)||row&&(row.synthetic_sequence!==expected?.sequence||sha(canonical(row))!==row.payload_hash))core.incident('RECIBO_ATUAL_DIVERGENTE');tail=row;receiptCount=expected?.count??0;return [];
  }
  const rows=(await db.query(joined+' order by r.synthetic_sequence')).rows;let previous=null;
  for(const row of rows){if(row.previous_hash!==previous||sha(canonical(row))!==row.payload_hash)throw new LabError(503,'INTEGRIDADE_4A_INVALIDA');previous=row.payload_hash;}
  if(core.integrityMode==='incremental'&&expected&&(rows.length!==expected.count||(rows.at(-1)?.payload_hash??null)!==expected.hash||(rows.at(-1)?.synthetic_sequence??null)!==expected.sequence))core.incident('RECIBO_HISTORICO_DIVERGENTE');
  receiptCount=rows.length;tail=rows.at(-1)??null;verifiedRevision=core.integrityRevision?.()??0;return rows;
 }
 async function begin(p,body,access){const key=keyOf(body,['idempotency_key']);
  const result=await within(access,async db=>{await verify(db);let row=(await db.query('select * from lab4a.intent where idempotency_key=$1',[key])).rows[0];
   if(row&&(row.auth_user_id!==p.authUserId||row.employee_id!==p.employeeId))throw new LabError(409,'INTENCAO_CONFLITANTE');
   if(!row)row=(await db.query('insert into lab4a.intent(idempotency_key,auth_user_id,employee_id) values($1,$2,$3) returning *',[key,p.authUserId,p.employeeId])).rows[0];
   return {idempotency_key:key,marking_at:new Date(row.marking_at).toISOString(),timezone:TZ};});telemetry?.mark('T4_intention_validated');return result;
 }
 async function finish(p,body,authorizeCurrent,access){const key=keyOf(body,['idempotency_key','location']);const location=normalizeLocation(body.location),requestHash=sha(location);
  await within(access,async db=>{
   await verify(db);const intent=(await db.query('select * from lab4a.intent where idempotency_key=$1',[key])).rows[0];
   if(!intent||intent.auth_user_id!==p.authUserId||intent.employee_id!==p.employeeId)throw new LabError(403,'INTENCAO_NAO_AUTORIZADA');
   const prior=(await db.query('select * from lab4a.context where idempotency_key=$1',[key])).rows[0];
   if(prior&&prior.request_hash!==requestHash)throw new LabError(409,'INTENCAO_CONFLITANTE');
   const age=(await db.query('select extract(epoch from clock_timestamp()-marking_at) as age from lab4a.intent where idempotency_key=$1',[key])).rows[0].age;
   const committed=(await db.query('select event_id from public.lab_time_event where idempotency_key=$1 and auth_user_id=$2',[key,p.authUserId])).rows.length>0;
   if(!committed&&(Number(age)<0||Number(age)>120))throw new LabError(409,'INTENCAO_EXPIRADA');
   if(!prior){
    await db.query('insert into lab4a.context values($1,$2,$3)',[key,location,requestHash]);
   }
  });
  // Contexto durável antes do núcleo; mesma chave após queda/resposta perdida.
  telemetry?.mark('T4_intention_validated');
  telemetry?.mark('T5_record_queue_entered');
  const result=await access.record(p.authUserId,{contract_version:1,idempotency_key:key},{employeeId:p.employeeId,session:session(p),authorizeCurrent});
  await testHook?.('after_core_commit');
  const receipt=await finalize(access,key,result.event);
  return {event:receipt,duplicate:result.duplicate};
 }
 async function finalize(access,key,event){return within(access,async db=>{
  await verify(db);let row=(await db.query(joined+' where r.idempotency_key=$1',[key])).rows[0];if(row)return publicReceipt(row);
  await db.transaction(async tx=>{
   const base=(await tx.query('select i.*,c.location,e.server_committed_at_utc,e.payload_hash as core_hash from lab4a.intent i join lab4a.context c using(idempotency_key) join public.lab_time_event e using(idempotency_key) where i.idempotency_key=$1 and e.event_id=$2',[key,event.event_id])).rows[0];
   if(!base)throw new LabError(503,'RECIBO_INDISPONIVEL');
   const prev=(await tx.query('select payload_hash from lab4a.receipt order by synthetic_sequence desc limit 1')).rows[0]?.payload_hash??null;
   // Sequence reservada na mesma transação; sem reescrever recibos existentes.
   const seq=(await tx.query("select nextval(pg_get_serial_sequence('lab4a.receipt','synthetic_sequence')) as n")).rows[0].n;
   const record={...base,synthetic_sequence:seq,event_id:event.event_id,recorded_at:base.server_committed_at_utc,previous_hash:prev};
   await tx.query('insert into lab4a.receipt(synthetic_sequence,idempotency_key,event_id,recorded_at,previous_hash,hash_version,payload_hash) overriding system value values($1,$2,$3,$4,$5,1,$6)',[seq,key,event.event_id,record.recorded_at,prev,sha(canonical(record))]);
  });
  row=(await db.query(joined+' where r.idempotency_key=$1',[key])).rows[0];if(core.integrityMode==='incremental'){if(sha(canonical(row))!==row.payload_hash)core.incident('RECIBO_NOVO_DIVERGENTE');tail=row;receiptCount++;core.commitReceiptCheckpoint({count:receiptCount,sequence:row.synthetic_sequence,hash:row.payload_hash});verifiedRevision=core.integrityRevision();}return publicReceipt(row);
 });}
 async function outcome(p,key,access){if(!uuid.test(key))throw new LabError(400,'PEDIDO_INVALIDO');
  const event=await access.outcome(p.authUserId,p.employeeId,key,session(p));if(!event)return null;
  return finalize(access,key,event);
 }
 async function history(p,access){
  // Completar exclusivamente contextos cuja gravação 2F foi comprovada; nunca criar ponto na leitura.
  const pending=await within(access,async db=>(await db.query('select c.idempotency_key from lab4a.context c join lab4a.intent i using(idempotency_key) left join lab4a.receipt r using(idempotency_key) where i.auth_user_id=$1 and r.event_id is null',[p.authUserId])).rows);
  for(const row of pending)await outcome(p,row.idempotency_key,access);
  return within(access,async db=>{await verify(db);return (await db.query(joined+' where i.auth_user_id=$1 order by i.marking_at desc limit 50',[p.authUserId])).rows.map(publicReceipt);});
 }
 async function management(){return checkpoint(async db=>{await verify(db);return (await db.query(joined+' order by i.marking_at desc limit 100')).rows.map(row=>({...publicReceipt(row),employee_id:row.employee_id}));});}
 // A cadeia do recibo é verificada no MESMO checkpoint integral da leitura.
 // Não há cache, salto de guard ou acesso paralelo ao banco/âncora do núcleo.
 const readVerified=run=>checkpoint(async db=>{await verify(db);return run(db);});
 const readPersonal=(p,run)=>personalRead(p,access=>within(access,async db=>{await verify(db);return run(db);}));
 const clock=async db=>({server_at:new Date((await db.query('select clock_timestamp() as at')).rows[0].at).toISOString(),timezone:TZ,source:'LOCAL_SERVER',hlb_verified:false});
 return {begin:(p,body)=>personal(p,access=>begin(p,body,access)),finish:(p,body,authorizeCurrent)=>personal(p,access=>finish(p,body,authorizeCurrent,access)),outcome:(p,key)=>personal(p,access=>outcome(p,key,access)),history:p=>personal(p,access=>history(p,access)),management,
  clock:p=>p?readPersonal(p,clock):checkpoint(clock),verify:()=>checkpoint(db=>verify(db,true)),readVerified,readPersonal};
}
