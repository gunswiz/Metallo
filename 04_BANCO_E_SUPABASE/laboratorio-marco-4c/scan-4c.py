"""Scan de fontes/evidências alteradas; inventário local, sem ZIP/baseline/envio.
Reutiliza padrões e leitura em memória de credenciais do scanner vigente.
"""
import ast
from datetime import datetime, timezone
from io import BytesIO
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile
import os
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
LAB = Path(__file__).resolve().parent
DEST = LAB / 'adocao-controlada/correcao-bootstrap' if os.environ.get('METALLO_EVIDENCE_REVISION') == '4c-bootstrap' else LAB / 'adocao-controlada' if os.environ.get('METALLO_EVIDENCE_REVISION') == '4c-adocao' else LAB / ('rodada-' + os.environ['METALLO_4C_ROUND']) if os.environ.get('METALLO_4C_ROUND') in ('2', '3', '4', '5', '6') else LAB
FINAL = os.environ.get('METALLO_SCAN_FINAL') == '1'
ORIGIN = ROOT / 'outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip'
SHA = '2ff3076d3a9bee5b33a363ae4264dde392bce7f4662273309b5a5085726c3c71'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
assert sha(ORIGIN.read_bytes()) == SHA
source = ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py'
nodes = [n for n in ast.parse(source.read_text(encoding='utf-8-sig')).body
         if isinstance(n, ast.FunctionDef) and n.name == 'local_secrets'
         or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'PATTERNS' for t in n.targets)]
