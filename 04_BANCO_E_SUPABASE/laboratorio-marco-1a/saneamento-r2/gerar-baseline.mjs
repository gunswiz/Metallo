// Fotografia R2 independente: parte do ZIP R1 imutável e adiciona somente o delta validado.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const lab='04_BANCO_E_SUPABASE/laboratorio-marco-1a';
const evidence=`${lab}/saneamento-r2`;
const name='Metallo-Marco1B-BaselineSaneada-20260927-R2';
const r1=resolve(root,'outputs/Metallo-Marco1B-BaselineAprovada-20260927.zip');
const r1sha='41cc99f9eb38cbd895ec8e9555ce9c9e2d3ca1ead7b757c6f5dbffe89863a162';
const dest=resolve(root,'outputs/baseline-1b-saneada-20260927-r2');
const zip=resolve(root,`outputs/${name}.zip`);
const python=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/,''));
const requireGate=(condition,message)=>assert.ok(condition,message);
const exact=(file,total)=>{const r=json(`${evidence}/${file}`);requireGate(r.numTotalTests===total&&r.numPassedTests===total&&r.numFailedTests===0&&r.numPendingTests===0,`${file}: gate incompleto`);return r;};
const tap=(file,total)=>{const body=read(`${evidence}/${file}`).toString('utf8');for(const [key,n] of [['tests',total],['pass',total],['fail',0]])requireGate(new RegExp(`^.* ${key} ${n}\\r?$`,'m').test(body),`${file}: ${key} incorreto`);};
requireGate(existsSync(r1)&&hash(readFileSync(r1))===r1sha,'R1 original foi alterada');
requireGate(readFileSync(`${r1}.sha256`,'utf8').toLowerCase().includes(r1sha),'Sidecar R1 divergente');
requireGate(!existsSync(dest)&&!existsSync(zip)&&!existsSync(`${zip}.sha256`),'R2 já existe: não sobrescrever');
requireGate(!existsSync(resolve(root,`${lab}/supabase/.temp/project-ref`)),'Laboratório vinculado a remoto');
const web=exact('web-final.json',97),auth=exact('auth-real.json',18);
const backend=json(`${evidence}/resultado-provas-reais.json`);
requireGate(backend.checks?.length===682&&backend.checks.every(c=>c.ok)&&!backend.error,'Base1A/T05/T15 não passou682/682');
tap('banco.tap',31);tap('qualidade.tap',44);
const types=read(`${evidence}/typescript.txt`).toString('utf8'),lint=read(`${evidence}/lint.txt`).toString('utf8');
requireGate(types.includes('tsc --noEmit')&&!/error TS\d+/.test(types),'TypeScript sem prova verde');
requireGate(lint.includes('eslint . --max-warnings=0')&&!/problems|error\s/i.test(lint),'Lint sem prova verde');
requireGate(existsSync(resolve(root,`${evidence}/zoom-200.json`)),'Zoom 200% real pendente; R2 não gerada');
const network=json(`${evidence}/rede-final.json`),collector=json(`${evidence}/coletor-depois.json`),zoom=json(`${evidence}/zoom-200.json`);
requireGate(network.passed&&network.checks.length===8&&network.checks.every(c=>c.ok),'Rede8/8 incompleta');
requireGate(collector.passed&&collector.checks.length===12&&collector.checks.every(c=>c.ok)&&JSON.stringify(collector.attempts.map(a=>a.attempt))==='[1,2,3,4,5]','Coletor não comprovado');
const zoomPages=['login','inicio','perfil','equipe','obra','gestao-consumo','gestao-operacoes'];
requireGate(zoom.passed&&zoom.effectiveZoomPercent===200&&zoomPages.every(page=>zoom.pages?.some(row=>row.page===page&&row.passed)),'Zoom200% real incompleto');
const priorScan=json(`${lab}/auditoria-1b/secret-scan.json`);
requireGate(priorScan.passed,'Varredura histórica R1 inválida');

