# Auditoria independente — Marco 2E, ciclo 2 (último)

**SIMULAÇÃO SEM VALOR OFICIAL.** Pacote de **revisão**. Não é baseline, produção, REP-P, ponto oficial nem autorização de publicação.

**T:** continua **sem crítico/alto CONFIRMADO e aberto** no escopo local. **Não autorizo baseline 2E.**

---

## Métodos e limites

Inspeção **passiva** apenas: SHA-256 do ZIP, extração em `/home/workdir/inspect-c2`, leitura, busca, comparação com o ZIP do ciclo 1, recálculo de hashes.

**Não** executei scripts, SQL, testes, Auth, containers, endpoints, rede do laboratório nem Supabase remoto. `34/34` é testemunho do laboratório, não reexecução.

| Item | Valor |
|---|---|
| ZIP ciclo 2 | `2eb9dea5e270d86f891190de3e9f7b8c91b803eae84bb59cb90defc5528ad451` |
| Entradas | 65 (`inventory_count` 64 + manifesto) |
| Manifesto | `METALLO-2E-AUDITORIA-CICLO2`, `is_approved_baseline: false` |
| Hashes vs manifesto | **0 mismatches** |
| Origem 2D | `15d5e791c3237f8c7c98d316ddef7220c256ddc8b5b011f9c289741ab1691dd3` |
| Recibo scan **ciclo 1** incluso | SHA `33a2934b0c4fda4ce0d6332da5ee2ab7f6a00ab60862783a625b7ff7922d1ae6` — bate com o anexo |
| Parecer ciclo 1 | `parecer-grok-ciclo1.md` SHA `36d0377230e9fb18395d8aa5581a205f3d1d9f81ac17009366e534a8c257aa42` — bate com o doc 37 |
| Scan **direto deste ZIP ciclo 2** | **ausente** nos anexos (`resultado-segredos-2e.json` tem `"zip": null`) |
| Plano 2E | 34 casos; `plan_sha256` do resultado = arquivo do plano |

Delta ciclo 1 → 2: 17 arquivos alterados; novos `parecer-grok-ciclo1.md` e o recibo do ciclo 1. Fontes Web **idênticas** ao ciclo 1.

---

## Confronto dos sete achados do ciclo 1

| ID | Ciclo 1 | Ciclo 2 | Encaminhamento |
|---|---|---|---|
| **F2E-01** janela Auth→commit | PARCIAL | **RISCO FUTURO** (inalterado no código de commit) | Continua residual declarado. Sem prova de exploração. Aceito o adiamento. |
| **F2E-02** `iat` futuro + falha de logout global | HIPÓTESE | **Mitigado no caminho local** | Ver abaixo. |
| **F2E-03** dois browsers físicos | LACUNA | **LACUNA** (igual) | Sem novo ensaio E2E. |
| **F2E-04** restore dos 3 artefatos pelo host | RISCO FUTURO | **RISCO FUTURO** | Sem custódia nova. |
| **F2E-05** ponte Rₐ→Rₙ | RISCO FUTURO | **RISCO FUTURO** | Sem feed automático. |
| **F2E-06** doc sem scan do ZIP | CONFIRMADO (doc) | **Corrigido para o ciclo 1**; **reabre no ciclo 2** | Doc 37 agora cita scan/SHA do ciclo 1. Este ZIP 2 **não** trouxe recibo próprio. |
| **F2E-07** auditor não reexecuta | LACUNA de método | **LACUNA** (mandato igual) | Permanente neste fluxo. |

### F2E-02 — o que mudou de fato

Código novo:

- `autorizacao.mjs`: `global_logout_pending`; `logoutGlobal` liga `true` e sobe versão; `authorize()` nega **qualquer** sessão se pendente, **antes** de comparar `iat`; `completeGlobalLogout` só limpa o flag (e sobe versão de novo).
- `http-lab.mjs` 33–36: núcleo corta → `signOut` Auth → só então `completeGlobalLogout`.
- `processo-ensaio.mjs`: `signout_failure` injeta `ENCERRAMENTO_PENDENTE` sem chamar o Auth.
- Caso 34 no plano (declarado `2026-09-28T00:18:31.954Z`, **antes** do resultado `00:18`+): falha injetada, pendente `true`, `authorize()` com `issuedAt = now+30` lança `SESSAO_ENCERRADA`, POST HTTP 401, zero evento extra, restart ainda 401.

Isso **fecha o caminho que eu descrevi na autoridade local**. O próprio pacote admite o limite restante: **não** foi emitido JWT ES256 com `iat` adiantado. Isso deixo como **LACUNA menor**, não como buraco aberto no corte local.

Efeito colateral consciente: se o Auth confirmar o logout e o processo cair **antes** de `completeGlobalLogout`, o titular fica **negado até reconciliação no host**. O doc 37 registra isso. Não é bypass João/Maria; é lockout operacional. Ver F2E-09.

---

## Achados deste ciclo

### F2E-02 (atualizado) — corte pendente cobre `iat` futuro na autoridade local

