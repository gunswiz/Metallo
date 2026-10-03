# Confronto da auditoria final e decisão do Marco 1A

## Atualização vigente — 27/09/2026

**27/09/2026 — MARCO 1B — FUNCIONAL EM LABORATÓRIO.** Fechamento formal autorizado pelo responsável nesta conversa após aprovação manual da interface atual, incluindo cores e logo Metallo. Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados em laboratório. Documento vigente do fechamento: relatório27. Não é autorização de implantação ou publicação. A guarda de logout posterior ao segundo parecer foi validada localmente; não recebeu terceira revisão independente. O encerramento autorizado mantém esse limite documentado.

O parecer original **PARECER_AUDITORIA_T15_REVISAO_FINAL_20260927.docx**, preservado no laboratório, aceitou o fechamento técnico local do T15 sem novo crítico/alto. O responsável autorizou posteriormente o **Marco1B funcional exclusivamente local com Auth do laboratório**. Marco0 técnico e Marco1A/T05/T15 permanecem concluídos no limite auditado; nenhuma fundação SQL foi alterada nesta rodada. A implementação, provas, pacote1B e pendências estão no [relatório27 vigente](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). As seções abaixo são histórico T15 e anteriores; proibições antigas de Auth1B e contagens Web67/71 referem-se àquelas fotografias. Remoto e produção continuam não autorizados.


## Histórico — fechamento local T-15 — 26/09/2026

**T-15: critérios locais comprovados, gate real682/682; nova auditoria independente pendente.** Marco0 permanece fechado tecnicamente; o parecer independente preservou o encerramento restrito da base412 e aceitou o contrato pessoal da delta547. Esta rodada atende T-15, concorrência e roteador EPI; será entregue a nova revisão independente antes de qualquer avanço. **Marco1B somente visual. NÃO IMPLANTAR.**

**Supabase remoto intocado**, sem nova leitura ou escrita remota. Sem funcionários reais, Auth real do produto1B, ponto ou REP-P. O parecer recebido é fonte de análise; as ações desta rodada foram autorizadas pelo responsável em sua solicitação. Arquivo original: `PARECER_AUDITORIA_DELTA_EQUIPE_OPCIONAL_T05_20260926.docx`, preservado no laboratório. SHA-256: `d779defe4a7f863f8fdd9c65e6b4fe0511c16b6109894c27344eb78ef5627697`.

### Causa T-15 e confronto com a reprodução

As quatro policies passavam a equipe do funcionário a `can_operate('epi:write', e.team_id)` sem condição local explícita de não nulidade. O helper interpreta NULL como verificação de capacidade sem recorte. Esse significado é legítimo em outros módulos e foi mantido.

**A exploração descrita como confirmada no parecer não foi reproduzida no catálogo T-05 vigente.** Antes da nova migration, GET de itens/kits/acknowledgements do funcionário sem equipe já retornava200/[]; INSERT de ack era403/42501; PATCH/DELETE de linhas existentes retornavam200/[], sem alteração. A subconsulta `EXISTS` também estava sujeita à RLS de `epi_employees`, que T-05 já restringira. Não se desabilitou RLS, firewall ou qualquer controle para fabricar uma exploração. Evidência real: `resultado-t15-before.json`, **90 requisições, 117 verificações aprovadas**, cinco atores, três estados de equipe e fingerprints.

Classificação confrontada: **expressão sem guarda explícita confirmada; ampliação efetiva de acesso não confirmada nos ensaios anteriores à correção; dependência transitiva da policy de epi_employees confirmada**. A severidade Média do parecer é preservada como classificação original. A solicitação de proteção explícita foi implementada, eliminando a dependência exclusiva de outra policy para o casoNULL. Isso não muda a constatação histórica do exploit T-05 de cadastro/fechamento, que foi reproduzido e corrigido na rodada anterior.

### Migration e policies

Nova migration incremental: `04_BANCO_E_SUPABASE/supabase/migrations/20260926233500_personal_epi_explicit_team_scope.sql`. Aplicada **somente no laboratório**, sem editar1A, optional_team ou T-05 já auditadas.

| Tabela real | Policy alterada | Regra |
| --- | --- | --- |
| epi_employee_items | epi_employee_items_read | admin ativo OU funcionário com equipe não nula e permissão dessa equipe |
| epi_employee_item_sets | epi_employee_item_sets_read | mesma condição explícita |
| epi_monthly_acknowledgements | epi_ack_read | mesma condição explícita |
| epi_monthly_acknowledgements | epi_ack_write, FOR ALL | mesma condição no USING e WITH CHECK |

As duas policies admin_write de itens/sets permanecem intactas; as seis policies efetivas dessas três tabelas estão em `policies-t15-efetivas.sql`. `can_operate` e `my_employee_profile` têm corpos idênticos antes/depois em `mapa-t15.json`. Nenhum grant, FK/CASCADE, trigger, DTO ou regra administrativa foi modificado. INSERT/UPDATE de ack são conferidos também pelo WITH CHECK; UPDATE não pode transferir uma linha própria a um funcionário fora do escopo.

### Matriz real GET POST PATCH DELETE

Os atores usam Auth e JWT reais no PostgREST local. As fixtures são linhas existentes criadas administrativamente. Engenheiro, líder e collaborator possuem `epi:write` com lista explícita da própria equipe; a conta portal de Maria tem perfil Gestão inativo.

| Ator / funcionário | GET itens, sets e ack | POST ack | PATCH/DELETE ack existente |
| --- | --- | --- | --- |
| Não-admin restrito / próprio | 200, uma linha própria por tabela | 201, uma linha | 200, uma linha alterada/removida |
| Não-admin restrito / outra equipe | 200, zero linhas | 403/42501 | 200, zero linhas |
| Não-admin restrito / sem equipe | 200, zero linhas | 403/42501 | 200, zero linhas |
| Admin / três estados | 200, uma linha por tabela | 201, uma linha | 200, uma linha |
| Portal / três estados | 200, zero linhas | 403/42501 | 200, zero linhas |

As90 requisições são45 GET e45 escritas de ack. Somadas às27 verificações de fingerprints, formam117 checks. A rodada posterior acrescenta **duas tentativas PATCH de employee_id** (próprio→outra equipe e próprio→sem equipe):403/42501, duas respostas e dois fingerprints, total4 checks. O alvo próprio existe e o mês escolhido não colide com outra fixture; não se confunde erro de unique constraint com autorização negada.

### Fingerprints e auditoria

Cada tentativa de escrita não autorizada registra contagem e SHA-256 antes/depois em **11 tabelas**: epi_employee_items, epi_employee_item_sets, epi_monthly_acknowledgements, epi_deliveries, epi_stock_batches, epi_requests, employee_identity, employee_identity_audit, employee_portal_accounts, profile_access_audit e site_operation_receipts. Zero alteração nas comparações negadas. Não há trigger de auditoria próprio de acknowledgement introduzido nesta rodada; foram preservadas e conferidas as auditorias que já existem.

GETs precedem o primeiro fingerprint posterior (POST negado) do mesmo ator/estado; nenhuma consulta gravou dados. Controles positivos podem alterar fixtures, mas cada tentativa negada usa seu próprio estado anterior; reposição de fixtures acontece fora dessas comparações. Resultados detalhados em `resultado-t15-after.json`.

### Concorrência real com dois clientes

Dois cenários distintos, com UPDATE de equipeNULL aberto pelo cliente A e requisição B por JWT/PostgREST:

