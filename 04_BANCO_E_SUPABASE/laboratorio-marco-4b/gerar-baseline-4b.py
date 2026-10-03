"""Fechamento 4B autorizado: fotografia seletiva cumulativa e scan direto do ZIP.

verify faz conferências locais somente leitura; sem argumento gera uma única
baseline, sem sobrescrever. Reutiliza helpers históricos por AST, sem executar
seus geradores. Os 120 downloads sintéticos são preservados, sem banco privado.
"""
import ast
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import urllib.request
import zipfile
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[2]
LAB = Path(__file__).resolve().parent
OUT = ROOT / 'outputs'
ID = 'METALLO-4B-LAB-20261001-R1'
PARENT_ID = 'METALLO-4A-LAB-20261001-R1'
PARENT_SHA = '50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d'
PARENT = OUT / 'Metallo-Marco4A-BaselineAprovada-20261001-R1.zip'
AUDIT = OUT / 'Metallo-Marco4B-RegistrosComprovantes-Auditoria-20261001-Ciclo1-Final.zip'
AUDIT_SHA = '9781552cba3062b07aec753a8f91ef3f8539638468fc02d604ae2d04ef509e47'
TARGET = OUT / 'Metallo-Marco4B-BaselineAprovada-20261001-R1.zip'
DOC = '05_DOCUMENTACAO/48_MARCO_4B_MEUS_REGISTROS_E_COMPROVANTES.md'
MAP = '05_DOCUMENTACAO/MAPA_DO_METALLO.md'
VERIFICATION = LAB / 'verificacao-fechamento-4b.json'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
encoded = lambda obj: (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
load = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
read = lambda name: (ROOT / name).read_bytes()

helper_source = ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py'
nodes = [n for n in ast.parse(helper_source.read_text(encoding='utf-8-sig')).body
         if isinstance(n, ast.FunctionDef) and n.name in {'checked_archive', 'local_secrets'}
         or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'PATTERNS' for t in n.targets)]
assert len(nodes) == 3
helpers = {'ROOT': ROOT, 'Path': Path, 'json': json, 're': re, 'zipfile': zipfile, 'sha': sha}
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(helper_source), 'exec'), helpers)


def checked_zip(path, expected_id):
    """Compatibilidade com manifesto da auditoria 4B, sem inventory_count."""
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        manifest = json.loads(archive.read('MANIFESTO_SHA256.json'))
        assert manifest['id'] == expected_id
        rows = manifest['files']
        assert len(names) == len(set(names)) == len(rows) + 1 == manifest['zip_entries']
        assert set(names) == {r['path'] for r in rows} | {'MANIFESTO_SHA256.json'}
        payload = {}
        for row in rows:
            raw = archive.read(row['path'])
            assert len(raw) == row['bytes'] and sha(raw) == row['sha256'], row['path']
            payload[row['path']] = raw
    return manifest, payload


