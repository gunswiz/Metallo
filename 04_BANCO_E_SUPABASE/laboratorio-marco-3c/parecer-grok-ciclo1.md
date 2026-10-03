## Recebimento e integridade

ZIP acessível: `Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo1.zip`.

- SHA-256 calculado: `f1b2083d96c07e2e081fd271c8b6af54c829375e5ba91471c63057651b55bded` — **confere** com o valor informado.
- Entradas no ZIP: **54**. Manifesto lista 53 arquivos; o 54º é o próprio `MANIFESTO_SHA256.json` (autorreferência declarada).
- Conferência passiva: tamanho e SHA-256 de cada arquivo extraído **coincidem** com o manifesto. Nenhum mismatch.
- Origem declarada `METALLO-3B-LAB-20260928-R1` / `b8f6e595…56148`: o ZIP de origem **não veio anexado**; só o manifesto 3B e o recorte `BASELINE_3B_RELEVANTE/`.
- `is_approved_baseline: false`. Rótulo obrigatório: **SIMULAÇÃO SEM VALOR OFICIAL**.

Inspeção somente leitura. **Não executei** scripts, SQL, testes, Auth, containers nem Supabase. Os 67/67, 48/48, 141/141 etc. são provas **locais do pacote**, não reprodução desta auditoria.

---

## Controles verificados no código/SQL/provas (não são achados)

Titularidade por `auth.uid()` → conta portal → identidade ativa → funcionário ativo; **não há `employee_id` decisório** nas quatro RPCs pessoais. João/Maria isolados no SQL e nas provas declaradas. `delivery_id` alheio ou encerrado recusado. Motivos controlados; `OUTRO` exige nota aparada ≤240. Cancelamento só `SOLICITADA` do titular, replay idempotente. Estados `SOLICITADA→EM_ANALISE→APROVADA|RECUSADA` e `SOLICITADA→CANCELADA`. Histórico com trigger `BEFORE UPDATE OR DELETE`. Nota interna fora do DTO pessoal; parser do portal rejeita `internal_note`. Aprovação **não** altera `epi_deliveries` nem `epi_stock_batches` no SQL nem nas provas. Portal: allowlist só RPCs pessoais em `127.0.0.1:54321`, sem `manage`/`admin`. Gestão: `requireCapability('epi:write')` + URL local + `can_operate('epi:write', equipe)` (admin global se `team_id` nulo). Seis RPCs: `SECURITY DEFINER`, `search_path=""`, owner `postgres`, `EXECUTE` só `authenticated`; catálogo sanitizado com `service_role_execute: false`. Tabelas sem GRANT a `anon`/`authenticated`/`service_role`, RLS ligado. Correção pré-auditoria do `EXECUTE` de `service_role` **está no SQL, no catálogo e na prova de privilégio**. Demo visual **não** liga o fluxo de troca. Sucesso na UI só após o `await create`.

**Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionado.**

---

## Achados

### F-3C-01 — Intermitência Web 140/141 sob carga
- **Severidade:** MÉDIA (qualidade da evidência, não bypass)
- **Status:** CONFIRMADO (divulgação) + LACUNA DE EVIDÊNCIA (artefato da falha)
- **Arquivo/linha:** `05_DOCUMENTACAO/41_MARCO_3C_SOLICITAR_TROCA_EPI.md` ~44; `MANIFESTO_SHA256.json` `results.Web`; `04_BANCO_E_SUPABASE/laboratorio-marco-3c/web.log` (só a corrida 141/141)
- **Condição:** suíte Web em paralelo com banco/qualidade/TS/lint; teste de recuperação de Minha Equipe após indisponibilidade do laboratório.
- **Caminho:** timeout → 140/141; isolado 9/9; serial 141/141. Causa não demonstrada.
- **Evidência:** texto do marco e manifesto. **Não há** log da corrida 140/141 no ZIP. Esta auditoria não reexecutou a suíte.
- **Impacto:** o “141/141” não é evidência estável sob carga. Risco de regressão mascarada em CI paralelo. Não indica falha de autorização 3C.
- **Correção mínima:** arquivar o log 140/141; tornar o teste de recuperação independente de carga ou com orçamento explícito; não “corrigir” omitindo a falha.
- **Teste de aceitação:** reproduzir o paralelo e o serial com logs anexos; o critério de marco deve declarar os dois resultados.