1. **Entrega após desvinculação:** funcionário inicialmente de outra equipe, usuário restrito à própria. A segura a linha; B tenta register_epi_delivery e espera. Após commit de A, a equipe éNULL e B recebe403/42501 unassigned_employee_admin_required.
2. **Fechamento após desvinculação:** funcionário inicialmente na equipe autorizada, com entrega histórica de outra equipe. A retira a equipe; B chega à guarda de fechamento e espera o FOR SHARE. Após commitNULL, B recebe o mesmo403/42501 e a entrega permanece active.

Em ambos, `pg_stat_activity.wait_event_type=Lock`, `wait_event=transactionid` e `pg_blocking_pids` apontaram o PID de A; B estava pendente antes do commit. O cliente A terminou com exit0, o desvínculo foi confirmado e os fingerprints das11 tabelas ficaram iguais. A alteração intencional da equipe não integra os hashes operacionais, mas seu estado final é conferido separadamente. As conexões são reais e distintas; não é simulação sequencial com SET ROLE em um cliente.

O caso de entrega também encontra FOR UPDATE na RPC; o de fechamento exercita a guarda FOR SHARE. Não se alteraram isolamento, arquitetura ou proteção do Windows. Esta prova cobre esses dois interleavings em READ COMMITTED, não concorrência universal. Timeouts locais dos clientes evitam manter transação aberta; finally encerra/reverte o cliente A em falha.

### Roteador run_site_operation

`deliver_epi` e `close_epi` foram chamados com o actor_id correto, operation_id novo e timestamp válido. Funcionário com equipe-baseNULL e **alocação operacional explícita**: engenheiro restrito recebe403/42501 em ambos; admin recebe200 em ambos, preservando o comportamento anterior. A alocação é precondição do controle positivo para fornecer a equipe operacional da entrega; nenhuma regra administrativa nova foi criada para entrega sem qualquer destino operacional.

São4 respostas +2 comparações de fingerprints (6 checks). As tentativas negadas não deixaram recibos parciais em site_operation_receipts nem baixaram estoque. Os demais comandos desse roteador não são declarados cobertos por estes dois ensaios. Nenhum comando de ponto foi implementado.

### Regressão e suítes

A-13 permanece68/68: João e Maria, quatro estados, JWT existente, novo login e refresh, quatro campos exatos sem ASO/CPF e cruzamentos vazios. P3 permanece13/13, incluindo João sem equipe revogado; funcionário inativo continua sem DTO. A correção só em policies da Gestão não altera a função pessoal. A prévia continua mostrando **Sem equipe atribuída** em Meu Perfil/Minha Equipe, sem logout por team_nameNULL; os13 casos UI são mocks.

| Suíte atual | Resultado |
| --- | --- |
| Gate real completo | **682/682**, sem falhas |
| T-15, incluído no gate | 135/135:117 matriz/fingerprints +4 troca deID +6 roteador +8 concorrência |
| Banco | 31/31 |
| Qualidade, inclui banco | 44/44 |
| Prévia visual | 13/13 |
| Web completa, inclui prévia | **67/71**, mesmas quatro falhas |
| Replay | 6/6, agora incluindoT15; seis categorias iguais, deltas idempotentes, banco temporário removido |
| Rede e cleanup | **8/8**, posterior ao gate; pilha parada, zero listeners/sondas |

O117 anterior não é somado ao gate atual. As682 verificações executadas são547 anteriores **reexecutadas** +135T15. Banco/qualidade e prévia/Web se sobrepõem. Os quatro fullName Web e os hashes das fontes da Gestão conferem com o pacote547: duas falhas de formulário, contrato de substituição de locado e tipografia, conforme backlog31. Nenhuma foi causada por esta rodada ou removida/enfraquecida.

### Critérios de fechamento local T-15

Todos os critérios solicitados foram comprovados no envelope ensaiado: não-admin sem equipe não lê itens/sets/ack; não cria/edita/exclui ack; própria equipe funciona e outra equipe permanece negada; admin preserva comportamento; portal continua isolado; fingerprints iguais; duas transições concorrentes não abriram acesso; nenhuma vulnerabilidade crítica/alta nova foi identificada nos ensaios. **T-15 fechado tecnicamente no laboratório, aguardando revisão independente; isso não libera1B funcional.**

Rede8/8 final em26/09/2026 às23:45:02 UTC, posterior ao gate encerrado às23:42:09. Bind127.0.0.1/::1, loopback positivo, Ethernet negado no host e em namespace Docker separado, com controle positivo; firewall permaneceu ativo. Às23:45:09, zero containers do laboratório/sondas e zero listeners do laboratório. A prévia visual permaneceu em127.0.0.1:3101. Nenhuma mudança de configuração adicional foi necessária. Segunda máquina física e acesso administrativo ao Docker não foram ensaiados.

### Problemas do ensaio corrigidos e preservados

- A fixture PGlite antiga omitia grantsDML de acknowledgement que existem na baseline PostgreSQL. Isso fez o controle positivo falhar antes da RLS. O setup do teste passou a reproduzir os grants já existentes; nenhuma permissão da aplicação real foi ampliada. `banco-t15-fixture-incompleto.tap` preserva o resultado30/31 anterior; a reexecução passou31/31. O teste de troca deID agora realmente alcança WITH CHECK.
- O controle positivo de entrega do admin em T-15 reconciliava automaticamente o pedido que um teste original T-05 ainda esperava pending. O gate registrou1 falha request_not_pending, embora135T15 passassem. Movido o blocoT15 para depois dos68 checks originais, preservando suas precondições e expectativas de403. Resultado intermediário em `resultado-t15-interferencia-fixtures.json`; não é apresentado como gate aprovado nem como vulnerabilidade do produto.

### Organização e entrega

Estrutura01–07 preservada. **Novos arquivos necessários:** migrationT15 para não editar SQL auditado; executar-provas-t15.mjs para matriz REST/fingerprints/roteador; executar-concorrencia-gestao.mjs para coordenar duas conexões sem misturar essa responsabilidade à matriz; mapa e resultados before/after, SQL efetivo e parecer recebido como evidências. Os dois resultados intermediários documentam falhas de ensaio, não relatórios concorrentes.

**Atualizados:** teste existente gestao-equipe-opcional-banco, aplicação de migration no teste de identidade, executor Gestão para chamarT15, replay para incluir a migration, coletor existente para preservar mapa T-05 e gravar o novo mapa separado, gerador de pacote, resultados correntes e documentos vigentes. Nenhuma tela, regra de Auth do produto ou AGENTS precisou de alteração nesta rodada; AGENTS vigente acompanha a entrega.

**Duplicação evitada:** documento30 atualizado em vez de novo relatório; testes/coletores reaproveitados; histórico547, Web e Edge completos referenciados por nome eSHA-256, sem copiar o pacote inteiro. Novo ZIP pequeno: `outputs/Metallo-T15-RevisaoFinal-20260926.zip`, manifesto interno, políticas efetivas, evidências e [prompt SOMENTE LEITURA](29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md). ZIPs anteriores permanecem imutáveis.

Reprodução pelo responsável somente no laboratório: aplicarT15 incremental após as migrations anteriores; executar o gate real com METALLO_TEST_EDGE_FUNCTIONS=1, METALLO_TEST_COMPLEMENTARY=1, METALLO_TEST_MANAGEMENT_SCOPE=1 e METALLO_TEST_T15=after. O modo before só mede o estado que estiver aplicado, por isso a prova anterior preservada deve ser usada como fotografia e não recriada sem reconstrução autorizada. Não executar modoAuth1B. Repetir rede/cleanup ao final. **Auditor somente leitura não executa esses passos.**

## Registro auditado anterior — delta equipe opcional e T-05, 547 provas

