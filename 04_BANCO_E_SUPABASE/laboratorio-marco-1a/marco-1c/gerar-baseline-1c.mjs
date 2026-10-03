// Fotografia imutável 1C: acrescenta ao ZIP R2 somente o delta aprovado e suas provas.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const lab='04_BANCO_E_SUPABASE/laboratorio-marco-1a';
const ev=`${lab}/marco-1c`;
const id='METALLO-1C-LAB-20260927-R1';
const name='Metallo-Marco1C-BaselineAprovada-20260927-R1';
const base=resolve(root,'outputs/Metallo-Marco1B-BaselineSaneada-20260927-R2.zip');
const baseSha='f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be';
const r1=resolve(root,'outputs/Metallo-Marco1B-BaselineAprovada-20260927.zip');
const r1Sha='41cc99f9eb38cbd895ec8e9555ce9c9e2d3ca1ead7b757c6f5dbffe89863a162';
const zip=resolve(root,`outputs/${name}.zip`);
const python=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/,''));
assert.ok(existsSync(base)&&sha(readFileSync(base))===baseSha,'Baseline R2 divergente');
assert.ok(existsSync(r1)&&sha(readFileSync(r1))===r1Sha,'Baseline R1 divergente');
assert.ok(!existsSync(zip)&&!existsSync(`${zip}.sha256`),'Baseline 1C já existe; não sobrescrever');
assert.ok(!existsSync(resolve(root,`${lab}/supabase/.temp/project-ref`)),'Laboratório vinculado ao remoto');
assert.ok(existsSync(python),'Python local ausente');

const real=json(`${ev}/resultado-real.json`),baseReal=json(`${ev}/base-real.json`);
const web=json(`${ev}/web-completa.json`),auth=json(`${ev}/auth-real.json`);
const network=json(`${ev}/rede.json`),replay=json(`${ev}/replay-migrations.json`);
assert.ok(real.passed&&real.checks.length===45&&real.checks.every(c=>c.ok),'Gate 1C 45/45');
assert.ok(real.network.length>0&&real.network.every(x=>x.origin==='http://127.0.0.1:54321'),'Origem do ensaio 1C');
for(const viewer of ['João','Maria'])for(const table of ['worksites','teams','employee_assignments'])
 assert.ok(real.checks.some(c=>c.name===`${viewer} JWT portal não lista ${table} sem filtro`&&c.ok),`Isolamento ${viewer}/${table}`);
assert.ok(baseReal.checks.length===683&&baseReal.checks.every(c=>c.ok)&&!baseReal.error,'Base 683/683');
for(const [file,count] of [[web,108],[auth,18]])assert.ok(file.numTotalTests===count&&file.numPassedTests===count&&file.numFailedTests===0&&file.numPendingTests===0&&file.numTodoTests===0,`Suíte ${count}/${count}`);
assert.ok(network.passed&&network.checks.length===8&&network.checks.every(c=>c.ok),'Rede 8/8');
assert.ok(replay.passed&&replay.checks.length===6&&replay.checks.every(c=>c.ok)&&replay.comparisons.every(c=>c.equal)&&replay.temporary_database_removed,'Replay 6/6');
for(const [file,count] of [['banco.tap',31],['qualidade.tap',44]]){
 const body=read(`${ev}/${file}`).toString('utf8');
 assert.match(body,new RegExp(`(?:^|\\n)[^\\n]* pass ${count}\\r?(?:\\n|$)`));
 assert.match(body,/(?:^|\n)[^\n]* fail 0\r?(?:\n|$)/);
}

