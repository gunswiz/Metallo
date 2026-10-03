// Empacotador vigente reutilizado: fotografia 1B. ZIPs históricos nunca são sobrescritos.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve(import.meta.dirname,'../../..');
const lab='04_BANCO_E_SUPABASE/laboratorio-marco-1a',ev=`${lab}/auditoria-1b`,old=`${lab}/auditoria-complementar`;
const python=resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const read=p=>readFileSync(resolve(root,p));
const json=p=>JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const ensure=(v,m)=>{if(!v)throw new Error(m);};
const walk=p=>readdirSync(resolve(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
const cycle=process.argv.includes('--ciclo2')?2:1;
const pendingDelta=process.argv.includes('--delta-pos-ciclo2');
const closing=process.argv.includes('--fechamento-1b');
ensure(!closing||(!pendingDelta&&!process.argv.includes('--ciclo2')),'Escolha apenas um tipo de fotografia');
const baselineId='METALLO-1B-LAB-20260927-R1';
const basename=closing?'Metallo-Marco1B-BaselineAprovada-20260927':pendingDelta?'Metallo-Marco1B-DeltaLogout-PendenteRevisao-20260927':`Metallo-Marco1B-AuthLocal-20260927-Ciclo${cycle}`;
const dest=resolve(root,closing?'outputs/baseline-1b-aprovada-20260927':pendingDelta?'outputs/auditoria-1b-delta-logout-20260927':`outputs/auditoria-1b-20260927-ciclo${cycle}`);
if(!process.argv.includes('--scan')) ensure(!existsSync(dest)&&!existsSync(resolve(root,'outputs',`${basename}.zip`)),'Ciclo já preservado. Não sobrescrever nem iniciar terceira rodada sem nova autorização. Use --scan para verificar o estado local.');
const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
const status=JSON.parse(execFileSync(process.execPath,[cli,'status','--workdir',resolve(root,lab),'-o','json'],{encoding:'utf8'}));
ensure(status.API_URL==='http://127.0.0.1:54321','Laboratório não autorizado');
const credentials=json('backups/credenciais-previa-colaborador.json');
const knownSecrets=[status.SERVICE_ROLE_KEY,status.JWT_SECRET,...Object.values(credentials).filter(v=>v&&typeof v==='object').map(v=>v.password)].filter(v=>typeof v==='string'&&v.length>15);
const findings=[],terms=[];
function scan(path,bytes,client=false){
 let text=bytes.toString('utf8');
 if(path.endsWith('.docx'))text=execFileSync(python,['-X','utf8','-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print('\\n'.join(z.read(n).decode('utf-8','replace') for n in z.namelist() if n.endswith('.xml')))",resolve(root,path)],{encoding:'utf8',maxBuffer:8e6});
 for(const value of knownSecrets)if(text.includes(value))findings.push({path,type:'valor secreto conhecido'});
 if(/sb_secret_[\w-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))findings.push({path,type:'chave secreta/privada'});
 for(const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)){
   let role;try{role=JSON.parse(Buffer.from(m[0].split('.')[1],'base64url').toString()).role;}catch{}
   if(!client||role!=='anon')findings.push({path,type:'JWT não permitido',role:role??'desconhecido'});
 }
 if(/service_role|sb_secret|private.?key|\.pfx|\.pem/i.test(text))terms.push({path,classification:'nome de API, referência documental ou padrão de varredura; nenhum valor secreto encontrado se gate passa'});
}
const webFiles=[
 ...walk('01_WEB/app/colaborador'),
 '01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts','01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts','01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts',
 '01_WEB/10_TESTES/colaborador-preview.test.tsx','01_WEB/10_TESTES/colaborador-seguranca.test.ts','01_WEB/10_TESTES/colaborador-auth-real.integration.tsx',
 '01_WEB/app/layout.tsx','01_WEB/proxy.ts','01_WEB/05_ACESSO_A_DADOS/Supabase/proxy.ts','01_WEB/09_CONFIGURACOES/ambienteSupabase.ts','01_WEB/next.config.ts','01_WEB/vitest.config.ts','01_WEB/package.json','01_WEB/AGENTS.md','01_WEB/10_TESTES/setup.ts'
];
const bundle=walk('01_WEB/.next-local-preview/dev/static').filter(p=>/\.(js|map|json)$/.test(p));
ensure(bundle.length>0,'Bundle cliente ausente');
for(const p of [...webFiles,...bundle])scan(p,read(p),bundle.includes(p));
const files=[...webFiles,'AGENTS.md','package.json','pnpm-lock.yaml',
 ...(closing?['01_WEB/02_COMPONENTES_VISUAIS/brand.tsx','01_WEB/02_COMPONENTES_VISUAIS/module-theme.tsx','01_WEB/07_ESTILOS/globals.css','01_WEB/public/metallo-logo.png','01_WEB/tsconfig.json','01_WEB/eslint.config.mjs','pnpm-workspace.yaml',
 ...['17_MARCO_0_COLABORADOR_REP_P.md','18_PACOTE_REVISAO_MARCO_0.md','19_IDENTIDADE_COLABORADOR_MARCO_1A.md','20_RECONCILIACAO_MIGRATIONS_E_TIPOS.md','21_AUDITORIA_SECURITY_DEFINER.md','22_AMBIENTE_REP_P_E_ROADMAP.md','23_FECHAMENTO_PENDENCIAS_MARCO_0.md','24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md'].map(p=>`05_DOCUMENTACAO/${p}`),
 ...json(`${old}/gestao-fontes-inalteradas.json`).files.map(f=>f.path)]:[]),
 ...['27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md','28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md','29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md','30_CONFRONTO_AUDITORIA_FINAL_E_FECHAMENTO_1A.md','31_BACKLOG_GESTAO_QUATRO_FALHAS_WEB.md','25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md','26_LABORATORIO_SUPABASE_MARCO_1A.md'].map(p=>`05_DOCUMENTACAO/${p}`),
 ...['20260925120000_employee_identity_foundation.sql','20260926213000_portal_profile_optional_team.sql','20260926224000_unassigned_employee_management_scope.sql','20260926233500_personal_epi_explicit_team_scope.sql'].map(n=>`04_BANCO_E_SUPABASE/supabase/migrations/${n}`),
 ...['executar-provas-reais.mjs','executar-provas-complementares.mjs','executar-provas-gestao.mjs','executar-provas-t15.mjs','executar-concorrencia-gestao.mjs','reproduzir-migrations-local.mjs','revogar-conta-portal-servidor.mjs','criar-contas-previa-1b.mjs','iniciar-laboratorio.ps1','iniciar-previa-1b.ps1','iniciar-previa-visual-1b.ps1','verificar-rede-local.mjs','resultado-provas-reais.json','catalogo-laboratorio-post1a.json','comparacao-laboratorio-post1a.json','supabase/config.toml'].map(n=>`${lab}/${n}`),
 ...walk(`${lab}/supabase/functions`).filter(p=>/\.(ts|json|md)$/.test(p)),
 ...['resultado-t15-after.json','resultado-t15-before.json','resultado-complementar.json','resultado-gestao-equipe-opcional.json','mapa-t15.json','policies-t15-efetivas.sql','my_employee_profile-efetivo.sql','replay-migrations.json','gestao-fontes-inalteradas.json','PARECER_AUDITORIA_T15_REVISAO_FINAL_20260927.docx','gerar-pacote-final.mjs'].map(n=>`${old}/${n}`),
 ...walk(ev).filter(p=>/\.(json|md|txt|tap|png|docx)$/.test(p)&&!p.endsWith('/secret-scan.json'))
];
ensure(!files.some(p=>/(^|\/)(\.env[^/]*|backups|node_modules|volumes)(\/|$)|\.(pfx|pem|key)$/i.test(p)),'Arquivo proibido no pacote');
for(const p of new Set(files))if(!p.endsWith('.png'))scan(p,read(p));
const scanResult={at:new Date().toISOString(),client_files:bundle.length,source_files:webFiles.length,package_files:new Set(files).size,findings,passed:findings.length===0,terms,notes:'Valores de credenciais conhecidos comparados somente em memória. JWT anon é público e permitido no bundle, mas nenhum JWT é permitido no ZIP. Termos service_role/admin dos SDKs e testes não são valores. XML dos DOCX inspecionado. Não é garantia universal contra segredo desconhecido/ofuscado.'};
writeFileSync(resolve(root,ev,'secret-scan.json'),JSON.stringify(scanResult,null,2)+'\n');
ensure(scanResult.passed,'Varredura encontrou possíveis segredos; não enviar');
if(process.argv.includes('--scan')){console.log(JSON.stringify({passed:true,client_files:bundle.length,package_files:files.length}));process.exit(0);}
const gate=json(`${lab}/resultado-provas-reais.json`),real=json(`${ev}/auth-real.json`),web=json(`${ev}/web-final.json`),network=json(`${ev}/rede-final.json`),a11y=json(`${ev}/acessibilidade.json`);
ensure(gate.checks.length===682&&gate.checks.every(c=>c.ok)&&!gate.error,'Regressão backend incompleta');
ensure(real.numTotalTests===18&&real.numPassedTests===18&&real.numFailedTests===0,'Gate1B real incompleto');
const unit=json(`${ev}/mocks.json`);
ensure(unit.numTotalTests===39&&unit.numPassedTests===39&&unit.numFailedTests===0,'Unitários1B incompletos');
const failureNames=r=>r.testResults.flatMap(s=>s.assertionResults.filter(a=>a.status==='failed').map(a=>a.fullName)).sort();
const oldWeb=json(`${old}/web-final.json`);
ensure(web.numFailedTests===4&&JSON.stringify(failureNames(web))===JSON.stringify(failureNames(oldWeb)),'Web tem regressão não classificada');
ensure(web.numTotalTests===97&&web.numPassedTests===93,'Contagem Web diferente da baseline aprovada');
ensure(network.passed&&network.checks.every(c=>c.ok),'Rede não comprovada');
ensure(network.checks.length===8&&network.ports.includes(3101),'Rede precisa de oito provas e porta da prévia');
ensure(a11y.checks.length&&a11y.checks.every(c=>c.ok),'Acessibilidade mínima incompleta');
for(const [name,total] of [['banco.tap',31],['qualidade.tap',44]])for(const [key,value] of [['tests',total],['pass',total],['fail',0]])ensure(new RegExp(`^.* ${key} ${value}\\r?$`,'m').test(read(`${ev}/${name}`).toString()),'Teste de '+name+' incompleto');
const references=['Metallo-T15-RevisaoFinal-20260926.zip','Metallo-EquipeOpcional-Pos1A-Auditoria-20260926.zip',...(pendingDelta||closing?['Metallo-Marco1B-AuthLocal-20260927-Ciclo1.zip','Metallo-Marco1B-AuthLocal-20260927-Ciclo2.zip']:[]),...(closing?['Metallo-Marco1B-DeltaLogout-PendenteRevisao-20260927.zip']:[])].map(name=>{const sha256=hash(read(`outputs/${name}`));ensure(read(`outputs/${name}.sha256`).toString().includes(sha256),'Histórico alterado');return{name,sha256};});
const oldManifest=json('outputs/auditoria-t15-20260926/MANIFESTO_SHA256.json');
const oldZipHashes=JSON.parse(execFileSync(python,['-X','utf8','-c',"import zipfile,sys,json,hashlib; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if '/migrations/' in n and n.endswith('.sql')}))",resolve(root,'outputs/Metallo-T15-RevisaoFinal-20260926.zip')],{encoding:'utf8'}));
const migrations=files.filter(p=>p.includes('/migrations/')).map(path=>{const before=oldManifest.files.find(f=>f.path===path);const sha256=hash(read(path));ensure(before?.sha256===sha256&&oldZipHashes[path]===sha256,'Migration auditada alterada');return{path,sha256,unchanged:true,historical_zip_sha256:oldZipHashes[path]};});
const gestao=json(`${old}/gestao-fontes-inalteradas.json`);ensure(gestao.files.every(f=>hash(read(f.path))===f.current_sha256),'Fonte Gestão mudou');
const auditHistory=[1,2].map(c=>{const m=json(`${ev}/parecer-grok-ciclo${c}-metadata.json`);ensure(hash(read(`${ev}/${m.response_file}`))===m.response_sha256,'Parecer original alterado');ensure(hash(read(m.package))===m.package_sha256,'Pacote da auditoria alterado');return{cycle:c,response_file:m.response_file,response_sha256:m.response_sha256,package:m.package,package_sha256:m.package_sha256,confronted_in:'05_DOCUMENTACAO/27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md'};});
let baseline;
if(closing){
 const docker=resolve(process.env.ProgramFiles,'Docker/Docker/resources/bin/docker.exe');
 const run=(...args)=>execFileSync(docker,args,{encoding:'utf8'}).trim();
 ensure(run('context','inspect','--format','{{.Endpoints.docker.Host}}').startsWith('npipe:////./pipe/'),'Docker deve ser local');
 const containers=run('ps','--filter','label=com.supabase.cli.project=laboratorio-marco-1a','--format','{{json .}}').split('\n').filter(Boolean).map(line=>{const c=JSON.parse(line);return{name:c.Names,state:c.State,status:c.Status,ports:c.Ports};});
 const required=['db','auth','rest','kong','edge_runtime','studio','storage','analytics'];
 ensure(required.every(n=>containers.some(c=>c.name===`supabase_${n}_laboratorio-marco-1a`&&c.state==='running')),'Serviço essencial do laboratório indisponível');
 const vectorState=JSON.parse(run('inspect','--format','{{json .State}}','supabase_vector_laboratorio-marco-1a'));
 const vectorLogs=spawnSync(docker,['logs','--tail','25','supabase_vector_laboratorio-marco-1a'],{encoding:'utf8'});
 const vectorNetworkError=((vectorLogs.stdout??'')+(vectorLogs.stderr??'')).includes('NetworkUnreachable');
 const auxiliaryWarnings=vectorState.Restarting||vectorState.Health?.Status==='unhealthy'?[{service:'supabase_vector_laboratorio-marco-1a',status:vectorState.Status,health:vectorState.Health?.Status,observed_error:vectorNetworkError?'docker_logs: Listing currently running containers failed; NetworkUnreachable':'Estado degradado; causa não confirmada',impact:'Coleta centralizada auxiliar de logs não comprovada; serviços essenciais e gate de rede verificados separadamente',treatment:'Ocorrência registrada, sem modificar rede, configuração gerada ou controles de segurança; saneamento operacional pendente'}]:[];
 const listeners=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command','@(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in @(3101,54321,54322,54323,54324,54327) } | Select-Object LocalAddress,LocalPort) | ConvertTo-Json -Compress'],{encoding:'utf8'}).replace(/^\uFEFF/,''));
 ensure([3101,54321,54322,54323,54324,54327].every(p=>listeners.some(l=>l.LocalPort===p))&&listeners.every(l=>['127.0.0.1','::1'].includes(l.LocalAddress)),'Listener ausente ou externo');
 const authEnv=JSON.parse(run('inspect','--format','{{json .Config.Env}}','supabase_auth_laboratorio-marco-1a'));
 const expiry=Number(authEnv.find(e=>e.startsWith('GOTRUE_JWT_EXP='))?.split('=')[1]);ensure(expiry===3600,'Validade JWT não restaurada');
 const state={at:new Date().toISOString(),external_listeners:0,reason:'Baseline aprovada mantida disponível exclusivamente em loopback para consulta local',jwt_expiry_seconds:expiry,containers,listeners,auxiliary_warnings:auxiliaryWarnings};
 writeFileSync(resolve(root,ev,'estado-final.json'),JSON.stringify(state,null,2)+'\n');
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
 const inventory=git('-c','core.quotepath=false','status','--porcelain=v1','-z','--untracked-files=normal').split('\0').filter(Boolean).map(line=>({status:line.slice(0,2),path:line.slice(3)}));
 baseline={id:baselineId,status:'MARCO 1B — FUNCIONAL EM LABORATÓRIO',reference_commit:git('rev-parse','HEAD'),branch:git('branch','--show-current'),scope:'Snapshot sanitizado do escopo1B e dependências/evidências selecionadas; não é backup integral nem commit do checkout',manual_approval:{date:'2026-09-27',source:'Solicitação explícita do responsável nesta conversa',statement:'Considero a interface aprovada para o estado atual do Marco 1B. Faça agora o FECHAMENTO FORMAL DO MARCO 1B EM LABORATÓRIO.',includes:'Interface atual com paleta/logo Metallo; correções de troca entre abas e logout demorado validadas localmente'},limits:['NÃO IMPLANTADO NO SUPABASE REMOTO','NÃO LIBERADO PARA FUNCIONÁRIOS REAIS','NÃO É PRODUÇÃO','NÃO É PONTO OFICIAL','NÃO É REP-P','NÃO AUTORIZA PUBLICAÇÃO'],pending:['Quatro falhas da Gestão G-WEB-01 a04','Guarda de logout posterior ao parecer2 sem nova revisão independente','Zoom real200% sem medição específica','Marcos futuros de implantação, recuperação integral, sessões produtivas e REP-P não executados'],checkout_inventory:inventory,inventory_note:'Inclui alterações anteriores e fora do1B; constar neste inventário não significa aprovação nem inclusão no ZIP. Arquivos incluídos constam individualmente no manifesto.',new_file_justifications:[{group:'Portal: configuração, camada de dados, hook, rotas e testes',reason:'Responsabilidades do1B descritas no relatório27; isolamento do cliente da Gestão e provas de sessão pessoal'},{group:'auditoria-1b',reason:'Evidências e originais das duas auditorias; relatório vigente continua no documento27'},{group:'outputs/baseline-1b-aprovada-20260927 e ZIP/SHA-256',reason:'Fotografia imutável identificável do estado aprovado; nenhum novo documento de status duplicado'}]};
 baseline.pending.push(...auxiliaryWarnings.map(w=>w.service+': '+w.observed_error));
}
const summary={at:new Date().toISOString(),scope:closing?'MARCO 1B — FUNCIONAL EM LABORATÓRIO; interface aprovada e fechamento expressamente autorizado pelo responsável; NÃO PUBLICAR':'1B funcional exclusivamente local; duas auditorias recebidas; última correção de logout e avaliação manual pendentes; NÃO PUBLICAR',cycle:closing?'formal_closure_approved':pendingDelta?'local_after_cycle2':cycle,automatic_audits_sent:2,last_local_delta_independently_reviewed:false,...(baseline?{baseline}:{}),audit_history:auditHistory,
 suites:{auth_real:{passed:18,total:18,environment:'DOM jsdom, navegação e eventos de storage simulados; SDK/Auth/JWT/PostgREST/RPC reais; um logout com atraso controlado de transporte'},browser:'navegador.json, com observação transitória preservada separadamente',mocks:{passed:17,total:17},guards:{passed:22,total:22},backend:{passed:682,total:682,t15_included:135},database:{passed:31,total:31},quality:{passed:44,total:44,includes_database:true},web:{passed:web.numPassedTests,total:web.numTotalTests,fail:4,failed:failureNames(web)},network:{passed:8,total:8,preview_port:3101}},
 migrations,remote_reads:false,remote_writes:false,published:false,real_employees:false,official_time_tracking:false,jwt_expiry_restored:3600,preview:'http://127.0.0.1:3101/colaborador/login',references};
writeFileSync(resolve(root,ev,'resumo-final.json'),JSON.stringify(summary,null,2)+'\n');
ensure(!existsSync(dest),'Não sobrescrever fotografia');mkdirSync(dest,{recursive:true});const entries=[];
const tracked=closing?new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0')):null;
const responsibility=path=>path.startsWith('05_DOCUMENTACAO/')?'Documentação vigente ou contexto histórico, sem duplicar relatório de status':path.startsWith(ev+'/')?'Evidência de laboratório ou parecer original, separada da interpretação no relatório27':path.includes('/10_TESTES/')?'Testes automatizados do portal ou controle das falhas da Gestão':path.includes('/supabase/functions/')?'Implementação Edge local da base auditada':path.includes('/migrations/')?'Fundação SQL já auditada, preservada byte a byte':path.startsWith(lab+'/')?'Executor, configuração ou catálogo do laboratório isolado':path.includes('/app/colaborador/')?'Rotas e apresentação do portal pessoal':path.endsWith('/use-colaborador-session.ts')?'Ciclo da sessão e concorrência entre abas':path.endsWith('/colaborador-local.ts')?'Contrato/DTO e cliente exclusivamente local do portal':path.endsWith('/colaborador-laboratorio.ts')?'Guarda de ambiente exclusivamente local':path.includes('/brand.')||path.endsWith('/metallo-logo.png')||path.includes('/globals.css')?'Marca e paleta existentes reutilizadas pela interface aprovada':path.startsWith('01_WEB/')?'Dependência de configuração ou contexto de código do portal; não implica aprovação de funcionalidades da Gestão':'Configuração/governança do projeto ou índice da fotografia aprovada';
const add=(path,bytes)=>{mkdirSync(dirname(resolve(dest,path)),{recursive:true});writeFileSync(resolve(dest,path),bytes);entries.push({path,bytes:bytes.length,sha256:hash(bytes),...(closing?{checkout_state:path==='LEIA-ME.md'?'generated_snapshot':tracked.has(path)?baseline.checkout_inventory.some(i=>i.path===path)?'tracked_modified':'tracked_clean':'untracked_existing',responsibility:responsibility(path)}:{})});};
for(const p of [...new Set([...files,`${ev}/secret-scan.json`,`${ev}/resumo-final.json`])].sort())add(p,read(p));
add('LEIA-ME.md',Buffer.from(`# Marco1B Auth LOCAL — ${closing?'BASELINE APROVADA '+baselineId:pendingDelta?'delta de logout PENDENTE de revisão independente':`ciclo ${cycle}`}\n\n${closing?'MARCO 1B — FUNCIONAL EM LABORATÓRIO. Aprovação manual e fechamento expressos pelo responsável em27/09/2026.\n\n'+baseline.limits.join('; ')+'.':'PACOTE LOCAL PREPARADO, NÃO ENVIADO A TERCEIRA AUDITORIA.'} Duas rodadas externas já realizadas; qualquer nova transmissão depende de nova autorização.\n\nComece pelo relatório27, resumo-final e manifesto. Nenhuma execução, chamada API, migration, container, credencial ou publicação é autorizada por este arquivo.\n\n18 cenários DOM+Auth reais separados dos ensaios Edge/IAB e dos39 unitários com mocks/guardas. Eventos storage do DOM são simulados; um logout tem atraso controlado antes do transporte real. Base682, banco31, qualidade44, Web${web.numPassedTests}/${web.numTotalTests} com quatro falhas conhecidas, rede8 incluindo3101. Não somar suítes sobrepostas. Intermediários e falhas antes das correções estão preservados.\n\nA base SQL auditada está intacta, comparada também aos bytes internos do ZIP T15 original por este empacotador. A última guarda em verify impede reentrada durante signOut; foi corrigida depois do parecer2 e ainda não revisada independentemente. O fechamento local por decisão do responsável não altera esse fato. Não é produção. Credenciais/ambientes/builds/volumes/dados não acompanham o pacote.\n\n${closing?'Snapshot do escopo1B, não backup integral. Referência Git '+baseline.reference_commit+'. O manifesto registra mudanças anteriores fora do escopo; sua presença no inventário não é aprovação dessas mudanças. Não houve commit ou início do próximo marco.':''}\n`));
if(!closing)add('PROMPT_REVISAO_SOMENTE_LEITURA.md',read('05_DOCUMENTACAO/29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md'));
writeFileSync(resolve(dest,'MANIFESTO_SHA256.json'),JSON.stringify({created_at:summary.at,...(baseline?{baseline}:{}),files:entries,references,migrations,audit_history:auditHistory,secret_scan:scanResult.passed},null,2)+'\n');
const zip=resolve(root,'outputs',`${basename}.zip`);ensure(!existsSync(zip),'ZIP já existe');
execFileSync(python,['-X','utf8','-c',"import pathlib,zipfile,sys,json,hashlib; d=pathlib.Path(sys.argv[1]); z=pathlib.Path(sys.argv[2]); a=zipfile.ZipFile(z,'x',compression=zipfile.ZIP_DEFLATED); [a.write(p,p.relative_to(d).as_posix()) for p in d.rglob('*') if p.is_file()]; a.close(); a=zipfile.ZipFile(z); m=json.loads(a.read('MANIFESTO_SHA256.json')); assert all(hashlib.sha256(a.read(e['path'])).hexdigest()==e['sha256'] for e in m['files']); assert len(a.namelist())==len(m['files'])+1",dest,zip],{stdio:'pipe'});
writeFileSync(`${zip}.sha256`,`${hash(readFileSync(zip))}  ${basename}.zip\n`);
console.log(JSON.stringify({zip,sha256:hash(readFileSync(zip)),files:entries.length+1,secret_scan_passed:true}));
