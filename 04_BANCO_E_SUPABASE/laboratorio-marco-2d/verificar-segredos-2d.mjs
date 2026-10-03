// Scan de fontes, evidências, bundles e conteúdo descompactado do backup/ZIP; não imprime valores.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const status=JSON.parse(execFileSync(process.execPath,[resolve(root,'node_modules/supabase/dist/supabase.js'),'status','--workdir',resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],{encoding:'utf8'}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const creds=JSON.parse(readFileSync(resolve(root,'backups/credenciais-previa-colaborador.json'),'utf8'));
const sensitive=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(creds).filter(v=>v&&typeof v==='object').map(v=>v.password)].filter(v=>typeof v==='string'&&v.length>=20);
const python=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const script=String.raw`
import sys,json,pathlib,re,hashlib,zipfile,tarfile,io
cfg=json.load(sys.stdin);root=pathlib.Path(cfg['root']);values=[v.encode() for v in cfg['values']]
findings=[];files=0;size=0;nested=0
def scan(name,data,depth=0):
 global files,size,nested
 files+=1;size+=len(data)
 parts=re.split(r'[!/\\\\]',name.lower())
 if any(part.startswith('.env') or part.endswith(('.pem','.pfx','.p12','.key','.sqlite','.db','.dump','.bak','.backup')) or re.search(r'(?:cookie|credential|credencial)',part) for part in parts):findings.append({'file':name,'kind':'arquivo sensivel ou indevido'})
 for label,condition in [('valor sensivel conhecido',any(v in data for v in values)),('chave privada',bool(re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data))),('sb_secret',bool(re.search(rb'sb_secret_[A-Za-z0-9_-]{16,}',data))),('senha sintetica literal',bool(re.search(rb'Lab![A-Za-z0-9_-]{20,}',data)))]:
  if condition: findings.append({'file':name,'kind':label})
 if re.search(rb'(?i)(?:"(?:password|refresh_token|service_role_key|cookie|authorization)"\s*:\s*"|(?:password|refresh_token|service_role_key)\s*=\s*["\x27])[^"\x27\r\n]{16,}',data):findings.append({'file':name,'kind':'credencial literal possivel'})
 for match in re.findall(rb'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',data):
  if match!=cfg['public_anon'].encode() or 'backup-sintetico' in name:findings.append({'file':name,'kind':'JWT literal'})
 if depth>3: raise RuntimeError('arquivo aninhado excessivo')
 if name.lower().endswith(('.zip','.docx')):
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   for n in z.namelist():
    if not n.endswith('/'):nested+=1;scan(name+'!'+n,z.read(n),depth+1)
 elif name.lower().endswith('.tar.gz'):
  with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
   for member in t.getmembers():
    if member.isfile():nested+=1;scan(name+'!'+member.name,t.extractfile(member).read(),depth+1)
paths=set()
for folder in ['04_BANCO_E_SUPABASE/laboratorio-marco-2b','04_BANCO_E_SUPABASE/laboratorio-marco-2d']+(['04_BANCO_E_SUPABASE/laboratorio-marco-2e'] if cfg.get('scan_2e') else [])+(['04_BANCO_E_SUPABASE/laboratorio-marco-2f'] if cfg.get('scan_2f') else [])+(['04_BANCO_E_SUPABASE/laboratorio-marco-3a'] if cfg.get('scan_3a') else []):
 for p in (root/folder).rglob('*'):
  if p.is_file():paths.add(p)
for folder in ['01_WEB/app/colaborador','01_WEB/app/api/ponto-lab','01_WEB/05_ACESSO_A_DADOS/Ponto']:
 paths.update(p for p in (root/folder).rglob('*') if p.is_file())
for folder in ['01_WEB/.next/static/chunks','01_WEB/.next-local-preview/static/chunks','01_WEB/.next-local-preview/dev/static/chunks']:
 paths.update(p for p in (root/folder).rglob('*') if p.suffix in ['.js','.css'])
if cfg.get('scan_2e'):paths.add(root/'backups/metallo-ponto-lab-pglite-2e.authorization.json')
if cfg.get('scan_2f'):paths.add(root/'backups/metallo-ponto-lab-pglite-2f.authorization.json')
for p in sorted(paths):scan(str(p.relative_to(root)).replace('\\','/'),p.read_bytes())
zipinfo=None
if cfg.get('zip'):
 p=pathlib.Path(cfg['zip']);data=p.read_bytes();scan(p.name,data)
 with zipfile.ZipFile(p) as z:
  names=z.namelist();assert len(names)==len(set(names))
  for n in names:
   parts=pathlib.PurePosixPath(n).parts
   if any(x in ['..','.git','node_modules','backups','.temp'] for x in parts) or any(x.startswith('.env') for x in parts):findings.append({'file':n,'kind':'caminho indevido'})
 zipinfo={'path':str(p.relative_to(root)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'entries':len(names)}
print(json.dumps({'passed':not findings,'files_scanned_including_nested':files,'nested_entries':nested,'bytes':size,'findings':findings,'zip':zipinfo,'known_sensitive_values':len(values),'backup_decompressed':True,'scope':'fontes/evidencias/bundles e ZIP com arquivos aninhados descompactados'}))
`;
const report=JSON.parse(execFileSync(python,['-X','utf8','-c',script],{input:JSON.stringify({root,values:sensitive,public_anon:status.ANON_KEY,zip:process.argv[2]?resolve(process.argv[2]):null,scan_2e:['2e','3a'].includes(process.env.METALLO_EVIDENCE_REVISION),scan_2f:['2f','3a'].includes(process.env.METALLO_EVIDENCE_REVISION),scan_3a:process.env.METALLO_EVIDENCE_REVISION==='3a'}),encoding:'utf8',maxBuffer:4*1024*1024}));
report.at=new Date().toISOString();
const target=new URL(process.env.METALLO_EVIDENCE_REVISION==='3a'?'../laboratorio-marco-3a/resultado-segredos-3a.json':process.env.METALLO_EVIDENCE_REVISION==='2f'?'../laboratorio-marco-2f/resultado-segredos-2f.json':process.env.METALLO_EVIDENCE_REVISION==='2e'?'../laboratorio-marco-2e/resultado-segredos-2e.json':'./resultado-segredos-2d.json',import.meta.url);
const previous=existsSync(target)?JSON.parse(readFileSync(target,'utf8')):{};
report.previous_scans=[...(previous.previous_scans??[]),...(previous.at?[{at:previous.at,passed:previous.passed,zip:previous.zip,findings:previous.findings}]:[])];
writeFileSync(target,JSON.stringify(report,null,2)+'\n');
if(report.zip)writeFileSync(resolve(root,report.zip.path)+'.verificacao.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:report.passed,files:report.files_scanned_including_nested,nested:report.nested_entries,findings:report.findings,zip:report.zip}));if(!report.passed)process.exitCode=1;
