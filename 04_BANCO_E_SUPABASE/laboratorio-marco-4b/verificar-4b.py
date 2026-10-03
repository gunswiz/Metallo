"""Conferência do 4B, sem Auth, SQL, acesso remoto ou geração de baseline."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import zipfile
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
LAB = Path(__file__).resolve().parent
ORIGIN = ROOT / 'outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip'
EXPECTED = '50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
report = {'at': datetime.now(timezone.utc).isoformat(), 'scope': 'SIMULAÇÃO SEM VALOR OFICIAL', 'baseline_created': False, 'grok_sent': False, 'checks': [], 'secrets': []}
def check(name, ok, **extra):
    report['checks'].append({'name': name, 'ok': bool(ok), **extra})
    if not ok:
        raise AssertionError(name)
def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))
private = set()
def collect(obj):
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str) and len(value) >= 12 and re.search('password|senha|token|secret|private_key', key, re.I):
                private.add(value)
            else:
                collect(value)
    elif isinstance(obj, list):
        for value in obj:
            collect(value)
for path in (ROOT / 'backups').glob('credenciais-previa-*.json'):
    collect(read(path))
patterns = [re.compile(rb'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'), re.compile(rb'sb_secret_[A-Za-z0-9_-]{12,}'), re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
scanned = []
def scan(path, raw):
    hits = any(pattern.search(raw) for pattern in patterns) or any(value.encode() in raw for value in private)
    if hits:
        report['secrets'].append({'path': path, 'classification': 'CONFIRMED_VALUE_OR_SECRET_PATTERN'})
    scanned.append({'path': path, 'sha256': sha(raw), 'bytes': len(raw)})
try:
    check('Origem 4A SHA preservado', sha(ORIGIN.read_bytes()) == EXPECTED)
    previous = read(LAB/'verificacao-final-4b.json')
    previous_hashes = {Path(item['path']).as_posix(): item['sha256'] for item in previous['scanned']}
    protected = ['04_BANCO_E_SUPABASE/laboratorio-marco-4b/registros.mjs','04_BANCO_E_SUPABASE/laboratorio-marco-4a/servidor-4a.mjs','01_WEB/05_ACESSO_A_DADOS/Ponto/registros.ts','01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts','01_WEB/app/api/ponto-registros/[...path]/route.ts']
    check('Shell preserva seleção pessoal, gateway, contratos, servidor e PDF/ZIP 4B', all(previous_hashes.get(name) == sha((ROOT/name).read_bytes()) for name in protected), files=len(protected))
    with zipfile.ZipFile(ORIGIN) as z:
        frozen = [name for name in z.namelist() if re.match(r'04_BANCO_E_SUPABASE/laboratorio-marco-2[bdef]/', name) and Path(name).suffix in ('.mjs', '.sql')]
        changed = [name for name in frozen if not (ROOT / name).exists() or sha(z.read(name)) != sha((ROOT / name).read_bytes())]
        check('Fontes SQL/JS do núcleo 2B–2F preservadas', not changed, files=len(frozen), changed=changed)
        report['delta_from_4a'] = [name for name in z.namelist() if Path(name).suffix in ('.ts','.tsx','.css','.mjs','.sql','.md','.yaml') and (ROOT/name).is_file() and sha(z.read(name)) != sha((ROOT/name).read_bytes())]
    for filename, count in [('resultado-4b.json',51),('regressao-4a.json',80),('regressao-auditoria-4a.json',13),('regressao-2f.json',28),('rede.json',8)]:
        result = read(LAB / filename)
        check(filename, result['passed'] and len(result['checks']) == count and all(c['ok'] for c in result['checks']), count=count)
    web = read(LAB/'web-completa-4b.json')
    check('Web completa 271/271', web['success'] and web['numPassedTests']==271 and web['numFailedTests']==0)
    shell_web = read(LAB/'web-shell-completa.json')
    check('Web após shell 284/284', shell_web['success'] and shell_web['numPassedTests']==284 and shell_web['numFailedTests']==0)
    visual = read(LAB/'visual-shell-4b.json')
    check('Shell responsivo e teclado no Edge', len(visual['responsive'])==5 and all(not item['home']['overflow'] and item['home']['controlsOutside']==0 and item['home']['headerSticky'] and item['home']['registerButtons']==1 and item['drawer']['modal'] and not item['drawer']['menuOverflow'] for item in visual['responsive']) and all(item['shiftTab']=='Sair' and item['tab']=='Fechar menu' and item['escape']=='Abrir menu' for item in visual['keyboard']))
    check('Shell local em loopback', read(LAB/'estado-shell-final.json')['loopback_only'])
    for filename,count in [('banco.log',31),('qualidade.log',44)]:
        text=(LAB/filename).read_text(encoding='utf-8-sig')
        check(filename, re.search(r'pass '+str(count)+r'\b',text) and re.search(r'fail 0\b',text),count=count)
    records = (ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-4b/registros.mjs').read_text()
    check('Camada de leitura sem DDL/escrita SQL', not re.search(r'\b(insert into|update |delete from|create table|alter table)\b', records, re.I))
    pdfs=[]
    for path in sorted(LAB.glob('*.pdf')):
        reader=PdfReader(path);text='\n'.join(page.extract_text() for page in reader.pages)
        check(path.name+' A4/texto/avisos',len(reader.pages)==1 and abs(float(reader.pages[0].mediabox.width)-595.28)<.01 and 'SIMULAÇÃO SEM VALOR OFICIAL' in text and 'NÃO É COMPROVANTE REP-P OFICIAL' in text and 'NÃO POSSUI ASSINATURA PAdES/ICP-BRASIL' in text and 'DADOS HISTÓRICOS LIMITADOS' in text)
        check(path.name+' sem GPS/assinatura',not re.search(r'latitude|longitude|\b-3\.7\b|\b-38\.5\b',text,re.I) and not reader.get_fields())
        scan(str(path.relative_to(ROOT)),path.read_bytes());scan(str(path.relative_to(ROOT))+'#text',text.encode())
        pdfs.append({'path':str(path.relative_to(ROOT)),'sha256':sha(path.read_bytes()),'pages':len(reader.pages)})
    report['pdfs']=pdfs
    with zipfile.ZipFile(LAB/'recibos-48h-sinteticos.zip') as z:
        check('ZIP operacional somente PDFs pessoais com nomes seguros',len(z.namelist())>0 and all(re.fullmatch(r'recibo-laboratorio-[a-f0-9-]{36}\.pdf',name) for name in z.namelist()) and len(z.namelist())==len(set(z.namelist())))
        for name in z.namelist():
            raw=z.read(name);scan('download48h/'+name,raw)
        report['download_zip']={'sha256':sha((LAB/'recibos-48h-sinteticos.zip').read_bytes()),'entries':len(z.namelist()),'names':z.namelist()}
    sources = [ROOT/'01_WEB/05_ACESSO_A_DADOS/Ponto/registros.ts',ROOT/'01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts',ROOT/'01_WEB/app/api/ponto-registros/[...path]/route.ts',ROOT/'01_WEB/app/colaborador/[[...screen]]/meus-registros.tsx',ROOT/'01_WEB/app/colaborador/[[...screen]]/meu-ponto-online.tsx',ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-4a/servidor-4a.mjs']
    sources += list(LAB.glob('*.mjs'))+list(LAB.glob('*.py'))+list(LAB.glob('*.json'))+list(LAB.glob('*.log'))+list((ROOT/'01_WEB/10_TESTES').glob('*4b.test.*'))+[ROOT/'05_DOCUMENTACAO/48_MARCO_4B_MEUS_REGISTROS_E_COMPROVANTES.md']
    sources += [ROOT/'01_WEB/app/colaborador/[[...screen]]'/name for name in ['colaborador-app.tsx','drawer-colaborador.tsx','pendencias-colaborador.tsx','page.tsx','colaborador.module.css','epi-troca.tsx','meu-perfil.tsx']]
    sources += [ROOT/'01_WEB/10_TESTES'/name for name in ['setup.ts','colaborador-preview.test.tsx','colaborador-epis.test.tsx','colaborador-obra.test.tsx','colaborador-auth-real.integration.tsx']]
    sources += [ROOT/'01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts']
    bundles=list((ROOT/'01_WEB/.next-local-preview/static').rglob('*.js'))+list((ROOT/'01_WEB/.next/static').rglob('*.js'))
    for path in sources+bundles:
        if path.name != 'verificacao-final-4b.json':
            scan(str(path.relative_to(ROOT)),path.read_bytes())
    check('Secret scan fontes/evidências/bundles/PDF/ZIP',not report['secrets'],files=len(scanned))
    report['scanned']=scanned
    report['passed']=True
except Exception as error:
    report['passed']=False;report['error']=str(error)
finally:
    (LAB/'verificacao-final-4b.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'passed':report['passed'],'checks':len(report['checks']),'scanned':len(scanned),'secrets':len(report['secrets']),'error':report.get('error')},ensure_ascii=False))
if not report['passed']:
    raise SystemExit(1)
