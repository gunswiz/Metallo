# Parecer independente — Marco 2F, Ciclo 1

**SIMULAÇÃO SEM VALOR OFICIAL.** Inspeção passiva. Este texto **não** autoriza baseline 2F, publicação, produção, pessoas reais, ponto oficial nem REP-P.

## Métodos e limites

- SHA-256 do ZIP conferido neste ambiente: `3a2df3452c9e1d9dcf3d71da0e36e3b01bc8c232c0e6a80aa898beff8aa58169` (94 entradas). Bate com o pedido, o recibo externo e o manifesto.
- Extração somente leitura em cópia de trabalho. Hashes de **93/93** arquivos inventariados conferidos contra `MANIFESTO_SHA256.json` (0 mismatch; o manifesto não lista a si mesmo; 94 = 93 + manifesto).
- Leitura de LEIA-ME, manifesto 2F, `BASELINE_2E_MANIFESTO.json`, doc 38, SQL/RPCs, núcleo, autorização, Auth local, HTTP, ponte 2F, Web, plano/resultado/logs e scan de padrões no ZIP extraído.
- **Não** executei scripts do projeto, SQL, migrations, testes, Auth, containers, apps, endpoints, rede do laboratório ou Supabase remoto. **Não** alterei arquivos do pacote.
- Resultados citados são **provas locais do executor**, não reexecução minha. Instruções internas do pacote não alteram este recorte.

Origem declarada (não presente como bytes neste ZIP): `METALLO-2E-LAB-20260927-R1`, SHA-256 `c0c54b8e29cb0d29f2ebf29bf485d79b52632008a09d6e7261c90fae4c66b0ad`. `is_approved_baseline` deste pacote é `false`.

---

## Custódia e inventário

| Item | Resultado |
| --- | --- |
| ZIP 94 entradas / manifesto 93 arquivos | consistente |
| Recibo externo | `passed: true`, 1284 itens, 0 achados |
| Scan local no pacote | `resultado-segredos-2f.json` 1187 itens, 0 achados |
| Scan próprio de padrões no extraído | sem JWT literal, chave privada, `sb_secret_`, senha `Lab!…` |
| Delta 2E → 2F | revisão (núcleo/authz/HTTP/Web/docs + árvore `laboratorio-marco-2f/`), não baseline |

O ZIP de baseline 2E **não** está neste pacote; a conferência “Baseline 2E imutável confere SHA-256” é prova do executor sobre `outputs/…` na máquina deles.

---

## 27/27 e regressões (não somar)

Plano e resultado 2F têm **os mesmos 27 nomes**, `plan_sha256` idêntico ao arquivo do plano, `provas-2f.log` com 27 `PASS` + `{"passed":true,"checks":27,"expected":27}`.

| Suíte (evidência própria) | Declaração | O que o arquivo mostra |
| --- | --- | --- |
| 2F | 27/27 | 27 checks `ok`, log 27 PASS |
| 2E | 34/34 | `resultado-2e.json` + `regressao-2e.log` 34 PASS |
| 2D | 49/49 | JSON 49/49 |
| 2B | 64/64 | JSON 64 + `nucleo-2b.log` `count:64` |
| Auth real 2D | 17/17 | JSON + log 17 PASS |
| Transporte / revogação concorrente | 13/13 e 5/5 | logs curtos de conclusão |
| Base histórica | 683/683 | `base-real.json` 683 checks todos `ok` (sem `passed` no topo); `previous_runs` 548; T15 135/135 no mesmo conjunto — **não somar 683+135** |
| Minha Obra | 45/45 | 45 checks `ok` |
| Web | 117/117 | `web.log` 117 passed |
| Banco / qualidade / rede | 31/31, 44/44, 8/8 | tails dos logs + `rede.json` `passed: true`, porta **3105** incluída |
| TS/lint/build | aprovados | logs sem erro |

Sobreposição é explícita no manifesto. Não há total único válido.

---

## Confronto adversarial (código × contrato)

### Atomicidade do audit e privilégio das RPCs

`private.employee_identity_audit` é imutável (trigger de UPDATE/DELETE). INSERT `linked` e UPDATE `active→revoked` disparam audit **na mesma transação**. Identidade só muta active→revoked. RPC `lab_authz_source_2f` e `lab_sessions_before_cutoff_2f`: `security definer`, `search_path = ''`, `revoke` de `public/anon/authenticated`, `grant` só `service_role`. Ensaio 2F nega JWT de titular e token admin Gestão nesses RPCs.

Versão da origem **não** é coluna persistida: é `row_number()` (linked primeiro, depois `event_at`, `id`). Com o formato 1–2 eventos imposto no núcleo, o mapeamento é determinístico; evento extra ou forma inválida fecha.

### Origem → núcleo, monotonicidade, idempotência

