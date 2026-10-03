// Marco 1C: Auth/JWT/PostgREST reais, exclusivamente no laboratório sintético.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base, anon, sql, quote, createPreviewAccounts, revokePreviewAccount } from '../criar-contas-previa-1b.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../..');
const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
const status=JSON.parse(execFileSync(process.execPath,[cli,'status','--workdir',resolve(here,'..'),'-o','json'],{encoding:'utf8'}));
assert.equal(base,'http://127.0.0.1:54321');
assert.equal(status.API_URL,base);
assert.ok(!status.PROJECT_REF,'Executor 1C não aceita projeto remoto');
const saved=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const checks=[]; const network=[];
function check(name,ok,detail=''){checks.push({name,ok:Boolean(ok),detail});if(!ok)throw new Error(`Falha 1C: ${name}`);}
function stableId(value){const b=createHash('sha256').update(`metallo-1c:${value}`).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
function uuid(value){assert.match(value,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);return value;}
async function call(path,token,body={},method='POST'){
  const url=new URL(path,base);assert.equal(url.origin,base);
  const response=await fetch(url,{method,headers:{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json','Cache-Control':'no-store'},body:method==='GET'?undefined:JSON.stringify(body),redirect:'error',cache:'no-store'});
  network.push({origin:url.origin,path:url.pathname,status:response.status});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
  return {status:response.status,data};
}
async function login(account){const r=await call('/auth/v1/token?grant_type=password',anon,{email:account.email,password:account.password});assert.equal(r.status,200);assert.ok(r.data?.access_token&&r.data?.refresh_token);return r.data;}
async function work(token,path='/rest/v1/rpc/my_current_work',body={}){return call(path,token,body);}
const admin=sql("select id from public.profiles where role='admin' and active order by created_at desc limit 1");uuid(admin);
function ensureWork(kind,account){
  const team=stableId(`team:${account.employeeId}`),site=stableId(`work:${account.employeeId}`),assignment=stableId(`assignment:${account.employeeId}`);
  const name=`Obra Sintética 1C ${kind}`;
  sql(`insert into public.teams(id,name,location_type,active) values (${quote(team)}::uuid,${quote(`Equipe Sintética 1C ${kind}`)},'field',true) on conflict(id) do update set active=true`);
  sql(`insert into public.worksites(id,name,stock_team_id,created_by,active) values (${quote(site)}::uuid,${quote(name)},${quote(team)}::uuid,${quote(admin)}::uuid,true) on conflict(id) do update set name=excluded.name,active=true`);
  sql(`update public.teams set worksite_id=${quote(site)}::uuid where id=${quote(team)}::uuid`);
  sql(`insert into public.employee_assignments(id,employee_id,team_id,starts_at,created_by) values (${quote(assignment)}::uuid,${quote(account.employeeId)}::uuid,${quote(team)}::uuid,now()-interval '1 hour',${quote(admin)}::uuid) on conflict(id) do update set team_id=excluded.team_id,starts_at=excluded.starts_at,ends_at=null`);
  return {team,site,assignment,name};
}
function oldTeam(employeeId){return sql(`select coalesce(team_id::text,'') from public.epi_employees where id=${quote(uuid(employeeId))}::uuid`);}
function setTeam(employeeId,team){sql(`update public.epi_employees set team_id=${team?`${quote(uuid(team))}::uuid`:'null'} where id=${quote(uuid(employeeId))}::uuid`);}
const report={at:new Date().toISOString(),scope:'Marco 1C exclusivo; não soma ao gate 682',baseline:'METALLO-1B-LAB-20260927-R2',checks,network,remote_writes:false,passed:false};
try {
  const transientFor2e=['2e','2f'].includes(process.env.METALLO_EVIDENCE_REVISION)?await createPreviewAccounts():null;
  const joaoSite=ensureWork('João',saved.joao),mariaSite=ensureWork('Maria',saved.maria);
  check('fixtures João e Maria têm obras distintas',joaoSite.site!==mariaSite.site);
  const joao=await login(saved.joao),maria=await login(saved.maria);
  for(const [key,account,session,own,other] of [['João',saved.joao,joao,joaoSite,mariaSite],['Maria',saved.maria,maria,mariaSite,joaoSite]]){
    const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
    check(`${key} JWT real do titular`,claims.sub===account.id&&claims.role==='authenticated');
    const r=await work(session.access_token);
    check(`${key} recebe só a própria obra`,r.status===200&&r.data?.length===1&&r.data[0].work_id===own.site&&r.data[0].work_name===own.name);
    check(`${key} DTO whitelist exata`,Object.keys(r.data[0]).sort().join()==='work_id,work_name'&&!/aso|cpf|cnpj|estoque|orçamento/i.test(JSON.stringify(r.data)));
    check(`${key} não recebe obra do outro`,!JSON.stringify(r.data).includes(other.site)&&!JSON.stringify(r.data).includes(other.name));
    const filter=await work(session.access_token,`/rest/v1/rpc/my_current_work?work_id=eq.${other.site}`);
    check(`${key} filtro por ID alheio vazio`,filter.status===200&&Array.isArray(filter.data)&&filter.data.length===0);
    const extraEmployee=await work(session.access_token,'/rest/v1/rpc/my_current_work',{employee_id:other.site});
    check(`${key} parâmetro employee_id recusado`,extraEmployee.status>=400);
    const extraWork=await work(session.access_token,'/rest/v1/rpc/my_current_work',{work_id:other.site});
    check(`${key} parâmetro work_id recusado`,extraWork.status>=400);
    const table=await call(`/rest/v1/worksites?id=eq.${other.site}`,session.access_token,{},'GET');
    check(`${key} tabela administrativa não expõe obra alheia`,table.status===200&&Array.isArray(table.data)&&table.data.length===0);
    for (const tableName of ['worksites','teams','employee_assignments']) {
      const unfiltered=await call(`/rest/v1/${tableName}?select=*&limit=100`,session.access_token,{},'GET');
      check(`${key} JWT portal não lista ${tableName} sem filtro`,unfiltered.status===200&&Array.isArray(unfiltered.data)&&unfiltered.data.length===0);
    }
    const renewed=await call('/auth/v1/token?grant_type=refresh_token',anon,{refresh_token:session.refresh_token});
    check(`${key} refresh session real`,renewed.status===200&&renewed.data?.access_token);
    const after=await work(renewed.data.access_token);
    check(`${key} refresh mantém titular e obra`,after.status===200&&after.data?.[0]?.work_id===own.site);
    const newTab=await work(renewed.data.access_token);
    check(`${key} nova requisição sem cache mantém titular`,newTab.status===200&&newTab.data?.[0]?.work_id===own.site);
  }
  const expiraAccount=transientFor2e?.accounts.expira??saved.expira;
  const expira=await login(expiraAccount);
  let r=await work(expira.access_token);
  check('com equipe e sem obra preserva sessão, retorna vazio',r.status===200&&r.data?.length===0);
  const expiraHome=oldTeam(expiraAccount.employeeId);
  try {setTeam(expiraAccount.employeeId,null);r=await work(expira.access_token);check('sem equipe e sem obra retorna vazio',r.status===200&&r.data?.length===0);}
  finally {setTeam(expiraAccount.employeeId,expiraHome);}
  const joaoHome=oldTeam(saved.joao.employeeId);
  try {setTeam(saved.joao.employeeId,null);r=await work(joao.access_token);check('sem equipe no cadastro mas com alocação de obra',r.status===200&&r.data?.[0]?.work_id===joaoSite.site);}
  finally {setTeam(saved.joao.employeeId,joaoHome);}
  const mariaHome=oldTeam(saved.maria.employeeId);
  try {
    setTeam(saved.maria.employeeId,mariaSite.team);
    sql(`update public.employee_assignments set ends_at=now()-interval '1 second' where id=${quote(mariaSite.assignment)}::uuid`);
    r=await work(maria.access_token);
    check('alocação histórica encerrada não reaparece pelo time de cadastro',r.status===200&&r.data?.length===0);
  } finally {
    sql(`update public.employee_assignments set ends_at=null where id=${quote(mariaSite.assignment)}::uuid`);
    setTeam(saved.maria.employeeId,mariaHome);
  }
  const competing=stableId(`competing:${saved.maria.employeeId}`);
  try {
    sql(`insert into public.employee_assignments(id,employee_id,team_id,starts_at,created_by) values (${quote(competing)}::uuid,${quote(saved.maria.employeeId)}::uuid,${quote(joaoSite.team)}::uuid,now()-interval '30 minutes',${quote(admin)}::uuid) on conflict(id) do update set ends_at=null`);
    r=await work(maria.access_token);
    check('alocações vigentes concorrentes não escolhem obra arbitrária',r.status===200&&r.data?.length===0);
  } finally {sql(`delete from public.employee_assignments where id=${quote(competing)}::uuid`);}
  try {sql(`update public.teams set active=false where id=${quote(joaoSite.team)}::uuid`);r=await work(joao.access_token);check('equipe operacional inativa suprime obra sem revogar portal',r.status===200&&r.data?.length===0);}
  finally {sql(`update public.teams set active=true where id=${quote(joaoSite.team)}::uuid`);}
  try {sql(`update public.worksites set active=false where id=${quote(joaoSite.site)}::uuid`);r=await work(joao.access_token);check('obra inativa não é exibida',r.status===200&&r.data?.length===0);}
  finally {sql(`update public.worksites set active=true where id=${quote(joaoSite.site)}::uuid`);}
  const inactive=await login(saved.inativo);
  const inactiveAssignment=stableId(`inactive:${saved.inativo.employeeId}`);
  try {
    sql(`insert into public.employee_assignments(id,employee_id,team_id,starts_at,created_by) values (${quote(inactiveAssignment)}::uuid,${quote(saved.inativo.employeeId)}::uuid,${quote(mariaSite.team)}::uuid,now()-interval '1 hour',${quote(admin)}::uuid) on conflict(id) do update set ends_at=null`);
    r=await work(inactive.access_token);
    check('funcionário inativo não recebe DTO mesmo com vínculo de obra',r.status===200&&r.data?.length===0);
  } finally {sql(`delete from public.employee_assignments where id=${quote(inactiveAssignment)}::uuid`);}
  const transient=transientFor2e??await createPreviewAccounts();
  const revoked=transient.accounts.joao;
  check('conta nova para fallback não tem alocação anterior',sql(`select count(*) from public.employee_assignments where employee_id=${quote(revoked.employeeId)}::uuid`)==='0');
  const revokedHome=oldTeam(revoked.employeeId);
  try {
    setTeam(revoked.employeeId,joaoSite.team);
    r=await work((await login(revoked)).access_token);
    check('sem histórico de alocação, equipe de cadastro ativa fornece obra',r.status===200&&r.data?.[0]?.work_id===joaoSite.site);
  } finally {setTeam(revoked.employeeId,revokedHome);}
  const revokedAssignment=stableId(`revoke:${revoked.employeeId}`);
  sql(`insert into public.employee_assignments(id,employee_id,team_id,starts_at,created_by) values (${quote(revokedAssignment)}::uuid,${quote(revoked.employeeId)}::uuid,${quote(joaoSite.team)}::uuid,now()-interval '1 hour',${quote(admin)}::uuid)`);
  const prior=await login(revoked);
  r=await work(prior.access_token);
  check('conta sintética antes da revogação tem vínculo de obra',r.status===200&&r.data?.[0]?.work_id===joaoSite.site);
  await revokePreviewAccount(revoked.identityId,transient.adminAccessToken);
  r=await work(prior.access_token);
  check('identidade revogada bloqueia token de acesso antigo',r.status===200&&r.data?.length===0);
  const revokedRefresh=await call('/auth/v1/token?grant_type=refresh_token',anon,{refresh_token:prior.refresh_token});
  check('identidade revogada não renova sessão',revokedRefresh.status>=400);
  const revokedLogin=await call('/auth/v1/token?grant_type=password',anon,{email:revoked.email,password:revoked.password});
  check('identidade revogada não faz novo login',revokedLogin.status>=400);
  const anonCall=await work(anon);
  check('anon não executa my_current_work',anonCall.status===401||anonCall.status===403);
  check('todas as chamadas do ensaio usam origem loopback',network.length>0&&network.every(entry=>entry.origin===base));
  report.passed=true;
} catch (error) {
  report.error=error instanceof Error&&error.message.startsWith('Falha 1C:')?error.message:'Falha de execução; consultar console local sem divulgar segredos.';
  process.exitCode=1;
} finally {
  report.at_end=new Date().toISOString();
  const target=process.env.METALLO_EVIDENCE_REVISION==='2f'?resolve(here,'../../laboratorio-marco-2f/resultado-1c-regressao.json'):process.env.METALLO_EVIDENCE_REVISION==='2e'?resolve(here,'../../laboratorio-marco-2e/resultado-1c-regressao.json'):process.env.METALLO_EVIDENCE_REVISION==='2d'?resolve(here,'../../laboratorio-marco-2d/resultado-1c-regressao.json'):process.env.METALLO_EVIDENCE_REVISION==='2b'?resolve(here,'../../laboratorio-marco-2b/resultado-1c-regressao.json'):resolve(here,'resultado-real.json');
  if(['2e','2f'].includes(process.env.METALLO_EVIDENCE_REVISION)&&existsSync(target)){const prior=JSON.parse(readFileSync(target,'utf8'));report.previous_runs=[...(prior.previous_runs??[]),{at:prior.at,passed:prior.passed,error:prior.error??null,checks:prior.checks}];}
  writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.ok).map(c=>c.name),error:report.error??null}));
}
