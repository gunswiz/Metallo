# Marco 10A — Frota de caminhões munck (ambiente de teste)

Pedido do engenheiro: controlar os 5 caminhões munck. Só ambiente de teste (Supabase de teste, dados fictícios). Nada em produção.

## O que existe
- **App do funcionário → Caminhões**: lista dos 5 caminhões com situação; checklist do dia (26 itens da planilha METALLO-ENG-01, botões C / N / NA, descrição obrigatória no N, ciência); registrar saída (destino, com quem, km, observação); registrar chegada (km, problema, observação); últimas saídas da pessoa.
- **Gestão → Frota → Caminhões**: painel (disponível, na rua, não liberado, na oficina, sem checklist hoje), pontos de atenção, ficha de cada caminhão (manutenção, documentos e vencimentos, planos preventivos, saídas e chegadas, checklists com detalhe, grade do mês como a planilha, histórico, dados do caminhão).
- **Gestão → Frota → Itens do checklist**: editar nome, ativar/desativar e marcar o que é crítico.

## Regras
- Sem GPS e sem localização (o rastreamento continua no sistema do caminhão).
- Saída exige checklist do dia liberado (ou liberado/ressalvas) ou liberação do engenheiro no dia; um caminhão por pessoa e uma pessoa por caminhão; km nunca menor que o atual.
- Item crítico "N" → caminhão **não liberado**, abre manutenção corretiva sozinha. Item comum "N" → "liberado com ressalvas" e manutenção aberta sem bloquear. Problema informado na chegada também bloqueia.
- Os itens críticos iniciais são **sugestão** (freios, pneus, comandos, mangueiras, moitão e trava, alavancas, cintos, habilitação). O engenheiro ajusta na tela de itens.
- Liberar caminhão e cadastrar/alterar caminhão, documentos e itens: administrador e engenheiro (conferido no banco). Manutenção e planos: quem opera equipamentos (inclui líder).
- Manutenção: aberta → na oficina (oficina e previsão) → concluída (custo e km) ou cancelada (motivo). Planos preventivos por km e/ou dias, com vencida / chegando / em dia.

## Banco
`04_BANCO_E_SUPABASE/teste-online/10a-frota.sql` (tabelas no schema `private`, fechadas; funções `*_10a`). Prova online: `provas-10a-online.mjs` (35 verificações).

## Limites conhecidos
- Foto do defeito: ver Marco 10B abaixo.
- Checklist e saída não funcionam sem internet (sem fila offline).
- Itens críticos são sugestão a confirmar com o engenheiro.
- Não testado em celular real; revisão de interface descrita abaixo.

## Interface simplificada — 23/10/2026

- Gestão web: o início mostra até três assuntos prioritários, com urgentes primeiro e botão para consultar todos. Histórico e indicadores secundários ficam recolhidos.
- Frota da Gestão: busca por nome, placa e motorista; filtros com contagem; situação e ação principal por caminhão. Cadastro recolhido. Alertas levam diretamente ao assunto da ficha.
- Ficha: Manutenção, Documentos, Preventivas, Viagens, Checklists, Histórico e Cadastro (conforme permissão). Salvar mantém a aba correspondente. Grade mensal recolhida, com rolagem horizontal no celular e coluna de itens fixa.
- Funcionário web: caminhão com a pessoa aparece primeiro; filtros Todos, Disponíveis e Com você. Checklist em etapas de até cinco itens, progresso, respostas por extenso, preservação de respostas/fotos ao voltar e validação antes de avançar. Saída, chegada e fotos mantêm as regras existentes. Histórico recolhido.
- Android nativo: início com três equipes, priorizando a própria e o almoxarifado; busca por equipe/obra, expansão de seis em seis e resumo recolhido. Cabeçalho reúne as opções secundárias em “Mais opções”. O módulo novo de frota permanece no portal web; não foi criado um segundo módulo nativo.

Validação local: suíte web completa com 549 testes passando em 71 arquivos (incluindo 17 testes novos das telas), TypeScript e ESLint dos arquivos alterados sem erros; sete testes Android passaram, incluindo busca, expansão e largura de 320 px com texto ampliado. Análise estática dos quatro arquivos Android alterados sem problemas. A suíte adicional `functional_regressions_test.dart` revelou uma expectativa antiga de consumo (`caixa/un` versus `caixas · unidades`) em arquivos não alterados nesta revisão.

A inspeção visual automatizada no navegador foi bloqueada pela política da ferramenta; não foi contornada. Não houve validação em aparelho físico nem nova distribuição do APK nesta etapa. Prévias locais: Gestão em `http://127.0.0.1:3102/frota` e Funcionário em `http://127.0.0.1:3101/colaborador/frota`.

## Marco 10B — foto do defeito (23/10)
- No app: em cada item do checklist com **N** e na **chegada com problema** aparece "Tirar foto do defeito". A foto é reduzida no celular (1600 px, JPEG) e enviada na hora; uma foto por item e uma por chegada.
- Na Gestão: a ficha do caminhão mostra "Ver foto" no detalhe do checklist (item certo) e na tabela de saídas/chegadas. O link abre a foto por 2 minutos.
- Segurança: balde privado `frota-10b`; arquivo só pela função `fotos-frota-10b` (tipo real JPEG/PNG pelos primeiros bytes, máx. 6 MB, 30 fotos por dia por pessoa); o banco confere quem pode enviar e quem pode abrir (Gestão ou a própria pessoa). Foto só vale para o caminhão, a pessoa e um único uso. Banco: `10b-frota-fotos.sql`. Prova online: `provas-10b-online.mjs` (18 verificações).
- Limites: foto da chegada só até 30 minutos depois de registrar a chegada; se o envio da foto falhar na chegada, a chegada fica registrada e o app avisa para falar com o engenheiro; fotos soltas (enviadas e não usadas) ficam guardadas.

