// Bootstrap de NOVO núcleo descartável e 50 identidades Auth locais distintas.
// Senhas/JWT/refresh ficam apenas na memória; zero alteração da história da prévia.
import assert from 'node:assert/strict';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createPreviewAdminSession,sql,quote } from '../laboratorio-marco-1a/criar-contas-previa-1b.mjs';
import { createLabCore } from '../laboratorio-marco-2b/nucleo.mjs';
import { createLabAuth } from '../laboratorio-marco-2b/auth-local.mjs';
import { initializeAuthorization } from '../laboratorio-marco-2b/autorizacao.mjs';
import { finishAnchor,stateOf } from '../laboratorio-marco-2b/recuperacao.mjs';
import { inventory,verifyIntegrity } from '../laboratorio-marco-2b/integridade.mjs';
import { createLocalSource } from '../laboratorio-marco-2f/reconciliacao.mjs';
import { createCurrentResources } from '../laboratorio-marco-4c/abrir-laboratorio.mjs';
import { installExtension } from '../laboratorio-marco-4a/extensao.mjs';
import { root,status,local } from '../laboratorio-marco-4a/ambiente.mjs';
export async function api(path,body,token=status.SERVICE_ROLE_KEY){
 assert.ok(path.startsWith('/'));const r=await local(path,token,body,token===status.SERVICE_ROLE_KEY?status.SERVICE_ROLE_KEY:status.ANON_KEY);
 assert.ok(r.ok,`API local ${path.split('?')[0]} HTTP ${r.status}`);return r.status===204?null:r.json();
}
export async function login(u){return api('/auth/v1/token?grant_type=password',{email:u.email,password:u.password},status.ANON_KEY);}
export async function fixtures({milestone='4B',historicalPerUser=22,reuseIdentities=null,telemetry=null,incremental=false}={}){
 assert.ok(['4B','4C'].includes(milestone));
 assert.ok(Number.isInteger(historicalPerUser)&&historicalPerUser>0&&historicalPerUser<=100);
 assert.ok(milestone==='4C'||historicalPerUser===22&&!reuseIdentities&&!telemetry);
 const run=randomUUID(),users=[];let adminSession,team;
 if(!reuseIdentities){
  ({adminSession}=await createPreviewAdminSession());
  team=sql(`insert into public.teams(name,location_type,active) values('Equipe Carga Sintética ${run}','field',true) returning id`);
 }
 const resources=incremental?createCurrentResources({anonKey:status.ANON_KEY,serviceKey:status.SERVICE_ROLE_KEY,telemetry}):null;
 const transport=resources?.transport??null,auth=resources?.auth??createLabAuth(status.ANON_KEY,fetch,{requireSession:true,serviceKey:status.SERVICE_ROLE_KEY});
 if(reuseIdentities){assert.equal(reuseIdentities.length,50);users.push(...reuseIdentities);}
 else for(let n=0;n<50;n++){
  const name=`Carga 4B Sintética ${String(n+1).padStart(2,'0')}`,email=`carga-4b-${run}-${n}@example.invalid`,password=randomBytes(24).toString('base64url'),ticket=randomUUID();
  await api('/rest/v1/rpc/issue_user_provisioning_ticket',{p_email:email,p_token:ticket});
  const a=await api('/auth/v1/admin/users',{email,password,email_confirm:true,user_metadata:{full_name:name,metallo_provisioning_token:ticket},app_metadata:{metallo_provisioned:true,metallo_account_type:'employee_portal'}});
  const code=`CARGA-4B-${run}-${n}`,noTeam=n%10===0;
  const employeeId=sql(`insert into public.epi_employees(full_name,registration_code,profession,team_id,created_by) values(${quote(name)},${quote(code)},'Sintético de carga',${noTeam?'null':quote(team)+'::uuid'},${quote(adminSession.user.id)}::uuid) returning id`);
  await api('/rest/v1/rpc/admin_register_portal_account',{p_auth_user_id:a.id},adminSession.access_token);
  const identityId=await api('/rest/v1/rpc/admin_link_employee_identity',{p_auth_user_id:a.id,p_employee_id:employeeId,p_expected_employee_name:name,p_expected_registration_code:code,p_verification_method:'in_person'},adminSession.access_token);
  const session=await login({email,password}),person=await auth.verifyPersonal(session.access_token);
  assert.equal(person.employeeId,employeeId);users.push({index:n,email,password,identityId,noTeam,person,token:session.access_token,refresh:session.refresh_token});
 }
 assert.equal(new Set(users.map(u=>u.person.authUserId)).size,50);assert.equal(new Set(users.map(u=>u.person.sessionId)).size,50);assert.equal(new Set(users.map(u=>u.token)).size,50);
 const dir=resolve(root,`backups/marco-${milestone.toLowerCase()}-ensaios/carga-`+run),authorizationPath=dir+'.authorization.json';
 let core=await createLabCore(dir,{mode:'create'});
 for(const u of users)await core.seedSynthetic({authUserId:u.person.authUserId,employeeId:u.person.employeeId,workerRef:`LAB-CARGA-${u.index}`,employmentRef:`LAB-CARGA-V-${u.index}`,validMinutes:1440});
 // Dados históricos declaradamente fabricados ANTES da medição, no banco novo.
 // 22 eventos por pessoa: 21 entre 3 e 53 dias; um fora dos 60 dias.
 // Isto mede leitura/paginação histórica; não finge gravações históricas HTTP.
 const now=Date.now();await core.db.transaction(async tx=>{
  for(const u of users)for(let n=0;n<historicalPerUser;n++){
   const at=new Date(now-(n===21?61*24:72+n*60)*3600000).toISOString();
   const values=[randomUUID(),u.person.authUserId,randomUUID(),1,`LAB-CARGA-${u.index}`,`LAB-CARGA-V-${u.index}`,'LAB-EMPREGADOR','LAB-ESTABELECIMENTO',1,at,at,'metallo-colaborador-lab-2b','metallo-colaborador-lab'];
   const hash=createHash('sha256').update(JSON.stringify(values)).digest('hex');
   await tx.query('insert into lab_time_event(event_id,auth_user_id,idempotency_key,contract_version,worker_snapshot_ref,employment_snapshot_ref,employer_snapshot_ref,establishment_snapshot_ref,context_version,server_received_at_utc,server_committed_at_utc,collector_version,channel,payload_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[...values,hash]);
   await tx.query('insert into lab_intent_result values($1,$2,$3,$4)',[values[2],values[1],createHash('sha256').update('[1]').digest('hex'),values[0]]);
  }
  await tx.query('update lab_recovery_state set recovery_epoch=$1',[50*historicalPerUser]);
 });
 await core.db.syncToFs(false);finishAnchor(dir+'.anchor.json',stateOf(await inventory(core.db)));
 assert.equal((await verifyIntegrity(core.db)).passed,true);
 const databaseId=(await core.db.query('select database_id from lab_recovery_state')).rows[0].database_id;await core.close();initializeAuthorization(authorizationPath,databaseId);
 core=await createLabCore(dir,{authorizationPath});for(const u of users)await core.registerAuthorization(u.person.authUserId,u.person.employeeId);await core.close();
 core=resources?await resources.openCore(dir,{authorizationPath}):await createLabCore(dir,{authorizationPath,source:createLocalSource(status.SERVICE_ROLE_KEY),telemetry,integrityMode:'full'});await installExtension(core);
 return {run,core,auth,transport,users,adminToken:adminSession?.access_token,dir};
}
