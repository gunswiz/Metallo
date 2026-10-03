**SIMULAÇÃO SEM VALOR OFICIAL.** Auditoria passiva, ciclo 1 de no máximo 2. Não é aprovação de baseline 3G, remoto, produção, publicação, ponto oficial ou REP-P.

## Recebimento e integridade

- Anexo recebido: `Metallo-Marco3G-ItensPessoais-Auditoria-20260930-Ciclo1.zip` (145 127 bytes).
- SHA-256 do ZIP **recomputado e conferido**: `f8a7cb2af2eb2e4bf077b0cb610b9fe41015ddd73cc17ea41ebdaec544d91cd5`.
- Manifesto: `MANIFESTO_SHA256.json` (`id` `METALLO-3G-AUDITORIA-CICLO1`, `is_approved_baseline: false`, rótulo obrigatório de simulação).
- 48 entradas do manifesto: hashes e tamanhos **conferidos um a um** contra os arquivos extraídos. Zero mismatch. A 49ª entrada do ZIP é o próprio manifesto (não listado em `files`).
- Origem declarada `METALLO-3F-LAB-20260929-R1` / `76e964041e3f4a06ce4c11cc0fdc58fa8a3429bb68d8db2a4a248918356ea3d4`. O ZIP 3F **não veio no pacote**; o hash da origem **não foi recomputado**.
- Recibo de scan de segredos aponta para `outputs/…verificacao.json`, **ausente** do ZIP.
- Provas locais 34/34, 40/40 e 209/209 são do laboratório; **não foram reexecutadas** e não valem como verificação independente.

Escopo inspecionado: listagem, extração, leitura, busca e hashes. Nenhum script, SQL, migration, teste, Auth, container, endpoint, localhost, rede de laboratório ou Supabase remoto foi acionado.

---

## Síntese adversarial

No papel, o desenho final (contrato + `integracao-estoque-3g.sql` + `endurecimento-excecao-3g.sql`) coloca **débito do lote e insert da entrega na mesma função PL/pgSQL**, com `FOR UPDATE`, `UPDATE … AND quantity >= p_quantity` e rollback implícito da transação. Exceção `WITHOUT_STOCK` exige admin global ativo, motivo enumerado, confirmação explícita e nota se `OTHER`. Devolução reutilizável só no `stock_batch_id` original; dano/extravio não repõem; legado `LEGACY_PRE_INTEGRATION` não inventa lote. Isolamento João/Maria nas RPCs pessoais resolve o titular por `auth.uid()`, não por parâmetro de cliente.

Isso **não fecha** o marco. Há lacunas de pacote, superfície de UI que não estabiliza a intenção, lote central sem ACL de obra, SQL 3G fora de `supabase/migrations`, e impossibilidade de atestar 3C/3D/3E ou o catálogo vivo do banco.

**Críticos confirmados e abertos no escopo local: nenhum.**  
**Altos confirmados e abertos: nenhum com exploração estática completa; o mais grave aberto é parcial (F-3G-01, F-3G-02).**

---

## Achados

### F-3G-01 — Idempotência da Gestão é só a chave UUID, não a intenção
- **Severidade:** MÉDIA  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `01_WEB/app/(02_SISTEMA)/funcionarios/[id]/itens/page.tsx` L43, L62, L70; `endurecimento-excecao-3g.sql` L42–53; `integracao-estoque-3g.sql` L37–46  
- **Condição:** operador abre a mesma ficha em duas abas, ou a página SSR é regenerada após timeout, e submete de novo.  
- **Caminho:** cada render gera `crypto.randomUUID()` novo no hidden `idempotencyKey`. O servidor só colapsa a **mesma** chave (advisory lock + `UNIQUE` + comparação de payload + `delivered_by = auth.uid()`). Chaves diferentes = duas entregas e dois débitos, até o saldo acabar.  
- **Evidência:** o colaborador **segura** a chave em `useRef` (`meus-itens.tsx` L31–35). A Gestão não. A prova “M: duas abas” em `provas-estoque-3g.mjs` L70–74 reutiliza a **mesma** chave RPC, não duas páginas Next.  
- **Impacto:** duplo clique na mesma instância do form pode ser salvo por `pendingLabel`; duas abas ou retry após remount baixam estoque duas vezes.  
- **Correção mínima:** derivar a chave da intenção (funcionário + item + lote + quantidade + ator) no servidor, ou persistir um operation ID estável no cliente até sucesso/conflito.  
- **Aceitação:** duas abas da mesma ficha, mesmo lote com saldo 1, uma saída; retry HTTP com formulário remounted não cria segunda entrega.

