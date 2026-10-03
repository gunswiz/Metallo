O pacote confere com o SHA declarado e o manifesto. Não reexecutei o laboratório. A carga de 50 e a integridade 70/70 estão consistentes no artefato final, mas não foram reconsultadas aqui. Não há achado crítico ou alto confirmado que viole o contrato local atual. Isto não é baseline 4B, não fecha o marco e não autoriza 4C.

## O que foi lido

SHA-256 do ZIP: `9781552cba3062b07aec753a8f91ef3f8539638468fc02d604ae2d04ef509e47`, igual ao declarado. 183 entradas. `MANIFESTO_SHA256.json` cobre 182 arquivos; o próprio manifesto é a 183ª. Recalculei os 182 hashes: 0 ausentes, 0 divergentes. `is_approved_baseline` é `false`. Origem declarada: baseline 4A `50a9c1c8…7909d`, não reaberta neste ciclo.

Li o manifesto, `RESULTADOS_4B.json`, a documentação 4B, `carga-resultado.json` (902 requisições), validações, postmortems, rotas, `registros.mjs`, `servidor-4a.mjs`, `extensao.sql`, o agendador HTTP e a amostra PDF/ZIP de u0. Extraí o texto dos dois PDFs da amostra com `pdftotext`/`pdfinfo`. Não executei o projeto, testes, SQL, migrations, Auth, endpoints nem rede.

## Carga e integridade obrigatória

Comprovadas nas condições declaradas, como evidência do produtor, não como reexecução deste auditor.

| Condição | Leitura independente do artefato |
|---|---|
| 50 identidades | 50 `authUserId`, `employeeId`, `sessionId` e `identityId` distintos; sem equipe: índices 0, 10, 20, 30, 40 |
| Barreira | fases com spread inicial de 2–6 ms; sobreposição HTTP calculada = 54, igual a `max_in_flight` |
| Writer | `agendamento-http.mjs` serializa o núcleo; HTTP concorrente não prova transações paralelas |
| Dataset | `before` 1.100, SHA `e273ec2c…328fb`; depois 1.170, mesmo SHA dos originais |
| Novas gravações | 70 begins 200, 70 commits 201, 70 intenções confirmadas, chaves únicas |
| Retry da mesma intenção | 2× 503 em `/begin` (~60.097 ms, usuários 5 e 9), depois 200/201; 5 respostas pós-commit descartadas; `retries` 7 = 5 descartes intencionais + 2 reexecuções de 503 |
| Paginação | 50/50 com `pages=2`; 40 pessoas com 22 ids, 10 com 23; o terceiro evento de 0–9 nasce na fase 07, depois do snapshot |
| PDF/ZIP | lista 60 PDF + 60 ZIP; validação do produtor `passed: true`, 0 cruzamentos contra o conjunto de PDFs |
| Métricas | 902 req, 495 2xx, 405 4xx, 2 5xx, 0 timeout, 0 erro de transporte; p50 11,3 s, p95 61,3 s, máx. 64,4 s |
| Revogação | só usuários 45–49; 0 sucesso com início após `complete_ms`; fase 08 = 10× 401 `SESSAO_INVALIDA` |
| Host | 165 amostras; CPU máx. 50%; RAM livre mín. ~2,67 GB; conexões 42–46 |

Run final `7b71f740-6697-4e38-9768-891a4254f0dc`. Falhas anteriores preservadas e não misturadas: tentativa 02 sem gateway; 03 quebrou em `event_id` (570 req); 04 teve 43 falhas e SHA de originais diferente (`b5e8416d…`). O postmortem 01 registrou eventos persistidos sem confirmação do cliente. Isso não contamina o run final, nem prova que aqueles órfãos foram retestados no mesmo banco.

Não dá para concluir: reconsulta ao PGlite, reparse dos 59 PDFs/ZIPs ausentes do pacote, assinatura dos JWTs (sanitizados), capacidade de produção, writers distribuídos, ou janela instantânea de revogação.

## Achados

Não há crítico/alto confirmado em aberto contra o contrato local. Os itens abaixo são o que o confronto pode marcar.

**4B-C1-01 — Disponibilidade sob a barreira de 50, com recuperação.** Severidade média. Status CONFIRMADO como comportamento observado, não como perda. Evidência: `carga-resultado.json`, ids 433 e 437, fase `07-mista-revogacao-ids`, `POST /api/ponto-online/begin`, 503, ~60.097 ms, 33 bytes; depois ids 731/732 = 200 e 873/874 = 201. Fase 05: p50 ~61 s. Condição: 50 begins/commits/PDFs sobre um writer PGlite e um Next, timeouts de gateway 60 s / 90 s. Caminho: a fila serializa; o gateway estoura; o cliente repete a mesma chave até 2 vezes (`carga-4b.mjs`, `begin`). Impacto: dois 5xx reais, recuperados; não é alegação de zero 5xx. Integridade declarada permanece 70/70. Correção mínima: nenhuma para o contrato, se o 503 recuperado continuar separado de disponibilidade. Teste: repetir a fase 07 e exigir 0 órfão de intenção sem evento para as chaves dos 503.

