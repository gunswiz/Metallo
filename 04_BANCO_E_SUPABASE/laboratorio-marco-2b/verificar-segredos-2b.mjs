// Scan local sem imprimir valores sensíveis; ZIP será verificado após aprovação visual.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root=resolve(import.meta.dirname,'../..');
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8'}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const creds=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const values=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(creds).filter(v=>v&&typeof v==='object').map(v=>v.password)].filter(v=>typeof v==='string'&&v.length>=20);
const paths=[
 '01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts',
 '01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-lab.ts',
 '01_WEB/app/api/ponto-lab/[...path]/route.ts',
 '01_WEB/app/colaborador/[[...screen]]/meu-ponto.tsx',
 '01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx',
 '01_WEB/proxy.ts',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/auth-local.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/nucleo.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/servidor.mjs',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/schema.sql',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/resultado-2b.json',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/resultado-transporte-2b.json',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/resultado-indisponibilidade-2b.json',
 '04_BANCO_E_SUPABASE/laboratorio-marco-2b/resultado-revogacao-concorrente-2b.json',
];
for(const entry of readdirSync(import.meta.dirname,{withFileTypes:true}))
 if(entry.isFile()&&/\.(mjs|sql|json|log|tap)$/.test(entry.name))paths.push(`04_BANCO_E_SUPABASE/laboratorio-marco-2b/${entry.name}`);
const sourcePaths=[...new Set(paths)];
const bundles=[];
function walk(dir){if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(js|css)$/.test(entry.name))bundles.push(p);}}
walk(resolve(root,'01_WEB/.next-local-preview/dev/static/chunks'));
walk(resolve(root,'01_WEB/.next-local-preview/static/chunks'));
walk(resolve(root,'01_WEB/.next/dev/static/chunks'));
walk(resolve(root,'01_WEB/.next/static/chunks'));
const findings=[];let bytes=0;
for(const path of [...sourcePaths.map(p=>resolve(root,p)),...bundles]){
 if(!existsSync(path))throw Error(`Arquivo esperado ausente: ${relative(root,path)}`);
 const content=readFileSync(path,'utf8');bytes+=statSync(path).size;
 const relativePath=relative(root,path).replaceAll('\\','/');
 if(values.some(value=>content.includes(value)))findings.push({file:relativePath,kind:'valor sensível real'});
 if(/sb_secret_[A-Za-z0-9_-]{16,}/.test(content))findings.push({file:relativePath,kind:'sb_secret'});
 if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content))findings.push({file:relativePath,kind:'chave privada PEM'});
}
let zip='pendente de pacote de auditoria';
const zipArgument=process.argv[2];
if(zipArgument){
 const zipPath=resolve(zipArgument);
 assert.ok(existsSync(zipPath),`ZIP ausente: ${zipPath}`);
 const names=execFileSync('tar',['-tf',zipPath],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 const content=execFileSync('tar',['-xOf',zipPath],{maxBuffer:30*1024*1024}).toString('utf8');
 if(values.some(value=>content.includes(value)))findings.push({file:`ZIP:${zipPath}`,kind:'valor sensível real'});
 if(/sb_secret_[A-Za-z0-9_-]{16,}/.test(content))findings.push({file:`ZIP:${zipPath}`,kind:'sb_secret'});
 if(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(content))findings.push({file:`ZIP:${zipPath}`,kind:'chave privada PEM'});
 zip={path:relative(root,zipPath).replaceAll('\\','/'),entries:names.length,sha256:createHash('sha256').update(readFileSync(zipPath)).digest('hex')};
}
const previousPath=new URL('./resultado-segredos-2b.json',import.meta.url);
const previous=existsSync(previousPath)?JSON.parse(readFileSync(previousPath,'utf8')):{};
const priorScans=previous.zipScans??(previous.zip?.sha256?[{...previous.zip,at:previous.at,passed:previous.passed}]:[]);
const zipScans=typeof zip==='object'?[...priorScans.filter(item=>item.sha256!==zip.sha256),{...zip,at:new Date().toISOString(),passed:findings.length===0}]:priorScans;
const report={at:new Date().toISOString(),scope:'fontes 2B, evidências JSON/log, bundles Web da prévia local e ZIP opcional',sourceFiles:sourcePaths.length,clientBundles:bundles.length,bytes,findings,zip,zipScans,passed:findings.length===0};
writeFileSync(new URL('./resultado-segredos-2b.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,sourceFiles:report.sourceFiles,clientBundles:report.clientBundles,zip:report.zip,findings:report.findings.length}));
if(!report.passed)process.exitCode=1;
