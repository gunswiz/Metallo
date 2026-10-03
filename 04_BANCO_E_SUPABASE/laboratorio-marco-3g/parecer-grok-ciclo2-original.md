**SIMULAÇÃO SEM VALOR OFICIAL.** Segundo e último ciclo. Inspeção passiva apenas. Não é aprovação de baseline 3G, remoto, produção, publicação, ponto oficial ou REP-P. Não há ciclo 3.

## Recebimento e integridade

| Item | Resultado |
| --- | --- |
| ZIP ciclo 2 | `Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo2.zip` (254 327 bytes) |
| SHA-256 do ZIP (recomputado) | `0a515284042bfed92583dd9a7b5d1f70052733f26044d94834ab0f6c4bc56039` — confere com o envio e com o recibo externo |
| Recibo externo | `…Ciclo2.zip.verificacao.json`; `findings: []`, `passed: true`, `is_approved_baseline: false`, 67 entradas, 14 credenciais locais checadas (valores omitidos) |
| Manifesto | `METALLO-3G-AUDITORIA-CICLO2`, `is_approved_baseline: false`, 66 arquivos + o próprio manifesto = 67 entradas |
| Hashes das 66 entradas | conferidos um a um; zero mismatch |
| Recibo do ciclo 1 (dentro do ZIP) | SHA do ZIP 1 `f8a7cb2af2eb2e4bf077b0cb610b9fe41015ddd73cc17ea41ebdaec544d91cd5`; scan sem achados |
| Parecer ciclo 1 no pacote | SHA `b4137d96f77c679e010dc3b6ea7967f591456b89c43ebc51c8ce8e424ac34d38` — igual ao declarado na doc 45 |
| Origem 3F | declarada; ZIP 3F **não** veio; hash da origem **não** recomputado |
| Código/SQL 3G entre ciclos | os arquivos de produto que já estavam no ciclo 1 **não mudaram**. Só mudaram manifesto, inventário, LEIA-ME, prompt e a doc 45. O restante do ciclo 2 são evidências que faltavam |

Provas 34/34, 40/40 e 209/209 continuam sendo do laboratório, não execução deste auditor.

---

## Confronto local — erros e acertos

A matriz da doc 45 está, no conjunto, alinhada ao código agora visível. **Não encontrei erro material** que reabra um crítico/alto.

Ajustes de precisão (não invalidam o confronto):

1. No ciclo 1, F-3G-04 era **lacuna de pacote** (“constraint não vista”), não afirmação de que o `CHECK` não existia. Tratar a ausência como INVALID no ciclo 2 está correto **depois** da migration `20260902231312` L46 e do catálogo `epi_stock_batches_quantity_check`.
2. O dump chama-se `catalogo-local-ciclo1.txt` e é relato do projeto. É coerente com as migrations anexas; **não** é consulta que eu tenha feito no Postgres.
3. `executarOperacaoValidada.ts` **difere** da baseline 3F (`ceed537e…` → `dfcf4c2c…`) por mensagens 3G (`forbidden_stock_location`, `stock_return_requires_original_batch`, etc.). Não é reescrita de 3C/3D/3E. O formulário `formulario-operacao.tsx` permanece `2baa4427…` (idêntico à 3F) e bloqueia reenvio enquanto `pending`.

---

## Reavaliação F-3G-01 … F-3G-15

### F-3G-01 — chave UUID da Gestão por render
- **Ciclo 1:** PARCIAL / MÉDIA  
- **Ciclo 2:** **PARCIAL / MÉDIA** — risco residual de operação, **não** bypass do servidor  
- **Evidência nova:** `formulario-operacao.tsx` L13–16 ignora submit se `pending` e desabilita o fieldset. Duplo clique **na mesma instância** fica coberto. Duas abas ou remount após timeout ainda geram UUID novo (`itens/page.tsx` L43/L62/L70). O banco só colapsa a **mesma** chave.  
- **Confronto:** correto ao recusar deduplicar pelo conteúdo (entregas iguais legítimas).  
- **Decisão pendente:** o que conta como “mesma intenção” após remount. Sem regra empresarial, não é falha de integridade do saldo na última unidade (aí F-3G-04 serializa).