### F-3G-02 — Lote central (`worksite_id` nulo) sem checagem de localização
- **Severidade:** MÉDIA  
- **Estado:** CONFIRMADO (comportamento de código)  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L54–67  
- **Condição:** lote com `worksite_id IS NULL` (“central” na UI).  
- **Caminho:** o `IF v_batch.worksite_id is not null` é falso; qualquer sessão que passe `can_manage_personal_item_3g` no **funcionário** debita o lote central.  
- **Evidência:** o bloco de obra só corre quando o lote tem obra; a UI rotula `worksite_id` vazio como “central”.  
- **Impacto:** gestor de uma obra drena estoque central de item pessoal de outra unidade, se tiver `epi:write` sobre o destinatário.  
- **Correção mínima:** exigir permissão explícita de estoque central (admin global ou capability própria), não só escopo do funcionário.  
- **Aceitação:** líder só da obra A não debita lote central; admin global sim.

### F-3G-03 — Entrega+baixa atômica no SQL final; timeout de cliente não está no pacote
- **Severidade:** BAIXA no desenho; evidência de timeout é lacuna  
- **Estado:** PARCIAL (desenho CONFIRMADO; timeout LACUNA)  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L54–76  
- **Condição:** falha no `UPDATE` ou no `INSERT` dentro da mesma função.  
- **Caminho:** uma transação; provas injetam trigger de débito/insert (`provas-estoque-3g.mjs` L175–204) — não executei.  
- **Evidência estática:** não há commit intermediário; `UPDATE … quantity>=p_quantity` + `IF NOT FOUND`.  
- **Impacto residual:** cliente que timeout **depois** do COMMIT e remonta o form cai em F-3G-01.  
- **Correção mínima:** operation ID estável (F-3G-01) + resposta idempotente já existente.  
- **Aceitação:** abortar a conexão no meio da RPC não deixa débito sem entrega; retry da mesma intenção não desconta de novo.

### F-3G-04 — Concorrência saldo 1 / saldo nunca negativo no caminho 3G
- **Severidade:** — (controle presente)  
- **Estado:** PARCIAL (estático CONFIRMADO; execução independente LACUNA)  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L55–67  
- **Condição:** João e Maria (ou duas sessões admin) pedem a última unidade do mesmo `stock_batch_id`.  
- **Caminho:** `SELECT … FOR UPDATE` serializa; o segundo vê `quantity < p_quantity` ou o `UPDATE` condicional falha; exceção `insufficient_personal_item_stock`; insert não ocorre.  
- **Evidência:** código + prova declarada “N” (não reexecutada). Não há `CHECK (quantity >= 0)` de `epi_stock_batches` **neste ZIP**.  
- **Impacto residual:** outro fluxo no **mesmo** lote (`register_epi_delivery`, recebimento) não está no pacote.  
- **Correção mínima:** `CHECK (quantity >= 0)` no lote compartilhado e o fluxo EPI com o mesmo `FOR UPDATE`.  
- **Aceitação:** duas entregas paralelas na última unidade → 1 sucesso, 1 recusa, saldo 0; pedido 2 com saldo 1 não cria entrega.

### F-3G-05 — Exceção sem estoque: UI vs servidor
- **Severidade:** BAIXA  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L25–39; `entrega-item-pessoal-3g.tsx` L25–26, L50–51; `itens/page.tsx` L45; `itens-pessoais-3g.ts` (actions) L13–25  
- **Condição:** `WITHOUT_STOCK` sem admin ativo, sem motivo, sem `p_exception_confirmed=true`, ou `OTHER` sem nota.  
- **Caminho:** servidor recusa (`forbidden_exceptional_delivery` / `invalid_personal_item_delivery`). UI só mostra a opção se `profile.role === "admin"` (não `is_active_admin()`). `requireProfile()` já exige `active`.  
- **Evidência:** admin inativo é desviado para `/acesso-pendente` na Gestão; RPC ainda checa `is_active_admin()`. Confirmação é um **booleano de parâmetro**, não um segundo fator.  
- **Impacto:** admin malicioso autenticado sempre pode passar `true`. Controle operacional, não prova de origem física.  
- **Correção mínima:** alinhar UI a `is_active_admin` / `admin:manage`; manter a checagem no servidor (já está).  
- **Aceitação:** líder com `epi:write` e João em chamada direta não criam `WITHOUT_STOCK`; `OTHER` sem nota recusado; saldo e contagem de lotes inalterados.

