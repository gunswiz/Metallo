"""Pacotes de auditoria e baseline 2D autorizada; destinos nunca são sobrescritos."""
from pathlib import Path
import hashlib,json,sys,zipfile,datetime,re
root=Path(__file__).resolve().parents[2]
ev='04_BANCO_E_SUPABASE/laboratorio-marco-2d'
mode=sys.argv[1]
baseline=mode=='baseline'
cycle=None if baseline else int(mode)
assert baseline or cycle in (1,2)
target=root/('outputs/Metallo-Marco2D-BaselineAprovada-20260927-R1.zip' if baseline else f'outputs/Metallo-Marco2D-Recuperacao-Auditoria-20260927-Ciclo{cycle}.zip')
for destination in [target,Path(str(target)+'.sha256'),Path(str(target)+'.verificacao.json')]:
 assert not destination.exists(),f'Destino já existe; não sobrescrever: {destination.name}'
protected={
 'Metallo-Marco1B-BaselineAprovada-20260927.zip':'41cc99f9eb38cbd895ec8e9555ce9c9e2d3ca1ead7b757c6f5dbffe89863a162',
 'Metallo-Marco1B-BaselineSaneada-20260927-R2.zip':'f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be',
 'Metallo-Marco1C-BaselineAprovada-20260927-R1.zip':'ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae',
 'Metallo-Marco2B-BaselineAprovada-20260927-R1.zip':'7df0935cd75e5b1e822b08fbaf40f53f2b1f4f8c98b5d2dcdb10610c4928b1d0'}
sha=lambda b:hashlib.sha256(b).hexdigest()
for name,digest in protected.items():assert sha((root/'outputs'/name).read_bytes())==digest,name
assert not (root/'04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/.temp/project-ref').exists()
results={}
for name,total in [('resultado-2d.json',49),('resultado-auth-real-2d.json',17),('base-real.json',683),('resultado-1c-regressao.json',45),('resultado-2b.json',64),('resultado-transporte-2b.json',13),('resultado-revogacao-concorrente-2b.json',5),('resultado-indisponibilidade-2b.json',1),('rede.json',8)]:
 r=json.loads((root/ev/name).read_text(encoding='utf-8-sig'));assert len(r['checks'])==total and all(x['ok'] for x in r['checks']) and not r.get('error'),name
 results[name]=f'{total}/{total}'
w=json.loads((root/ev/'web.json').read_text(encoding='utf-8-sig'));assert w['success'] and w['numPassedTests']==114 and w['numFailedTests']==0 and w['numPendingTests']==0
results.update(web='114/114',banco='31/31',qualidade='44/44',typescript='passou',lint='passou',build='passou')
for name,total in [('banco.log',31),('qualidade.log',44)]:
 log=(root/ev/name).read_text(encoding='utf-8-sig')
 assert re.search(rf'\bpass {total}\b',log) and re.search(r'\bfail 0\b',log) and re.search(r'\bskipped 0\b',log),name
assert 'tsc --noEmit' in (root/ev/'typecheck.log').read_text(encoding='utf-8-sig')
assert 'eslint . --max-warnings=0' in (root/ev/'lint.log').read_text(encoding='utf-8-sig')
assert 'prerendered as static content' in (root/ev/'build.log').read_text(encoding='utf-8-sig')
assert json.loads((root/ev/'resultado-segredos-2d.json').read_text())['passed']
storage=json.loads((root/ev/'resultado-2d.json').read_text())
auth=json.loads((root/ev/'resultado-auth-real-2d.json').read_text())
assert storage['passed'] and storage['expected']==49 and len(storage['crashes'])==6
assert {c['phase'] for c in storage['crashes']}=={'before_insert','after_insert','after_result','after_anchor_before_commit','after_database_commit','after_commit'}
rollback=storage['temporal_rollback']
assert rollback['expected_epoch']==5 and rollback['observed_epoch']==3 and len(rollback['missing_event_ids'])==2 and rollback['writes_blocked']
assert auth['passed'] and auth['revoked_auth_with_active_local_snapshot_denied']
state=json.loads((root/ev/'estado-final.json').read_text())
assert state['health']['status']=='READY' and state['health']['ready_for_new_events'] and state['visual_change']==False
assert state['audit']['cycles_completed']==2 and not state['audit']['critical_or_high_open_local']
assert state['preview_shutdown']['stopped_integrity']['passed'] and state['preview_shutdown']['stopped_integrity']['anchor']['comparison']=='MATCH'
assert state['web_unchanged_from_2b'] and not state['remote_touched']
assert state['declared_plans_match_executed_sha256']
for c,expected in [(1,'edc90b89e9aabad242197cbcb0a4ad156d1f5552239132406dcc36a4d9cde395'),(2,'731c1bed14d812b646427802b0b7ace6d786c44853188ad7a1183cdae1dedf63')]:
 review=root/f'outputs/Metallo-Marco2D-Recuperacao-Auditoria-20260927-Ciclo{c}.zip'
 receipt=json.loads(Path(str(review)+'.verificacao.json').read_text())
 assert sha(review.read_bytes())==expected and receipt['passed'] and not receipt['findings'] and receipt['zip']['sha256']==expected
