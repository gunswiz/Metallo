import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const docs=resolve(import.meta.dirname,'../../../05_DOCUMENTACAO');
const load=n=>readFileSync(resolve(docs,n),'utf8').replaceAll('\r\n','\n');
const save=(n,s)=>writeFileSync(resolve(docs,n),s);
const link='[consolidação final e evidências](28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md)';
const status=`**Decisão vigente em 26/09/2026:** Marco 0 **fechado tecnicamente**. Marco 1A com **194/194 reais reexecutadas e isolamento A comprovado**, aguardando auditoria independente, **sem encerramento definitivo nem implantação remota**. Banco **22/22**, qualidade **35/35**, prévia 1B **9/9 com mocks**; Web completa **63/67**, quatro falhas preexistentes da Gestão documentadas. Laboratório desligado, sem listeners; 1B permanece **somente visual**. Consultar a ${link} e o [prompt somente leitura](29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md). As notas históricas abaixo não substituem esta decisão.\n\n`;
for(const n of ['17_MARCO_0_COLABORADOR_REP_P.md','18_PACOTE_REVISAO_MARCO_0.md','19_IDENTIDADE_COLABORADOR_MARCO_1A.md','22_AMBIENTE_REP_P_E_ROADMAP.md','23_FECHAMENTO_PENDENCIAS_MARCO_0.md','24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md','25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md']){
 let s=load(n);const first=s.indexOf('\n\n')+2;
 if(['19_','23_','24_','25_'].some(p=>n.startsWith(p)))s=s.slice(0,first)+status+s.slice(s.indexOf('\n\n',first)+2);
 else s=s.slice(0,first)+status+s.slice(first);
 if(n.startsWith('22_'))s=s.replace('Marco 1A — gate funcional aprovado; isolamento de rede pendente','Marco 1A — gate funcional e isolamento A aprovados; auditoria pendente').replace('194/194 reais; implantação remota exige marco e autorização próprios.','194/194 reais reexecutadas; aguardar auditoria independente e confrontar parecer antes de encerramento definitivo. Implantação remota exige marco e autorização próprios.').replace('Corrigir e comprovar isolamento de rede antes de conectar o app ao Auth local; depois avaliar prévia funcional.','Isolamento A comprovado. Aguardar parecer independente e seu confronto antes de integrar Auth ou avançar funcionalmente.');
 save(n,s);
}
let s=load('26_LABORATORIO_SUPABASE_MARCO_1A.md');
s=s.replace('Não foram criados interface do Colaborador, ponto ou projeto REP-P pago.','A prévia visual 1B foi criada em rodada posterior; continua sem Auth real do produto, ponto ou projeto REP-P pago.');
const start=s.indexOf('**Rede —');const end=s.indexOf('## Baseline e migration');
if(start<0||end<0)throw new Error('Secao rede nao encontrada');
s=s.slice(0,start)+`**Rede — situação A comprovada em 26/09/2026:** após autorização explícita para o alcance global da opção oficial **Docker Desktop → Port binding behavior → Localhost only**, foi aplicado \`PortBindingBehavior=local-only-port-binding\` no arquivo de configuração documentado do Desktop, com cópia anterior preservada e reinício. A CLI 2.117.0 permaneceu inalterada. As cinco portas 54321/54322/54323/54324/54327 passaram a escutar **somente 127.0.0.1 e ::1**, tanto nos bindings efetivos Docker quanto nos listeners Windows. Não houve alteração de firewall, Defender, rede física ou arquivos internos da CLI.

O [ensaio anterior](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/teste-rede-local-20260926.json) permitia acesso por 192.168.0.3 a partir de outro container, apesar da regra de firewall. O [ensaio corrigido](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-final/rede-depois.json) passou **8/8**: loopback IPv4/IPv6 acessível nas cinco portas, Auth health HTTP200, IP Ethernet inacessível pelo host e pela rede Docker separada; a sonda alcançou o servidor sintético de controle. Firewall permaneceu ativo. Não houve segunda máquina física da LAN; esse limite permanece explícito. A conclusão A decorre do bind real, não só da existência de firewall. A configuração afeta novos containers de outros projetos, alcance autorizado pelo responsável.

O iniciador agora bloqueia a partida antes de criar containers sem a restrição Localhost only, e para a pilha se os bindings/listeners não forem exclusivos de loopback. O firewall existente permanece defesa complementar. A prova foi repetida após servir as Edge Functions. Consulte a ${link} para reprodução, reversão, alcance e limites.

**Estado final:** pilha parada com volumes preservados; nenhum container do laboratório ou das sondas ativo e **zero listeners** nas portas 54320–54329 e 8083, conforme [estado-final.json](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-final/estado-final.json). A prévia visual separada continua em 127.0.0.1:3101.

` .replaceAll('\`','`')+s.slice(end);
const decision=s.indexOf('## Decisão');const sources=s.indexOf('Fontes:',decision);
s=s.slice(0,decision)+`## Decisão

**MARCO 1A — GATE FUNCIONAL APROVADO EM LABORATÓRIO; ISOLAMENTO A COMPROVADO; AGUARDANDO AUDITORIA INDEPENDENTE.** A reexecução após a correção da rede registrou **194/194** entre 18:11:17 e 18:11:37 UTC em 26/09/2026, incluindo Auth/JWT/PostgREST/RPC/Edge e revogação. Banco **22/22**, qualidade **35/35**, sem falhas/TODO/skipped. Os schemas expostos permanecem comprovados pelo material anterior. **Web completa 63/67**, com quatro falhas preexistentes analisadas individualmente na ${link}; não confundir regressão SQL/API da Gestão com aprovação da interface inteira. O gate 1B é **9/9 com serviços simulados**.

O bloqueio de rede que motivou a rejeição automática anterior foi tratado por configuração suportada, autorizada e testada. **Isso não encerra definitivamente o Marco 1A:** falta receber e confrontar o parecer independente. Não há implantação remota. A prévia 1B permanece exclusivamente visual até essa auditoria, sem avanço em ponto, EPI pessoal, documentos, contracheques, solicitações ou integração Auth real do produto.

`+s.slice(sources);
save('26_LABORATORIO_SUPABASE_MARCO_1A.md',s);
s=load('27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md');
s=s.replace('O fluxo Auth real está codificado e isolado para laboratório, mas **não pôde ser ensaiado nesta rodada**.','Há código de Auth local preparado anteriormente; não foi expandido nem validado como integração real do produto nesta rodada.');
s=s.replace('A suíte web inteira ficou em **63/67**, com quatro falhas em três arquivos de testes da Gestão já modificada neste checkout (`paridade-actions`, `obras-telas`, `typography-accessibility`).','A suíte Web inteira foi repetida e permaneceu em **63/67**. A [análise individual das quatro falhas](28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md#análise-individual-das-quatro-falhas-web) documenta tipografia já falhando no HEAD e três falhas provenientes de mudanças locais anteriores da Gestão. Nenhuma foi introduzida nesta rodada; nenhuma foi corrigida ou ocultada.');
s=s.slice(0,s.indexOf('## Bloqueio para a prévia funcional'))+`## Gate para qualquer avanço funcional

As **194/194** provas Auth/JWT/PostgREST/RPC/Edge do Marco 1A foram reexecutadas depois da correção de rede. Banco **22/22**, qualidade **35/35**. A opção oficial Localhost only resultou em bind exclusivo de loopback; a sonda independente em rede Docker separada deixou de alcançar o IP Ethernet nas cinco portas. O laboratório foi desligado, sem listeners. A ${link} registra antes/depois e limites.

**Marco 1A aguarda auditoria independente, sem encerramento definitivo.** A prévia 1B permanece **somente visual** até receber e confrontar o parecer. Não executar os scripts preparados de contas/prévia Auth nem desenvolver ponto, EPI pessoal, documentos, contracheques, solicitações ou integração Auth real do produto antes desse gate. Os nove testes de componentes usam mocks e não representam integração real de navegador/Auth. A base visual aguarda avaliação do responsável. Nada foi publicado ou aplicado no remoto.
`;
save('27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md',s);
console.log('Documentos 17–19 e 22–27 atualizados.');