### F-3G-06 — Isolamento João/Maria e injeção de IDs
- **Severidade:** — (controle presente nas RPCs 3G)  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `contrato-itens-pessoais.sql` `personal_item_actor_3g` L74–86; `confirm_personal_item_3g` L158–160; `report_personal_item_3g` L183–185; `my_personal_items_3g` (integração L141–164)  
- **Condição:** Maria envia `delivery_id` de João; João envia `p_employee_id` de Maria em `deliver_*`.  
- **Caminho:** ator = `auth.uid()` → identidade ativa → funcionário ativo, com `NOT profile.active` (modelo portal vs Gestão). Confirm/report exigem `employee_id = ator`. Deliver exige `can_manage` no destinatário; portal não tem.  
- **Evidência:** JSON pessoal não inclui `stock_batch_id`/`stock_origin`; `RETURNED.category` é anulado no portal (integração L152).  
- **Impacto residual:** Gestão autenticada no escopo **pode** entregar para qualquer empregado que `can_manage` permitir — é o fluxo.  
- **Correção mínima:** nenhuma no contrato 3G; falta RLS de `epi_employees` no pacote (F-3G-12).  
- **Aceitação:** Maria não lista/confirma/reporta item de João; injeção de `employee_id` no portal não muda o titular.

### F-3G-07 — Devolução ao lote original, legado, dano/extravio, encerramento
- **Severidade:** MÉDIA (funcionário inativo / item inativo)  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L119–133, L101–102  
- **Condição:** `STOCK_REUSABLE` após troca de equipe/obra; legado; `PROBLEM` DAMAGED/LOST; retry do close.  
- **Caminho:** reposição só se `stock_origin='STOCK_BATCH'`; `FOR UPDATE` no lote histórico; **não** exige obra atual do funcionário (delta de endurecimento); exige `can_manage` em **alguma** equipe da obra do lote, ou lote central; bloqueia se houver problema DAMAGED/LOST; close já existente é idempotente nos campos (não na chave). Legado não tem `stock_batch_id` → não reintegra.  
- **Evidência:** `close` exige `epi_employees.active` e item de catálogo `active`. Funcionário desligado ou item desativado **prende** o saldo fora do lote.  
- **Impacto:** baixa operacional correta para o caso feliz; encerramento impossível após desligamento.  
- **Correção mínima:** autorizar close de devolução por admin global mesmo com funcionário inativo; não exigir `item.active` para repor no lote original.  
- **Aceitação:** mudança de obra repee só o lote antigo; legado não sobe saldo; dano/extravio recusados em `STOCK_REUSABLE`; funcionário inativo ainda devolve ao lote via admin.

### F-3G-08 — Troca 3G não baixa; 3C/3D/3E não estão no pacote
- **Severidade:** — para 3G; LACUNA para regressão 3C/3D/3E  
- **Estado:** PARCIAL / LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** `decide_personal_item_3g` em `contrato-itens-pessoais.sql` L257–282; `colaborador-app.tsx` L76–80; `colaborador-local.ts` L21–23  
- **Condição:** pedido/aprovação de troca 3G; entrega 3D; PDF/recibo 3E; troca EPI 3C.  
- **Caminho:** `decide_*` só insere evento; não toca `epi_stock_batches`. Portal ainda chama `my_epi_delivery_groups_3d`, `respond_epi_delivery_3d`, `my_epi_report_3e`, `create_epi_exchange_request`.  
- **Evidência:** delta 3F→3G **não** inclui geradores PDF nem SQL 3C/3D/3E. `pdf-lib` permanece em `package.json`. `/epis/entrega` redireciona só se `kind=personal_tool` (`epis/entrega/page.tsx` L10).  
- **Impacto:** não dá para afirmar que 3G “não reescreveu” 3D/3E no servidor. Entrega EPI com `item` pessoal **sem** `kind` ainda abre `SiteOperations`; o gatilho `use_personal_items_3g` deve barrar o insert legado.  
- **Correção mínima:** redirecionar também quando o item resolvido for `personal_tool`; incluir no próximo ciclo os fontes 3C/3D/3E e o SQL de `register_epi_delivery`.  
- **Aceitação:** aprovação de troca 3G com saldo inalterado; `register_epi_delivery` de `personal_tool` recusado; hashes 3E idênticos à origem 3F.

