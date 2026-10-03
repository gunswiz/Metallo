## Recebimento e integridade

ZIP acessível: `Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo2.zip`.

- SHA-256 calculado: `8f39505a03fab270dbae3faffcf98f157e7d5205b74e53126b5209c3d0d1df87` — **confere**.
- Entradas no ZIP: **65**. Manifesto lista 64 arquivos; o 65º é o próprio `MANIFESTO_SHA256.json`.
- Tamanho e SHA-256 de cada arquivo extraído **coincidem** com o manifesto. Nenhum mismatch.
- Origem `METALLO-3B-LAB-20260928-R1` / `b8f6e5955b3cc9f4a670212fd24451c30d0fac9e7dba4acd544186f180356148`: `BASELINE_3B_ORIGEM.zip` **está no pacote** e o hash local **confere**.
- Recibo do scan do ciclo 1 incluso: `outputs/Metallo-Marco3C-TrocaEPI-Auditoria-20260928-Ciclo1.zip.verificacao.json` cita `f1b2083d96c07e2e081fd271c8b6af54c829375e5ba91471c63057651b55bded`, 54 entradas, `findings: []`, `passed: true`. O ZIP do ciclo 1 em si **não** está neste pacote (só o recibo).
- `is_approved_baseline: false`. Rótulo: **SIMULAÇÃO SEM VALOR OFICIAL**.

Inspeção somente leitura. **Não executei** scripts, SQL, migrations, testes, Auth, containers nem Supabase. Os 70/70, 48/48, 142/142, 31/31, 44/44, 8/8 são provas **locais do pacote**, não reprodução desta auditoria. Varredura passiva no extrato: nenhum JWT completo nem chave privada.

---

## Controles que se sustentam no material local (não são achados novos)

Titularidade por `auth.uid()` → conta portal → identidade ativa → funcionário ativo; `create_epi_exchange_request` **não tem** `employee_id` decisório. João/Maria isolados no SQL e nas provas declaradas. `delivery_id` alheio ou encerrado recusado. Motivos controlados; `OUTRO` exige nota aparada ≤240. Cancelamento só `SOLICITADA` do titular, replay de cancelamento idempotente. Estados `SOLICITADA→EM_ANALISE→APROVADA|RECUSADA` e `SOLICITADA→CANCELADA`. Histórico com trigger `BEFORE UPDATE OR DELETE`. DTO pessoal omite `internal_note`; parser do portal rejeita o campo. Aprovação **não** altera `epi_deliveries` nem `epi_stock_batches` no SQL nem nas provas. Portal: allowlist só RPCs pessoais em `127.0.0.1:54321`, sem `manage`/`admin`. Gestão: URL local + `requireCapability('epi:write')` na mutação + `can_operate('epi:write', equipe)` (admin global se `team_id` nulo). Seis RPCs: `SECURITY DEFINER`, `search_path=""`, owner `postgres`, `EXECUTE` só `authenticated`; catálogo sanitizado com `service_role_execute: false`. Tabelas sem GRANT a `anon`/`authenticated`/`service_role`, RLS ligado. Demo visual não chama as RPCs de troca (`exchangeRpc` exige sessão real). Sucesso na UI só após o `await create`. Distinção 3B (histórico de entrega / catálogo vivo) vs 3C (histórico de pedido com snapshot) permanece explícita no rodapé e no contrato.

**Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionado.**

---

## Confronto individual F-3C-01 … F-3C-15

### F-3C-01 — Intermitência Web 140/141 sob carga
- **Severidade:** MÉDIA (qualidade da evidência, não bypass)
- **Estado final:** CONFIRMADO (divulgação) + LACUNA DE EVIDÊNCIA (artefato da falha)
- **Tratamento:** **aberto como limite** — não corrigido, não ocultado
- **Evidência:** doc 3C § captura simultânea; manifesto `Web: 142/142 após 140/141 sob carga, 9/9 isolado e 141/141 serial`; `web.log` = 141/141; `web-ciclo2.log` = 142/142. **Continua ausente** o log original 140/141.
- **Impacto:** o “142/142” serial não apaga a instabilidade sob carga. Não indica falha de autorização 3C.
- **Aceitação:** limite de evidência do laboratório; não remover o teste de recuperação.

