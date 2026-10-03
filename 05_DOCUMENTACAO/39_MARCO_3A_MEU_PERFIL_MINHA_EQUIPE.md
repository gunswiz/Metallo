# Marco 3A — Meu Perfil e Minha Equipe

**Estado aprovado em 28/09/2026: MARCO 3A — MEU PERFIL + MINHA EQUIPE FUNCIONAL EM LABORATÓRIO.** O responsável aprovou manualmente Meu Perfil e Minha Equipe em 100% e 200%, autorizou o fechamento formal e a baseline `METALLO-3A-LAB-20260928-R1`. Os dois ciclos autorizados de auditoria independente Grok foram recebidos e confrontados; nenhum crítico ou alto confirmado permaneceu aberto. **SIMULAÇÃO SEM VALOR OFICIAL.** A origem imutável é `METALLO-2F-LAB-20260928-R1`, ZIP em `outputs/Metallo-Marco2F-BaselineAprovada-20260928-R1.zip`, SHA-256 `5b7b50ddf9385b58731b84852d54626c9893d0a812151e4e7cd157b568b34097`, conferido antes e depois do trabalho. O núcleo de ponto 2F não foi alterado. O Supabase remoto permanece intocado.

## Fontes de verdade e contrato

O Perfil já possuía `my_employee_profile()` (1A/T05), que retorna `employee_id`, `full_name`, `profession` e `team_name` após `auth.uid()` → conta portal ativa → identidade ativa → funcionário ativo. O cliente consome nome e profissão; o identificador permanece apenas no contrato de autenticação, sem exibição. A obra pessoal vem exclusivamente de `my_current_work()` (1C), com `work_id` e `work_name`. Não existe matrícula/código interno aprovado para exibição; `registration_code` da tabela EPI não foi assumido como matrícula. Acesso aparece como estado simples **Acesso ativo**, somente depois de Auth e perfil válidos.

Para a lista de equipe, esses contratos eram insuficientes. Foi criada apenas no laboratório a RPC sem argumentos `my_team_summary()`, em `04_BANCO_E_SUPABASE/laboratorio-marco-3a/contrato-equipe.sql`. Ela resolve o titular por `auth.uid()`, conta portal, identidade e funcionário ativos; a equipe atual segue a regra conservadora de Minha Obra: um único vínculo vigente, ou equipe base quando não há histórico de alocações. Vínculos ambíguos ou encerrados não recuperam a equipe antiga. Equipe inativa não é atual. A obra apresentada é a obra ativa da mesma equipe; o Perfil confere seu nome contra `my_current_work()` e falha fechado se as leituras divergirem. A função usa `SECURITY DEFINER`, `search_path=''` e execução concedida apenas a `authenticated`. O portal não recebe `team_id` ou `employee_id` como argumento.

O DTO da equipe contém somente `team_name`, `work_name`, `member_count` e `members` com `{name, profession}`. Integrantes são funcionários ativos resolvidos na mesma equipe atual. CPF, ASO, contato pessoal, salário, EPI individual, ponto, documentos, IDs dos colegas e permissões não saem por essa RPC. O cliente rejeita campos extras e contagem inconsistente. As tabelas operacionais não foram liberadas ao portal para obter esses dados.

O modelo `teams` não possui um campo confiável de responsável/encarregado. A tela informa **Não cadastrado**; atribuir responsável é decisão de produto futura. Não se infere responsável pelo primeiro integrante ou profissão. Dados sintéticos acumulados no banco de teste podem produzir nomes repetidos no rol; cada linha representa um registro de funcionário diferente. A interface não inventa um critério para fundi-los.

## Comportamento das telas

- **Meu Perfil:** nome, profissão quando informada, equipe e obra atuais, acesso ativo, atalhos Obras/Minha Equipe/Meu Ponto em simulação, Meus EPIs identificado como **Em breve**, e segurança com Sair e Sair de todos os dispositivos pelos fluxos já existentes. Sem equipe aparece **Sem equipe atribuída**; sem obra aparece **Sem obra atribuída no momento.** Nenhum desses estados encerra a sessão.
- **Minha Equipe:** equipe ativa, obra quando houver, responsável não cadastrado, contagem e integrantes apenas por nome e função. Sem equipe ou equipe inativa aparece **Sem equipe atribuída no momento.** O funcionário ativo continua no portal.
- Foco, retorno de visibilidade, troca de conta entre abas e nova tentativa limpam os detalhes anteriores antes de buscar novamente. Respostas atrasadas não repõem dados antigos. Em falha de rede aparece indisponibilidade com opção de tentar novamente. O destino do cliente continua restrito a `127.0.0.1:54321`, sem fallback remoto.
- A prévia usa os fluxos de sessão/logout já aprovados no 2E/2F. Não foi criado mecanismo novo de Auth ou de ponto.

