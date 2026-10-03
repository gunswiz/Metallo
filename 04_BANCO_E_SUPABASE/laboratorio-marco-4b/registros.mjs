// Camada de leitura do MESMO núcleo 4A/2F. Não executa DDL nem escreve eventos.
import { LabError } from '../laboratorio-marco-2b/auth-local.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
const iso=value=>new Date(value).toISOString();
const from=`from public.lab_time_event e
 left join lab4a.receipt r on r.event_id=e.event_id
 left join lab4a.intent i on i.idempotency_key=e.idempotency_key and i.auth_user_id=e.auth_user_id`;
const fields=`e.event_id,e.server_received_at_utc,e.server_committed_at_utc,
 r.synthetic_sequence,r.recorded_at,i.marking_at,i.timezone`;
const instant='coalesce(i.marking_at,e.server_received_at_utc)';
function dto(row){
 return {event_id:row.event_id,reference:row.synthetic_sequence?`LAB-4A-${row.synthetic_sequence}`:`LAB-LEGADO-${row.event_id}`,
 marking_at:iso(row.marking_at??row.server_received_at_utc),recorded_at:iso(row.recorded_at??row.server_committed_at_utc),
 timezone:row.timezone??'America/Fortaleza',historical_data:'LIMITED',source:row.synthetic_sequence?'4A':'LEGACY'};
}
function filter(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['period','from','to','offset'].includes(k)))throw new LabError(400,'PEDIDO_INVALIDO');
 if(!['today','48h','7d','30d','60d','custom'].includes(input.period)||!Number.isInteger(input.offset??0)||(input.offset??0)<0||(input.offset??0)>100000)throw new LabError(400,'PEDIDO_INVALIDO');
 if(input.period==='custom'){
  for(const value of [input.from,input.to])if(typeof value!=='string'||!date.test(value)||!Number.isFinite(Date.parse(value))||iso(value).slice(0,10)!==value)throw new LabError(400,'PERIODO_INVALIDO');
  const days=(Date.parse(input.to)-Date.parse(input.from))/86400000;
  if(days<0||days>365)throw new LabError(400,'PERIODO_INVALIDO');
 }else if('from'in input||'to'in input)throw new LabError(400,'PEDIDO_INVALIDO');
 return {...input,offset:input.offset??0};
}
async function window(db,input){
 const {now,today}=(await db.query("select clock_timestamp() as now, (clock_timestamp() at time zone 'America/Fortaleza')::date::text as today")).rows[0];
 const end=iso(now);
 if(input.period==='48h')return {start:iso(new Date(now).getTime()-48*3600000),end};
 if(input.period==='custom')return {start:iso(`${input.from}T00:00:00-03:00`),end:iso(Date.parse(`${input.to}T00:00:00-03:00`)+86400000-1)};
 const start=Date.parse(`${today}T00:00:00-03:00`)-(input.period==='7d'?6:input.period==='30d'?29:input.period==='60d'?59:0)*86400000;
 return {start:iso(start),end};
}
export function createPersonalRecords(core,point,{testHook}={}){
 async function authorize(p){await point.readPersonal(p,()=>true);}
 async function read(p,run){
  const value=await point.readPersonal(p,run);
  // Hook de teste pode revogar via API depois da exclusão. Revalidar antes
  // de devolver; produção já confere versão/contexto no fim da operação.
  if(testHook){await testHook('after_read');await authorize(p);}return value;
 }
 return {
  authorize,
  async list(p,input){const f=filter(input);return read(p,async db=>{
   const w=await window(db,f);
   const rows=(await db.query(`select ${fields} ${from} where e.auth_user_id=$1 and ${instant}>=$2 and ${instant}<=$3 order by ${instant} desc,e.event_id desc limit 21 offset $4`,[p.authUserId,w.start,w.end,f.offset])).rows;
   return {events:rows.slice(0,20).map(dto),has_more:rows.length>20,offset:f.offset,window:w};
  });},
  async receipt(p,id){if(!uuid.test(id))throw new LabError(400,'PEDIDO_INVALIDO');return read(p,async db=>{
   const row=(await db.query(`select ${fields} ${from} where e.auth_user_id=$1 and e.event_id=$2`,[p.authUserId,id])).rows[0];
   if(!row)throw new LabError(404,'REGISTRO_NAO_ENCONTRADO');return dto(row);
  });},
  last48(p){return read(p,async db=>{
   const w=await window(db,{period:'48h'});
   const rows=(await db.query(`select ${fields} ${from} where e.auth_user_id=$1 and ${instant}>=$2 and ${instant}<=$3 order by ${instant},e.event_id limit 501`,[p.authUserId,w.start,w.end])).rows;
   if(!rows.length)throw new LabError(404,'SEM_REGISTROS_48H');
   if(rows.length>500)throw new LabError(413,'EXTRACAO_MUITO_EXTENSA');
   return {events:rows.map(dto),window:w};
  });}
 };
}