### F-3C-02 — F-3B-05 herdado (catálogo vivo no histórico 3B)
- **Severidade:** BAIXA
- **Estado final:** CONFIRMADO (residual herdado)
- **Tratamento:** **aberto / aceito como limite 3B**
- **Evidência:** `meus-epis.tsx` rodapé (“Nome e unidade refletem o catálogo atual”); `my_exchangeable_epi` ainda lê `i.name` vivo; pedido 3C grava `item_name_snapshot`/`ca_snapshot`.
- **Impacto:** histórico de **entrega** 3B pode mudar; histórico de **pedido** 3C não.

### F-3C-03 — F-3B-15 herdado (fechamento parcial sem agrupamento)
- **Severidade:** BAIXA
- **Estado final:** CONFIRMADO (residual de apresentação)
- **Tratamento:** **aberto / aceito como limite 3B**
- **Evidência:** listas ativas/histórico em `meus-epis.tsx` sem agrupamento; doc 3C admite o residual.

### F-3C-04 — Revogação entre Auth e commit
- **Severidade:** MÉDIA em produção futura; BAIXA no laboratório documentado
- **Estado final:** RISCO FUTURO / herdado
- **Tratamento:** **aberto / aceito como limite sistêmico**
- **Evidência:** `FOR SHARE` da identidade em create/cancel (`contrato-troca-epi.sql` ~100–107, 161–166); provas 67–70 cobrem **token já revogado**, não a janela intra-transação.
- **Impacto:** um pedido residual em corrida estreita após desligamento.

### F-3C-05 — `APROVADA` ocupa a vaga sem vínculo com entrega posterior
- **Severidade:** MÉDIA (operacional)
- **Estado final:** CONFIRMADO (desenho) + RISCO FUTURO
- **Tratamento:** **aberto / aceito como limite intencional do 3C**
- **Evidência:** índice parcial `SOLICITADA|EM_ANALISE|APROVADA`; sem transição pós-`APROVADA`; doc § estados; prova “pedido aprovado aguarda entrega” + “aprovação não cria entrega”.

### F-3C-06 — Cliente rejeitava replay que não voltasse `SOLICITADA`
- **Severidade:** BAIXA
- **Estado final:** CONFIRMADO no ciclo 1; **corrigido** no ciclo 2
- **Tratamento:** **corrigido**
- **Evidência de código:** `use-colaborador-session.ts` 203–206 aceita os cinco estados; `epi-troca.tsx` 65–67 mapeia aviso ao estado real (“já foi cancelada/analisada/aprovada/recusada”), sem “Solicitação enviada.”
- **Evidência de teste (local, não reexecutada):** `colaborador-troca-epi.test.tsx` “replay de intenção cancelada…”.
- **Resíduo:** se o usuário gerar **nova** chave após cancelamento, o índice aberto **permite** segundo pedido — comportamento desejado, não o bug original.

### F-3C-07 — `manage` fazia `FOR UPDATE` no pedido antes da autorização
- **Severidade:** BAIXA
- **Estado final:** CONFIRMADO no ciclo 1; **corrigido** no ciclo 2
- **Tratamento:** **corrigido**
- **Evidência:** `contrato-troca-epi.sql` 210–224: `FOR SHARE` do perfil → predicado de escopo **sem** lock no pedido → só então `FOR UPDATE` → revalidação de `can_operate`/admin após o lock.
- **Impacto residual:** ator autenticado sem escopo já não prende a linha do pedido.

