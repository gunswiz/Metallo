// T-05/T-10: autorizacao operacional com equipe nula. Apenas fixtures locais.
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export async function runManagementScope(c) {
  const { request, sql, literal:l, admin, adminSession, mariaSession, runId, service }=c;
  const out={started_at:new Date().toISOString(),checks:[],matrix:[],rpc_attempts:[]};
  c.report.management_scope=out;
  const check=(name,ok,detail='')=>{out.checks.push({name,ok,detail});c.observe(`T05 ${name}`,ok,typeof detail==='string'?detail:JSON.stringify(detail));};
  const obj=q=>JSON.parse(sql(q));
  const rpc=(name,body,token)=>request(`/rest/v1/rpc/${name}`,{method:'POST',bearer:token,body});
  const auth={apikey:service,bearer:service};
  try {
  const own=sql(`insert into public.teams(name,location_type) values ('T05 propria ${runId}','field') returning id`);
  const other=sql(`insert into public.teams(name,location_type) values ('T05 outra ${runId}','field') returning id`);
  const employees={};
  for(const [key,team] of [['own',own],['other',other],['unassigned',other]]) {
    employees[key]=sql(`insert into public.epi_employees(full_name,profession,team_id,created_by,aso_exam_date,aso_expiry_date) values (${l(`T05 ${key} ${runId}`)},'Teste',${l(team)}::uuid,${l(admin.id)}::uuid,'2026-01-01','2026-12-01') returning id`);
  }
  const item=sql(`insert into public.epi_items(code,name,item_kind,created_by) values (${l(`T05-${runId}`)},'Item T05','epi',${l(admin.id)}::uuid) returning id`);
  const batch=sql(`insert into public.epi_stock_batches(item_id,quantity,created_by) values (${l(item)}::uuid,30,${l(admin.id)}::uuid) returning id`);
  const delivery=sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,stock_batch_id,quantity,delivered_by) values (${l(employees.unassigned)}::uuid,${l(other)}::uuid,${l(item)}::uuid,${l(batch)}::uuid,3,${l(admin.id)}::uuid) returning id`);
  const pending=sql(`insert into public.epi_requests(employee_id,team_id,item_id,quantity,requested_by) values (${l(employees.unassigned)}::uuid,${l(other)}::uuid,${l(item)}::uuid,1,${l(admin.id)}::uuid) returning id`);
  const expired=sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,ends_at,created_by) values (${l(employees.unassigned)}::uuid,${l(other)}::uuid,now()-interval '2 days',now()-interval '1 day',${l(admin.id)}::uuid) returning id`);
  sql(`update public.epi_employees set team_id=null where id=${l(employees.unassigned)}::uuid`);
  const actors=[{key:'admin',id:admin.id,token:adminSession.access_token,expected:['own','other','unassigned'],capability:true}];
    for(const [key,role,permissions,teams,expected] of [
      ['engineer','engineer',['epi:write'],[own],['own']],
      ['global_engineer','engineer',null,null,['own','other']],
      ['leader','leader',['epi:write'],[own],['own']],
      ['leader_default','leader',null,null,[]],
      ['collaborator','collaborator',['epi:write'],[own],['own']],
      ['collaborator_default','collaborator',null,null,[]],
      ['empty_scope','engineer',['epi:write'],[],[]],
    ]) {
      const email=`t05-${key}-${runId}@example.invalid`,password=`T05!7${randomBytes(18).toString('base64url')}`,ticket=randomUUID();
      const issued=await request('/rest/v1/rpc/issue_user_provisioning_ticket',{method:'POST',...auth,body:{p_email:email,p_token:ticket}});
      const user=await request('/auth/v1/admin/users',{method:'POST',...auth,body:{email,password,email_confirm:true,app_metadata:{metallo_provisioned:true},user_metadata:{full_name:`Gestao ${key} Sintetico`,metallo_provisioning_token:ticket}}});
      if(![200,204].includes(issued.status)||![200,201].includes(user.status)||!user.data?.id)throw new Error(`Auth fixture ${key} falhou`);
      const perms=permissions?`array[${permissions.map(l).join(',')}]::text[]`:'null';
      const scope=teams?`array[${teams.map(t=>`${l(t)}::uuid`).join(',')}]::uuid[]`:'null';
      sql(`update public.profiles set role=${l(role)},active=true,team_id=${l(own)}::uuid,operation_permissions=${perms},operation_team_ids=${scope} where id=${l(user.data.id)}::uuid`);
      const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
      const valid=session.status===200&&session.data?.user?.id===user.data.id&&Boolean(session.data?.access_token);
      check(`${key}: Auth real e perfil operacional sintetico`,valid);
      if(!valid)throw new Error(`Login fixture ${key} falhou`);
      actors.push({key,id:user.data.id,token:session.data.access_token,expected,capability:!key.endsWith('_default')});
    }
    actors.push({key:'portal',token:mariaSession.access_token,expected:[],capability:false});
    const employeeFilter=Object.values(employees).join(',');
    for(const actor of actors) {
      for(const [state,id] of Object.entries(employees)) {
        const response=await request(`/rest/v1/epi_employees?select=id,full_name,team_id,aso_expiry_date&id=eq.${id}`,{bearer:actor.token});
        const expected=actor.expected.includes(state)?[id]:[];
        const observed=Array.isArray(response.data)?response.data.map(r=>r.id):null;
        check(`${actor.key}: leitura ${state}`,response.status===200&&JSON.stringify(observed)===JSON.stringify(expected),`HTTP ${response.status}; linhas=${observed?.length}`);
        out.matrix.push({actor:actor.key,state,expected_ids:expected,response});
      }
      const dashboard=await rpc('site_dashboard',{},actor.token);
      const returned=dashboard.data?.employees?.filter(e=>employeeFilter.includes(e.id)).map(e=>e.id).sort();
      check(`${actor.key}: dashboard respeita mesmo recorte`,dashboard.status===200&&JSON.stringify(returned)===JSON.stringify(actor.expected.map(k=>employees[k]).sort()));
      const capability=await rpc('can_operate',{p_permission:'epi:write',p_team_id:null},actor.token);
      check(`${actor.key}: can_operate NULL preserva capacidade anterior`,capability.status===200&&capability.data===actor.capability);
    }
    const engineer=actors.find(a=>a.key==='engineer');
    for(const [table,id] of [['epi_deliveries',delivery],['employee_assignments',expired]]) {
      const response=await request(`/rest/v1/${table}?id=eq.${id}`,{bearer:engineer.token});
      check(`sem equipe nao amplia historico ${table}`,response.status===200&&response.data?.length===0);
    }
    // Escopo historico explicito continua funcionando para engenheiro global.
    const history=await request(`/rest/v1/epi_deliveries?id=eq.${delivery}`,{bearer:actors.find(a=>a.key==='global_engineer').token});
    check('historico com equipe explicita conserva permissao anterior',history.status===200&&history.data?.length===1);
    const fingerprint=()=>{
      const rows=obj(`select json_build_object('stock',(select to_jsonb(b) from public.epi_stock_batches b where id=${l(batch)}::uuid),'deliveries',(select jsonb_agg(to_jsonb(d) order by id) from public.epi_deliveries d where employee_id=${l(employees.unassigned)}::uuid),'requests',(select jsonb_agg(to_jsonb(r) order by id) from public.epi_requests r where employee_id=${l(employees.unassigned)}::uuid))`);
      return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    };
    out.write_fingerprints={before:fingerprint(),after:[]};
    // Cobrir tambem alocacao efetiva: nenhum RPC deve usar o NULL da equipe-base
    // para operar o cadastro sem equipe, mesmo com um destino operacional valido.
    const assignment=sql(`insert into public.employee_assignments(employee_id,team_id,starts_at,created_by) values (${l(employees.unassigned)}::uuid,${l(own)}::uuid,now()-interval '1 hour',${l(admin.id)}::uuid) returning id`);
    const attempts=[
      ['register_epi_delivery',{p_employee_id:employees.unassigned,p_item_id:item,p_stock_batch_id:batch,p_quantity:1}],
      ['register_epi_delivery_batch',{p_employee_id:employees.unassigned,p_lines:[{item_id:item,stock_batch_id:batch,quantity:1}]}],
      ['request_epi_item',{p_employee_id:employees.unassigned,p_item_id:item,p_quantity:1}],
      ['fulfill_epi_request',{p_request_id:pending,p_stock_batch_id:batch}],
      ['close_epi_delivery_quantity',{p_delivery_id:delivery,p_quantity:1,p_status:'returned'}],
    ];
    for(const [name,body] of attempts) {
      const response=await rpc(name,body,engineer.token);
      const after=fingerprint();out.rpc_attempts.push({name,response});out.write_fingerprints.after.push({name,sha256:after});
      check(`${name}: exige admin para funcionario sem equipe`,response.status===403&&response.data?.code==='42501'&&response.data?.message==='unassigned_employee_admin_required',response);
      check(`${name}: estoque e historico inalterados`,after===out.write_fingerprints.before);
    }
    sql(`delete from public.employee_assignments where id=${l(assignment)}::uuid`);
    const closed=await rpc('close_epi_delivery_quantity',{p_delivery_id:delivery,p_quantity:1,p_status:'returned'},adminSession.access_token);
    check('admin continua podendo fechar historico sem equipe',closed.status===200&&typeof closed.data==='string');
    const ownDelivery=await rpc('register_epi_delivery',{p_employee_id:employees.own,p_item_id:item,p_stock_batch_id:batch,p_quantity:1},engineer.token);
    check('engenheiro continua entregando EPI na propria equipe',ownDelivery.status===200&&typeof ownDelivery.data==='string');
    // T-10: nenhuma mudanca em FK, DELETE nao pode apagar equipe com movimentos.
    const historyTeam=sql(`insert into public.teams(name,location_type) values ('T10 historico ${runId}','field') returning id`);
    const material=sql(`insert into public.items(code,name,item_type) values (${l(`T10-${runId}`)},'Material T10','material') returning id`);
    const movement=sql(`insert into public.movements(item_id,quantity,movement_type,origin_team_id,performed_by) values (${l(material)}::uuid,1,'consumption',${l(historyTeam)}::uuid,${l(admin.id)}::uuid) returning id`);
    const deleteGuard=obj(`do $check$ begin begin delete from public.teams where id=${l(historyTeam)}::uuid; raise exception 'history_was_deleted'; exception when foreign_key_violation then null; end; end $check$; select json_build_object('team_exists',exists(select 1 from public.teams where id=${l(historyTeam)}::uuid),'movement_exists',exists(select 1 from public.movements where id=${l(movement)}::uuid))`);
    check('T10 DELETE de equipe com movimento falha por FK e preserva historico',deleteGuard.team_exists&&deleteGuard.movement_exists);
    out.team_history=deleteGuard;
    out.fixtures={teams:{own,other,historyTeam},employees,item,batch,delivery,pending};
    // Controles positivos T15 podem reconciliar pedidos ao entregar EPI.
    // Executar apos os 68 checks originais, mantendo suas precondicoes intactas.
    if(process.env.METALLO_TEST_T15){
      const {runT15}=await import('./executar-provas-t15.mjs');
      await runT15(c,{actors,employees,item,batch,delivery,own,other});
    }
  } catch(error) {out.error=String(error.message??error);throw error;
  } finally {
    out.finished_at=new Date().toISOString();out.passed=!out.error&&out.checks.length>0&&out.checks.every(c=>c.ok);
    writeFileSync(new URL(`./${process.env.METALLO_EVIDENCE_REVISION === '2d' ? '../laboratorio-marco-2d' : process.env.METALLO_EVIDENCE_REVISION === '2b' ? '../laboratorio-marco-2b' : process.env.METALLO_EVIDENCE_REVISION === '1c' ? 'marco-1c' : process.env.METALLO_EVIDENCE_REVISION === 'r2' ? 'saneamento-r2' : 'auditoria-complementar'}/resultado-gestao-equipe-opcional.json`,import.meta.url),JSON.stringify(out,null,2)+'\n');
  }
}