const files=[
 'AGENTS.md','05_DOCUMENTACAO/22_AMBIENTE_REP_P_E_ROADMAP.md','05_DOCUMENTACAO/32_MARCO_1C_MINHA_OBRA_PESSOAL.md',
 '04_BANCO_E_SUPABASE/supabase/migrations/20260927124559_personal_current_work.sql',
 '01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts',
 '01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts',
 '01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts',
 '01_WEB/app/colaborador/[[...screen]]/colaborador-app.tsx',
 '01_WEB/app/colaborador/[[...screen]]/minha-obra.tsx',
 '01_WEB/app/colaborador/[[...screen]]/colaborador.module.css',
 '01_WEB/app/colaborador/[[...screen]]/page.tsx',
 '01_WEB/10_TESTES/colaborador-obra.test.tsx',
 '01_WEB/10_TESTES/colaborador-preview.test.tsx',
 '01_WEB/10_TESTES/colaborador-seguranca.test.ts',
 '01_WEB/10_TESTES/colaborador-auth-real.integration.tsx',
 `${lab}/executar-provas-reais.mjs`,`${lab}/reproduzir-migrations-local.mjs`,`${lab}/verificar-rede-local.mjs`,
 ...['executar-provas-1c.mjs','gerar-pacote-auditoria.mjs','gerar-baseline-1c.mjs',
     'resultado-real.json','auth-real.json','base-real.json','banco.tap','qualidade.tap',
     'web-completa.json','rede.json','replay-migrations.json',
     'minha-obra-preview.png','minha-obra-offline.png'].map(file=>`${ev}/${file}`),
];
for(const file of files)assert.ok(existsSync(resolve(root,file)),`Arquivo ausente: ${file}`);

const loadCode=`import base64,hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 m=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert len(z.namelist())==len(m['files'])+1
 assert all(hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256'] for f in m['files'])
 print(json.dumps({'manifest':m,'files':[{'path':n,'base64':base64.b64encode(z.read(n)).decode()} for n in z.namelist() if n!='MANIFESTO_SHA256.json']}))`;
