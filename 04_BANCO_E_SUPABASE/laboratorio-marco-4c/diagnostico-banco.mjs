// Diagnóstico somente leitura do núcleo DESCARTÁVEL já parado, com EXPLAIN.
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
const stage=process.argv[2];assert.ok(['antes','depois'].includes(stage));
const round2=['2','3','4','5'].includes(process.env.METALLO_4C_ROUND);
const folder=resolve(import.meta.dirname,...(round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]),stage),load=JSON.parse(readFileSync(resolve(folder,'carga-resultado.json'),'utf8'));
const integrity=load.integrity??JSON.parse(readFileSync(resolve(folder,'confirmacao-final.json'),'utf8')).integrity;
const path=resolve(load.artifacts_dir,'..');assert.ok(path.startsWith(resolve(import.meta.dirname,'../../backups/marco-4c-ensaios')+'\\'));
const db=new PGlite(path,{relaxedDurability:false});await db.waitReady;
try{
 const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 const events=(await db.query('select * from lab_time_event order by event_id')).rows;
 const newKeys=new Set(load.intents.filter(i=>i.confirmed).map(i=>i.key));
 assert.equal(digest(events.filter(e=>!newKeys.has(e.idempotency_key))),load.before.sha256);
 assert.equal(events.length,integrity.after_count);
 const results=[];for(let n=0;n<3;n++){const start=performance.now(),proof=await verifyIntegrity(db);assert.ok(proof.passed);results.push(performance.now()-start);}
 const query=`select e.event_id from lab_time_event e left join lab4a.receipt r on r.event_id=e.event_id
 left join lab4a.intent i on i.idempotency_key=e.idempotency_key and i.auth_user_id=e.auth_user_id
 where e.auth_user_id=$1 and coalesce(i.marking_at,e.server_received_at_utc)>=clock_timestamp()-interval '60 days'
 order by coalesce(i.marking_at,e.server_received_at_utc) desc,e.event_id desc limit 21 offset $2`;
 const plans=[];for(const offset of round2?[0,20,40,100000]:[0,20,100000])plans.push({offset,plan:(await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query,[load.users[0].authUserId,offset])).rows[0]});
 const state=(await db.query('select deadlocks from pg_stat_database where datname=current_database()')).rows;
 const indexes=(await db.query("select tablename,indexname,indexdef from pg_indexes where schemaname in ('public','lab4a')")).rows;
 assert.equal(digest((await db.query('select * from lab_time_event order by event_id')).rows),digest(events));
 writeFileSync(resolve(folder,'diagnostico-banco.json'),JSON.stringify({stage,run:load.run,read_only:true,verify_integrity_ms:results,explain:plans,indexes,pglite_deadlocks:state,
  current_events:integrity.after_count,indices_changed:false,source_data_changed:false},null,2)+'\n');
 console.log(JSON.stringify({stage,verify_integrity_ms:results,pglite_deadlocks:state}));
}finally{await db.close();}