## Marco 10C — defeito vira relato, alerta e aviso (23/10)

- O que o funcionário informa (item "N" com observação e foto no checklist, ou problema e foto na chegada) agora aparece **dentro do cartão da manutenção aberta**: quem, quando, o que foi e "Ver foto". Fica registrado no sistema mesmo sem enviar à oficina.
- A Gestão vê o alerta "Defeito em caminhão" no início (Precisa de você), no painel da Frota e na aba Manutenção do caminhão.
- O celular da Gestão recebe aviso (mesma inscrição dos outros avisos) pela função `fotos-frota-10b`, ação `avisar`: só dispara se a própria pessoa acabou de informar defeito (até 15 min) e sem repetir. Se o aviso falhar, o defeito continua salvo e aparece no painel.
- Banco: `10c-frota-defeitos.sql`. Provas online: `provas-10c-online.mjs` (13/13).

## Marco 10D — frota mais fluida (24/10)

- **Sem internet:** checklist, saída e chegada feitos sem sinal ficam guardados no celular (por funcionário) e sobem sozinhos quando a internet volta (ao voltar o sinal, a cada 30 s com a tela aberta, ou no botão "Enviar agora"). A mesma chave de segurança do envio normal impede duplicar. Fotos tiradas sem sinal ficam no armazenamento do navegador e sobem antes do registro. A lista de caminhões e os itens ficam guardados para abrir a tela sem sinal. Se o sistema recusar um registro guardado (ex.: caminhão já na rua), a pessoa vê o motivo na tela. Limite: 15 registros guardados. Chegada só depois que a saída guardada for enviada.
- **Checklist rápido:** botão "Tudo conforme nesta etapa" marca só os itens ainda sem resposta.
- **Km:** o app mostra quantos km foram rodados desde a última leitura e pede um segundo toque quando o salto passa de 400 km.
- **Avisos:** de segunda a sábado às 9h (Fortaleza), a Gestão (admin e engenheiro) recebe caminhão sem checklist hoje (em uso ou que rodou nos últimos 3 dias), documentos vencidos/vencendo em 30 dias e preventiva vencida (segunda = resumo completo; outros dias só o que é novo). O motorista que avisou o defeito recebe "Conserto concluído" pelo canal dos avisos do funcionário (tipo FROTA, a cada 5 min).
- **Relatório do mês:** Gestão › Frota › "Relatório do mês" baixa uma planilha (CSV para Excel): saídas, km rodados, checklists, itens com problema, defeitos, manutenções concluídas, dias parado e custo por caminhão, com total.
- **Limpeza de fotos — PRONTA E DESLIGADA.** Tabela `private.frota_retencao_10d` (ativo = falso). Dois prazos separados: `dias_fotos_soltas` (fotos tiradas e nunca ligadas a checklist/chegada) e `dias_fotos_defeito` (fotos de defeito, só depois do prazo e **nunca enquanto o caminhão tiver manutenção aberta**). Sem prazo preenchido, nada é apagado. A rotina `rotinas-frota-10d` (ação `limpeza`) NÃO está agendada. Para ligar, depois que o engenheiro definir os prazos: preencher a tabela, `ativo = true` e criar o agendamento. Só mexe nas fotos da frota; contracheque e atestado (outro módulo) não são tocados.
- Banco: `10d-frota-fluidez.sql`; função `rotinas-frota-10d`. Provas online: `provas-10d-online.mjs`.

## Evolução 2027 — primeira entrega local, 30/10/2026

### Para o responsável

O sistema já oferece a maior parte do fluxo básico de Frota. Esta entrega corrige problemas de apresentação e separação de rascunhos, mas **não habilita o piloto real**. O cadastro por categoria, a autorização específica de condutores e a preservação integral das versões de checklist ainda precisam ser implementados e validados. Nenhuma migração remota, publicação, push, merge, exclusão de registro ou ativação de ponto foi realizada.

Prévia: **http://127.0.0.1:3110/previa/reimagine?integrada=frota**. Use os botões Funcionário e Gestão. A prévia usa os componentes reais modificados com um adaptador em memória, três veículos fictícios e três perguntas ilustrativas; não simula aprovação do engenheiro, não envia fotos e não substitui integração PostgreSQL. As fichas operacionais ficam bloqueadas pelo processo isolado. Recarregar reinicia os veículos simulados. O processo local já existente foi reutilizado.

### Evidências e limites do diagnóstico