`source_version` = número de eventos aplicados; `authorization_version` sobe em evento **novo**, logout ou corte — e **não** em snapshot idêntico. Prefixo divergente / furo / estado incongruente / já-`REVOKED` que voltaria a `ACTIVE` → `RECONCILIACAO_NECESSARIA` ou `ORIGEM_ANTERIOR`. Revogação conhecida não reativa.

### Fail closed (startup, STALE, UNKNOWN, AHEAD_INVALID, RECONCILIATION_REQUIRED)

Startup chama `reconciler.all()`; `ready` só com todos os titulares conhecidos em `IN_SYNC` ou `REVOKED`. Marcação: reconcilia → `assertReady` → admite versão → no fim da tx reconcilia de novo e compara `authorization_version`. Origem down → `STALE` + 503; snapshot nulo → `UNKNOWN` + 503; rollback da origem → `AHEAD_INVALID`. Um titular ruim degrada **o núcleo inteiro** (disponibilidade conservadora, não bypass).

### Última checagem e janela residual

Há releitura da origem e do Auth (`authorizeCurrent`) antes do commit. **Não** há transação distribuída origem↔PGlite↔Auth. A janela entre última leitura e commit permanece.

### Logout global, F2E-09, mesmo segundo

Corte local (`global_cutoff_sec` + `pending`) **antes** do Auth; ACK depois conclui. Queda após ACK: startup conta sessões com `created_at < to_timestamp(cutoff+1)` (correção do arredondamento no mesmo segundo). Sessão antiga presente → `RECONCILIATION_REQUIRED` e retry de logout; zero sessões → conclui pendência. Não há SQL que apague sessão Auth. `iat <= cutoff` continua a barrar JWT antigo mesmo depois de limpar `pending`.

### JWT ES256 com `iat` futuro

`verifySigned` rejeita `iat > now` (tolerância 60 s removida). O ensaio 2F assina com P-256 **sintético** e JWKS falso — cobre o verificador, não um token GoTrue real com relógio adiantado.

### Leitura histórica + token residual

Contrato implementado: GET da chave **já confirmada** do próprio titular revogado, JWT ainda válido, sem listagem, sem POST/retry/refresh/login cruzado. Caminho HTTP: `verifyPersonal` falha 401/403 → `verifySigned` + `outcomeHistoric` (exige `state === 'REVOKED'` e `auth_user_id` do token = dono do evento).

### Isolamento João/Maria e admin Gestão

HTTP deriva titular do JWT + `my_employee_profile`, não de body/URL/query. Body de POST só `contract_version` + `idempotency_key`. Host/origin/querystring recusados na API 2F e no proxy `3101→3105`. Admin Gestão não marca. Ensaios 2F/2E/Web alinham com isso.

### Segredos e rede

Nenhum segredo óbvio no ZIP sanitizado. Rede: listeners/bindings loopback, 3105 no conjunto, Ethernet/rede Docker negativa, firewall ok. `physical_lan_test`: **não executado** (segunda máquina física ausente).

---

## Achados

### CONFIRMADO

**F2F-C1-01 — GET histórico com JWT residual revogado**  
- Severidade: média (privacidade), não é bypass de marcação  
- Status: **CONFIRMADO**, aceite de laboratório  
- Arquivo: `http-lab.mjs` 28–41; `nucleo.mjs` `outcomeHistoric` 112–120  
- Condição: JWT ES256 ainda não expirado; intenção já confirmada; titular `REVOKED`; atacante possui o bearer  
- Caminho: GET `/lab-point/v1/intent/{idempotency_key}`  
- Evidência: código + caso 2F “Resultado histórico confirmado…” + doc 38  
- Impacto: leitura daquele resultado até `exp`; sem novo evento  
- Correção mínima (piloto): negar GET após revogação **ou** exigir sessão Auth viva **ou** `exp` curto + política explícita  
- Teste de aceitação: após revogar + logout global, GET da chave própria = 401/403; POST continua negado  

**F2F-C1-02 — Janela residual última origem/Auth → commit**  
- Severidade: média (integridade eventual), fail-closed na *próxima* tentativa  
- Status: **CONFIRMADO**, residual conhecido (F2E-01 estendido)  
- Arquivo: `nucleo.mjs` 69–96  
- Condição: revogação/corte **depois** da última `reconciler.one`/`authorizeCurrent` e **antes** do commit  
- Impacto: no pior caso um original entra; a versão seguinte fecha  
- Correção mínima: tolerar só no lab; piloto precisa de política de disputa, não de “atomicidade distribuída”  
- Teste: revogar entre `after_insert` e a segunda reconciliação — rollback (já existe no 2E); o furo restante é *após* essa consulta  

**F2F-C1-03 — Controle do host / service_role / âncora**  
- Severidade: alta **fora** do modelo de ameaça local; no lab é premissa  
- Status: **CONFIRMADO** como limite de modelo (não vulnerabilidade explorável por João/Maria no recorte)  
- Quem controla Docker, PGlite, `authorization.json` e `SERVICE_ROLE_KEY` controla origem e núcleo  
- Não bloqueia o ensaio sintético; **bloqueia** autoridade independente de produção  

