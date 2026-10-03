// Fotografia 2B autorizada: herda 1C, exige fontes auditadas e só conclui após scan do ZIP.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const ev = '04_BANCO_E_SUPABASE/laboratorio-marco-2b';
const lab = '04_BANCO_E_SUPABASE/laboratorio-marco-1a';
const id = 'METALLO-2B-LAB-20260927-R1';
const zip = resolve(root, 'outputs/Metallo-Marco2B-BaselineAprovada-20260927-R1.zip');
const python = resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path).toString('utf8').replace(/^\uFEFF/, ''));
const protectedArchives = [
  ['Metallo-Marco1B-BaselineAprovada-20260927.zip', '41cc99f9eb38cbd895ec8e9555ce9c9e2d3ca1ead7b757c6f5dbffe89863a162'],
  ['Metallo-Marco1B-BaselineSaneada-20260927-R2.zip', 'f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be'],
  ['Metallo-Marco1C-BaselineAprovada-20260927-R1.zip', 'ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae'],
  ['Metallo-Marco2B-PontoExperimental-Auditoria-20260927-Ciclo1.zip', '0fd2111e86edfacc7c9998f7aaa3becf32c37ad015f6364c6f97322969ff6436'],
  ['Metallo-Marco2B-PontoExperimental-Auditoria-20260927-Ciclo2.zip', '3ce816b021dcfa6087d14cfa2d7306edeb35e6f62afc009f70f81ecab1429bd2'],
];
const verifyProtected = () => {
  for (const [name, sha256] of protectedArchives) {
    assert.equal(hash(read(`outputs/${name}`)), sha256, `Arquivo imutável divergente: ${name}`);
    assert.ok(read(`outputs/${name}.sha256`).toString('utf8').includes(sha256), `Recibo divergente: ${name}`);
  }
};
verifyProtected();
for (const path of [zip, `${zip}.sha256`, `${zip}.verificacao.json`])
  assert.ok(!existsSync(path), 'Destino já existe; não sobrescrever nem recongelar esta baseline');
assert.ok(!existsSync(resolve(root, `${lab}/supabase/.temp/project-ref`)), 'Laboratório vinculado a remoto');

// Confere resultados existentes; não reexecuta testes nem altera os bancos.
for (const [name, total] of [
  ['resultado-2b.json', 64], ['resultado-revogacao-concorrente-2b.json', 5],
  ['resultado-transporte-2b.json', 13], ['resultado-indisponibilidade-2b.json', 1],
  ['base-real.json', 683], ['resultado-1c-regressao.json', 45], ['rede.json', 8],
]) {
  const result = json(`${ev}/${name}`);
  assert.ok(result.checks?.length === total && result.checks.every(check => check.ok === true) && !result.error, `Gate inválido: ${name}`);
  if (name !== 'base-real.json') assert.equal(result.passed, true, `Gate não aprovado: ${name}`);
}
for (const [name, total] of [['banco.tap', 31], ['qualidade.tap', 44]]) {
  const body = read(`${ev}/${name}`).toString('utf8');
  for (const [key, count] of [['tests', total], ['pass', total], ['fail', 0], ['skipped', 0], ['todo', 0]])
    assert.match(body, new RegExp(`^.* ${key} ${count}\\r?$`, 'm'), `Gate ${name}/${key}`);
}
const web = read(`${ev}/web-completa.log`).toString('utf8');
assert.match(web.slice(web.lastIndexOf('Test Files')), /Tests\s+114 passed \(114\)/);
assert.match(web, /colaborador-ponto\.test\.tsx/);
assert.match(read(`${ev}/typecheck.log`).toString('utf8'), /tsc --noEmit/);
assert.match(read(`${ev}/lint.log`).toString('utf8'), /eslint \. --max-warnings=0/);
assert.match(read(`${ev}/build.log`).toString('utf8'), /Generating static pages.*39\/39/);
const visual = json(`${ev}/visual-escala-ampliada.json`);
assert.ok(visual.zoom200Confirmed && visual.manualConfirmation?.afterGrokCycle2);
assert.equal(visual.manualConfirmation.userMessage, 'ta tudo ok, ja vi');
assert.ok(json(`${ev}/resultado-segredos-2b.json`).passed);