O conteúdo abaixo preserva a rodada anterior. Seu estado “aguardando auditoria” foi superado pelo parecer recebido nesta rodada quanto ao núcleo pessoal e T-05 ensaiado. As evidências históricas547 ficam no ZIP anterior; os caminhos correntes de resultados agora recebem a reexecuçãoT15. Para a decisão atual, use a seçãoT15 acima.

## Decisão vigente — equipe opcional e T-05 — 26/09/2026

**Marco 0 fechado tecnicamente. Marco 1A: base de 412 provas concluída em laboratório e auditada independentemente; delta equipe opcional/T-05 comprovada localmente em 547/547 e submetida a nova auditoria. Marco 1B somente visual.** Esta rodada não antecipa o veredito independente sobre a delta. O script `iniciar-previa-1b.ps1` não foi iniciado.

**NÃO IMPLANTAR. SUPABASE REMOTO INTOCADO. SEM FUNCIONÁRIOS REAIS, AUTH REAL DO PRODUTO, PONTO OU REP-P.** Não houve sequer nova consulta remota: a comparação usa snapshots somente leitura já capturados em 26/09. Todo dado de ensaio é sintético; o projeto não está em operação empresarial.

**Regra aprovada:** funcionário ativo + identidade/conta portal ativas conserva o DTO próprio, login e refresh quando a equipe está inativa, ausente ou desvinculada. `team_name=null` é apresentado como **Sem equipe atribuída**. Funcionário inativo ou identidade revogada continua sem DTO. A antiga regra “equipe inativa faz DTO desaparecer” está **SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL.**

### Resultados atuais e fotografias históricas

| Suíte | Resultado | Evidência em laboratorio-marco-1a |
| --- | --- | --- |
| Gate real Auth/JWT/PostgREST/RPC/Edge | **547/547**, nenhuma falha | resultado-provas-reais.json |
| A-13, incluído no gate | **68/68**, 34 por pessoa | auditoria-complementar/resultado-complementar.json |
| Gestão T-05/T-10, incluído no gate | **68/68** | auditoria-complementar/resultado-gestao-equipe-opcional.json |
| Revogação parcial P3, incluída no gate | **13/13** | resultado-complementar.json |
| Banco | **28/28** | auditoria-complementar/banco.tap |
| Qualidade, inclui banco | **41/41** | auditoria-complementar/qualidade.tap |
| Prévia visual com mocks | **13/13** | auditoria-complementar/marco1b.json |
| Web completa, inclui prévia | **67/71**, mesmas quatro falhas | auditoria-complementar/web-final.json; backlog31 |
| Replay PostgreSQL | **6/6**, seis categorias de catálogo idênticas | auditoria-complementar/replay-migrations.json |
| Rede | **8/8**, loopback exclusivo; pilha parada sem listeners | auditoria-complementar/rede-final.json e estado-final.json |

Gate atual: **194 base + 4 dashboard + 279 complementares + 2 preparações Auth P5 + 68 Gestão = 547**. Complementares: P1=186, P2=3, A-09=4, P5=5, A-13=68, P3=13. As suítes sobrepostas não devem ser somadas. Não há skipped/TODO no banco/qualidade nem pending/TODO na Web; o gate registra cada verificação realmente executada. **A Web não está verde.**

O estado **445/445** foi preservado antes de reexecutar em `auditoria-complementar/historico-445/`: 194+4+245+2; grupos P1=186, P2=3, A-09=4, P5=5, A-13=34, P3=13. Inclui JSONs, TAPs, prévia, Web, rede, cleanup e resumo originais. A fotografia **412** permanece nos ZIPs antigos imutáveis; cópia mínima acompanha o novo pacote em `HISTORICO_412`. Nenhuma dessas cópias é contada como teste novo.

## Confronto T-01 a T-14

Fonte: `PARECER_AUDITORIA_EQUIPE_OPCIONAL_POS_1A_20260926.docx`, preservado em auditoria-complementar. SHA-256: `02d787f9a948a7f026c040dad02f028effb6a69b78f72a13ede2c5eec1b783ac`. O parecer é fonte de achados; a autorização de execução é a solicitação do responsável. O auditor anterior inspecionou estaticamente o pacote412 e não recebeu o material445.

| Achado / severidade original | Confronto, ação e resultado |
| --- | --- |
| **T-01 — Alta, lacuna** | **Válido.** Novo ZIP específico inclui 445 histórico, 547 atual, duas migrations, DTO efetivo completo, executores, catálogos, AGENTS, diff Web e manifesto SHA-256. Conferência do conteúdo não equivale a novo parecer independente; aguarda revisão. |
| **T-02 — Média, confirmado** | **Válido na fotografia412.** Catálogo local atual: team_id nullable=YES; snapshot remoto: NO. Divergência intencional. FK existente preservada; não há ON DELETE SET NULL/CASCADE novo. Replay comprova transição. Não recapturado nem alterado remotamente. |
| **T-03 — Média, hipótese** | **Não se confirma na fonte vigente.** DTO mantém SECURITY DEFINER, search_path vazio, zero argumentos, auth.uid(), conta portal, identidade/funcionário ativos, perfil Gestão inativo e LEFT JOIN por ID com active no ON. Corpo efetivo exportado; whitelist exata e linha própria nos oito cenários pessoa/estado. |
| **T-04 — Informativa, confirmado** | **Válido e preservado.** João e Maria separados; chamadas cruzadas filtradas e REST operacional retornam vazio. Manipulação do JWT é recusada; ID extra é erro de roteamento, não alegação de guarda SQL exercitada. |
| **T-05 — Média, confirmado** | **Confirmado dinamicamente e ampliado:** engenheiro com equipe restrita leu funcionário sem equipe e fechou entrega de equipe alheia. Avaliamos impacto **Alto** pela mutação não autorizada de histórico. Corrigido somente no laboratório por três policies e guarda privada de escrita; can_operate idêntica antes/depois. Cinco RPCs negativas 403/42501, fingerprints iguais, matriz e controles positivos aprovados. Ver seção própria. |
| **T-06 — Baixa, confirmado** | **Válido.** Documentos/executor vigentes marcam a regra antiga SUPERADA. JSON412/445 preservados. Gerador histórico atualizar-estados.mjs bloqueado antes de escrever para não reintroduzir decisões antigas. |
| **T-07 — Informativa, confirmado** | **Válido.** Fundação1A auditada não foi editada. Duas migrations incrementais, replay real e reaplicação idempotente dos deltas. Banco temporário removido. |
| **T-08 — Baixa, lacuna** | **Válido.** Contabilidade445 comprovada pelo histórico; 34 nomes listados abaixo. Lacuna de titularidade: estados próprios eram de Maria, embora João participasse dos cruzamentos. Ampliado para 34 por pessoa, total68, sem copiar checks apenas para aumentar número. Nova execução547 passa. |
| **T-09 — Baixa, confirmado** | **Válido no pacote antigo; fonte atual adequada.** Meu Perfil/Minha Equipe mostram Sem equipe atribuída sem logout por team_name nulo. 13 testes com mocks; VISUAL_PREVIEW evita cliente Supabase. Auth futuro fixado em127.0.0.1; sem flags retorna notFound, confirmado por leitura da fonte, sem iniciar produto Auth. |
| **T-10 — Média, confirmado** | **Válido.** Remoção no portal significa desvincular funcionário. Exclusão física somente de equipe sintética sem referências. DELETE de equipe com movement falha por FK e preserva equipe/movimento; nenhuma FK/CASCADE alterada. |
| **T-11 — Informativa, confirmado** | **Válido.** Web67/71, mesmos quatro nomes, mesmas fontes da Gestão. Prévia13/13. As três falhas de integração já existiam neste checkout; tipografia também falha no HEAD. Nenhuma é regressão desta rodada; backlog31 mantém causas e provas. |
| **T-12 — Informativa, confirmado** | **Versão antiga enviada; corrigido no pacote.** AGENTS vigente contém estrutura01–07, leitura manual, reutilização, responsabilidade única, SQL04/documentos05, proibição de arquitetura paralela/reorganização em massa e regra NULL na Gestão. |
| **T-13 — Informativa, confirmado** | **Válido.** DTO exige exatamente employee_id/full_name/profession/team_name, com valores próprios e uma linha, para JWT existente, login novo e refresh nos quatro estados, por pessoa. Qualquer chave extra (ASO/CPF/size/notes/admin) falha. |
| **T-14 — Alta, confirmado** | **Válido como fronteira de implantação. NÃO IMPLANTAR.** Nenhuma mutação ou leitura remota nesta rodada. Auth do produto1B, usuários reais, ponto e REP-P permanecem proibidos. Não é falha Alta aberta dentro do envelope local comprovado. |