def verify_sources():
    assert not (ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref').exists()
    assert sha(PARENT.read_bytes()) == PARENT_SHA
    parent_manifest, parent = helpers['checked_archive'](PARENT, PARENT_ID)
    parent_receipt = load(Path(str(PARENT) + '.verificacao.json'))
    assert parent_manifest['is_approved_baseline'] and parent_receipt['passed'] and not parent_receipt['findings']
    assert parent_receipt['zip']['sha256'] == PARENT_SHA
    assert sha(AUDIT.read_bytes()) == AUDIT_SHA
    audit_manifest, audited = checked_zip(AUDIT, 'METALLO-4B-AUDITORIA-CICLO1')
    audit_receipt = load(Path(str(AUDIT) + '.verificacao.json'))
    assert audit_receipt['passed'] and not audit_receipt['findings'] and audit_receipt['zip']['sha256'] == AUDIT_SHA
    assert audit_manifest['zip_entries'] == 183
    meta = load(LAB / 'auditoria-4b.json')
    assert meta['completed_verdicts'] == meta['cycles_sent'] == 1 and not meta['cycle2_required']
    assert meta['critical_high_confirmed_open'] == 0
    assert sha((LAB / meta['verdict']['path']).read_bytes()) == meta['verdict']['sha256']
    assert sha((LAB / 'grok-ciclo1-inspecao-visivel.txt').read_bytes()) == meta['verdict']['visible_capture_sha256']
    assert sha((LAB / 'grok-ciclo1-versoes.json').read_bytes()) == meta['verdict']['versions_sha256']
    assert sha((LAB / 'prompt-grok-ciclo1-enviado.md').read_bytes()) == meta['prompt_sha256']
    selected = {n for n in audited if n.startswith(('01_WEB/', '03_COMPARTILHADO/', '04_BANCO_E_SUPABASE/', '05_DOCUMENTACAO/')) or n == 'AGENTS.md'}
    changes = []
    for name in selected:
        if read(name) != audited[name]:
            assert name in {DOC, MAP}, f'Fonte funcional mudou após auditoria: {name}'
            changes.append(name)
    frozen = [n for n in parent if re.search(r'/laboratorio-marco-2[bdef]/', n) and n.endswith(('.mjs', '.sql'))]
    assert len(frozen) == 23 and all(read(n) == parent[n] for n in frozen)
    for name, count in [('resultado-4b.json', 51), ('regressao-4a.json', 80), ('regressao-auditoria-4a.json', 13), ('regressao-2f.json', 28)]:
        result = load(LAB / name)
        assert result['passed'] and len(result['checks']) == count and all(c['ok'] for c in result['checks']), name
    for name, count in [('web-auditoria-final-4b.json', 286), ('carga-gateways-correcao.json', 43)]:
        result = load(LAB / name)
        assert result['success'] and result['numPassedTests'] == result['numTotalTests'] == count and result['numFailedTests'] == 0
    for name, count in [('banco.log', 31), ('qualidade.log', 44), ('agendamento-http-provas.log', 2)]:
        text = (LAB / name).read_text(encoding='utf-8-sig')
        assert re.search(rf'\btests {count}\b', text) and re.search(rf'\bpass {count}\b', text) and re.search(r'\bfail 0\b', text)
    for result in meta['quality_execution'].values():
        assert result['exit_code'] == 0 and sha((LAB / result['log']).read_bytes()) == result['log_sha256']
    network = load(LAB / 'rede.json')
    assert network['passed'] and len(network['checks']) == 8 and all(r['ok'] for r in network['checks'])
    for name in ('build.log', 'carga-build.log'):
        text = (LAB / name).read_text(encoding='utf-8-sig')
        assert 'Compiled successfully' in text and 'Build error' not in text
    test_load = load(LAB / 'carga-resultado.json')
    validation = load(LAB / 'carga-validacao-arquivos.json')
    assert test_load['passed'] and not test_load['failures'] and validation['passed'] and not validation['errors']
    assert len(validation['pdfs']) == len(validation['zips']) == 60
    users = test_load['users']
    assert len(users) == 50 and sum(u['noTeam'] for u in users) == 5
    for field in ('authUserId', 'employeeId', 'sessionId', 'identityId'):
        assert len({u[field] for u in users}) == 50
    assert test_load['max_in_flight'] == 54 and test_load['retries'] == 7
    metrics = test_load['metrics']
    assert {k: metrics[k] for k in ('requests', 'success', 'http4xx', 'http5xx', 'timeouts', 'transport_errors')} == dict(requests=902, success=495, http4xx=405, http5xx=2, timeouts=0, transport_errors=0)
    integrity = test_load['integrity']
    assert integrity['old_count'] == 1100 and integrity['persisted_new_events'] == integrity['receipts_verified'] == 70
    assert integrity['originals_unchanged'] and integrity['ready'] and not any(integrity[k] for k in ('duplicates', 'lost_confirmed', 'cross_user'))
    assert len(test_load['revocations']) == 5 and all(r['successes_started_after_completion'] == 0 for r in test_load['revocations'])
    assert meta['local_read_only_postconfront']['missing_new_receipts'] == meta['local_read_only_postconfront']['orphan_receipts'] == 0
    assert all(r['events'] == 1 and r['receipt_matches'] and r['owner_matches'] for r in meta['local_read_only_postconfront']['begin_503_recovered'])
    artifacts = Path(test_load['artifacts_dir']).resolve()
    assert artifacts.is_relative_to((ROOT / 'backups/marco-4b-ensaios').resolve())
    downloads = {}
    for row in test_load['downloads']:
        assert PurePosixPath(row['file']).name == row['file'] and '\\' not in row['file']
        raw = (artifacts / row['file']).read_bytes()
        assert sha(raw) == row['sha256']
        downloads['04_BANCO_E_SUPABASE/laboratorio-marco-4b/carga-downloads/' + row['file']] = raw
    assert len(downloads) == 120
    previous = {p.name: sha(p.read_bytes()) for p in OUT.glob('*.zip') if p != TARGET}
    chain = parent_manifest['baseline_chain'] + [{k: parent_manifest[k] for k in ('id', 'at')} | {'zip': PARENT.name, 'sha256': PARENT_SHA, 'files': len(parent), 'entries': len(parent)+1}]
    for node in chain:
        path = OUT / node['zip']
        assert sha(path.read_bytes()) == node['sha256']
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None
            for row in json.loads(z.read('MANIFESTO_SHA256.json'))['files']:
                assert sha(z.read(row['path'])) == row['sha256']
    return parent_manifest, parent_receipt, parent, selected, changes, frozen, meta, test_load, validation, downloads, previous, chain


RESULTS = {'4B_real': '51/51', 'Web': '286/286', 'afetados': '43/43', 'agendamento': '2/2', '4A': '80/80',
           'confronto_4A': '13/13', '2F': '28/28', 'banco': '31/31', 'qualidade': '44/44', 'rede': '8/8',
           'TypeScript': 'APROVADO', 'lint': 'APROVADO', 'build': 'APROVADO', 'parser': '60 PDFs/60 ZIPs',
           'overlapping_suites_do_not_sum': True, 'full_suite_or_load_not_rerun_for_documentation_closure': True}
RISKS = ['MÉDIO ABERTO: disponibilidade/latência; um writer, p95 ~61s, p99 ~64s, duas respostas 503 recuperadas e throughput reduzido',
         'revogação de cinco contas; janela observada inclui intervalo de consulta e latência, sem prova instantânea',
         'Grok inspecionou amostras; parser local conferiu todos os 60 PDFs/60 ZIPs',
         'Home de carga mediu marcações pessoais; não 50 browsers completos nem três RPCs de pendências simultâneos',
         'arquivo já baixado não é revogável pelo servidor; não é falha de sessão',
         'janela futura autorização → envio completo dos bytes', 'administrador/controlador do host é limite de confiança',
         'RLS/visão Gestão e privilégios precisam revisão própria para eventual remoto',
         'sem produção, cluster, HA, múltiplos writers, energia/disco real ou segundo computador físico comprovados']
LIMITS = ['SIMULAÇÃO SEM VALOR OFICIAL', 'NÃO IMPLANTADO NO SUPABASE REMOTO', 'NÃO LIBERADO PARA FUNCIONÁRIOS REAIS',
          'NÃO É PRODUÇÃO', 'NÃO É CONFORMIDADE REP-P', 'NÃO É AUTORIZAÇÃO DE PONTO OFICIAL', 'NÃO AUTORIZA PUBLICAÇÃO',
          'SEM MARCO 4C', 'SEM SEGUNDO CICLO GROK', 'ZERO MIGRATION/RPC/RLS/GRANT NOVOS NO FECHAMENTO']


def verify_local(record):
    raw = subprocess.check_output(['netstat', '-ano'], text=True)
    ports = {3101, 3102, 3103, 3105, 3106, 3107, 3108, 54321, 54322, 54323, 54324, 54327}
    listeners = []
    for line in raw.splitlines():
        fields = line.split()
        if len(fields) == 5 and fields[0] == 'TCP' and fields[3] == 'LISTENING':
            address, port = fields[1].rsplit(':', 1)
            if int(port) in ports:
                listeners.append({'address': address.strip('[]'), 'port': int(port), 'pid': int(fields[4])})
    assert {r['port'] for r in listeners} == ports - {3103, 3107, 3108}
    assert all(r['address'] in {'127.0.0.1', '::1'} for r in listeners)
    with urllib.request.urlopen('http://127.0.0.1:3106/health', timeout=15) as response:
        health = json.load(response)
    assert health['status'] == 'READY' and health['ready_for_new_events'] and not health['official']
    docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'
    endpoint = subprocess.check_output([docker, 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip()
    assert endpoint.startswith('npipe:////./pipe/')
    tree = ast.parse((ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-4a/gerar-pacote-auditoria-4a.py').read_text(encoding='utf-8'))
    query = next(ast.literal_eval(n.value) for n in ast.walk(tree) if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id == 'query' for t in n.targets))
    current = json.loads(subprocess.check_output([docker, 'exec', 'supabase_db_laboratorio-marco-1a', 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', query], text=True, encoding='utf-8'))
    original = load(ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-4a/catalogo-autorizacao-local.json')
    assert {k: v for k, v in current.items() if k != 'at'} == {k: v for k, v in original.items() if k != 'at'}
    record.update(at=datetime.now(timezone.utc).isoformat(), passed=True, listeners=listeners, loopback_only=True,
                  load_ports_stopped=True, health=health, local_authorization_catalog_unchanged=True,
                  method='netstat -ano; health HTTP local somente leitura; SELECT estrutural local auditado; hashes',
                  no_login_or_new_mark=True, no_database_write=True, remote_not_touched=True, published=False)
    VERIFICATION.write_bytes(encoded(record))
    print(json.dumps({'passed': True, 'frozen_core_files': 23, 'catalog_unchanged': True, 'listeners_loopback': True,
                      'load_stopped': True, 'health': health['status'], 'download_hashes_verified': 120}, ensure_ascii=False))


def scan_final(manifest, parent, parent_receipt, nested_allowed, previous):
    patterns = tuple(helpers['PATTERNS']) + (
        ('access token literal', r'(?:access_token|accessToken)\s*[=:]\s*[\"\'][A-Za-z0-9._-]{24,}[\"\']'),
        ('private JWK', r'[\"\']d[\"\']\s*:\s*[\"\'][A-Za-z0-9_-]{32,}[\"\']'),
        ('credential JSON literal', r'(?:password|senha|access_token|accessToken|refresh_token|refreshToken|SERVICE_ROLE_KEY|service_role_key)[\"\']?\s*[=:]\s*[\"\'][A-Za-z0-9._!@#$%+-]{12,}[\"\']'),
        ('Authorization bearer literal', r'Authorization[\"\']?\s*[:=]\s*[\"\']Bearer [A-Za-z0-9._-]{24,}'),
        ('CPF formatted', r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'))
    known = helpers['local_secrets']()
    for path in (ROOT / '01_WEB').glob('.env*'):
        if path.is_file():
            for line in path.read_text(encoding='utf-8-sig', errors='ignore').splitlines():
                match = re.match(r'\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$', line, re.I)
                if match and len(match[2].strip('"\'')) >= 12:
                    known.add(match[2].strip('"\''))
    status = json.loads(subprocess.check_output(['C:/Program Files/nodejs/node.exe', str(ROOT / 'node_modules/supabase/dist/supabase.js'), 'status', '--workdir', str(ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-1a'), '-o', 'json'], text=True, encoding='utf-8', stderr=subprocess.DEVNULL))
    assert status['API_URL'] == 'http://127.0.0.1:54321'
    for key in ('SERVICE_ROLE_KEY', 'JWT_SECRET', 'ANON_KEY', 'SECRET_KEY'):
        if isinstance(status.get(key), str) and len(status[key]) >= 12:
            known.add(status[key])
    accepted = {(r['path'], r['kind'], m['match_sha256']): m for r in parent_receipt.get('triage', []) for m in r['matches'] if m.get('classification') == 'NOT_SECRET'}
    # Literais de mocks inspecionados: não são JWTs, não autenticam e a fonte é
    # byte-idêntica ao pacote auditado; permitir só caminho + hashes exatos.
    assert sha(AUDIT.read_bytes()) == AUDIT_SHA
    _, audited_sources = checked_zip(AUDIT, 'METALLO-4B-AUDITORIA-CICLO1')
    reviewed_mock_source_hashes = {}
    for file in ('colaborador-epis.test.tsx', 'colaborador-perfil-equipe.test.tsx', 'colaborador-preview.test.tsx'):
        name = '01_WEB/10_TESTES/' + file
        source = audited_sources[name] if name in audited_sources else parent[name]
        reviewed_mock_source_hashes[name] = sha(source)
        accepted[('01_WEB/10_TESTES/' + file, 'credential JSON literal',
                  'd952e36997bfef1e3f39f5ceb9295ed4b75bf3f2a24059dd48778d2155ae9326')] = {
            'match_sha256': 'd952e36997bfef1e3f39f5ceb9295ed4b75bf3f2a24059dd48778d2155ae9326',
            'source_sha256': reviewed_mock_source_hashes[name],
            'classification': 'NOT_SECRET', 'reason': 'Literal jwt-sintetico em mock vi.mock/getSession, sem assinatura ou validade Auth; fonte byte-idêntica à origem 4A ou ao pacote 4B auditado'}
    findings, alerts, triage, pdfs, nested = [], [], [], [], []

    def inspect(name, raw, entry, inherited=False):
        parts = PurePosixPath(name).parts
        if (entry.is_dir() or stat.S_ISLNK(entry.external_attr >> 16) or not parts or name.startswith('/') or '..' in parts or ':' in name or '\\' in name
            or any(p.lower() in {'backups', 'node_modules', '.git', '.temp', '.next', 'cookies', 'credentials', 'credenciais', 'storage', 'localstorage', 'sessionstorage'}
                   or p.lower().startswith(('.env', '.next', 'credenciais-previa', 'credenciais-preview')) for p in parts)
            or name.lower().endswith(('.pem', '.pfx', '.p12', '.key', '.db', '.sqlite', '.dump', '.bak', '.pgdump', '.map'))
            or name.lower().endswith('.zip') and name not in nested_allowed):
            findings.append({'path': name, 'kind': 'arquivo/caminho indevido'})
        content = raw.decode('utf-8-sig', errors='ignore')
        if name.lower().endswith('.pdf'):
            reader = PdfReader(BytesIO(raw), strict=True)
            content += '\n' + '\n'.join(p.extract_text() or '' for p in reader.pages) + '\n' + str(reader.metadata)
            pdfs.append({'path': name, 'sha256': sha(raw), 'pages': len(reader.pages), 'bytes_text_metadata_scanned': True})
        if name.lower().endswith(('.png', '.jpg', '.jpeg')):
            assert name == '01_WEB/public/metallo-logo.png', 'Imagem humana não selecionada'
        if any(value in content for value in known):
            findings.append({'path': name, 'kind': 'credencial conhecida; valor omitido'})
        for kind, pattern in patterns:
            matches = list(re.finditer(pattern, content, re.I))
            if not matches:
                continue
            alerts.append({'path': name, 'kind': kind, 'occurrences': len(matches)})
            decisions = []
            for match in matches:
                digest = sha(match.group().encode())
                decision = accepted.get((name, kind, digest))
                source_identical = parent.get(name) == raw or (
                    kind == 'credential JSON literal' and reviewed_mock_source_hashes.get(name) == sha(raw))
                if inherited and source_identical and decision:
                    decisions.append(decision)
                else:
                    findings.append({'path': name, 'kind': kind, 'match_sha256': digest})
            triage.append({'path': name, 'kind': kind, 'matches': decisions})

    with zipfile.ZipFile(TARGET) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names) == len(set(names)) == manifest['zip_entries']
        assert set(names) == {r['path'] for r in manifest['files']} | {'MANIFESTO_SHA256.json'}
        for row in manifest['files']:
            raw = archive.read(row['path'])
            assert len(raw) == row['bytes'] and sha(raw) == row['sha256']
        for entry in archive.infolist():
            name, raw = entry.filename, archive.read(entry)
            inspect(name, raw, entry, inherited=True)
            if name.endswith('.zip') and name in nested_allowed:
                assert sha(raw) == nested_allowed[name]['sha256']
                with zipfile.ZipFile(BytesIO(raw)) as child:
                    assert child.testzip() is None and len(child.namelist()) == len(set(child.namelist()))
                    assert sorted(child.namelist()) == sorted(nested_allowed[name]['members'])
                    for member in child.infolist():
                        assert re.fullmatch(r'recibo-laboratorio-[a-f0-9-]{36}\.pdf', member.filename)
                        inspect(name + '!' + member.filename, child.read(member), member)
                    nested.append({'path': name, 'sha256': sha(raw), 'entries': len(child.namelist()), 'direct_members_scanned': True})
    assert all(sha((OUT / name).read_bytes()) == digest for name, digest in previous.items()), 'Pacote anterior alterado'
    digest = sha(TARGET.read_bytes())
    receipt = {'at': datetime.now(timezone.utc).isoformat(), 'id': ID,
               'scope': 'scan DIRETO de todas as entradas do ZIP FINAL; PDFs bytes/texto/metadados; ZIPs sintéticos por allowlist de hash e membros',
               'zip': {'path': TARGET.relative_to(ROOT).as_posix(), 'sha256': digest, 'bytes': TARGET.stat().st_size, 'entries': len(names), 'manifest_files_verified': len(manifest['files'])},
               'known_local_credentials_compared_only_in_memory': len(known), 'patterns_checked': [k for k, _ in patterns],
               'initial_raw_alerts': alerts, 'triage': triage, 'pdfs': pdfs, 'nested_zips': nested, 'findings': findings,
               'passed': not findings, 'is_approved_baseline': not findings, 'confirmed_secrets': len(findings),
               'previous_packages_preserved': previous, 'audit_cycles_preserved': True, 'delta_from_4a': manifest['delta_counts'],
               'real_employee_data_included': False,
               'data_provenance': 'fontes/evidências de baselines anteriores conferidas; carga-fixtures.mjs gera dados sintéticos e downloads vinculados ao mesmo run; sem dumps de banco/Auth',
               'remote_not_touched': True, 'published': False}
    Path(str(TARGET) + '.verificacao.json').write_bytes(encoded(receipt))
    if findings:
        print(json.dumps({'passed': False, 'findings': findings}, ensure_ascii=False))
        raise SystemExit(1)
    Path(str(TARGET) + '.sha256').write_text(f'{digest}  {TARGET.name}\n', encoding='ascii')
    TARGET.chmod(0o444)
    print(json.dumps({'passed': True, 'id': ID, 'zip': str(TARGET), 'sha256': digest, 'files': len(manifest['files']),
                      'entries': len(names), 'delta': manifest['delta_counts'], 'confirmed_secrets': 0,
                      'raw_alerts_triaged': sum(a['occurrences'] for a in alerts), 'pdf_entries_scanned': len(pdfs),
                      'nested_zips_scanned': len(nested), 'previous_packages_preserved': len(previous)}, ensure_ascii=False))


def main():
    (parent_manifest, parent_receipt, parent, selected, changes, frozen, meta, test_load,
     validation, downloads, previous, chain) = verify_sources()
    closure = {'id': ID, 'origin': {'id': PARENT_ID, 'zip': PARENT.name, 'sha256': PARENT_SHA},
               'baseline_chain_verified': chain, 'previous_packages_preserved': previous,
               'audited_functional_sources_identical': True, 'post_audit_documentation_changes': sorted(changes),
               'frozen_core_sources_verified_unchanged': frozen, 'results_preserved': RESULTS,
               'load_run': test_load['run'], 'load_integrity': test_load['integrity'], 'audit_completed_cycles': 1,
               'cycle2_executed': False, 'manual_approval': 'APROVADA', 'critical_high_confirmed_open': 0,
               'residual_risks': RISKS, 'limits': LIMITS}
    blocked_scan = ROOT / 'tmp/4b-candidato-nao-aprovado-01.zip.verificacao.json'
    if blocked_scan.is_file():
        attempt = load(blocked_scan)
        assert not attempt['passed'] and attempt['findings'] == [{
            'path': '01_WEB/10_TESTES/colaborador-preview.test.tsx', 'kind': 'credential JSON literal',
            'match_sha256': 'd952e36997bfef1e3f39f5ceb9295ed4b75bf3f2a24059dd48778d2155ae9326'}]
        closure['blocked_scan_attempt'] = {
            'zip': 'tmp/4b-candidato-nao-aprovado-01.zip', 'sha256': attempt['zip']['sha256'],
            'receipt': blocked_scan.relative_to(ROOT).as_posix(), 'receipt_sha256': sha(blocked_scan.read_bytes()),
            'classification': 'NOT_SECRET; literal de mock, não é JWT; fonte atual corresponde ao pacote auditado, mas mudou em relação a 4A',
            'approved_baseline_overwritten': False}
    interrupted_candidate = ROOT / 'tmp/4b-candidato-nao-aprovado-02.zip'
    if interrupted_candidate.is_file():
        closure['interrupted_packaging_attempt'] = {
            'zip': interrupted_candidate.relative_to(ROOT).as_posix(), 'sha256': sha(interrupted_candidate.read_bytes()),
            'reason': 'KeyError no gerador de pacote: dois mocks herdados pertencem à origem 4A, ausentes do ZIP seletivo de auditoria; resolvido pela origem de hash exata',
            'final_scan_completed': False, 'approved_baseline_overwritten': False,
            'functional_sources_modified': False}
    if sys.argv[1:] == ['verify']:
        verify_local(closure)
        return
    assert not sys.argv[1:], 'Use verify ou sem argumento'
    verification = load(VERIFICATION)
    assert verification['passed'] and verification['id'] == ID and verification['previous_packages_preserved'] == previous
    for path in (TARGET, Path(str(TARGET) + '.sha256'), Path(str(TARGET) + '.verificacao.json')):
        assert not path.exists(), f'Não sobrescrever: {path.name}'
    for text in (ID, 'FUNCIONAL EM LABORATÓRIO', 'APROVADA', 'SIMULAÇÃO SEM VALOR OFICIAL'):
        assert text in read(DOC).decode('utf-8-sig')
    payload = dict(parent)
    for name in selected:
        payload[name] = read(name)
    # Evidências completas em seus arquivos vigentes; imagens de contas/navegador ficam no host.
    host_images = []
    for path in LAB.iterdir():
        if path.is_file() and path.suffix.lower() in {'.mjs', '.py', '.json', '.jsonl', '.log', '.md', '.txt'}:
            payload[path.relative_to(ROOT).as_posix()] = path.read_bytes()
        elif path.is_file() and path.suffix.lower() in {'.png', '.jpg', '.jpeg'}:
            host_images.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes()), 'reason': 'preservada no host; conteúdo visual/conta não incluído no ZIP'})
    payload.update(downloads)
    payload[DOC], payload[MAP] = read(DOC), read(MAP)
    for suffix in ('.sha256', '.verificacao.json'):
        name = 'outputs/' + AUDIT.name + suffix
        payload[name] = read(name)
    payload['BASELINE_4A_MANIFESTO.json'] = encoded(parent_manifest)
    payload['LEIA-ME.md'] = (f'# {ID}\n\nMARCO 4B — MEUS REGISTROS, COMPROVANTES E SHELL DO METALLO COLABORADOR — FUNCIONAL EM LABORATÓRIO.\n\n'
        f'Fechamento autorizado pelo responsável em 01/10/2026. Avaliação manual APROVADA; um ciclo Grok concluído/confrontado; sem ciclo 2. Origem {PARENT_ID}, SHA-256 {PARENT_SHA}. '
        f'Documentação vigente: {DOC}. Fotografia seletiva cumulativa de fontes/evidências, não checkout executável nem dump/backup de banco. '
        'Todo o relatório de carga, tentativas reprovadas e 120 downloads finais sintéticos foram preservados. '
        'Parecer original integral, prompt, URL e hashes preservados; o pacote enviado ao Grok permanece separado e imutável em outputs. '
        'Arquivos herdados e registros anteriores são contexto histórico; afirmações antigas de “sem baseline” descrevem a fase anterior ao fechamento. '
        'SHA final e scan ficam nos recibos externos .zip.sha256/.zip.verificacao.json para evitar autorreferência; aprovação válida apenas com passed=true e hash exato.\n\n'
        'O laboratório concluiu ensaio com 50 identidades concorrentes, preservando integridade, mas apresentou degradação significativa de latência/disponibilidade.\n\n'
        + '; '.join(LIMITS) + '.\n').encode('utf-8')
    payload['RESULTADOS_4B.json'] = encoded({'results': RESULTS, 'load': {'run': test_load['run'], 'metrics': test_load['metrics'],
        'environment': test_load['environment'], 'integrity': test_load['integrity'], 'identities': 50, 'no_team': 5,
        'max_in_flight': 54, 'retries': 7, 'pdfs': 60, 'zips': 60, 'revocations': test_load['revocations'],
        'postconfront_read_only': meta['local_read_only_postconfront']}, 'residual_risks': RISKS,
        'approval': 'APROVADA pelo responsável', 'limits': LIMITS})
    payload['INVENTARIO_4B.json'] = encoded([{'path': n, 'bytes': len(raw), 'sha256': sha(raw),
        'origin': '4A preservado' if parent.get(n) == raw else '4B fonte/evidência/fechamento'} for n, raw in sorted(payload.items())])
    delta = [{'path': n, 'kind': 'alterado' if n in parent else 'novo', 'sha256_4a': sha(parent[n]) if n in parent else None,
              'sha256_4b': sha(raw)} for n, raw in sorted(payload.items()) if parent.get(n) != raw]
    removed = sorted(set(parent) - set(payload))
    assert not removed and all(payload[n] == read(n) == parent[n] for n in frozen)
    counts = {'new': sum(r['kind'] == 'novo' for r in delta), 'changed': sum(r['kind'] == 'alterado' for r in delta), 'removed': 0}
    payload['DELTA_4A_4B.json'] = encoded({'origin': PARENT_ID, 'origin_sha256': PARENT_SHA, 'counts': counts, 'changes': delta, 'removed': removed,
        'scope': 'payload comparado, exclui o próprio DELTA e o manifesto para evitar autorreferência; fontes congeladas idênticas'})
    files = [{'path': n, 'bytes': len(raw), 'sha256': sha(raw)} for n, raw in sorted(payload.items())]
    complete_delta = delta + [{'path': 'DELTA_4A_4B.json', 'kind': 'novo', 'sha256_4a': None, 'sha256_4b': sha(payload['DELTA_4A_4B.json'])}]
    counts = {**counts, 'new': counts['new'] + 1}
    manifest = {'id': ID, 'at': datetime.now(timezone.utc).isoformat(), 'is_approved_baseline': True,
        'status': 'MARCO 4B — MEUS REGISTROS, COMPROVANTES E SHELL DO METALLO COLABORADOR — FUNCIONAL EM LABORATÓRIO',
        'document': DOC, 'parent': {'id': PARENT_ID, 'zip': PARENT.name, 'sha256': PARENT_SHA, 'at': parent_manifest['at'], 'immutable': True},
        'baseline_chain': chain, 'formal_approval': {'by': 'responsável', 'date': '2026-10-01', 'manual': 'APROVADA', 'local_only': True},
        'results': RESULTS, 'load': json.loads(payload['RESULTADOS_4B.json'])['load'], 'audit': meta,
        'audit_package': {'zip': AUDIT.name, 'sha256': AUDIT_SHA, 'entries': 183, 'scan_passed': True, 'preserved_separately': True},
        'critical_high_confirmed_open': 0, 'medium_availability_open': True, 'residual_risks': RISKS, 'limits': LIMITS,
        'frozen_core_sources_verified_unchanged': frozen, 'closure_verification': VERIFICATION.relative_to(ROOT).as_posix(),
        'host_visual_evidence': host_images, 'migration_rpc_rls_grant_changes': 0, 'remote_not_touched': True, 'published': False,
        'inventory_count': len(files), 'files': files, 'zip_entries': len(files) + 1,
        'delta_from_4a': complete_delta, 'removed_from_4a': removed, 'delta_counts': counts,
        'secret_scan_receipt': TARGET.name + '.verificacao.json', 'approval_condition': 'passed=true, zero segredos confirmados e SHA exato'}
    payload['MANIFESTO_SHA256.json'] = encoded(manifest)
    with zipfile.ZipFile(TARGET, 'x', zipfile.ZIP_DEFLATED) as archive:
        for name, raw in sorted(payload.items()):
            archive.writestr(name, raw)
    nested_allowed = {n: {'sha256': row['sha256'], 'members': row['members']}
        for row in test_load['downloads'] if row['kind'] == 'zip'
        for n in ['04_BANCO_E_SUPABASE/laboratorio-marco-4b/carga-downloads/' + row['file']]}
    sample = '04_BANCO_E_SUPABASE/laboratorio-marco-4b/carga-amostra-u0.zip'
    with zipfile.ZipFile(BytesIO(payload[sample])) as z:
        nested_allowed[sample] = {'sha256': sha(payload[sample]), 'members': z.namelist()}
    scan_final(manifest, parent, parent_receipt, nested_allowed, previous)


if __name__ == '__main__':
    main()
