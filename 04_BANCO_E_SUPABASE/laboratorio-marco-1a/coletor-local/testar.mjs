// Ensaio real do supervisor: interrompe somente Analytics e restaura no finally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const docker=resolve(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
const collector='metallo_coletor_laboratorio_marco1a',analytics='supabase_analytics_laboratorio-marco-1a';
const run=(...a)=>execFileSync(docker,a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
assert.ok(run('context','inspect','--format','{{.Endpoints.docker.Host}}').startsWith('npipe:////./pipe/'));
const control=a=>execFileSync(process.execPath,[resolve(import.meta.dirname,'controlar.mjs'),a],{encoding:'utf8'});
const state=()=>run('exec',collector,'cat','/tmp/coletor-estado');
const report={started_at:new Date().toISOString(),checks:[],attempts:[],scope:'Docker/Analytics locais reais, intervalos reais de5/10/20/40 e espera300 segundos; sem relógio simulado.'};
const check=(name,ok,detail)=>{report.checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);assert.ok(ok,name);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(predicate,seconds){const end=Date.now()+seconds*1000;while(Date.now()<end){if(predicate())return true;await delay(1000);}return false;}
try{
 control('start');
 check('Coletor conecta pelo socket local e fica ativo',await until(()=>state()==='ATIVO',25));
 const before=JSON.parse(run('inspect',collector))[0];
 check('Nenhuma porta publicada; restart automático desativado',Object.keys(before.HostConfig.PortBindings??{}).length===0&&before.HostConfig.RestartPolicy.Name==='no');
 const outageEpoch=Math.floor(Date.now()/1000)-2;
 run('stop','--time','10',analytics);
 check('Dependência indisponível gera espera, sem declarar falha do portal',await until(()=>state()==='AGUARDANDO_LABORATORIO',20));
 const auth=await fetch('http://127.0.0.1:54321/auth/v1/health');check('Auth principal continua respondendo',auth.status===200);
 const waiting=await until(()=>{
   let raw;
   try{raw=run('exec',collector,'cat','/tmp/coletor-tentativa');}catch{return false;}
   const row=raw.split(' ').map(Number);
   if(row[0]<outageEpoch)return false;
   if(!report.attempts.some(a=>a.attempt===row[1]))report.attempts.push({epoch:row[0],attempt:row[1],next_delay:row[2]});
   return state()==='ESPERA';
 },110);
 check('Cinco tentativas em ordem levam a estado de espera',waiting&&JSON.stringify(report.attempts.map(r=>r.attempt))==='[1,2,3,4,5]',report.attempts);
 check('Backoff real de5/10/20/40s e espera final de300s',JSON.stringify(report.attempts.map(r=>r.next_delay))==='[5,10,20,40,300]'&&report.attempts.slice(1).every((r,i)=>r.epoch-report.attempts[i].epoch>=report.attempts[i].next_delay));
 const current=JSON.parse(run('inspect',collector))[0];
 check('Container permaneceu vivo sem loop de restart',current.RestartCount===0&&current.State.Status==='running');
 const stats=JSON.parse(run('stats','--no-stream','--format','{{json .}}',collector));
 check('Espera usa menos de2% de CPU',parseFloat(stats.CPUPerc)<2,{cpu:stats.CPUPerc,memory:stats.MemUsage});
 const log=run('logs',collector);check('Supervisor sem spam: até8 mensagens de estado durante indisponibilidade',log.split('\n').filter(l=>l.includes('Coletor')).length<=8);
 run('start',analytics);
 console.log('Analytics restaurado; aguardando a reconexão automática após o intervalo real de300s.');
 check('Reconexão automática após restauração da dependência',await until(()=>state()==='ATIVO',340));
 const start=Date.now();control('stop');const stopped=JSON.parse(run('inspect',collector))[0];
 check('Shutdown limpo e limitado, sem SIGKILL',stopped.State.Status==='exited'&&stopped.State.ExitCode===0&&Date.now()-start<15000);
 control('start');check('Reinício explícito recupera coleta',await until(()=>state()==='ATIVO',25));
}catch(e){report.error=e.message;process.exitCode=1;}finally{
 try{run('start',analytics);}catch{}
 report.finished_at=new Date().toISOString();report.passed=!report.error&&report.checks.every(c=>c.ok);
 writeFileSync(resolve(import.meta.dirname,'../saneamento-r2/coletor-depois.json'),JSON.stringify(report,null,2)+'\n');
}
