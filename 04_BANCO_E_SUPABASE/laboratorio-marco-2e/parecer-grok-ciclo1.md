# Auditoria independente — Marco 2E (Ciclo 1 de 2)

**SIMULAÇÃO SEM VALOR OFICIAL.** Pacote de **revisão**, não baseline, não produção, não REP-P, não ponto oficial, sem pessoas reais e sem autorização de publicação.

**Veredito T:** **não há crítico/alto CONFIRMADO e aberto** no escopo local inspecionado que impeça o **fechamento técnico local desta revisão**. Isso **não** autoriza baseline 2E nem produção.

---

## Métodos e limites (declarados)

Inspeção **passiva** neste ambiente, apenas:

- conferência SHA-256 do ZIP recebido;
- extração para `/home/workdir/inspect` (cópia de leitura);
- listagem, leitura, busca e comparação de arquivos;
- recálculo de hashes de todas as 62 entradas do manifesto.

**Não foi feito:** executar scripts do projeto, SQL, migrations, testes, Auth, containers, apps, endpoints, rede do laboratório, Supabase remoto, nem modificar o pacote. Resultados `33/33` etc. são **evidência registrada pelo laboratório**, não reexecução minha. Texto interno do ZIP não foi tratado como autorização extra.

ZIP recebido: SHA-256 `34208c2b8a9557903274779120e119e5ecc4734d1da3ad2c6084b6d14a22fc12` — **coincide** com o pedido e com `Metallo-Marco2E-Revogacao-Auditoria-20260927-Ciclo1.zip.verificacao.json`. Recibo externo: `passed: true`, `findings: []`, 63 entradas, 1244 arquivos varridos (com aninhados).

Manifiesto: `is_approved_baseline: false`, origem `METALLO-2D-LAB-20260927-R1` / `15d5e791c3237f8c7c98d316ddef7220c256ddc8b5b011f9c289741ab1691dd3`. 62 arquivos listados; hashes e tamanhos **0 mismatches**; `MANIFESTO_SHA256.json` é a 63ª entrada. Delta 2D→2E: 21 alterados, 26 novos. Suítes **não somadas**.

---

## Respostas A–T (síntese)

| ID | Pergunta | Conclusão | Status da evidência |
|---|---|---|---|
| **A** | JWT válido sozinho marca? | No código 2E, não: ES256 + JWKS + `iss/aud/exp/iat` + `/auth/v1/user` + `my_employee_profile` + `lab_active_session_2e` (service_role) + `authorization_version` local. `servidor-2e.mjs` liga `requireSession:true`. | **PARCIAL** (código + resultado 2E; sem reexecução) |
| **B–C** | Versão monotônica, admissão e pré-commit, rollback se mudar? | `change()` exige `next > current`. `recordInternal` captura versão na admissão e compara de novo após `authorizeCurrent`, antes do epoch/âncora. Logout de outra sessão com a sessão do pedido ainda ativa → `409 AUTORIZACAO_DESATUALIZADA`, contagem inalterada (caso no plano). | **PARCIAL** |
| **D–F** | Residual / refresh / novo login após revogação? | Após corte Rₙ `REVOKED` + revogação na origem, casos registrados negam marcação, retry, refresh e novo login; JWT ainda com `exp` futuro. | **PARCIAL** |
| **G–J** | Logout atual/global, duas abas, duas sessões | Logout local bloqueia `session_id` antes do Auth; outra sessão segue. Global sobe `global_cutoff_sec` e pede `scope=global`. Duas abas no backend = duas requisições com o mesmo `session_id`. UI: geração + `storage` + ocultação síncrona. **Não há dois navegadores físicos.** | Controle **PARCIAL**; dois browsers = **LACUNA** |
| **K–L** | Restart / restore antigo | Restart no ensaio preserva `REVOKED` e nega residual. Restore PGlite + âncora atual → `RECOVERY_REQUIRED`; arquivo de autorização externo não reduz versão. Restore simultâneo dos **três** artefatos pelo dono do host não tem custódia independente. | Controle **PARCIAL**; host = **RISCO FUTURO** |
| **M–N** | Retry de K confirmada / revogada | Antes da revogação, retry devolve o mesmo original (`200`, `deepEqual`). Depois, retry é 401/403 e não cria evento. Idempotência exige mesmo titular e mesmo `request_hash`. | **PARCIAL** |
| **O–P** | João/Maria atravessam titularidade? | Body só aceita `contract_version,idempotency_key`. IDs vêm do JWT/DTO. Intent cruzado 404. Maria após corte de João vê só o evento dela. | **PARCIAL** |
| **Q** | Admin da Gestão no núcleo? | Pedido HTTP com token de admin registrado como 401/403; núcleo não marca. RPC de sessão negada a JWT do portal. Admin Gestão não é autoridade do PGlite. | **PARCIAL** |
| **R** | Segredo em browser/bundle/log/pacote? | Neste ZIP: 0 JWT literal, 0 chave privada, 0 `sb_secret`, 0 senha `Lab!…`. Scan interno 2E e recibo externo: zero achados. `service_role` só em menção de código. Sessão no `localStorage` da prévia é desenho do cliente, **não** está no pacote. | **PARCIAL** (varredura local + recibos; ausência universal impossível) |
| **S** | Body/URL/query/IDs do cliente contornam titular? | Extra `employee_id` → 400. Querystring recusada no cliente e no `route.ts`. Host ≠ `127.0.0.1:3101` e path fora do contrato → 400/404. | **PARCIAL** |
| **T** | Crítico/alto comprovado e aberto? | **Não.** | **CONFIRMADO** quanto à *ausência de comprovação* neste ciclo passivo |

