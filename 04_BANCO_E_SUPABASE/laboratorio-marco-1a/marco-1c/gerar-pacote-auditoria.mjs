// Pacote pequeno, somente leitura. Não cria baseline nem acessa o Supabase remoto.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const lab=resolve(import.meta.dirname,'..');
const revision=process.argv[2] ?? '';
assert.ok(['','R2','R3'].includes(revision),'Revisão de pacote não reconhecida.');
const zip=resolve(root,`outputs/Metallo-Marco1C-MinhaObra-Auditoria-20260927${revision ? `-${revision}` : ''}.zip`);
const r2=resolve(root,'outputs/Metallo-Marco1B-BaselineSaneada-20260927-R2.zip');
const expectedR2='f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(resolve(root,path));
const json=path=>JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/,''));
assert.ok(!existsSync(zip),'Pacote 1C já existe; não sobrescrever.');
assert.equal(sha(readFileSync(r2)),expectedR2,'R2 divergiu da fotografia aprovada.');
assert.ok(!existsSync(resolve(lab,'supabase/.temp/project-ref')),'Laboratório vinculado a projeto remoto.');

const base='04_BANCO_E_SUPABASE/laboratorio-marco-1a/marco-1c';
const files=[
  'AGENTS.md',
  '05_DOCUMENTACAO/32_MARCO_1C_MINHA_OBRA_PESSOAL.md',
  '04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql',
  '04_BANCO_E_SUPABASE/supabase/migrations/20260926213000_portal_profile_optional_team.sql',
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
  '04_BANCO_E_SUPABASE/laboratorio-marco-1a/executar-provas-reais.mjs',
  '04_BANCO_E_SUPABASE/laboratorio-marco-1a/reproduzir-migrations-local.mjs',
  `${base}/executar-provas-1c.mjs`,
  `${base}/resultado-real.json`,
  `${base}/auth-real.json`,
  `${base}/base-real.json`,
  `${base}/banco.tap`,
  `${base}/qualidade.tap`,
  `${base}/web-completa.json`,
  `${base}/rede.json`,
  `${base}/replay-migrations.json`,
  '04_BANCO_E_SUPABASE/laboratorio-marco-1a/saneamento-r2/secret-scan.json',
  `${base}/minha-obra-preview.png`,
  `${base}/minha-obra-offline.png`,
];

const real=json(`${base}/resultado-real.json`);
const backend=json(`${base}/base-real.json`);
const web=json(`${base}/web-completa.json`);
const auth=json(`${base}/auth-real.json`);
const network=json(`${base}/rede.json`);
const replay=json(`${base}/replay-migrations.json`);
assert.ok(real.passed&&real.checks.length===45&&real.checks.every(c=>c.ok));
assert.ok(real.network.length>0&&real.network.every(entry=>entry.origin==='http://127.0.0.1:54321'));
for (const viewer of ['João','Maria']) for (const table of ['worksites','teams','employee_assignments']) {
  assert.ok(real.checks.some(check=>check.name===`${viewer} JWT portal não lista ${table} sem filtro`&&check.ok));
}
assert.ok(backend.checks.length===683&&backend.checks.every(c=>c.ok)&&!backend.error);
assert.ok(web.numTotalTests===108&&web.numPassedTests===108&&web.numFailedTests===0);
assert.ok(auth.numTotalTests===18&&auth.numPassedTests===18&&auth.numFailedTests===0);
assert.ok(network.passed&&network.checks.length===8&&network.checks.every(c=>c.ok));
assert.ok(replay.passed&&replay.applied.length===5&&replay.checks.length===6&&replay.comparisons.every(c=>c.equal)&&replay.temporary_database_removed);
for(const [name,count] of [['banco.tap',31],['qualidade.tap',44]]){
  const body=read(`${base}/${name}`).toString('utf8');
  assert.match(body,new RegExp(`(?:^|\\n)[^\\n]* pass ${count}\\r?(?:\\n|$)`));
  assert.match(body,/(?:^|\n)[^\n]* fail 0\r?(?:\n|$)/);
}