## T-05 — mapa, reprodução e correção específica

O mapa foi capturado **antes da alteração** (22:26:47 UTC) e depois (22:47:59 UTC) em `auditoria-complementar/mapa-can-operate.json`. Contém corpos SQL completos, policies, callers, FKs, coluna e referências de fontes. Foram localizados **14 callers SQL e 20 policies** no catálogo efetivo, além da assinatura de tipos compartilhados e referências históricas/migrations. Não existe chamada direta Web/Mobile ao helper fora da assinatura de tipos; o acesso é indireto via RLS/RPC.

- **NULL legítimo — capacidade:** catálogo de itens, variantes, profissões, lotes, motivos e locais, e precondições de operações. `can_operate(permission,NULL)` continua significando capacidade sem recorte. O helper não foi alterado.
- **Equipe explícita:** material/consumo/equipamento/locação/pedidos/transferência têm ID e validações próprias; preservados.
- **NULL derivado do funcionário — risco:** policy epi_employees e alternativas employee_work_team em entregas/alocações; cinco RPCs DEFINER de EPI. Kits/acknowledgements consultam epi_employees sob RLS e passam a herdar sua negação. Pedidos/histórico mantêm sua equipe explícita NOT NULL.

Callers: add_epi_stock_batch, close_epi_delivery_quantity, consume_material, create_equipment_for_team, create_equipment_for_team_v2, create_material_for_team, fulfill_epi_request, register_asset_movement, register_epi_delivery, register_epi_delivery_batch, register_movement, replenish_material, request_epi_item, run_site_operation. Os nomes e expressões das 20 policies estão integralmente no mapa.

**Antes (JWT real, 22:30:00 UTC):** engenheiro restrito à equipe própria recebeu HTTP200 com o funcionário sem equipe; `can_operate('epi:write',NULL)` retornou true; `close_epi_delivery_quantity` fechou uma entrega de equipe alheia, HTTP200, status final returned. Fixture sintética. Essa extensão de impacto justifica tratar a correção antes de qualquer avanço.

**Depois:** migration `20260926224000_unassigned_employee_management_scope.sql` exige equipe não nula para não-admin ler epi_employees. Em deliveries/assignments, a alternativa employee_work_team exige ID não nulo, conservando a equipe explícita histórica. Função privada `guard_unassigned_employee_operation` (search_path vazio, sem EXECUTE ao cliente) guarda INSERT/UPDATE/DELETE em epi_deliveries e epi_requests, inclusive RPCs DEFINER e caminhos indiretos. Confere OLD/NEW, bloqueia equipe nula salvo admin ativo e usa FOR SHARE na linha do funcionário durante a transação. A exceção desfaz toda a operação, inclusive eventual baixa de estoque anterior.

Negativas reais: register_epi_delivery, register_epi_delivery_batch, request_epi_item, fulfill_epi_request e close_epi_delivery_quantity retornam **403/42501 unassigned_employee_admin_required**, com fingerprint de estoque/entregas/pedidos inalterado após cada tentativa. Admin fecha histórico sem equipe; engenheiro autorizado entrega EPI na própria equipe. Regressões PGlite cobrem a mesma guarda com fixture controlada. Não se afirma ensaio concorrente simultâneo nem todas as entradas possíveis do roteador; o bloqueio na tabela cobre suas escritas nessas duas tabelas por construção e requer revisão independente.

| Ator Gestão/API | Funcionário equipe própria | Outra equipe | Funcionário sem equipe |
| --- | --- | --- | --- |
| Admin global ativo | Permite | Permite | Permite |
| Engenheiro, epi:write, equipe restrita | Permite | Nega | Nega |
| Engenheiro padrão da baseline | Permite | Permite | Nega |
| Líder com epi:write e equipe restrita | Permite | Nega | Nega |
| Líder padrão | Nega EPI | Nega EPI | Nega |
| Collaborator Gestão com epi:write restrito | Permite | Nega | Nega |
| Collaborator Gestão padrão | Nega EPI | Nega EPI | Nega |
| Usuário epi:write com lista vazia de equipes | Nega | Nega | Nega |
| Conta portal | Nega REST operacional | Nega REST operacional | Nega REST operacional; DTO próprio continua |

A abrangência global do engenheiro padrão já existe em can_operate na baseline; foi preservada para equipes explícitas. Histórico autorizado pela própria equipe do registro pode continuar visível mesmo se o funcionário ficar sem equipe; isso não abre seu cadastro/ASO nem autoriza mutações não-admin desse funcionário. Alterar tais regras empresariais preexistentes exigiria decisão própria.

## SQL efetivo, replay e limites

- Optional_team contém `ALTER ... DROP NOT NULL` e CREATE OR REPLACE de DTO com `LEFT JOIN public.teams t ON t.id=e.team_id AND t.active`. Não acrescenta employee_assignments, SELECT * ou parâmetro de ID. Grants anteriores preservados.
- Corpo completo pós-migrations: `auditoria-complementar/my_employee_profile-efetivo.sql`; metadados SECURITY DEFINER/search_path/argumentos/retorno também em replay-migrations.json. A migration T-05 não modifica o DTO.
- Replay em banco temporário dedicado do mesmo container, criado vazio para os schemas public/private. Infraestrutura Auth/Storage/roles aproveitada via schema-only da pilha local, sem copiar dados. Recompostos os defaults da CLI antes do histórico; 1A restringe defaults de EXECUTE depois. Aplicados **42 SQLs baseline + dois ajustes de catálogo + 1A + optional_team + T-05**. Colunas, funções/ACLs, policies, constraints, triggers e grants finais idênticos ao banco vivo. Reaplicar os dois deltas conserva o catálogo; banco temporário removido. Não é restauração integral, instalação limpa de Auth nem DR empresarial.
- As tentativas iniciais de replay identificaram permissão de restore de infraestrutura, serialização booleana e perda de default ACL após DROP SCHEMA da cópia; corrigidos no executor sem enfraquecer a comparação. O banco descartável foi removido em cada finally. SQL da aplicação/fundação não foi alterado para forçar equivalência.
- Pós-catálogo versus snapshot remoto distingue a nulabilidade de equipe e três policies locais modificadas, além dos objetos da fundação/trigger T-05. Tipos/fluxos administrativos remotos ainda exigem reconciliação no futuro marco de implantação. Não se autorizou isso nesta rodada.

## A-13 e revogação — cobertura e lista nominal histórica