| Campo | Conteúdo |
|---|---|
| **Severidade** | Residual baixa (só a lacuna E2E do JWT adiantado) |
| **Status** | Controle local **PARCIAL→fechado no código + testemunho 34/34**; JWT criptográfico futuro = **LACUNA DE EVIDÊNCIA** |
| **Arquivo/linha** | `autorizacao.mjs` 42, 56–63; `http-lab.mjs` 33–36; `provas-2e.mjs` 67 |
| **Condição que restaria** | Adversário com JWT **assinado** cujo `iat` > cutoff **e** `global_logout_pending=false`. Com pendente `true`, o `iat` deixa de importar. |
| **Evidência** | Caso nomeado no plano e `ok: true` no `resultado-2e.json`. Doc 37 item 5 não superdeclara a prova. |
| **Impacto** | Hipótese do ciclo 1 não permanece explorável no registro 2E inspecionado. |
| **Correção mínima** | Nenhuma obrigatória no núcleo. Opcional: ensaio com relógio Auth enviesado. |
| **Teste de aceitação** | Já descrito no caso 34; aceito como testemunho, não reexecutado. |

### F2E-08 — ZIP ciclo 2 sem scan direto; recibo apontado não existe

| Campo | Conteúdo |
|---|---|
| **Severidade** | Informativa / processo |
| **Status** | **CONFIRMADO** |
| **Arquivo/linha** | `MANIFESTO_SHA256.json` `secret_scan_receipt`; `LEIA-ME.md` L9; doc 37 L44; `resultado-segredos-2e.json` `"zip": null`; anexos desta conversa |
| **Condição** | Tratar este ZIP como já varrido da mesma forma que o ciclo 1 |
| **Caminho / falha** | Manifesto cita `outputs/Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo1.zip.verificacao.json.verificacao.json` (sufixo duplicado, arquivo **inexistente**). `gerar-pacote-auditoria-2e.py` L142 usa `name + ".verificacao.json"`, mas o campo gravado não é o nome do ZIP 2. LEIA-ME do ciclo 2 ainda diz que o recibo externo é scan **deste** ZIP. Doc 37 exige scan novo “antes do envio”. Anexos: só o recibo do ciclo 1. |
| **Evidência** | Hash do ZIP 2 acima; scan 2E em `2026-09-28T00:29:38Z` com `zip: null`, 0 achados em fontes/evidências (1181 arquivos), não no ZIP 2. Varredura passiva minha neste extract: 0 JWT literal, 0 chave privada, 0 `Lab!…`, 0 `sb_secret`. |
| **Impacto** | Não prova segredo no ZIP 2; enfraquece a custódia do envelope. Não é bypass de titularidade. |
| **Correção mínima** | Gerar `….Ciclo2.zip.verificacao.json` por scan **direto** no ZIP; corrigir o campo do manifesto; ajustar o LEIA-ME. Sem terceiro ciclo de auditoria Grok (máximo 2). |
| **Teste de aceitação** | Recibo com SHA `2eb9dea5…`, `entries: 65`, `findings: []`. |

### F2E-09 — pendência global sem auto-reativação

| Campo | Conteúdo |
|---|---|
| **Severidade** | Baixa operacional (fail-closed) |
| **Status** | **RISCO FUTURO** (declarado) |
| **Arquivo/linha** | `autorizacao.mjs` 60–62; doc 37 § sessões |
| **Condição** | `signOut` global ok **ou** processo interrompido após `logoutGlobal` e antes de `completeGlobalLogout` |
| **Caminho** | Titular ativo no vínculo, sessão Auth nova possível, núcleo ainda `global_logout_pending=true` → toda marcação 401 |
| **Evidência** | Código + texto “não há rota de auto-reativação” |
| **Impacto** | Disponibilidade no laboratório; exige operador do host. Não devolve acesso revogado. |
| **Correção mínima** | Fora de 2E: reconciliação explícita após Auth confirmar, ou job que limpa o flag só se não houver sessões. |
| **Teste de aceitação** | Após `signOut` real ok e crash sintético antes do complete: POST negado; após complete manual: novo login após 1 s aceito. |

F2E-01, 03, 04, 05, 07 permanecem como no ciclo 1, sem código novo que os feche.

---

## A–T (ciclo 2)

A, B–C, D–F, G (logout local), I (duas sessões), K–L (restart/restore PGlite), M–N, O–P, Q, S: iguais ao ciclo 1, com o extra do corte pendente em G/J.

**J (logout global):** fail-closed mais forte que no ciclo 1 se o Auth não confirmar.

**R:** fontes/evidências do pacote sem segredo óbvio; **envelope ZIP 2 sem recibo direto**.

**T:** **não** há crítico/alto confirmado e aberto no escopo local.

---

## Fechamento

O ciclo 2 **confrontou** o parecer do ciclo 1 e **corrigiu F2E-02 no registro local**, com plano de 34 casos alinhado ao resultado registrado. Os limites de atomicidade distribuída, host admin, dois browsers físicos e não-reexecução **continuam**. O defeito de custódia F2E-08 é de pacote, não de autorização João/Maria.

Com o máximo de dois ciclos atingido: a revisão 2E pode ser **encerrada tecnicamente como revisão local**, ainda **sem baseline**, **sem 2F** e **sem valor oficial**.

**SIMULAÇÃO SEM VALOR OFICIAL.**