### F-3C-02 — F-3B-05 herdado (catálogo vivo no histórico 3B)
- **Severidade:** BAIXA
- **Status:** CONFIRMADO (residual)
- **Arquivo/linha:** `05_DOCUMENTACAO/40_MARCO_3B_MEUS_EPIS.md` (F-3B-05); `meus-epis.tsx` nota de rodapé ~56; `contrato-epis.sql` `item.name` / `item.unit`
- **Condição:** rename/reclassificação de `epi_items` após a entrega.
- **Caminho:** `my_personal_epi` lê nome/unidade do catálogo atual.
- **Evidência:** SQL 3B + documentação + rodapé da tela.
- **Impacto:** histórico 3B pode mudar ou sumir item. Pedido 3C grava `item_name_snapshot`/`ca_snapshot` **no pedido**, não corrige entregas 3B.
- **Correção mínima:** snapshot na entrega (decisão de modelo) ou recusar promoção enquanto residual.
- **Teste de aceitação:** renomear item após entrega; histórico 3B permanece com o nome da época.

### F-3C-03 — F-3B-15 herdado (fechamento parcial sem agrupamento)
- **Severidade:** BAIXA
- **Status:** CONFIRMADO (residual de apresentação)
- **Arquivo/linha:** `40_MARCO_3B_MEUS_EPIS.md` F-3B-15; `meus-epis.tsx` listas ativas/histórico
- **Condição:** baixa parcial 3→2+1 com mesmo CA/data.
- **Caminho:** dois registros visuais sem agrupamento.
- **Evidência:** parecer 3B; UI 3C não agrupa.
- **Impacto:** confusão operacional, não vazamento.
- **Correção mínima:** agrupamento visual ou modelo de saldo por entrega.
- **Teste de aceitação:** ensaio 3→2+1 mostra relação explícita, sem parecer dupla entrega.

### F-3C-04 — Revogação entre Auth e commit (limite sistêmico)
- **Severidade:** MÉDIA em produção futura; BAIXA no laboratório documentado
- **Status:** RISCO FUTURO / herdado
- **Arquivo/linha:** `41_MARCO_3C_SOLICITAR_TROCA_EPI.md` ~34; `contrato-troca-epi.sql` 100–107 e 161–166 (`FOR SHARE` da identidade); `revogar-conta-portal-servidor.mjs`
- **Condição:** JWT ainda válido; identidade/ban ocorrem depois do `auth.uid()` e antes do `COMMIT`.
- **Caminho:** sessão passa no Auth; RPC ainda não vê linha revogada; commit grava pedido.
- **Evidência:** código + documento. Provas cobrem **token já revogado** (linhas 133–136 de `provas-3c.mjs` / checks 64–67), não a janela intra-transação.
- **Impacto:** um pedido residual após desligamento, em condição de corrida estreita.
- **Correção mínima:** revalidar identidade imediatamente antes do `INSERT`; avaliar ban Auth + `FOR UPDATE` da identidade; ensaio de corrida revoke×create.
- **Teste de aceitação:** revoke concorrente com `create` nunca persiste pedido com identidade já `revoked` no commit.

### F-3C-05 — `APROVADA` ocupa a vaga aberta sem vínculo com entrega posterior
- **Severidade:** MÉDIA (operacional)
- **Status:** CONFIRMADO (desenho) + RISCO FUTURO
- **Arquivo/linha:** `contrato-troca-epi.sql` 27–29 (índice parcial); 219–221 (sem transição pós-`APROVADA`); doc 3C ~28–29
- **Condição:** pedido aprovado; entrega de origem permanece `active`; ainda não existe `request_id ↔ delivery_id`.
- **Caminho:** índice único impede novo pedido na mesma entrega; não há `ENTREGUE`/`CONCLUIDA` nem desfazer aprovação.
- **Evidência:** SQL + documentação explícita.
- **Impacto:** aprovação prematura trava a troca daquele EPI até haver modelo de entrega. Não move estoque (correto), mas cria impasse.
- **Correção mínima:** estado posterior auditável ligado à entrega real, ou transição de correção com evento append-only.
- **Teste de aceitação:** após aprovação + nova entrega substituta, nova solicitação na entrega **nova** é permitida; na origem aprovada permanece bloqueada até o vínculo ser encerrado.

### F-3C-06 — Cliente rejeita replay idempotente que não volte `SOLICITADA`
- **Severidade:** BAIXA
- **Status:** CONFIRMADO
- **Arquivo/linha:** `use-colaborador-session.ts` 199–205; `provas-3c.mjs` 99–100
- **Condição:** mesma `idempotency_key` após cancelamento, ou após a Gestão avançar o estado, com retry de rede.
- **Caminho:** servidor devolve o pedido existente (`CANCELADA`/`EM_ANALISE`/`APROVADA`); cliente exige `request_status === "SOLICITADA"` e lança “Confirmação da solicitação inválida.”
- **Evidência:** código do cliente vs prova “retry após cancelamento não recria”.
- **Impacto:** falso erro na UI; risco de o usuário gerar **nova** chave e tentar segundo pedido (o índice aberto ainda protege se o estado ocupar a vaga).
- **Correção mínima:** aceitar replay se `request_id`+chave coincidirem; só tratar divergência de conteúdo como conflito.
- **Teste de aceitação:** retry da mesma intenção após cancel/análise não mostra sucesso falso nem erro genérico; não cria segundo pedido.

