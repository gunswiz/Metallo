// Agrega evidência, preservando tempos inclusivos (não somar camadas aninhadas).
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync,readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const round2=['2','3','4','5','6'].includes(process.env.METALLO_4C_ROUND);
const lab=resolve(import.meta.dirname,...(round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]));
const read=name=>JSON.parse(readFileSync(resolve(lab,name),'utf8'));
const stats=values=>{const v=values.toSorted((a,b)=>a-b),sum=v.reduce((a,b)=>a+b,0);return {count:v.length,mean:v.length?sum/v.length:0,p50:v[Math.max(0,Math.ceil(v.length*.5)-1)]??0,p95:v[Math.max(0,Math.ceil(v.length*.95)-1)]??0,p99:v[Math.max(0,Math.ceil(v.length*.99)-1)]??0,max:v.at(-1)??0,total:sum};};
if(process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'){
 const report=JSON.parse(readFileSync(resolve(import.meta.dirname,'adocao-controlada/pico/incremental/resumo.json'),'utf8'));
 const scenarios=Object.fromEntries([...new Set(report.cases.map(c=>c.name))].map(name=>{
  const cases=report.cases.filter(c=>c.name===name);
  return [name,{repetitions:cases.length,valid:cases.filter(c=>c.passed).length,median_round_metrics:Object.fromEntries(['p50','p95','p99','max'].map(k=>[k,stats(cases.map(c=>c.marking[k])).p50])),worst_p95_ms:Math.max(...cases.map(c=>c.marking.p95)),maximum_observed_ms:Math.max(...cases.map(c=>c.marking.max)),pooled:stats(cases.flatMap(c=>c.marks.map(m=>m.latency_ms))),http_503:cases.reduce((n,c)=>n+c.http_503,0),timeouts:cases.reduce((n,c)=>n+c.timeouts,0),errors:cases.flatMap(c=>c.errors),passed:cases.length>=3&&cases.every(c=>c.passed)&&(!['B','C','D'].includes(name)||cases.every(c=>c.marking.p95<15000))}];
 }));
 const output={at:new Date().toISOString(),scope:'POST ADOPTION; SIMULAÇÃO SEM VALOR OFICIAL',candidate_adopted:true,normal_path_without_round_flag:true,scenarios,distinct:report.distinct,restore:report.restore,idempotency:report.idempotency,refresh:report.refresh,passed:report.passed&&Object.values(scenarios).every(c=>c.passed),remote:false,physical_devices_tested:false};
 writeFileSync(resolve(import.meta.dirname,'adocao-controlada/resultado-pos-adocao.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));process.exit(output.passed?0:1);
}
if(process.env.METALLO_4C_ROUND==='6'){
 const modes=Object.fromEntries(['full','incremental'].map(mode=>[mode,read('pico/'+mode+'/resumo.json')]));
 const compact=c=>({name:c.name,repeat:c.repeat,temperature:c.temperature,marking:c.marking,gps:c.gps,successes:c.successes,http_503:c.http_503,errors:c.errors,lost:c.lost,duplicates:c.duplicates,cross_user:c.cross_user,false_success:c.false_success,originals_unchanged:c.originals_unchanged,integral_passed:c.integral_passed,observed_click_window_ms:c.observed_click_window_ms,passed:c.passed});
 const summaries=Object.fromEntries(Object.entries(modes).map(([mode,r])=>[mode,{passed:r.passed,distinct:r.distinct,cold:r.cases.filter(c=>c.temperature==='cold').map(compact),
  warm:Object.fromEntries([...new Set(r.cases.filter(c=>c.temperature==='warm').map(c=>c.name))].map(name=>{const cases=r.cases.filter(c=>c.name===name&&c.temperature==='warm');return [name,{repetitions:cases.length,valid:cases.filter(c=>c.passed).length,
   median_round_metrics:Object.fromEntries(['p50','p95','p99','max'].map(k=>[k,stats(cases.map(c=>c.marking[k])).p50])),worst_round_by_p95:compact(cases.toSorted((a,b)=>b.marking.p95-a.marking.p95)[0]),maximum_observed_ms:Math.max(...cases.map(c=>c.marking.max)),
   pooled_marking:stats(cases.flatMap(c=>c.marks.map(m=>m.latency_ms))),http_503:cases.reduce((n,c)=>n+c.http_503,0),errors:cases.flatMap(c=>c.errors),losses:cases.reduce((n,c)=>n+c.lost,0),duplicates:cases.reduce((n,c)=>n+c.duplicates,0),passed:cases.length>=5&&cases.every(c=>c.passed)}];})),
  restore:r.restore,idempotency:r.idempotency,refresh:r.refresh,error:r.error}]));
 const candidate=summaries.incremental,operationalGate=['B','C'].every(name=>candidate.warm[name].passed&&candidate.warm[name].worst_round_by_p95.marking.p95<15000);
 const output={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; clique simulado incluindo GPS vigente com provedor sintético; 30 principal / 50 headroom',modes:summaries,
  operational_gate:operationalGate,backup_restore_gate:candidate.restore?.passed===true,zero_503_gate:modes.incremental.cases.every(c=>c.http_503===0),candidate_adopted:false,requires_regressions:true,remote:false,
  distinction:'Throughput genérico e 50 contínuas R5 são provas históricas diferentes; não misturar com burst R6. Cold está separado. Preview permanece full/v1.'};
 writeFileSync(resolve(lab,'comparacao-4b-4c.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({operational_gate:operationalGate,backup_restore_gate:output.backup_restore_gate,zero_503_gate:output.zero_503_gate,modes:Object.fromEntries(Object.entries(summaries).map(([m,r])=>[m,{passed:r.passed,warm:Object.fromEntries(Object.entries(r.warm).map(([k,v])=>[k,{median_p95:v.median_round_metrics.p95,worst_p95:v.worst_round_by_p95.marking.p95,valid:v.valid}]))}]))}));process.exit(operationalGate&&output.backup_restore_gate&&output.zero_503_gate?0:1);
}
function tailDetails(load,core,next,resources){
 const rows=load.requests.filter(r=>!r.phase.includes('duracao')&&!r.phase.startsWith('09-'));
 const name=r=>r.path.includes('/rpc/')?'RPC '+r.path.split('/').at(-1):r.path.endsWith('/begin')?'Intenção':r.path.endsWith('/events')?'Registrar (commit)':r.path.includes('/intent/')?'Recibo canônico por intenção':r.path.includes('/receipt/')?'Abrir recibo PDF':r.path.endsWith('/last48')?'ZIP 48h':r.path.includes('/session/')?'Logout atual':r.path.endsWith('/list')?(r.period==='today'?'Marcações do dia':r.offset>0?'Paginação 60 dias':'Meus registros / filtro 60 dias'):'Pedido inválido / outra operação';
 const table=input=>Object.fromEntries([...new Set(input.map(name))].sort().map(n=>{const r=input.filter(x=>name(x)===n);return [n,{total:r.length,latency_ms:stats(r.map(x=>x.latency_ms)),accepted:r.filter(x=>x.status>=200&&x.status<300).length,expected_4xx:r.filter(x=>x.status>=400&&x.status<500).length,errors_5xx_transport:r.filter(x=>x.status===0||x.status>=500).length}];}));
 const valid=rows.filter(r=>r.status>=200&&r.status<300);
 const timeline=JSON.parse(readFileSync(resolve(lab,'depois/perfil-filas.json'),'utf8'));
 const depthStats=jobs=>{const events=jobs.flatMap(j=>[{at:j.queued_ms,delta:1},{at:j.end_ms,delta:-1}]).sort((a,b)=>a.at-b.at);let depth=0,area=0,peak=0,previous=events[0]?.at;
  for(const e of events){area+=depth*(e.at-previous);depth+=e.delta;peak=Math.max(peak,depth);previous=e.at;}
  return {event_weighted:stats(jobs.map(j=>j.depth_at_entry)),time_weighted_mean:area/((events.at(-1)?.at-events[0]?.at)||1),max:peak,includes_currently_executing:true};};
 const queueStats=scope=>{const jobs=timeline.filter(j=>j.scope===scope);return {wait_ms:stats(jobs.map(j=>j.wait_ms)),service_ms:stats(jobs.map(j=>j.service_ms)),depth:depthStats(jobs),
  by_method:Object.fromEntries([...new Set(jobs.map(j=>j.method))].map(method=>{const a=jobs.filter(j=>j.method===method);return [method,{wait_ms:stats(a.map(j=>j.wait_ms)),service_ms:stats(a.map(j=>j.service_ms))}];})),
  by_http_operation:Object.fromEntries([...new Set(jobs.map(j=>j.operation))].map(operation=>{const a=jobs.filter(j=>j.operation===operation);return [operation,{count:a.length,wait_ms:stats(a.map(j=>j.wait_ms)),service_ms:stats(a.map(j=>j.service_ms))}];}))};};
 const mixedIds=new Set(load.requests.filter(r=>r.phase.startsWith('07-')).map(r=>r.request_id));
 const markingJobs=timeline.filter(j=>j.scope==='writer'&&mixedIds.has(j.request_id)&&/\/(begin|events)$/.test(j.operation));
 const victim=markingJobs.toSorted((a,b)=>b.wait_ms-a.wait_ms)[0];
 const blockers=victim?timeline.filter(j=>j.scope==='writer'&&j.request_id!==victim.request_id&&j.start_ms>=victim.queued_ms&&j.end_ms<=victim.start_ms):[];
 const corePerRequest=core.filter(r=>r.status<300).map(r=>({request_id:r.request_id,operation:r.operation,total_ms:r.total_ms,
  writer_wait_ms:r.spans.filter(s=>s.name.startsWith('writer.')).reduce((a,s)=>a+s.queue_wait_ms,0),writer_service_ms:r.spans.filter(s=>s.name.startsWith('writer.')).reduce((a,s)=>a+s.ms,0),
  point_wait_ms:r.spans.filter(s=>s.name.startsWith('point.')).reduce((a,s)=>a+s.queue_wait_ms,0),guard_passages:r.spans.filter(s=>s.name.startsWith('writer.')).length}));
 const commitIds=new Set(load.requests.filter(r=>r.phase.startsWith('02-')).map(r=>r.request_id));
 const commits=core.filter(r=>commitIds.has(r.request_id));
 const phaseResources=all=>Object.fromEntries(load.phases.filter(p=>p.started_at).map(p=>{const values=all.filter(r=>r.at>=p.started_at&&r.at<=p.finished_at);return [p.name,{samples:values.length,cpu_one_core_percent:stats(values.map(r=>r.cpu_one_core_percent)),event_loop_mean_ms:stats(values.map(r=>r.event_loop_mean_ms).filter(Number.isFinite)),event_loop_p95_ms:stats(values.map(r=>r.event_loop_p95_ms).filter(Number.isFinite)),event_loop_max_ms:Math.max(0,...values.map(r=>r.event_loop_max_ms)),rss:stats(values.map(r=>r.rss))}];}));
 const webResources=readFileSync(resolve(lab,'depois/carga-web.log'),'utf8').split('\n').filter(s=>s.startsWith('METALLO_4C_RESOURCE ')).map(s=>JSON.parse(s.slice('METALLO_4C_RESOURCE '.length)));
 const pgQueries=core.flatMap(r=>r.spans).filter(s=>s.query_fingerprint);
 const queryTable=[...new Set(pgQueries.map(s=>s.query_fingerprint))].map(query=>({query,execution_including_pglite_ms:stats(pgQueries.filter(s=>s.query_fingerprint===query).map(s=>s.ms))}));
 const mixedClicks=load.users.slice(0,10).map(u=>{const r=load.requests.filter(r=>r.user===u.index&&r.phase.startsWith('07-'));return r.find(r=>r.path.endsWith('/events')).end_ms-r.find(r=>r.path.endsWith('/begin')).start_ms;});
 const burstActiveTime=load.users.map(u=>{const begin=load.requests.find(r=>r.user===u.index&&r.phase.startsWith('01-')),commit=load.requests.find(r=>r.user===u.index&&r.phase.startsWith('02-'));return begin.latency_ms+commit.latency_ms;});
 const actual=existsSync(resolve(lab,'memoria/resultado.json'))?read('memoria/resultado.json'):null;
 return {
  operations_all:table(rows),operations_valid_only:table(valid),mixed_operations:table(rows.filter(r=>r.phase.startsWith('07-'))),mixed_operations_valid_only:table(valid.filter(r=>r.phase.startsWith('07-'))),
  home_complete_ms:stats((load.home_runs??[]).filter(r=>r.phase.includes('home-completa')).map(r=>r.latency_ms)),
  home_rpc_ms:Object.fromEntries(valid.filter(r=>r.phase.includes('home-completa')&&r.path.includes('/rpc/')).map(r=>[r.path,stats(valid.filter(x=>x.phase.includes('home-completa')&&x.path===r.path).map(x=>x.latency_ms))])),
  writer:queueStats('writer'),point_outer_queue:queueStats('point'),per_core_request:corePerRequest,
  head_of_line:{confirmed:!!blockers.length,victim,blockers:Object.fromEntries([...new Set(blockers.map(j=>j.operation))].map(op=>[op,{jobs:blockers.filter(j=>j.operation===op).length,service_ms:blockers.filter(j=>j.operation===op).reduce((a,j)=>a+j.service_ms,0)}])),
   description:'Same serialized writer; blockers are complete service intervals inside the victim waiting interval. PDF rendering occurs in Next outside this writer.'},
  marking:{burst_50_commit_client_ms:stats(load.requests.filter(r=>r.phase.startsWith('02-')).map(r=>r.latency_ms)),burst_50_sum_of_active_begin_commit_http_ms:stats(burstActiveTime),
   mixed_10_click_to_minimal_response_ms:stats(mixedClicks),burst_milestones_ms:Object.fromEntries(['T1_signed_jwt_complete','T2_identity_and_session_resolved','T4_intention_validated','T5_record_queue_entered','T6_core_transaction_start','T7_core_commit_complete','T8_technical_receipt_available','T10_node_response_finish'].map(tag=>[tag,stats(commits.map(r=>r.milestones[tag]).filter(Number.isFinite))])),
   burst_stage_intervals_ms:Object.fromEntries([['signed_jwt','T0_received','T1_signed_jwt_complete'],['personal_authorization','T1_signed_jwt_complete','T2_identity_and_session_resolved'],['point_queue_and_intention','T2_identity_and_session_resolved','T4_intention_validated'],['record_admission','T5_record_queue_entered','T6_core_transaction_start'],['transaction_and_precommit_auth','T6_core_transaction_start','T7_core_commit_complete'],['durability_and_canonical_receipt','T7_core_commit_complete','T8_technical_receipt_available'],['response_prepare_finish','T8_technical_receipt_available','T10_node_response_finish']].map(([name,start,end])=>[name,stats(commits.map(r=>r.milestones[end]-r.milestones[start]).filter(Number.isFinite))])),
   boundaries:'No real DOM clicks. HTTP start is the simulated click; separate burst begin/commit barriers introduce an artificial pause, excluded from their active-time sum. Only mixed 10 pairs are a continuous begin→commit flow.'},
  event_loop_core_by_phase:phaseResources(resources),event_loop_next_by_phase:phaseResources(webResources),
  renderer:Object.fromEntries(['PDF_generation','ZIP_PDF_generation','filesystem.logo'].map(name=>{const spans=next.flatMap(r=>r.spans).filter(s=>s.name===name);return [name,{wall_ms:stats(spans.map(s=>s.ms)),process_cpu_inclusive_ms:stats(spans.map(s=>s.cpu_ms).filter(Number.isFinite)),note:'CPU intervals overlap other requests in the same process; not exclusive per-document CPU'}];})),
  generator_http:{keep_alive_requests:rows.filter(r=>r.keep_alive_agent).length,reused_socket_requests:rows.filter(r=>r.reused_socket).length,new_socket_ms:stats(rows.filter(r=>r.reused_socket===false).map(r=>r.socket_connect_ms).filter(Number.isFinite)),reused_latency_ms:stats(rows.filter(r=>r.reused_socket).map(r=>r.latency_ms)),new_socket_latency_ms:stats(rows.filter(r=>r.reused_socket===false).map(r=>r.latency_ms)),note:'New/reused subsets carry different operations/load; latency difference is observational, not a controlled experiment'},
  application_http:{last_counters:webResources.at(-1),dispatch_wait_ms:stats(webResources.flatMap(r=>r.dispatch_wait_ms)),connect_ms:stats(webResources.flatMap(r=>r.connection_ms)),note:'Supported Undici diagnostics; no headers/cookies/body are inspected or stored'},
  pglite_queries:{frequent:queryTable.toSorted((a,b)=>b.execution_including_pglite_ms.count-a.execution_including_pglite_ms.count).slice(0,15),slow:queryTable.toSorted((a,b)=>b.execution_including_pglite_ms.p95-a.execution_including_pglite_ms.p95).slice(0,15)},
  pagination_probe:load.pagination_probe,revocation_completion_ms:stats(load.revocations.map(r=>r.complete_ms-r.start_ms)),revocation_observed_denial_upper_ms:stats(load.revocations.map(r=>r.observed_block_delay_upper_ms).filter(Number.isFinite)),
  classification:{marking:'writer + transaction + filesystem + Auth',personal_records:'read query; full integrity/authorization guard has a rollback write probe and owns the serialized checkpoint',PDF:'personal read + CPU rendering in Next + filesystem logo + final Auth/readiness',ZIP:'personal read + PDF CPU + ZIP CPU in Next + final Auth/readiness',home_pending:'three independent parallel Auth/PostgREST RPCs; no point-writer entry',logout:'Auth + serialized local authorization mutation'},
  no_exclusive_postgrest_pool_acquisition_measurement:true
  ,actual_home_and_marking:actual?{passed:actual.passed,mark_50_click_to_response_ms:stats((actual.marking_50??[]).map(r=>r.latency_ms)),home_50_complete_ms:stats((actual.home_50??[]).map(r=>r.latency_ms)),
   home_rpc_and_http:Object.fromEntries([...new Set((actual.client_rows_burst??[]).map(r=>r.path))].map(path=>[path,stats((actual.client_rows_burst??[]).filter(r=>r.path===path).map(r=>r.latency_ms))])),
   continuous_duration_ms:actual.duration_ms,continuous_requests:actual.requests,continuous_homes:actual.operations,continuous_http_ms:stats((actual.continuous_client_rows??[]).map(r=>r.latency_ms)),
   continuous_round_http_ms:Array.from({length:Math.ceil((actual.continuous_client_rows??[]).length/300)},(_,i)=>stats((actual.continuous_client_rows??[]).slice(i*300,(i+1)*300).map(r=>r.latency_ms))),dependencies:actual.home_dependencies,limits:'Initial real UI data flow including clock; no 50 DOM/browser hydration instances or autonomous 30s clock timer from each browser'}:null,
  home_first_round_coverage_correction:'Historical five-contract Home probe does not include clock or hidden recent-history GET. R2 additional probe includes clock with real dependencies after removal of unused GET; old evidence is preserved.'
 };
}
function summarize(stage){
 const load=read(stage+'/carga-resultado.json');
 const validation=read(stage+'/carga-validacao-arquivos.json');
 const completion=round2&&existsSync(resolve(lab,stage,'confirmacao-final.json'))?read(stage+'/confirmacao-final.json'):null;
 const lines=readFileSync(resolve(lab,stage,'perfil-core.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
 const next=readFileSync(resolve(lab,stage,'carga-web.log'),'utf8').split('\n').filter(s=>s.startsWith('METALLO_4C_TRACE ')).map(s=>JSON.parse(s.slice('METALLO_4C_TRACE '.length)));
 const spans=lines.flatMap(r=>r.spans),writer=spans.filter(s=>s.name.startsWith('writer.'));
 const postgres=read(stage+'/perfil-postgres.json'),observed=postgres.filter(r=>r.activity);
 const resources=read(stage+'/perfil-recursos-processo.json').filter(r=>r.at);
 const names=[...new Set(spans.map(s=>s.name))].sort();
 const breakdown=Object.fromEntries(names.map(name=>[name,stats(spans.filter(s=>s.name===name).map(s=>s.ms))]));
 const nextSpans=next.flatMap(r=>r.spans);
 const nextBreakdown=Object.fromEntries([...new Set(nextSpans.map(s=>s.name))].sort().map(name=>[name,stats(nextSpans.filter(s=>s.name===name).map(s=>s.ms))]));
 const deadlocks=observed.length?Number(observed.at(-1).deadlocks)-Number(observed[0].deadlocks):null;
 const metrics={...load.metrics};
 const home=load.phases.find(p=>p.name==='06c-home-completa-50');
 const comparableRows=load.requests.filter(r=>!r.phase.includes('home-completa')&&!r.phase.includes('duracao')&&!r.phase.startsWith('09-'));
 const comparableIds=new Set(comparableRows.map(r=>r.request_id));
 const comparableCore=lines.filter(r=>comparableIds.has(r.request_id)),comparableNext=next.filter(r=>comparableIds.has(r.request_id));
 const summarizeSpans=rows=>{const spans=rows.flatMap(r=>r.spans);return Object.fromEntries([...new Set(spans.map(s=>s.name))].sort().map(name=>[name,stats(spans.filter(s=>s.name===name).map(s=>s.ms))]));};
 const comparable={requests:comparableRows.length,...stats(comparableRows.map(r=>r.latency_ms))};
 const beforeExtension=comparableRows.filter(r=>!r.phase.startsWith('07-')&&!r.phase.startsWith('08-'));
 const afterExtension=comparableRows.filter(r=>r.phase.startsWith('07-')||r.phase.startsWith('08-'));
 // A extensão fica entre 06 e 07. Excluir sua janela inteira, incluindo o
 // cooldown; não diluir o throughput comparável com uma pausa adicional.
 comparable.duration_ms=(Math.max(...beforeExtension.map(r=>r.end_ms))-Math.min(...beforeExtension.map(r=>r.start_ms)))+
  (Math.max(...afterExtension.map(r=>r.end_ms))-Math.min(...afterExtension.map(r=>r.start_ms)));
 comparable.rps=comparableRows.length*1000/comparable.duration_ms;
 comparable.http5xx=comparableRows.filter(r=>r.status>=500).length;
 const result={stage,run:load.run,...(process.env.METALLO_4C_ROUND==='5'?{architecture:{mode:'OPT_IN_R5',writer:'mutation FIFO only; SQL exclusive shared with readonly transactions',read_network:'independent Auth/source transports and entry/exit outside writer',integrity:'full startup/audit + inductive journal v2 and fresh tail/meta; unknown SQL invalidates proof',limits:'old physical/privileged mutation outside process requires full audit; host administrator remains outside trust',gateway:'native HTTP bounded, no idle socket reuse or explicit retry; Undici dispatch/socket counters are NOT applicable to native transport'}}:{}),...(process.env.METALLO_4C_ROUND==='3'?{architecture:{point_workflow_queue:'REMOVED; no point queue samples, not a measured zero wait',writer_unit:'one protected personal operation, including synchronous guard/read or commit/receipt; not comparable to R2 per-step service',integrity:'full verification for each protected operation; no cached PASS between requests',T5_boundary:'historical T5 name now marks scoped record entry inside the operation; no second queue admission',clock:'personal clock contract; no history query/repair'}}:{}),passed:(load.passed||completion?.passed)&&validation.passed&&deadlocks===0,raw_driver_passed:load.passed,completion,metrics,comparable_same_4b_operations:comparable,
  ...(round2?{tail:tailDetails(load,lines,next,resources)}:{}),
  independent_files:{passed:validation.passed,pdfs:validation.pdfs.length,zips:validation.zips.length,errors:validation.errors},
  comparison_method:'same original operations/validations; comparable throughput sums original request windows before/after the added Home/sustained/cooldown block; extensions reported separately; 900 vs 902 reflects only the two avoided 503 retries',
  phases:load.phases,core_request_totals:stats(lines.map(r=>r.total_ms)),breakdown_inclusive_ms:breakdown,next_inclusive_ms:nextBreakdown,
  comparable_inclusive_ms:{core:summarizeSpans(comparableCore),next:summarizeSpans(comparableNext),writer_wait_ms:stats(comparableCore.flatMap(r=>r.spans).filter(s=>s.name.startsWith('writer.')).map(s=>s.queue_wait_ms))},
  writer_wait_ms:stats(writer.map(r=>r.queue_wait_ms)),writer_queue_depth_max:Math.max(0,...writer.map(r=>r.queue_depth)),
  postgres:{samples:observed.length,observer_errors:postgres.filter(r=>r.observer_error).length,connections_max:Math.max(0,...observed.map(r=>Number(r.activity.connections))),
   lock_waiters_max:Math.max(0,...observed.map(r=>Number(r.activity.waiting_lock))),new_deadlocks:deadlocks,
   idle_max:Math.max(0,...observed.map(r=>Number(r.activity.idle))),oldest_transaction_seconds_max:Math.max(0,...observed.map(r=>Number(r.activity.oldest_transaction_seconds)))},
  process:{cpu_one_core_percent:stats(resources.map(r=>r.cpu_one_core_percent)),event_loop_p99_ms:stats(resources.map(r=>r.event_loop_p99_ms)),
   event_loop_max_ms:Math.max(0,...resources.map(r=>r.event_loop_max_ms)),rss_before:resources[0]?.rss,rss_peak:Math.max(0,...resources.map(r=>r.rss)),rss_after:resources.at(-1)?.rss,
   heap_before:resources[0]?.heap_used,heap_after:resources.at(-1)?.heap_used},
  home:home??null,home_personal_profiles: Object.keys(load).filter(k=>k.startsWith('home_')).length,
  integrity:load.integrity??completion?.integrity??null,retries:load.retries,revocations:load.revocations,
  trace_count:lines.length,next_trace_count:next.length,critical_path_example:lines.find(r=>r.operation.endsWith('/events')&&r.milestones.T7_core_commit_complete),
  boundaries:['core T10 is Node finish, not client acknowledgment','Next is response prepared; client independently measures all bytes',
   'database/network spans are inclusive and overlap writer; do not sum as disjoint components',
   'SQL duration includes PGlite execution/queue, PostgreSQL server-only/pool acquisition is not directly exposed',
   'PostgreSQL observer includes existing local services and one observer connection','no 50 DOM/hydration browsers; all actual Home data contracts are exercised']};
 writeFileSync(resolve(lab,stage,'analise.json'),JSON.stringify(result,null,2)+'\n');return result;
}
function analyzeIsolation(){
 const folder=resolve(lab,'isolamento'),result={at:new Date().toISOString(),stages:{},stage_meaning:process.env.METALLO_4C_ROUND==='5'?{antes:'R4 funcional com diagnóstico 503, antes da candidata R5',depois:'Matriz R5 após separação/guard v2; ajuste posterior somente do health público documentado em ajuste-health.json',final:'Gates do código corrente em rodada-5/depois e rodada-5/memoria; candidata opt-in, default full preservado'}:{antes:'R3 funcional preservado com telemetria; diagnóstico dirigido',depois:'candidata rejeitada e revertida; NÃO é código final',final:'gates em rodada-4/depois e rodada-4/memoria, com R3 restaurado'},scope:'SIMULAÇÃO SEM VALOR OFICIAL; tempos inclusivos não somáveis; sem extrapolar SLA'};
 for(const stage of ['antes','depois']){
  const dir=resolve(folder,stage);if(!existsSync(dir))continue;
  const next=readdirSync(dir).filter(n=>/^gateway.*\.log$/.test(n)&&!n.includes('.erro')).flatMap(n=>readFileSync(resolve(dir,n),'utf8').split('\n').filter(s=>s.startsWith('METALLO_4C_RESOURCE ')).map(s=>JSON.parse(s.slice('METALLO_4C_RESOURCE '.length))));
  result.stages[stage]=readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()&&existsSync(resolve(dir,e.name,'resultado.json'))).map(e=>{
   const c=JSON.parse(readFileSync(resolve(dir,e.name,'resultado.json'),'utf8')),q=JSON.parse(readFileSync(resolve(dir,e.name,'perfil-filas.json'),'utf8'));
   const ids=new Set(c.requests.map(r=>r.request_id).filter(Boolean)),jobs=q.filter(j=>ids.has(j.request_id)),marks=jobs.filter(j=>j.scope==='writer'&&/\/(begin|events)$/.test(j.operation));
   const victim=marks.toSorted((a,b)=>b.wait_ms-a.wait_ms)[0];
   const blockers=victim?jobs.filter(j=>j.scope==='writer'&&j.request_id!==victim.request_id&&j.start_ms>=victim.queued_ms&&j.end_ms<=victim.start_ms):[];
   const web=next.filter(r=>r.at>=c.started_at&&r.at<=c.finished_at);
   return {...c,requests:undefined,marks:undefined,gc:undefined,gc_count:c.gc.length,gc_duration_ms:stats(c.gc.map(g=>g.duration_ms)),marking_writer_wait:stats(marks.map(j=>j.wait_ms)),marking_writer_execution:stats(marks.map(j=>j.service_ms)),
    admission_by_operation:Object.fromEntries([...new Set(jobs.filter(j=>j.scope==='writer').map(j=>j.operation))].map(op=>{const a=jobs.filter(j=>j.scope==='writer'&&j.operation===op);return [op,{jobs:a.length,wait:stats(a.map(j=>j.wait_ms)),service:stats(a.map(j=>j.service_ms))}];})),
    temporal_blocking:{victim,blockers:Object.fromEntries([...new Set(blockers.map(j=>j.operation))].map(op=>[op,{jobs:blockers.filter(j=>j.operation===op).length,service_ms:blockers.filter(j=>j.operation===op).reduce((n,j)=>n+j.service_ms,0)}])),gc_overlapping_wait:victim?c.gc.filter(g=>g.start_ms>=victim.queued_ms&&g.start_ms<=victim.start_ms):[],note:'Só intervalos completos dentro da espera da vítima; não somar percentis nem confundir região exclusiva com fila HTTP'},
    next_event_loop_max_ms:Math.max(0,...web.map(r=>r.event_loop_max_ms)),next_dispatch_wait:stats(web.flatMap(r=>r.dispatch_wait_ms)),next_connection_samples:stats(web.flatMap(r=>r.connection_ms)),next_counters:web.at(-1)??null};
  });
 }
 writeFileSync(resolve(folder,'analise.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({stages:Object.fromEntries(Object.entries(result.stages).map(([s,c])=>[s,c.map(r=>({case:r.name,p95:r.marking.p95,writer_wait:r.marking_writer_wait.p95,exclusive_wait:r.exclusive_wait.p95,event_loop:r.event_loop.max,next_loop:r.next_event_loop_max_ms}))]))}));return result;
}
const stage=process.argv[2];assert.ok(!stage||['antes','depois','duracao','isolamento'].includes(stage));
if(stage==='isolamento'){assert.ok(['4','5'].includes(process.env.METALLO_4C_ROUND));analyzeIsolation();}
else if(stage){const result=summarize(stage);console.log(JSON.stringify({stage,passed:result.passed,metrics:result.metrics,writer_wait:result.writer_wait_ms,postgres:result.postgres,next:result.next_inclusive_ms}));}
else if(['4','5'].includes(process.env.METALLO_4C_ROUND)){
 const comparable=summarize('depois'),isolation=analyzeIsolation();
 const actual=existsSync(resolve(lab,'memoria/resultado.json'))?read('memoria/resultado.json'):null;
 const marks=actual?stats((actual.marking_50??[]).map(r=>r.latency_ms)):null;
 const previous=JSON.parse(readFileSync(resolve(import.meta.dirname,'rodada-3/depois/analise.json'),'utf8'));
 const result={at:new Date().toISOString(),round:Number(process.env.METALLO_4C_ROUND),previous_round3:previous.comparable_same_4b_operations,comparable,marking_50:marks,isolation,
  comparable_gate:comparable.passed&&comparable.comparable_same_4b_operations.p95<15000,marking_gate:actual?.passed&&marks.count===50&&marks.p95<15000,remote:false,grok:false,baseline:false};
 result.performance_gate=result.comparable_gate&&result.marking_gate;writeFileSync(resolve(lab,'comparacao-4b-4c.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({comparable_p95:comparable.comparable_same_4b_operations.p95,marking_50:marks,performance_gate:result.performance_gate}));
}
else if(process.env.METALLO_4C_ROUND==='3'){
 const origin=JSON.parse(readFileSync(resolve(import.meta.dirname,'../laboratorio-marco-4b/carga-resultado.json'),'utf8'));
 const first=JSON.parse(readFileSync(resolve(import.meta.dirname,'depois/analise.json'),'utf8'));
 const second=JSON.parse(readFileSync(resolve(import.meta.dirname,'rodada-2/depois/analise.json'),'utf8'));
 const third=summarize('depois');
 const result={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; não SLA/capacidade de produção',origin_4b:origin.metrics,round1:first.comparable_same_4b_operations,round2:second.comparable_same_4b_operations,round3:third,
  previous_rounds_preserved:true,integrity_absolute_gate:third.passed,performance_gate:third.passed&&third.comparable_same_4b_operations.p95<15000,
  reduction_vs_round2_percent:{p95:(1-third.comparable_same_4b_operations.p95/second.comparable_same_4b_operations.p95)*100},remote_accessed:false,baseline_created:false,grok:false};
 writeFileSync(resolve(lab,'comparacao-4b-4c.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.integrity_absolute_gate,performance_gate:result.performance_gate,after:third.comparable_same_4b_operations}));
}
else if(round2){
 const origin=JSON.parse(readFileSync(resolve(import.meta.dirname,'../laboratorio-marco-4b/carga-resultado.json'),'utf8'));
 const first=JSON.parse(readFileSync(resolve(import.meta.dirname,'depois/analise.json'),'utf8'));
 const second=summarize('depois');
 const result={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; não SLA/capacidade de produção',origin_4b:origin.metrics,round1:first,round2:second,
  preserved_first_round:true,integrity_absolute_gate:second.passed,reduction_vs_round1_percent:{p95:(1-second.comparable_same_4b_operations.p95/first.comparable_same_4b_operations.p95)*100},
  remote_accessed:false,baseline_created:false,grok:false};
 writeFileSync(resolve(lab,'comparacao-4b-4c.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.integrity_absolute_gate,reduction:result.reduction_vs_round1_percent,after:second.comparable_same_4b_operations}));
}
else{
 assert.ok(existsSync(resolve(lab,'antes/carga-resultado.json'))&&existsSync(resolve(lab,'depois/carga-resultado.json')));
 const before=summarize('antes'),after=summarize('depois');
 const origin=JSON.parse(readFileSync(resolve(lab,'../laboratorio-marco-4b/carga-resultado.json'),'utf8'));
 const result={at:new Date().toISOString(),scope:'SIMULAÇÃO SEM VALOR OFICIAL; não SLA/capacidade de produção',
  origin_4b:origin.metrics,instrumented_before:before,optimized_after:after,integrity_absolute_gate:before.passed&&after.passed,
  comparable_latency_reduction_percent:{p95:(1-after.comparable_same_4b_operations.p95/origin.metrics.p95_ms)*100,
   p99:(1-after.comparable_same_4b_operations.p99/origin.metrics.p99_ms)*100},
  remote_accessed:false,baseline_created:false,grok:false};
 writeFileSync(resolve(lab,'comparacao-4b-4c.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({passed:result.integrity_absolute_gate,reduction:result.comparable_latency_reduction_percent,after:after.comparable_same_4b_operations,home:after.home?.metrics}));
}
