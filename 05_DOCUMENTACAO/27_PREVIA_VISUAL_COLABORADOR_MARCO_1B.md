# Marco 1B — FUNCIONAL EM LABORATÓRIO

**27/09/2026 — MARCO 1B — FUNCIONAL EM LABORATÓRIO.** Fechamento formal autorizado pelo responsável nesta conversa após aprovação manual da interface atual, incluindo cores e logo Metallo. Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados em laboratório. Documento vigente do fechamento: relatório27. Não é autorização de implantação ou publicação.

**Limites obrigatórios:** NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO; NÃO É PONTO OFICIAL; NÃO É REP-P; NÃO AUTORIZA PUBLICAÇÃO.

## Prévia aprovada

**PREVIEW FUNCIONAL LOCAL — AUTH DE LABORATÓRIO**

- Login: http://127.0.0.1:3101/colaborador/login
- Home: http://127.0.0.1:3101/colaborador/inicio
- Perfil: http://127.0.0.1:3101/colaborador/perfil
- Equipe: http://127.0.0.1:3101/colaborador/equipe
- Obra: http://127.0.0.1:3101/colaborador/obra

As contas de avaliação são sintéticas. O executor existente cria senhas aleatórias e grava apenas o arquivo local ignorado `backups/credenciais-previa-colaborador.json`. Não anexar esse arquivo a pacotes, documentação ou auditoria. Nenhuma credencial administrativa é enviada ao navegador. A pilha e a prévia permanecem abertas exclusivamente em loopback para consulta local do estado aprovado.

## Implementação e limites

O modo VISUAL continua sem cliente Supabase. O modo LAB_AUTH exige flags locais exclusivas, URL exata `http://127.0.0.1:54321` e chave de papel anon; configuração ambígua, ausente ou URL diferente aborta o início. Sem flags, a rota continua indisponível. O host da página também deve ser127.0.0.1. Não há modo produção nesta rodada.

A camada de dados pessoal tem fetch restrito a Auth token/user/logout e RPC my_employee_profile, sem redirecionamentos e com no-store e timeout de6s. A política do navegador restringe conexões ao host local e à API local; o launcher sobrescreve as variáveis públicas da Gestão. A prévia bloqueia as demais páginas dinâmicas antes do middleware da Gestão. Nenhuma consulta ampla, troca de ID por URL ou escolha de funcionário é oferecida.

O DTO precisa ter exatamente employee_id/full_name/profession/team_name e um único titular. Perfil maior ou inválido fecha o acesso. A equipeNULL mantém perfil e sessão; Perfil mostra **Sem equipe atribuída**; Equipe mostra **Sem equipe atribuída no momento.** Não são listados colegas. Obra mostra **Nenhuma obra pessoal disponível no momento.** Nenhum novo contrato de obra foi criado.

Home usa o nome do DTO autenticado. Meu Ponto permanece EM DESENVOLVIMENTO; EPIs, contracheques, documentos e solicitações permanecem EM BREVE, sem ação operacional. Nenhuma migration, função, policy, FK, permissão administrativa ou regra empresarial auditada foi alterada.

## Sessão, cache e limites da revogação

O SDK Supabase2.115.0 persiste a sessão Auth em localStorage, chave `metallo-colaborador-laboratorio`: access token, refresh token, validade e usuário Auth sintético. Não há cookie de sessão próprio nem armazenamento de senha, DTO pessoal, ASO ou CPF. O DTO só existe em memória React. A senha é apagada do formulário ao enviar. O marcador do modo visual em sessionStorage não autentica ninguém.

A página valida getUser no servidor e depois a RPC. Enquanto verifica uma rota/foco, oculta dados anteriores. Com a página visível, repete a validação a cada5s; ao ocultar, remove dados renderizados e invalida a resposta pendente. Ao voltar, confere novamente. A negação no banco após revogação é imediata; a remoção visual depende do próximo ciclo (até5s mais latência/timeout). Isso não é push em tempo real. Offline também limpa acesso pessoal e exige nova entrada.

