// Duas conexoes reais: A mantem UPDATE aberto; B usa JWT/PostgREST e espera lock.
// Somente banco do container local. Sem sleep SQL nem mudanca de isolamento/RLS.
import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';

export async function runConcurrency({sql,l,request,check,fingerprint,engineer,admin,runId,item,batch,own,other}) {
  const docker=join(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
  const context=execFileSync(docker,['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
  if(!context.startsWith('npipe:////./pipe/'))throw new Error('Concorrencia exige Docker local');
  const rows=[];
  const pause=()=>new Promise(r=>setTimeout(r,100));
  for(const kind of ['delivery_after_unassign','close_after_unassign']){
    const initialTeam=kind==='delivery_after_unassign'?other:own;
    const employee=sql(`insert into public.epi_employees(full_name,profession,team_id,created_by) values (${l(`Concorrencia ${kind} ${runId}`)},'Teste',${l(initialTeam)}::uuid,${l(admin.id)}::uuid) returning id`);
    const delivery=sql(`insert into public.epi_deliveries(employee_id,team_id,item_id,stock_batch_id,quantity,delivered_by) values (${l(employee)}::uuid,${l(other)}::uuid,${l(item)}::uuid,${l(batch)}::uuid,1,${l(admin.id)}::uuid) returning id`);
    const a=spawn(docker,['exec','-i','supabase_db_laboratorio-marco-1a','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',errors='',exitCode,operation,settled=false;
    a.stdout.on('data',b=>output+=b.toString());a.stderr.on('data',b=>errors+=b.toString());
    const closed=new Promise((resolve,reject)=>{a.once('error',reject);a.once('close',code=>{exitCode=code;resolve(code);});});
    const row={kind,employee,delivery,initial_team:initialTeam,delivery_team:other,operator_allowed_team:own,started_at:new Date().toISOString()};
    rows.push(row);
    try {
      a.stdin.write(`begin; set local idle_in_transaction_session_timeout='20s'; set local statement_timeout='15s'; update public.epi_employees set team_id=null where id=${l(employee)}::uuid; select pg_backend_pid();\n`);
      const readyDeadline=Date.now()+8000;
      while(!/^\d+\s*$/m.test(output)&&exitCode===undefined&&Date.now()<readyDeadline)await pause();
      const pid=Number(output.trim());
      if(!Number.isInteger(pid)||pid<=0)throw new Error(`Cliente A sem barreira: ${errors}`);
      row.client_a_pid=pid;
      const before=fingerprint();
      const rpc=kind==='delivery_after_unassign'?'register_epi_delivery':'close_epi_delivery_quantity';
      const body=kind==='delivery_after_unassign'?{p_employee_id:employee,p_item_id:item,p_stock_batch_id:batch,p_quantity:1}:{p_delivery_id:delivery,p_quantity:1,p_status:'returned'};
      operation=request(`/rest/v1/rpc/${rpc}`,{method:'POST',bearer:engineer.token,body}).then(r=>{settled=true;return r;});
      const deadline=Date.now()+8000;let waiting=[];
      while(Date.now()<deadline&&!settled){
        waiting=JSON.parse(sql(`select coalesce(json_agg(json_build_object('pid',pid,'state',state,'wait_event_type',wait_event_type,'wait_event',wait_event,'blocked_by',pg_blocking_pids(pid))),'[]') from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))`));
        if(waiting.length)break;
        await pause();
      }
      row.blocked_before_commit=waiting;row.b_pending_before_commit=!settled;
      check(`concorrencia ${kind}: B espera A em lock real`,waiting.length>0&&!settled,waiting);
      a.stdin.end('commit;\n');
      const code=await closed;row.client_a_exit_code=code;
      if(code!==0)throw new Error(`Cliente A falhou: ${errors}`);
      row.commit_a_at=new Date().toISOString();
      const response=await operation;
      row.response=response;row.before=before;row.after=fingerprint();
      check(`concorrencia ${kind}: depois do commit NULL B e negado`,response.status===403&&response.data?.code==='42501'&&response.data?.message==='unassigned_employee_admin_required',response);
      check(`concorrencia ${kind}: dados operacionais identidade e audit preservados`,JSON.stringify(row.before)===JSON.stringify(row.after));
      row.final_state=JSON.parse(sql(`select json_build_object('team_id',(select team_id from public.epi_employees where id=${l(employee)}::uuid),'delivery_status',(select current_status from public.epi_deliveries where id=${l(delivery)}::uuid))`));
      check(`concorrencia ${kind}: desvinculo confirmado e entrega continua ativa`,row.final_state.team_id===null&&row.final_state.delivery_status==='active');
    } finally {
      if(exitCode===undefined){if(!a.stdin.writableEnded)a.stdin.end('rollback;\n');await closed;}
      if(operation)await operation;
      row.finished_at=new Date().toISOString();
    }
  }
  return rows;
}
