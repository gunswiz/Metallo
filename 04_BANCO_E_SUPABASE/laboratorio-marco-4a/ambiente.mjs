// Configuração estritamente local; credenciais de servidor somente em memória.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { request as nodeRequest } from 'node:http';
export const root=resolve(import.meta.dirname,'../..');
const lab=resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a');
assert.ok(!existsSync(resolve(lab,'supabase/.temp/project-ref')));
export const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',lab,'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
// Mesmos casos/guards, em instância descartável 4C; não reinicia a prévia manual.
export function regressionFetch(input,options){
 if(!['4c-bootstrap','4c-adocao','4c','4c-r2','4c-r3','4c-r5','4c-r6','4c-r4'].includes(process.env.METALLO_EVIDENCE_REVISION))return fetch(input,options);
 const url=new URL(input),ports={'3101':'3103','3105':'3108','3106':'3107'};
 if(url.hostname!=='127.0.0.1'||!ports[url.port])return fetch(input,options);
 const originalPort=url.port;url.port=ports[originalPort];const headers=new Headers(options?.headers);
 if(originalPort==='3101')headers.set('Host','127.0.0.1:3101');
 if(originalPort!=='3101')return fetch(url,{...options,headers});
 // Undici substitui Host neste cenário. HTTP nativo conserva o contrato
 // original do gateway, como o gerador de carga, sem relaxar esse guard.
 return new Promise((ok,fail)=>{
  const req=nodeRequest(url,{method:options?.method??'GET',headers:Object.fromEntries(headers),signal:options?.signal},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',fail);res.on('end',()=>ok(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
  });req.on('error',fail);req.end(options?.body);
 });
}
export async function local(path,token,body,key=status.ANON_KEY){return fetch(status.API_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});}
