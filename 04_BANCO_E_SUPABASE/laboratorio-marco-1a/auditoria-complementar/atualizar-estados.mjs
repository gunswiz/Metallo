// HISTORICO da rodada 412. Regra de equipe inativa/DTO vazio:
// SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL.
// Preservado como fonte; impedir que substitua os documentos vigentes por estado antigo.
throw new Error('Gerador historico 412 desativado: atualizar documentos vigentes diretamente conforme relatorio 30.');
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../../..');
const dir=resolve(root,'05_DOCUMENTACAO');
const read=n=>readFileSync(resolve(dir,n),'utf8').replaceAll('\r\n','\n');
const write=(n,s)=>writeFileSync(resolve(dir,n),s);
const target='[confronto final e decisão vigente](30_CONFRONTO_AUDITORIA_FINAL_E_FECHAMENTO_1A.md)';
const lead=`**Decisão vigente em 26/09/2026: MARCO 1A — CONCLUÍDO EM LABORATÓRIO**, após confronto A-01–A-14, **412/412 verificações reais** e rede **8/8**. **NÃO IMPLANTADO NO SUPABASE REMOTO. NÃO LIBERADO PARA FUNCIONÁRIOS REAIS. NÃO É CONFORMIDADE REP-P. NÃO É AUTORIZAÇÃO DE PONTO OFICIAL.** Marco 0 **fechado tecnicamente**; 1B **somente visual**, sem executar seu script Auth. Banco22/22, qualidade35/35, prévia9/9; Web63/67, com backlog da Gestão. Pilha encerrada sem listeners. Consulte o ${target}; ele define escopo, limites e evidências.\n\n`;
for(const name of ['17_MARCO_0_COLABORADOR_REP_P.md','18_PACOTE_REVISAO_MARCO_0.md','19_IDENTIDADE_COLABORADOR_MARCO_1A.md','22_AMBIENTE_REP_P_E_ROADMAP.md','23_FECHAMENTO_PENDENCIAS_MARCO_0.md','24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md','25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md']){
  let s=read(name);const start=s.indexOf('\n\n')+2;const end=s.indexOf('\n\n',start)+2;
  s=s.slice(0,start)+lead+s.slice(end);
  if(name.startsWith('18_')||name.startsWith('23_'))s=s.slice(0,start+lead.length)+'## Registro histórico das rodadas anteriores — superado quanto aos estados de marco\n\nAs avaliações antigas abaixo foram preservadas. Não representam rede pendente nem reabertura dos marcos; a decisão vigente está no relatório30.\n\n'+s.slice(start+lead.length);
  if(name.startsWith('22_')){
    s=s.replace('o **Marco 1A passou 194/194 provas funcionais reais no laboratório, obteve isolamento A de loopback e aguarda auditoria independente para encerramento definitivo**','o **Marco 1A foi concluído estritamente em laboratório após confronto do parecer e 412/412 provas reais, com isolamento A**');
    s=s.replace('Marco 1A — gate funcional e isolamento A aprovados; auditoria pendente','Marco 1A — concluído em laboratório');
    s=s.replace('194/194 reais reexecutadas; aguardar auditoria independente e confrontar parecer antes de encerramento definitivo. Implantação remota exige marco e autorização próprios.','412/412 reais após confronto A-01–A-14; sem implantação remota, funcionários reais, conformidade REP-P ou autorização de ponto. Implantação exige marco próprio.');
    s=s.replace('Isolamento A comprovado. Aguardar parecer independente e seu confronto antes de integrar Auth ou avançar funcionalmente.','Isolamento A comprovado e parecer confrontado. Apresentar resultado final ao responsável antes de continuar; manter script Auth desligado e não expandir módulos nesta rodada.');
  }
  if(name.startsWith('24_')){
    const marker='## Decisão de marco e bloqueios';const pos=s.indexOf(marker);
    if(pos<0)throw new Error('Decisao antiga 24 ausente');
    const old=s.slice(pos+marker.length).trim();
    s=s.slice(0,pos)+`## Decisão histórica anterior à correção de rede\n\n**SUPERADO pelas evidências do relatório 28 e pelo isolamento A comprovado posteriormente.** O texto a seguir foi preservado como registro da restrição anterior; não é decisão vigente. O parecer final e a decisão atual estão no relatório30.\n\n> ${old.replaceAll('\n','\n> ')}\n`;
  }
  if(name.startsWith('19_'))s+=`\n## Regras após o confronto final\n\nNenhuma API pessoal pode fazer SELECT * em epi_employees. DTO permitido: employee_id, full_name, profession, team_name; a regressão real exige exatamente essa lista e exclui ASO/CPF e campos sensíveis. Antes de Meus EPIs, avaliar e preferencialmente separar SST/saúde.\n\nEquipe inativa faz o DTO desaparecer mesmo com funcionário/vínculo ativos, comportamento agora ensaiado e não alterado. A regra de produto continua pendente de decisão do responsável. Revogação exige fluxo servidor SQL+ban Auth; 502 significa pendência e retry, nunca sucesso completo. Refresh intermediário pode funcionar, mas o banco já nega os dados. Ver ${target}.\n`;
  if(name.startsWith('25_'))s+=`\n## Cobertura medida após A-02 A-04 e A-11\n\nGate real412/412. Escritas REST:30 tabelas,2 atores,3 verbos=180 requisições, mais2 PATCH de profiles.active;124 HTTP403/42501 e58 HTTP200/[];33 fingerprints SHA-256 com contagens inalterados. GraphQL:rota responde, mas pg_graphql desabilitada e nenhum objeto exposto; não equivale a validar RLS de GraphQL ativo. Storage:zero buckets.\n\n43 assinaturas RPC:6 executadas,33 negadas por guarda SQL identificada,2 negadas por privilégio SQL sem afirmar corpo executado,1 somente roteamento PostgREST (300/PGRST203) e1 função trigger não chamável (404/PGRST202). O argumento inexistente em my_employee_profile também é roteamento404/PGRST202; defesa SQL deriva auth.uid() sem receber employee_id.\n\nO dashboard real retornou suas12 coleções vazias, inclusive works/teams/employees/alerts. O endpoint lab-revoke-auth-failure é exclusivo de ensaio, exige admin e nunca deve ser implantado. Inventário detalhado: auditoria-complementar/inventario-rpc-executado.json. Ver ${target}.\n`;
  write(name,s);
}
let s=read('26_LABORATORIO_SUPABASE_MARCO_1A.md');
s=s.replace('**194 verificações aprovadas, zero falhas**','**412 verificações aprovadas, zero falhas, após confronto do parecer final**');
s=s.replace('A falha simulada da etapa Auth após revogação SQL não foi ensaiada, mas a repetição foi comprovada.','Na prova anterior de194, a falha Auth não havia sido injetada. Essa lacuna foi superada pelo P3:502 após SQL, DTO vazio, refresh intermediário200 sem dados, retry200 e refresh/login400, sem duplicar auditoria.');
s=s.replace('## Provas reais','## Provas reais da rodada anterior e complementação');
s=s.replace('O [resultado final](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/resultado-provas-reais.json) tem **194/194** verificações aprovadas','O resultado anterior preservado em auditoria-complementar/gate194-anterior.json tem **194/194** verificações aprovadas');
const start=s.indexOf('## Decisão');const end=s.indexOf('Fontes:',start);
s=s.slice(0,start)+`## Complementação após o parecer final\n\nO ${target} registra o confronto A-01–A-14 e a reexecução ampliada:412/412. P1:186 checks, incluindo182 requisições REST; P2:3, com pg_graphql desabilitada e objeto indisponível; P3:12 com falha de transporte e retry; P4:4 checks adicionais de arrays vazios; P5:5 de exclusão fechada; A-09:4; A-13:2. As contagens são subconjuntos do gate, não totais independentes. As412 também incluem194 anteriores reforçadas e2 preparações Auth para P5.\n\nBanco22/22, qualidade35/35, prévia visual9/9, Web63/67. A rede foi repetida após os ensaios e passou8/8; pilha encerrada, zero listeners. Resultados atuais em auditoria-complementar/rede-final.json e estado-final.json. O endpoint adicional de falha é exclusivamente de ensaio local. Nenhuma migration SQL ou Edge da Gestão precisou mudar nesta rodada.\n\n## Decisão\n\n${lead}`+s.slice(end);
write('26_LABORATORIO_SUPABASE_MARCO_1A.md',s);
s=read('27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md');
s=s.replace('As **194/194** provas Auth/JWT/PostgREST/RPC/Edge do Marco 1A foram reexecutadas depois da correção de rede.','O gate Auth/JWT/PostgREST/RPC/Edge do Marco 1A foi ampliado e reexecutado após o parecer: **412/412**.');
s=s.replace(/\*\*Marco 1A aguarda auditoria independente, sem encerramento definitivo\.\*\*[\s\S]*$/,`**Marco 1A concluído estritamente em laboratório**, conforme o ${target}. Não implantado no Supabase remoto, não liberado a funcionários reais, não é conformidade REP-P nem autorização de ponto.\n\nA prévia1B permanece **somente visual**. Apresentar o resultado desta rodada ao responsável antes de continuar. Não executar iniciar-previa-1b.ps1, não desenvolver ponto nem expandir EPI pessoal, documentos, contracheques, solicitações ou Auth real do produto nesta rodada. A decisão de perfil sem equipe ativa permanece pendente. Os nove testes usam mocks; nenhuma integração real de navegador/Auth foi ativada. Nada foi publicado ou aplicado remotamente.\n`);
write('27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md',s);
for(const n of ['28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md','29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md']){
  s=read(n);const pos=s.indexOf('\n\n')+2;
  s=s.slice(0,pos)+`**REGISTRO HISTÓRICO DO PACOTE ENVIADO, SUPERADO QUANTO AO ESTADO DOS MARCOS.** O parecer foi recebido, confrontado e complementado por412/412 provas reais. A decisão atual é o ${target}. O texto original abaixo descreve a rodada anterior; o ZIP enviado permanece preservado e não foi sobrescrito.\n\n`+s.slice(pos);
  write(n,s);
}
const old=JSON.parse(readFileSync(resolve(root,'04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-final/proveniencia-web.json'),'utf8'));
const evidence={at:new Date().toISOString(),files:old.files.map(f=>({path:f.path,previous_sha256:f.final_sha256,current_sha256:createHash('sha256').update(readFileSync(resolve(root,f.path))).digest('hex')}))};
evidence.unchanged=evidence.files.every(f=>f.previous_sha256===f.current_sha256);
writeFileSync(new URL('./gestao-fontes-inalteradas.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log('Estados atualizados; fontes Gestao inalteradas: '+evidence.unchanged);