const loadArchive = name => JSON.parse(execFileSync(python, ['-X', 'utf8', '-c', `
import base64,hashlib,json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 names=z.namelist(); assert len(names)==len(set(names))
 m=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert set(names)==set(f['path'] for f in m['files'])|{'MANIFESTO_SHA256.json'}
 assert all(hashlib.sha256(z.read(f['path'])).hexdigest()==f['sha256'] for f in m['files'])
 print(json.dumps({'manifest':m,'files':[{'path':n,'data':base64.b64encode(z.read(n)).decode()} for n in names if n!='MANIFESTO_SHA256.json']}))
`, resolve(root, `outputs/${name}`)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const inherited = loadArchive(protectedArchives[2][0]);
const audited = loadArchive(protectedArchives[4][0]);
assert.equal(inherited.manifest.id, 'METALLO-1C-LAB-20260927-R1');
assert.ok(inherited.manifest.secret_scan.passed);
const payload = new Map(inherited.files.map(file => [file.path, Buffer.from(file.data, 'base64')]));
const parentHashes = new Map([...payload].map(([path, bytes]) => [path, hash(bytes)]));
const mutableEvidence = new Set([`${ev}/resultado-segredos-2b.json`, '05_DOCUMENTACAO/34_MARCO_2B_PONTO_EXPERIMENTAL.md']);
let auditedFilesUnchanged = 0;
for (const file of audited.files) {
  if (!/^(01_WEB\/|04_BANCO_E_SUPABASE\/|05_DOCUMENTACAO\/|AGENTS\.md$|package\.json$|pnpm-lock\.yaml$)/.test(file.path)) continue;
  const bytes = read(file.path);
  if (!mutableEvidence.has(file.path)) {
    assert.equal(hash(bytes), hash(Buffer.from(file.data, 'base64')), `Mudança posterior ao parecer: ${file.path}`);
    auditedFilesUnchanged++;
  }
  payload.set(file.path, bytes);
}
for (const path of [
  '05_DOCUMENTACAO/22_AMBIENTE_REP_P_E_ROADMAP.md',
  ...['gerar-baseline-2b.mjs', 'parecer-grok-ciclo2.md', 'grok-ciclo2.png',
    'meu-ponto-escala-ampliada.png', 'visual-escala-ampliada.json'].map(name => `${ev}/${name}`),
]) payload.set(path, read(path));

const states = {
  marco_0: 'Fechado tecnicamente', marco_1a_t05_t15: 'Concluído e auditado em laboratório',
  marco_1b: 'Funcional em laboratório', marco_1c: 'Minha Obra funcional em laboratório',
  marco_2a: 'Planejamento concluído', marco_2b: 'Ponto Experimental Online e Sintético funcional em laboratório',
};
const limits = ['SIMULAÇÃO SEM VALOR OFICIAL', 'SOMENTE LABORATÓRIO ONLINE E SINTÉTICO',
  'SUPABASE REMOTO INTOCADO', 'SEM FUNCIONÁRIOS REAIS', 'NÃO É PRODUÇÃO', 'NÃO É PONTO OFICIAL',
  'NÃO É REP-P', 'NÃO AUTORIZA PUBLICAÇÃO', 'SEM NOVO MÓDULO OU TERCEIRA AUDITORIA'];
const risks = [
  'A1: janela residual entre última autorização no Auth e commit no PGlite; sem transação distribuída atômica',
  'A2/F8: proprietário da infraestrutura pode remover triggers, alterar banco/histórico e recomputar hashes',
  'A3: concorrência com múltiplos writers/outro motor não comprovada; hipótese futura',
  'A6: rede Docker separada comprovada; não houve segundo host físico; zoom confirmado manualmente após ciclo 2',
  'A7/F5/F9: token residual e política de logout/consistência exigem definição antes de uso real',
  'A9: novos campos semânticos exigirão evolução do hash do pedido e suas provas',
  'F7: função privilegiada e fronteiras de infraestrutura permanecem risco futuro',
  'Auditoria estática; auditor não reexecutou projeto/testes/bundles; sem conformidade regulatória declarada',
];
const suites = {
  core_real: '64/64', controlled_revocation: '5/5', real_transport: '13/13', unavailable_core: '1/1',
  point_ui: '5/5 dentro da Web', historical_real: '683/683', marco_1c_real: '45/45',
  database: '31/31', quality: '44/44', network: '8/8', web_complete: '114/114',
  typescript: 'passou', lint: 'passou', build: 'passou',
  note: 'Resultados vigentes conferidos, não reexecutados no fechamento; suítes sobrepostas, não somar. Log Web preserva falha transitória 113/114 e correção de sincronização do teste.',
};
payload.set('LEIA-ME.md', Buffer.from(`# ${id}\n\nMARCO 2B — PONTO EXPERIMENTAL ONLINE E SINTÉTICO FUNCIONAL EM LABORATÓRIO\n\n**SIMULAÇÃO SEM VALOR OFICIAL**\n\nFotografia autorizada pelo responsável em 27/09/2026, derivada de METALLO-1C-LAB-20260927-R1. Baselines anteriores preservadas. Documento vigente: 05_DOCUMENTACAO/34_MARCO_2B_PONTO_EXPERIMENTAL.md. O manifesto contém inventário, hashes, delta desde 1C, resultados, aprovações, dois pareceres Grok e riscos.\n\nEsta é uma fotografia selecionada de fontes, documentação e evidências, seguindo a baseline 1C. Não é checkout completo, distribuição instalável ou cópia de banco. Dependências instaladas, caches, credenciais, .env, bancos ativos e dados reais foram excluídos.\n\nA conclusão exige o recibo externo ${basename(zip)}.verificacao.json com passed=true e o mesmo SHA-256 do ZIP. O scan interno histórico antecede esta fotografia; o recibo final fica fora para evitar autorreferência.\n\n${limits.join('; ')}.\n`));

const delta = [...payload].filter(([path, bytes]) => parentHashes.get(path) !== hash(bytes))
  .map(([path, bytes]) => ({ path, kind: parentHashes.has(path) ? 'updated' : 'added',
    baseline_1c_sha256: parentHashes.get(path) ?? null, baseline_2b_sha256: hash(bytes) }))
  .sort((a, b) => a.path.localeCompare(b.path));
const files = [...payload].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes),
  origin: parentHashes.get(path) === hash(bytes) ? '1c_preserved' : parentHashes.has(path) ? '1c_updated' : '2b_added' }))
  .sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  id, at: new Date().toISOString(), status: 'MARCO 2B — PONTO EXPERIMENTAL ONLINE E SINTÉTICO FUNCIONAL EM LABORATÓRIO',
  document: '05_DOCUMENTACAO/34_MARCO_2B_PONTO_EXPERIMENTAL.md',
  parent: { id: 'METALLO-1C-LAB-20260927-R1', zip: protectedArchives[2][0], sha256: protectedArchives[2][1], immutable: true },
  protected_archives: protectedArchives.map(([name, sha256]) => ({ zip: name, sha256, immutable: true })),
  official_states: states, suites,
  approval: { by: 'responsável', date: '2026-09-27', visual: 'ta perfeito',
    zoom: visual.manualConfirmation, zoom_evidence: `${ev}/visual-escala-ampliada.json`,
    closure: 'AUTORIZO FORMALMENTE O FECHAMENTO DO MARCO 2B E A CRIAÇÃO DA BASELINE APROVADA',
    baseline_id_explicitly_authorized: id },
  audits: { cycles: 2, status: 'Concluídos e confrontados', reference: 'https://grok.com/c/03194895-5dba-48ca-a343-43ad45a23010',
    reports: [`${ev}/parecer-grok-ciclo1.md`, `${ev}/parecer-grok-ciclo2.md`],
    disposition: { A1: 'residual', A2: 'residual', A3: 'hipótese futura', A4: 'sanado', A5: 'sanado',
      A6: 'zoom confirmado manualmente depois do parecer; host físico não testado', A7: 'limite futuro', A8: 'sanado como recibo', A9: 'hipótese futura' },
    method: 'Inspeção passiva de arquivos/ZIP; sem executar projeto, SQL, testes, Auth ou rede do laboratório',
    critical_or_high_proven_open: 0, post_audit_visual_confirmation_not_reviewed: true,
    audited_files_unchanged: auditedFilesUnchanged, third_cycle: false },
  future_risks: risks, limits, delta, inventory_count: files.length, zip_entry_count: files.length + 1, files,
  final_scan_receipt: `${basename(zip)}.verificacao.json`,
  final_scan_rule: 'Baseline concluída somente se recibo externo passou e corresponde ao SHA-256 exato do ZIP',
  remote_reads: false, remote_writes: false, published: false, new_module_started: false,
};