const changes=[
 '.gitignore','01_WEB/07_ESTILOS/globals.css','01_WEB/10_TESTES/colaborador-auth-real.integration.tsx',
 '01_WEB/10_TESTES/obras-telas.test.tsx','01_WEB/10_TESTES/paridade-actions.test.ts',
 '01_WEB/app/actions/substituir-locado.ts','01_WEB/app/(02_SISTEMA)/epis/[id]/page.tsx',
 '01_WEB/app/previa/correcoes-metallo/preview.tsx',
 '01_WEB/eslint.config.mjs','01_WEB/next.config.ts',
 ...['executar-provas-reais.mjs','executar-provas-complementares.mjs','executar-provas-gestao.mjs','executar-provas-t15.mjs','iniciar-laboratorio.ps1','verificar-rede-local.mjs'].map(file=>`${lab}/${file}`),
 '05_DOCUMENTACAO/27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md','05_DOCUMENTACAO/31_BACKLOG_GESTAO_QUATRO_FALHAS_WEB.md',
];
const walk=folder=>readdirSync(resolve(root,folder),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${folder}/${entry.name}`):[`${folder}/${entry.name}`]);
changes.push(...walk(`${lab}/coletor-local`),...walk(evidence));
const overlay=[...new Set(changes)].sort();
for(const path of overlay)requireGate(existsSync(resolve(root,path))&&statSync(resolve(root,path)).isFile(),`Arquivo ausente: ${path}`);

const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
const status=JSON.parse(execFileSync(process.execPath,[cli,'status','--workdir',resolve(root,lab),'-o','json'],{encoding:'utf8'}));
requireGate(status.API_URL==='http://127.0.0.1:54321','Status fora do laboratório local');
const credentials=json('backups/credenciais-previa-colaborador.json');
const knownSecrets=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(credentials).filter(v=>v&&typeof v==='object').map(v=>v.password)].filter(v=>typeof v==='string'&&v.length>15);

mkdirSync(dest,{recursive:false});
execFileSync(python,['-c',"import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); d=pathlib.Path(sys.argv[2]).resolve(); names=z.namelist(); assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in names); z.extractall(d)",r1,dest]);
const oldManifest=JSON.parse(readFileSync(resolve(dest,'MANIFESTO_SHA256.json'),'utf8'));
const old=new Map(oldManifest.files.map(entry=>[entry.path,entry.sha256]));
const delta=[];
for(const path of overlay){
 const bytes=read(path),target=resolve(dest,path);
 mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(root,path),target);
 if(old.get(path)!==hash(bytes))delta.push({path,r1_sha256:old.get(path)??null,r2_sha256:hash(bytes),kind:old.has(path)?'updated':'added'});
}
const limits=['NÃO IMPLANTADO NO SUPABASE REMOTO','NÃO LIBERADO PARA FUNCIONÁRIOS REAIS','NÃO É PRODUÇÃO','NÃO É PONTO OFICIAL','NÃO É REP-P','NÃO AUTORIZA PUBLICAÇÃO'];
writeFileSync(resolve(dest,'LEIA-ME.md'),`# ${name}\n\nMarco1B funcional somente em laboratório. Esta é a revisão saneada R2 da fotografia R1 aprovada; a R1 original permanece separada e imutável (SHA-256 ${r1sha}).\n\nQuatro falhas históricas da Gestão foram tratadas no checkout local. Web97/97, portal39/39, Auth real18/18, base682/682, banco31/31, qualidade44/44, rede8/8, coletor12/12 e zoom real200% constam nas evidências R2. Consulte os documentos27 e31 para o escopo, a origem e os limites de cada prova.\n\n${limits.join('; ')}. Sem novos módulos do Colaborador.\n`);
delta.push({path:'LEIA-ME.md',r1_sha256:old.get('LEIA-ME.md')??null,r2_sha256:hash(readFileSync(resolve(dest,'LEIA-ME.md'))),kind:'generated_update'});

const scan=[];
const files=walk(relative(root,dest).replaceAll('\\','/')).filter(path=>!path.endsWith('/MANIFESTO_SHA256.json'));
for(const path of files){
 const rel=relative(dest,resolve(root,path)).replaceAll('\\','/');
 if(/\.(png|jpg|jpeg|docx|zip)$/i.test(rel))continue;
 const content=readFileSync(resolve(root,path),'utf8');
 for(const secret of knownSecrets)if(content.includes(secret))scan.push({path:rel,type:'valor secreto local conhecido'});
 if(/sb_secret_[\w-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))scan.push({path:rel,type:'chave secreta ou privada'});
 for(const match of content.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g))scan.push({path:rel,type:'JWT completo'});
}
for(const dir of ['01_WEB/.next-local-preview/dev/static','01_WEB/.next-gestao-preview/dev/static'])if(existsSync(resolve(root,dir)))for(const path of walk(dir).filter(p=>/\.(js|map|json)$/.test(p))){
 const content=read(path).toString('utf8');
 for(const secret of knownSecrets)if(content.includes(secret))scan.push({path,type:'valor secreto no bundle'});
 if(/sb_secret_[\w-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))scan.push({path,type:'chave secreta no bundle'});
 for(const match of content.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)){
  let role;try{role=JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString()).role;}catch{}
  if(role!=='anon')scan.push({path,type:'JWT não público no bundle',role:role??'desconhecido'});
 }
}
const scanResult={at:new Date().toISOString(),package_files:files.length,bundle_scan:true,r1_known_secret_scan_passed:priorScan.passed,findings:scan,passed:scan.length===0,limits:'DOCX antigos preservados da R1; o scanner R1 inspecionou seu XML. Nenhum scanner prova ausência universal de segredos desconhecidos.'};
writeFileSync(resolve(dest,`${evidence}/secret-scan-final.json`),JSON.stringify(scanResult,null,2)+'\n');
requireGate(scanResult.passed,'Possível segredo detectado; R2 não empacotada');
const all=walk(relative(root,dest).replaceAll('\\','/')).filter(path=>!path.endsWith('/MANIFESTO_SHA256.json'));
const entries=all.map(path=>{const rel=relative(dest,resolve(root,path)).replaceAll('\\','/'),bytes=readFileSync(resolve(root,path));return{path:rel,bytes:bytes.length,sha256:hash(bytes),origin:rel==='LEIA-ME.md'?'r2_generated':old.has(rel)?overlay.includes(rel)?'r1_updated':'r1_preserved':'r2_added'};}).sort((a,b)=>a.path.localeCompare(b.path));
const manifest={id:'METALLO-1B-LAB-20260927-R2',at:new Date().toISOString(),status:'MARCO 1B — FUNCIONAL EM LABORATÓRIO; SANEAMENTO R2',r1:{zip:'Metallo-Marco1B-BaselineAprovada-20260927.zip',sha256:r1sha},suites:{web:'97/97',portal:'39/39',auth_real:'18/18',backend:'682/682',database:'31/31',quality:'44/44',network:'8/8',collector:'12/12',zoom:'200% real'},delta,limits,remote_reads:false,remote_writes:false,published:false,secret_scan:scanResult,files:entries};
writeFileSync(resolve(dest,'MANIFESTO_SHA256.json'),JSON.stringify(manifest,null,2)+'\n');
execFileSync(python,['-c',"import hashlib,json,pathlib,sys,zipfile; d=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],'x',compression=zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(d).as_posix()) for p in d.rglob('*') if p.is_file()]; z.close(); z=zipfile.ZipFile(sys.argv[2]); m=json.loads(z.read('MANIFESTO_SHA256.json')); assert all(hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256'] for f in m['files']); assert len(z.namelist())==len(m['files'])+1",dest,zip]);
const zipsha=hash(readFileSync(zip));writeFileSync(`${zip}.sha256`,`${zipsha}  ${name}.zip\n`);
console.log(JSON.stringify({id:manifest.id,zip,sha256:zipsha,files:entries.length+1,delta:delta.length,secret_scan:true}));