### F-3G-02 — lote central (`worksite_id` nulo)
- **Ciclo 2:** **CONFIRMADO como comportamento herdado** / MÉDIA de **política**, não regressão 3G  
- **Evidência nova:** `epi_stock_read` no catálogo e na migration de EPI: `can_operate('epi:write') AND (worksite_id IS NULL OR equipe da obra)`. `register_epi_delivery` (`site_operations.sql` L568) também só confronta obra se o lote **tem** obra. `can_operate('epi:write')` sem equipe é verdadeiro para admin ou quem já tem a capability (`user_operation_permissions.sql` L16–30).  
- **Distinção:** não é furo novo do 3G; é o modelo central pré-existente. Restringir só no 3G seria política nova e assimétrica.

### F-3G-03 — transação entrega+baixa / timeout
- **Ciclo 2:** **PARCIAL** — desenho CONFIRMADO; timeout de cliente após COMMIT permanece acoplado a F-3G-01  
- SQL final: `FOR UPDATE` + `UPDATE … AND quantity >= p_quantity` + insert na mesma função. `register_epi_delivery` no lote compartilhado também usa `FOR UPDATE` + débito + insert (L563–586).  
- Provas locais de rollback **não reexecutadas**.

### F-3G-04 — saldo negativo / última unidade
- **Ciclo 2:** lacuna da constraint **ENCERRADA**; execução independente continua **LACUNA** (proibida)  
- **Estado:** controle **CONFIRMADO no estático**; não é falha aberta  
- `CHECK (quantity >= 0)` na criação da tabela e no dump. Caminho 3G e caminho EPI serializam o mesmo lote. Pedido 2 com saldo 1 não passa no 3G.

### F-3G-05 — exceção UI vs servidor
- **Ciclo 2:** **não é bypass** (confronto adequado). Residual baixo: o booleano é ciência operacional.  
- Servidor: admin global ativo + motivo + `p_exception_confirmed is true` + nota se `OTHER`. UI: opção só com `role === "admin"`; `requireProfile()` exige `active`.

### F-3G-06 — João/Maria e IDs
- **Ciclo 2:** **não é IDOR** no contrato 3G. Controles CONFIRMADOS no SQL. Provas 34/34 não reexecutadas.  
- Titular por `auth.uid()`; portal com `NOT profile.active`; Gestão por `can_manage` / `can_operate`.

### F-3G-07 — devolução, legado, inativação
- **Ciclo 2:** **PARCIAL / MÉDIA** — decisão administrativa ainda aberta  
- Retorno só ao lote original; legado sem reintegração; DAMAGED/LOST sem `STOCK_REUSABLE`; close idempotente nos campos. Continua a exigir funcionário e item **ativos**. Desligamento sem regra de close é risco operacional, não saldo negativo espontâneo.

### F-3G-08 — 3C/3D/3E e rota sem `kind`
- **Ciclo 2:** regressão de fontes **não confirmada**. UX da rota antiga **PARCIAL / BAIXA**  
- Hashes idênticos à baseline 3F:

| Arquivo | SHA-256 (3F = ciclo 2) |
| --- | --- |
| `epi-report-3e.ts` | `e364ea889f769a68fc0e31177c2370ecdb27afb4f68b067ac22b7c7dae8a9b74` |
| `epi-report-3e-pdf.ts` | `086e865362adff791e19ce4fbaf924891457b021ffb61ef113d9389500170ad2` |
| `contrato-troca-epi.sql` | `d1b39ce61db2f2cb770251285d35db3a78b5889fb6f470136206d7b9b5e13ec0` |
| `contrato-entrega-confirmacao.sql` | `2e71cc63f89c745cef89d737a578f2c70dcf8d4dd330054768392c34ef2be71c` |
| `contrato-ficha-historico.sql` | `3206f7d4c31c053b9dccfdeb24a7e69eb11cdda73c1cf6cce63d5e19b3aca9e5` |
| docs 41/42/43 | iguais à 3F |

- `contrato-troca-epi.sql` não referencia `epi_stock_batches`. `decide_personal_item_3g` só insere evento. Gatilho `use_personal_items_3g` cobre insert legado mesmo se `/epis/entrega` abrir sem `kind`. Mensagem de erro dessa URL ainda pode melhorar.