const inherited=JSON.parse(execFileSync(python,['-c',loadCode,base],{encoding:'utf8',maxBuffer:64*1024*1024}));
assert.equal(inherited.manifest.id,'METALLO-1B-LAB-20260927-R2');
assert.ok(inherited.manifest.secret_scan?.passed,'Varredura R2 não aprovada');
const payload=new Map(inherited.files.map(f=>[f.path,Buffer.from(f.base64,'base64')]));
const previous=new Map([...payload].map(([path,bytes])=>[path,sha(bytes)]));
for(const file of files)payload.set(file,read(file));
const limits=['NÃO IMPLANTADO NO SUPABASE REMOTO','NÃO LIBERADO PARA FUNCIONÁRIOS REAIS','NÃO É PRODUÇÃO','NÃO É PONTO OFICIAL','NÃO É REP-P','NÃO AUTORIZA PUBLICAÇÃO'];
payload.set('LEIA-ME.md',Buffer.from(`# ${id}\n\nMarco 1C — Minha Obra funcional somente em laboratório. Esta fotografia parte do ZIP imutável METALLO-1B-LAB-20260927-R2 (SHA-256 ${baseSha}); R1 e R2 anteriores não foram sobrescritas.\n\nA tela Obras / Obra atual foi aprovada visualmente pelo responsável em 27/09/2026. Contrato pessoal somente leitura, resolvido por auth.uid(), sem ID do funcionário fornecido pelo cliente e retorno limitado a work_id + work_name. Consulte o documento 32, os resultados integrais no diretório marco-1c, o inventário e o delta no MANIFESTO_SHA256.json. Auditoria Grok: https://grok.com/c/d9d29ab7-8593-45c0-8377-bea275092786\n\n${limits.join('; ')}.\n`));
const delta=[...payload].filter(([path,bytes])=>previous.get(path)!==sha(bytes)).map(([path,bytes])=>({path,kind:previous.has(path)?'updated':'added',r2_sha256:previous.get(path)??null,r1c_sha256:sha(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));

const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,lab),'-o','json'],{encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'}}));
assert.equal(status.API_URL,'http://127.0.0.1:54321','API fora do loopback local');
const accounts=json('backups/credenciais-previa-colaborador.json');
const secrets=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(accounts).map(v=>v?.password)].filter(v=>typeof v==='string'&&v.length>10);
const findings=[];
for(const [path,bytes] of payload){
 if(/\.(png|jpg|jpeg|docx|zip)$/i.test(path))continue;
 const body=bytes.toString('utf8');
 if(secrets.some(secret=>body.includes(secret)))findings.push({path,type:'segredo local conhecido'});
 if(/sb_secret_[\w-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body))findings.push({path,type:'chave secreta ou privada'});
 if(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(body))findings.push({path,type:'JWT completo'});
}
assert.deepEqual(findings,[],'Varredura de segredos encontrou conteúdo sensível');
const entries=[...payload].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes),origin:previous.get(path)===sha(bytes)?'r2_preserved':previous.has(path)?'r2_updated':'r1c_added'})).sort((a,b)=>a.path.localeCompare(b.path));
const manifest={id,at:new Date().toISOString(),status:'MARCO 1C — MINHA OBRA FUNCIONAL EM LABORATÓRIO',
 parent:{id:'METALLO-1B-LAB-20260927-R2',zip:basename(base),sha256:baseSha,immutable:true},
 earlier_r1:{zip:basename(r1),sha256:r1Sha,immutable:true},
 visual_approval:{approved:true,by:'responsável',date:'2026-09-27',screen:'Obras / Obra atual'},
 suites:{marco_1c_real:'45/45',web_complete:'108/108',historical_plus_1c:'683/683',r2_historical_original:'682/682',portal_auth_real:'18/18',database:'31/31',quality:'44/44',network:'8/8',schema_replay:'6/6; zero diferenças'},
 audit:{status:'concluída e confrontada',findings:'F1–F9',critical_or_high_open:0,cross_employee_access_found:false,reference:'https://grok.com/c/d9d29ab7-8593-45c0-8377-bea275092786',review_package_r3_sha256:'48f650192709297178e7070d6be46708eaadd252e04c1ad4e51d39812ae7ca00',method:'inspeção passiva de ZIP/arquivos por comandos locais do auditor; sem SQL, testes, Auth, rede ou scripts do projeto'},
 future_risks:['F5 revogação/token residual','F7 função privilegiada','F8 apagamento administrativo de histórico','F9 política de logout em produção'],
 delta,inventory_count:entries.length,files:entries,secret_scan:{passed:true,known_local_secrets_checked:secrets.length,patterns:['private_key','sb_secret','jwt'],inherited_r2_scan_passed:true,limits:'Não prova ausência universal de segredos desconhecidos; DOCX herdados foram verificados na R2.'},
 limits,remote_reads:false,remote_writes:false,published:false};
const makeCode=`import base64,hashlib,json,sys,zipfile
data=json.load(sys.stdin)
with zipfile.ZipFile(sys.argv[1],'x',compression=zipfile.ZIP_DEFLATED) as z:
 for f in data['files']: z.writestr(f['path'],base64.b64decode(f['base64']))
 z.writestr('MANIFESTO_SHA256.json',json.dumps(data['manifest'],ensure_ascii=True,indent=2)+'\\n')
with zipfile.ZipFile(sys.argv[1]) as z:
 m=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert len(z.namelist())==len(m['files'])+1
 assert all(hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256'] for f in m['files'])`;
execFileSync(python,['-c',makeCode,zip],{input:JSON.stringify({manifest,files:[...payload].map(([path,bytes])=>({path,base64:bytes.toString('base64')}))}),maxBuffer:64*1024*1024});
const zipSha=sha(readFileSync(zip));
writeFileSync(`${zip}.sha256`,`${zipSha}  ${basename(zip)}\n`);
assert.equal(sha(readFileSync(base)),baseSha,'R2 mudou durante a geração');
assert.equal(sha(readFileSync(r1)),r1Sha,'R1 mudou durante a geração');
console.log(JSON.stringify({id,zip,sha256:zipSha,files:entries.length+1,delta:delta.length,secret_scan:'passou',r1_r2_immutable:true}));