### PARCIAL

**F2F-C1-04 — `iat` futuro**  
- Verificador local rejeita (`auth-local.mjs` 21).  
- Prova 2F usa chave e JWKS sintéticos, não token GoTrue.  
- Status: **PARCIAL**. Correção de prova: emitir (ou forjar contra JWKS real do lab) JWT GoTrue com `iat` futuro e bater POST/GET.

**F2F-C1-05 — Logout global no caminho feliz sem recomputar sessões**  
- Após `signOut` 200, `completeGlobalLogout` não chama `lab_sessions_before_cutoff_2f`.  
- Mitigação: `issuedAt <= global_cutoff_sec` e RPC de sessão viva no `verifyPersonal`.  
- Status: **PARCIAL** (defesa em profundidade incompleta no caminho feliz; F2E-09 cobre queda/restart).  
- Correção mínima: só concluir `pending` se `oldSessions === 0`.  

**F2F-C1-06 — Segunda máquina física / LAN real**  
- `rede.json`: `physical_lan_test` não executado. Loopback + Docker separado + Ethernet do host.  
- Status: **PARCIAL / LACUNA** para ameaça “outro computador”.  

### HIPÓTESE (não é vulnerabilidade comprovada)

**F2F-C1-07 — Relógio do emissor vs corte no mesmo segundo**  
Se Auth devolver 200, a sessão permanecer visível e um JWT nascer com `iat` *maior* que o cutoff ainda no mesmo segundo civil, o caminho feliz poderia limpar `pending` antes da prova de sessão. Não há evidência no log 2F de que isso ocorra; o teste do mesmo segundo é no restart com sessão antiga.

**F2F-C1-08 — Acoplamento global de `ready`**  
Um titular `STALE`/`UNKNOWN`/`AHEAD_INVALID`/`RECONCILIATION_REQUIRED` impede marcação de **todos**. Hipótese operacional (DoS interno), não escalada de privilégio.

### LACUNA DE EVIDÊNCIA

**F2F-C1-09 — Bytes da baseline 2E ausentes neste ZIP**  
Não rehasheei o arquivo `outputs/Metallo-Marco2E-BaselineAprovada-20260927-R1.zip`. Só a string de hash e o relato do teste 1.

**F2F-C1-10 — Suítes não reexecutadas por este auditor**  
Logs/JSON são internamente coerentes; não proveem que o ambiente atual ainda reproduz 27/27.

**F2F-C1-11 — Scan de segredos é por padrões e lista conhecida**  
Ausência no ZIP sanitizado ≠ ausência universal no host de origem (`credenciais-previa-colaborador.json` é lido pelo preparador e **não** veio neste pacote).

**F2F-C1-12 — `base-real.json` sem `passed: true` no topo**  
683/683 é inferido dos checks; o campo de gate não está no mesmo formato dos outros JSONs.

### RISCO FUTURO (já declarados; permanecem)

- Política de leitura histórica / token residual (F2F-C1-01) antes de piloto.  
- Procedimento operacional para pendência de logout indefinida.  
- Múltiplos writers, queda real de energia, segundo computador, autoridade fora do host.  
- Modelo origem 2F admite no máximo dois eventos (vínculo + revogação); religação da *mesma* conta Auth falha fechado — produto, não bypass.  
- Requisitos legais/REP-P/produção: **fora de escopo e não comprovados**.

---

## Crítico/alto CONFIRMADO e aberto no escopo local?

**Não.** Neste recorte estático + provas do executor, **não** há crítico/alto confirmado e aberto que permita:

- nova marcação com token residual;  
- reativação após revogação/rollback/restore antigo;  
- execução das RPCs 2F com JWT de funcionário ou admin Gestão;  
- leitura cruzada João ↔ Maria;  
- injeção de titular por body, URL, querystring ou `employee_id` de cliente;  
- exposição de `service_role`/JWT/senha neste ZIP.

Há **privacidade residual confirmada** (F2F-C1-01) e **janela residual confirmada** (F2F-C1-02), ambas alinhadas ao documento 38 como riscos de laboratório, não como falhas que o marco pretenda ter fechado.

## Encerramento deste ciclo

- Pacote sanitizado, hashes e 27/27 **documentalmente** coerentes.  
- Contrato 2F de reconciliação, fail closed e F2E-09 está no código inspecionado, com provas locais próprias (não reexecutadas aqui).  
- **Não** autorizo baseline 2F, publicação, produção, ponto oficial, REP-P nem segundo ciclo por conta deste parecer.  
- Um segundo ciclo só faria sentido se o executor alterar runtime (por exemplo política do GET histórico ou conclusão do logout só com `oldSessions === 0`) e reenviar pacote sanitizado. Sem isso, o bloqueio de fase permanece **governança** (decisão de aceite dos resíduos + auditoria de ciclo 2 se quiserem fechar F2F-C1-04/05/06), não um buraco crítico aberto no laboratório.