### F-3C-07 — `manage` faz `FOR UPDATE` no pedido antes da autorização
- **Severidade:** BAIXA
- **Status:** CONFIRMADO
- **Arquivo/linha:** `contrato-troca-epi.sql` 210–218
- **Condição:** autenticado sem `epi:write` conhece/adivinha `request_id`.
- **Caminho:** `SELECT … FOR UPDATE` → depois `management_access_denied`. A linha fica bloqueada até o fim da transação.
- **Evidência:** ordem no SQL. UUID reduz a exploração prática.
- **Impacto:** contenção/DoS local da análise, não escalada de privilégio (Maria já é recusada nas provas).
- **Correção mínima:** checar perfil/permissão **antes** do `FOR UPDATE`, ou `FOR UPDATE` só após `can_operate`.
- **Teste de aceitação:** chamada negada não retém lock mensurável; gestor legítimo analisa em paralelo.

### F-3C-08 — Prova de equipe nula não usa gestor com `epi:write` de outra equipe
- **Severidade:** BAIXA (evidência)
- **Status:** PARCIAL
- **Arquivo/linha:** SQL 189–191 e 216–218; `provas-3c.mjs` 125–129
- **Condição:** funcionário com `team_id` nulo; ator = **Maria do portal**, não engenheiro com `epi:write` em equipe A.
- **Caminho:** o check “gestor sem escopo não ganha equipe nula” só prova que o portal vê fila vazia. O predicado SQL (`team_id is null` ⇒ só `profiles.role='admin'`) é o controle real.
- **Evidência:** código adequado; ensaio do ator errado para o nome do teste.
- **Impacto:** regressão futura de `can_operate(perm, NULL)` pode passar despercebida.
- **Correção mínima:** criar gestor `epi:write` só na equipe A e afirmar zero linhas de funcionário sem equipe; admin vê essas linhas.
- **Teste de aceitação:** matriz admin / gestor A / gestor B / portal × funcionário com e sem equipe.

### F-3C-09 — Artefatos de conferência fora do ZIP
- **Severidade:** BAIXA
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `MANIFESTO_SHA256.json` `secret_scan_receipt`; `LEIA-ME.md` ~9; origem 3B não anexada
- **Condição:** auditor só tem este ZIP.
- **Caminho:** não é possível conferir o recibo do scan direto no ZIP, o log 140/141 nem o ZIP 3B originais.
- **Evidência:** referência externa `outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo1.zip.verificacao.json`. Varredura passiva neste extrato: **nenhum JWT completo nem chave privada**.
- **Impacto:** confiança no scan e na origem 3B fica documental.
- **Correção mínima:** anexar recibo com hash do ZIP (fora ou em sidecar) e o log da falha Web; manter o ZIP 3B disponível no ciclo.
- **Teste de aceitação:** hash do recibo cita exatamente `f1b2083d…bded`.

### F-3C-10 — Nota interna gravada e invisível na fila da Gestão
- **Severidade:** BAIXA
- **Status:** CONFIRMADO
- **Arquivo/linha:** `admin_epi_exchange_requests` 180–187 (não seleciona `internal_note`); `solicitacoes/page.tsx` 48–63 (form some após decisão)
- **Condição:** gestor grava nota interna em `EM_ANALISE`/`RECUSADA`/`APROVADA`.
- **Caminho:** valor vai para tabela/evento; RPC/UI não devolvem depois. Isolamento contra o portal está correto.
- **Evidência:** SQL da fila vs `INSERT` em events 237–239.
- **Impacto:** auditoria operacional cega na tela; não vaza ao colaborador (prova da recusa + parser).
- **Correção mínima:** campo `internal_note` **só** na RPC admin, nunca na pessoal.
- **Teste de aceitação:** admin vê a nota; João/Maria e o DTO pessoal não.

### F-3C-11 — `can_operate` não está no pacote
- **Severidade:** BAIXA
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** uso em `contrato-troca-epi.sql` 189 e 216; migrations 3B de escopo; corpo da função **ausente**
- **Condição:** 3C reutiliza função prévia.
- **Caminho:** não dá para reauditar aqui o significado de `can_operate('epi:write', team)` nem de `NULL`.
- **Evidência:** chamadas + testes T05 no `banco.log`/`qualidade.log` (provas locais, não reexecutadas).
- **Impacto:** a autorização da Gestão 3C herda a correção dessa função.
- **Correção mínima:** incluir definição vigente no próximo pacote.
- **Teste de aceitação:** pacote contém o `CREATE` atual e o ensaio F-3C-08.