Logout limpa imediatamente o perfil e invalida requisições antigas; solicita signOut local ao Auth para invalidar o refresh da sessão. Ao concluir ou falhar a rede, remove persistência e descarta o cliente com a API pública auth.dispose(). Um adaptador de storage deixa de aceitar escritas de clientes descartados, inclusive refresh tardio. Após o achado1B-17, as abas invalidam também alterações da chave, limpam o titular anterior e recriam o cliente para validar Auth + RPC. O evento não autentica ninguém. Respostas e logout antigos não podem sobrescrever a geração nova; a exclusão de consultas simultâneas é por geração para não impedir a nova validação. Logout não pretende invalidar matematicamente um JWT já emitido antes de expirar; revogação da identidade bloqueia a RPC mesmo com token antigo, conforme o gate1A.

O ambiente é desenvolvimento Next: CSP contém unsafe-inline/unsafe-eval necessários à prévia. LocalStorage é acessível a JavaScript da mesma origem; não se afirma proteção contra comprometimento dessa origem. Não reutilizar esta configuração como projeto de sessão de produção.

## Testes e evidências separadas

| Suíte | Resultado desta rodada | Escopo |
| --- | --- | --- |
| Integração1B Auth real | 18/18 | DOM jsdom + SDK, Auth, JWT, PostgREST e RPC reais; navegação Next e eventos storage simulados; um logout com atraso controlado do transporte |
| Navegador real | ver auditoria-1b/navegador.json | Edge com login e navegação efetivos; provas responsivas no navegador local |
| Interface e concorrência | 17/17 | mocks; inclui modo visual sem Auth, três cenários de troca de sessão e foco durante logout |
| Guardas/contrato/rotas | 22/22 | unitários; oito novos exercícios diretos do Server Component, APIs Next simuladas |
| Base1A/T05/T15 | 682/682 | mesma bateria real auditada; inclui135T15, não somar |
| Banco | 31/31 | incluído no conjunto qualidade |
| Qualidade | 44/44 | inclui banco |
| Web completa | 93/97 | inclui39 testes1B acima; conserva exatamente quatro falhas da Gestão |

**Web não está completamente verde.** As quatro falhas continuam no documento31, sem alteração nas fontes correspondentes nem enfraquecimento de expectativas. TypeScript e lint das superfícies modificadas também foram executados. A matriz real é diferente das verificações de navegador; não somar assertivas internas como novos testes. Ciclo1 preservado no ZIP original:15 reais,13 interface,14 guardas,Web81/85. Ciclo2 enviado:17 reais,16 interface,22 guardas,Web92/96. Após o segundo parecer foi acrescentado um cenário real de logout com atraso controlado e um unitário; os resultados atuais são posteriores ao ZIP2 e não estão certificados por ele.

O executor real exercita login João/Maria, credenciais erradas/inexistentes, conta revogada/banida, quatro campos próprios e cruzamentos vazios, refresh/logout, equipe ativa/inativa/ausente/removida/reatribuída, funcionário inativo, revogação e ban com tela aberta, token antigo, sessão expirada e pilha realmente desligada. Metadados de rede em rede-auth-real.json não contêm headers, corpos ou tokens. A prova offline exige tentativas somente127.0.0.1, status de conexão falha e no-store.