helpers = {'ROOT': ROOT, 'Path': Path, 'json': json, 're': re}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), 'exec'), helpers)
known = helpers['local_secrets']()
# CLI somente status LOCAL. Os valores nunca são impressos nem persistidos.
status = json.loads(subprocess.check_output(['C:/Program Files/nodejs/node.exe',
    str(ROOT / 'node_modules/supabase/dist/supabase.js'), 'status', '--workdir',
    str(ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-1a'), '-o', 'json'],
    encoding='utf-8', stderr=subprocess.DEVNULL))
assert status['API_URL'] == 'http://127.0.0.1:54321'
for key in ('ANON_KEY', 'SERVICE_ROLE_KEY', 'JWT_SECRET', 'SECRET_KEY'):
    if isinstance(status.get(key), str) and len(status[key]) >= 12:
        known.add(status[key])
for path in (ROOT / '01_WEB').glob('.env*'):
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig', errors='ignore').splitlines():
            match = re.match(r'\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$', line, re.I)
            if match and len(match[2].strip('"\'')) >= 12:
                known.add(match[2].strip('"\''))

with zipfile.ZipFile(ORIGIN) as archive:
    manifest = json.loads(archive.read('MANIFESTO_SHA256.json'))
    previous = {row['path']: row['sha256'] for row in manifest['files']}
selected = {}
for name, digest in previous.items():
    path = ROOT / name
    if path.is_file() and sha(path.read_bytes()) != digest:
        selected[name] = {'kind': 'changed_from_4b_zip', 'previous_sha256': digest}
for path in LAB.rglob('*'):
    if path.is_file() and path.name not in {'secret-scan-4c.json', 'alteracoes-4c.json'}:
        selected[path.relative_to(ROOT).as_posix()] = {'kind': 'new_4c_evidence_or_source', 'previous_sha256': None}
for name in ['.gitignore', '01_WEB/eslint.config.mjs', '01_WEB/next.config.ts',
             '01_WEB/03_FUNCOES_E_LOGICA/Ponto/telemetria-laboratorio-4c.ts',
             '05_DOCUMENTACAO/49_MARCO_4C_DISPONIBILIDADE_DESEMPENHO_LOCAL.md',
             '05_DOCUMENTACAO/MAPA_DO_METALLO.md', '01_WEB/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio.ts']:
    selected.setdefault(name, {'kind': '4c_source_or_document', 'previous_sha256': previous.get(name)})
# Diferenças já existentes no checkout: não atribuir à implementação 4C.
preexisting = {'01_WEB/10_TESTES/colaborador-epis.test.tsx', 'pnpm-lock.yaml',
    '04_BANCO_E_SUPABASE/laboratorio-marco-3a/resultado-3a.json',
    '04_BANCO_E_SUPABASE/laboratorio-marco-3b/resultado-3b.json',
    '04_BANCO_E_SUPABASE/laboratorio-marco-3b/resultado-segredos-3b.json',
    '05_DOCUMENTACAO/39_MARCO_3A_MEU_PERFIL_MINHA_EQUIPE.md',
    '05_DOCUMENTACAO/46_MARCO_3H_COMUNICADOS.md'}
for name in preexisting:
    if name in selected:
        selected[name]['kind'] = 'preexisting_difference_from_4b_zip_not_edited_by_4c'
        selected[name]['last_write_utc'] = datetime.fromtimestamp((ROOT / name).stat().st_mtime, timezone.utc).isoformat()
patterns = tuple(helpers['PATTERNS']) + (
    ('access token literal', r'(?:access_token|accessToken)\s*[=:]\s*["\'][A-Za-z0-9._-]{24,}["\']'),
    ('credential JSON literal', r'"(?:access_token|refresh_token|password|service_role)"\s*:\s*"[^"\r\n]{12,}"'),
)
findings, entries, nested = [], [], []

def scan(name, raw):
    parts = PurePosixPath(name).parts
    if any(p.lower().startswith('.env') or p.lower() in {'backups', 'node_modules', '.git', '.temp', 'credentials', 'credenciais', 'cookies'} for p in parts) or name.lower().endswith(('.pem', '.pfx', '.p12', '.key', '.db', '.dump', '.pgdump', '.sqlite')):
        findings.append({'path': name, 'kind': 'forbidden_file'})
    text = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8', errors='ignore')
    if name.lower().endswith('.pdf'):
        pdf = PdfReader(BytesIO(raw))
        text += '\n' + '\n'.join(page.extract_text() or '' for page in pdf.pages) + str(pdf.metadata)
    for kind, pattern in patterns:
        if re.search(pattern, text, re.I):
            findings.append({'path': name, 'kind': kind})
    if any(value.encode() in raw or value in text for value in known):
        findings.append({'path': name, 'kind': 'known_local_credential'})
    if name.lower().endswith('.zip'):
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            assert archive.testzip() is None and len(archive.namelist()) == len(set(archive.namelist()))
            for child in archive.namelist():
                assert not child.startswith('/') and '..' not in PurePosixPath(child).parts
                scan(name + '!' + child, archive.read(child))
            nested.append({'path': name, 'sha256': sha(raw), 'members': len(archive.namelist())})

for name, metadata in sorted(selected.items()):
    raw = (ROOT / name).read_bytes()
    scan(name, raw)
    entries.append({'path': name, **metadata, 'bytes': len(raw), 'sha256': sha(raw)})
downloaded = []
if os.environ.get('METALLO_4C_ROUND') == '6' or os.environ.get('METALLO_EVIDENCE_REVISION') in ('4c-adocao', '4c-bootstrap'):
    for mode in (('incremental',) if os.environ.get('METALLO_EVIDENCE_REVISION') in ('4c-adocao', '4c-bootstrap') else ('full', 'incremental')):
        load = json.loads((DEST / 'pico' / mode / 'resumo.json').read_text(encoding='utf-8'))
        for case in load['cases']:
            for item in case['downloads']:
                artifacts = Path(item['artifacts_dir']).resolve()
                assert artifacts.is_relative_to((ROOT / 'backups/marco-4c-ensaios').resolve())
                filename = item['file']
                assert len(PurePosixPath(filename).parts) == 1
                raw = (artifacts / filename).read_bytes()
                assert sha(raw) == item['raw_sha256']
                scan('SYNTHETIC_DOWNLOADED_REPORT/' + filename, raw)
                downloaded.append({'file': filename, 'sha256': sha(raw), 'kind': item['kind']})
if os.environ.get('METALLO_4C_ROUND') in ('2', '3', '4', '5'):
    load = json.loads((DEST / 'depois/carga-resultado.json').read_text(encoding='utf-8'))
    artifacts = Path(load['artifacts_dir']).resolve()
    assert artifacts.is_relative_to((ROOT / 'backups/marco-4c-ensaios').resolve())
    for item in load['downloads']:
        filename = item['file']
        assert len(PurePosixPath(filename).parts) == 1
        raw = (artifacts / filename).read_bytes()
        assert sha(raw) == item['sha256']
        scan('SYNTHETIC_DOWNLOADED_REPORT/' + filename, raw)
        downloaded.append({'file': filename, 'sha256': sha(raw), 'kind': item['kind']})
inventory = {'at': datetime.now(timezone.utc).isoformat(), 'origin_sha256': SHA,
             'description': 'Current sources/evidence vs immutable 4B ZIP; not a baseline or package',
             'files': entries, 'files_count': len(entries)}
inventory_raw = (json.dumps(inventory, ensure_ascii=False, indent=2) + '\n').encode()
with (DEST / ('alteracoes-4c-final.json' if FINAL else 'alteracoes-4c.json')).open('xb') as output:
    output.write(inventory_raw)
scan('04_BANCO_E_SUPABASE/laboratorio-marco-4c/alteracoes-4c.json', inventory_raw)
receipt = {'at': datetime.now(timezone.utc).isoformat(), 'scope': 'changed/new sources and evidence; PDF bytes/text/metadata and ZIP members',
           'files_scanned': len(entries) + 1 + len(downloaded), 'downloaded_files_scanned': downloaded, 'inventory_sha256': sha(inventory_raw), 'origin_sha256': SHA,
           'known_local_values_compared_only_in_memory': len(known), 'nested_zips': nested,
           'patterns': [kind for kind, _ in patterns], 'findings': findings,
           'confirmed_secrets': len(findings), 'passed': not findings,
           'remote_accessed': False, 'baseline_created': False, 'grok': False}
with (DEST / ('secret-scan-4c-final.json' if FINAL else 'secret-scan-4c.json')).open('x', encoding='utf-8') as output:
    output.write(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'passed': not findings, 'files_scanned': len(entries) + 1 + len(downloaded), 'findings': findings}, ensure_ascii=False))
raise SystemExit(0 if not findings else 1)