### F-3C-12 — Rede 8/8 não reensaiada neste marco
- **Severidade:** BAIXA
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** doc 3C ~43; manifesto `rede_vigente_sem_alteracao: 8/8`
- **Condição:** “configuração de rede não mudou”.
- **Caminho:** listeners `3101`/`3102`/`54321` citados; sem captura neste ZIP.
- **Impacto:** não invalida o contrato 3C; não prova isolamento de rede **agora**.
- **Correção mínima:** reanexar `netstat`/ensaio 8/8 se o marco exigir rede vigente.
- **Teste de aceitação:** evidência datada do ciclo 3C.

### F-3C-13 — Eventos append-only não cobrem `TRUNCATE` nem o superusuário
- **Severidade:** BAIXA
- **Status:** RISCO FUTURO (já admitido no doc)
- **Arquivo/linha:** `contrato-troca-epi.sql` 49–58; doc ~12
- **Condição:** owner/`postgres`/host local.
- **Caminho:** trigger só `UPDATE OR DELETE`; `TRUNCATE` e sessão owner passam.
- **Evidência:** definição do trigger.
- **Impacto:** nulo contra `authenticated`; relevante só se o SQL for para ambiente com mais operadores.
- **Correção mínima:** `REVOKE TRUNCATE`; event trigger / auditoria de sessão owner antes de produção.
- **Teste de aceitação:** `authenticated` e `service_role` sem GRANT continuam sem DML; documentar o limite do owner.

### F-3C-14 — Teste “employee_id injetado” está acoplado à chave já usada
- **Severidade:** BAIXA (evidência)
- **Status:** PARCIAL
- **Arquivo/linha:** `provas-3c.mjs` 64; função `create_epi_exchange_request` sem parâmetro `employee_id`
- **Condição:** mesmo `idempotency_key` do pedido do João + campo extra.
- **Caminho:** se o PostgREST rejeita chave desconhecida → 400 (teste passa). Se ignorasse extras, seria replay 200 e o teste falharia — **não** exercitaria troca de titular.
- **Evidência:** payload reusa `payloadJ`. O SQL de fato não aceita `employee_id`.
- **Impacto:** nenhum bypass observado; o nome do teste superestima o que a prova cobre.
- **Correção mínima:** nova chave + `employee_id`/`p_employee_id` da Maria; titular continua João ou 400.
- **Teste de aceitação:** extra arg não troca `employee_id` persistido.

### F-3C-15 — Visibilidade da Gestão segue `team_id` **atual** do funcionário
- **Severidade:** BAIXA
- **Status:** RISCO FUTURO
- **Arquivo/linha:** `contrato-troca-epi.sql` 188–191, 215–218
- **Condição:** pedido aberto; funcionário muda de equipe.
- **Caminho:** gestor da equipe antiga perde a fila; o da nova ganha; sem equipe só admin.
- **Evidência:** predicado usa `e.team_id` vivo, não `delivery.team_id`.
- **Impacto:** pedido “órfão” na tela da equipe que entregou o EPI.
- **Correção mínima:** decidir se o escopo é equipe da entrega ou do vínculo atual; snapshot de equipe no pedido.
- **Teste de aceitação:** mover funcionário no meio de `SOLICITADA` e verificar a fila dos dois gestores.

---

## Correção `service_role` e falha Web

A conferência de catálogo que achou `EXECUTE` padrão de `service_role` nas seis RPCs foi **tratada no laboratório**: `REVOKE ALL … service_role` + `GRANT EXECUTE … authenticated` em todas as seis; `catalogo-rpc-3c.json` mostra `service_role_execute: false` e ACL `{postgres=X/postgres,authenticated=X/postgres}`; `provas-3c.mjs` 24–30 testa `has_function_privilege` para as seis. Isso está **fechado no material local**. Não há chamada HTTP real com JWT `service_role` no pacote — só privilégio de catálogo (suficiente para GRANT, não para um proxy mal configurado).

A falha Web **140/141 sob carga → 9/9 isolado → 141/141 serial** está **declarada** e **não ocultada** no documento/manifesto. O único `web.log` do ZIP é o 141/141. Tratar como F-3C-01.

---

## Veredito

**Não existe CRÍTICO ou ALTO confirmado e aberto no escopo local deste ciclo.**  
Os controles de titularidade, João/Maria, IDs, `epi:write`, DEFINER/`search_path`/grants, estados, idempotência/concorrência (5 chamadas), histórico, nota interna vs motivo público, token já revogado, offline sem falso sucesso e ausência de baixa/entrega automática **sustentam-se no código e nas provas anexas**, com as ressalvas de evidência acima.

**SIMULAÇÃO SEM VALOR OFICIAL.** Sem baseline 3C, sem publicação, sem início de outro marco.
