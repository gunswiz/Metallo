# Parecer independente — Marco 2F, Ciclo 2 (último)

**SIMULAÇÃO SEM VALOR OFICIAL.** Inspeção passiva. **Não** autoriza baseline 2F, publicação, produção, pessoas reais, ponto oficial nem REP-P. Não há terceiro ciclo.

## Métodos e limites

- ZIP conferido neste ambiente: SHA-256 `3d9178e8e549d79d37ab66d5186b438665cb18da7575e96cb7cc7c4279bae9d0` (100 entradas). Bate com o pedido, o recibo externo e o manifesto (`zip_entries: 100`, `inventory_count: 99`).
- Hashes internos: **99/99** sem divergência. O manifesto não lista a si mesmo.
- `BASELINE_2E_ORIGINAL.zip`: 292 887 bytes, SHA-256 `c0c54b8e29cb0d29f2ebf29bf485d79b52632008a09d6e7261c90fae4c66b0ad`. Os 66 arquivos inventariados em `BASELINE_2E_MANIFESTO.json` batem em tamanho e hash (0 ausentes, 0 mismatch).
- Parecer do ciclo 1 preservado: `parecer-grok-ciclo1.md` SHA-256 `0c86fda4abfc9d5587d232cbc2adb6c362a28a2afd2f917fcbf0f811f13dcd7e`, igual ao manifesto.
- Recibo externo C2: 1361 itens, `findings: []`. Scan de padrões neste extraído: sem JWT literal, chave privada, `sb_secret_` ou senha `Lab!…`.
- Somente leitura. **Não** reexecutei projeto, SQL, Auth, testes, rede ou Supabase remoto. O ciclo 1 **não** é o estado final.

`is_approved_baseline`: **false**.

---

## O que mudou no runtime

Única alteração de comportamento 2F relevante ao parecer C1: `http-lab.mjs` 49–60.

Depois de `logoutGlobal` (ou retry) e ACK do Auth, se o núcleo 2F tem reconciliador:

1. chama `reconcileUser()`;
2. só responde **200** se `status === 'IN_SYNC'`;
3. caso contrário lança `503 RECUPERACAO_NECESSARIA` e **não** chama `completeGlobalLogout` direto.

`reconciliacao.mjs` (hash idêntico ao C1) só conclui a pendência quando `oldSessions === 0`. Sessão remanescente → `RECONCILIATION_REQUIRED`, corte e `pending` intactos.

Núcleo, autorização, Auth local, SQL de origem e ponte: hashes iguais aos do ciclo 1.

Ensaio novo (caso 28): injeta `oldSessions → 1` → POST global = 503, `pending === true`, zero evento; restaura a origem e `reconcileUser()` → `IN_SYNC`. Plano/resultado 28/28 com os mesmos 28 nomes; `plan_sha256` idêntico.

Caminho 2E sem reconciliador (`historicalOutcomeEnabled` falso) ainda conclui após ACK. O servidor 2F (`servidor-2f.mjs`) sempre liga a origem local.

---

## Provas declaradas (não somar, não reexecutadas por mim)

| Suíte | Declaração C2 | Evidência no pacote |
| --- | --- | --- |
| 2F | **28/28** | `resultado-2f.json`, `provas-2f.log` 28 PASS |
| 2E | 34/34 | `regressao-2e-after.log` (e o log anterior) |
| 2B | 64/64 | `nucleo-2b-after.log` `count:64` (descartável; a fixture consumida da 1ª tentativa está documentada, não é regressão de produto) |
| Web | 117/117 | `web-after.log` |
| Demais (2D, Auth, transporte, concorrente, 683, 45, banco, qualidade, rede, TS/lint/build) | números iguais ao C1 | **não reexecutadas** nesta correção pontual, como declarado |

---

## Confronto F2F-C1-01 … F2F-C1-12

