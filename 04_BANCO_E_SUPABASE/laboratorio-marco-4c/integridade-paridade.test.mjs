// Compara o verificador otimizado com os bytes da baseline aprovada e exerce
// adulterações reais em banco efêmero. Nenhum dado/token de Auth é necessário.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash,randomUUID } from 'node:crypto';
import { unzipSync } from '../../01_WEB/node_modules/fflate/esm/index.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
import { installExtension,createPointExtension } from '../laboratorio-marco-4a/extensao.mjs';

const bytes=readFileSync(new URL('../../outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'2ff3076d3a9bee5b33a363ae4264dde392bce7f4662273309b5a5085726c3c71');
const files=unzipSync(bytes),name=Object.keys(files).find(p=>p.endsWith('laboratorio-marco-2b/integridade.mjs'));
assert.ok(name,'Verificador original na baseline');
const original=await import('data:text/javascript;base64,'+Buffer.from(files[name]).toString('base64'));
const core=await createLabCore();
const owner=randomUUID(),employee=randomUUID();
await core.seedSynthetic({authUserId:owner,employeeId:employee,workerRef:'LAB-4C-PARIDADE',employmentRef:'LAB-4C-VINCULO'});
await core.record(owner,{contract_version:1,idempotency_key:randomUUID()},{employeeId:employee});

function view(mutate){return {query:async(...args)=>{
 const value=await core.db.query(...args),copy=structuredClone(value);
 mutate(args[0],copy.rows);return copy;
}};}
const cases=[
 ['íntegro',()=>{},null],
 ['hash adulterado',(s,r)=>{if(s.startsWith('select * from lab_time_event'))r[0].payload_hash='0'.repeat(64);},'HASH_DIVERGENTE'],
 ['versão de hash',(s,r)=>{if(s.startsWith('select * from lab_time_event'))r[0].hash_version=9;},'HASH_VERSION_OU_TIMESTAMP'],
 ['horário inválido',(s,r)=>{if(s.startsWith('select * from lab_time_event'))r[0].created_at='invalid';},'TIMESTAMP_INVALIDO'],
 ['contrato inválido',(s,r)=>{if(s.startsWith('select * from lab_time_event'))r[0].channel='other';},'CONTRATO_EVENTO'],
 ['contexto ausente',(s,r)=>{if(s.startsWith('select * from lab_context'))r.length=0;},'CONTEXTO_ORFAO'],
 ['resultado ausente',(s,r)=>{if(s.startsWith('select * from lab_intent_result'))r.length=0;},'RESULTADO_INCOERENTE'],
 ['resultado de outra pessoa',(s,r)=>{if(s.startsWith('select * from lab_intent_result'))r[0].auth_user_id=randomUUID();},'RESULTADO_INCOERENTE'],
 ['request_hash alterado',(s,r)=>{if(s.startsWith('select * from lab_intent_result'))r[0].request_hash='0'.repeat(64);},'RESULTADO_INCOERENTE'],
 ['resultado duplicado',(s,r)=>{if(s.startsWith('select * from lab_intent_result'))r.push({...r[0]});},'RESULTADO_INCOERENTE'],
 ['original duplicado',(s,r)=>{if(s.startsWith('select * from lab_time_event'))r.push({...r[0]});},'CHAVE_DUPLICADA'],
 ['resultado órfão',(s,r)=>{if(s.startsWith('select * from lab_intent_result'))r[0].event_id=randomUUID();},'RESULTADO_ORFAO'],
 ['geração inválida',(s,r)=>{if(s.startsWith('select * from lab_recovery_state'))r[0].recovery_epoch=-1;},'SCHEMA_VERSION_OU_GERACAO'],
 ['precisão sub-ms',(s,r)=>{if(s.includes("date_trunc('milliseconds'"))r[0].n=1;},'TIMESTAMP_PRECISAO_NAO_SUPORTADA'],
 ['trigger alterado',(s,r)=>{if(s.includes('from pg_trigger'))r[0].tgenabled='D';},'APPEND_ONLY_INVALIDO'],
 ['constraint ausente',(s,r)=>{if(s.includes('from pg_constraint'))r.length=0;},'SCHEMA_CONSTRAINTS'],
 ['coluna anulável',(s,r)=>{if(s.includes('information_schema.columns'))r[0].is_nullable='YES';},'SCHEMA_COLUNAS'],
 ['tipo alterado',(s,r)=>{if(s.includes('information_schema.columns'))r[0].data_type='bytea';},'SCHEMA_TIPOS'],
];
try{
 for(const [label,mutate,reason] of cases)await test('Paridade baseline 4B: '+label,async()=>{
  // Materializar a mesma visão uma vez: IDs sintéticos mutados devem ser iguais.
  const responses=new Map();
  const db={query:async sql=>{if(!responses.has(sql))responses.set(sql,await view(mutate).query(sql));return structuredClone(responses.get(sql));}};
  const before=await original.verifyIntegrity(db),after=await verifyIntegrity(db);
  assert.deepEqual(after,before);if(reason)assert.ok(after.reasons.includes(reason));else assert.equal(after.passed,true);
 });
 await test('Checkpoint padrão conserva snapshot; opt-out omite somente snapshot adicional',async()=>{
  const standard=await core.checkpoint((db,snapshot)=>snapshot);
  assert.equal(standard.events.length,1);
  assert.equal(await core.checkpoint((db,snapshot)=>snapshot,{includeInventory:false}),undefined);
 });
 await test('Checkpoint sem snapshot detecta adulteração real e não reutiliza PASS anterior',async()=>{
  await core.checkpoint(()=>true,{includeInventory:false});
  await core.db.query("update lab_intent_result set request_hash=$1",['0'.repeat(64)]);
  assert.equal((await verifyIntegrity(core.db)).passed,false);
  await assert.rejects(core.checkpoint(()=>assert.fail('Callback não pode rodar'),{includeInventory:false}),e=>e.status===503);
  await core.db.query('update lab_intent_result set request_hash=$1',[original.sha256(JSON.stringify([1]))]);
  assert.equal(await core.checkpoint(()=>true,{includeInventory:false}),true);
 });
 await test('Trigger desativado realmente fecha o guard otimizado',async()=>{
  await core.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');
  await assert.rejects(core.checkpoint(()=>assert.fail('Guard aberto'),{includeInventory:false}),e=>e.status===503);
  await core.db.exec('alter table lab_time_event enable trigger lab_event_no_update_delete');
  assert.equal((await core.inspect()).ready_for_new_events,true);
 });
 await installExtension(core);
 const point=createPointExtension(core),person={authUserId:owner,employeeId:employee},key=randomUUID();
 await point.begin(person,{idempotency_key:key});await point.finish(person,{idempotency_key:key,location:{status:'DENIED'}});
 await test('Leitura agregada verifica cadeia antes do callback; adulteração de recibo fecha acesso',async()=>{
  assert.equal(await point.readVerified(async db=>(await db.query('select count(*)::int as n from lab4a.receipt')).rows[0].n),1);
  await core.db.exec('alter table lab4a.receipt disable trigger all');
  const old=(await core.db.query('select payload_hash from lab4a.receipt')).rows[0].payload_hash;
  try{await core.db.query('update lab4a.receipt set payload_hash=$1',['0'.repeat(64)]);
   await assert.rejects(point.readVerified(()=>assert.fail('Não liberar dado adulterado')),e=>e.status===503&&e.code==='INTEGRIDADE_4A_INVALIDA');
  }finally{await core.db.query('update lab4a.receipt set payload_hash=$1',[old]);await core.db.exec('alter table lab4a.receipt enable trigger all');}
 });
 await test('Leitura agregada mantém guard integral do núcleo, sem PASS reutilizado',async()=>{
  await point.readVerified(()=>true);
  await core.db.exec('alter table lab_time_event disable trigger lab_event_no_update_delete');
  try{await assert.rejects(point.readVerified(()=>assert.fail('Guard aberto')),e=>e.status===503);}
  finally{await core.db.exec('alter table lab_time_event enable trigger lab_event_no_update_delete');}
  assert.equal(await point.readVerified(()=>true),true);
 });
}finally{await core.close();}
