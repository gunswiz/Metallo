"""Fechamento 4A autorizado: verifica equivalência, herda a 3H e examina o ZIP final.

verify: catálogo/HTTP/listeners locais, sem marcação nova ou SQL de escrita.
Sem argumento: gera somente METALLO-4A-LAB-20261001-R1, sem sobrescrever arquivos.
Reutiliza helpers já existentes por AST, sem executar geradores históricos.
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
ROOT=Path(__file__).resolve().parents[2]
LAB=ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-4a'
OUT=ROOT/'outputs'
ID='METALLO-4A-LAB-20261001-R1'
PARENT_ID='METALLO-3H-LAB-20261001-R1'
PARENT_SHA='389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd'
PARENT=OUT/'Metallo-Marco3H-BaselineAprovada-20261001-R1.zip'
TARGET=OUT/'Metallo-Marco4A-BaselineAprovada-20261001-R1.zip'
DOC='05_DOCUMENTACAO/47_MARCO_4A_MEU_PONTO_ONLINE_GEOLOCALIZACAO.md'
VERIFICATION=LAB/'verificacao-fechamento-4a.json'
sha=lambda raw:hashlib.sha256(raw).hexdigest()
encoded=lambda obj:(json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
read=lambda name:(ROOT/name).read_bytes()
load=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))

helper_source=ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-3d/gerar-baseline-3d.py'
tree=ast.parse(helper_source.read_text(encoding='utf-8-sig'))
nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'checked_archive','local_secrets'}
       or isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PATTERNS' for t in n.targets)]
assert len(nodes)==3
helpers={'ROOT':ROOT,'Path':Path,'json':json,'re':re,'zipfile':zipfile,'sha':sha}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(helper_source),'exec'),helpers)
assert not (ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref').exists()
assert sha(PARENT.read_bytes())==PARENT_SHA
parent_manifest,parent=helpers['checked_archive'](PARENT,PARENT_ID)
parent_receipt=load(Path(str(PARENT)+'.verificacao.json'))
assert parent_manifest['is_approved_baseline'] and parent_receipt['passed'] and not parent_receipt['findings']
assert parent_receipt['zip']['sha256']==PARENT_SHA
parent_hashes={p:sha(raw) for p,raw in parent.items()}

# Resolve a cadeia por referências dos manifestos, não por nome ou mtime.
baselines={}
for path in OUT.glob('*Baseline*.zip'):
    if path==TARGET:continue
    with zipfile.ZipFile(path) as archive:
        manifest=json.loads(archive.read('MANIFESTO_SHA256.json'))
    baseline_id=manifest.get('id',manifest.get('baseline'))
    if isinstance(baseline_id,dict):baseline_id=baseline_id['id']
    digest=sha(path.read_bytes())
    assert digest not in baselines
    baselines[digest]={'id':baseline_id,'zip':path.name,'sha256':digest,
        'manifest':manifest,'at':manifest.get('at',manifest.get('created_at')),
        'files':len(manifest['files']),'entries':len(manifest['files'])+1}
newer=[v for v in baselines.values() if v['manifest'].get('is_approved_baseline') and v['at']>parent_manifest['at']]
assert not newer,'Há baseline aprovada posterior à origem declarada'
chain=[];digest=PARENT_SHA;seen=set()
while digest:
    assert digest in baselines and digest not in seen,'Cadeia incompleta/ambígua'
    seen.add(digest);node=baselines[digest];manifest=node['manifest']
    with zipfile.ZipFile(OUT/node['zip']) as archive:
        assert archive.testzip() is None
        for row in manifest['files']:
            assert sha(archive.read(row['path']))==row['sha256']
    chain.append({k:node[k] for k in ('id','zip','sha256','at','files','entries')})
    ref=manifest.get('parent',manifest.get('origin',manifest.get('r1')))
    if ref:
        digest=ref['sha256']
        assert digest in baselines
        if ref.get('id'):assert baselines[digest]['id']==ref['id']
        if ref.get('zip'):assert baselines[digest]['zip']==ref['zip']
    else:digest=None
chain.reverse()
previous={v['zip']:v['sha256'] for v in baselines.values()}

meta=load(LAB/'auditoria-4a.json');assert len(meta['cycles'])==2 and meta['final_confirmed_critical_high_open']==0
expected=[('75c64e38022ad175a1648aeee42aaafbb8cfaf9478ea0a46f82eda4378c015c3',72,73,'d68decf352cf09b3615dfeac03dac95348299fb0c87862ddce235050a7dc5249'),
          ('f130eb6d95585078d5c98b7bf12dcf002dbc34d6500d2267add32860ea4d64f2',77,78,'de686a49096b63977ee0bbc4eea1f21a01a37c2d7ec91ea7cc0adca68d14b874')]
audits=[]
for cycle,(package_sha,files,entries,opinion_sha) in enumerate(expected,1):
    info=meta['cycles'][cycle-1];assert info['cycle']==cycle and info['package_sha256']==package_sha
    path=ROOT/info['package'];assert sha(path.read_bytes())==package_sha
    manifest,contents=helpers['checked_archive'](path,f'METALLO-4A-AUDITORIA-CICLO{cycle}')
    assert manifest['inventory_count']==files and manifest['zip_entries']==entries
    receipt=load(Path(str(path)+'.verificacao.json'))
    assert receipt['passed'] and not receipt['findings'] and receipt['zip']['sha256']==package_sha
    assert sha((LAB/info['original']).read_bytes())==opinion_sha==info['original_sha256']
    audits.append({'cycle':cycle,'zip':path.name,'sha256':package_sha,'files':files,'entries':entries,
        'direct_scan_passed':True,'opinion':(LAB/info['original']).relative_to(ROOT).as_posix(),
        'opinion_sha256':opinion_sha,'conversation':info['conversation_url'],'response':info['response_url']})
    if cycle==2:audited=contents

post_audit_allowed={DOC,'04_BANCO_E_SUPABASE/laboratorio-marco-4a/auditoria-4a.json',
    '04_BANCO_E_SUPABASE/laboratorio-marco-4a/verificacao-final-4a.json',
    '04_BANCO_E_SUPABASE/laboratorio-marco-4a/verificar-4a.py'}
selected={n for n in audited if n.startswith(('01_WEB/','03_COMPARTILHADO/','04_BANCO_E_SUPABASE/','05_DOCUMENTACAO/')) or n=='AGENTS.md'}
post_audit_changes=[]
for name in selected:
    assert (ROOT/name).is_file(),name
    if read(name)!=audited[name]:
        assert name in post_audit_allowed,f'Fonte funcional mudou após ciclo 2: {name}'
        post_audit_changes.append(name)
frozen=[n for n in parent if '/laboratorio-marco-2' in n and n.endswith(('.mjs','.sql','.py'))]
assert len(frozen)==25 and all(read(n)==parent[n] for n in frozen)
proof=load(LAB/'resultado-4a.json');delta_proof=load(LAB/'resultado-auditoria-4a.json')
assert proof['passed'] and len(proof['checks'])==80 and all(c['ok'] for c in proof['checks'])
assert delta_proof['passed'] and len(delta_proof['checks'])==13 and all(c['ok'] for c in delta_proof['checks'])
web=load(LAB/'web-completa-4a.json');assert web['success'] and web['numPassedTests']==web['numTotalTests']==246 and web['numFailedTests']==0
assert len(next(t for t in web['testResults'] if 'ponto-online.test' in t['name'])['assertionResults'])==23
results={'4A_Auth_JWT_PostgREST_HTTP':'80/80','confrontation_reproduction_sessions':'13/13','specific_web':'23/23',
    'web_complete':'246/246','2F':'28/28','bank':'31/31','quality':'44/44','network':'8/8',
    'TypeScript':'aprovado','lint':'aprovado','build':'aprovado','overlapping_suites_do_not_sum':True,
    'closure_does_not_claim_full_test_rerun':True}

if sys.argv[1:]==['verify']:
    verification=load(LAB/'verificacao-final-4a.json');assert verification['passed'] and all(verification['gates'].values())
    docker='C:/Program Files/Docker/Docker/resources/bin/docker.exe'
    endpoint=subprocess.check_output([docker,'context','inspect','--format','{{.Endpoints.docker.Host}}'],text=True).strip()
    assert endpoint.startswith('npipe:////./pipe/'),'Docker não local'
    # Reutiliza exatamente o SELECT estrutural já auditado, sem regravar seu catálogo.
    tree=ast.parse((LAB/'gerar-pacote-auditoria-4a.py').read_text(encoding='utf-8'))
    query=next(ast.literal_eval(n.value) for n in ast.walk(tree) if isinstance(n,ast.Assign)
        and any(isinstance(t,ast.Name) and t.id=='query' for t in n.targets))
    raw=subprocess.check_output([docker,'exec','supabase_db_laboratorio-marco-1a','psql','-X','-q','-A','-t','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',query],text=True,encoding='utf-8')
    current=json.loads(raw);original=load(LAB/'catalogo-autorizacao-local.json')
    assert {k:v for k,v in current.items() if k!='at'}=={k:v for k,v in original.items() if k!='at'},'Catálogo funcional/ACL/RLS mudou'
    command='Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3101,3102,3105,3106,54321,54322,54323,54324,54327 } | Select-Object LocalAddress,LocalPort | ConvertTo-Json'
    listeners=json.loads(subprocess.check_output(['powershell','-NoProfile','-Command',command],text=True,encoding='utf-8'))
    assert {r['LocalPort'] for r in listeners}=={3101,3102,3105,3106,54321,54322,54323,54324,54327}
    assert all(r['LocalAddress'] in {'127.0.0.1','::1'} for r in listeners)
    with urllib.request.urlopen('http://127.0.0.1:3106/health',timeout=15) as response:health=json.load(response)
    assert health['status']=='READY' and health['ready_for_new_events'] and not health['official']
    js="""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
