**SIMULAÇÃO SEM VALOR OFICIAL.** Este parecer não autoriza baseline, uso real, produção, publicação ou REP-P. O ZIP é pacote de revisão, não baseline.

## Métodos e limites

Inspeção **somente passiva** no ambiente do auditor: listagem e extração do ZIP, leitura de texto, busca de padrões e SHA-256. **Não** executei o projeto, SQL, migrations, testes, Auth, containers, scripts do laboratório, nem acessei `127.0.0.1` ou a rede do lab. **Não** reexecutei as provas. Contagens 48/48, 17/17 etc. são as gravadas nos JSON de evidência.

- ZIP conferido: `edc90b89e9aabad242197cbcb0a4ad156d1f5552239132406dcc36a4d9cde395` (250 entradas).
- Origem declarada no manifesto: `METALLO-2B-LAB-20260927-R1` / `7df0935cd75e5b1e822b08fbaf40f53f2b1f4f8c98b5d2dcdb10610c4928b1d0`. Baseline 2B **não** estava neste pacote; o hash só foi lido como referência.
- Manifesto: `is_approved_baseline=false`, 249 arquivos + `MANIFESTO_SHA256.json`, delta 64 (46 novos / 18 alterados). Hashes dos arquivos-chave 2D conferidos contra o manifesto.
- Backup sintético `database.tar.gz` SHA-256 `99f599d2b7c6a49ffe23a1494c1bc3a0bb4255758ecba75c2dfc9e072529fc15` (bate com manifesto do backup e com `delivered_backup_sha256`). Digest e `payload_hash` v1 recomputei **offline** a partir do inventário JSON: três hashes e o digest `f293d4fd…` conferem.
- Scan de padrões (chave privada, `sb_secret`, senha `Lab!…`, JWT) no extrato e nos membros do `.tar.gz`: zero achados. Recibo externo `.zip.verificacao.json` **não** veio neste chat; o pedido afirma scan final do ZIP aprovado.

Resultados históricos (2B, 1A/T15, 1C, web, etc.) foram lidos como regressão declarada e **não somados**.

---

## Achados

### D-01 — Âncora/digest não cobrem `lab_context` (revogação local revertível sem `DIVERGENT`)
**Severidade:** média  
**Arquivo/trecho:** `integridade.mjs` `eventDigest` = `sha256(JSON.stringify([snapshot.events, snapshot.results]))`; `recuperacao.mjs` `stateOf` usa só `database_id`, `recovery_epoch`, `event_count`, `digest`.  
**Cenário:** SQL privilegiado no mesmo banco faz `update lab_context set active=true, context_status='active'` após revogação. Eventos/resultados intactos → digest e epoch iguais → `compareAnchor` = `MATCH` → startup `READY` → João volta a marcar. Categoria J não ensaiou esse corte; K só persiste revogação **sem** adulterar contexto.  
**Efeito no gate 2D:** não quebra crash/retry/backup de E/R; enfraquece “integridade + autorização local” frente a escrita privilegiada no próprio PGlite (classe próxima do dono do host, já admitida, mas **mais barata** do que restaurar banco+âncora).  
**Correção mínima:** incluir contextos (ou digest separado) em `stateOf`/`eventDigest`; recusar `READY` se contexto divergir; ensaiar adulteração de `active`/`context_status`/`valid_until` na categoria J.

### D-02 — Resultados idempotentes e contexto sem trigger append-only
**Severidade:** média (baixa para E/R se o verificador rodar)  
**Arquivo/trecho:** `schema.sql` — trigger só em `lab_time_event` (`BEFORE UPDATE OR DELETE`). `lab_intent_result`, `lab_context`, `lab_recovery_state` aceitam `UPDATE`.  
**Cenário:** `update lab_intent_result set auth_user_id=…` é detectado (`RESULTADO_INCOERENTE`, J). `TRUNCATE`/`UPDATE` coordenado de resultado+âncora+epoch é o caminho do administrador. Alteração só de contexto cai em D-01.  
**Efeito no gate:** não desmente I7 para o original; lacuna de imutabilidade do par completo.  
**Correção mínima:** triggers equivalentes em resultado/metadados (contexto pode continuar mutável, mas então entra no digest — D-01).

### D-03 — Plano “congelado” é reescrito pelo próprio executor
**Severidade:** baixa (processo/evidência)  
**Arquivo/trecho:** `provas-2d.mjs` e `provas-auth-real-2d.mjs` fazem `writeFileSync` de `plano-*-2d.json` **no início da corrida**, com `frozen_before_execution: true`.  
**Cenário:** `resultado-2d.json` guarda duas corridas anteriores **47/47**; a atual é **48/48**. O caso novo é `Kill real em after_database_commit` (ausente nas 47). O plano no pacote é o da última execução, não um artefato independente anterior ao código.  
**Efeito no gate:** não invalida o conteúdo dos checks gravados; reduz independência do “plano congelado”.  
**Correção mínima:** gravar o plano numa revisão anterior, com hash no manifesto, e o executor só **ler/comparar**.

### D-04 — Health “somente campos técnicos” não é fechado pelo teste
**Severidade:** baixa  
**Arquivo/trecho:** `http-lab.mjs` `health()` devolve também `status` e `official`; doc 36 lista só oito campos. Teste B só afirma `name in h.data`.  
**Cenário:** payload de `/health` é maior que o contrato escrito; neste código não há IDs de titular.  
**Efeito no gate:** documental.  
**Correção mínima:** contrato explícito allow-list + asserção de chaves exatas.

