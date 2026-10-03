// Empacota uma fotografia de fontes/evidencias; nao executa o material empacotado.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'../../..');
const dest=resolve(root,'outputs/auditoria-supergrok-20260926');
if(existsSync(dest))throw new Error('Destino ja existe; nao sobrescrever pacote anterior.');
const json=p=>JSON.parse(readFileSync(resolve(root,p),'utf8').replace(/^\uFEFF/,''));
const lab='04_BANCO_E_SUPABASE/laboratorio-marco-1a';
const gate=json(`${lab}/resultado-provas-reais.json`);
const network=json(`${lab}/auditoria-final/rede-depois.json`);
const end=json(`${lab}/auditoria-final/estado-final.json`);
const web=json(`${lab}/auditoria-final/web-final.json`);
const preview=json(`${lab}/auditoria-final/marco1b.json`);
if(gate.checks.length!==194||gate.checks.some(x=>!x.ok)||!network.passed||!end.passed||web.numTotalTests!==67||web.numFailedTests!==4||preview.numPassedTests!==9)throw new Error('Resultados nao correspondem ao estado documentado.');
const summary={created_at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),marco0:'fechado tecnicamente',marco1a:'gate funcional e isolamento A aprovados; aguardando auditoria independente; sem encerramento definitivo',marco1b:'somente visual',suites:{marco1b:{pass:9,total:9,mocked:true},marco1a:{pass:194,total:194,real:true,started_at:gate.started_at,finished_at:gate.finished_at},database:{pass:22,total:22},quality:{pass:35,total:35,includes_database:true},web:{pass:web.numPassedTests,total:web.numTotalTests,fail:web.numFailedTests,pending:web.numPendingTests,includes_marco1b:true},network:{pass:network.checks.filter(x=>x.ok).length,total:network.checks.length}},stopped_without_listeners:end.passed,remote_mutations_this_round:false};
writeFileSync(resolve(root,lab,'auditoria-final/resumo-final.json'),JSON.stringify(summary,null,2)+'\n');
const scopes=['01_WEB','03_COMPARTILHADO','04_BANCO_E_SUPABASE','05_DOCUMENTACAO','06_TESTES_E_QUALIDADE','07_CONFIGURACOES_DO_PROJETO','AGENTS.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.gitignore'];
let files=[...new Set(execFileSync('git',['ls-files','-c','-o','--exclude-standard','--',...scopes],{cwd:root,encoding:'utf8'}).trim().split('\n'))];
const deny=/(^|\/)(node_modules|\.next[^/]*|\.temp|\.branches|\.git|\.pnpm-store|\.auditoria-head-controle)(\/|$)|(^|\/)\.env($|\.)|\.(zip|exe|dll|tsbuildinfo)$/i;
files=files.filter(p=>p&&!deny.test(p)&&!p.endsWith('/atualizar-documentos.mjs')&&existsSync(resolve(root,p))&&statSync(resolve(root,p)).isFile());
const screenshot='outputs/previa-colaborador-home.png';if(existsSync(resolve(root,screenshot)))files.push(screenshot);
const secretPatterns=[/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/,/sb_secret_[A-Za-z0-9_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const suspect=[];
for(const path of files){if(/\.(png|jpg|jpeg|pdf)$/i.test(path))continue;const content=readFileSync(resolve(root,path),'utf8');if(secretPatterns.some(re=>re.test(content)))suspect.push(path);}
if(suspect.length)throw new Error('Revisar possiveis segredos antes de empacotar: '+suspect.join(', '));
mkdirSync(dest,{recursive:true});
const entries=[];
for(const path of files.sort()){const target=resolve(dest,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(root,path),target);const bytes=readFileSync(target);entries.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const readme='LEIA-ME.md';
const text=`# Auditoria SuperGrok — 26/09/2026\n\nComece por [relatório final](05_DOCUMENTACAO/28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md) e [prompt SOMENTE LEITURA](05_DOCUMENTACAO/29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md).\n\nMarco 0 fechado tecnicamente; Marco 1A aguarda auditoria, sem encerramento definitivo; 1B somente visual. Resultados: 194/194 reais, banco22/22, qualidade35/35, 1B9/9 com mocks, **Web63/67**. RedeA comprovada; pilha encerrada.\n\nO manifesto fixa uma fotografia do checkout com alteracoes locais anteriores. Nao e uma release nem autorizacao de execucao/publicacao. Nao inclui dependencias, builds, arquivos de ambiente, volumes de banco ou credenciais. Relatorios antigos sao historicos; o documento28 registra a decisao vigente.\n`;
writeFileSync(resolve(dest,readme),text);entries.push({path:readme,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
writeFileSync(resolve(dest,'MANIFESTO_SHA256.json'),JSON.stringify({created_at:new Date().toISOString(),head:summary.head,files:entries,total_bytes:entries.reduce((s,f)=>s+f.bytes,0),secret_scan:{patterns:'JWT completo, sb_secret, chave privada PEM; arquivos .env/dependencias/builds excluidos',matches:0},warning:'Verificar hashes; nao executar scripts durante auditoria somente leitura.'},null,2)+'\n');
console.log(JSON.stringify({dest,files:entries.length,total_bytes:entries.reduce((s,f)=>s+f.bytes,0)}));