No A-13 vigente, **Maria e João** percorrem separadamente ativa/inativa/ausente/removida: precondições, DTO próprio com token existente, novo login da pessoa certa, JWT novo, refresh/DTO, negativas cruzadas nos dois sentidos e snapshot de conta/identidade/auditoria/ban igual. Oito verificações por estado + funcionário inativo + restauração = **34 por pessoa**. Nos três tipos de JWT a função de asserção exige uma linha com quatro chaves exatas, valores próprios e team_name esperado.

A identidade revogada não está contada dentro do A-13: é comprovada pela base e por **P3=13**, com João sem equipe, falha de ban após SQL, token antigo sem DTO, refresh intermediário sem acesso, motivo diferente recusado, retry sem duplicar evento, ban e refresh/login negados. Essa separação evita atribuir a A-13 o que pertence a outra prova. Banco ativo/identidade revogada e funcionário inativo continuam bloqueados independentemente da equipe.

Os **34 nomes do JSON445** abaixo são preservados literalmente. O titular dos quatro estados era Maria; João participava das tentativas cruzadas. A nova rodada corrige essa lacuna com estados próprios de ambos, sem atribuir retrospectivamente essa cobertura ao445:

1. ativa: precondicao e identidade ativa
2. ativa: JWT existente preserva DTO minimo proprio
3. ativa: novo login Auth permitido
4. ativa: JWT de novo login recebe perfil proprio
5. ativa: refresh permitido sem perda de perfil
6. ativa: Joao nao le perfil nem ASO do colega
7. ativa: Maria nao le perfil nem ASO do colega
8. ativa: conta identidade auditoria e ban inalterados
9. inativa: precondicao e identidade ativa
10. inativa: JWT existente preserva DTO minimo proprio
11. inativa: novo login Auth permitido
12. inativa: JWT de novo login recebe perfil proprio
13. inativa: refresh permitido sem perda de perfil
14. inativa: Joao nao le perfil nem ASO do colega
15. inativa: Maria nao le perfil nem ASO do colega
16. inativa: conta identidade auditoria e ban inalterados
17. ausente: precondicao e identidade ativa
18. ausente: JWT existente preserva DTO minimo proprio
19. ausente: novo login Auth permitido
20. ausente: JWT de novo login recebe perfil proprio
21. ausente: refresh permitido sem perda de perfil
22. ausente: Joao nao le perfil nem ASO do colega
23. ausente: Maria nao le perfil nem ASO do colega
24. ausente: conta identidade auditoria e ban inalterados
25. removida: precondicao e identidade ativa
26. removida: JWT existente preserva DTO minimo proprio
27. removida: novo login Auth permitido
28. removida: JWT de novo login recebe perfil proprio
29. removida: refresh permitido sem perda de perfil
30. removida: Joao nao le perfil nem ASO do colega
31. removida: Maria nao le perfil nem ASO do colega
32. removida: conta identidade auditoria e ban inalterados
33. funcionario inativo continua sem DTO mesmo sem equipe
34. reatribuicao de equipe ativa restaura nome sem novo vinculo

## Interface, erros de ensaio e quatro falhas Web

Nenhuma interface foi expandida nesta rodada. O diff desde o412 inclui a mudança visual já preparada em colaborador-app.tsx e os quatro casos novos de equipe nula/vazia em colaborador-preview.test.tsx. No código, ausência do DTO pode encerrar sessão; team_name nulo não faz isso. VISUAL_PREVIEW retorna sem criar cliente; URL do caminho Auth preparado é `http://127.0.0.1:54321`; page.tsx chama notFound sem ambas as flags. Os 13 testes são com mocks; leitura estática das flags não equivale a novo servidor de produção. Prévia visual: `http://127.0.0.1:3101/colaborador/perfil` e `/colaborador/equipe`.

- Ensaio inicial T-05 parou por fixture ASO com vencimento sem data do exame. Acrescentada data sintética válida; resultado incompleto preservado em resultado-t05-fixture-incompleto.json.
- Na primeira ampliação A-13, a etapa de João fazia login com credenciais de Maria. **As asserções de titularidade falharam (12 checks)**; não houve aceitação falsa de dados cruzados. Corrigida seleção de credenciais do ator; resultado malsucedido547 preservado em resultado-a13-ator-incorreto.json. Rodada final547 sem falhas. Nenhum desses erros de fixture/executor foi classificado como vulnerabilidade do produto.
- Web **67/71** conserva os quatro nomes exatos: direitos concedidos/alertas ADM; duplo envio/idempotência; substituição de locado; escala tipográfica/foco. Causas e comparação HEAD/checkout estão no [backlog31](31_BACKLOG_GESTAO_QUATRO_FALHAS_WEB.md). As duas primeiras não encontram formulário após mudança preexistente de tela; a terceira espera contrato antigo enquanto ação chama replace_rented_equipment ausente da baseline; tipografia falha também no HEAD. Hashes das seis fontes/testes da Gestão iguais à rodada anterior. Nenhuma falha causada pela delta; nenhum teste removido/enfraquecido. Essa dívida impede afirmar Web aprovada.

## Organização, arquivos e pacote novo

Estrutura01–07 preservada, sem renomear/mover/fundir pastas. **ATUALIZAR > REUTILIZAR > COMPONENTIZAR > CRIAR NOVO** está em AGENTS vigente. Novos arquivos têm responsabilidade distinta:

- **Implementação:** migration incremental T-05 sob04. Optional_team é a migration da rodada445, incluída sem reescrever a fundação.
- **Testes:** gestao-equipe-opcional-banco.test.mjs sob06; executar-provas-gestao.mjs para a matriz real da Gestão; reproduzir-migrations-local.mjs para replay PostgreSQL. Separados para não ampliar indiscriminadamente o executor pessoal existente.
- **Evidências necessárias:** mapa-can-operate.json antes/depois; resultado Gestão; replay-migrations.json; corpo efetivo SQL exportado; parecer original recebido; dois resultados intermediários; histórico445 preservado. Não são novos relatórios concorrentes.
- **Arquivos existentes atualizados:** executores real/complementar, scripts baseline/ajuste para aceitar exclusivamente banco local validado, coletor registrar-investigacao, testes identidade, gerador de pacote, AGENTS e documentos vigentes17–31. Banco/qualidade/Web/prévia/catálogos/rede reutilizam os caminhos de evidência atuais. O gerador documental histórico foi desativado antes de escrever.
- **Web:** somente o delta já existente desde412 é entregue; não houve nova alteração Web nesta rodada de T-05.

Novo pacote: `outputs/Metallo-EquipeOpcional-Pos1A-Auditoria-20260926.zip`; manifesto SHA-256 interno inclui expressamente as duas migrations, DTO efetivo, histórico445 e resultados atuais. Inclui diff Web/AGENTS desde412, resumo e [prompt atual SOMENTE LEITURA](29_PROMPT_SUPERGROK_SOMENTE_LEITURA.md). ZIPs anteriores mantidos e confrontados com seus hashes originais. A varredura de padrões JWT/sb_secret/PEM não é garantia universal; ambientes, dependências, builds e volumes não são incluídos.

### Isolamento e encerramento desta rodada

Rede8/8 em26/09/2026 às22:53:40 UTC, depois do gate547 concluído às22:51:36. Bind real127.0.0.1/::1 nas cinco portas; loopback positivo, Ethernet192.168.0.3 recusado no host e no namespace Docker separado; controle positivo da sonda e firewall ativo. Às22:53:45 a pilha e sondas estavam encerradas, zero listeners54320–54329/8083. A Edge recebeu SIGTERM15 esperado do encerramento. Somente a prévia visual permaneceu em127.0.0.1:3101. Nenhuma configuração adicional de Windows/Docker/firewall precisou ser modificada. Segunda máquina física, Internet e atacante administrador não foram ensaiados.