const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',lab,'-o','json'],{
  encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'},
}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const accounts=json('backups/credenciais-previa-colaborador.json');
const knownSecrets=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(accounts).map(v=>v?.password)].filter(v=>typeof v==='string'&&v.length>10);
const evidence={
  title:'Marco 1C — Obras: consulta pessoal da obra atual; auditoria adversarial somente leitura',
  reference:{id:'METALLO-1B-LAB-20260927-R2',sha256:expectedR2,immutable:true},
  scope:'somente laboratório local, sintético, sem publicação ou Supabase remoto',
  results:{marco_1c_real:'45/45',marco_1c_unit:'11/11',portal_1b:'39/39',auth_real:'18/18',backend_historical_plus_new_rpc:'683/683',database:'31/31',quality:'44/44',web:'108/108',network:'8/8',replay_schema:'6/6, zero diferenças',sql_lint:'0 erros',typescript:'passou',eslint:'passou'},
  limits:'Nenhum segundo host físico foi usado na sonda de rede. A interface Obras foi aprovada manualmente; a captura antiga minha-obra-preview.png antecede somente a troca do nome visível. A captura vigente será enviada diretamente na conversa de auditoria. A baseline 1B é anexada separadamente para confronto. Marco 1C aguarda confronto da auditoria independente.',
  remote_reads:false,remote_writes:false,published:false,approved_baseline_1c:false,
};
const payload=[...files.map(path=>({path,bytes:read(path)})),
  {path:'RESULTADOS_1C.json',bytes:Buffer.from(JSON.stringify(evidence,null,2)+'\n')},
  {path:'LEIA-ME.md',bytes:Buffer.from('# Pacote de auditoria — Marco 1C\n\nSomente leitura. Comece pelo documento 32 e pela migration `my_current_work()`. Esta revisão acrescenta os resultados integrais de Auth, base, banco, qualidade, Web, rede e replay, além de seis provas diretas sem filtro com JWT portal. A interface aprovada mostra **Obras** com **Obra atual**; a captura antiga no ZIP antecede somente a troca do nome visível. A captura vigente é enviada na conversa de auditoria. A baseline imutável 1B R2 é anexada separadamente. Este ZIP não é baseline aprovada, não contém credenciais e não autoriza executar SQL, testes, rede, Auth ou Supabase remoto.\n')},
];
for(const item of payload){
  const body=item.bytes.toString('utf8');
  assert.ok(!knownSecrets.some(secret=>body.includes(secret)),`Segredo local encontrado em ${item.path}`);
  assert.ok(!/sb_secret_[\w-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(body),`Chave em ${item.path}`);
  assert.ok(!/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(body),`JWT em ${item.path}`);
}
const manifest={id:`METALLO-1C-AUDITORIA-20260927${revision ? `-${revision}` : ''}`,at:new Date().toISOString(),r2_sha256:expectedR2,
  secret_scan:{passed:true,known_local_secrets_checked:knownSecrets.length,jwt_pattern_checked:true,pem_checked:true,limits:'Varredura não prova ausência universal de segredos desconhecidos.'},
  files:payload.map(({path,bytes})=>({path,bytes:bytes.length,sha256:sha(bytes)})).sort((a,b)=>a.path.localeCompare(b.path)),
};
const python=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
assert.ok(existsSync(python),'Python local para ZIP não encontrado.');
const code=`import base64,hashlib,json,sys,zipfile
data=json.load(sys.stdin)
with zipfile.ZipFile(sys.argv[1],'x',compression=zipfile.ZIP_DEFLATED) as z:
 for item in data['payload']: z.writestr(item['path'],base64.b64decode(item['base64']))
 z.writestr('MANIFESTO_SHA256.json',json.dumps(data['manifest'],ensure_ascii=False,indent=2)+'\\n')
with zipfile.ZipFile(sys.argv[1]) as z:
 m=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert len(z.namelist())==len(m['files'])+1
 assert all(hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256'] for f in m['files'])
`;
execFileSync(python,['-c',code,zip],{input:JSON.stringify({manifest,payload:payload.map(({path,bytes})=>({path,base64:bytes.toString('base64')}))}),maxBuffer:1024*1024});
const zipSha=sha(readFileSync(zip));
writeFileSync(`${zip}.sha256`,`${zipSha}  ${basename(zip)}\n`);
assert.equal(sha(readFileSync(r2)),expectedR2,'R2 mudou durante a geração.');
console.log(JSON.stringify({zip,sha256:zipSha,files:payload.length+1,secret_scan:'passou',r2_immutable:true}));
