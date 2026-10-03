# Marco 1C — Obras: consulta pessoal da obra atual no laboratório

## Referência e limites

Partida obrigatória: baseline imutável `METALLO-1B-LAB-20260927-R2`, ZIP SHA-256 `f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be`. Este marco é uma alteração posterior no checkout e no laboratório, sem reescrever R1/R2. Somente leitura pessoal, sem Supabase remoto, produção, publicação, ponto, REP-P ou novo módulo adjacente.

## Investigação do modelo antes de SQL

- `public.epi_employees` identifica o funcionário e possui `team_id` opcional desde a decisão de equipe opcional. A coluna é o vínculo de equipe do cadastro, não uma FK direta para obra.
- `public.employee_assignments` guarda `employee_id`, `team_id`, `starts_at`, `ends_at` e nota operacional. Uma linha com `starts_at <= now()` e `ends_at` nulo ou futuro é vigente. O comando de Gestão `assign_employee` encerra alocações anteriores antes de inserir a nova, mas a tabela não possui constraint que proíba sobreposição por escrita privilegiada.
- `public.teams.worksite_id` é a associação atual da equipe à obra; é opcional e pode mudar por `link_team`. `public.worksites` contém somente `id`, `name`, `stock_team_id`, `active` e metadados administrativos. Não há rótulo de localização pessoal seguro a retornar. Uma obra pode ter várias equipes; uma equipe aponta a no máximo uma obra por vez.
- O helper operacional `employee_work_team` escolhe a alocação vigente mais recente ou a equipe do cadastro. O repositório EPI do Mobile usa a mesma precedência. Esse helper recebe ID arbitrário e já nega contas do portal; não será usado pelo cliente pessoal.
- O histórico de obra não é imutável: `employee_assignments` registra equipe, enquanto `teams.worksite_id` é mutável. Portanto uma alocação antiga não permite afirmar com segurança a obra histórica. Minha Obra não mostrará histórico.
- Catálogo local inspecionado em 27/09/2026: 178 funcionários sintéticos, 25 alocações (15 temporalmente vigentes), 83 equipes e 15 obras ativas. Nenhum funcionário tinha mais de uma alocação vigente, mas nenhuma equipe ativa estava ligada a obra ativa no estado observado. Os testes 1C exigem vínculos sintéticos próprios.

### Fonte de verdade e regra conservadora

Para o portal, uma única alocação temporalmente vigente define a equipe operacional; a obra só aparece se essa equipe e a obra associada estiverem ativas. Se não existe **nenhuma** alocação histórica, `epi_employees.team_id` pode definir a obra atual, sob os mesmos filtros de atividade. Se há histórico mas nenhuma alocação vigente, não se presume obra anterior nem se volta automaticamente à equipe de cadastro. Alocações vigentes concorrentes são ambíguas e não produzem DTO pessoal. Uma equipe ausente no cadastro não impede obra via alocação vigente. Equipe ou obra inativa não derruba o login; apenas suprime a obra.

Esta regra é específica da leitura pessoal e não muda `employee_work_team`, permissões da Gestão nem o significado de `can_operate(permission, NULL)`.

### Contrato e decisão de segurança

Contrato pretendido: RPC sem argumentos de identidade `public.my_current_work()` retornando zero ou uma linha com **somente** `work_id` e `work_name`. A identidade nasce de `auth.uid()` e exige conta portal registrada, vínculo de identidade ativo, perfil de Gestão inativo e funcionário ativo. Zero linhas significa sem obra, identidade revogada/inativa ou associação inativa; a UI só é mostrada após `my_employee_profile()` validar o acesso pessoal.

RLS invoker simples exigiria ampliar grants/policies de `private.employee_identity`, `employee_assignments`, `teams` e `worksites` hoje fechados ao portal. A opção de menor alteração na superfície existente é uma função pessoal `SECURITY DEFINER` sem argumentos, com `search_path` vazio, nomes qualificados, `PUBLIC`/`anon` sem `EXECUTE` e somente `authenticated` com `EXECUTE`. O contrato será ensaiado com JWTs reais João/Maria e enviado a auditoria adversarial somente leitura antes de qualquer aprovação de nova baseline. A documentação oficial recomenda evitar funções `SECURITY DEFINER` em esquema exposto; esta exceção segue o padrão pessoal já auditado do 1A e exige auditoria independente específica.