### Reprodução autorizada exclusivamente no laboratório

Iniciar pelo script que exige Localhost only; baseline só em banco vazio local. Após1A, aplicar optional_team e T-05 no container local; servir Edges locais da CLI2.117.0. Executar executar-provas-reais.mjs com METALLO_TEST_EDGE_FUNCTIONS=1, METALLO_TEST_COMPLEMENTARY=1 e METALLO_TEST_MANAGEMENT_SCOPE=1. Não reduzir os limites do Auth para reexecuções consecutivas; respeitar a janela de rate limit. Replay usa banco temporário próprio. Encerrar com validar-isolamento.ps1, que comprova rede e para a pilha em finally. O endpoint lab-revoke-auth-failure é exclusivamente de ensaio e nunca deve ser implantado. **Auditor somente leitura não executa estes passos.**

Limites mantidos: GraphQL desabilitado (não prova RLS ativo), Storage zero buckets, transporte SQL da revogação não injetado, ausência de segunda máquina física na rede, quatro falhas Web, nenhum produto Auth1B/implantação/uso real. Nenhuma vulnerabilidade crítica/alta permaneceu identificada no envelope ensaiado após a correção; esta conclusão não equivale a ausência universal de falhas e aguarda revisão adversarial da delta.

## Registro histórico da rodada auditada de 412 provas

**As seções seguintes descrevem o pacote anterior auditado.** A decisão pendente de A-13 pertence ao passado. A regra do DTO vazio por equipe inativa está **SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL.** A validação atual está nas547 provas acima. Referências a resultados de 412, Web 63/67 e servidor visual desligado referem-se à fotografia preservada em `outputs/Metallo-Marco1A-ConfrontoFinal-20260926.zip`, não aos arquivos correntes reexecutados. Esse histórico não determina a regra de produto vigente.

## Fonte e método

Parecer original: `PARECER_AUDITORIA_INDEPENDENTE_MARCOS_0_1A_1B_20260926.docx`, fornecido pelo responsável e preservado, com extração textual, em `04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-complementar/`. O documento é fonte de achados; as instruções de execução desta rodada vieram do responsável. O auditor fez leitura estática do pacote anterior, não os novos testes descritos aqui.

Foram confrontados os 14 achados com fontes, catálogo local e evidências reais. Nenhuma conta, migration, função, configuração ou linha remota foi alterada. Nem mesmo a consulta remota foi necessária nesta rodada: referências ao remoto usam o catálogo e evidências somente leitura já salvos em 26/09. Todos os usuários e dados de ensaio são sintéticos. A migration SQL 1A não precisou de alteração nesta rodada.

## Resultados finais e contagem

| Grupo | Resultado | Natureza e evidência |
| --- | --- | --- |
| Gate real 1A ampliado | **412/412**, zero falhas | `resultado-provas-reais.json`, 20:03:06–20:03:38 UTC em 26/09/2026 |
| P1 escrita REST | **186/186 verificações** | 180 POST/PATCH/DELETE + 2 ativações de perfil + catálogo/fixtures e 2 comparações de fingerprints |
| P2 GraphQL | **3/3** | Ausência comprovada do objeto porque `pg_graphql` está desabilitada; não é prova de RLS de um motor GraphQL ativo |
| P3 falha parcial | **12/12** | Edge real, commit SQL real, falha de transporte injetada, retry e Auth reais |
| P4 dashboard | **4/4 checks adicionais** | `works`, `teams`, `employees`, `alerts` vazios; check existente reforçado exige todas as 12 coleções vazias |
| P5 exclusão | **5/5** | Falha fechada, Auth/conta/identidade/auditoria preservados, FKs verificadas |
| A-09 | **4/4** | Provisionamento Gestão real e duas negativas de registro como portal |
| A-13 | **2/2** | Funcionário/vínculo ativos e equipe inativa; DTO desaparece |
| Banco | **22/22**, zero falhas/TODO/skipped | `auditoria-complementar/banco.tap` |
| Qualidade | **35/35**, zero falhas/TODO/skipped | `auditoria-complementar/qualidade.tap` |
| Prévia visual 1B | **9/9**, zero falhas/pending | `auditoria-complementar/marco1b.json`, serviços simulados |
| Web completa | **63/67**, quatro falhas, zero pending | `auditoria-complementar/web-final.json`; backlog 31 |
| Rede | **8/8**, seguida de cleanup | `auditoria-complementar/rede-final.json` e `estado-final.json` |

Contabilidade: **194 verificações anteriores, algumas com asserções reforçadas + 4 de dashboard + 212 complementares + 2 de preparação Auth do alvo P5 = 412**. P1/P2/P3/P4/P5/A-09/A-13 são subconjuntos do gate, não suítes somáveis ao total. Os 22 de banco estão nos 35 de qualidade; os nove 1B estão nos 67 Web. O executor real não tem TODO/skipped: todos os 412 checks registrados foram executados. O resultado anterior 194/194 permanece preservado em `gate194-anterior.json`; não substitui nem infla o novo total.

## Confronto A-01 a A-14

### A-01 — 1A e ban Auth somente no laboratório

- **SuperGrok:** Alta; confirmado. **Nossa classificação: VÁLIDO como fronteira de implantação.**
- **Análise:** snapshots pré/pós-1A distinguem os objetos privados, RPCs e corpos dos helpers locais. O fluxo de revogação também é candidato local. Não se estende a prova local ao compartilhado. A severidade Alta original foi preservada; não representa uma falha Alta aberta no envelope local testado.
- **Ação:** manter proibição de usar o remoto como portal pessoal e exigir marco próprio de implantação. Nenhuma alteração remota executada.
- **Teste/evidência:** catálogos/comparações salvos e escopo do executor fixado em Docker local/API 127.0.0.1.
- **Resultado/status:** confirmado; **implantação remota bloqueada, sem bloquear o fechamento estrito do laboratório**. O estado remoto não foi recapturado nesta rodada.

### A-02 — escrita REST GraphQL e Storage

- **SuperGrok:** Média; lacuna. **Nossa classificação: VÁLIDO quanto à cobertura anterior.**
- **Análise:** as 194 provas não continham essas classes de escrita REST/GraphQL. Uma leitura vazia não prova uma mutação negada.
- **Ação:** P1 cobre as 30 tabelas públicas, dois usuários e três verbos, com alvo existente em todas as tentativas PATCH/DELETE. P2 usa a rota GraphQL real e registra sua implementação efetiva.
- **Teste/resultado:** 182 requisições REST: **124 HTTP403/42501 e 58 HTTP200 com array vazio**. SHA-256 e contagens de 30 tabelas públicas + três privadas iguais antes/depois de cada ator. P2 devolve HTTP200 com erro exato `pg_graphql extension is not enabled.` para admin, João e Maria; catálogo local confirma ausência da extensão e o wrapper de indisponibilidade. O catálogo remoto salvo também não inclui essa extensão.
- **Status:** lacuna REST encerrada no catálogo ensaiado. GraphQL **não expõe os objetos nesse estado**; nenhuma autorização GraphQL ativa foi exercitada. Storage tem **zero buckets**, confirmado por SQL local; upload/download de futuros buckets continua fora da prova. Habilitar GraphQL ou criar Storage pessoal exige novo gate.

### A-03 — falha parcial de revogação

