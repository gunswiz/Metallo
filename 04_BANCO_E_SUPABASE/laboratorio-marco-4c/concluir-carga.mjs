// Completa somente o gate que não rodou após erro NUMÉRICO do driver R2.
// Preserva o resultado bruto/hash e verifica o banco já parado; não refaz carga.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createPointExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { root,status } from '../laboratorio-marco-4a/ambiente.mjs';
const folder=resolve(import.meta.dirname,'rodada-2/depois'),file=resolve(folder,'carga-resultado.json');
const raw=readFileSync(file),load=JSON.parse(raw),sha=v=>createHash('sha256').update(typeof v==='string'||v instanceof Uint8Array?v:JSON.stringify(v)).digest('hex');
assert.equal(load.error,'Não comprovou página intermediária/final');assert.equal(load.passed,false);assert.equal(load.failures.length,0);
assert.equal(load.metrics.http5xx,0);assert.equal(load.metrics.transport_errors,0);assert.equal(load.metrics.timeouts,0);
const pages=load.pagination_probe.pages;assert.equal(pages.length,3);assert.deepEqual(pages.map(p=>p.offset),[0,20,40]);
assert.equal(pages[0].events,20);assert.equal(pages[1].events,20);assert.equal(pages[1].has_more,true);assert.equal(pages[2].has_more,false);assert.ok(pages[2].events>0);
const dir=resolve(load.artifacts_dir,'..');assert.ok(dir.startsWith(resolve(root,'backups/marco-4c-ensaios')+'\\'));
const destination=resolve(folder,'confirmacao-final.json');assert.ok(!existsSync(destination),'Preservar evidência concluída');
const core=await createLabCore(dir,{authorizationPath:dir+'.authorization.json',source:createLocalSource(status.SERVICE_ROLE_KEY)});
try{
 const events=(await core.db.query('select * from lab_time_event order by event_id')).rows;
 const confirmed=load.intents.filter(i=>i.confirmed),keys=new Set(confirmed.map(i=>i.key)),old=events.filter(e=>!keys.has(e.idempotency_key)),added=events.filter(e=>keys.has(e.idempotency_key));
 assert.equal(old.length,1100);assert.equal(sha(old),load.before.sha256);assert.equal(added.length,keys.size);assert.equal(keys.size,90);
 assert.equal(new Set(events.map(e=>e.idempotency_key)).size,events.length);
 for(const i of confirmed){const e=added.find(e=>e.idempotency_key===i.key),u=load.users[i.user];assert.equal(e.auth_user_id,u.authUserId);assert.equal(e.event_id,i.event.event_id);
  const r=(await core.db.query('select i.auth_user_id,i.employee_id,i.marking_at,r.recorded_at,r.event_id from lab4a.intent i join lab4a.receipt r using(idempotency_key) where i.idempotency_key=$1',[i.key])).rows[0];
  assert.equal(r.auth_user_id,u.authUserId);assert.equal(r.employee_id,u.employeeId);assert.equal(r.event_id,e.event_id);assert.equal(new Date(r.marking_at).toISOString(),i.marking_at);assert.equal(new Date(r.recorded_at).toISOString(),i.event.recorded_at);
 }
 await createPointExtension(core).verify();const state=await core.inspect();assert.equal(state.ready_for_new_events,true);
 const own=(await core.db.query("select e.event_id from lab_time_event e left join lab4a.intent i using(idempotency_key) where e.auth_user_id=$1 and coalesce(i.marking_at,e.server_received_at_utc)>=clock_timestamp()-interval '60 days'",[load.users[0].authUserId])).rows;
 assert.equal(own.length,pages.reduce((a,p)=>a+p.events,0));
 const report={at:new Date().toISOString(),passed:true,run:load.run,raw_driver_passed:false,raw_driver_sha256:sha(raw),raw_driver_unmodified:true,
  reason:'Driver applied .length to numeric event count. Raw failure is preserved; corrected assertion and previously unreached final gate independently verified against stopped disposable DB. No repeated load or changed assertions about product.',
  pagination:{passed:true,actual_pages:pages,own_events_in_db:own.length},
  integrity:{expected_new_intents:90,persisted_new_events:90,benchmark_new_events:70,isolated_pagination_new_events:20,old_count:1100,after_count:events.length,old_sha256_after:sha(old),originals_unchanged:true,duplicates:0,lost_confirmed:0,cross_user:0,ready:true,receipts_verified:90},
  remote_accessed:false,baseline_created:false,grok:false};
 writeFileSync(destination,JSON.stringify(report,null,2)+'\n');assert.equal(sha(readFileSync(file)),sha(raw));console.log(JSON.stringify({passed:true,integrity:report.integrity,pagination:report.pagination}));
}finally{await core.close();}