**4B-C1-02 — Revogação sob carga só para cinco contas, sem janela instantânea.** Severidade baixa. Status PARCIAL. Evidência: `revocations` só 45–49, revogação sequencial; recontei 0 sucesso iniciado após `complete_ms`. Sobreposição existiu, mas já era 401 `SESSAO_ENCERRADA` ou 403 `CONTEXTO_INATIVO`. `last_success_end_ms: 0` é `Math.max` de lista vazia, não sucesso em t=0. Condição: revogação no meio da fase 07. Caminho não violado no log. Impacto: não prova revogação das outras 45, nem de PDF já em geração. Correção: nenhuma obrigatória. Teste: revogar uma conta com PDF/ZIP já autorizado e ainda não enviado, e exigir ausência de bytes.

**4B-C1-03 — Parser independente dos 60/60 não reexecutado aqui.** Severidade baixa. Status LACUNA DE EVIDÊNCIA, amostra CONFIRMADA. O pacote traz só `carga-amostra-u0.pdf` e `.zip`. SHA do PDF `01b77a80…d9b8` e do ZIP `63326754…1ba4` batem com a validação. ZIP com dois membros; o PDF `d09e493d…` é o mesmo arquivo. Texto: marcação 01/10/2026 12:21:16, conclusão 12:21:28, `LAB-4A-1`, id `d09e493d-ba64-467e-9130-f6bf8aae46de`, nome histórico explícito como não preservado, A4, 1 página, sem JavaScript. O segundo PDF é `af98827d…` / `LAB-4A-51`, 12:22:02–12:22:36. Impacto: não confirmo os outros 59. Correção: nenhuma se a amostra for o recorte combinado. Teste de confiança: reparse externo do diretório de downloads, não só do u0.

**4B-C1-04 — Logs vazios de lint/typecheck.** Severidade informativa. Status LACUNA DE EVIDÊNCIA. `typecheck.log`, `lint.log`, `auditoria-typescript.log`, `auditoria-lint.log`, `shell-typescript.log` e `shell-lint.log` têm 0 byte. `qualidade.log` e `banco.log` têm conteúdo; `web-auditoria-final-4b.json` traz 286/286. Não converter arquivo vazio em aprovação de typecheck. Não é falha de isolamento.

**4B-C1-05 — Autorização depois da geração do PDF/ZIP.** Severidade n/a no contrato atual. Status RISCO FUTURO, não confirmado. `route.ts` gera os bytes e só então chama `authorize`; se falhar, não devolve o corpo. O núcleo também revalida sessão antes do JSON. A janela autorização→bytes e o controle do host pelo administrador estão declarados. Não há, no log, 200 de recibo para usuário 45–49 após `complete_ms`. Não transformo esse limite em vulnerabilidade local.

**4B-C1-06 — RLS sem policy nova e `management()` sem filtro de titular.** Severidade n/a no laboratório. Status RISCO FUTURO. `extensao.sql` faz `enable row level security` e `revoke all`, sem `CREATE POLICY` neste arquivo. `management()` lista sem `auth_user_id`, mas o handler exige origem `127.0.0.1:3102`, `is_active_admin` e sessão ativa, e remove `employee_id` da resposta. A prova nomeia “Admin Gestão não recebe download pessoal”; não reexecutei. A documentação diz que nada disso foi aplicado no Supabase remoto. Caminho remoto não evidenciado.

**4B-C1-07 — Cruzamento João/Maria e IDs de cliente.** Severidade n/a. Status não confirmado como falha. Código de lista/recibo/48h usa só `e.auth_user_id = $1`. Gateway rejeita query string (400) e porta fora de 3106/3107. No log, 45 `employee_id=` deram 400. Provas 4B registram João→Maria, Maria→João, sem equipe e admin sem download pessoal. Corpos dessas provas não estão no pacote. HTTP 200 da carga não mostrou recibo cruzado; os 200 da fase 07 são lista, begin, receipt, last48, events e `session/current` de contas não revogadas.

**4B-C1-08 — Saturação não é capacidade de produção.** Status RISCO FUTURO declarado. Um writer, um processo Next, ~2,1 req/s em 426 s, p95 na casa do timeout. Concorrência HTTP não prova pool distribuído. Não extrapolar.

## Fronteiras que o artefato sustenta, sem fechar o marco

A reorganização visual não aparece no caminho de intenção: `begin`/`events` continuam no núcleo 4A; GPS da carga é `DENIED`; idempotência é a chave da intenção; commit grava `recorded_at` distinto de `marking_at`. A amostra preserva os dois instantes. Recibo sintético não é REP-P, NSR, PAdES nem identificação legal; a amostra diz isso. Cópia baixada não é revogável. Prévia 3101/3105/3106 declarada intacta em `estado-pos-carga.json`; não reabri o processo.

Nenhuma baseline 4B, publicação ou Marco 4C está autorizada por este parecer.