- Checkout: `laboratorio-colaborador`, HEAD `7c54e3bc576b31bac17b8e801dea429d07320728`, de 24/10/2026. Referências locais: 81 commits exclusivos do laboratório, zero exclusivos de `main`; 991 arquivos diferem. Isso não comprova atualização das referências remotas. Muitas alterações anteriores estavam presentes e foram preservadas; não houve commit que misturasse esses trabalhos.
- `.github/workflows/teste-online.yml` publica automaticamente após push de mudanças Web nesta branch. Não executar push antes da aprovação específica da publicação.
- Supabase consultado somente com SELECT: `metallo-teste`, ref `cvimwiqokkujfhwynhmt`, PostgreSQL 17.11, estado `ACTIVE_HEALTHY`. Não foi acessado o banco antigo.
- Inventário confirmado: IDs 1–5 = Munck 01–05, ativos; IDs 6–10 = cinco ensaios técnicos, quatro inativos e ID 8 ativo. Nenhuma Saveiro. A identificação por nome é evidência de ensaio, não um campo formal de finalidade. Nenhum cadastro foi alterado e nenhum dado real foi inferido.
- Doze tabelas `private.frota_*`: RLS habilitado, zero políticas próprias. Zero tabelas com privilégios de SELECT/INSERT/UPDATE/DELETE para `anon`. As duas RPCs examinadas (`create_saida_10a`, `create_checklist_10a`) têm SECURITY DEFINER, `search_path=''`, EXECUTE negado a `anon` e permitido a `authenticated`; verificam vínculo pessoal por helper. Essa amostra não certifica todas as RPCs/grants do sistema.
- A função remota de checklist inclui vínculo de foto do Marco 10B, além do contrato básico de 10A. A função remota de saída mantém as verificações de estado, km, vínculo e checklist do dia. Não foi realizada comparação integral de schema/migrations.
- Retenção automática: `ativo=false`, confirmado por leitura. Permaneceu desligada.
- Navegação autenticada observada no Edge: portal de demonstração (sessão já ativa) em `/colaborador/inicio` e `/colaborador/frota`; Gestão após login de demonstração em `/dashboard` e `/frota`. Não foram enviados checklists, viagens ou alterações remotas. Login com animação do galpão preservado.
- Gestão hospedada mostra versão `0.10.0`; telas correspondem aos recursos 10D, mas isso **não identifica o SHA implantado**. A consulta de workflows pelo commit no conector retornou lista vazia. SHA/versão do Worker, backup restaurável e configuração efetiva de secrets permanecem não comprovados. Não houve acesso a valores secretos.
- EPI: os marcos 3B/3C/3F documentam entregas pessoais, trocas e assinatura; os componentes e testes já existentes foram preservados. A auditoria funcional e jurídica completa de EPI pertence à próxima entrega e não é declarada concluída aqui. Não foi criada validade universal de EPI.

### Alterações implementadas

| Antes | Depois | Arquivo |
| --- | --- | --- |
| Rascunho único na aba, inclusive relatos e acompanhantes | Chave por identidade; troca de conta remonta a tela; sem identidade não persiste; rascunho legado sem dono não é restaurado nem migrado | `01_WEB/app/colaborador/[[...screen]]/frota.tsx` |
| Checklist apenas guardado podia oferecer saída | Somente checklist confirmado no DTO oferece o botão; fila explica que pendência não autoriza uso | mesmo arquivo |
| Cache offline dizia “seguir normalmente” | Alerta de informação possivelmente desatualizada e necessidade de confirmação | mesmo arquivo |
| Resultado conforme anunciava caminhão liberado mesmo com bloqueio anterior | Mensagem informa inspeção registrada e preservação dos bloqueios | `01_WEB/03_FUNCOES_E_LOGICA/Frota/fila-offline-10d.ts` |
| Cartões seguiam ordem recebida | Bloqueios/oficina, vencimentos, demais pendências e demais veículos; sem mutar o array original | `01_WEB/02_COMPONENTES_VISUAIS/Frota/painel-frota.tsx` |
| Texto azul muito claro em seleção de filtro/resposta no tema claro | Cor de texto do tema nos dois seletores | `01_WEB/app/colaborador/[[...screen]]/colaborador.module.css` |

Prévia reaproveita a rota isolada existente `app/previa/reimagine/page.tsx`, acrescentando o adaptador `app/previa/correcoes-metallo/frota-preview.tsx`. Alterações funcionais estão nos componentes utilizados pelo produto, não apenas na demonstração.

### Matriz do engenheiro e dos 26 itens