---

## Achados numerados

### F2E-01 — Janela residual Auth→commit (declarada)

| Campo | Conteúdo |
|---|---|
| **Severidade** | Média (residual de desenho; não é RCE nem bypass estável) |
| **Status** | **PARCIAL** — comportamento lido no código e admitido no doc 37; **não** é exploração reproduzida aqui |
| **Arquivo/linha** | `nucleo.mjs` ~89–95; `http-lab.mjs` 40–41; doc 37 § autoridade / limites |
| **Condição necessária** | Pedido já passou admissão; `INSERT` feito; `authorizeCurrent()` (re-JWT + sessão + perfil) **já retornou OK**; autoridade de origem revoga **depois** dessa consulta e **antes** do commit; e o arquivo local de autorização **não** mudou de versão nesse intervalo |
| **Caminho** | Marcação em voo → Auth corta sessão/vínculo após a última verificação síncrona → commit do original no PGlite |
| **Evidência** | O próprio documento: “Se a autoridade revogar **depois** dessa consulta e antes do commit, ainda há janela residual: não se declara atomicidade distribuída.” O caso “revogação entre INSERT e commit” do plano corta **antes** de `authorizeCurrent` e espera rollback — não cobre o instante **após** essa chamada. |
| **Impacto** | No máximo um original sintético a mais na janela; próximo pedido falha fechado. Sem transação distribuída Rₐ↔Rₙ. |
| **Correção mínima** | Manter a admissão explícita do residual **ou** encurtar: reconsultar sessão **e** versão imediatamente antes do commit, em seção crítica única; outbox Rₐ→Rₙ continua fora deste marco. |
| **Teste de aceitação** | Failpoint **depois** de `authorizeCurrent` e **antes** do incremento de epoch: revogar na origem; esperar rollback e zero evento extra. |

Não classifico como crítico aberto: está documentado, a fila é de um processo, e o ensaio vizinho falha fechado quando a revogação é visível na consulta final.

---

### F2E-02 — `global_cutoff_sec` vs `iat` futuro se o Auth não confirmar logout global