- **SuperGrok:** Média; lacuna. **Nossa classificação: VÁLIDO; prova obrigatória executada.**
- **Análise:** a versão anterior tratava ban com resposta HTTP negativa, mas uma rejeição de transporte de `fetch` não tinha tratamento controlado. A RPC isolada não executa ban Auth.
- **Ação:** a Edge local passou a compartilhar um handler com transporte injetável pelo servidor. O endpoint normal usa `fetch` normal, sem flags de falha aceitas do cliente. O endpoint `lab-revoke-auth-failure`, exclusivo do laboratório, preserva Auth/SQL reais e lança falha somente ao tentar o PUT de ban. A exceção agora retorna `502 auth_ban_pending`. Falha de transporte na etapa SQL retorna `502 identity_revocation_unconfirmed` sem afirmar sucesso; esse ramo adicional não foi injetado nesta rodada.
- **Teste/resultado:** João autenticado → commit SQL → **502**; identidade revogada, Auth ainda sem ban; token antigo consulta DTO **200/[]**; refresh intermediário **200**, e o token novo também recebe DTO vazio. Motivo diferente retorna **400 identity_revocation_denied**, sem alteração do histórico. Retry com o mesmo motivo retorna **200**, aplica ban e mantém uma única entrada de revogação; refresh e novo login passam a **400**. O endpoint de ensaio também nega João **403** e preserva Maria.
- **Status:** **sanado no fluxo servidor local**. Access token já emitido pode continuar autenticando no gateway até expirar; acesso a dados depende do estado atual no banco. Qualquer futura UI de desligamento deve usar o fluxo servidor completo, apresentar estado pendente em 502 e oferecer retry do mesmo motivo; chamar só a RPC SQL não é desligamento Auth concluído.

### A-04 — dashboard e argumento de ID

- **SuperGrok:** Baixa; lacuna. **Nossa classificação: VÁLIDO.**
- **Análise:** ausência do UUID de Maria era uma asserção insuficiente. O argumento inexistente na RPC pessoal era rejeitado pelo roteamento, não por uma guarda SQL exercitada.
- **Ação/teste:** check existente reforçado e quatro verificações explícitas por chave. Resposta real de `site_dashboard()` tem as 12 coleções vazias, inclusive `works`, `teams`, `employees`, `alerts`.
- **Resultado:** argumento `p_employee_id` retorna **404/PGRST202** e passou a ser rotulado como roteamento. A defesa SQL é o contrato sem parâmetro e a resolução `auth.uid() → portal_account → identidade ativa → funcionário`, com perfil Gestão inativo, funcionário/equipe ativos.
- **Status:** **corrigido e comprovado**, sem alegação de execução SQL no erro de roteamento.

### A-05 — envelope da rede A

- **SuperGrok:** Informativa; confirmado. **Nossa classificação: VÁLIDO.**
- **Ação/teste:** configuração Localhost only mantida; prova repetida porque a pilha foi iniciada para P1–P5. Bind Windows/Docker em 127.0.0.1/::1 nas cinco portas, loopback positivo, Ethernet IPv4/IPv6 negativo no host e em namespace Docker separado, controle positivo funcionando e firewall ativo.
- **Resultado/status:** **8/8 e pilha encerrada, zero listeners e sondas restantes**. Envelope: laboratório isolado neste host. Segunda máquina física, Internet, `host.docker.internal` e administrador local privilegiado não foram ensaiados e não integram esta conclusão.

### A-06 — quatro falhas Web e RPC ausente

- **SuperGrok:** Média; confirmado. **Nossa classificação: VÁLIDO.**
- **Análise:** três falhas decorrem de mudanças locais anteriores da Gestão; apenas tipografia já falha no HEAD. A RPC nova realmente não existe na baseline efetiva.
- **Ação/teste:** suíte completa repetida, hashes confrontados com a rodada anterior e investigação exclusivamente local/somente leitura. A definição está em `20260912190000_unify_existing_operations.sql:82`, arquivo local não rastreado. Não está entre as 42 fontes aplicadas pela baseline, nem nos snapshots remoto/pré/pós-1A; consulta ao `pg_proc` local retorna zero. A baseline reconstruída por SQL não possui tabela de histórico `supabase_migrations.schema_migrations`, portanto não se inventou uma confirmação pelo histórico gerenciado da CLI.
- **Resultado/status:** Web **63/67**. A ação Web aponta para função ausente no laboratório e no catálogo remoto salvo. **Backlog formal da Gestão**, documento 31; nenhuma migration da Gestão foi aplicada nem teste alterado para ocultar o problema. Não bloqueia o isolamento da identidade 1A.

### A-07 — flags e caminho Auth preparado

- **SuperGrok:** Baixa; confirmado. **Nossa classificação: VÁLIDO.**
- **Análise:** modo visual evita criar cliente Supabase; caminho Auth local permanece no código, condicionado a outra flag. Sem flags a página retorna notFound; isso é conclusão da fonte, não novo ensaio de servidor em modo de produção.
- **Ação/teste:** não executar script Auth, não alterar flags do produto e repetir os nove testes de componentes. Eles usam mocks, não representam integração real do produto.
- **Resultado/status:** **9/9; prévia somente visual**. Nova integração Auth aguarda a apresentação desta rodada ao responsável e direção para continuidade. A condição de deploy futuro exige flags de prévia desligadas e validação própria.

### A-08 — contradição documental

- **SuperGrok:** Baixa; confirmado. **Nossa classificação: VÁLIDO.**
- **Ação:** o encerramento antigo do documento 24 foi marcado explicitamente **SUPERADO pelas evidências do relatório 28 e pelo isolamento A comprovado posteriormente**. Foi preservado como citação histórica. Os documentos vigentes apontam à decisão deste relatório; o pacote 28/29 está identificado como registro da rodada anterior.
- **Teste/resultado:** revisão textual dos estados dos documentos 17–31 e busca das frases de rede pendente; a frase antiga não funciona mais como decisão vigente.
- **Status:** **corrigido**. A decisão vigente é a abertura deste documento.

### A-09 — provisionamento Gestão distinto do portal

- **SuperGrok:** Média; confirmado. **Nossa classificação: VÁLIDO como fronteira intencional.**
- **Ação:** manter `create-employee` e `admin-invite-user` intactas. Criar conta sintética pela Edge real `create-employee`, com admin Gestão.
- **Teste/resultado:** HTTP200 cria `collaborator` ativo, sem marcador portal. `admin_register_portal_account` retorna **400/22023 dedicated_portal_account_required**; repetido após desativar somente o perfil da fixture, continua recusado por falta do marcador. Perfil da Gestão restaurado ativo após o teste.
- **Status:** **fronteira comprovada**. Não reutilizar essas Edges para o portal. `admin-invite-user` foi conferida estaticamente e continua nas provas de negação do gate anterior; novo convite administrativo não foi exercitado nesta rodada.

### A-10 — ASO no cadastro operacional

- **SuperGrok:** Média; confirmado. **Nossa classificação: VÁLIDO como dívida de domínio, sem vazamento comprovado.**
- **Ação:** nenhuma coluna movida. A regressão real do DTO passou de negar apenas duas chaves ASO para exigir a lista exata `employee_id, full_name, profession, team_name`, em três contas. O teste SQL já exige essa mesma lista. Novos campos sensíveis, incluindo CPF, falham nessa regressão.
- **Regra obrigatória:** **nenhuma API pessoal pode fazer SELECT * em epi_employees**. Usar lista explícita e mínima de campos. Antes de “Meus EPIs”, avaliar e preferencialmente separar o domínio SST/saúde, com autorização e teste próprios.
- **Resultado/status:** DTO e leituras REST sem ASO/CPF/dado cruzado; regra registrada, **segregação de saúde permanece gate futuro**.

### A-11 — cobertura das RPCs

