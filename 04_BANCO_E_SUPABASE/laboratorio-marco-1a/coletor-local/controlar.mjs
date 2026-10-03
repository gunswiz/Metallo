// Gestão exclusiva do coletor auxiliar local, usando APIs públicas Docker/Vector.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const docker=resolve(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
const name='metallo_coletor_laboratorio_marco1a';
const previous='supabase_vector_laboratorio-marco-1a';
const image='public.ecr.aws/supabase/vector:0.53.0-alpine';
const network='metallo-marco1a-local';
const label='com.metallo.laboratorio=laboratorio-marco-1a';
const config=resolve(import.meta.dirname,'vector.yaml');
const supervisor=resolve(import.meta.dirname,'supervisionar.sh');
const fingerprint=createHash('sha256').update(readFileSync(config)).update(readFileSync(supervisor)).digest('hex');
const run=(...args)=>execFileSync(docker,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(!run('context','inspect','--format','{{.Endpoints.docker.Host}}').startsWith('npipe:////./pipe/'))throw Error('Somente Docker Desktop local autorizado.');
const inspect=n=>{try{return JSON.parse(run('inspect',n))[0];}catch{return null;}};
const action=process.argv[2]??'status';
if(!['start','stop','status'].includes(action))throw Error('Use start, stop ou status.');
if(action==='stop'){
  if(inspect(name))run('stop','--time','15',name);
}else if(action==='start'){
  const legacy=inspect(previous);
  if(legacy){
    if(legacy.Config.Labels?.['com.supabase.cli.project']!=='laboratorio-marco-1a')throw Error('Container antigo fora do escopo.');
    run('update','--restart=no',previous);
    run('stop','--time','15',previous);
  }
  let current=inspect(name);
  if(current&&current.Config.Labels?.['com.metallo.laboratorio']!=='laboratorio-marco-1a')throw Error('Nome ocupado por outro serviço.');
  if(current&&current.Config.Labels?.['com.metallo.config-sha256']!==fingerprint){
    run('stop','--time','15',name);run('rm',name);current=null;
  }
  if(!current){
    const analytics=inspect('supabase_analytics_laboratorio-marco-1a');
    const token=analytics?.Config.Env.find(e=>e.startsWith('LOGFLARE_PRIVATE_ACCESS_TOKEN='))?.split('=').slice(1).join('=');
    if(!token)throw Error('Analytics local ausente. Inicie o laboratório antes do coletor.');
    execFileSync(docker,['run','-d','--name',name,'--label',label,'--label',`com.metallo.config-sha256=${fingerprint}`,
      '--network',network,'--restart=no','--cpus=.25','--memory=192m','--cap-drop=ALL','--security-opt=no-new-privileges',
      '--mount','type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock,readonly',
      '--mount',`type=bind,src=${config},dst=/etc/metallo/vector.yaml,readonly`,
      '--mount',`type=bind,src=${supervisor},dst=/etc/metallo/supervisionar.sh,readonly`,
      '--env','VECTOR_LOGFLARE_KEY','--env','VECTOR_LOG=warn','--entrypoint','sh',image,'/etc/metallo/supervisionar.sh'],
      {encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,VECTOR_LOGFLARE_KEY:token}});
  }else if(current.State.Status!=='running')run('start',name);
}
const current=inspect(name);
let supervisorState='PARADO';
if(current?.State.Running){try{supervisorState=run('exec',name,'cat','/tmp/coletor-estado');}catch{supervisorState='INICIANDO';}}
console.log(JSON.stringify({name,action,state:current?.State.Status??'ausente',restart_count:current?.RestartCount??0,supervisor:supervisorState,configuration_sha256:fingerprint,published_ports:current?.HostConfig.PortBindings??{}}));