| Campo | Conteúdo |
|---|---|
| **Severidade** | Média (condicional) |
| **Status** | **HIPÓTESE** — não é vulnerabilidade comprovada |
| **Arquivo/linha** | `autorizacao.mjs` 43, 55–57; `auth-local.mjs` 28 (`iat` até `now+60`); `http-lab.mjs` 30–36 |
| **Condição necessária** | `logoutGlobal` no núcleo aplica `cutoff = floor(now/s)`; `auth.signOut(..., 'global')` **falha**; JWT com `session_id` ainda em `auth.sessions` e `iat > cutoff` (relógio Auth adiantado ou `iat` no slack de 60 s) |
| **Caminho** | Logout global pendente no Auth → corte local por `iat` não pega token “no futuro” → `lab_active_session_2e` ainda verdadeiro → `authorize()` segue `ACTIVE` |
| **Evidência** | Código. Ensaios usam tokens **já emitidos** (`iat` ≤ cutoff). Doc 37 assume que “o núcleo já nega marcações antigas” se o Auth não confirmar — verdadeiro para `iat` passado, não demonstrado para `iat` à frente. |
| **Impacto** | Só com falha de logout Auth **e** assimetria de relógio/`iat`. Logout **local** não depende disso (`blocked_sessions`). |
| **Correção mínima** | No logout global, também registrar os `session_id` conhecidos **ou** usar `iat < cutoff` com margem ≥ slack de verificação **ou** recusar pedido enquanto `ENCERRAMENTO_PENDENTE` se a sessão Auth ainda existir. |
| **Teste de aceitação** | Emitir token com `iat = now+30`, falhar o logout Auth, repetir POST `/events`; esperar 401 `SESSAO_ENCERRADA`. |

---

### F2E-03 — Duas abas físicas / dois navegadores

| Campo | Conteúdo |
|---|---|
| **Severidade** | Baixa (cobertura) |
| **Status** | **LACUNA DE EVIDÊNCIA** |
| **Arquivo/linha** | `provas-2e.mjs` 40, 52; doc 37 § provas; `use-colaborador-session.ts` 22–52, 110–126; `colaborador-ponto.test.tsx` 73–89 |
| **Condição** | Afirmar divergência insegura **entre dois browsers reais** |
| **Caminho / falha de prova** | Backend: mesmo JWT duas vezes. UI: Vitest + geração. Não há Playwright/dois perfis. |
| **Evidência** | Doc 37: “as guardas de interface entre abas vêm da suíte Web, não de dois navegadores físicos.” |
| **Impacto** | Não demonstra bug. Reduz confiança na UX de corrida entre abas. |
| **Correção mínima** | Ensaio E2E com dois contextos (mesmo `session_id` e sessões distintas) contra 3101/3104. |
| **Teste de aceitação** | Aba B após `Sair` em A: sem histórico e sem POST 201; segunda sessão independente sobrevive ao logout local. |

---

### F2E-04 — Restore coordenado pelo dono do host

| Campo | Conteúdo |
|---|---|
| **Severidade** | Alta **somente** se o adversário for o administrador do host (fora do modelo “titular vs titular”) |
| **Status** | **RISCO FUTURO** (declarado; não é bypass entre João e Maria) |
| **Arquivo/linha** | `autorizacao.mjs` 1–2; `nucleo.mjs` 31–35; doc 37 § recuperação e limites |
| **Condição** | Controle simultâneo de PGlite + âncora + `*.authorization.json` (+ código) |
| **Caminho** | Reescrever os três artefatos para estado `ACTIVE` / versão menor |
| **Evidência** | Restore só do PGlite no ensaio entra em `RECOVERY_REQUIRED` e mantém `REVOKED`. Doc: “Uma restauração simultânea controlada pelo administrador do host… não tem proteção independente.” |
| **Impacto** | Sem custódia/assinatura, o host é autoridade absoluta. Irrelevante para o adversário só com JWT de portal. |
| **Correção mínima** | Fora de 2E: custódia cindida ou assinatura do registro de autorização. |
| **Teste de aceitação** | Restaurar os três arquivos a um snapshot pré-corte e exigir falha de integridade **assinada** — hoje inexistente. |

---

### F2E-05 — Ponte Rₐ→Rₙ não automática