### D-05 — Falha de lock ainda sobe listener HTTP sem núcleo
**Severidade:** baixa  
**Arquivo/trecho:** `processo-ensaio.mjs` (`core=null` no `catch`) e `servidor.mjs` (`startLabServer` mesmo se `createLabCore` falhar). Teste A só exige `ready_for_new_events === false`.  
**Cenário:** segundo processo não escreve no PGlite (lock), mas liga porta loopback com fachada 503.  
**Efeito no gate:** não é segundo writer; é superfície extra.  
**Correção mínima:** não fazer `listen` se o núcleo não abriu; asserir `core === null` e ausência de bind.

### D-06 — `verifyPersonal` não prova linha em `auth.sessions` / logout
**Severidade:** risco futuro explícito (não bloqueador 2D)  
**Arquivo/trecho:** `auth-local.mjs` — ES256, JWKS, `iss`/`aud`/`exp`/`session_id` **formato**, `/auth/v1/user`, `my_employee_profile`. Nenhuma leitura de `auth.sessions`. Doc 35/36 e decisões A2/A4 já registram isso.  
**Cenário:** JWT ainda aceito pela API Auth após logout sem ban/revogação de conta. A suíte 17/17 cobre pausa do container Auth, João revogado **na identidade** e token residual após restart — não política de sessão.  
**Efeito no gate 2D:** fora do mínimo autorizado.  
**Correção mínima:** só com A4 — checagem de sessão viva e testes de logout.

---

## O que o código/evidência **sustentam** (leitura, sem reexecução)

Crash/retry (C) e commit sem resposta: seis cortes com `SIGKILL` no filho; evidência `crashes[]` — 0 par + retry 201 até `after_anchor_before_commit`; 1 par + retry 200 em `after_database_commit` e `after_commit`. Protocolo de âncora: só `MATCH` / `ABORTED_PENDING` / `COMMITTED_PENDING`; resto `DIVERGENT` → `RECOVERY_REQUIRED`. `prepareAnchor` dentro da transação SQL + `finishAnchor` depois de `syncToFs`; catch tenta reconciliar pendência abortada.

Atomicidade E/R: insert de evento+resultado+epoch na mesma transação; retry da mesma chave não incrementa epoch; chave com `contract_version` diferente → `INTENCAO_CONFLITANTE`.

Startup: modo `open` exige `PG_VERSION`, **não** corre `schema.sql`; criação/adoção são explícitas (`ferramentas-recuperacao.mjs` `adotar-copia-legada`). Health 200 só com ready + Auth + algum snapshot ativo; read-only por `default_transaction_read_only` → 503 e POST negado (ensaio B). Estado nomeado `STARTING` do doc 36 **não aparece** no JSON de health (antes do `listen` não há socket).

Shutdown: `accepting=false`, `closeIdleConnections`, `core.close`, timeout 10 s tratado como falha. Ensaio E: INSERT barrado em `after_insert`, shutdown, `release`, 201, `graceful_shutdown=1`, listener morto, 1 par na reabertura.

Backup: fila exclusiva, `verifyIntegrity`, âncora sem `pending`, `syncToFs`, `dumpDataDir('gzip')`, releitura SHA. Restore em destino novo; sem âncora de referência **não** inventa arquivo; restore A/B/C com âncora no epoch 5 → esperado 5 vs observado 3; chave pós-backup e chave nova recusadas com `RECUPERACAO_NECESSARIA`. Segunda exportação da suíte tem SHA distinto (`this_run_backup_sha256`); o entregue é o da primeira corrida.

Hash v1: sequência canônica 2B; `hash_version=1`; `server_committed_at_utc` é preenchido **antes** do INSERT (nome legado). Hash **não** é assinatura digital.

João/Maria: isolamento HTTP após restart nas suítes storage (tokens sintéticos) e Auth real (ES256). Auth pausado: health `UNAVAILABLE`, POST 503, zero evento novo. Token residual pós-revogação + restart: 401/403, contagem estável.

Listeners: bind `127.0.0.1`; ensaio N tenta IPv4 não internos. IPC só no pai; sem rota HTTP de failpoint.

`collector_version` ainda é `metallo-colaborador-lab-2b` — residual de nome, sem efeito de integridade.

---

## Vulnerabilidades demonstradas vs lacunas vs futuro

**Demonstradas no código (passivo):** D-01, D-02, D-05. Nenhuma é adulteração silenciosa de original E/R **sem** privilégio no host; D-01 é o mais próximo de “integridade que o 2D afirma verificar” e ainda assim exige escrita local no PGlite.

**Lacunas de evidência:** D-03, D-04; health `STARTING` só documental; teste do segundo processo é fraco; recibo `.zip.verificacao.json` ausente **neste** envio (scan interno 2D `findings: []`; pedido afirma ZIP limpo). Não há prova neste pacote de fsync de diretório, queda de energia, disco cheio, dois writers cooperantes, segundo PC, nem de `auth.sessions`.

**Riscos futuros já explícitos no 35/36 (não reclassificar como falha 2D):** dono do host restaura **banco e âncora** ou troca o código; energia/disco; múltiplos writers (lock de PID é cooperativo); janela Rₐ→commit entre motores; A2/A4 sessão/logout; hash ≠ assinatura.

---

## Fechamento técnico local

**Não há crítico/alto aberto que, no escopo mínimo 2D (recuperação local / integridade sintética), impeça o confronto de fechamento técnico local**, desde que D-01/D-02 fiquem registrados como limitação da âncora (não como “à prova de DBA”) e as provas **não** sejam tratadas como reexecutadas aqui.

**Não** fechar como baseline. **Não** autorizar uso real, produção, publicação ou REP-P. Permanecem A2/A4 e os riscos de infraestrutura. UI inalterada; `ui_changed: false`.

Próximo ciclo (máx. 2), se quiserem endurecer o gate sem sair do 2D: digest de contexto + teste J correspondente, e plano de testes com hash pré-execução.