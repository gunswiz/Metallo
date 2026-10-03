// Ensaio somente local. Nao publica portas, nao monta arquivos nem altera firewall.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
const docker = join(process.env.ProgramFiles, 'Docker/Docker/resources/bin/docker.exe');
const run = (...args) => execFileSync(docker,args,{encoding:'utf8',timeout:45000}).trim();
const ps = script => JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8'}).replace(/^\uFEFF/,''));
const ports = [54321,54322,54323,54324,54327];
const includePreview = process.argv.includes('--com-previa');
if(includePreview) ports.push(3101);
const includeManagementPreview = process.argv.includes('--com-gestao');
if(includeManagementPreview) ports.push(3102);
const includePointLab = process.argv.includes('--com-ponto');
if(includePointLab) ports.push(3103);
const includePoint2e = process.argv.includes('--com-ponto-2e');
if(includePoint2e) ports.push(3104);
const includePoint2f = process.argv.includes('--com-ponto-2f');
if(includePoint2f) ports.push(3105);
const includePoint4a = process.argv.includes('--com-ponto-4a');
if(includePoint4a) ports.push(3106);
const report = {started_at:new Date().toISOString(),ports,checks:[]};
const check = (name,ok,detail) => {report.checks.push({name,ok,detail}); console.log(`${ok?'PASS':'FAIL'} ${name}`);};
async function tcp(host,port) { return new Promise(resolve=>{const socket=net.connect({host,port});let finished=false;const end=result=>{if(finished)return;finished=true;socket.destroy();resolve({host,port,...result});};socket.setTimeout(2500,()=>end({connected:false,reason:'timeout'}));socket.once('connect',()=>end({connected:true}));socket.once('error',e=>end({connected:false,reason:e.code}));}); }
const runId=randomUUID().slice(0,8);
const network=`metallo-auditoria-rede-${runId}`;
const control=`metallo-auditoria-controle-${runId}`;
const client=`metallo-auditoria-cliente-${runId}`;
report.probe_resources={network,control,client};
let created=false;
try {
  if(!run('context','inspect','--format','{{.Endpoints.docker.Host}}').startsWith('npipe:////./pipe/')) throw new Error('Docker nao local');
  report.listeners=ps(`@(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(${ports.join(',')}) } | Select-Object LocalAddress,LocalPort) | ConvertTo-Json -Compress`);
  check('Todos os listeners Windows sao loopback',ports.every(port=>report.listeners.some(x=>x.LocalPort===port)) && report.listeners.every(x=>['127.0.0.1','::1'].includes(x.LocalAddress)),report.listeners);
  const names=run('ps','--filter','label=com.supabase.cli.project=laboratorio-marco-1a','--format','{{.Names}}').split('\n').filter(Boolean);
  report.bindings=names.map(name=>({name,ports:JSON.parse(run('inspect','--format','{{json .NetworkSettings.Ports}}',name))}));
  const bindings=report.bindings.flatMap(c=>Object.values(c.ports??{}).flat().filter(Boolean));
  check('Bindings efetivos Docker somente loopback',bindings.length>=5 && bindings.every(b=>['127.0.0.1','::1'].includes(b.HostIp)),bindings);
  report.interfaces=ps('@(Get-NetIPAddress | Where-Object { $_.AddressState -eq "Preferred" -and $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL|Docker" -and $_.IPAddress -notmatch "^169\\.254\\." } | Select-Object InterfaceAlias,IPAddress,AddressFamily) | ConvertTo-Json -Compress');
  const hosts=report.interfaces.map(x=>x.IPAddress).filter(ip=>!ip.startsWith('fe80:'));
  if(!hosts.length)throw new Error('Nenhum IP de rede disponivel para ensaio');
  report.loopback=await Promise.all(['127.0.0.1','::1'].flatMap(ip=>ports.filter(port=>![3101,3102,3103,3104,3105,3106].includes(port) || ip==='127.0.0.1').map(port=>tcp(ip,port))));
  check('Loopback conecta: Supabase IPv4/IPv6; previas opcionais IPv4',report.loopback.every(x=>x.connected),report.loopback);
  const health=await fetch('http://127.0.0.1:54321/auth/v1/health');
  check('Auth responde por loopback',health.status===200,`HTTP ${health.status}`);
  report.host_to_network_ip=await Promise.all(hosts.flatMap(ip=>ports.map(port=>tcp(ip,port))));
  check('Host nao alcanca laboratorio pelo IP Ethernet/rede',report.host_to_network_ip.every(x=>!x.connected),report.host_to_network_ip);
  const studio=names.find(n=>n.startsWith('supabase_studio_'));
  const image=run('inspect','--format','{{.Config.Image}}',studio);
  run('network','create',network);created=true;
  run('run','-d','--rm','--name',control,'--network',network,'--entrypoint','node',image,'-e',"require('http').createServer((q,s)=>s.end('synthetic-network-control')).listen(3000,'0.0.0.0')");
  // O servidor de controle so existe dentro desta rede; nenhuma porta e publicada.
  const probe=JSON.stringify({hosts,ports,control});
  const code=`const net=require('net');const c=${probe};const tcp=${tcp.toString()};(async()=>{const control=await tcp(c.control,3000);const attempts=await Promise.all(c.hosts.flatMap(h=>c.ports.map(p=>tcp(h,p))));console.log(JSON.stringify({control,attempts}));})().catch(e=>{console.error(e.message);process.exit(1)});`;
  report.separate_network=JSON.parse(run('run','--rm','--name',client,'--network',network,'--entrypoint','node',image,'-e',code));
  check('Controle positivo: cliente alcanca servidor sintetico na rede separada',report.separate_network.control.connected,report.separate_network.control);
  check('Rede separada nao alcanca IP Ethernet/rede nas portas ensaiadas',report.separate_network.attempts.every(x=>!x.connected),report.separate_network.attempts);
  report.firewall=ps('@(Get-NetFirewallProfile | Select-Object Name,Enabled) | ConvertTo-Json -Compress');
  check('Firewall continua habilitado em todos os perfis',report.firewall.every(x=>x.Enabled===1 || x.Enabled===true),report.firewall);
  report.physical_lan_test='Nao executado: nenhuma segunda maquina fisica disponivel. Evidencia A: bind real de loopback + sondas host e outra rede Docker.';
} catch(error) {report.error=error.message;process.exitCode=1;} finally {
  for(const name of [client,control]){try{run('rm','-f',name);}catch{}}
  if(created){try{run('network','rm',network);}catch(error){report.cleanup_error=error.message;process.exitCode=1;}}
  report.finished_at=new Date().toISOString();
  if(report.checks.some(x=>!x.ok))process.exitCode=1;
  report.passed=!report.error&&!report.cleanup_error&&report.checks.every(x=>x.ok);
  const evidencePath=process.env.METALLO_EVIDENCE_REVISION==='4c-bootstrap'?'../laboratorio-marco-4c/adocao-controlada/correcao-bootstrap/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-adocao'?'../laboratorio-marco-4c/adocao-controlada/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r6'?'../laboratorio-marco-4c/rodada-6/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r5'?'../laboratorio-marco-4c/rodada-5/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r4'?'../laboratorio-marco-4c/rodada-4/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r3'?'../laboratorio-marco-4c/rodada-3/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION==='4c-r2'?'../laboratorio-marco-4c/rodada-2/regressoes/rede.json':process.env.METALLO_EVIDENCE_REVISION === '4c' ? '../laboratorio-marco-4c/regressoes/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '4b' ? '../laboratorio-marco-4b/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '4a' ? '../laboratorio-marco-4a/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '3d' ? '../laboratorio-marco-3d/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '3c' ? '../laboratorio-marco-3c/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '3b' ? '../laboratorio-marco-3b/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '3a' ? '../laboratorio-marco-3a/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '2f' ? '../laboratorio-marco-2f/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '2e' ? '../laboratorio-marco-2e/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '2d' ? '../laboratorio-marco-2d/rede.json' : process.env.METALLO_EVIDENCE_REVISION === '2b' ? '../laboratorio-marco-2b/rede.json' :
    process.env.METALLO_EVIDENCE_REVISION === '1c' ? './marco-1c/rede.json' :
    process.env.METALLO_EVIDENCE_REVISION === 'r2' ? './saneamento-r2/rede-final.json' : './auditoria-final/rede-depois.json';
  writeFileSync(new URL(evidencePath,import.meta.url),JSON.stringify(report,null,2)+'\n');
}