## Provas e limites

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Marco 3A, Auth/JWT/PostgREST reais e catálogo da RPC | **49/49** | `04_BANCO_E_SUPABASE/laboratorio-marco-3a/resultado-3a.json` |
| UI específica Perfil/Equipe | **9/9** | `01_WEB/10_TESTES/colaborador-perfil-equipe.test.tsx` |
| Web completa | **126/126**, 22 arquivos | `04_BANCO_E_SUPABASE/laboratorio-marco-3a/web.log` |
| Banco | **31/31** | regressão local desta rodada |
| Qualidade | **44/44** | regressão local desta rodada |
| TypeScript, lint e build | aprovados | execução local desta rodada |
| Rede do laboratório | **8/8** | `REDE_SANITIZADA.json` no pacote do ciclo 2; prova bruta `04_BANCO_E_SUPABASE/laboratorio-marco-3a/rede.json` permanece somente no laboratório |
| Scan direto do ZIP do ciclo 2 | **1.285 itens, zero achados** | `outputs/Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo2.zip.verificacao.json` |

As suítes se sobrepõem; seus números não são somados. O ensaio 3A cobre `SECURITY DEFINER`, `search_path` vazio e privilégios de execução; próprio perfil/equipe/obra; João↔Maria; manipulação de `team_id`/`employee_id` pelo body; filtro por querystring; leitura direta das tabelas; admin Gestão, `anon`, conta revogada e token residual; funcionário inativo, sem equipe, equipe inativa, troca A→B e alocações ambíguas/encerradas. O teste UI cobre dados mínimos, estado vazio, troca de equipe, troca de conta entre abas, indisponibilidade, logout global e parser estrito. O ensaio de rede provou listeners e bindings loopback, alcance positivo local, tentativas negativas no IP de rede e de container separado, com firewall ativo; segundo computador físico não foi ensaiado.

Em desktop e em viewport móvel estreita, as duas telas foram inspecionadas sem corte ou rolagem horizontal; foco visível, headings, nomes de ações e estados de erro foram verificados. Uma viewport CSS equivalente à largura produzida por ampliação de 200% foi inspecionada sem rolagem horizontal. **O responsável confirmou e aprovou manualmente o visual em 100% e 200% em 28/09/2026.** A automação não mediu o valor de zoom real do navegador; a aprovação manual é a evidência para essa condição.

## Arquivos e governança

Arquivos novos por responsabilidade específica: `contrato-equipe.sql` e `provas-3a.mjs` com evidências ao lado no laboratório 3A; `meu-perfil.tsx`, `minha-equipe.tsx` e `use-personal-detail.ts` na tela do Colaborador; `colaborador-perfil-equipe.test.tsx` na suíte Web; este documento vigente do 3A. Arquivos existentes atualizados: adaptador Supabase local, hook de sessão, composição e estilos da tela, mock da prévia, verificador de rede e scanner local de segredos. A estrutura 01–07 e as baselines anteriores foram preservadas.

**Prévia local aprovada:** `http://127.0.0.1:3101/colaborador/perfil` e `http://127.0.0.1:3101/colaborador/equipe`, com contas sintéticas. A auditoria Grok independente exigida pelo novo `SECURITY DEFINER` foi concluída em dois ciclos e confrontada. O responsável autorizou especificamente a baseline 3A após essa etapa. Não publicar, não usar funcionários reais e não iniciar Meus EPIs ou outro módulo neste fechamento.

## Auditoria independente — ciclo 1