## Implementação local e interface

- Migration `20260927124559_personal_current_work.sql`: `my_current_work()` sem argumentos, `SECURITY DEFINER`, `search_path` vazio, nomes qualificados e `EXECUTE` somente para `authenticated`. Aplicada exclusivamente ao banco Docker do laboratório. `db lint --local --schema public,private --level error` não encontrou erro. Não houve comando remoto de migration, `db push` ou reset.
- O retorno é somente `work_id` e `work_name`. A função começa em `auth.uid()` e exige conta dedicada registrada, identidade ativa, perfil de Gestão inativo e funcionário ativo. A equipe vigente única ou, sem histórico de alocação, a equipe do cadastro define o vínculo com obra ativa. Uma alocação encerrada não mostra obra antiga.
- O cliente existente de portal aceitou somente a nova rota RPC no host `127.0.0.1:54321`, sem parâmetros de identidade. O parser do DTO recusa campos extras, mais de uma obra, nome vazio ou ID inválido. A tela existente `/colaborador/obra` passou a consultar esse contrato após validar o perfil. Loading, obra, vazio, erro/repetição e perda de sessão têm apresentação própria; nenhuma obra é guardada fora do estado do componente. A tela mantém a marca Metallo e o selo **AMBIENTE DE TESTE**.
- Após a aprovação manual da prévia, o nome visível da aba, do acesso rápido e do título passou de **Minha Obra** para **Obras**. Dentro dela, **Obra atual** continua identificando o único vínculo vigente exibido. A rota e o contrato pessoal permanecem os mesmos. O histórico não é mostrado porque a relação atual entre equipe e obra pode mudar e não permite reconstruí-lo com segurança. Os testes locais das duas telas envolvidas passaram **28/28** e a Web completa **108/108** após o ajuste de texto. A prévia no navegador exibiu **Obras**, **Obra atual** e a obra sintética de João.
- O ensaio no navegador com João sintético mostrou somente **Obra Sintética 1C João**. Ao desligar a pilha, a obra desapareceu e a página de Login continuou acessível. Uma checagem de saúde estritamente local apresentou **Não foi possível conectar ao laboratório. Tente novamente.** já na abertura do Login, sem nova tentativa de autenticação; o mesmo erro aparece na tentativa de entrar. A correção local no hook conserva o aviso ao perder a conexão durante uma rota pessoal. O laboratório foi religado. Evidências: `marco-1c/minha-obra-preview.png` e `marco-1c/minha-obra-offline.png`.

## Provas e regressão em 27/09/2026

| Escopo | Resultado | Evidência/limite |
| --- | ---: | --- |
| Marco 1C, Auth/JWT/PostgREST reais e SQL pessoal | **45/45** | `marco-1c/resultado-real.json`; os 39 checks originais permanecem e foram acrescentadas seis leituras diretas sem filtro de `worksites`, `teams` e `employee_assignments` com JWTs de João e Maria. Todas devolveram HTTP 200 com zero linhas. A origem de cada requisição agora é registrada e o check final exige loopback. Suíte separada. |
| Unidade/UI Minha Obra | **11/11** | `colaborador-obra.test.tsx`; loading, vazio, erro, troca de conta, logout, remount e aviso offline sem sessão. |
| Portal 1B existente | **39/39** | 17 prévia + 22 guardas, incluídos na Web completa. |
| Auth real existente | **18/18** | `marco-1c/auth-real.json`; JWT local de 60 s temporário e restauração byte a byte a 3600 s. |
| Base histórica 1A/T05/T15 após 1C | **683/683** | `marco-1c/base-real.json`; os **682** cenários históricos seguem presentes e a enumeração dinâmica acrescentou um cenário para `my_current_work()`. Não reescreve o resultado **682/682** da R2. |
| Banco / qualidade | **31/31 / 44/44** | `marco-1c/banco.tap` e `qualidade.tap`. |
| Web completa / TypeScript / lint | **108/108 / passou / passou** | `marco-1c/web-completa.json`; 97 da R2 + 11 novos. |
| Rede local | **8/8** | `marco-1c/rede.json`; listeners e bindings em loopback, Ethernet negativa e rede Docker separada com controle positivo. Inclui prévias 3101/3102. |
| Replay de esquema em banco temporário | **6/6; zero diferenças** | `marco-1c/replay-migrations.json`; baseline mais cinco migrations, incluindo 1C, reproduziram colunas, funções, policies, constraints, triggers e grants do laboratório ativo. O banco temporário foi removido. |