### F-3C-08 — Prova de equipe nula usava o ator errado
- **Severidade:** BAIXA (evidência)
- **Estado final:** PARCIAL no ciclo 1; **evidência corrigida** no ciclo 2
- **Tratamento:** **corrigido como lacuna de prova** (o predicado SQL já era o controle)
- **Evidência:** `provas-3c.mjs` 139–146: gestor `engineer` + `epi:write` + `operation_team_ids={equipe A}` vê pedido com equipe e **não** vê/analisa pedido sem equipe; admin global vê. Checks homônimos em `resultado-3c.json` 254–263.
- **Controle:** `admin_epi_exchange_requests` / `manage` usam `can_operate(..., e.team_id)` só se `team_id is not null`; nulo exige `profiles.role='admin'`.

### F-3C-09 — Artefatos de conferência fora do ZIP
- **Severidade:** BAIXA
- **Estado final:** PARCIAL
- **Tratamento:** **parcialmente corrigido**; **log 140/141 permanece lacuna**
- **Fechado neste ciclo:** ZIP 3B imutável + recibo do scan do ciclo 1 (hash do ZIP 1 citado).
- **Ainda aberto:** artefato da corrida Web 140/141; ZIP do ciclo 1 em si não anexado (só o recibo).
- **Aceitação:** limite declarado; não inventar o log ausente.

### F-3C-10 — Nota interna gravada e invisível na fila da Gestão
- **Severidade:** BAIXA
- **Estado final:** CONFIRMADO no ciclo 1; **corrigido** no ciclo 2
- **Tratamento:** **corrigido**
- **Evidência:** RPC admin agora devolve `internal_note` (SQL 180–185; catálogo `admin_return_type`); UI `solicitacoes/page.tsx` 54; tipo `ExchangeManagementRow`; prova “nota interna é visível somente na fila da Gestão”. DTO pessoal e parser continuam sem o campo.

### F-3C-11 — `can_operate` não estava no pacote
- **Severidade:** BAIXA (evidência)
- **Estado final:** LACUNA no ciclo 1; **lacuna de pacote fechada** no ciclo 2
- **Tratamento:** **corrigido como evidência**
- **Evidência:** `20260912073507_user_operation_permissions.sql` 16–33 (definição vigente) + migrations T-05 de escopo nulo. Ver F-3C-16 para o semântica agora auditável.

### F-3C-12 — Rede 8/8 não reensaiada no marco
- **Severidade:** BAIXA (evidência)
- **Estado final:** LACUNA no ciclo 1; **evidência 3C presente** no ciclo 2
- **Tratamento:** **corrigido como evidência documental**
- **Evidência:** `rede.json` iniciado `2026-09-28T21:11:45.488Z`, 8/8 `ok: true` (listeners/bindings loopback, Auth loopback, negação por IP Ethernet, rede separada, firewall). Esta auditoria **não** reexecutou netstat nem Docker.

### F-3C-13 — Eventos append-only não cobrem `TRUNCATE` nem o superusuário
- **Severidade:** BAIXA
- **Estado final:** RISCO FUTURO (admitido)
- **Tratamento:** **aberto / aceito como limite do laboratório**
- **Evidência:** trigger só `UPDATE OR DELETE`; `REVOKE ALL` nas tabelas para papéis de API; owner/`postgres` permanece fora do contrato.

### F-3C-14 — Teste “employee_id injetado” acoplado à chave já usada
- **Severidade:** BAIXA (evidência)
- **Estado final:** PARCIAL no ciclo 1; **prova corrigida** no ciclo 2
- **Tratamento:** **corrigido como evidência**
- **Evidência:** `provas-3c.mjs` 64–67 usa `injectedKey` nova + `p_employee_id` da Maria; espera status ≥400 **e** `count(*) = 0` para essa chave. Assinatura SQL segue sem `employee_id`. Catálogo: args `p_delivery_id, p_reason, p_note, p_idempotency_key`.

### F-3C-15 — Visibilidade da Gestão segue `team_id` atual do funcionário
- **Severidade:** BAIXA
- **Estado final:** RISCO FUTURO
- **Tratamento:** **aberto / aceito como decisão de política**
- **Evidência:** predicados 188–191 e 214–224 usam `e.team_id` vivo, não snapshot da entrega. Sem ensaio de transferência de equipe no meio de `SOLICITADA` neste ZIP.