### F-3G-09 — assinaturas e grants
- **Ciclo 2:** **INVALID no laboratório retratado pelo dump**; **RISCO FUTURO** de aplicar SQL lab fora de ordem ou no remoto  
- Dump: uma `deliver_personal_item_3g` com **10** args, owner `postgres`, `authenticated=X`, sem SELECT privado para `authenticated`/`anon`, `anon` sem execute. Sete RPCs públicas 3G, todas DEFINER. 3G **continua fora** de `supabase/migrations/`.

### F-3G-10 — SECURITY DEFINER
- **Ciclo 2:** **PARCIAL / BAIXA-MÉDIA** — modelo explícito, não bypass achado  
- Owner `postgres`, `search_path=''` nas funções 3G, autorização por `auth.uid()` / `is_active_admin` / `can_operate`. `can_operate` agora está no pacote (DEFINER, `search_path=''`, lê `profiles` do `auth.uid()`, inativo → false). `admin_personal_items_3g` devolve lista vazia sem escopo.

### F-3G-11 — funcionário sem equipe na lista
- **Ciclo 2:** **não confirmado como vazamento**. Estado: **ENCERRADO como falha**; residual só se o dump/policy local não for o banco real  
- `20260926224000_unassigned_employee_management_scope.sql` + catálogo: `epi_employees_read` exige `is_active_admin()` **ou** `team_id IS NOT NULL` com `can_operate('epi:write', …)`. `listEmployees`/`getEmployee` continuam sem filtro extra na UI; a RLS passa a ser a fronteira.

### F-3G-12 — leitura de lotes/catálogo
- **Ciclo 2:** **PARCIAL / BAIXA** — minimização, não vazamento ao portal  
- Action no servidor + RLS de lote (obra ou central, este último = F-3G-02). A query não restringe `item_kind`; a página filtra `personal_tool` antes de renderizar. Portal allowlist segue sem tabela de estoque.

### F-3G-13 — erro e layout
- **Ciclo 2:** **sem regressão demonstrável neste ambiente**. Prova visual/DOM não reproduzida (proibida). Classificação de erro sem SQL/stack permanece no código.

### F-3G-14 — pacote incompleto
- **Ciclo 2:** **em grande parte sanado**. Residual: dump não é sessão viva; suítes 34/40/209 não são minhas; ZIP 3F ausente (hash da origem não recomputado, como pedido). Números históricos 191/197/208 vs **209/209 finais** agora estão explícitos na doc 45.

### F-3G-15 — substituição já encerrada / problema antes de confirmar
- **Ciclo 2:** **HIPÓTESE / BAIXA** — sem regra empresarial. O SQL permite; não move estoque indevido.

---

## Críticos e altos

**CRÍTICO confirmado e aberto: nenhum.**  
**ALTO confirmado e aberto: nenhum.**

Nada neste ciclo eleva F-3G-01 ou F-3G-02 a alto: o primeiro é retry/identidade de operação sem política; o segundo é estoque central **já usado pelo EPI**.

## O que ainda precisa de decisão (não de terceiro ciclo de auditoria)

- Critério de “mesma intenção” na Gestão após remount (F-3G-01).  
- Se lote central deve exigir admin global ou capability própria (F-3G-02) — mudança **transversal**, não só 3G.  
- Encerrar/devolver com funcionário ou item inativo (F-3G-07).  
- Semântica de problema antes da confirmação e de substituta já encerrada (F-3G-15).  
- Se lab SQL 3G algum dia vira migration — só com autorização expressa; hoje o remoto permanece fora do escopo.

## Veredito deste ciclo

O ciclo 2 cumpriu o que o ciclo 1 pediu em evidência estrutural: constraint de quantidade, RLS de empregado/lote, `can_operate`, `register_epi_delivery` com `FOR UPDATE`, owner/grants no dump, fontes 3C/3D/3E com hashes iguais à 3F, formulário com guarda de `pending`, recibos de scan. **Não houve correção de produto entre os ciclos.** Riscos que restam são de política ou de processo, não falha crítica/alta confirmada no SQL 3G inspecionado.

**Não aprovo baseline, publicação, produção, remoto, ponto oficial ou REP-P.** Marco 3G permanece aberto do ponto de vista de governança do projeto; este auditor encerra a revisão passiva nos dois ciclos previstos.