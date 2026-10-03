// Extensao do executor real. Recebe apenas credenciais efemeras do laboratorio.
// Regra antiga equipe inativa => DTO vazio:
// SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL.
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

export async function runComplementary(c) {
  const {request,sql,literal,report,admin,adminSession,joao,maria,joaoSession,mariaSession,
    joaoEmployee,mariaEmployee,teamId,itemId,batchId,identities,runId,service}=c;
  const out={started_at:new Date().toISOString(),checks:[],rest_matrix:[],graphql:[]};
  report.complementary=out;
  const check=(group,name,ok,detail='')=>{out.checks.push({group,name,ok,detail});c.observe(`${group} ${name}`,ok,typeof detail==='string'?detail:JSON.stringify(detail));};
  const obj=q=>JSON.parse(sql(q));
  const ident=s=>{if(!/^[a-z_][a-z0-9_]*$/.test(s))throw new Error('Identificador inesperado');return `"${s}"`;};
  const adminAuth={apikey:service,bearer:service};
  const rpc=(name,body,bearer=adminSession.access_token)=>request(`/rest/v1/rpc/${name}`,{method:'POST',bearer,body});
  const dto=bearer=>rpc('my_employee_profile',{},bearer);
  const insert=(table,data)=>{
    const columns=Object.keys(data).map(ident).join(',');
    return obj(`insert into public.${ident(table)}(${columns}) select ${columns} from jsonb_populate_record(null::public.${ident(table)},${literal(JSON.stringify(data))}::jsonb) returning to_jsonb(${ident(table)})`);
  };
  const snapshotUser=id=>obj(`select json_build_object('auth',(select json_build_object('id',id,'banned_until',banned_until,'deleted_at',deleted_at) from auth.users where id=${literal(id)}::uuid),'account',(select to_jsonb(a) from private.employee_portal_accounts a where auth_user_id=${literal(id)}::uuid),'identity',(select to_jsonb(i) from private.employee_identity i where auth_user_id=${literal(id)}::uuid),'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by event_at,id),'[]') from private.employee_identity_audit a where auth_user_id=${literal(id)}::uuid))`);
  try {
    const tables=obj(`select json_agg(json_build_object('name',t.tablename,'insert',has_table_privilege('authenticated','public.'||t.tablename,'INSERT'),'update',has_table_privilege('authenticated','public.'||t.tablename,'UPDATE'),'delete',has_table_privilege('authenticated','public.'||t.tablename,'DELETE'),'pk',(select json_agg(a.attname order by k.ordinality) from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,ordinality) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=('public.'||t.tablename)::regclass and i.indisprimary)) order by t.tablename) from pg_tables t where t.schemaname='public'`);
    out.catalog=tables;
    check('P1','catalogo possui 30 tabelas publicas com chave',tables.length===30&&tables.every(t=>t.pk?.length>0));
    // Fixtures nao vazias: o DELETE/PATCH sempre aponta para linha existente.
    const rows={};
    rows.teams=insert('teams',{name:`Equipe P1 ${runId}`,location_type:'field'});
    const team=rows.teams.id;
    rows.worksites=insert('worksites',{name:`Obra P1 ${runId}`,stock_team_id:team,created_by:admin.id});
    rows.work_locations=insert('work_locations',{name:`Local P1 ${runId}`,location_type:'worksite'});
    rows.items=insert('items',{code:`P1-M-${runId}`,name:'Material sintetico P1',item_type:'material'});
    const equipment=insert('items',{code:`P1-E-${runId}`,name:'Equipamento sintetico P1',item_type:'equipment'});
    rows.assets=insert('assets',{item_id:equipment.id,asset_code:`P1-${runId}`,team_id:team,ownership_type:'rented',rental_company:'Locadora sintetica'});
    rows.asset_movements=insert('asset_movements',{asset_id:rows.assets.id,previous_status:'available',new_status:'available',movement_type:'assign',destination_team_id:team,performed_by:admin.id});
    rows.employee_assignments=insert('employee_assignments',{employee_id:mariaEmployee,team_id:team,starts_at:'2026-09-01T00:00:00Z',created_by:admin.id});
    rows.epi_employees=obj(`select to_jsonb(t) from public.epi_employees t where id=${literal(mariaEmployee)}::uuid`);
    rows.epi_items=obj(`select to_jsonb(t) from public.epi_items t where id=${literal(itemId)}::uuid`);
    rows.epi_stock_batches=obj(`select to_jsonb(t) from public.epi_stock_batches t where id=${literal(batchId)}::uuid`);
    rows.epi_deliveries=obj(`select to_jsonb(t) from public.epi_deliveries t where employee_id=${literal(mariaEmployee)}::uuid limit 1`);
    rows.epi_employee_item_sets=insert('epi_employee_item_sets',{employee_id:mariaEmployee,updated_by:admin.id});
    rows.epi_employee_items=insert('epi_employee_items',{employee_id:mariaEmployee,item_id:itemId,required_quantity:1});
    rows.epi_item_variants=insert('epi_item_variants',{item_id:itemId,value:`p1_${runId}`,label:'Variante sintetica'});
    rows.epi_monthly_acknowledgements=insert('epi_monthly_acknowledgements',{employee_id:mariaEmployee,reference_month:'2026-09-01'});
    rows.epi_professions=insert('epi_professions',{code:`p1_${runId}`,name:`Profissao sintetica ${runId}`,uniform_color:'gray'});
    rows.epi_profession_items=insert('epi_profession_items',{profession_code:rows.epi_professions.code,item_id:itemId,recommended_quantity:1});
    rows.epi_requests=insert('epi_requests',{employee_id:mariaEmployee,team_id:team,item_id:itemId,quantity:1});
    const destinationBatch=insert('epi_stock_batches',{item_id:itemId,quantity:3,created_by:admin.id});
    rows.epi_stock_transfers=insert('epi_stock_transfers',{origin_batch_id:batchId,destination_batch_id:destinationBatch.id,quantity:1,team_id:team,occurred_at:new Date().toISOString(),created_by:admin.id});
    rows.inventory=insert('inventory',{item_id:rows.items.id,team_id:team,quantity:10});
    rows.movements=insert('movements',{item_id:rows.items.id,quantity:1,movement_type:'consumption',origin_team_id:team,performed_by:admin.id});
    rows.operation_reasons=insert('operation_reasons',{scope:'epi_delivery',code:`p1_${runId}`,label:'Motivo sintetico'});
    rows.profile_access_audit=insert('profile_access_audit',{profile_id:maria.id,new_access:{synthetic:true}});
    rows.profiles=obj(`select to_jsonb(t) from public.profiles t where id=${literal(maria.id)}::uuid`);
    rows.rental_admin_details=insert('rental_admin_details',{asset_id:rows.assets.id,updated_by:admin.id,note:'Detalhe sintetico'});
    rows.rental_return_requests=insert('rental_return_requests',{asset_id:rows.assets.id,team_id:team,note:'Devolucao sintetica',occurred_at:new Date().toISOString(),created_by:admin.id});
    rows.site_operation_receipts=insert('site_operation_receipts',{id:randomUUID(),actor_id:admin.id,command:'p1_synthetic',payload:{},occurred_at:new Date().toISOString()});
    rows.supply_orders=insert('supply_orders',{team_id:team,created_by:admin.id,note:'Pedido sintetico'});
    rows.supply_order_lines=insert('supply_order_lines',{order_id:rows.supply_orders.id,kind:'material',description:'Linha sintetica',quantity:1,item_id:rows.items.id});
    rows.supply_order_events=insert('supply_order_events',{order_id:rows.supply_orders.id,event:'submitted',occurred_at:new Date().toISOString(),recorded_by:admin.id});
    check('P1','todas as tentativas PATCH/DELETE possuem alvo existente',tables.every(t=>Boolean(rows[t.name])),`${Object.keys(rows).length} tabelas`);
    const all=[...tables.map(t=>`public.${ident(t.name)}`),'private.employee_identity','private.employee_portal_accounts','private.employee_identity_audit'];
    const fingerprint=()=>{
      const values=obj(`select json_build_object(${all.map(t=>`${literal(t)},(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]') from ${t} r)`).join(',')})`);
      return Object.fromEntries(Object.entries(values).map(([table,list])=>[table,{rows:list.length,sha256:createHash('sha256').update(JSON.stringify(list)).digest('hex')}]));
    };
    out.rest_fingerprints={before:fingerprint(),after_by_actor:{}};
    const denied=response=>response.status===403&&response.data?.code==='42501';
    for(const [viewer,user,other,otherEmployee,session] of [['Joao',joao,maria,mariaEmployee,joaoSession],['Maria',maria,joao,joaoEmployee,mariaSession]]){
      for(const table of tables){
        let row=rows[table.name];
        if(table.name==='profiles')row=obj(`select to_jsonb(t) from public.profiles t where id=${literal(other.id)}::uuid`);
        if(table.name==='epi_employees')row=obj(`select to_jsonb(t) from public.epi_employees t where id=${literal(otherEmployee)}::uuid`);
        const query=new URLSearchParams(Object.fromEntries(table.pk.map(k=>[k,`eq.${row[k]}`]))).toString();
        const post={...row};
        if('id' in post)post.id=randomUUID();
        for(const key of ['created_at','updated_at','recorded_at'])delete post[key];
        const column=['full_name','name','note','notes','description','label','required_quantity','recommended_quantity','quantity','active','updated_at'].find(k=>k in row)??table.pk[0];
        const old=row[column];
        const patch={[column]:typeof old==='number'?old+1:typeof old==='boolean'?!old:column==='updated_at'?new Date().toISOString():column===table.pk[0]?old:'Sintetico P1'};
        for(const [method,body,path] of [['POST',post,table.name],['PATCH',patch,`${table.name}?${query}`],['DELETE',undefined,`${table.name}?${query}`]]){
          const response=await request(`/rest/v1/${path}`,{method,bearer:session.access_token,body,headers:{Prefer:'return=representation,count=exact'}});
          const zeroRows=['PATCH','DELETE'].includes(method)&&response.status===200&&Array.isArray(response.data)&&response.data.length===0;
          const ok=denied(response)||zeroRows;
          out.rest_matrix.push({viewer,table:table.name,method,target_exists:true,target_pk:Object.fromEntries(table.pk.map(k=>[k,row[k]])),payload:body??null,status:response.status,response:response.data,classification:denied(response)?'negacao_SQL_42501':zeroRows?'RLS_zero_linhas_em_alvo_existente':'NAO_COMPROVADO',ok});
          check('P1',`${viewer} ${method} ${table.name}`,ok,`HTTP ${response.status}, ${response.data?.code??(Array.isArray(response.data)?response.data.length+' linhas':'sem codigo')}`);
        }
      }
      const active=await request(`/rest/v1/profiles?id=eq.${user.id}`,{method:'PATCH',bearer:session.access_token,body:{active:true},headers:{Prefer:'return=representation'}});
      const activeOk=denied(active)||(active.status===200&&Array.isArray(active.data)&&active.data.length===0);
      out.rest_matrix.push({viewer,table:'profiles',method:'PATCH',own_active_escalation:true,status:active.status,response:active.data,ok:activeOk});
      check('P1',`${viewer} nao ativa o proprio perfil Gestao`,activeOk);
      const after=fingerprint();out.rest_fingerprints.after_by_actor[viewer]=after;
      const unchanged=JSON.stringify(after)===JSON.stringify(out.rest_fingerprints.before);
      check('P1',`${viewer} fingerprints SHA256 de 33 tabelas inalterados`,unchanged);
      if(!unchanged)throw new Error('P1: alteracao de negocio detectada; interromper e investigar.');
    }
    // Query nominal valida: admin precisa conseguir ver o fixture antes da negativa.
    const introspection=await request('/graphql/v1',{method:'POST',bearer:joaoSession.access_token,body:{query:'{ __type(name:"Query") { fields { name } } }'}});
    out.graphql_introspection=introspection;
    const collection='epi_employeesCollection';
    const query=id=>`{ ${collection}(filter: {id: {eq: "${id}"}}, first: 10) { edges { node { id full_name aso_expiry_date } } } }`;
    const adminGraph=await request('/graphql/v1',{method:'POST',bearer:adminSession.access_token,body:{query:query(mariaEmployee)}});
    const adminEdges=adminGraph.data?.data?.[collection]?.edges;
    out.graphql_admin_control={status:adminGraph.status,rows:adminEdges?.length??null,found_maria:adminEdges?.some(e=>e.node.id===mariaEmployee)??false,aso_column_present:adminEdges?.some(e=>Object.hasOwn(e.node,'aso_expiry_date'))??false,errors:adminGraph.data?.errors??null};
    const rootFields=introspection.data?.data?.__type?.fields?.map(f=>f.name);
    out.graphql_runtime=obj(`select json_build_object('extension_enabled',exists(select 1 from pg_extension where extname='pg_graphql'),'resolver_present',to_regprocedure('graphql.resolve(text,text,jsonb,jsonb)') is not null,'wrapper',pg_get_functiondef('graphql_public.graphql(text,text,jsonb,jsonb)'::regprocedure))`);
    const disabledResponse=r=>r.status===200&&r.data?.data==null&&r.data?.errors?.length===1&&r.data.errors[0].message==='pg_graphql extension is not enabled.';
    const disabled=!out.graphql_runtime.extension_enabled&&!out.graphql_runtime.resolver_present&&disabledResponse(adminGraph)&&disabledResponse(introspection);
    const notExposed=Array.isArray(rootFields)&&!rootFields.includes(collection);
    check('P2','controle admin confirma query valida ou objeto comprovadamente indisponivel',Boolean(adminEdges?.some(e=>e.node.id===mariaEmployee))||notExposed||disabled,out.graphql_admin_control);
    for(const [viewer,session,target] of [['Joao',joaoSession,mariaEmployee],['Maria',mariaSession,joaoEmployee]]){
      const response=await request('/graphql/v1',{method:'POST',bearer:session.access_token,body:{query:query(target)}});
      const edges=response.data?.data?.[collection]?.edges;
      const empty=response.status===200&&Array.isArray(edges)&&edges.length===0&&!response.data?.errors;
      const unexposed=notExposed&&Boolean(response.data?.errors?.some(e=>/Unknown field|does not exist|Cannot query field/i.test(e.message)));
      const extensionAbsent=disabled&&disabledResponse(response);
      out.graphql.push({viewer,query:query(target),status:response.status,response:response.data,classification:empty?'RLS_sem_linhas':unexposed?'objeto_nao_exposto':extensionAbsent?'pg_graphql_desabilitada_sem_objetos_nao_e_prova_RLS':'NAO_COMPROVADO'});
      check('P2',`${viewer} GraphQL nao retorna colega nem ASO`,empty||unexposed||extensionAbsent,`HTTP ${response.status}; ${extensionAbsent?'extensao desabilitada, sem prova de RLS GraphQL':'resultado da query'}`);
    }
    // A-09: fluxo real de Gestao, sem reaproveitamento para portal.
    const email=`gestao-${runId}@example.invalid`;
    const created=await request('/functions/v1/create-employee',{method:'POST',bearer:adminSession.access_token,body:{full_name:'Pessoa Gestao Sintetica',email,password:`Gestao!7${randomBytes(20).toString('base64url')}`,role:'collaborator',team_id:teamId}});
    const managementId=created.data?.user_id;
    check('A-09','create-employee Gestao cria conta real local',created.status===200&&Boolean(managementId),`HTTP ${created.status}`);
    if(!managementId)throw new Error('A-09: conta Gestao nao criada');
    const managementState=obj(`select json_build_object('active',p.active,'role',p.role,'portal_marker',u.raw_app_meta_data->>'metallo_account_type') from public.profiles p join auth.users u on u.id=p.id where p.id=${literal(managementId)}::uuid`);
    check('A-09','perfil Gestao ativo e sem marcador portal',managementState.active===true&&managementState.role==='collaborator'&&managementState.portal_marker===null,managementState);
    out.management_registration=[];
    for(const active of [true,false]){
      if(!active)sql(`update public.profiles set active=false where id=${literal(managementId)}::uuid`);
      const response=await rpc('admin_register_portal_account',{p_auth_user_id:managementId});
      out.management_registration.push({profile_active:active,...response});
      check('A-09',`conta Gestao ${active?'ativa':'inativa sem marcador'} recusada como portal`,response.status===400&&response.data?.message==='dedicated_portal_account_required');
    }
    sql(`update public.profiles set active=true where id=${literal(managementId)}::uuid`);
    // P5: usuario dedicado; falha de exclusao deve preservar Auth e todo historico.
    const target=await c.createUser('Portal Exclusao Sintetico','delete',runId);
    const employee=c.createEmployee(target,`LAB-D-${runId}`,'2027-09-01');
    const register=await rpc('admin_register_portal_account',{p_auth_user_id:target.id});
    const linked=await rpc('admin_link_employee_identity',{p_auth_user_id:target.id,p_employee_id:employee,p_expected_employee_name:target.name,p_expected_registration_code:`LAB-D-${runId}`,p_verification_method:'in_person'});
    check('P5','conta alvo vinculada por fluxo dedicado',register.status===204&&linked.status===200);
    const before=snapshotUser(target.id);
    const deleted=await request('/functions/v1/delete-employee',{method:'POST',bearer:adminSession.access_token,body:{user_id:target.id}});
    const after=snapshotUser(target.id);
    out.delete_test={before,response:deleted,after,fks:obj(`select json_agg(json_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid),'delete_action',confdeltype)) from pg_constraint where contype='f' and connamespace='private'::regnamespace and confrelid='auth.users'::regclass`)};
    check('P5','delete-employee falha de forma fechada e controlada',deleted.status===400&&typeof deleted.data?.error==='string'&&deleted.data?.ok!==true,deleted);
    check('P5','Auth identidade conta e auditoria preservados',Boolean(after.auth)&&JSON.stringify(before)===JSON.stringify(after));
    const authAfter=await request(`/auth/v1/admin/users/${target.id}`,adminAuth);
    check('P5','Auth confirma usuario ainda existente',authAfter.status===200&&authAfter.data?.id===target.id,`HTTP ${authAfter.status}`);
    check('P5','FKs de identidade e conta usam ON DELETE RESTRICT',out.delete_test.fks.length>=4&&out.delete_test.fks.every(f=>f.delete_action==='r'));
    // SUPERADA EM 26/09/2026 PELA DECISAO DE EQUIPE OPCIONAL: equipe inativa nao zera DTO.
    out.inactive_team={product_decision:"APROVADA: funcionario ativo conserva perfil e login sem equipe; team_name=null significa Sem equipe atribuida.",states:[],restorations:[]};
    for(const [person,personEmployee,personSession,actor] of [[maria,mariaEmployee,mariaSession,"Maria"],[joao,joaoEmployee,joaoSession,"Joao"]]) {
    const isolated=insert('teams',{name:`Equipe A13 ${actor} ${runId}`,location_type:'field'});
    const identityBeforeTeam=snapshotUser(person.id);
    sql(`update public.epi_employees set team_id=${literal(isolated.id)}::uuid where id=${literal(personEmployee)}::uuid`);
    try {
      const expectedProfile=team=>({employee_id:personEmployee,full_name:person.name,profession:'Profissao Teste',team_name:team});
      const ownProfile=(r,team)=>r.status===200&&Array.isArray(r.data)&&r.data.length===1&&
        JSON.stringify(Object.keys(r.data[0]).sort())===JSON.stringify(Object.keys(expectedProfile(team)).sort())&&
        Object.entries(expectedProfile(team)).every(([key,value])=>r.data[0][key]===value);
      for(const state of ['ativa','inativa','ausente','removida']){
        if(state==='inativa')sql(`update public.teams set active=false where id=${literal(isolated.id)}::uuid`);
        if(state==='ausente')sql(`update public.epi_employees set team_id=null where id=${literal(personEmployee)}::uuid`);
        // Remocao fisica so apos desvincular. Nenhuma FK desabilitada ou alterada.
        if(state==='removida')sql(`delete from public.teams where id=${literal(isolated.id)}::uuid`);
        const conditions=obj(`select json_build_object('identity_active',i.status='active','employee_active',e.active,'team_id',e.team_id,'team_active',t.active,'synthetic_team_exists',exists(select 1 from public.teams where id=${literal(isolated.id)}::uuid)) from private.employee_identity i join public.epi_employees e on e.id=i.employee_id left join public.teams t on t.id=e.team_id where i.auth_user_id=${literal(person.id)}::uuid`);
        const teamName=state==='ativa'?isolated.name:null;
        const existing=await dto(personSession.access_token);
        check('A-13',`${actor} ${state}: precondicao e identidade ativa`,conditions.identity_active&&conditions.employee_active&&
          (state==='ativa'?conditions.team_active===true:state==='inativa'?conditions.team_active===false:conditions.team_id===null)&&
          (state!=='removida'||conditions.synthetic_team_exists===false));
        check('A-13',`${actor} ${state}: JWT existente preserva DTO minimo proprio`,ownProfile(existing,teamName));
        const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:person.email,password:person.password}});
        check('A-13',`${actor} ${state}: novo login Auth permitido`,login.status===200&&login.data?.user?.id===person.id&&Boolean(login.data?.access_token));
        if(!login.data?.access_token)throw new Error('A-13: login sem equipe falhou');
        const freshDto=await dto(login.data.access_token);
        check('A-13',`${actor} ${state}: JWT de novo login recebe perfil proprio`,ownProfile(freshDto,teamName));
        const refresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:login.data.refresh_token}});
        const refreshedDto=refresh.data?.access_token?await dto(refresh.data.access_token):null;
        check('A-13',`${actor} ${state}: refresh permitido sem perda de perfil`,refresh.status===200&&refresh.data?.user?.id===person.id&&refreshedDto&&ownProfile(refreshedDto,teamName));
        const cross=[];
        for(const [viewer,token,otherId] of [['Joao',c.joaoSession.access_token,c.mariaEmployee],['Maria',c.mariaSession.access_token,c.joaoEmployee]]){
          const filtered=await request(`/rest/v1/rpc/my_employee_profile?employee_id=eq.${otherId}`,{method:'POST',bearer:token,body:{}});
          const direct=await request(`/rest/v1/epi_employees?select=id,full_name,aso_expiry_date&id=eq.${otherId}`,{bearer:token});
          const ok=[filtered,direct].every(r=>r.status===200&&Array.isArray(r.data)&&r.data.length===0);
          check('A-13',`${actor} ${state}: ${viewer} nao le perfil nem ASO do colega`,ok);
          cross.push({viewer,filtered,direct});
        }
        const identityAfter=snapshotUser(person.id);
        check('A-13',`${actor} ${state}: conta identidade auditoria e ban inalterados`,JSON.stringify(identityBeforeTeam)===JSON.stringify(identityAfter));
        out.inactive_team.states.push({actor,state,conditions,dto:existing,login:{status:login.status,user_id:login.data.user.id,token_issued:true},fresh_dto:freshDto,refresh:{status:refresh.status,token_issued:Boolean(refresh.data?.access_token)},refreshed_dto:refreshedDto,cross,identity_unchanged:JSON.stringify(identityBeforeTeam)===JSON.stringify(identityAfter)});
      }
      sql(`update public.epi_employees set active=false where id=${literal(personEmployee)}::uuid`);
      const inactiveEmployee=await dto(personSession.access_token);
      check('A-13',`${actor} funcionario inativo continua sem DTO mesmo sem equipe`,inactiveEmployee.status===200&&inactiveEmployee.data?.length===0);
      (out.inactive_team.inactive_employees??=[]).push({actor,response:inactiveEmployee});
    } finally {
      sql(`update public.epi_employees set active=true,team_id=${literal(teamId)}::uuid where id=${literal(personEmployee)}::uuid`);
      sql(`delete from public.teams where id=${literal(isolated.id)}::uuid`);
    }
    const restoredDto=await dto(personSession.access_token);
    check('A-13',`${actor} reatribuicao de equipe ativa restaura nome sem novo vinculo`,restoredDto.status===200&&restoredDto.data?.[0]?.employee_id===personEmployee&&typeof restoredDto.data[0].team_name==='string'&&JSON.stringify(identityBeforeTeam)===JSON.stringify(snapshotUser(person.id)));
    out.inactive_team.restorations.push({actor,response:restoredDto});
    }
    // P3: Joao autentica, SQL confirma, transporte ban falha, retry normal conclui.
    sql(`update public.epi_employees set team_id=null where id=${literal(joaoEmployee)}::uuid`);
    check('P3','Joao sem equipe tem perfil antes da revogacao',
      (await dto(joaoSession.access_token)).data?.[0]?.employee_id===joaoEmployee);
    const login=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:joao.email,password:joao.password}});
    check('P3','Joao autenticado antes da falha',login.status===200&&Boolean(login.data?.access_token));
    if(login.status!==200)throw new Error('P3 login falhou');
    const body={identity_id:identities.get(joao.id),reason:'employment_ended'};
    const mariaBeforeFault=snapshotUser(maria.id);
    const forbiddenFault=await request('/functions/v1/lab-revoke-auth-failure',{method:'POST',bearer:login.data.access_token,body:{identity_id:identities.get(maria.id),reason:'other'}});
    check('P3','endpoint de ensaio tambem exige admin e preserva Maria',forbiddenFault.status===403&&JSON.stringify(mariaBeforeFault)===JSON.stringify(snapshotUser(maria.id)),`HTTP ${forbiddenFault.status}`);
    const beforeRevocation=snapshotUser(joao.id);
    const failed=await request('/functions/v1/lab-revoke-auth-failure',{method:'POST',bearer:adminSession.access_token,body});
    const middle=snapshotUser(joao.id);
    const emptyDto=await dto(login.data.access_token);
    const refresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:login.data.refresh_token}});
    const refreshToken=refresh.data?.refresh_token??login.data.refresh_token;
    const refreshedDto=refresh.data?.access_token?await dto(refresh.data.access_token):null;
    out.partial_revocation={before:beforeRevocation,injected_failure:failed,middle,dto_with_old_token:emptyDto,refresh_intermediate:{status:refresh.status,token_issued:Boolean(refresh.data?.access_token)},dto_with_refreshed_token:refreshedDto};
    check('P3','falha de transporte apos SQL retorna 502 auth_ban_pending',failed.status===502&&failed.data?.error==='auth_ban_pending',failed);
    if(failed.status!==502||failed.data?.error!=='auth_ban_pending')throw new Error('P3: injecao nao atingiu a etapa de ban; nao executar retries com precondicao incorreta.');
    check('P3','SQL revogado antes de ban Auth',middle.identity?.status==='revoked'&&!middle.auth?.banned_until);
    check('P3','access token antigo continua roteavel mas DTO vazio',emptyDto.status===200&&emptyDto.data?.length===0,emptyDto);
    check('P3','refresh intermediario observado sem reabrir DTO',refresh.status===200&&Boolean(refresh.data?.access_token)&&refreshedDto?.status===200&&refreshedDto.data?.length===0,`refresh HTTP ${refresh.status}; dados permanecem bloqueados`);
    const different=await request('/functions/v1/revoke-portal-account',{method:'POST',bearer:adminSession.access_token,body:{...body,reason:'other'}});
    const afterDifferent=snapshotUser(joao.id);
    out.partial_revocation.different_reason={response:different,after:afterDifferent};
    check('P3','motivo diferente retorna erro controlado e nao modifica historico',different.status===400&&different.data?.error==='identity_revocation_denied'&&JSON.stringify(middle)===JSON.stringify(afterDifferent),different);
    const retry=await request('/functions/v1/revoke-portal-account',{method:'POST',bearer:adminSession.access_token,body});
    const final=snapshotUser(joao.id);
    const deniedRefresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}});
    const deniedLogin=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:joao.email,password:joao.password}});
    out.partial_revocation.retry=retry;out.partial_revocation.final=final;
    out.partial_revocation.refresh_after={status:deniedRefresh.status,error_code:deniedRefresh.data?.error_code};
    out.partial_revocation.login_after={status:deniedLogin.status,error_code:deniedLogin.data?.error_code};
    check('P3','retry mesmo motivo conclui ban Auth',retry.status===200&&retry.data?.ok===true&&Boolean(final.auth?.banned_until));
    check('P3','retry nao duplica auditoria',JSON.stringify(middle.audit)===JSON.stringify(final.audit)&&middle.audit.length===beforeRevocation.audit.length+1);
    check('P3','refresh apos retry negado pelo Auth',deniedRefresh.status===400,`HTTP ${deniedRefresh.status}`);
    check('P3','novo login apos retry negado pelo Auth',deniedLogin.status===400,`HTTP ${deniedLogin.status}`);
    const finalDto=await dto(login.data.access_token);
    check('P3','JWT antigo ainda aceito pelo gateway sem acesso pessoal',finalDto.status===200&&finalDto.data?.length===0);
  } catch(error) { out.error=String(error.message??error); throw error;
  } finally {
    out.finished_at=new Date().toISOString();out.passed=!out.error&&out.checks.length>0&&out.checks.every(x=>x.ok);
    writeFileSync(new URL(`./${process.env.METALLO_EVIDENCE_REVISION === '2d' ? '../laboratorio-marco-2d' : process.env.METALLO_EVIDENCE_REVISION === '2b' ? '../laboratorio-marco-2b' : process.env.METALLO_EVIDENCE_REVISION === '1c' ? 'marco-1c' : process.env.METALLO_EVIDENCE_REVISION === 'r2' ? 'saneamento-r2' : 'auditoria-complementar'}/resultado-complementar.json`,import.meta.url),JSON.stringify(out,null,2)+'\n');
  }
}