| ID | Veredito C2 | Correção / limitação / aceite |
| --- | --- | --- |
| **F2F-C1-01** GET histórico + JWT residual | **VALID** | Sem correção de contrato. Risco de privacidade **aceito só no laboratório**. Código e caso 28/28 ainda permitem GET da chave própria confirmada ao revogado. |
| **F2F-C1-02** janela última leitura → commit | **VALID** | Sem correção. Residual **aceito**. `nucleo.mjs` inalterado. |
| **F2F-C1-03** controle do host | **VALID** | Limite de modelo, não bypass João/Maria. **Aceito** no lab; bloqueia produção. |
| **F2F-C1-04** `iat` futuro | **PARTIAL** | Sem correção nova. Verificador + ensaio sintético permanecem; token GoTrue real com relógio adiantado **não** ensaiado. Limitação de prova. |
| **F2F-C1-05** logout feliz sem prova de sessão | **VALID** e **corrigido** no 2F | Código + caso 28. Pendência só some com `oldSessions === 0`. 503 + pending + zero evento na injeção. |
| **F2F-C1-06** segunda máquina física | **VALID** (lacuna) | `rede.json` / `rede.log` 8/8; `physical_lan_test` segue não executado. Sem reexecução de rede nesta correção. |
| **F2F-C1-07** mesmo segundo / relógio | **PARTIAL**, hipótese **mitigada** no 2F | Conclusão agora exige RPC `cutoff+1`. JWT GoTrue com `iat` futuro real continua sem prova E2E (cruza C1-04). |
| **F2F-C1-08** `ready` global | **VALID** | Escolha conservadora inalterada. Disponibilidade, não privilégio. |
| **F2F-C1-09** bytes da baseline 2E | **VALID** no C1; **fechado como lacuna de pacote** no C2 | ZIP embutido conferido por mim: SHA e 66/66 arquivos do manifesto 2E. |
| **F2F-C1-10** auditor não reexecuta | **VALID** | Mandato inalterado. |
| **F2F-C1-11** scan não é ausência universal | **VALID** | Recibo C2 1361/0 no ZIP; não cobre host fora do pacote nem padrões novos. `resultado-segredos-2f.json` interno ainda aponta o scan do ZIP do **ciclo 1** (1284); o gate do ZIP C2 é o recibo externo. |
| **F2F-C1-12** `base-real.json` sem `passed` no topo | **VALID** (formato) | Sem mudança; 683 checks `ok` + T15 à parte. Não somar. |

Nenhum dos doze foi **INVALID**. Nenhum ficou **NOT VERIFIABLE** no que o C2 se propôs a mostrar: C1-09 passou a verificável nos bytes; C1-05 verificável no código e no log local.

---

## Achados deste ciclo

### CONFIRMADO (não é bypass de marcação)

Nada novo que permita marcar, reativar, ler cruzado ou chamar RPC 2F com JWT de funcionário/admin.

Residual **ainda confirmado**, sem mudança de contrato:

- privacidade F2F-C1-01;
- janela F2F-C1-02;
- host F2F-C1-03.

### PARCIAL / documentação

**F2F-C2-01 — parágrafo de contrato do doc 38 atrasado em relação ao código**  
- Severidade: baixa (consistência documental)  
- Status: **PARCIAL / CONFIRMADO como texto**, não como falha de runtime  
- Arquivo: `38_MARCO_2F_RECONCILIACAO_E_FECHAMENTO_SINTETICO.md` ~17 (“Depois de ACK do Auth, a pendência é concluída”) vs confronto F2F-C1-05 e `http-lab.mjs` 55–59  
- Impacto: o leitor do contrato curto pode achar que o ACK basta; o código 2F já exige prova de sessão  
- Correção mínima: alinhar o parágrafo 17 ao predicado `oldSessions === 0` (pode ser feito fora deste ciclo; **não** pede terceiro envio Grok)  
- Teste: o caso 28 já expressa o contrato real  

### HIPÓTESE

Nenhuma hipótese nova elevada a vulnerabilidade. C1-07 permanece hipótese de relógio **mitigada** no caminho 2F, não provada com JWT GoTrue adiantado.

### LACUNA DE EVIDÊNCIA

- F2F-C1-10: eu não reexecutei 28/28 nem 2E/2B/Web.  
- 2D, Auth real, histórico 683, banco, qualidade, rede: provas **anteriores**, não desta correção.  
- F2F-C1-06: sem segundo computador.  
- F2F-C1-04: sem token GoTrue de `iat` futuro.

### RISCO FUTURO (inalterado; bloqueia piloto/produção, não o fechamento técnico de lab)

Política de GET histórico; operação de logout pendente indefinido; autoridade fora do host; queda real de energia; múltiplos writers; requisitos legais/REP-P.

---

## Crítico/alto CONFIRMADO e aberto no escopo local?

**Não.**

Não há crítico/alto confirmado e aberto que, no laboratório inspecionado, permita nova marcação indevida, reativação após revogação/rollback/restore, bypass das RPCs 2F, leitura João↔Maria ou injeção por body/URL/query/IDs de cliente.

F2F-C1-05, que era o único ponto de runtime pedido após o ciclo 1, está **corrigido e evidenciado localmente** no 2F.

## Fechamento técnico em laboratório

**Sim, recomendo o fechamento técnico do Marco 2F no laboratório sintético**, no sentido de: contrato 2F implementado, ciclo 1 confrontado, C1-05 corrigido, C1-09 suprido com bytes da baseline 2E, 28/28 e regressões pontuais documentadas, **nenhum crítico/alto aberto**.

Isso **não** é:

- baseline 2F;
- autorização de publicação;
- produção, ponto oficial ou REP-P;
- prova de segundo computador, energia real ou ausência universal de segredos;
- aceite empresarial da leitura histórica por token residual.

Decisão de baseline, se houver, é do responsável **depois** deste parecer, em ato separado. Este ciclo 2 encerra a auditoria Grok passiva do 2F.