backup_manifest=json.loads((root/ev/'backup-sintetico-2d/manifesto.json').read_text())
assert backup_manifest['state']['event_count']==3 and sha((root/ev/'backup-sintetico-2d/database.tar.gz').read_bytes())==backup_manifest['archive_sha256']
base=root/'outputs/Metallo-Marco2B-BaselineAprovada-20260927-R1.zip'
with zipfile.ZipFile(base) as z:
 manifest=json.loads(z.read('MANIFESTO_SHA256.json'))
 assert all(sha(z.read(f['path']))==f['sha256'] for f in manifest['files'])
 original={n:z.read(n) for n in z.namelist() if n not in ['MANIFESTO_SHA256.json','LEIA-ME.md']}
payload=dict(original)
for name in list(payload):
 p=root/name
 if p.is_file():payload[name]=p.read_bytes()
for folder in ['04_BANCO_E_SUPABASE/laboratorio-marco-2b',ev]:
 for p in (root/folder).rglob('*'):
  if p.is_file() and '__pycache__' not in p.parts:payload[p.relative_to(root).as_posix()]=p.read_bytes()
for name in ['05_DOCUMENTACAO/35_MARCO_2C_REVOGACAO_RECUPERACAO_RESILIENCIA.md','05_DOCUMENTACAO/36_MARCO_2D_RECUPERACAO_LOCAL_E_INTEGRIDADE.md']:
 payload[name]=(root/name).read_bytes()