Para expiração, config.toml foi temporariamente reduzido de3600 para60s; a pilha foi reiniciada somente localmente. Um JWT Auth real foi aguardado até exp+32s. O PostgREST admite30s de tolerância de relógio ([documentação oficial](https://postgrest.org/en/stable/references/auth.html#time-based-claims-validation)); depois retorna401. Refresh real recupera uma sessão válida, enquanto refresh encerrado não recupera acesso. A configuração3600 foi restaurada e a pilha reiniciada para a avaliação. Sem relógio falso ou token forjado neste ensaio.

### Ocorrências de implementação/teste

- A fixture inicial tentou um tipo de equipe incompatível com a baseline. Corrigida para field conforme catálogo e executores existentes; nenhuma constraint foi alterada.
- A primeira integração registrou11/14: duas falhas na fixture de remoção (FK exige desvinculação explícita e nome único) e uma expectativa de expiração anterior à tolerância real do PostgREST. Resultado preservado em auth-real-intermediario.json. Corrigiu-se o ensaio, preservando a exigência de401 após a validade efetiva. Reexecução final15/15 inclui o novo teste offline.
- A primeira leitura automatizada do erro offline no Edge capturou um estado transitório; a inspeção seguinte confirmou a mensagem final. A observação original está preservada e não é contada como teste aprovado. O gate offline automatizado real posterior passou.
- Foi identificada necessidade de encerrar completamente clientes SDK descartados e bloquear escritas tardias; usa-se a API pública dispose e geração de requisições. Não se alterou código interno do SDK.

## Acessibilidade e segurança

Fonte informativa mínima14px, campos16px, foco visível, labels explícitos, alvos de toque de pelo menos44px, botão Sair com nome acessível, carregamento e erros anunciáveis, menus responsivos. Medidas/screenshot estão em auditoria-1b/acessibilidade.json e arquivos PNG. São verificações mínimas de desenvolvimento, não certificação completa WCAG. O reflow foi medido em320/390/1280px; os atalhos não alteraram o zoom efetivo no navegador integrado. Zoom real200% permanece explicitamente pendente na avaliação manual, sem prova automatizada alegada.

### Ajuste visual solicitado — cores e logo Metallo (27/09/2026)

A prévia reutiliza a paleta global existente da Gestão: fundo `#06111a`, painéis `#0b1a26`, azul `#168cff`, destaque `#5bb2ff` e textos existentes. Âmbar permanece nos avisos de teste/desenvolvimento. O cabeçalho usa a logo oficial `01_WEB/public/metallo-logo.png`, por meio de `BrandLogo`, extraído no componente de marca já existente; o componente `Brand` conserva seu destino e apresentação na Gestão. O cabeçalho se adapta à logo nas telas menores.

Verificação desta alteração: **39/39 testes unitários do portal**, TypeScript e lint aprovados. Navegador real verificou logo, reflow em320/390/1280px, alvos de44px, campos de16px e foco de3px. Os quatro pares principais de contraste medidos ficaram entre4,85:1 e17,71:1. Evidências atuais em `auditoria-1b/acessibilidade.json` e nas capturas de login/painel; a captura do painel no tamanho normal acompanha a largura disponível do navegador integrado.

Esta rodada alterou apresentação e reutilização da marca, sem modificar sessão, autorização, banco ou funções. Os resultados das baterias reais e Web completa acima são da rodada funcional anterior; não foram reexecutados para esta alteração visual. Os ZIPs preservados são retratos anteriores e não contêm esta nova aparência. A aprovação manual do visual foi recebida posteriormente e está registrada no fechamento abaixo. As limitações técnicas continuam explícitas.

O pacote é montado por allowlist e passa por varredura de fontes/bundle, valores secretos conhecidos locais, JWT administrativos, sb_secret e chaves privadas, além do conteúdo XML dos DOCX. Referências literais a nomes de chaves em testes/documentação não são valores secretos. Builds, dependências, .env, credenciais, cookies, volumes e dumps com dados não são incluídos.

## Arquivos novos e responsabilidades

- `01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts`: guarda de modo/ambiente no servidor; não existia configuração pessoal equivalente.
- `01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts`: cliente limitado ao laboratório e contrato pessoal; o cliente da Gestão usa outro destino/escopo e não pode ser reutilizado.
- `01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session.ts`: ciclo da sessão separado das telas, sem misturar Auth e apresentação.
- `01_WEB/10_TESTES/colaborador-seguranca.test.ts`: guardas de ambiente/saída/DTO, distintos dos testes visuais existentes.
- `01_WEB/10_TESTES/colaborador-auth-real.integration.tsx`: gate real específico1B, executado explicitamente com METALLO_TEST_1B_AUTH=1 e separado dos mocks.
- `04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-1b/`: evidências desta responsabilidade nova (sessão real do produto local, rede do cliente, imagens, varredura e parecer1B original). Não duplica o relatório vigente, que permanece neste documento.
- Parecer T15 original preservado em auditoria-complementar; pacotes/manifestos finais ficam em outputs. Cada resposta de auditoria1B terá arquivo original próprio, hash e confronto separados, conforme autorização.

Demais alterações atualizam telas/estilos/testes/scripts/configurações/documentos existentes. As pastas01–07 e a arquitetura de camadas foram preservadas.

## Fechamento formal aprovado pelo responsável

**Decisão recebida em27/09/2026:** “Considero a interface aprovada para o estado atual do Marco 1B. Faça agora o FECHAMENTO FORMAL DO MARCO 1B EM LABORATÓRIO.” A decisão abrange o estado local com as duas correções de sessão e a identidade visual já apresentada. Substitui a decisão anterior de manter o marco aberto aguardando avaliação manual e terceira revisão; não transforma a correção posterior em código auditado independentemente.

- Dois ciclos SuperGrok concluídos e confrontados; respostas originais e ZIPs imutáveis preservados.
- **Troca de conta entre abas (1B-17):** reproduzida, corrigida, testada localmente e revisada no Ciclo2.
- **Logout demorado (1B2-03):** reproduzido, corrigido depois do parecer2 e aprovado nos testes unitários/integração real aplicáveis. Sem terceira revisão independente dessa guarda. Nenhuma falha crítica/alta foi identificada nos pareceres e ensaios aplicáveis ao perímetro local; isso não é garantia universal nem certificação de produção.
- A aprovação manual da interface não é uma medição específica de zoom200%. Essa verificação permanece como pendência de acessibilidade.
- Web completa93/97 conserva quatro falhas antigas da Gestão: G-WEB-01 a04 no documento31. Não foram corrigidas, removidas ou aceitas como liberação dos fluxos afetados.

### Baseline aprovada e conferência final

Identificador: **METALLO-1B-LAB-20260927-R1**. Artefato: `outputs/Metallo-Marco1B-BaselineAprovada-20260927.zip`, com manifesto SHA-256 por arquivo e arquivo adjacente `.zip.sha256`. Base Git de referência: `eadd1f8cf9e62b85c4c62b9d2f2b83a970ecf77c`. É snapshot sanitizado do escopo1B e suas evidências/dependências locais, não commit de todo o checkout nem backup de volumes/dados.

O manifesto registra o inventário Git do checkout (inclusive mudanças anteriores fora do1B), arquivos incluídos, hashes e justificativas por responsabilidade. Os documentos17–31 pertinentes, fontes do portal e marca reutilizada, configurações, SQL auditado, Edge Functions, executores e provas acompanham a baseline. Dependências/builds, arquivos de ambiente e credenciais permanecem excluídos. Para recuperar em outro ambiente são necessários o checkout de referência e dependências locais compatíveis; o pacote não contém dados nem substitui ensaio de recuperação integral.

Conferência final por evidências: `auditoria-1b/resumo-final.json` (contagens, aprovação e conferências), `secret-scan.json` (varredura sem valores secretos encontrados), `rede-final.json` (sonda8/8 reexecutada), `estado-final.json` (containers/listeners locais) e pareceres/metadata dos dois ciclos. A guarda de configuração, o destino fixo da camada pessoal, a lista de endpoints e os testes de rejeição continuam sem fallback remoto. As quatro fontes/testes da Gestão mantêm os hashes de controle. Resultados funcionais já validados são confirmados pelos relatórios, sem alegar reexecução integral nesta rodada documental.

Nenhum novo módulo de produto foi criado no fechamento. Novos artefatos em outputs têm responsabilidade exclusiva de congelar a baseline aprovada; relatório27 e empacotador existente foram atualizados. Organização01–07 e AGENTS preservados. Nenhum próximo marco foi iniciado.

**Ocorrência operacional encontrada na conferência:** o container auxiliar `supabase_vector_laboratorio-marco-1a` está reiniciando. Seus logs registram `docker_logs: Listing currently running containers failed` com `NetworkUnreachable`; a causa de infraestrutura além desse erro não foi confirmada. Auth, PostgREST, banco, gateway e demais serviços essenciais estão em execução, e a sonda de rede voltou a passar8/8. A coleta centralizada auxiliar de logs não é considerada saudável. Pendência registrada no estado final/manifesto para saneamento operacional separado; nenhuma configuração de rede, controle de segurança ou arquivo gerado foi alterado para contorná-la. O fechamento funcional não certifica a saúde desse coletor.

### Próximo trabalho proposto — não executado

Priorizar uma rodada separada para as quatro pendências da Gestão, com contrato/SQL efetivo, permissões, idempotência e acessibilidade testados; apresentar prévia e submeter revisão conforme escopo aprovado. A marcação experimental do roadmap (Marco2) depende de autorização própria e planejamento; permanece não iniciada. Minha Obra continua apenas com estado vazio, sem atribuição ou consulta operacional nova.

## Confronto independente — ciclo 1

O parecer original foi preservado integralmente **antes** deste tratamento em `auditoria-1b/parecer-grok-ciclo1-original.md`, sem edição, SHA-256 `5b533dfcce0c2b24a8e53d090f737d841d15b10f07fa12ced067b5e3cb4f118e`. Metadados de procedência estão no JSON adjacente. Plataforma Grok, modo Expert exibido, versão exata não informada; não atribuir um modelo presumido. Pacote analisado: Ciclo1, SHA-256 `cee1e84d13136581fe8baea24551f903f067811d69092008cd9964ad8d72c9a4`. A captura foi do texto final renderizado, pois o botão de copiar devolveu vazio. O auditor fez leitura estática; resultados dinâmicos são do Work.

| Achado | Classificação Work | Causa, evidência, tratamento e teste |
| --- | --- | --- |
| 1B-01, informativo | VÁLIDO no perímetro declarado | Nenhum crítico/alto demonstrado pelo parecer. Não é garantia universal; revisão de saídas, DTO e rotas + gate real sustentam o alcance local. |
| 1B-02, informativo | VÁLIDO | Guardas locais presentes; nenhuma mudança no launcher ou autorização. Testes de configuração e novo exercício do Server Component. |
| 1B-03, informativo/lacuna | PARCIALMENTE VÁLIDO | Bundle excluído intencionalmente do ZIP; scan é evidência do executor. Metadados misturavam fixture e app. Agora cada pedido distingue portalFetch (marca no-store exclusiva nesse harness) de fixture/SDK direto, com assertiva dos quatro caminhos pessoais. Sem segredo nem operação administrativa no app. |
| 1B-04, baixa | VÁLIDO | CSP Next de desenvolvimento usa eval/inline. Limite já documentado, sem alegação de sessão produtiva. Proxy da Gestão e helper de ambiente incluídos no Ciclo2 para leitura transitiva. |
| 1B-05, informativo | PARCIALMENTE VÁLIDO | Revogação/expiração/logout reais comprovados; afirmação de concorrência precisava do complemento1B-17. Guardas de geração e clientes descartados reforçados, sem SQL. |
| 1B-06, baixa | VÁLIDO | Tokens em localStorage são legíveis por JS da mesma origem. Limite explícito exclusivamente local; projeto de sessão produtiva permanece fora desta rodada. |
| 1B-07, baixa | VÁLIDO | Polling5s + rede não garante remoção visual instantânea. Ao ocultar limpa dados; ao voltar valida. Corrigido o bloqueio de verificação de geração nova por uma consulta antiga. Teste de resposta atrasada cobre o caso; não se promete percentil de latência não medido. |
| 1B-08, baixa/lacuna | VÁLIDO, complementado | Faltava testar diretamente page.tsx. Oito unitários exercitam headers/Host inválidos, caminhos de IDs, ausência de flags e retorno local autorizado. APIs Next simuladas; não apresentar como HTTP real. |
| 1B-09, baixa/lacuna | VÁLIDO, complementado | A sonda antiga cobria só5432x. Script existente recebe --com-previa: inclui3101 em listeners, loopback IPv4, IP Ethernet do host e rede Docker separada com controle positivo. Nenhuma porta publicada, firewall preservado. |
| 1B-10, informativo | VÁLIDO | RPC por auth.uid(), sem ID escolhido; quatro campos estritos. Provas reais João/Maria e teste de ampliação mantidos. |
| 1B-11, informativo | VÁLIDO | Equipe opcional continua válida; FK sem CASCADE, desvinculação explícita no ensaio. Nenhuma função/policy foi alterada. |
| 1B-12, informativo | VÁLIDO | Obra e recursos futuros permanecem inertes. Sem nova consulta operacional. |
| 1B-13, informativo | VÁLIDO | Offline real e ocorrência transitória Edge preservados. Não alterar a UI para acomodar uma leitura precoce do runner; aguardar estado final é responsabilidade do ensaio. |
| 1B-14, informativo/lacuna | PARCIALMENTE VÁLIDO | ZIP histórico não foi anexado de novo. Empacotador agora compara também os bytes internos das quatro migrations diretamente com o ZIP T15 original e registra os hashes. Isso é prova local depositada, não comparação independente com um ZIP recebido pelo Grok. Quatro falhas Gestão mantidas. |
| 1B-15, informativo/lacuna | VÁLIDO | Reflow/foco/labels/contraste medidos; zoom200% real e avaliação manual pendentes. Certificação WCAG integral e leitor de tela não são alegados. |
| 1B-16, informativo | VÁLIDO | Organização01–07 preservada. Atualizados arquivos de responsabilidades já existentes. |
| 1B-17, baixa/hipótese | VÁLIDO, reproduzido e corrigido | Listener só tratava remoção e deixava titular anterior até poll/foco. Novo teste falhou antes (`cross-tab-antes.json`) e passou após. Agora qualquer mudança/limpeza de storage invalida a geração, remove perfil e revalida; não usa evento como autorização. Novos ensaios cobrem resposta e logout atrasados, além de troca João/Maria com duas sessões Auth reais e evento DOM simulado. |

A alteração de sessão foi submetida ao **Ciclo2 independente**, no limite de duas rodadas. Nenhum achado resultou em migration, RPC, policy, regra empresarial nova ou permissão da Gestão. Os pacotes enviados permanecem imutáveis; este documento continua sendo o tratamento vigente, separado do parecer original.

## Confronto independente — ciclo 2 e correção local posterior

Original integral preservado antes do confronto em `auditoria-1b/parecer-grok-ciclo2-original.md`, SHA-256 `3f7a7516fb56221163d9010aaefa4ced346089070a7472594cf2b75e096da9eb`. Metadados adjacentes registram plataforma, modo Expert, data e conversa. ZIP2 enviado: SHA-256 `93d59203ab815bb8f0c27971daf4684f7339a372637e4c118a9ce869580beb40`. Não foi editado nem substituído por um pacote posterior.

| Achado | Classificação Work | Evidência, causa, risco e tratamento |
| --- | --- | --- |
| 1B2-01, informativo | VÁLIDO |1B-17 confirmado, corrigido e revisado. Além dos casos jsdom, duas abas Edge enviaram João/Maria concorrentemente e convergiram para Maria; logout em B retirou ambas. Evidência em navegador.json. Não é prova de todos os interleavings. |
| 1B2-02, informativo | VÁLIDO no alcance ensaiado | Gerações bloqueiam respostas/login/logout antigos nos casos cobertos. Não estender essa conclusão ao caso novo1B2-03 sem testá-lo. |
| 1B2-03, baixa/hipótese | VÁLIDO; reproduzido e corrigido LOCALMENTE APÓS o parecer | Durante signOut pendente o foco podia criar outro cliente e repintar o mesmo titular. Teste direcionado falhou antes (`logout-pendente-antes.json`:1 falha,16 não selecionados; não é suíte completa). Correção mínima: verify retorna enquanto endingClient existir; mudança de storage já descarta esse cliente antes de validar geração nova. Unitário correspondente passa no conjunto39/39. Novo ensaio real retém temporariamente a saída do pedido local de logout, dispara foco, verifica ausência de consultas/dados e depois libera a requisição Auth real. Essa correção do hook **não foi enviada a terceira auditoria**. |
| 1B2-04, informativo | VÁLIDO | Origem app/harness é convenção no-store documentada, não assinatura criptográfica. Assertiva proíbe caminhos administrativos no subconjunto do app. Não acrescentar header ao produto só para rotular o teste. |
| 1B2-05, lacuna | PARCIALMENTE VÁLIDO | Teste de Server Component não é HTTP completo. Concorda-se com o limite; a afirmação de que HTTP vivo só faria sentido fora do loopback é excessiva. Pode trazer valor futuro, mas não foi requisito de transporte do gate atual e não se alega prova inexistente. |
| 1B2-06, informativo | VÁLIDO |3101 incluída; Supabase IPv4/IPv6 e prévia somenteIPv4 conforme bind efetivo. Sem segunda máquina física. |
| 1B2-07, informativo | VÁLIDO | Helper Gestão continua genérico no ramo próprio; prévia o evita. Não ampliar/redefinir Gestão para resolver superfície pessoal. |
| 1B2-08, lacuna | VÁLIDO | Comparação com ZIP T15 executada pelo empacotador local; o Grok não recebeu o binário histórico. Evidência local não equivale a cadeia de custódia examinada por ele. |
| 1B2-09, lacuna | VÁLIDO | Bundle excluído do upload; varredura feita localmente. Não alegar inspeção independente dos chunks ausentes. |
| 1B2-10, informativo | VÁLIDO no perímetro | Segundo parecer não demonstrou crítico/alto. Não estender sua conclusão à última correção posterior nem a produção. |

**Limite de automação respeitado:** duas rodadas enviadas, duas respostas originais preservadas. A hipótese baixa restante foi tratada localmente no segundo ciclo de correção, mas qualquer nova revisão independente desse ajuste depende de uma rodada futura autorizada. Na decisão anterior, esses itens mantinham o gate aberto. A autorização explícita posterior do responsável, registrada acima, encerra somente o Marco1B em laboratório; a guarda posterior não recebeu nova auditoria independente e o zoom200% segue sem medição específica.

Reexecução pós-correção1B2-03: **18/18 reais,39/39 unitários1B (17 interface +22 guardas),Web93/97**, TypeScript e lint aprovados. Os quatro erros Web têm os mesmos nomes anteriores. O ensaio real novo atrasou apenas o pedido de logout por250ms antes de entregá-lo ao Auth local verdadeiro; foco nesse intervalo não causou leitura Auth/RPC nem reapresentou dados. Depois, a saída real concluiu e limpou a sessão. Não confundir atraso controlado de transporte com Auth simulado. Nenhuma terceira auditoria ou publicação foi executada.

Nota de procedência: a interface do Grok exibiu ferramentas de extração, leitura e cálculo de hashes no espaço do serviço. Os prompts proibiram executar o projeto; não foi observada execução de testes, SQL, containers do projeto ou chamadas ao laboratório pelo auditor. As declarações do parecer sobre seu método são do próprio auditor, não uma certificação do Work sobre operações internas do serviço.

## Saneamento posterior à baseline R1 — revisão R2 local

O responsável solicitou corrigir as quatro falhas antigas da Gestão, sanear o coletor auxiliar local e medir zoom real200%, sem iniciar novos módulos do Colaborador. A fotografia **METALLO-1B-LAB-20260927-R1** permanece imutável: o ZIP aprovado e seu arquivo `.sha256` ainda coincidem em `41cc99f9eb38cbd895ec8e9555ce9c9e2d3ca1ead7b757c6f5dbffe89863a162`. Não reescrever os resultados históricos R1 (Web93/97).

O tratamento das quatro falhas, causas e provas de reprodução/correção estão no [backlog vigente da Gestão](31_BACKLOG_GESTAO_QUATRO_FALHAS_WEB.md). Neste checkout posterior, a Web integral passou **97/97** em34 arquivos, incluindo **39/39** unitários do portal. Banco **31/31**, qualidade **44/44**, TypeScript e lint passaram. A regra de lint foi ajustada apenas para excluir as pastas geradas das prévias `.next-local-preview` e `.next-gestao-preview`; dois símbolos sem uso na tela EPI da Gestão foram retirados. A legenda do gráfico mede14px na prévia viva. A varredura local do delta R2 e dos bundles examinou43 fontes e123 arquivos gerados sem encontrar segredo conhecido, chave privada ou JWT indevido (`saneamento-r2/secret-scan.json`); ela não substitui a varredura R1 do pacote e seu XML DOCX, nem garante ausência universal de segredos desconhecidos.

O erro do coletor antigo foi identificado: a configuração gerada pela CLI apontava para `http://host.docker.internal:2375`, enquanto não havia listener TCP local nessa porta. O container auxiliar estava em ciclo de restart (`unless-stopped`,106 reinícios). A solução local usa a opção oficial `supabase start --exclude vector` e um Vector do laboratório supervisionado, com socket Unix local e nenhuma porta publicada. O ensaio final **12/12** confirmou sequência1–5, backoff real5/10/20/40s, espera300s, CPU abaixo de2%, nenhum restart automático, ausência de spam, Auth principal disponível, reconexão após restauração do Analytics, shutdown limpo e reinício explícito (`saneamento-r2/coletor-depois.json`). A tentativa intermediária falhou apenas ao ler um marcador antes de ele existir; o Analytics foi restaurado no `finally` e o verificador foi corrigido. Um ensaio posterior mostrou marcador antigo misturado na ordem; o supervisor passou a limpá-lo ao ativar e o teste final exigiu ordem e horários reais. O acesso ao socket Docker dentro do container dá capacidade de controle do daemon apesar da montagem somente leitura; esse risco local deve ser levado em conta antes de qualquer ampliação de uso.

A sonda parcial do host Windows registrou sete listeners exclusivamente em `127.0.0.1` (3101,3102,54321,54322,54323,54324,54327), acesso por loopback em7/7 e ausência de resposta pelo IP Ethernet do próprio host em7/7 (`saneamento-r2/rede-host-parcial.json`). A sonda completa posterior passou **8/8**: conferiu também bindings Docker, IPv4/IPv6, controle positivo em rede sintética separada, inacessibilidade dos sete serviços/portas pelo IP Ethernet a partir dessa rede e firewall ativo (`saneamento-r2/rede-final.json`). Nenhuma segunda máquina física participou; o bind real de loopback e a rede Docker separada são as evidências independentes disponíveis. A prévia pessoal permanece em `http://127.0.0.1:3101/colaborador/inicio`; a prévia sintética da Gestão está em `http://127.0.0.1:3102/previa/correcoes-metallo` e `/previa/consumo`, com compilação independente e dados fictícios. O ensaio anterior em largura CSS de956px/621px era apenas reflow. O ensaio final no **Edge real em zoom200%** mediu `devicePixelRatio=2`, janela externa1920px e área CSS956px: Login, Início, Perfil, Equipe, Obra, Consumo e as quatro abas da prévia de operações da Gestão carregaram sem rolagem horizontal nem controles fora da largura útil. O foco do e-mail no Login ficou visível; o seletor Caixas/Unidades funcionou e a legenda mediu14px CSS. A rolagem vertical é esperada. Evidência: `saneamento-r2/zoom-200.json`. Isso não equivale a certificação WCAG integral.

Auth/JWT/PostgREST reais foram reexecutados **18/18** com expiração verdadeira de60s, teste offline e restauração byte a byte de `config.toml`; `GOTRUE_JWT_EXP=3600` foi conferido no container após o reinício. A base1A/T05/T15 foi reexecutada **682/682**, incluindo Edge Functions. São resultados novos da R2, separados dos mesmos números históricos da R1. O texto antigo da prévia de operações que negava a execução de testes foi removido; a Web completa **97/97**, TypeScript e lint passaram novamente após essa mudança. A baseline identificada **METALLO-1B-LAB-20260927-R2** é gerada em `outputs/Metallo-Marco1B-BaselineSaneada-20260927-R2.zip` somente se a varredura final de segredos, o manifesto com hashes e todos os gates passarem. A R1 histórica não é sobrescrita. Não houve alteração do Supabase remoto, publicação, uso de funcionários reais, ponto oficial ou REP-P.