`GET /colaborador/obra/<id>` retornou **404**. `GET /colaborador/obra?employee_id=<id>` continuou na mesma tela (**200**); a página não lê esse parâmetro, e o contrato RPC não o aceita. No PostgREST real, `employee_id`/`work_id` extras foram recusados e filtros por ID alheio não devolveram linha. Testes usaram apenas contas e obras sintéticas. Os testes de logout/troca de aba verificam remoção da obra anterior antes da nova leitura.

Após o primeiro parecer independente, o ensaio 1C foi ampliado para consultar diretamente, sem filtro e sem o cliente oficial, as três tabelas administrativas com cada JWT portal. João e Maria receberam zero linhas em todas as seis consultas. O antigo check chamado “rede do ensaio somente loopback” inspecionava apenas o `pathname` e não demonstrava a origem; agora cada chamada registra `origin` e o check exige `http://127.0.0.1:54321`. A suíte de isolamento de rede **8/8** continua sendo a prova separada de bind e alcance. Nenhuma migration ou política foi alterada nesta correção de prova.

A primeira execução da regressão histórica registrou **682/683**: o inventário dinâmico classificou a nova RPC como função que deveria ser negada. A fixture usava equipe central sem obra; a expectativa foi atualizada para exigir resposta vazia, preservando a verificação. Reexecução **683/683**. Dois falsos negativos iniciais da nova suíte UI vieram de um roteador mockado com identidade instável; o mock foi alinhado ao roteador estável já usado na suíte 1B, sem remover asserções. O ensaio no navegador revelou que o erro de conexão se perdia em uma rota pessoal; o hook foi corrigido. A checagem de saúde local foi acrescentada para exibir a indisponibilidade também sem sessão; a suíte Auth teve 18 casos individuais verdes, mas seu controle final inicialmente rejeitou a nova rota `/auth/v1/health`. Esse controle foi ampliado somente para as rotas pessoais locais exatas e a suíte inteira passou **18/18**, inclusive o controle final de tráfego.

## Arquivos e organização

- **Novos com responsabilidade própria:** migration SQL; componente `minha-obra.tsx`; suíte `colaborador-obra.test.tsx`; executor e evidências em `laboratorio-marco-1a/marco-1c/`; este documento técnico 1C; pacote ZIP de auditoria em `outputs`.
- **Atualizados/reutilizados:** cliente e hook do portal 1B, rota existente e CSS da tela, um teste de texto da prévia, executores históricos para guardar resultados 1C em diretório separado, wrapper Auth, sonda de rede e replay de migrations em banco temporário. Nada foi movido entre as pastas 01–07. Nenhuma nova tabela, serviço administrativo ou arquitetura paralela foi criada.
- R1 e R2 permanecem fotografias imutáveis. Conferência final do ZIP R2: SHA-256 `f44ca13e4a1096f855f0fc566f19b7aa670c28047094636ac61c61b3493e60be`. O ZIP 1C preparado é **pacote de revisão**, não baseline aprovada.

## Auditoria independente e confronto