if baseline:
 for c in (1,2):
  path=root/f'outputs/Metallo-Marco2D-Recuperacao-Auditoria-20260927-Ciclo{c}.zip.verificacao.json'
  payload[path.relative_to(root).as_posix()]=path.read_bytes()
 payload['LEIA-ME.md']='''# METALLO-2D-LAB-20260927-R1

MARCO 2D — RECUPERAÇÃO LOCAL E VERIFICAÇÃO DE INTEGRIDADE FUNCIONAL EM LABORATÓRIO SINTÉTICO.

**SIMULAÇÃO SEM VALOR OFICIAL.** Fotografia aprovada expressamente pelo responsável em 27/09/2026, derivada da baseline imutável METALLO-2B-LAB-20260927-R1.

O manifesto contém inventário, delta desde 2B, SHA-256 de cada arquivo, resultados, riscos, limites, referência aos dois ciclos Grok e à aprovação formal.
O ZIP seleciona fontes, documentação e evidências sintéticas. Não é checkout completo, banco ativo, distribuição instalável, produção, ponto oficial, REP-P ou autorização de publicação.
O SHA-256 do próprio ZIP e o scan final direto nele constam do recibo externo .zip.verificacao.json. A aprovação da fotografia exige que o recibo marque passed=true, findings=[] e o mesmo SHA-256 do ZIP.
Sem Supabase remoto, pessoas reais, publicação ou novo módulo. Próximo marco não iniciado.
'''.encode()
else:
 payload['LEIA-ME.md']=('''# Marco 2D — pacote de auditoria, ciclo %s

SIMULAÇÃO SEM VALOR OFICIAL. Não é baseline, distribuição instalável ou autorização de produção.
Leia 05_DOCUMENTACAO/36_MARCO_2D_RECUPERACAO_LOCAL_E_INTEGRIDADE.md, com escopo, decisões, limites e prompt de auditoria.
O manifesto relaciona inventário, delta e resultados. Relatórios 2D são vigentes; evidências 2B anteriores são históricas.
Inclui backup sintético de três eventos; não inclui banco Auth, banco principal ativo, credenciais ou dados reais.
O recibo externo .zip.verificacao.json é o scan final diretamente no ZIP, sem autorreferência.
Somente inspeção passiva: listar/extrair/ler/hash/buscar; proibido executar projeto, SQL, testes, Auth, containers, endpoints e rede.
'''%cycle).encode()
files=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(payload.items())]
delta=[{'path':n,'kind':'alterado' if n in original else 'novo','baseline_2b_sha256':sha(original[n]) if n in original else None,'current_sha256':sha(b)} for n,b in sorted(payload.items()) if n not in original or sha(original[n])!=sha(b)]
m={'id':'METALLO-2D-LAB-20260927-R1' if baseline else f'METALLO-2D-AUDITORIA-CICLO{cycle}',
   'is_approved_baseline':baseline,'formal_approval':'Responsável autorizou fechamento 2D e criação desta baseline em 27/09/2026' if baseline else None,
   'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
   'origin':{'id':'METALLO-2B-LAB-20260927-R1','sha256':protected[base.name]},
   'protected_archives':protected,'results':results,'overlapping_suites_do_not_sum':True,
   'ui_changed':False,'laboratory_only':True,'official_time_record':False,
   'mandatory_label':'SIMULAÇÃO SEM VALOR OFICIAL',
   'official_states':{
    'marco_0':'fechado tecnicamente',
    'marco_1a_t05_t15':'concluído e auditado em laboratório',
    'marco_1b':'funcional em laboratório',
    'marco_1c':'Minha Obra funcional em laboratório',
    'marco_2a':'planejamento concluído',
    'marco_2b':'Ponto Experimental Online e Sintético funcional em laboratório',
    'marco_2c':'planejamento de revogação/recuperação concluído',
    'marco_2d':'Recuperação Local e Verificação de Integridade funcional em laboratório'},
   'proofs':{'startup_health':'READY comprovado no estado-final.json; inconsistências bloqueiam',
             'crash_phases':[c['phase'] for c in storage['crashes']],
             'retry_after_commit':'mesmo evento, sem duplicação',
             'graceful_shutdown':state['preview_shutdown']['graceful_shutdown_log_observed'],
             'backup_consistent':'dumpDataDir sob fila exclusiva; SHA '+backup_manifest['archive_sha256'],
             'restore_disposable':'inventário exato; diretórios de ensaio removidos',
             'hash_version':1,'tamper_and_old_restore':'49/49; estado RECOVERY_REQUIRED quando aplicável',
             'temporal_rollback':rollback},
   'independent_audits':[
    {'cycle':c,'conversation':'https://grok.com/c/31a58ef4-f018-4d10-9ef0-8c8d31de6366',
     'report':f'{ev}/parecer-grok-ciclo{c}.md',
     'package_sha256':h,'scan_receipt':f'outputs/Metallo-Marco2D-Recuperacao-Auditoria-20260927-Ciclo{c}.zip.verificacao.json'}
    for c,h in [(1,'edc90b89e9aabad242197cbcb0a4ad156d1f5552239132406dcc36a4d9cde395'),
                (2,'731c1bed14d812b646427802b0b7ace6d786c44853188ad7a1183cdae1dedf63')]],
   'audit_confront':f'{ev}/parecer-grok-ciclo2.md e 05_DOCUMENTACAO/36_MARCO_2D_RECUPERACAO_LOCAL_E_INTEGRIDADE.md seção 9',
   'residual_risks':['administrador do host controla banco e âncora','queda real de energia/disco não comprovada',
    'múltiplos writers não comprovados','janela residual Auth → commit','token residual',
    'política de sessão/logout pendente','segundo computador físico não testado',
    'contexto mutável fora da âncora','hash não é assinatura digital'],
   'network_limits':['listeners 127.0.0.1','Ethernet negativo','rede Docker separada negativa com controle positivo','sem segundo PC físico'],
   'integrity_limits':['âncora técnica local, sem custódia externa','sem prova de energia/disco/fsync de diretório',
     'hash v1 preservado; created_at técnico sub-ms não coberto','administrador privilegiado pode mudar banco, âncora e código'],
   'prohibited':['Supabase remoto','produção','funcionários reais','publicação','ponto oficial','REP-P','GPS','foto','biometria',
     'offline oficial','AFD','AEJ','NSR oficial','cálculo de jornada','banco de horas','Marco 2E automático'],
   'files':files,'inventory_count':len(files),'delta_from_2b':delta,
   'zip_entries':len(files)+1,'secret_scan_final_receipt':target.name+'.verificacao.json'}
payload['MANIFESTO_SHA256.json']=(json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode()
with zipfile.ZipFile(target,'x',zipfile.ZIP_DEFLATED) as z:
 for n,b in sorted(payload.items()):z.writestr(n,b)
with zipfile.ZipFile(target) as z:
 assert len(z.namelist())==m['zip_entries']
 assert all(sha(z.read(f['path']))==f['sha256'] for f in files)
digest=sha(target.read_bytes());Path(str(target)+'.sha256').write_text(f'{digest}  {target.name}\n',encoding='utf-8')
if not baseline:
 (root/ev/f'pacote-ciclo{cycle}.json').write_text(json.dumps({'zip':target.relative_to(root).as_posix(),'sha256':digest,'entries':m['zip_entries'],'delta':delta,'results':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'id':m['id'],'zip':str(target),'sha256':digest,'entries':m['zip_entries'],'inventory_count':len(files),'delta':len(delta),'baseline_authorized':baseline,'final_secret_scan_pending':baseline}))