- **SuperGrok:** Informativa; confirmado. **Nossa classificação: VÁLIDO.**
- **Ação/teste:** executor e inventário agora registram `coverage` e `body_exercised` por assinatura.
- **Resultado:** 43 assinaturas: **6 executadas**, **33 bloqueadas por guarda SQL identificada**, **2 negadas por privilégio SQL sem afirmar execução do corpo**, **1 somente roteamento PostgREST** (300/PGRST203 da sobrecarga de dois argumentos) e **1 trigger não chamável** (404/PGRST202). A assinatura não ambígua de `create_team_admin` continuou sendo chamada e negada ao portal.
- **Status:** **inventário corrigido**. As 43 tentativas não equivalem a 43 corpos exercitados; há evidência de entrada em 39 corpos nos dois primeiros grupos.

### A-12 — exclusão e FKs da identidade

- **SuperGrok:** Baixa; hipótese. **Nossa classificação: PARCIALMENTE VÁLIDO** — a incompatibilidade de exclusão precisava de prova; a hipótese de orfandade não se confirmou.
- **Ação/teste:** conta portal sintética vinculada e admin Gestão real chamando a Edge `delete-employee`; snapshot antes/depois de Auth, portal account, identidade e auditoria; consulta das FKs.
- **Resultado:** HTTP400, erro controlado `Database error deleting user`, sem `ok:true`. Auth continua retornando a conta por API administrativa; snapshots idênticos; FKs para Auth com ON DELETE RESTRICT.
- **Status:** **falha fechada comprovada**, sem identidade/auditoria órfã ou apagada. Não foi necessária mudança na Edge da Gestão. A mensagem administrativa é genérica; eventual melhoria de UX/guarda explícita é assunto da Gestão, não requisito para autorizar apagar histórico.

### A-13 — equipe inativa e token residual

**REGRA HISTÓRICA SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL.**

- **SuperGrok:** Baixa; confirmado. **Nossa classificação: VÁLIDO.**
- **Ação/teste:** Maria com identidade e funcionário ativos, movida para equipe sintética inicialmente ativa. Após desativar apenas a equipe, o DTO passa de uma linha a **200/[]**. A equipe original do funcionário foi restaurada ao final. A regra SQL não mudou.
- **Resultado/status:** comportamento **confirmado**. Decisão empresarial pendente antes do avanço funcional: continuar acessando o perfil, exibir perfil sem equipe, ou perder o acesso. Este relatório não escolhe uma dessas opções. O comportamento de JWT residual foi comprovado no P3: gateway pode aceitar token não expirado, banco nega DTO conforme estado atual.

### A-14 — identidade civil conformidade e recuperação

- **SuperGrok:** Média; confirmado. **Nossa classificação: VÁLIDO como limite de escopo.**
- **Análise:** método de verificação ainda é declaração do operador; não houve identidade civil, dual control, recontratação, restauração integral ou implementação de AFD/AEJ/ICP/INPI nesta rodada.
- **Ação/teste:** confronto dos documentos de contrato, identidade, matriz e ensaio de restauração existente. Nenhum artefato simulado foi criado para aparentar conformidade.
- **Resultado/status:** **encaminhado aos marcos próprios**; impede afirmar operação oficial/conformidade, não impede a conclusão técnica local aqui delimitada. Não é parecer jurídico.

## Falhas encontradas e corrigidas nesta execução

1. **Tratamento de transporte da revogação:** falta de captura de exceção no PUT Auth identificada na fonte anterior. Corrigida no handler local e exercitada com falha real injetada no transporte da Edge; resposta controlada 502. O ramo HTTP negativo já existia; não se atribui a ele a ausência de tratamento de exceção.
2. **Primeira execução do ensaio:** guardava o nome completo do container, enquanto a CLI injeta `http://kong:8000`. O endpoint de teste recusou antes do SQL e devolveu WORKER_ERROR; a sequência P3 não era válida. Corrigida a guarda para os nomes internos locais conhecidos e adicionada interrupção se a falha não atingir a etapa correta. O endpoint normal não ganhou uma flag de injeção.
3. **GraphQL:** o ensaio inicial esperava resultado de um motor ativo, mas encontrou a extensão desabilitada. A classificação foi corrigida após consultar extensão, wrapper SQL e controle admin, conforme a alternativa “objeto não exposto” autorizada pelo responsável. Não se alterou o banco para fabricar um resultado verde.
4. **Reexecução de fixtures:** nome de profissão sintética precisava ser único entre rodadas. Uma execução parou por unique constraint; o nome passou a incluir o identificador da rodada. As asserções de segurança foram preservadas.

As duas execuções intermediárias foram preservadas em `resultado-primeira-execucao.json` e `resultado-segunda-execucao.json`; não são apresentadas como gates aprovados. O gate final tem 412/412 e nenhuma exceção. Não surgiu vulnerabilidade crítica/alta relativa à identidade no laboratório. Isso é conclusão limitada às fontes e ensaios registrados, não promessa de ausência universal de falhas.

## Evidências e reprodução

- `resultado-provas-reais.json`: gate ampliado, leituras, RPCs categorizadas, dashboard e complementares.
- `auditoria-complementar/resultado-complementar.json`: matrizes de escrita, fingerprints SHA-256, respostas GraphQL, exclusão, equipe e falha parcial.
- `auditoria-complementar/inventario-rpc-executado.json`: classificação de cada assinatura.
- `auditoria-complementar/investigacao-rpc-gestao.json`: origem da RPC não aplicada, catálogo e Storage vazio.
- `auditoria-complementar/rede-final.json`, `estado-final.json`: bind e alcance, controle positivo, cleanup e firewall.
- `auditoria-complementar/banco.tap`, `qualidade.tap`, `web-final.json`, `marco1b.json`: resultados separados.
- `auditoria-complementar/fontes-antes/`: fonte anterior da revogação e executor.

Reprodução exclusivamente local: iniciar pelo script que exige Localhost only; servir as Edge Functions pela CLI 2.117.0 com a rede `metallo-marco1a-local`; executar `executar-provas-reais.mjs` com `METALLO_TEST_EDGE_FUNCTIONS=1` e `METALLO_TEST_COMPLEMENTARY=1`; depois executar `validar-isolamento.ps1`, que testa rede e encerra a pilha. A função `lab-revoke-auth-failure` é material de ensaio e **nunca deve ser implantada**. O endpoint padrão usa o mesmo handler sem injeção. Não executar scripts do app Auth 1B nesse procedimento.

Pacote desta rodada: `outputs/Metallo-Marco1A-ConfrontoFinal-20260926.zip`, com fontes, parecer original, evidências, resumo e manifesto SHA-256. Inclui prompt de revisão complementar somente leitura. O pacote anterior foi preservado. A conferência final também constatou que o servidor visual 1B estava desligado (porta 3101 sem listener, HTTP recusado); o código permanece restrito à prévia visual, sem ativação do modo Auth.

## Bloqueios restantes

- **Dentro do gate técnico local delimitado:** nenhum bloqueador crítico/alto identificado após os testes finais e a prova de rede.
- **Gestão Web:** quatro falhas abertas e RPC ausente, com condições de resolução no backlog 31; a suíte não está verde.
- **Produto 1B:** somente visual; apresentar esta rodada ao responsável antes de continuar. Regra para equipe inativa ainda requer decisão de produto.
- **Novas superfícies:** GraphQL ativo, buckets Storage, EPI pessoal e outros módulos exigem novos testes, contratos e autorização de escopo. A ausência atual de objetos não valida implementações futuras.
- **Remoto e operação empresarial:** migration, Edge, usuários reais, deploy, ponto oficial e conformidade continuam fora do autorizado. Nenhum desses limites foi removido pelo fechamento do laboratório.