O pacote passivo `outputs/Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo1.zip` é preparado sem criar baseline. A origem imutável é conferida por SHA-256; o pacote contém seu manifesto e versões anteriores dos fontes relevantes, **sem embutir o ZIP 2F completo**, pois ele contém provas antigas de rede com endereços da máquina. A prova de rede 3A no ZIP omite os endereços não loopback. O prompt somente leitura está dentro do pacote; não autoriza execução do projeto, SQL, testes, Auth, containers ou rede. O SHA-256 e o resultado da varredura direta pertencem ao recibo externo `outputs/Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo1.zip.verificacao.json`, emitido após o ZIP para evitar autorreferência.

O Grok recebeu o ZIP e seu recibo na [conversa do ciclo 1](https://grok.com/c/f10c8aa5-b35f-4ff4-a60b-da79ed670535), calculou o mesmo SHA-256, verificou as 42 entradas e devolveu um parecer por inspeção passiva. O texto integral está em `04_BANCO_E_SUPABASE/laboratorio-marco-3a/parecer-grok-ciclo1.md`, SHA-256 `55e578b0d365c8e249328f70b0818e6a2b3d895c52c80882ba86e4b4880a638f`. O auditor declarou não executar testes, SQL, Auth ou rede do laboratório.

**Recibo final externo ao pacote:** `Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo1.zip` tem SHA-256 `ce4c22f74533fbf9353534d82269c663538e884ade0968025a64a45ba3e67a8b`, **42 entradas**, 41 itens inventariados e 36 entradas novas/alteradas no delta de pacote. O scan direto do ZIP final examinou **1.278 itens**, com **zero achados**. O ZIP integral 2F, endereços IPv6 públicos e o endereço Ethernet local não aparecem no pacote final. Este recibo textual foi acrescentado ao documento vigente depois do congelamento do ZIP; o parecer deve se basear nos bytes e manifesto do ZIP recebido e no recibo externo `.verificacao.json`.

## Confronto do ciclo 1 e correção local

O parecer identificou **zero crítico/alto confirmado aberto** e 11 achados. O defeito C1-01 foi reproduzido primeiro: inserir colega sintético com profissão só de espaços fez o novo check falhar. A coluna `profession` no catálogo local é `NOT NULL`, portanto a hipótese de `NULL` do parecer não se aplica à tabela atual, mas texto em branco é permitido. A RPC foi ajustada para devolver **Função não informada**; a mesma prova real passou depois. Foi adicionado teste do parser da interface.

| Achado | Confronto local após correção |
| --- | --- |
| F3A-C1-01, profissão vazia | **Válido e corrigido no laboratório.** Falha antes da correção; passou após normalização SQL e teste da UI. |
| F3A-C1-02, possível SELECT amplo nas tabelas | **Lacuna sanada localmente.** `resultado-3a.json` contém políticas RLS lidas do catálogo e amostras HTTP; `select=*` sem filtro em `epi_employees`, `teams`, `employee_assignments` e `worksites` por João, Maria e `anon` devolveu zero linhas ou 401. Admin Gestão mantém leitura operacional autorizada; sua RPC pessoal permanece vazia. As políticas SQL e a configuração de schemas entram no ciclo 2. |
| F3A-C1-03, overload desconhecido | **Lacuna sanada.** Catálogo vivo comprova uma única `my_team_summary()` sem argumentos; body com IDs continua recusado. |
| F3A-C1-04, rede física | **Limite preservado.** Os 8 ensaios locais já passavam; o ciclo 2 inclui listeners e bindings restritos a `127.0.0.1`/`::1`, contagens de sondas negativas e controle positivo, sem divulgar IPs da máquina. Segundo computador físico continua não ensaiado. |
| F3A-C1-05, zoom | **Limite da evidência independente.** Aprovação manual real em 100% e 200% registrada pelo responsável; não inventar captura automática. |
| F3A-C1-06, `employee_id` em contrato legado | **Risco futuro.** O 3A não exibe o ID no DOM nem inclui IDs dos colegas no DTO; evitar uso em novas telas. |
| F3A-C1-07, SQL só no laboratório | **Parcial intencional.** A função não foi aplicada remotamente; eventual promoção exige autorização e migration própria com grants e `search_path` iguais. |
| F3A-C1-08, recibo interno antigo | **Válido para higiene, corrigido no pacote 2.** O JSON de scan de tentativa anterior não será incluído. O recibo do ZIP final permanece externo porque um ZIP não pode conter seu próprio hash. Números deste documento foram alinhados aos logs vigentes. |
| F3A-C1-09, comparação de obra por nome | **Hipótese preservada.** As duas RPCs usam a mesma resolução atual; colisão só causaria falso acordo se houvesse divergência adicional. Não ampliar o DTO desta rodada. |
| F3A-C1-10, token residual e UX | **Parcial e risco residual conhecido.** Perfil e equipe ficam vazios após revogação; a atualização da sessão usa verificação periódica/foco. Equipe vazia não pode ser tratada como revogação, pois funcionário ativo sem equipe deve continuar no portal. |
| F3A-C1-11, evidência passiva insuficiente | **Parcial sanado quanto aos HTTPs.** Resultado 3A inclui status, contagem e DTO sintético das leituras essenciais; o auditor pode ler a prova, mas não afirmar que reexecutou os testes. |

Depois da correção, o ensaio real 3A fechou **49/49**; UI **9/9**, Web **126/126**, banco **31/31**, qualidade **44/44**, TypeScript, lint e build aprovados. As suítes se sobrepõem. A função SQL foi aplicada exclusivamente ao banco Docker local.

## Auditoria independente — ciclo 2 e veredito

O [Grok recebeu ambos os anexos](https://grok.com/c/09f0736a-8441-4004-9146-ced41d7765d9): `Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo2.zip`, SHA-256 `21a634d04216de94e7e2fe8680800ebc9878ee7e8a936caf646e2d248f6d3c18`, **48 entradas**, e seu recibo externo. Conferiu hashes do manifesto sem divergência e declarou inspeção passiva, sem executar projeto, SQL, Auth, testes ou rede. O parecer integral está em `04_BANCO_E_SUPABASE/laboratorio-marco-3a/parecer-grok-ciclo2.md`; o texto original, sem a quebra de linha final adicionada pelo arquivo, tem SHA-256 `b4bb8451aae7ec3a8a150a89260aad718fb3837e1ecdd6c5c5941d63f68681f4`.

O parecer confrontou individualmente **F3A-C1-01 a F3A-C1-11**. Confirmou a correção da profissão em branco, considerou encerrada no pacote a principal lacuna RLS após catálogo e leituras HTTP sintéticas, e não encontrou **crítico ou alto confirmado e aberto**. Os testes reais continuam provas produzidas localmente, não reexecução independente pelo Grok. Permanecem: segundo computador físico não ensaiado; zoom sustentado pela aprovação manual; SQL 3A só no laboratório; comparação de obra por nome; janela residual de token/sessão herdada de 2F. A equipe vazia não pode encerrar a sessão de um funcionário ativo, conforme regra aprovada.

Três achados novos, todos baixos, foram confrontados sem terceiro ciclo:

| Achado | Confronto final |
| --- | --- |
| F3A-C2-01, caminho da rede na documentação | **Válido e corrigido neste documento.** A tabela acima identifica `REDE_SANITIZADA.json` dentro do ZIP e `rede.json` bruto apenas no laboratório. |
| F3A-C2-02, `with_check` ausente do resumo RLS | **Lacuna do resumo, não bypass comprovado.** Consulta somente leitura ao catálogo local mostrou `teams_admin_insert` e `teams_admin_update` com `with_check=private.is_admin()`; `epi_employees_admin_write` exige perfil ativo com papel admin. O 3A usa SELECT para o portal; nenhuma política ampla de escrita foi adicionada. Registrar `with_check` em eventual pacote futuro, sem alterar o ZIP auditado. |
| F3A-C2-03, `graphql_public` exposto | **Risco futuro, não vulnerabilidade comprovada.** A configuração é herdada; não houve ensaio GraphQL neste marco. Manter teste de equivalência de RLS como pendência futura, sem mudar configuração nesta rodada. |

## Fechamento formal autorizado

O responsável autorizou em 28/09/2026 o estado **MARCO 3A — MEU PERFIL + MINHA EQUIPE FUNCIONAL EM LABORATÓRIO** e a baseline `METALLO-3A-LAB-20260928-R1`. As provas finais são 3A real **49/49**, UI 3A **9/9**, Web **126/126**, banco **31/31**, qualidade **44/44**, rede **8/8**, TypeScript, lint e build aprovados. São suítes sobrepostas e não devem ser somadas. Não foram reexecutadas apenas para este fechamento.

Meu Perfil apresenta nome, profissão/função, equipe e obra atuais, estado simples de acesso, atalhos pessoais e opções de saída. Minha Equipe apresenta equipe e obra atuais, quantidade de integrantes e apenas nome e função de cada colega; responsável permanece **Não cadastrado** enquanto não existir fonte confiável. O DTO não expõe CPF, ASO, salário, telefone ou e-mail pessoal, endereço, EPI individual, ponto, documentos, informação médica, observações administrativas ou permissões internas. Funcionário ativo sem equipe continua no portal. Equipe inativa, removida ou vínculo ambíguo não revela colegas antigos.

A profissão em branco foi reproduzida com dado sintético, corrigida exclusivamente no SQL do laboratório e validada pelas provas locais. Os pareceres integrais dos ciclos 1 e 2 estão preservados, os 11 achados do primeiro ciclo e os três achados baixos do segundo estão confrontados acima, e não há crítico/alto confirmado aberto no escopo local.

**Estados oficiais:** Marco 0 — fechado tecnicamente; Marco 1A/T05/T15 — concluído e auditado em laboratório; Marco 1B — funcional em laboratório; Marco 1C — Minha Obra funcional em laboratório; Marco 2A — planejamento concluído; Marco 2B — Ponto Experimental Online e Sintético funcional em laboratório; Marco 2C — planejamento concluído; Marco 2D — Recuperação Local e Verificação de Integridade funcional em laboratório; Marco 2E — Revogação, Sessões e Token Residual funcional em laboratório sintético; Marco 2F — fase de endurecimento do ponto experimental sintético encerrada; Marco 3A — Meu Perfil + Minha Equipe funcional em laboratório.

**Limites e riscos preservados:** segundo computador físico não ensaiado; aprovação de zoom 200% manual; contrato SQL 3A aplicado só no laboratório e ainda fora das migrations de promoção; comparação de obra por nome; janela residual de token/sessão herdada de 2F; teste GraphQL de equivalência RLS futuro. A fase de ponto permanece congelada. Supabase remoto intocado. Sem publicação, funcionários reais, produção, ponto oficial ou REP-P. **SIMULAÇÃO SEM VALOR OFICIAL.**

**Próxima direção apenas recomendada:** Marco 3B — Meus EPIs, para consulta pessoal dos próprios EPIs e histórico pertinente usando a identidade e segurança existentes. Não iniciar neste fechamento.

## Recibo externo da baseline 3A

A baseline aprovada `METALLO-3A-LAB-20260928-R1` está em `outputs/Metallo-Marco3A-BaselineAprovada-20260928-R1.zip`, SHA-256 `907e26c0b51fdd781a2233a03782c31349630ab3e9dc61e5f96ada0005d52c4a`. O ZIP contém **75 entradas**: **74 arquivos inventariados e o próprio manifesto**, com **35 itens novos/alterados** no delta desde 2F. O manifesto também lista 55 entradas da origem referenciadas, mas não embutidas; entre elas estão dois testes antigos com o IP Ethernet usado como fixture negativo. Seus bytes continuam preservados na baseline 2F, que permaneceu com SHA-256 `5b7b50ddf9385b58731b84852d54626c9893d0a812151e4e7cd157b568b34097`. O ZIP histórico do ciclo 2 também permaneceu com SHA-256 `21a634d04216de94e7e2fe8680800ebc9878ee7e8a936caf646e2d248f6d3c18`.

O scan executado **diretamente no ZIP final** examinou **1.313 itens**, incluindo conteúdo aninhado, com **zero achados**. O recibo externo está em `outputs/Metallo-Marco3A-BaselineAprovada-20260928-R1.zip.verificacao.json`; o arquivo `.sha256` fica ao lado. Todos os hashes e tamanhos do inventário interno conferiram, os pareceres dos dois ciclos e o documento de confronto estão no ZIP, e não há o IP Ethernet conhecido, `rede.json` bruto, ZIP de origem aninhado ou arquivo de credenciais. Este recibo foi acrescentado ao documento vigente **após congelar o ZIP**; o manifesto e o recibo externo identificam os bytes da baseline, evitando autorreferência.