| Campo | Conteúdo |
|---|---|
| **Severidade** | Média operacional (não é furo de titularidade no núcleo já cortado) |
| **Status** | **RISCO FUTURO** / limite de marco |
| **Arquivo/linha** | doc 37; `provas-2e.mjs` 61 (`revokePreviewAccount` **e** `authorization_state`) |
| **Condição** | Revogação só na Gestão/Auth, sem `setState('REVOKED')` no arquivo 2E |
| **Caminho** | Enquanto Rₙ não aplica o corte, a defesa é a consulta síncrona Auth (`my_employee_profile` + ban + sessão). Se Auth cair, o núcleo **nega** (caso “Auth indisponível”). |
| **Evidência** | Ensaio de revogação pessoal aplica os dois lados de propósito. “Não há feed automático.” |
| **Impacto** | Corte empresarial pode atrasar no registro local; não há ACK Rₙ sem passo explícito. |
| **Correção mínima** | Fora de 2E (2F+): outbox/inbox ou recusa contínua até ver versão de origem. |
| **Teste de aceitação** | Revogar só em Rₐ, sem tocar o JSON 2E; POST com JWT residual deve falhar só pela consulta Auth; documentar o atraso de Rₙ. |

---

### F2E-06 — Documentação 37 desatualizada quanto ao scan do ZIP 2E

| Campo | Conteúdo |
|---|---|
| **Severidade** | Informativa |
| **Status** | **CONFIRMADO** (inconsistência documental, não falha de autorização) |
| **Arquivo/linha** | `37_…md` ~44: “ainda não há ZIP 2E para scan direto”; `LEIA-ME.md` e recibo `.verificacao.json` |
| **Condição** | Ler o doc 37 isolado |
| **Evidência** | Recibo externo deste ZIP: scan direto, 0 achados. |
| **Impacto** | Rastreio de evidência, não exploração. |
| **Correção mínima** | No ciclo 2, atualizar o parágrafo para apontar o recibo `…Ciclo1.zip.verificacao.json`. |
| **Teste de aceitação** | Doc 37 cita o SHA do ZIP e `findings: []`. |

---

### F2E-07 — Provas e regressões são testemunho, não reexecução

| Campo | Conteúdo |
|---|---|
| **Severidade** | Informativa (método) |
| **Status** | **LACUNA DE EVIDÊNCIA** inerente ao mandato passivo |
| **Arquivo/linha** | `resultado-2e.json` (`passed: true`, 33 checks, `plan_sha256` = plano, `origin_sha256` = 2D); logs web/banco/qualidade; `previous_runs` com 32 casos depois 33 |
| **Condição** | Fechar 2E como se o auditor tivesse rodado Auth/HTTP |
| **Impacto** | Posso atestar **coerência interna** (plano = nomes dos testes = 33/33; manifesto = hashes). Não posso atestar que o laboratório não foi encenado. |
| **Correção mínima** | Nenhuma neste ciclo; ciclo 2 pode só confrontar deltas. |
| **Teste de aceitação** | N/A sob permissão atual. |

---

## Controles lidos (não são vulnerabilidades)

- Titularidade: `my_employee_profile` usa `auth.uid()`, sem `employee_id` de entrada; portal `profiles.active` tem de ser falso; RPC de sessão `security definer` + `search_path = ''`, revoke `public/anon/authenticated`, grant só `service_role`; função 0-arg antiga é dropada.
- Monotonicidade e estados: `ACTIVE` não é reaplicável por `setState`; `STALE`/`UNKNOWN` → 503; `REVOKED`/`SUSPENDED` → 403.
- Logout: núcleo **antes** do Auth; se Auth falha, cliente vê pendência e limpa storage mesmo assim.
- Cliente Meu Ponto: confirmação só após GET autorizado; 401/403 zeram histórico visível; idempotência reutiliza a chave offline.
- Transporte 3101→3104: flags de prévia, host loopback, sem querystring, Bearer limitado, body ≤ 1024.
- Segredos: pacote sem `.env`, sem `backups/`, sem PGlite, sem credenciais; `gerar-pacote-auditoria-2e.py` recusa esses caminhos.

## O que este ciclo **não** fecha

Queda real de energia/disco, vários writers, segundo computador, atomicidade distribuída, política de retenção/timeout de produção, consulta empresarial ao histórico após desligamento, assinatura oficial, 2F.

---

**Não autorizo baseline 2E.**  
**Não há crítico/alto CONFIRMADO e aberto no escopo local que impeça o fechamento técnico desta revisão.**  
Há residual declarado (F2E-01), uma hipótese de corte global + `iat` (F2E-02) e lacunas de prova física/reexecução (F2E-03, F2E-07). Isso basta para **não** promover o pacote a baseline.

**SIMULAÇÃO SEM VALOR OFICIAL.**