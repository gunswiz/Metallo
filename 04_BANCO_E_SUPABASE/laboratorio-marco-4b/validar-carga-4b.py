"""Validação independente dos PDFs/ZIPs recebidos; não chama Auth/rede/banco."""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone, timedelta
from io import BytesIO
import hashlib
import json
import zipfile
import os
from pypdf import PdfReader

LAB = Path(__file__).resolve().parent
ROOT = LAB.parents[1]
profile4c = os.environ.get('METALLO_4C_RUN')
assert not profile4c or profile4c in {'antes', 'depois', 'duracao'}
if profile4c:
    LAB = ROOT / '04_BANCO_E_SUPABASE/laboratorio-marco-4c'
    if os.environ.get('METALLO_4C_ROUND') in ('2', '3', '4', '5'):
        LAB = LAB / ('rodada-' + os.environ['METALLO_4C_ROUND'])
    LAB = LAB / profile4c
load = json.loads((LAB / 'carga-resultado.json').read_text(encoding='utf-8'))
artifact_dir = Path(load['artifacts_dir']).resolve()
assert artifact_dir.is_relative_to((ROOT / ('backups/marco-4c-ensaios' if profile4c else 'backups/marco-4b-ensaios')).resolve())
report = {'run': load['run'], 'parser': 'pypdf + zipfile independentes do pdf-lib/fflate',
          'pdfs': [], 'zips': [], 'errors': [], 'passed': False}
sha = lambda data: hashlib.sha256(data).hexdigest()

def pdf(data, event):
    reader = PdfReader(BytesIO(data), strict=True)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert abs(float(page.mediabox.width) - 595.28) < .1
    assert abs(float(page.mediabox.height) - 841.89) < .1
    text = page.extract_text()
    assert event['event_id'] in text and event.get('reference', event.get('synthetic_reference')) in text
    for field in ('marking_at', 'recorded_at'):
        instant = datetime.fromisoformat(event[field].replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=-3)))
        assert instant.strftime('%d/%m/%Y') in text and instant.strftime('%H:%M:%S') in text
    assert 'SIMULAÇÃO SEM VALOR OFICIAL' in text
    assert 'NÃO É COMPROVANTE REP-P OFICIAL' in text
    assert 'Nome histórico do funcionário não preservado' in text
    assert '/Sig' not in str(reader.trailer) and not reader.get_fields()
    assert not any(word in text.lower() for word in ('latitude', 'longitude', 'accuracy_meters'))
    return {'event_id': event['event_id'], 'sha256': sha(data), 'pages': 1, 'a4': True,
            'event_and_original_times_match': True, 'legal_name_not_fabricated': True}

for item in load['downloads']:
    try:
        data = (artifact_dir / item['file']).read_bytes()
        assert sha(data) == item['sha256']
        if item['kind'] == 'pdf':
            report['pdfs'].append({'user': item['user'], 'file': item['file'], **pdf(data, item['event'])})
        else:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                assert archive.testzip() is None
                assert len(archive.namelist()) == len(set(archive.namelist()))
                assert sorted(archive.namelist()) == sorted(item['members'])
                checked = []
                for event in item['events']:
                    name = 'recibo-laboratorio-' + event['event_id'] + '.pdf'
                    assert len(PurePosixPath(name).parts) == 1
                    checked.append(pdf(archive.read(name), event))
                report['zips'].append({'user': item['user'], 'file': item['file'], 'sha256': sha(data),
                                       'members': checked, 'exact_personal_set': True})
    except Exception as error:
        report['errors'].append({'file': item['file'], 'error': type(error).__name__ + ': ' + str(error)})
resources = []
for line in (LAB / 'carga-recursos.jsonl').read_text(encoding='utf-8-sig').splitlines():
    if line.strip():
        resources.append(json.loads(line.lstrip('\ufeff')))
report['resources'] = {'samples': len(resources),
    'cpu_max_percent': max((r['cpu_percent'] for r in resources), default=None),
    'free_ram_min_bytes': min((r['free_ram_bytes'] for r in resources), default=None),
    'pg_connections_max': max((r['db_connections'] for r in resources if r.get('db_connections') is not None), default=None)}
completed = False
completion_path = LAB / 'confirmacao-final.json'
if profile4c and os.environ.get('METALLO_4C_ROUND') == '2' and completion_path.is_file():
    completion = json.loads(completion_path.read_text(encoding='utf-8'))
    assert completion['raw_driver_sha256'] == sha((LAB / 'carga-resultado.json').read_bytes())
    completed = completion['passed'] and completion['raw_driver_unmodified']
    report['raw_driver_passed'] = load['passed']
    report['independent_completion_sha256'] = sha(completion_path.read_bytes())
report['passed'] = (load['passed'] or completed) and not report['errors'] and len(report['pdfs']) >= 50 and len(report['zips']) >= 50
(LAB / 'carga-validacao-arquivos.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'pdfs': len(report['pdfs']), 'zips': len(report['zips']),
                  'errors': report['errors'], 'resources': report['resources']}, ensure_ascii=False))
raise SystemExit(0 if report['passed'] else 1)