A função pessoal `SECURITY DEFINER` e o grant novo exigem confronto adversarial antes de propor aprovação do 1C. O pacote `Metallo-Marco1C-MinhaObra-Auditoria-20260927-R2.zip`, SHA-256 `6518f5bb0069e5ce71b94ebe27c269913c3b6f9e2c2907eef50bb8c537ad58da`, foi enviado ao Grok na [conversa de auditoria 1C](https://grok.com/c/d9d29ab7-8593-45c0-8377-bea275092786). O parecer inicial não encontrou quebra de titularidade comprovada, mas pediu evidências ausentes, a baseline 1B, captura visual atual e consulta direta sem filtro às tabelas administrativas. Também identificou que o check de origem no ensaio 1C tinha nome mais forte que sua asserção. O parecer relatou uso de comandos para inspeção local do ZIP no ambiente do Grok, apesar do pedido textual de não executar comandos; não há indicação de SQL, Auth, rede do laboratório ou alteração do projeto por esse parecer.

O pacote complementar `Metallo-Marco1C-MinhaObra-Auditoria-20260927-R3.zip`, SHA-256 `48f650192709297178e7070d6be46708eaadd252e04c1ad4e51d39812ae7ca00`, reúne os artefatos integrais de execução que faltavam no ZIP R2, a suíte 1C corrigida **45/45** e o documento vigente. Ele passou pela varredura de segredos e possui manifesto SHA-256. A baseline saneada 1B R2, imutável, foi fornecida separadamente para confronto byte a byte. A captura `minha-obra-preview.png` do ZIP é anterior somente à troca do rótulo; a tela atual **Obras / Obra atual** foi enviada como `clipboard.png` na mesma conversa, exibindo apenas João e obra sintéticos.

O retorno HTTP 200 com array vazio ao chamar a RPC com access token anterior à revogação é o comportamento comprovado do laboratório: não entrega a obra, enquanto refresh e novo login são recusados. Esse resultado demonstra bloqueio de dados pessoais, não invalidação criptográfica instantânea do JWT. A política de expiração/invalidação imediata para produção fica como decisão futura e não autoriza implantação. O risco de `SECURITY DEFINER` em `public`, o apagamento privilegiado de histórico e o logout local seguem registrados como residuais; nenhum deles foi demonstrado como acesso João↔Maria.

Pedido de confronto complementar, somente leitura:

> Confronte, em SOMENTE LEITURA, seus achados F1–F9 com o ZIP complementar R3, a baseline saneada 1B R2 anexada separadamente e a captura atual da aba Obras. O R3 inclui os JSON/TAP antes ausentes, o teste 1C ampliado para **45/45** e a prova direta sem filtro de `worksites`, `teams` e `employee_assignments` com João/Maria. Confirme hashes e classifique cada achado como resolvido, residual aceito, hipótese pendente ou vulnerabilidade comprovada, citando arquivo/linha/evidência. Não some suítes sobrepostas, não declare 1C baseline aprovada e não execute SQL, testes, Auth, chamadas de rede ou alterações no projeto/remoto.

### Resultado do confronto complementar

O Grok conferiu os hashes do pacote R3 e da baseline 1B R2, leu os resultados e a captura vigente e classificou os nove achados iniciais:

| Achado | Situação após o R3 |
| --- | --- |
| F1 — evidências dos placares ausentes | Resolvido: JSON/TAP presentes e contagens internas coerentes; o auditor não reexecutou testes. |
| F2 — baseline 1B apenas citada | Resolvido: ZIP R2 recebido com SHA-256 exato; o delta 1C não está nele. |
| F3 — captura com rótulo antigo | Resolvido pela captura atual **Obras / Obra atual** enviada na conversa. |
| F4 — check de origem fraco | Resolvido: origem registrada em cada chamada e **8/8** de rede como prova separada. |
| F5 — JWT anterior à revogação retorna 200 e vazio | Residual documentado do laboratório; sem dado pessoal, refresh e novo login recusados. Política de produção ainda não decidida. |
| F6 — tabelas administrativas sem filtro | Resolvido no recorte: seis consultas diretas com JWT portal retornaram zero linhas; matriz histórica de 30 tabelas por titular confirma. |
| F7 — `SECURITY DEFINER` em `public` | Residual documentado, com grants e fonte conferidos; exige auditoria em mudanças futuras. |
| F8 — apagamento privilegiado do histórico | Hipótese pendente do modelo operacional, sem exploração por conta portal demonstrada. |
| F9 — logout local | Evidência do laboratório resolvida pelo Auth **18/18**; política de sessão em produção permanece decisão futura. |

O parecer complementar não encontrou falha crítica/alta nem quebra de titularidade João↔Maria. Sua conclusão é **coerência das evidências**, não segunda execução independente, aprovação de baseline 1C ou autorização de publicação. O Grok usou comandos de inspeção de ZIP/arquivos em seu próprio ambiente apesar do pedido textual de não executar comandos adicionais; informou não ter executado SQL, Auth, testes ou rede do projeto. Essa limitação metodológica fica registrada, sem presumir alteração local ou remota.

Após o confronto, o fluxo recorrente aprovado pelo responsável foi registrado em `AGENTS.md`: avaliação manual da prévia, pacote saneado, envio ao Grok somente leitura e confronto dos achados. Essa instrução de processo é posterior ao ZIP R3 e não modifica código, SQL ou resultados de teste do Marco 1C.

## Fechamento formal do Marco 1C em laboratório — 27/09/2026

O responsável aprovou visualmente a tela **Obras / Obra atual** no estado atual e autorizou expressamente este fechamento. O contrato é pessoal e somente leitura: `my_current_work()` resolve o titular por `auth.uid()`, sem `employee_id` do cliente, e entrega no máximo `work_id` e `work_name`. João e Maria permanecem isolados, sem leitura direta das tabelas operacionais de obras, equipes e alocações. Vínculos encerrados ou ambíguos falham de forma segura. Funcionário ativo sem obra continua no portal; funcionário inativo ou com vínculo/identidade revogados não obtém obra pessoal. O cliente offline não usa fallback remoto.

Os resultados finais aplicáveis são **1C Auth/JWT/PostgREST 45/45**, **Web completa 108/108**, histórico 1A/T05/T15 **683/683** (preservando o placar original R2 **682/682**), Auth do portal **18/18**, banco **31/31**, qualidade **44/44**, rede **8/8** e replay de schema **6/6 sem diferenças**. Nenhuma falha crítica ou alta permanece aberta no escopo local 1C. A auditoria independente Grok foi concluída e os nove achados F1–F9 foram confrontados; lacunas de evidência sanadas e nenhuma evidência de acesso João→Maria ou Maria→João. O auditor usou comandos passivos de leitura/extração de ZIPs em seu ambiente apesar do prompt inicial proibir comandos, e informou que não executou SQL, testes, Auth, rede ou scripts do projeto. Esse detalhe metodológico não invalida o parecer. O [confronto e seus artefatos](https://grok.com/c/d9d29ab7-8593-45c0-8377-bea275092786) permanecem referenciados acima.

Riscos futuros preservados, sem solução nesta rodada: **F5** revogação/token residual; **F7** função privilegiada `SECURITY DEFINER`; **F8** apagamento administrativo de histórico; **F9** política de logout em produção. Esses temas exigem decisão e ensaios próprios antes de implantação, sem bloquear o fechamento local aprovado.

Prompt para futuras auditorias: permitir **inspeção passiva de arquivos e ZIPs**, inclusive extração e cálculo de hashes por comandos de leitura no ambiente do auditor; proibir execução do projeto, SQL, testes, Auth, chamadas à rede do laboratório e qualquer mutação local ou remota. Ver `AGENTS.md` para o fluxo recorrente.

**Estado oficial: MARCO 1C — MINHA OBRA FUNCIONAL EM LABORATÓRIO.** Baseline aprovada `METALLO-1C-LAB-20260927-R1`, gerada a partir da R2 imutável com inventário e relação de mudanças no manifesto. R1/R2 do Marco 1B permanecem intactas. **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO; NÃO É PONTO OFICIAL; NÃO É REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Nenhum módulo seguinte foi iniciado.

O ZIP de auditoria preparado às 11h36 de 27/09/2026 antecede a troca do nome visível e permanece como evidência da rodada anterior. As revisões `-R2` e `-R3` preservam a cadeia de confronto sem alterar a baseline imutável do Marco 1B.
