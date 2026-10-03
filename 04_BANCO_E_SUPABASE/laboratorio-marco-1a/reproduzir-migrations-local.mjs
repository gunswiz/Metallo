// Replay real em banco temporario no container local, sem reset do laboratorio.
// Infraestrutura Auth/Storage e roles provem da pilha local; nenhum dado e copiado.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'../..');
const docker=join(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
const container='supabase_db_laboratorio-marco-1a';
const context=execFileSync(docker,['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
if(!context.startsWith('npipe:////./pipe/'))throw new Error('Docker deve ser local');
const database=`metallo_replay_${Date.now()}`;
if(!/^metallo_replay_[0-9]+$/.test(database)||database==='postgres')throw new Error('Banco temporario invalido');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const sql=(db,text,user='postgres')=>execFileSync(docker,['exec','-i',container,'psql','-X','-qAt','-U',user,'-d',db,'-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const json=(db,text)=>JSON.parse(sql(db,text));
const catalog=db=>json(db,`select json_build_object(
 'columns',(select jsonb_agg(to_jsonb(q) order by table_schema,table_name,ordinal_position) from (select table_schema,table_name,column_name,ordinal_position,data_type,is_nullable,column_default from information_schema.columns where table_schema in ('public','private')) q),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'definition',replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n'),'acl',p.proacl::text) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'),
 'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','private')),
 'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(c.oid)) order by conrelid::regclass::text,conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private') and c.contype<>'n'),
 'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth') and not t.tgisinternal),
 'grants',(select jsonb_agg(to_jsonb(q) order by table_schema,table_name,grantee,privilege_type) from (select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','private') and grantee in ('anon','authenticated','service_role')) q))`);
const migrations=['20260925120000_employee_identity_foundation.sql','20260926213000_portal_profile_optional_team.sql','20260926224000_unassigned_employee_management_scope.sql','20260926233500_personal_epi_explicit_team_scope.sql','20260927124559_personal_current_work.sql'];
const report={started_at:new Date().toISOString(),database,method:'Banco local temporario com infraestrutura schema-only da pilha atual. Schemas public/private removidos somente na copia; baseline reconstruida dos 42 SQLs e ajustes catalogados. Nao e replay da instalacao de Auth/Storage nem restore de dados.',checks:[],applied:[]};
const check=(name,ok)=>{report.checks.push({name,ok});if(!ok)throw new Error(name);};
let created=false;
try {
  const dump=execFileSync(docker,['exec',container,'pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner'],{encoding:'utf8',maxBuffer:16*1024*1024});
  report.infrastructure_dump_sha256=hash(dump);
  sql('postgres',`create database ${database} template template0;`);created=true;
  sql(database,dump,'supabase_admin');
  // Alvo e exclusivamente database validado e recem-criado, nunca postgres.
  sql(database,'drop schema public cascade; drop schema private cascade; create schema public authorization postgres; grant usage on schema public to postgres,anon,authenticated,service_role;','supabase_admin');
  // DROP SCHEMA remove seus default ACLs. Repor a infraestrutura da CLI com
  // auto_expose_new_tables padrao antes do historico; 1A revoga EXECUTE depois.
  const defaults=dump.split(/\r?\n/).filter(line=>/^ALTER DEFAULT PRIVILEGES .* IN SCHEMA public /.test(line)).join('\n');
  sql(database,defaults+'\nalter default privileges for role postgres in schema public grant all on functions to anon,authenticated;','supabase_admin');
  report.infrastructure_default_privileges=defaults;
  report.baseline_function_default='CLI auto-expose: EXECUTE anon/authenticated antes do historico; a migration 1A revoga esses defaults.';
  check('schemas de aplicacao vazios antes da baseline',json(database,"select count(*)::int from pg_tables where schemaname in ('public','private')")===0);
  const log=execFileSync('powershell.exe',['-NoProfile','-File',join(import.meta.dirname,'aplicar-baseline-local.ps1'),'-Database',database],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
  report.baseline_log=log;
  check('42 migrations de baseline aplicadas',(log.match(/Aplicada:/g)??[]).length===42);
  check('baseline ainda exige equipe',json(database,"select to_json(is_nullable='NO') from information_schema.columns where table_schema='public' and table_name='epi_employees' and column_name='team_id'")===true);
  for(const name of migrations){
    const source=readFileSync(join(root,'04_BANCO_E_SUPABASE/supabase/migrations',name),'utf8');
    sql(database,'begin;\n'+source+'\ncommit;');report.applied.push({name,sha256:hash(source)});
  }
  report.function_effective=json(database,"select to_jsonb(q) from (select pg_get_functiondef(p.oid) as definition,p.prosecdef as security_definer,p.proconfig as config,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as returns from pg_proc p where oid='public.my_employee_profile()'::regprocedure) q");
  check('equipe nullable apos optional_team',json(database,"select to_json(is_nullable='YES') from information_schema.columns where table_schema='public' and table_name='epi_employees' and column_name='team_id'")===true);
  const replay=catalog(database),live=catalog('postgres');
  report.comparisons=Object.keys(replay).map(key=>({category:key,replay_sha256:hash(replay[key]),live_sha256:hash(live[key]),equal:JSON.stringify(replay[key])===JSON.stringify(live[key])}));
  report.differences=Object.keys(replay).filter(key=>JSON.stringify(replay[key])!==JSON.stringify(live[key])).map(category=>({category,replay:replay[category].filter(r=>!live[category].some(l=>JSON.stringify(l)===JSON.stringify(r))),live:live[category].filter(l=>!replay[category].some(r=>JSON.stringify(l)===JSON.stringify(r)))}));
  check('replay equivale a aplicacao vigente em colunas funcoes policies constraints triggers grants',report.comparisons.every(c=>c.equal));
  const before=hash(replay);
  for(const name of migrations.slice(1))sql(database,'begin;\n'+readFileSync(join(root,'04_BANCO_E_SUPABASE/supabase/migrations',name),'utf8')+'\ncommit;');
  check('reaplicar deltas e idempotente',hash(catalog(database))===before);
} catch(error){report.error=String(error.message??error);process.exitCode=1;
} finally {
  if(created){sql('postgres',`drop database ${database};`);report.temporary_database_removed=true;}
  report.finished_at=new Date().toISOString();report.passed=!report.error&&report.checks.every(c=>c.ok)&&report.temporary_database_removed===true;
  writeFileSync(new URL(process.env.METALLO_EVIDENCE_REVISION === '1c' ? './marco-1c/replay-migrations.json' : './auditoria-complementar/replay-migrations.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
