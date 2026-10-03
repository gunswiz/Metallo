// Preparação/execução local reproduzível; credenciais passam apenas em memória.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync,openSync,closeSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { root,status } from '../laboratorio-marco-4a/ambiente.mjs';
const command=process.argv[2];assert.ok(['build','build-home','antes','depois','duracao'].includes(command));
const build=command.startsWith('build');
const round2=['2','3','4','5'].includes(process.env.METALLO_4C_ROUND);
const directory=resolve(import.meta.dirname,...(round2?['rodada-'+process.env.METALLO_4C_ROUND]:[]),command==='build'?'build':command);mkdirSync(directory,{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex');
const origin=resolve(root,'outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip');
assert.equal(hash(readFileSync(origin)),'2ff3076d3a9bee5b33a363ae4264dde392bce7f4662273309b5a5085726c3c71');
if(!build)assert.ok(!existsSync(resolve(directory,'carga-resultado.json')),'Não sobrescrever ensaio');
const sources=['04_BANCO_E_SUPABASE/laboratorio-marco-2b/integridade.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-2b/nucleo.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-4a/servidor-4a.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-4a/extensao.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-4b/carga-4b.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-4b/registros.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-4c/perfil.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-4c/integridade-incremental.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-4c/transporte-local.mjs','01_WEB/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio.ts','01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts',
 '01_WEB/app/api/ponto-online/[...path]/route.ts','01_WEB/app/api/ponto-registros/[...path]/route.ts'];
const record={started_at:new Date().toISOString(),command,scope:'SIMULAÇÃO SEM VALOR OFICIAL; somente LOCAL',origin_sha256:hash(readFileSync(origin)),
 source_hashes:sources.map(path=>({path,sha256:hash(readFileSync(resolve(root,path)))})),remote_accessed:false,baseline_created:false,grok:false};
const out=openSync(resolve(directory,'execucao.log'),'w'),err=openSync(resolve(directory,'erro.log'),'w');
const args=build?[resolve(root,'01_WEB/node_modules/next/dist/bin/next'),'build']:[resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-4b/carga-4b.mjs')];
const child=spawn(process.execPath,args,{cwd:build?resolve(root,'01_WEB'):root,windowsHide:true,
 env:{...process.env,METALLO_LOCAL_PREVIEW:'1',METALLO_COLABORADOR_PREVIEW:'1',METALLO_COLABORADOR_LAB_URL:status.API_URL,
 METALLO_COLABORADOR_LAB_ANON_KEY:status.ANON_KEY,METALLO_4C_TELEMETRY:'1',...(build?{}:{METALLO_4C_RUN:command})},stdio:['ignore',out,err]});
closeSync(out);closeSync(err);
record.pid=child.pid;writeFileSync(resolve(directory,'execucao.json'),JSON.stringify(record,null,2)+'\n');
const exit=await new Promise(ok=>child.once('exit',(code,signal)=>ok({code,signal})));
Object.assign(record,exit,{finished_at:new Date().toISOString(),log_sha256:hash(readFileSync(resolve(directory,'execucao.log'))),error_log_sha256:hash(readFileSync(resolve(directory,'erro.log')))});
writeFileSync(resolve(directory,'execucao.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({command,...exit,log:resolve(directory,'execucao.log')}));process.exitCode=exit.code??1;