Fonte: [formulário diário MUNCK](https://forms.gle/w57sKrB3jBgzLL3bA), lido integralmente no navegador em 30/10/2026 (uma página, 21 perguntas de inspeção e quatro campos de identificação). Não foi enviado. Nomes, identificadores pessoais e placas presentes no formulário não foram transcritos para o repositório.

Risco abaixo significa **configuração atual provisória**, não classificação técnica aprovada. “Comum” não significa baixo risco. As ações são propostas para nova versão, sem modificar o histórico nem a configuração remota.

| Código / item atual | Equivalência no formulário | Duplicidade ou diferença / ação proposta | Risco atual |
| --- | --- | --- | --- |
| 1 Conservação e limpeza | Sem item direto | Manter avaliação específica, confirmar escopo | Comum |
| 2 Retrovisor interno e externo | Visibilidade apenas parcial | Manter retrovisores explícitos | Comum |
| 3 Para-brisa | Para-brisa sem rachaduras e boa visibilidade | Sobreposição com 11; explicitar integridade | Comum |
| 4 Assentos | Sem item direto | Manter, confirmar inspeção | Comum |
| 5 Alavancas de comando | Movimentos/comandos do Munck | Sobreposição com 25; diferenciar estado e funcionamento | Crítico |
| 6 Mangueiras hidráulicas | Estado do Munck e cilindros | Cobertura parcial; acrescentar cilindros/lubrificação | Crítico |
| 7 Moitão | Gancho | Não assumir equivalência técnica; separar componentes | Crítico |
| 8 Pneus | Calibragem | Preservar estado do pneu e explicitar calibragem | Crítico |
| 9 Bateria | Sem item direto | Manter se aplicável | Comum |
| 10 Extintor | Validade e carga | Explicitar ambos os critérios | Comum |
| 11 Visibilidade | Para-brisa e visibilidade | Sobreposição com 3; agrupar sem perder critério | Comum |
| 12 Fitas refletivas | Integridade das fitas | Equivalência direta; explicitar integridade | Comum |
| 13 Trava da tampa do capô | Travas da carroceria | Componentes diferentes; manter e adicionar carroceria | Comum |
| 14 Habilitação do operador | Identificação do condutor | Declaração não comprova CNH/capacitação; criar autorização verificável | Crítico |
| 15 EPIs | Sem item direto | Manter conferência; não confundir com entrega de EPI | Comum |
| 16 Alarme sonoro de ré | Funcionamento do alarme | Equivalência direta | Comum |
| 17 Buzina | Funcionamento da buzina | Equivalência direta | Comum |
| 18 Parte elétrica | LEDs e instrumentos do painel | Muito amplo; separar alertas e instrumentos | Comum |
| 19 Luzes de ré e freio | Lanternas | Sobreposição parcial; manter função específica | Comum |
| 20 Farolete e luz direcional | Lanternas | Sobreposição parcial; manter direção/sinalização | Comum |
| 21 Freios | Sem pergunta direta | Preservar; ausência no Forms não justifica remover | Crítico |
| 22 Luz baixa e alta | Lanternas apenas parcial | Preservar iluminação frontal | Comum |
| 23 Limpador de para-brisas | Visibilidade apenas parcial | Preservar teste de funcionamento | Comum |
| 24 Trava de segurança do moitão | Gancho apenas parcial | Não equiparar a pinos; manter trava explícita | Crítico |
| 25 Comandos | Comandos direito/esquerdo do Munck | Sobreposição com 5; especificar teste funcional | Crítico |
| 26 Cintos de segurança | Sem item direto | Preservar inspeção | Crítico |

Lacunas explícitas a acrescentar na versão Munck, com criticidade/aplicabilidade decididas pelo engenheiro: LEDs de alerta; instrumentos; travas da carroceria; porta-volumes; patolas sem vazamentos/oxidação/danos; movimento das patolas pelos dois lados; bases dos estabilizadores presentes; cilindros e lubrificação do Munck; pinos de travamento; gancho identificado separadamente; cintas; anilhas; tacógrafo (calibração, validade, discos). Não inferir que “mangueiras” cobre estabilizadores ou que “moitão” é sinônimo de gancho.

### Arquitetura incremental proposta, ainda não implantada

1. Acrescentar categoria configurável ao cadastro existente e finalidade explícita (ensaio ou referência operacional). Não deduzir categoria por nome/modelo em produção. Manter IDs, vínculos e inativação existentes. Planejar cinco referências Munck e duas Saveiro sem preencher placa, km, ano ou motorista reais não verificados.
2. Acrescentar modelos de checklist versionados por categoria: rascunho → aprovado → substituído, com autoria/data de aprovação. Versão aprovada não é editada; gera sucessora. Etapas de Cabine, Segurança, Rodagem, Carroceria, Hidráulica, Estabilizadores e Içamento, somente onde aplicáveis.
3. Cada inspeção aponta para versão e guarda snapshot de pergunta, criticidade, aplicabilidade e regra de evidência. Registros legados mantêm código/resposta/criticidade existentes e ficam identificados como legado sem snapshot textual; não reconstruir texto antigo como se fosse comprovado.
4. “Não se aplica” é permitido por regra do item/categoria aprovada, não por escolha irrestrita do motorista. Foto/descrição exigidas proporcionalmente ao risco, com validação também no servidor.
5. Autorizações de condução ligam funcionário, categoria, validade, evidência e aprovador; habilitação/capacitação são requisitos separados. RPC de saída verifica autorização vigente e inspeção válida para o uso. Requisitos legais e de capacitação devem ser conferidos em fontes oficiais antes da implementação; não foram certificados nesta entrega.
6. Bloqueio mecânico segue manutenção/inspeção/liberação autorizada, nunca apenas novo checklist. Mudanças SQL ficam em `04_BANCO_E_SUPABASE`, primeiro no laboratório, com testes negativos e concorrentes. Não alterar `can_operate(permission,NULL)` nem condicionar portal à equipe.
7. DTO do portal conserva minimização; DTO da Gestão recebe somente o que as permissões atuais permitem. Flags do piloto precisam negar rotas e operações no servidor, além do menu.

### Pendências de segurança e operação

| Prioridade | Evidência / situação | Próximo requisito |
| --- | --- | --- |
| Impede piloto | `create_saida_10a` não valida autorização específica de condução/CNH/categoria | Modelo e regra aprovada, SQL local e testes negativos |
| Impede piloto | Mesma lista de 26 perguntas para todos; NA aceito em todos; falta versão/texto congelado nas respostas | Checklist por categoria e snapshot versionado |
| Impede piloto | Portal online ainda destaca ponto e outros módulos fora do lançamento | Restrição efetiva de Frota/EPI no servidor e navegação |
| Corrigido localmente | Rascunho compartilhado e mensagens de falsa liberação | Avaliação manual desta prévia antes de publicar |
| Revisão adicional | Fotos IndexedDB não possuem dono explícito; upload pode descartar evidência faltante; fila classifica `TypeError` genericamente como conexão | Testes de celular compartilhado, persistência de upload, revogação e evidência obrigatória |
| Revisão adicional | Sincronização em andamento durante logout/troca de sessão e duas abas não foi demonstrada | Cancelamento por sessão e ensaios concorrentes |
| Revisão adicional | Checklist offline recebe dia do servidor na sincronização; não há versão histórica no payload | Preservar instante da inspeção sem autorizar uso retroativamente |
| Não comprovado | SHA implantado, revisão integral de RLS/RPCs/Storage/EPI, backup/restore e dependências | Concluir auditoria antes de homologar |

O código e a função remota examinados preservam `nao_liberado` quando um checklist posterior é conforme: não foi encontrado nesse caminho um desbloqueio mecânico automático. A correção desta entrega é a mensagem enganosa. Isso não substitui ensaio de todos os caminhos de manutenção/liberação.

### Roteiro de avaliação e piloto futuro

Agora, apenas na prévia local: (1) conferir Gestão e prioridade do bloqueado; (2) preencher problema no checklist, alternar conta A/B/A e verificar isolamento/retomada; (3) simular conexão perdida e conferir aviso de pendência sem liberação; (4) restaurar conexão e enviar; (5) refazer checklist do veículo bloqueado e verificar que continua sem saída; (6) avaliar teclado, celular e ampliação de texto.

Depois da implementação das pendências e autorização: ensaio sintético de um Munck e uma Saveiro, com condutor autorizado e não autorizado; checklist por categoria; NA indevido; defeito crítico; tentativa de refazer para desbloquear; reparo/liberação; km regressivo; reenvio; perda de rede; troca de conta; duas saídas concorrentes; confirmação/solicitação de troca de EPI; histórico/PDF e evidências. Só depois planejar piloto com pessoas reais e expansão aos sete veículos.

Decisões humanas necessárias: matriz/criticidade/aplicabilidade e requisitos do condutor pelo engenheiro; dados verificados e finalidade dos cadastros pela empresa; tratamento do ensaio ainda ativo (sem exclusão); escopo final do piloto; aprovação visual. Aprovar esta prévia aciona a auditoria independente Grok prevista em AGENTS.md, com pacote sem segredos/dados reais. Publicação e migração remota continuam exigindo autorização específica; nenhuma baseline foi congelada.

### Validação desta entrega

- Primeira execução encontrou erro de temporários do sandbox, antes de executar três suítes. Reexecução autorizada fora dele: 41 testes passaram; após ajustes de mensagem e isolamento da prévia: 56 testes em cinco arquivos passaram. Resultados finais adicionais serão registrados abaixo.
- TypeScript `tsc --noEmit`: passou. ESLint dos arquivos TypeScript alterados: passou após correção de dependência de hook e acesso a ref no adaptador.
- Prévia aberta no Edge e cartões das duas áreas inspecionados. Não declarar validação em Android físico, acessibilidade completa ou homologação operacional.
- Resultado final: **58 testes passaram em cinco arquivos**, incluindo casos de rascunho legado sem dono, troca de identidade, checklist pendente e persistência de bloqueio. Nenhum teste foi removido ou desabilitado. Teste existente de mensagem foi atualizado para exigir a comunicação corrigida.
- Conferência no navegador: preenchido relato fictício na conta A; conta B mostrou a lista sem restaurá-lo; retorno à conta A restaurou o relato. Capturas locais em `outputs/metallo-2027-previa/funcionario.png` e `gestao.png`. São evidências da prévia, não comparação visual com dados idênticos do ambiente hospedado.
- `git diff --check` global apontou espaços finais em alterações preexistentes de outras áreas; não foram corrigidos indiscriminadamente. Checagem restrita aos arquivos novos desta entrega sem essas alterações anteriores passou.

### Evolução operacional de interface — 30/10/2026

O painel da Gestão agora combina lista priorizada, resumo selecionável e atalhos para manutenção, documentos, preventivas, inspeções e histórico. A busca preserva a seleção somente enquanto o veículo estiver visível. No portal, a jornada apresenta escolha, inspeção e saída sem mudar as verificações do servidor. As limitações de autorização de condutores, categorias e checklist versionado registradas acima continuam abertas; esta entrega não conclui o piloto 2027.

Referências funcionais consultadas: Gefrota (`https://www.gefrota.com.br/gestao-de-obras-e-equipamentos`) e WS PRÓ (`https://www.wsprosistema.com.br/`). São fornecedores, não repositórios de código. Custos por obra, horímetro, utilização e ordens de serviço são direção de evolução; não foram implementados nesta rodada. A documentação de inspeções do Fleetbase foi consultada como referência de formulários. Nenhum código desses produtos foi copiado.

Validação: suíte Web completa com 610 testes em 77 arquivos passou em 30/10/2026; os 23 testes focados de Frota/EPI também passaram. Prévia de Frota disponível em `http://127.0.0.1:3110/previa/reimagine?integrada=frota`. Não confundir dados sintéticos da prévia com registros operacionais. Publicação em produção e migrations remotas não foram executadas.

### Continuação aprovada e auditor escolhido — 01/11/2026

O responsável aprovou a interface publicada e pediu continuidade. Substituiu expressamente Grok por Claude como auditor independente; `AGENTS.md` atualizado apenas nesse nome. O responsável enviou o pacote seletivo `outputs/Metallo-FrotaEPI-Auditoria-Claude-20261101.txt` ao Claude e trouxe o parecer em 01/11/2026. O pacote original fica preservado como evidência; o ZIP de segunda rodada separa os bytes do commit, os arquivos locais e os diffs.

A primeira correção local retinha o relato inteiro por falta de foto. O achado alto 1 do Claude foi confirmado: isso era inadequado para relatos de defeito. A revisão abaixo substitui essa implementação; os 28 testes anteriores não demonstravam o fluxo completo de recuperação.

### Confronto do parecer Claude e correções locais — 01/11/2026

| Achado | Resultado confrontado com o projeto |
| --- | --- |
| 1 — Foto impede relato | Corrigido localmente: botão explícito envia sem as fotos locais pendentes, mantém respostas/defeito e registra a decisão na observação. Bloqueia somente a sequência do veículo afetado; outros veículos continuam. Falha de foto fica em revisão, sem repetição automática a cada 30 s. Se a observação já ocupar o limite do contrato, a decisão não é salva nem o texto truncado; a interface orienta procurar o responsável. |
| 2 — Erro desconhecido apaga conteúdo | Corrigido localmente: apenas códigos de regra conhecidos geram recusa; demais erros preservam o payload e aguardam reenvio manual. Recusa retém o registro integral até ciência do usuário, sem limite arbitrário de dez; falha ao gravar recusa preserva a fila. A regex de rede não considera `statement timeout`, `transaction aborted` nem TypeError genérico como rede. |
| 3 — Repetição de upload | Corrigido localmente: grava o vínculo local/remoto após cada foto, antes da próxima. Teste A enviada/B ausente confirma que A não sobe novamente. Falta de espaço ao persistir ou perda de resposta de upload ainda pode deixar arquivo remoto órfão; não há garantia transacional entre Storage e localStorage. |
| 4 — Fotos órfãs | Parcial: IDs locais originais acompanham a fila e são limpos após confirmação do relato. Rascunhos abandonados, substituição de foto, descarte de recusa e isolamento do IndexedDB por identidade ainda exigem ciclo próprio de retenção/limpeza. |
| 5 — Saída com inspeção pendente | Corrigido localmente: fila prevalece sobre checklist anterior liberado; botão oculto e nova checagem na submissão, inclusive formulário já aberto. Testes com checklist anterior `liberado` e verificação visual na prévia. |
| 6 — Cache antigo | Corrigido localmente: cache inválido, futuro ou com mais de 24 h é rejeitado; mudança do dia em Fortaleza remove `checklist_hoje`; consulta offline não oferece saída. |
| 7 — Trava de ambiente | Corrigido no fluxo de EPI: ações mantêm a allowlist exata local/teste e retornam mensagem própria. Testes negativos com endereços externos e imitações de host não chamam RPC. Código da trava incluído no novo pacote. |
| 8 — Entrega física sem teste | Cobertura acrescentada: autorização, confirmação obrigatória, parâmetros/chave, falha sem revalidação e sucesso com revalidação. `OperationForm` real já possui testes próprios de pendência/preservação; arquivo incluído na segunda rodada. Não equivale a ensaio de estoque no banco. |
| 9 — Tamanho / sugestão vazia | Corrigido: lotes com variante exigem escolha manual, pois sugestão não fornece tamanho; zero linhas mostra orientação e não sucesso. |
| 10 — Formato RPC | Corrigido no fluxo 3D: validação Zod de kits/linhas, trocas aprovadas, feedback e sugestão antes da apresentação. Tipos gerados para RPCs locais continuam pendentes; `as never` da chamada não foi eliminado. |
| 11 — UUID fora de try | Corrigido no envio Frota e testado: falha ao criar chave libera os controles. |
| 12 — Idempotência após novo render | Confirmado e mantido aberto para preparação/tratamento. Inspeção do SQL local `register_epi_delivery_3d` mostra bloqueio transacional por preparação e recusa de segunda entrega da mesma preparação mesmo com outra chave; não foi executado SQL nem certificado o estado remoto. Não alegar duplicação de estoque demonstrada. |

Não foram corrigidos nesta rodada autorização por categoria, checklist versionado, propriedade de fotos, concorrência entre abas/logout, todos os itens menores, nem referência jurídica NR-6. O piloto permanece condicionado às pendências já registradas acima.

Integridade: comparação das 17 seções do texto original com os arquivos Git, normalizando somente CRLF/LF e separadores finais, não encontrou diferenças de conteúdo. Isso não torna os hashes do anexo original válidos: o manifesto se referia aos bytes Git e o texto havia sido serializado. A revisão usa ZIP com manifesto SHA-256 dos bytes efetivamente incluídos, diffs `7c54e3b..3a28c40` e `3a28c40..local`, dependências antes omitidas e o parecer original sem dados reais.

Validação desta revisão: 76 testes focados passaram em seis arquivos; TypeScript e ESLint dos 12 arquivos alterados passaram. Primeira bateria completa: 639 passaram/2 falharam por carregamento/tempo, em 77 arquivos. Os 14 testes dos dois arquivos passaram isolados, sem alterar os testes; repetição completa com dois workers: **641 testes passaram em 77 arquivos**, sem alterar testes ou seus limites. Prévia existente em `http://127.0.0.1:3110/previa/reimagine?integrada=frota`, com inspeção anterior liberada seguida de relato crítico offline: rótulo pendente e ausência de saída confirmados no navegador. Evidência `outputs/metallo-2027-previa/frota-auditoria-pendente.png`. Nenhuma publicação, mudança de banco remoto ou baseline congelada nesta revisão.

### Parecer R2 recebido e continuação local R3 — 01/11/2026

O responsável aprovou a prévia R2, enviou o ZIP ao Claude e trouxe o segundo parecer. Claude confirmou o manifesto dos arquivos e a identidade dos 17 arquivos Git, encerrando a divergência de serialização. A indisponibilidade temporária do auditor foi informada pelo responsável; não representa aprovação da R3. O ZIP R2 permanece intacto.

| Achado R2 | Tratamento local R3 e limites |
| --- | --- |
| N1 — Relato recusado apagado por ciência | Mitigado: recusas contendo resposta N ou problema na chegada não são removidas por ciência. A interface mostra observações e problemas por código do item, orienta avisar o responsável e bloqueia saída na mesma identidade, inclusive reenvio pela fila. Não cria bloqueio global no servidor nem comprova que a Gestão recebeu o relato. Ainda falta fluxo seguro de recebimento/resolução; os relatos ficam retidos até essa evolução, sem botão de descarte. |
| N2 — Erro RPC como objeto | Corrigido nos consumidores: extração central da mensagem aceita Error e objeto com message string, sem depender de instanceof. Rede, mensagem ao usuário e classificação de regra usam a mesma extração. Testes incluem objetos com code/message/details/hint e falha de fetch sem navigator offline. Nenhuma versão do pacote foi alterada. |
| N3 — Cópia antiga vence formulário | Corrigido: envio originado no formulário atualiza o payload guardado e reaproveita o mapa local/remoto das fotos. Checkpoint direto já nasce em revisão, impedindo envio automático enquanto o formulário está aberto ou após Voltar; falha marca foto pendente imediatamente. Teste comprova km corrigido e ausência de novo upload. Chave permanece a mesma, de modo que resultado remoto incerto ainda depende da idempotência do servidor e pode exigir conferência se o conteúdo mudar. |
| N4 — Retentativa de desconhecidos | Aberto: continua exigindo decisão manual. Não foi criada retentativa automática de 401 ou operação cujo resultado é desconhecido. |
| N5 — Observação cheia / decisão sem campo estruturado | Aberto: não truncar relato nem fingir persistência de metadado inexistente. Exige evolução de contrato no laboratório e auditoria antes de qualquer implantação remota. |
| N6 — Saída enfileirada após perda de sinal | Esclarecido: a consulta em cache não oferece saída, mas uma tela carregada online ainda pode guardar uma saída se a rede cair. Isso não confirma nem autoriza viagem. A regra anterior e seu teste foram preservados. |
| N7 — Sincronização concorrente na mesma página | Corrigido o aviso: fila retorna emAndamento e a tela informa que o envio já começou, sem declarar falha. Teste comprova chamada única. Não é trava entre abas. |

R3 também amplia a persistência da tentativa de EPI, descrita no documento 42. Não resolve ciclo de vida completo das fotos, identidade do IndexedDB, checklist versionado, autorização de condutor ou os demais riscos de piloto. Validação final R3: **651 testes em 77 arquivos passaram** com dois workers, em 128,89 s; TypeScript e ESLint dos arquivos desta rodada passaram, assim como diff --check restrito. Pacote `outputs/Metallo-FrotaEPI-Claude-R3-20261101.zip` preparado e não enviado; inclui o parecer R2 original, diferenças R2–R3, fontes e manifesto dos bytes exatos. O R2 permanece intacto. Nenhuma publicação ou SQL remoto nesta continuação.

### Parecer R3 recebido — correções locais R4

O responsável trouxe o parecer R3, no qual Claude confirmou os hashes do manifesto e as correções N2/N3/N7. Pacotes anteriores preservados. A confirmação independente é do estado R3; não certifica as alterações R4 abaixo.

| Achado | Tratamento R4 |
| --- | --- |
| R3-1 — Tentativa EPI nunca encerrada | Ações 3D devolvem confirmação explícita com a chave concluída após sucesso da RPC e revalidação. O formulário remove somente a chave coincidente, apresenta confirmação e acesso aos registros atualizados. Falha/resultado incerto mantém a chave. Não usa parâmetro de URL como prova de sucesso. Chave iniciada por outra aba não é removida. Nova montagem após sucesso pode iniciar outro kit, mesmo com linhas iguais. Detalhes no documento 42. |
| R3-2 — Trava local permanente | Recusa mantém histórico, mas ganha vínculo com registro posterior aceito quando o veículo e todos os problemas coincidem. Checklist exige as mesmas respostas N (código e descrição), com resultado ressalvas/não liberado; chegada exige mesma viagem e problema. Checklist limpo ou defeito diferente não retiram a trava. A interface oferece refazer o checklist com os dados antigos e os itens atuais. Remoção da trava local não libera veículo: situação/RPC de saída continuam impondo a regra do servidor. |
| R3-3 — Promessa indevida de envio automático | Mensagem consulta o estado efetivamente salvo: revisão exige conferir e tocar em Enviar agora; apenas fila automática promete envio ao reconectar. Tentativa manual ainda offline também informa essa distinção. |
| R3-4 — RPC Frota ignora payload diferente com a mesma chave | Confirmado e ainda aberto. Nenhuma alteração SQL nesta rodada. Exige comparação de payload na RPC do laboratório e ensaios de resposta perdida, conflito e repetição idêntica antes de qualquer implantação remota. A interface não constitui prova dessa comparação. |

Limites de R3-2: se o item antigo foi removido do checklist atual, ou o relato foi alterado, a correspondência não é comprovada e o bloqueio local permanece para tratamento próprio. Falha de gravação local também conserva a trava. O vínculo é evidência local baseada na resposta da ação; a limitação R3-4 permanece em reenvios de chave já usada. Não equivale a resolução global pela Gestão nem a checklist versionado. Relatos confirmados continuam preservados no histórico local.

Regressões acrescentadas: novo kit após sucesso, confirmação atrasada de outra aba, chave recuperada após render/erro, relato diferente que não supera recusa, refazer com dados preenchidos, histórico preservado, RPC de saída ainda bloqueando veículo e mensagem manual correta. Validação R4: **657 testes passaram em 77 arquivos**, com dois workers, em 116,24 s; TypeScript, ESLint e diff --check restrito passaram. Pacote `outputs/Metallo-FrotaEPI-Claude-R4-20261101.zip` preparado para revisão, com bytes exatos e diferença R3–R4. Nenhuma publicação, operação de estoque remoto, SQL remoto ou nova baseline.

### Continuação R5 no servidor de teste — 02/11/2026

O responsável solicitou explicitamente continuidade no servidor `metallo-teste`, dispensou Docker e autorizou disponibilização no teste para avaliação. Docker encerrado. Produção permanece fora do escopo. O parecer R4 é somente leitura e não certifica estas alterações posteriores.

- **R4-1:** novo recibo conserva o conteúdo original recusado por funcionário/chave/veículo. O motorista usa “Enviar relato guardado para conferência”; a Gestão vê o relato na ficha, aba Manutenção. Engenheiro/administrador confirma com motivo após verificar o defeito e com veículo disponível. O motorista consulta a conferência; somente resposta correspondente à chave, veículo e conteúdo guardado retira a pendência local. Falha de armazenamento mantém bloqueio. Não recria checklist nem manutenção, não usa relógio do celular ou mera situação disponível como prova. Chegada também tem preenchimento pelo relato antigo; viagem encerrada segue pelo recibo.
- **R3-4:** as três RPCs existentes comparam o conteúdo integral recebido com a tentativa anterior, sob trava transacional por funcionário/operação/chave. Repetição igual retorna o resultado existente; conteúdo diferente gera `idempotency_conflict`. Registros anteriores sem payload integral também geram conflito conservador, exigindo conferência manual, sem reconstrução aproximada ou nova chave automática. Fotos da chegada continuam em RPC separada, fora dessa comparação.
- **R4-3:** preparação EPI conserva funcionário/troca no destino; tratamento confirmado atualiza a lista e remonta por estado, preservando funcionário selecionado. Exceção de transporte mantém formulário e chave com aviso, preservando exceções de controle do Next. Detalhes no documento 42.

Banco remoto: aplicadas `frota_recusas_e_conteudo_10e` e `frota_recusas_indice_10e`, fontes em `04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/migrations`; essa localização é somente a convenção dos arquivos, não execução em Docker. RPCs mantêm autorização existente. Tabela privada sem acesso direto; RLS sem política significa negação padrão. Avisos de funções SECURITY DEFINER são esperados na arquitetura atual: acesso anônimo revogado e autorização conferida dentro de cada função. Índice de responsável acrescentado após advisors.

Prova remota em `04_BANCO_E_SUPABASE/teste-online/provas-10e-online.mjs`: **25/25** verificações com contas fictícias; resultado em `resultado-10e-online.json`. Cobre concorrência de checklist, conflitos das três operações, imutabilidade de recibo/motivo, isolamento entre contas, negativa de conferência por funcionário, chegada encerrada e ausência de nova manutenção/checklist após conferência. Veículo sintético desativado ao final. Primeira execução teve expectativa HTTP 200 inadequada para chegada com 204; corrigida a asserção, não a regra, e repetida a prova. Consultas de privilégios confirmaram ausência de leitura/escrita direta e de execução anônima.

Continuam abertos: **R4-2**, checklist sem versão e vínculo legado por código/descrição; N4/N5; dono/ciclo de vida das fotos; concorrência entre abas/logout; categoria do condutor; referência NR-6 e aviso amigável de ZodError na página de EPI. Recibo não cria bloqueio global para outros aparelhos nem comprova execução física de conserto: registra a decisão autorizada da Gestão. Não há certificação de piloto/produção ou nova baseline.

Validação Web R5: **664 testes em 77 arquivos passaram**, com dois workers (170,23 s), TypeScript e ESLint completos passaram. Na primeira bateria, o mock da ficha precisava da nova consulta e a lista permitida do portal faltava incluir `my_relato_recusado_10e`; ambos corrigidos sem remover testes. Os 27 testes desses dois arquivos passaram isolados antes da repetição completa. Publicação das telas segue exclusivamente o pipeline `teste-online` na branch `laboratorio-colaborador`.
