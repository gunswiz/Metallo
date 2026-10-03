// T-15: policies de itens/kits/acknowledgements via Auth/PostgREST real local.
// Contexto e fixtures reaproveitados do executor da Gestao; nao persiste credenciais.
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export async function runT15(c, f) {
  const {request,sql,literal:l,admin,runId}=c;
  const {actors,employees,item,batch,delivery,own,other}=f;
  const phase=process.env.METALLO_TEST_T15==='before'?'before':'after';
  const out={started_at:new Date().toISOString(),phase,checks:[],matrix:[],fingerprints:[],router:[]};
  c.report.t15=out;
  const check=(name,ok,detail='')=>{out.checks.push({name,ok,detail});c.observe(`T15 ${name}`,ok,typeof detail==='string'?detail:JSON.stringify(detail));};
  const tables=['public.epi_employee_items','public.epi_employee_item_sets','public.epi_monthly_acknowledgements','public.epi_deliveries','public.epi_stock_batches','public.epi_requests','private.employee_identity','private.employee_identity_audit','private.employee_portal_accounts','public.profile_access_audit','public.site_operation_receipts'];
  const fingerprint=()=>{
    const data=JSON.parse(sql(`select json_build_object(${tables.map(t=>`${l(t)},(select json_build_object('count',count(*),'rows',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')) from ${t} t)`).join(',')})`));
    return Object.fromEntries(Object.entries(data).map(([t,{count,rows}])=>[t,{count,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')}]));
  };
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const representation={Prefer:'return=representation'};
  const ackTable='epi_monthly_acknowledgements';
  try {
    for(const id of Object.values(employees))sql(`insert into public.epi_employee_item_sets(employee_id,updated_by) values (${l(id)}::uuid,${l(admin.id)}::uuid); insert into public.epi_employee_items(employee_id,item_id) values (${l(id)}::uuid,${l(item)}::uuid); insert into public.epi_monthly_acknowledgements(employee_id,reference_month,signed_name,confirmed_by) values (${l(id)}::uuid,'2026-01-01','Fixture T15',${l(admin.id)}::uuid);`);
    const selected=actors.filter(a=>['admin','engineer','leader','collaborator','portal'].includes(a.key));
    out.actors=selected.map(({key,id,expected})=>({key,id,expected}));
    out.fixtures={employees,item,batch,delivery};
    for(const actor of selected)for(const [state,employeeId] of Object.entries(employees)){
      const permitted=actor.expected.includes(state);
      const before=fingerprint();
      for(const table of ['epi_employee_items','epi_employee_item_sets',ackTable]){
        const response=await request(`/rest/v1/${table}?employee_id=eq.${employeeId}`,{bearer:actor.token});
        const ok=response.status===200&&Array.isArray(response.data)&&response.data.length===(permitted?1:0)&&response.data.every(r=>r.employee_id===employeeId);
        check(`${actor.key} ${state} GET ${table}`,ok,`HTTP ${response.status}; linhas=${response.data?.length}`);
        out.matrix.push({actor:actor.key,state,method:'GET',table,permitted,response});
      }
      // Mes especifico por tentativa; PATCH/DELETE miram a linha existente criada
      // pelo admin, impedindo falsa negativa por alvo inexistente.
      const responsePost=await request(`/rest/v1/${ackTable}`,{method:'POST',bearer:actor.token,headers:representation,body:{employee_id:employeeId,reference_month:'2026-02-01',signed_name:`T15 ${actor.key}`}});
      check(`${actor.key} ${state} POST acknowledgement`,permitted?responsePost.status===201&&responsePost.data?.length===1:responsePost.status===403&&responsePost.data?.code==='42501',`HTTP ${responsePost.status}`);
      out.matrix.push({actor:actor.key,state,method:'POST',table:ackTable,permitted,response:responsePost});
      if(!permitted){const after=fingerprint();out.fingerprints.push({actor:actor.key,state,method:'POST',before,after});check(`${actor.key} ${state} POST conserva onze tabelas e auditorias`,same(before,after));}
      const target=`/rest/v1/${ackTable}?employee_id=eq.${employeeId}&reference_month=eq.2026-01-01`;
      for(const method of ['PATCH','DELETE']){
        const prior=fingerprint();
        const response=await request(target,{method,bearer:actor.token,headers:representation,...(method==='PATCH'?{body:{signed_name:`Alterado ${actor.key}`}}:{})});
        check(`${actor.key} ${state} ${method} acknowledgement`,response.status===200&&response.data?.length===(permitted?1:0),`HTTP ${response.status}; linhas=${response.data?.length}`);
        out.matrix.push({actor:actor.key,state,method,table:ackTable,permitted,response});
        if(!permitted){const after=fingerprint();out.fingerprints.push({actor:actor.key,state,method,before:prior,after});check(`${actor.key} ${state} ${method} conserva onze tabelas e auditorias`,same(prior,after));}
      }
      // Restaurar somente estas fixtures para repetir a mesma matriz com outro ator.
      sql(`delete from public.epi_monthly_acknowledgements where employee_id=${l(employeeId)}::uuid; insert into public.epi_monthly_acknowledgements(employee_id,reference_month,signed_name,confirmed_by) values (${l(employeeId)}::uuid,'2026-01-01','Fixture T15',${l(admin.id)}::uuid);`);
    }
    if(phase==='after'){
      const engineer=actors.find(a=>a.key==='engineer'),adminActor=actors.find(a=>a.key==='admin');
      const ownAck=sql(`insert into public.epi_monthly_acknowledgements(employee_id,reference_month) values (${l(employees.own)}::uuid,'2026-03-01') returning id`);
      for(const state of ['other','unassigned']){
        const before=fingerprint();
        const response=await request(`/rest/v1/${ackTable}?id=eq.${ownAck}`,{method:'PATCH',bearer:engineer.token,headers:representation,body:{employee_id:employees[state]}});
        const after=fingerprint();
        check(`WITH CHECK nega troca de employee_id proprio para ${state}`,response.status===403&&response.data?.code==='42501',response);
        check(`troca de ID para ${state} conserva onze tabelas e auditorias`,same(before,after));
        out.fingerprints.push({actor:'engineer',state,method:'PATCH employee_id',response,before,after});
      }
      // Equipe-base nula + alocacao operacional explicita: admin preserva entrega
      // legitima; nao-admin continua negado pela guarda da equipe-base.
      const assignment=sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values (${l(employees.unassigned)}::uuid,${l(own)}::uuid,now()-interval '1 hour',${l(admin.id)}::uuid) returning id`);
      try {
        for(const actor of [engineer,adminActor])for(const command of ['deliver_epi','close_epi']){
          const id=randomUUID();
          const payload=command==='deliver_epi'?{employee_id:employees.unassigned,lines:[{item_id:item,stock_batch_id:batch,quantity:1}]}:{delivery_id:delivery,quantity:1,status:'returned'};
          const before=fingerprint();
          const response=await request('/rest/v1/rpc/run_site_operation',{method:'POST',bearer:actor.token,body:{p_command:command,p_data:{...payload,actor_id:actor.id},p_operation_id:id,p_occurred_at:new Date().toISOString()}});
          const after=fingerprint();
          check(`${actor.key} run_site_operation ${command} sem equipe`,actor.key==='admin'?response.status===200&&typeof response.data?.id==='string':response.status===403&&response.data?.code==='42501'&&response.data?.message==='unassigned_employee_admin_required',response);
          if(actor.key!=='admin')check(`${command} negado conserva estoque historico identidade audit e recibos`,same(before,after));
          out.router.push({actor:actor.key,command,response,before,after});
        }
      } finally {sql(`delete from public.employee_assignments where id=${l(assignment)}::uuid`);}
      const {runConcurrency}=await import('./executar-concorrencia-gestao.mjs');
      out.concurrency=await runConcurrency({sql,l,request,check,fingerprint,engineer,admin,runId,item,batch,own,other});
    }
  } catch(error){out.error=String(error.message??error);throw error;
  } finally {
    out.finished_at=new Date().toISOString();out.passed=!out.error&&out.checks.every(c=>c.ok);
    writeFileSync(new URL(`./${process.env.METALLO_EVIDENCE_REVISION === '2f' ? '../laboratorio-marco-2f' : process.env.METALLO_EVIDENCE_REVISION === '2e' ? '../laboratorio-marco-2e' : process.env.METALLO_EVIDENCE_REVISION === '2d' ? '../laboratorio-marco-2d' : process.env.METALLO_EVIDENCE_REVISION === '2b' ? '../laboratorio-marco-2b' : process.env.METALLO_EVIDENCE_REVISION === '1c' ? 'marco-1c' : process.env.METALLO_EVIDENCE_REVISION === 'r2' ? 'saneamento-r2' : 'auditoria-complementar'}/resultado-t15-${phase}.json`,import.meta.url),JSON.stringify(out,null,2)+'\n');
  }
}
