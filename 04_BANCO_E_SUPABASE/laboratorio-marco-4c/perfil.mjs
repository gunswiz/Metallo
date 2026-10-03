// Instrumentação opt-in do laboratório. Nenhum argumento SQL/token/coordinate
// é persistido. Spans são bufferizados; o flush fica fora do caminho crítico.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance, monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export function createProfiler(directory,{retainTraces=true}={}) {
 const context=new AsyncLocalStorage(),traces=[],resources=[],people=new Map(),writerTimeline=[],activeRows=new Set();
 const loop=monitorEventLoopDelay({resolution:20});loop.enable();
 let cpu=process.cpuUsage(),tick=performance.now(),active=0,pg,pgtimer,pgbusy=false,completed=0;
 const aggregates=new Map();
 const postgres=[],transport=[];
 const gc=[];const gcObserver=new PerformanceObserver(list=>{for(const e of list.getEntries())gc.push({start_ms:e.startTime,duration_ms:e.duration,kind:e.detail?.kind});});gcObserver.observe({entryTypes:['gc']});
 let statementBefore=[];
 const timer=setInterval(()=>{const now=performance.now(),next=process.cpuUsage(),elapsed=now-tick;
  resources.push({at:new Date().toISOString(),rss:process.memoryUsage().rss,heap_used:process.memoryUsage().heapUsed,
   cpu_one_core_percent:(next.user+next.system-cpu.user-cpu.system)/elapsed/10,event_loop_mean_ms:loop.mean/1e6,event_loop_p95_ms:loop.percentile(95)/1e6,event_loop_p99_ms:loop.percentile(99)/1e6,event_loop_max_ms:loop.max/1e6,requests_active:active});
  loop.reset();cpu=next;tick=now;
 },1000);timer.unref();
 function mark(tag){const row=context.getStore();if(row&&row.milestones[tag]===undefined)row.milestones[tag]=performance.now()-row.begin;}
 function span(name,start,extra={}){const row=context.getStore();if(row)row.spans.push({name,ms:performance.now()-start,start_ms:start-row.begin,...extra});}
 async function timed(name,work,extra={}){const start=performance.now();try{return await work();}finally{span(name,start,extra);}}
 function synchronous(name,work){const start=performance.now();try{return work();}finally{span(name,start);}}
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url??input);
  if(url.origin!=='http://127.0.0.1:54321')return originalFetch(input,options);
  const name=url.pathname.startsWith('/auth/')?'Auth':url.pathname.startsWith('/rest/')?'PostgREST':'local_http';
  if(url.pathname==='/auth/v1/user')mark('T1_signed_jwt_complete');
  const start=performance.now();let status,errorKind;try{const response=await originalFetch(input,options);status=response.status;return response;}catch(e){errorKind=e.name;throw e;}finally{
   span(name,start,{endpoint:url.pathname.replace(/\/[a-f0-9-]{36}/ig,'/:id'),status,error_kind:errorKind});
  }
 };
 // Mesmas funções, retorno/erros/persistência; mede sem substituir o fsync.
 const originals=new Map();
 for(const name of ['fsyncSync','readFileSync','writeFileSync','renameSync']){
  const fn=fs[name];originals.set(name,fn);
  fs[name]=function(...args){const start=performance.now();let errorCode;try{return fn.apply(this,args);}catch(e){errorCode=e.code;throw e;}finally{span('filesystem.'+name,start,{error_code:errorCode});}};
 }
 syncBuiltinESMExports();
 function profileDb(db,transaction=false,transactionStarted=null){
  for(const name of ['query','exec','syncToFs'])if(typeof db[name]==='function'){
   const fn=db[name].bind(db);
   db[name]=async(...args)=>{const start=performance.now();const sql=typeof args[0]==='string'?args[0]:'';
    const row=context.getStore();if(row&&transaction&&/insert into (?:public\.)?lab_time_event/i.test(sql)){
     row.core_transaction=true;row.milestones.T6_core_transaction_start=transactionStarted-row.begin;
    }
    const category=/information_schema|pg_constraint|pg_trigger/.test(sql)?'catalog':/select \* from lab_time_event|select \* from lab_intent_result/.test(sql)?'inventory':/^select/i.test(sql.trim())?'read':/^insert|^update/i.test(sql.trim())?'write':name;
    const fingerprint=sql.replace(/\s+/g,' ').trim().replace(/'[^']*'/g,"'?'").replace(/\b\d+\b/g,'?').slice(0,450);
    try{return await fn(...args);}finally{span('PGlite.'+category,start,{query_fingerprint:fingerprint});}
   };
  }
  if(typeof db.transaction==='function'){
   const fn=db.transaction.bind(db);
   db.transaction=async(work)=>{
    const start=performance.now(),row=context.getStore();if(row)row.core_transaction=false;
    try{const result=await fn(tx=>work(profileDb(tx,true,performance.now())));if(row?.core_transaction)mark('T7_core_commit_complete');return result;}
    finally{span('PGlite.transaction',start);}
   };
  }
  return db;
 }
 return {
  mark,span,timed,synchronous,profileDb,transport:event=>transport.push(event),
  async observePostgres(connectionString){
   const url=new URL(connectionString);if(url.hostname!=='127.0.0.1'||url.port!=='54322')throw Error('OBSERVADOR_NAO_LOCAL');
   const {Client}=createRequire(resolve(import.meta.dirname,'../../01_WEB/package.json'))('pg');
   const start=performance.now();pg=new Client({connectionString,connectionTimeoutMillis:5000,query_timeout:5000});await pg.connect();
   resources.push({observer_connection_acquisition_ms:performance.now()-start});
   const statements=async()=>{try{return (await pg.query("select query,calls,total_exec_time,mean_exec_time,max_exec_time from pg_stat_statements where query ~ 'my_employee_profile|my_personal_items_3g|my_epi_delivery_groups_3d|my_communications_3h|lab_active_session_2e' order by total_exec_time desc limit 30")).rows.map(r=>({...r,query:r.query.replace(/'[^']*'/g,"'?'").slice(0,1200)}));}catch{return null;}};
   statementBefore=await statements();
   pg.readStatements=statements;
   const sample=async()=>{if(pgbusy)return;pgbusy=true;try{
    const sql=`select (select json_build_object('connections',count(*),'active',count(*) filter(where state='active'),'idle',count(*) filter(where state='idle'),
      'waiting_lock',count(*) filter(where wait_event_type='Lock'),'oldest_transaction_seconds',coalesce(max(extract(epoch from clock_timestamp()-xact_start)),0)) from pg_stat_activity) as activity,
      (select deadlocks from pg_stat_database where datname=current_database()) as deadlocks`;
    const result=await pg.query(sql);postgres.push({at:new Date().toISOString(),...result.rows[0]});
   }catch{postgres.push({at:new Date().toISOString(),observer_error:true});}finally{pgbusy=false;}};
   await sample();pgtimer=setInterval(()=>void sample(),1000);pgtimer.unref();
  },
  setUsers(users){for(const user of users)people.set(user.person.authUserId,user.index);},
  person(person){const row=context.getStore();if(row){row.employee_synthetic_id=people.get(person.authUserId)??'not_in_load';mark('T2_identity_and_session_resolved');mark('T3_personal_authorization_complete');}},
  async request(req,res,work){
   const requestId=/^[a-f0-9-]{36}$/i.test(req.headers['x-metallo-lab-request-id']??'')?req.headers['x-metallo-lab-request-id']:randomUUID();
   const route=req.url.split('?')[0].replace(/[a-f0-9-]{36}/ig,':id');
   const operation=/^\/lab-point\/v4[ab]\/(clock|begin|events|list|authorize|last48|management|intent\/:id|receipt\/:id)$/.test(route)?route:'invalid_or_health';
   const row={request_id:requestId,operation,start:new Date().toISOString(),begin:performance.now(),milestones:{T0_received:0},spans:[]};
   active++;activeRows.add(row);res.once('finish',()=>{activeRows.delete(row);row.status=res.statusCode;row.total_ms=performance.now()-row.begin;row.milestones.T10_node_response_finish=row.total_ms;delete row.begin;
    completed++;if(retainTraces)traces.push(row);else for(const s of row.spans){const a=aggregates.get(s.name)??{count:0,total_ms:0,max_ms:0};a.count++;a.total_ms+=s.ms;a.max_ms=Math.max(a.max_ms,s.ms);aggregates.set(s.name,a);}active--;
   });
   return context.run(row,work);
  },
  response(body){const row=context.getStore();if(row&&typeof body?.error==='string'&&/^[A-Z0-9_]+$/.test(body.error))row.response_code=body.error;if(body?.event?.recorded_at)mark('T8_technical_receipt_available');mark('T9_response_prepared');},
  failure(error){const row=context.getStore();if(!row)return;const safe=v=>typeof v==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(v)?v:undefined;
   row.failure={at:new Date().toISOString(),operation:row.operation,elapsed_ms:performance.now()-row.begin,code:safe(error.code),name:safe(error.name),stage:safe(error.diagnostic?.stage),http_status:error.diagnostic?.http_status,
    causes:[error.cause,error.cause?.cause].filter(Boolean).map(e=>({name:safe(e.name),code:safe(e.code),syscall:safe(e.syscall)})),last_resource:resources.filter(r=>r.at).at(-1),last_postgres:postgres.at(-1),
    concurrent_operations:Object.fromEntries([...new Set([...activeRows].map(r=>r.operation))].map(op=>[op,[...activeRows].filter(r=>r.operation===op).length]))};
  },
  queue(event){const row=context.getStore();if(row){if(event.type==='enter'){if(event.method==='record')mark('T5_record_queue_entered');}else{
   const scope=event.scope??'writer',end=performance.now();
   span(scope+'.'+event.method,event.start,{queue_wait_ms:event.wait,queue_depth:event.depth,failed:event.failed});
   if(retainTraces)writerTimeline.push({scope,request_id:row.request_id,operation:row.operation,method:event.method,queued_ms:event.start-event.wait,start_ms:event.start,end_ms:end,wait_ms:event.wait,service_ms:end-event.start,depth_at_entry:event.depth,failed:event.failed});
  }}},
  retention(){return {completed_traces:completed,retained_spans:traces.reduce((n,r)=>n+r.spans.length,0),active_requests:active,process:process.memoryUsage(),retain_traces:retainTraces,aggregates:Object.fromEntries(aggregates),note:'Profiler retention is explicitly reported; RSS alone does not prove an application leak'};},
  snapshot(){return {traces:[...traces],queues:[...writerTimeline],resources:[...resources],postgres:[...postgres],gc:[...gc]};},
  async close(){clearInterval(timer);clearInterval(pgtimer);gcObserver.disconnect();let statementAfter=null;if(pg){while(pgbusy)await new Promise(ok=>setTimeout(ok,10));statementAfter=await pg.readStatements?.();await pg.end();}loop.disable();globalThis.fetch=originalFetch;for(const [name,fn] of originals)fs[name]=fn;syncBuiltinESMExports();
   fs.writeFileSync(resolve(directory,'perfil-core.jsonl'),traces.map(r=>JSON.stringify(r)).join('\n')+'\n');
   fs.writeFileSync(resolve(directory,'perfil-recursos-processo.json'),JSON.stringify(resources,null,2)+'\n');
   fs.writeFileSync(resolve(directory,'perfil-postgres.json'),JSON.stringify(postgres,null,2)+'\n');
   fs.writeFileSync(resolve(directory,'perfil-transporte.jsonl'),transport.map(r=>JSON.stringify(r)).join('\n')+'\n');
   fs.writeFileSync(resolve(directory,'perfil-filas.json'),JSON.stringify(writerTimeline,null,2)+'\n');
   fs.writeFileSync(resolve(directory,'perfil-gc.json'),JSON.stringify(gc,null,2)+'\n');
   fs.writeFileSync(resolve(directory,'perfil-postgres-consultas.json'),JSON.stringify({before:statementBefore,after:statementAfter,note:'Counters are local server-wide; snapshots permit deltas but other local services may contribute; no statement reset'},null,2)+'\n');
  }
 };
}