import {status,local} from './04_BANCO_E_SUPABASE/laboratorio-marco-4a/ambiente.mjs';
const saved=JSON.parse(readFileSync('./backups/credenciais-previa-3h.json','utf8')).joao;
const r=await local('/auth/v1/token?grant_type=password',status.ANON_KEY,{email:saved.email,password:saved.password});assert.equal(r.status,200);
const token=(await r.json()).access_token;const headers={Authorization:`Bearer ${token}`,Origin:'http://127.0.0.1:3101','Content-Type':'application/json'};
try{
 const history=async()=>{const r=await fetch('http://127.0.0.1:3106/lab-point/v4a/events',{headers});assert.equal(r.status,200);return r.json();};
 const before=await history(),checks=[];
 for(const url of ['http://127.0.0.1:3105/lab-point/v1/events','http://127.0.0.1:3101/api/ponto-lab/events']){
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({contract_version:1,idempotency_key:randomUUID()})});assert.equal(response.status,404);checks.push({url,status:404});
 }
 assert.deepEqual(await history(),before);console.log(JSON.stringify({legacy_denied:checks,history_unchanged:true,geolocation_collected:false}));
}finally{const r=await local('/auth/v1/logout?scope=local',token,{});assert.ok(r.ok);}
"""
    http=json.loads(subprocess.check_output(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',js],cwd=ROOT,text=True,encoding='utf-8',stderr=subprocess.DEVNULL))
    record={'at':datetime.now(timezone.utc).isoformat(),'id':ID,'passed':True,'scope':'conferência final somente local; SELECT estrutural; login sintético transitório; nenhuma nova marcação',
        'origin':chain[-1],'baseline_chain_verified':chain,'previous_baselines_preserved':previous,
        'audits_preserved':audits,'audited_functional_sources_identical':True,'post_audit_documentation_evidence_changes':sorted(post_audit_changes),
        'frozen_core_sources_identical':frozen,'catalog_functions_identical':5,'catalog_tables_identical':7,
        'listeners':listeners,'health':health,'http':http,'results_preserved':results,'remote_not_touched':True,'published':False}
    VERIFICATION.write_bytes(encoded(record))
    print(json.dumps({'passed':True,'origin':chain[-1],'chain_nodes':len(chain),'functions':5,'tables':7,'frozen_core_sources':25,'legacy_status':404,'history_unchanged':True,'listeners_loopback':True},ensure_ascii=False))
    sys.exit(0)

assert not sys.argv[1:],'Use verify ou sem argumento'
assert load(VERIFICATION)['passed']
for path in (TARGET,Path(str(TARGET)+'.sha256'),Path(str(TARGET)+'.verificacao.json')):assert not path.exists(),f'Não sobrescrever: {path.name}'
doc=read(DOC).decode('utf-8-sig')
for value in (ID,'FUNCIONAL EM LABORATÓRIO','80/80','13/13','F-4A-01','APROVADA','SIMULAÇÃO SEM VALOR OFICIAL'):assert value in doc,value
payload=dict(parent)
# Excluir somente capturas de interface Grok do NOVO ZIP; preservar os originais fora dele.
excluded=[n for n in payload if Path(n).name.startswith('grok-') and Path(n).suffix.lower() in {'.png','.jpg','.jpeg'}]
for name in excluded:del payload[name]
for name in selected:payload[name]=read(name)
additional=[DOC,'05_DOCUMENTACAO/MAPA_DO_METALLO.md',
    '04_BANCO_E_SUPABASE/laboratorio-marco-4a/parecer-grok-ciclo2-original.md',
    '04_BANCO_E_SUPABASE/laboratorio-marco-4a/gerar-baseline-4a.py',
    '04_BANCO_E_SUPABASE/laboratorio-marco-4a/verificacao-fechamento-4a.json']
for name in additional:payload[name]=read(name)
for audit in audits:
    for suffix in ('.sha256','.verificacao.json'):
        name='outputs/'+audit['zip']+suffix;payload[name]=read(name)
payload['BASELINE_3H_MANIFESTO.json']=encoded(parent_manifest)
for name in frozen:assert payload[name]==parent[name]==read(name)
limits=['SIMULAÇÃO SEM VALOR OFICIAL','NÃO IMPLANTADO NO SUPABASE REMOTO','NÃO LIBERADO PARA FUNCIONÁRIOS REAIS',
    'NÃO É PRODUÇÃO','NÃO É CONFORMIDADE REP-P','NÃO É AUTORIZAÇÃO DE PONTO OFICIAL','NÃO AUTORIZA PUBLICAÇÃO','SEM MARCO 4B','SEM TERCEIRO CICLO GROK']
risks=['portabilidade do hash JSON/driver/tipos','filtro interno por UUID; sem injeção do titular comprovada',
    'administrador/controlador do host e do relógio/arquivos/âncoras','GPS declarado pelo cliente; FakeGPS/spoofing possível',
    'um escritor; múltiplos writers/power/disk/backup/restore da extensão não comprovados',
    'janela residual Auth → commit, token residual e política de sessão/logout',
    'gates legais/CCT/ACT/DP e REP-P não concluídos','LGPD exige finalidade/hipótese/retenção/direitos/RIPD e decisões organizacionais',
    'infraestrutura oficial/HLB/ARP/HA/NSR/AFD/AEJ/comprovante/assinaturas não definidos/concluídos',
    'sem produção real ou funcionários reais; sem segundo computador físico ensaiado',
    'Gestão mostra nome atual, não snapshot nominal histórico; leitura pessoal 50/admin 100']
payload['LEIA-ME.md']=(f'# {ID}\n\nMARCO 4A — MEU PONTO ONLINE + GEOLOCALIZAÇÃO — FUNCIONAL EM LABORATÓRIO. '
    'Fechamento técnico e baseline autorizados pelo responsável em 01/10/2026; avaliação manual APROVADA, dois ciclos Grok confrontados. '
    f'Origem {PARENT_ID}, SHA-256 {PARENT_SHA}; consulte {DOC}. Núcleo 2F preservado, extensão local 4A. '
    'Fotografia seletiva cumulativa de fontes/evidências, não checkout executável nem dump/backup integral. '
    'Pareceres originais/URLs/hashes preservados; capturas Grok excluídas para não carregar perfil/histórico da conta. '
    'Arquivos herdados de outros marcos são contexto histórico, não implementação nova. '
    'SHA-256 FINAL e scan direto ficam nos recibos externos .zip.sha256/.zip.verificacao.json para evitar autorreferência. '
    'Válida somente com recibo passed=true, zero segredos confirmados e hash exato.\n\n'+'; '.join(limits)+'.\n').encode('utf-8')
payload['INVENTARIO_4A.json']=encoded([{'path':n,'bytes':len(raw),'sha256':sha(raw),
    'origin':'3H preservado' if parent_hashes.get(n)==sha(raw) else '4A selecionado/fechamento'} for n,raw in sorted(payload.items())])
delta=[{'path':n,'kind':'alterado' if n in parent else 'novo','sha256_3h':parent_hashes.get(n),'sha256_4a':sha(raw)}
    for n,raw in sorted(payload.items()) if parent_hashes.get(n)!=sha(raw)]
removed=[{'path':n,'sha256_3h':parent_hashes[n],'reason':'captura de navegação Grok excluída do novo ZIP; arquivo/baseline anterior intactos'} for n in sorted(set(parent)-set(payload))]
assert {r['path'] for r in removed}==set(excluded)
inventory=[{'path':n,'bytes':len(raw),'sha256':sha(raw)} for n,raw in sorted(payload.items())]
manifest={'id':ID,'at':datetime.now(timezone.utc).isoformat(),'is_approved_baseline':True,
    'status':'MARCO 4A — MEU PONTO ONLINE + GEOLOCALIZAÇÃO — FUNCIONAL EM LABORATÓRIO','document':DOC,
    'parent':{'id':PARENT_ID,'zip':PARENT.name,'sha256':PARENT_SHA,'at':parent_manifest['at'],'files':len(parent),'entries':len(parent)+1,'immutable':True},
    'baseline_chain':chain,'chain_method':'referências SHA/parent/r1 reais dos manifestos; todos os ZIPs e hashes internos conferidos',
    'formal_approval':{'by':'responsável','date':'2026-10-01','explicitly_authorized':ID,'manual_preview':'APROVADA','local_only':True},
    'results':results,'closure_verification':VERIFICATION.relative_to(ROOT).as_posix(),
    'audits':{'cycles':2,'packages':audits,'findings_confronted':10,'critical_confirmed_open':0,'high_confirmed_open':0,'medium':0,'low_residual':2,'informational':5,'third_cycle':False,'passive_only':True,'confrontation':DOC},
    'classifications':{'F-4A-01':'VÁLIDO/REPRODUZIDO/CORRIGIDO/FECHADO','F-4A-02':'INVÁLIDO','F-4A-03':'PARCIAL/residual','F-4A-04':'INVÁLIDO',
        'F-4A-05':'VÁLIDO/arquitetural','F-4A-06':'VÁLIDO/contexto não confiável','F-4A-07':'VÁLIDO/futuro','F-4A-08':'PARCIAL/residual','F-4A-09':'VÁLIDO/futuro','F-4A-10':'PARCIAL/residual'},
    'point_2f_preserved':True,'frozen_core_sources_verified_unchanged':frozen,
    'architecture':'extensão local do mesmo núcleo; intenção/GPS pontual/recibo/UI/consulta Gestão readonly',
    'time':'servidor autoritativo; marking_at separado de recorded_at; America/Fortaleza',
    'location':'após ação explícita; uma aquisição; ausência/negação/baixa precisão não bloqueiam; sem rastreamento/punição/fraude automática',
    'originals':'imutáveis nas APIs; correções futuras aditivas/auditáveis; limite de host preservado',
    'identity':'servidor resolve titular; João/Maria isolados; equipe NULL não amplia autoridade; ativo sem equipe mantém portal',
    'idempotency':'mesma intenção reutiliza resultado; sem fila offline','receipt':'hash técnico não é assinatura/autoria/ICP-Brasil',
    'management':'somente leitura, administrador global ativo, sem coordenadas no DTO comum',
    'residual_risks':risks,'limits':limits,'remote_not_touched':True,'published':False,
    'inventory_count':len(inventory),'files':inventory,'zip_entries':len(inventory)+1,
    'delta_from_3h':delta,'removed_from_3h':removed,
    'delta_counts':{'new':sum(r['kind']=='novo' for r in delta),'changed':sum(r['kind']=='alterado' for r in delta),'removed':len(removed)},
    'secret_scan_receipt':TARGET.name+'.verificacao.json','approval_condition':'passed=true, zero segredos confirmados, manifesto/hashes válidos e SHA exato'}
payload['MANIFESTO_SHA256.json']=encoded(manifest)
with zipfile.ZipFile(TARGET,'x',zipfile.ZIP_DEFLATED) as archive:
    for name,raw in sorted(payload.items()):archive.writestr(name,raw)

# Scan do objeto FINAL, não apenas dos arquivos do workspace.
patterns=tuple(helpers['PATTERNS'])+(
    ('access token literal',r'(?:access_token|accessToken)\s*[=:]\s*[\"\'][A-Za-z0-9._-]{24,}[\"\']'),
    ('private JWK',r'[\"\']d[\"\']\s*:\s*[\"\'][A-Za-z0-9_-]{32,}[\"\']'),)
known=helpers['local_secrets']()
for path in (ROOT/'01_WEB').glob('.env*'):
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig',errors='ignore').splitlines():
            match=re.match(r'\s*(?:export\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$',line,re.I)
            if match and len(match[2].strip('"\''))>=12:known.add(match[2].strip('"\''))
status=json.loads(subprocess.check_output(['C:/Program Files/nodejs/node.exe',str(ROOT/'node_modules/supabase/dist/supabase.js'),'status','--workdir',str(ROOT/'04_BANCO_E_SUPABASE/laboratorio-marco-1a'),'-o','json'],text=True,encoding='utf-8',stderr=subprocess.DEVNULL))
assert status['API_URL']=='http://127.0.0.1:54321'
for key in ('SERVICE_ROLE_KEY','JWT_SECRET','ANON_KEY','SECRET_KEY'):
    if isinstance(status.get(key),str) and len(status[key])>=12:known.add(status[key])
accepted={(r['path'],r['kind'],m['match_sha256']):m for r in parent_receipt.get('triage',[]) for m in r['matches'] if m.get('classification')=='NOT_SECRET'}
findings=[];alerts=[];triage=[];pdfs=[]
with zipfile.ZipFile(TARGET) as archive:
    assert archive.testzip() is None
    names=archive.namelist();assert len(names)==len(set(names))==manifest['zip_entries']
    assert set(names)=={r['path'] for r in inventory}|{'MANIFESTO_SHA256.json'}
    for row in inventory:
        raw=archive.read(row['path']);assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
    for entry in archive.infolist():
        name=entry.filename;parts=PurePosixPath(name).parts
        if (entry.is_dir() or stat.S_ISLNK(entry.external_attr>>16) or not parts or name.startswith('/') or '..' in parts or ':' in name or '\\' in name
            or any(p.lower() in {'backups','node_modules','.git','.temp','.next','cookies','credentials','credenciais','storage','localstorage','sessionstorage'}
                or p.lower().startswith(('.env','.next','credenciais-previa','credenciais-preview')) for p in parts)
            or name.lower().endswith(('.pem','.pfx','.p12','.key','.db','.sqlite','.dump','.bak','.pgdump','.zip','.map'))):findings.append({'path':name,'kind':'arquivo/caminho indevido'})
        raw=archive.read(entry);content=raw.decode('utf-8-sig',errors='ignore')
        if name.lower().endswith('.pdf'):
            reader=PdfReader(BytesIO(raw));content+='\n'+'\n'.join(p.extract_text() or '' for p in reader.pages)+'\n'+str(reader.metadata)
            pdfs.append({'path':name,'pages':len(reader.pages),'sha256':sha(raw),'bytes_text_metadata_scanned':True})
        if name.lower().endswith(('.png','.jpg','.jpeg')):assert name=='01_WEB/public/metallo-logo.png','Imagem humana não selecionada'
        if any(value in content for value in known):findings.append({'path':name,'kind':'credencial conhecida; valor omitido'})
        for kind,pattern in patterns:
            matches=list(re.finditer(pattern,content,re.I))
            if not matches:continue
            alerts.append({'path':name,'kind':kind,'occurrences':len(matches)})
            decisions=[]
            for match in matches:
                digest=sha(match.group().encode());decision=accepted.get((name,kind,digest))
                if decision and parent_hashes.get(name)==sha(raw):decisions.append(decision)
                else:findings.append({'path':name,'kind':kind,'match_sha256':digest})
            triage.append({'path':name,'kind':kind,'matches':decisions})
digest=sha(TARGET.read_bytes())
assert all(sha((OUT/name).read_bytes())==h for name,h in previous.items()),'Baseline anterior alterada'
for audit in audits:assert sha((OUT/audit['zip']).read_bytes())==audit['sha256']
receipt={'at':datetime.now(timezone.utc).isoformat(),'id':ID,'scope':'scan DIRETO de todas as entradas do ZIP FINAL 4A; PDFs bytes/texto/metadados; somente logo como imagem',
    'zip':{'path':TARGET.relative_to(ROOT).as_posix(),'sha256':digest,'bytes':TARGET.stat().st_size,'entries':len(names),'manifest_files_verified':len(inventory)},
    'delta_from_3h':manifest['delta_counts'],'known_local_credentials_compared_only_in_memory':len(known),
    'patterns_checked':[k for k,_ in patterns],'initial_raw_alerts':alerts,'triage':triage,'pdfs':pdfs,'findings':findings,
    'passed':not findings,'is_approved_baseline':not findings,'previous_baselines_preserved':previous,'audit_cycles_preserved':True,
    'remote_not_touched':True,'published':False,'real_employee_data_included':False}
Path(str(TARGET)+'.verificacao.json').write_bytes(encoded(receipt))
if findings:
    print(json.dumps({'passed':False,'findings':findings},ensure_ascii=False));sys.exit(1)
Path(str(TARGET)+'.sha256').write_text(f'{digest}  {TARGET.name}\n',encoding='ascii')
TARGET.chmod(0o444)
print(json.dumps({'passed':True,'id':ID,'zip':str(TARGET),'sha256':digest,'files':len(inventory),'entries':len(names),
    'delta':manifest['delta_counts'],'confirmed_secrets':0,'previous_baselines_preserved':len(previous),'chain_nodes':len(chain)},ensure_ascii=False))