---

## Achado novo

### F-3C-16 — `can_operate(permissão, NULL)` ignora recorte de equipe
- **Severidade:** BAIXA no 3C atual; MÉDIA se reutilizada sem o predicado explícito
- **Estado:** RISCO FUTURO (agora visível porque F-3C-11 fechou a lacuna de pacote)
- **Condição:** chamador usa `can_operate('epi:write')` ou `can_operate('epi:write', NULL)`.
- **Caminho:** em `20260912073507_user_operation_permissions.sql` 25–27, `p_team_id is null` torna verdadeira a cláusula de equipe; qualquer perfil ativo com a permissão (engineer padrão, ou `epi:write` explícito) passa **sem** match de `operation_team_ids`/`team_id`.
- **Evidência de código:** definição SQL acima. As RPCs 3C **não** seguem esse caminho: nulo exige `role='admin'`. Prova 3C 139–146 cobre o caminho seguro das RPCs, não uma chamada direta `can_operate(..., NULL)` por um gestor de equipe.
- **Impacto:** regressão futura se alguém “simplificar” o predicado 3C para `can_operate('epi:write', e.team_id)` sem o `IS NOT NULL`.
- **Correção mínima:** não chamar `can_operate` com equipe nula para autorização de fila/escrita; ou alterar a função para que `NULL` **não** signifique global (exceto admin).
- **Aceitação:** limite herdado da função 3B, **desde que** o 3C preserve o predicado explícito. Não é bypass aberto no contrato 3C inspecionado.
- **Teste de aceitação:** gestor `epi:write` só na equipe A: `can_operate('epi:write', NULL)` documentado como true/false conforme a política escolhida; fila 3C de funcionário sem equipe continua só admin.

Nenhum outro achado novo de autorização, vazamento de nota interna, mutação de estoque/entrega ou segredo no ZIP.

---

## Correções F-3C-06/07/08/10/14 e lacunas F-3C-09/11/12

| ID | Ciclo 1 | Ciclo 2 |
| --- | --- | --- |
| 06 | cliente quebrava replay | **corrigido** (cinco estados + UI + teste Web) |
| 07 | lock antes do escopo | **corrigido** (escopo antes do `FOR UPDATE`) |
| 08 | ator sem `epi:write` | **prova corrigida** (gestor A × equipe nula × admin) |
| 10 | nota invisível na Gestão | **corrigido** (RPC + UI + prova bilateral) |
| 14 | chave reusada | **prova corrigida** (chave nova + `p_employee_id`) |
| 09 | recibo/origem/log fora | **parcial**: origem 3B + recibo ciclo 1 no ZIP; **log 140/141 ausente** |
| 11 | sem `CREATE` de `can_operate` | **fechada no pacote**; semântica NULL → F-3C-16 |
| 12 | rede só citada | **`rede.json` 8/8 datado deste ciclo** (prova local, não reensaiada aqui) |

Herdados/futuros que permanecem: F-3C-01 (sem log 140/141), 02, 03, 04, 05, 13, 15, e F-3C-16.

---

## Veredito

**Não existe CRÍTICO ou ALTO confirmado e aberto no escopo local deste ciclo.**

Os controles de titularidade, João/Maria, IDs, `epi:write`, DEFINER/`search_path`/grants, estados, idempotência/concorrência (5 chamadas nas provas locais), histórico, nota interna vs motivo público, token já revogado, offline sem falso sucesso e ausência de baixa/entrega automática **sustentam-se no código e nas provas anexas**, com as ressalvas de evidência e riscos futuros acima.

O log original **140/141 não está neste ZIP** e não foi inventado. O ZIP 3B de origem foi confrontado só por hash/manifesto, de forma passiva.

**SIMULAÇÃO SEM VALOR OFICIAL.** Sem baseline 3C, sem publicação, sem início de outro marco.