### F-3G-09 — Assinaturas RPC antigas e grants
- **Severidade:** MÉDIA (processo)  
- **Estado:** RISCO FUTURO + LACUNA (catálogo vivo)  
- **Arquivo/linha:** `integracao-estoque-3g.sql` L14–16; `endurecimento-excecao-3g.sql` L9; grants L78–81  
- **Condição:** aplicar só o contrato, ou aplicar fora de ordem, ou publicar o SQL de laboratório.  
- **Caminho:** contrato cria `deliver_personal_item_3g(6 args)` **sem estoque**. Deltas fazem `DROP` e recriam 8 e depois 10 args. `authenticated` recebe `EXECUTE`; `anon` e `service_role` são revogados nas tabelas privadas. RLS ligado, **nenhuma policy** — deny-by-default + bypass DEFINER.  
- **Evidência:** 3G **não** está em `04_BANCO_E_SUPABASE/supabase/migrations/` (só lab). Web barreia URL `http://127.0.0.1:54321` (`itens-pessoais-3g.ts` L6–8) — só na camada Next.  
- **Impacto:** banco remoto ou lab incompleto pode ficar com RPC sem baixa ou com duas assinaturas.  
- **Correção mínima:** não tratar lab SQL como migration; no gate seguinte, dump `pg_proc` das assinaturas `deliver_personal_item_3g` (esperado: 1, dez args).  
- **Aceitação:** `pronargs=10` apenas; `anon` sem execute; `authenticated` sem SELECT nas tabelas `private.personal_item_*`.

### F-3G-10 — SECURITY DEFINER
- **Severidade:** MÉDIA  
- **Estado:** PARCIAL  
- **Arquivo/linha:** todas as RPCs 3G `security definer set search_path=''`; `can_manage_personal_item_3g` L66–70; `is_active_admin` histórico + `20260906221331_harden_rpc_and_close_public_signup.sql` L6 (INVOKER)  
- **Condição:** qualquer JWT `authenticated` chama a RPC.  
- **Caminho:** autorização interna (`auth.uid()`, `is_active_admin`, `can_operate`). Owner da função **não declarado** no pacote. `search_path` vazio nas funções 3G é o padrão correto. `is_active_admin` legado ainda usa `search_path = public, pg_temp`.  
- **Evidência:** `admin_personal_items_3g` só exige `profiles.active`, depois filtra linhas com `can_manage`. Perfil ativo sem escopo recebe `[]`, não `forbidden`.  
- **Impacto:** bug em `can_operate` (fora do ZIP) vaza o módulo inteiro.  
- **Correção mínima:** dump owner/`prosecdef`/`proacl` no ciclo 2; negar execute a quem não é Gestão no grant, se o produto aceitar.  
- **Aceitação:** owner ≠ `authenticated`; João executa `admin_personal_items_3g` e não vê linhas de outros.

### F-3G-11 — Funcionário sem equipe e superfície da lista
- **Severidade:** MÉDIA  
- **Estado:** HIPÓTESE / LACUNA  
- **Arquivo/linha:** `can_manage_personal_item_3g` (`team_id` nulo → `is_active_admin`); `metallo-repository.ts` `listEmployees` L283–289, `getEmployee` L292–302; `funcionarios/page.tsx` L46  
- **Condição:** líder com `epi:read`/`epi:write` de uma equipe acessa lista ou URL `/funcionarios/<uuid-sem-equipe>/itens`.  
- **Caminho:** RPCs 3G bloqueiam entrega/visão admin sem admin global. A **página** só faz `requireCapability("epi:write"|"epi:read")` e lê `epi_employees` direto. Sem policies no ZIP, a lista pode mostrar o nome. Célula de origem usa `"—"`, não necessariamente o texto “Sem equipe” (o fallback “Sem equipe” está em `working_team_name`).  
- **Impacto:** vazamento de existência/ficha vs. regra AGENTS.md (“apenas administrador global”). Operação 3G permanece bloqueada.  
- **Correção mínima:** filtrar sem-equipe na listagem/getEmployee para não-admin; policies explícitas.  
- **Aceitação:** líder não abre ficha nem lista de empregado sem equipe; admin global vê “Sem equipe” e entrega.

### F-3G-12 — Leitura direta de `epi_stock_batches` e catálogo
- **Severidade:** MÉDIA  
- **Estado:** LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** `itens-pessoais-3g.ts` L21–37  
- **Condição:** cliente Gestão com JWT autentica `from("epi_items"|"epi_stock_batches")`.  
- **Caminho:** sem filtro de `item_kind` no estoque; a página filtra depois. RLS do lote **não veio**.  
- **Impacto:** se RLS for frouxo, a action lê todos os lotes com `quantity > 0` (EPI + pessoal).  
- **Correção mínima:** RPC de lotes pessoais no escopo do ator; não expor tabela crua.  
- **Aceitação:** líder da obra A não recebe lote da obra B nem lote de EPI nesta tela.