// Só lê o status do laboratório local; segredos usados na comparação nunca são impressos.
const childEnv = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
const localStatus = JSON.parse(execFileSync(process.execPath, [resolve(root, 'node_modules/supabase/dist/supabase.js'),
  'status', '--workdir', resolve(root, lab), '-o', 'json'], { encoding: 'utf8', env: childEnv }));
assert.equal(localStatus.API_URL, 'http://127.0.0.1:54321');
const accounts = json('backups/credenciais-previa-colaborador.json');
const knownSecrets = [localStatus.SERVICE_ROLE_KEY, localStatus.JWT_SECRET,
  ...Object.values(accounts).filter(value => value && typeof value === 'object').map(value => value.password)]
  .filter(value => typeof value === 'string' && value.length >= 20);
assert.ok(knownSecrets.length >= 2, 'Segredos locais de comparação indisponíveis');

// Verificação por entrada e de DOCX internos: nenhum valor encontrado é devolvido em erros.
const packageReport = JSON.parse(execFileSync(python, ['-X', 'utf8', '-c', `
import base64,hashlib,io,json,pathlib,re,stat,sys,zipfile
d=json.load(sys.stdin); target=pathlib.Path(sys.argv[1]); secrets=d['secrets']; findings=[]; nested=0
patterns=[('JWT completo',rb'eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}'),('sb_secret',rb'sb_secret_[A-Za-z0-9_-]{16,}'),('chave privada',rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),('AWS access key',rb'(?:AKIA|ASIA)[A-Z0-9]{16}'),('GitHub token',rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})')]
def scan(path,data,depth=0):
 global nested
 p=pathlib.PurePosixPath(path)
 if p.is_absolute() or '..' in p.parts or '\\\\' in path or ':' in path: findings.append({'path':path,'kind':'caminho indevido'})
 if any(part.lower() in ('.git','backups','node_modules','.pnpm-store','.next','.next-local-preview','.temp') for part in p.parts) or p.name.startswith('.env') or p.suffix.lower() in ('.exe','.apk','.db','.sqlite','.pglite','.pem','.key'): findings.append({'path':path,'kind':'arquivo indevido'})
 if any(s.encode() in data for s in secrets): findings.append({'path':path,'kind':'segredo local conhecido'})
 for kind,pattern in patterns:
  if re.search(pattern,data): findings.append({'path':path,'kind':kind})
 if p.suffix.lower() in ('.docx','.zip'):
  assert depth<3, 'Arquivo aninhado além do limite'
  with zipfile.ZipFile(io.BytesIO(data)) as inner:
   for item in inner.infolist():
    if not item.is_dir(): nested+=1; scan(path+'!/'+item.filename,inner.read(item),depth+1)
items=[(f['path'],base64.b64decode(f['data'])) for f in d['files']]
items.append(('MANIFESTO_SHA256.json',(json.dumps(d['manifest'],ensure_ascii=False,indent=2)+'\\n').encode()))
for path,data in items: scan(path,data)
assert not findings, json.dumps({'stage':'antes do ZIP','findings':findings})
with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as z:
 for path,data in items: z.writestr(path,data)
findings=[]; nested=0
with zipfile.ZipFile(target) as z:
 names=z.namelist(); assert len(names)==len(set(names)); assert z.testzip() is None
 m=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert len(names)==m['zip_entry_count']==len(m['files'])+1
 assert set(names)==set(f['path'] for f in m['files'])|{'MANIFESTO_SHA256.json'}
 for f in m['files']:
  data=z.read(f['path']); assert len(data)==f['bytes'] and hashlib.sha256(data).hexdigest()==f['sha256']
 for item in z.infolist():
  assert not stat.S_ISLNK(item.external_attr>>16)
  scan(item.filename,z.read(item))
 assert not findings, json.dumps({'stage':'diretamente no ZIP','findings':findings})
 print(json.dumps({'passed':True,'entries':len(names),'manifest_verified':len(m['files']),'nested_entries_scanned':nested,'findings':findings,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'known_secrets_compared':len(secrets),'patterns':[kind for kind,pattern in patterns],'forbidden_paths_checked':True}))
`, zip], { input: JSON.stringify({ manifest, secrets: knownSecrets,
  files: [...payload].map(([path, bytes]) => ({ path, data: bytes.toString('base64') })) }),
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

// Reutiliza o scanner 2B existente diretamente no ZIP final e preserva recibos anteriores.
execFileSync(process.execPath, [resolve(root, `${ev}/verificar-segredos-2b.mjs`), zip], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
const scan = json(`${ev}/resultado-segredos-2b.json`);
assert.ok(scan.passed && scan.findings.length === 0);
assert.equal(scan.zip.sha256, packageReport.sha256);
assert.equal(scan.zip.entries, manifest.zip_entry_count);
verifyProtected();
const finalHash = hash(readFileSync(zip));
assert.equal(finalHash, packageReport.sha256);
const receipt = { id, at: new Date().toISOString(), passed: true, zip: basename(zip), sha256: finalHash,
  files: manifest.zip_entry_count, inventory_files: files.length, delta_files: delta.length,
  delta_added: delta.filter(file => file.kind === 'added').length, delta_updated: delta.filter(file => file.kind === 'updated').length,
  content_verification: packageReport, secret_scan: scan, immutable_archives_verified: protectedArchives,
  checked_existing_results_only: true, suites, remote_reads: false, remote_writes: false, published: false,
  scope: 'Fotografia selecionada de fontes e evidências, não backup de banco nem checkout completo',
  limitations: 'Scan de valores conhecidos/padrões e inspeção estrutural; não garante ausência universal de segredos desconhecidos. Imagens não submetidas a OCR automático.' };
writeFileSync(`${zip}.verificacao.json`, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
writeFileSync(`${zip}.sha256`, `${finalHash}  ${basename(zip)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ id, zip, sha256: finalHash, files: manifest.zip_entry_count,
  inventory: files.length, delta: delta.length, scan: 'passou; zero achados', protected_archives_unchanged: true }));