### F-3G-13 — UI de erro e responsividade
- **Severidade:** BAIXA  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `app-error.ts` L28–55; `globals.css` L221–237; `meus-itens.tsx` L82–83  
- **Condição:** falha Zod/500/42501 na lista; viewport estreito no card de encerramento.  
- **Caminho:** `classifyLoadFailure` mapeia para mensagens sem SQL/stack (teste `gestao-funcionarios-3g.test.ts`). Card empilha em `@container (max-width: 960px)`.  
- **Evidência:** zoom 200% / 475px é relato manual, não reproduzido aqui.  
- **Impacto:** baixo no código visto; prova visual não é deste auditor.  
- **Correção mínima:** manter classificação; evidência de screenshot no ciclo 2.  
- **Aceitação:** 42501 não aparece na tela; card a 390–475px sem overlap horizontal.

### F-3G-14 — Pacote incompleto e provas sobrepostas
- **Severidade:** MÉDIA (governança da auditoria)  
- **Estado:** LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** `PROMPT_REVISAO_SOMENTE_LEITURA.md`; `45_MARCO_3G_MEUS_ITENS_PESSOAIS.md` (191/191, 197/197, 208/208 vs `RESULTADOS_3G.json` 209/209); `MANIFESTO_SHA256.json` `secret_scan_receipt`  
- **Condição:** decidir baseline ou publicação com este ZIP.  
- **Caminho:** faltam `executeValidated`, `formulario-operacao`, `register_epi_delivery`, policies de `epi_stock_batches`/`epi_employees`, `can_operate`, PDF 3E, recibo de secrets, dump do banco.  
- **Impacto:** qualquer “40/40” aqui é autoatestado.  
- **Correção mínima:** ciclo 2 com dump `pg_proc`/`pg_policies` e fontes 3C–3E com hashes contra o manifesto 3F.  
- **Aceitação:** auditor reconcilia um único número de suíte web e verifica policies sem executar o produto.

### F-3G-15 — Substituição com entrega já encerrada / problema antes da confirmação
- **Severidade:** BAIXA  
- **Estado:** HIPÓTESE  
- **Arquivo/linha:** `endurecimento-excecao-3g.sql` L112–118; `report_personal_item_3g` L193–202  
- **Condição:** `REPLACED` aponta para entrega posterior já `RETURNED`; `PROBLEM` em item ainda `AGUARDANDO_CONFIRMACAO`.  
- **Caminho:** close não exige que a entrega nova esteja aberta; report não exige `CONFIRMED`.  
- **Impacto:** histórico legalmente estranho, sem segundo débito.  
- **Correção mínima:** exigir entrega-substituta não terminal; opcionalmente exigir confirmação antes de problema.  
- **Aceitação:** `REPLACED` com alvo já devolvido recusado.

---

## Controles que **não** quebrei no estático (não é aprovação)

- Transação única entrega+baixa no SQL **final** de 10 argumentos.  
- Sem tabela/ledger paralelo de saldo 3G.  
- Gatilho `use_personal_items_3g` em `epi_deliveries`.  
- Fatos 3G imutáveis (`guard_personal_item_history_3g`).  
- Titular e `delivered_by` derivados de `auth.uid()`.  
- Portal allowlist inclui só as três RPCs 3G pessoais, origem `127.0.0.1:54321`.  
- Confirmação/report do colaborador com chave estável em `useRef`.  
- Encerramento idempotente no servidor se ação/destino/nota coincidem.

---

## Críticos / altos abertos

| Classe | Confirmado e aberto |
| --- | --- |
| CRÍTICO | Nenhum no código 3G inspecionado |
| ALTO | Nenhum fechado como falha explorável só com este ZIP. F-3G-01 e F-3G-02 são o teto (média, parcial/confirmado) |
| MÉDIO aberto | F-3G-01, F-3G-02, F-3G-07, F-3G-09, F-3G-10, F-3G-11, F-3G-12, F-3G-14 |
| Lacuna que impede fechar o marco | RLS/estoque compartilhado, 3C/3D/3E, catálogo RPC aplicado, timeout real, scan de segredos |

**Não aprovo baseline 3G, remoto, produção, publicação, ponto oficial ou REP-P.** O próximo ciclo, se houver, precisa do dump do banco local e dos fontes 3C–3E; não de nova feature.