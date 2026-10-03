ZIP recebido e conferido. **SIMULAÇÃO SEM VALOR OFICIAL.** Inspeção passiva apenas: extração, hashes e leitura. Scripts, SQL, testes, Auth, containers e Supabase remoto **não** foram executados.

## Integridade do pacote

| Item | Resultado |
| --- | --- |
| ZIP | `Metallo-Marco3D-EntregaConfirmacao-Auditoria-20260929-Ciclo2.zip` |
| SHA-256 deste anexo | `7d4e62ddb17aa8cbc43fd5dd2f360391ffa332be9b664df9ac543750da65fb06` — **confere** com o esperado |
| Manifesto | `METALLO-3D-AUDITORIA-CICLO2`, `is_approved_baseline: false`, `at: 2026-09-29T06:52:38Z` |
| Inventário | 67/67 arquivos do manifesto com tamanho e SHA-256 conferidos no extrato; ZIP tem 68 entradas (os 67 + `MANIFESTO_SHA256.json`) |
| Origem 3C declarada | `METALLO-3C-LAB-20260928-R1` / `bf3f1bb34813f03afaa9fac613ef4ede24a0f35f3ca3292670dda230cc63c3a6` — **não verificável aqui** (ZIP 3C ausente) |
| Parecer ciclo 1 | SHA-256 `76708e470d902e2fe54a95fe1f070e39bb9d9de9e825a0c54457851922adf500` — **confere** com o documento 42 |
| Recibo de scan do ciclo 1 | anexado; `findings: []`, `passed: true`, ZIP ciclo 1 `1f5ef6b268…` |
| Scan **deste** ZIP | o manifesto aponta `outputs/…Ciclo2.zip.verificacao.json`, **fora** do pacote. A afirmação “zero achados” é do emissor/usuário, não reobtida aqui |
| Provas 3D anexas | `resultado-3d.json` declara **77/77**; Web **148/148**; banco/qualidade/rede/typecheck/lint/build como logs locais |

## Método e limite

Leitura estática do contrato, actions, portal, Gestão, testes e do parecer do ciclo 1. As baterias 77/77 e 148/148 são **evidência local do laboratório**, não reprodução independente. Não há baseline 3D. Este é o segundo e último ciclo autorizado.

## Autorização (escopo local estático)

**Não há achado CRÍTICO ou ALTO confirmado e aberto** de quebra de autorização, IDOR ou injeção de titular no código 3D inspecionado.

Caminhos pedidos, em leitura estática (inalterados em substância pelo ciclo 2):

- Funcionário criar entrega: `prepare_epi_kit_3d` / `register_epi_delivery_3d` exigem `profiles.active`; o portal usa perfil **inativo**.
- João confirmar/divergir Maria (e o inverso): `respond_epi_delivery_3d` resolve o titular só por `auth.uid()` + identidade ativa; grupo alheio → `delivery_not_found`; `delivery_id` de outro grupo → `delivery_item_not_found`.
- Maria ver João: `my_epi_delivery_groups_3d` filtra pelo vínculo pessoal; tabelas 3D com RLS + `REVOKE ALL`, sem política permissiva no contrato.
- Gestão sem `epi:write`: RPCs 3D usam `can_operate('epi:write', team_id)` ou admin global se equipe nula; actions Next exigem `epi:write`.
- `employee_id` / `acknowledgement_id` no body da RPC pessoal: parâmetros inexistentes; o wrapper oficial não os envia.
- Replay / cinco cliques: lock 8033 + `unique(group_id, idempotency_key)` + recusa se o último evento ≠ `RESOLVIDA`.
- Token revogado / inativo: join exige `link.status='active'`, conta portal e funcionário ativos.

As correções do ciclo 2 **não abriram** caminho estático novo de acesso cruzado nem de manipulação de IDs.

---

## Confronto F-3D-01 a F-3D-11

### F-3D-01 — Entrega legada paralelo ao fluxo 3D
- **Severidade:** MÉDIA (processo, não bypass de papel)
- **Estado final:** **CONFIRMADO** (aberto como coexistência operacional)
- **Arquivo/linha:** `01_WEB/app/actions/epi-completo.ts` (`deliverEpiBatch`, `fulfillEpi`); RPC `register_epi_delivery_batch` / `register_epi_delivery`; `entrega-em-lote/page.tsx` (modo local omite a UI legada)
- **Condição:** Gestão autenticada com `epi:write` (ou admin)
- **Caminho:** as RPCs/actions antigas ainda criam `epi_deliveries` sem kit preparado e sem `epi_delivery_groups_3d`. O portal 3D lista só grupos 3D.
- **Evidência:** leitura estática; o documento 42 classifica o achado como VALID e recusa bloquear o legado nesta rodada. Sem reprodução aqui.
- **Impacto:** kit sugerido / preparado / entrega / confirmação não são etapas obrigatórias fora do modo 3D. Há entrega com baixa de estoque invisível em “Recebimento de EPIs”.
- **Correção mínima:** decisão de transição (fora deste ciclo): recusar legado quando o destino deveria ser 3D, ou exigir grupo 3D para novas entregas pessoais.
- **Aceitação:** lote legado para o mesmo funcionário sintético não gera `epi_deliveries` sem grupo 3D — **não executado aqui**.

### F-3D-02 — 3C aprovada ≠ entrega concluída; EPI anterior não fecha
- **Severidade:** n/a como defeito 3D; **RISCO FUTURO / 3E**
- **Estado final:** **DECISÃO DOCUMENTADA** (fato confirmado; não é falha do contrato 3D)
- **Arquivo/linha:** `register_epi_delivery_3d`; prova anexa “EPI anterior e pedido 3C não são encerrados automaticamente”; doc 42
- **Condição:** troca 3C `APROVADA` seguida de entrega 3D vinculada
- **Caminho:** a entrega nova não altera `epi_exchange_requests.status` nem `current_status` da origem.
- **Evidência:** SQL não contém UPDATE desses campos; o laboratório afirma o fato. Concordância com o ciclo 1 e com a decisão explícita do responsável.
- **Impacto:** dois EPIs “ativos” e pedido 3C eterno até ação futura. Confirmação pessoal não conclui o 3C.
- **Correção mínima:** não nesta rodada. Regra empresarial para 3E.
- **Aceitação:** matriz 3E dos quatro estados — fora de escopo.

### F-3D-03 — Fechamento parcial 3B incompatível com imutabilidade 3D
- **Severidade:** BAIXA a MÉDIA (operacional)
- **Estado final:** **CONFIRMADO** (residual aberto; imutabilidade preservada)
- **Arquivo/linha:** `guard_epi_delivery_snapshot_3d` (compara `quantity` e snapshots); `close_epi_delivery_quantity` (legado)
- **Condição:** Gestão tenta encerrar só parte da quantidade de uma linha com grupo 3D
- **Caminho:** UPDATE de quantidade dispara `epi_3d_delivery_immutable`. Encerramento integral (status/closed_*) continua permitido pelo guarda 3D.
- **Evidência:** leitura do trigger; F-3B-15 residual. Sem reprodução.
- **Impacto:** tela 3B de split quebra nessas linhas; o fato 3D não é reescrito.
- **Correção mínima:** tratar grupo 3D como “só integral ou novo evento”; não alterar quantidade da linha original.
- **Aceitação:** split em linha 3D falha de forma previsível — **não executado aqui**.

### F-3D-04 — Lista administrativa 3D perdia o motivo após resolver
- **Severidade original:** BAIXA — **corrigido no ponto reclamado**
- **Estado final:** **CONFIRMADO CORRIGIDO** (leitura estática). Residual 3E: a API ainda não devolve a série completa.
- **Arquivo/linha:** `admin_epi_delivery_feedback_3d` linhas 417–421; `entrega-em-lote/page.tsx` 41–45
- **Condição:** após `EM_ANALISE` / `RESOLVIDA`
- **Caminho (antes):** item/categoria/relato vinham só do último evento. **Agora:** `ev` = último evento (estado/mensagens); `issue` = última `DIVERGENCIA` (item, categoria, relato); join em `epi_deliveries` pelo `delivery_id` da divergência.
- **Evidência:** SQL e UI. Prova local “Gestão preserva item e motivo após resolver”. Não reproduzida aqui.
- **Impacto residual:** só a última divergência aparece; após nova `CONFIRMADO` a mensagem pública da resolução some da mesma projeção (`ev.public_message` do último evento). A tabela append-only conserva a história.
- **Correção mínima residual:** devolver série ou “último de cada tipo” se o 3E precisar de linha do tempo.
- **Aceitação já descrita no laboratório:** após `RESOLVIDA`, a Gestão ainda vê item/categoria/relato — prova local, não desta auditoria.

### F-3D-05 — Portal não recebia mensagem pública nem horário
- **Severidade original:** BAIXA (3E / UX) — **corrigido no ponto reclamado**
- **Estado final:** **CONFIRMADO CORRIGIDO**, com residual de projeção
- **Arquivo/linha:** `my_epi_delivery_groups_3d` (retorno `feedback_at`, `public_message`); parser `personalDeliveryGroups3d` (chave exata, recusa `internal_note`); `epi-recebimento.tsx` 67–68
- **Condição:** Gestão grava `public_message` em `RESOLVIDA`
- **Caminho atual:** o último evento alimenta status, `occurred_at` e `public_message`. A tela mostra “Manifestação registrada em …” e “Mensagem da Gestão: …”.
- **Evidência:** contrato + parser + teste Web “após resolução mostra mensagem e horário…”. Prova local “Maria vê horário e mensagem pública… sem nota interna”.
- **Residual:** depois de `CONFIRMADO` (ou nova `DIVERGENCIA`) o último evento não carrega a mensagem da resolução; o portal deixa de exibi-la. A prova local após confirmar só checa `feedback_status==="CONFIRMADO"`.
- **Correção mínima residual:** projetar a última `public_message` não nula (nunca `internal_note`) além do último evento.
- **Aceitação:** parser aceita os campos novos e recusa `internal_note` — coberto no teste unitário anexado (não executado aqui).

### F-3D-06 — Após `RESOLVIDA`, UI pessoal só oferecia divergência
- **Severidade original:** BAIXA — **corrigido**
- **Estado final:** **CONFIRMADO CORRIGIDO**
- **Arquivo/linha:** `epi-recebimento.tsx` 91–96; RPC `respond_epi_delivery_3d` 395–397
- **Condição:** último evento = `RESOLVIDA`
- **Caminho:** a tela agora oferece Confirmar e Informar divergência quando `feedback_status === null || === "RESOLVIDA"`. A RPC já permitia os dois.
- **Evidência:** UI + teste Web + prova local “Maria pode confirmar após divergência resolvida”.
- **Impacto:** assimetria UI/contrato encerrada no cliente oficial. Cliente raw continua sujeito à RPC (não é IDOR).
- **Correção mínima:** nenhuma no escopo 3D.
- **Aceitação:** teste de interface e prova de RPC no estado resolvido — evidência local.

### F-3D-07 — Chave de idempotência da Gestão nasce a cada render
- **Severidade:** BAIXA
- **Estado final:** **CONFIRMADO** (aberto; aceito pelo emissor como PARTIAL)
- **Arquivo/linha:** `entrega-em-lote/page.tsx` (`keyId={randomUUID()}`, `idempotencyKey` do registro); `formulario-operacao.tsx` (trava `pending` da instância)
- **Condição:** duas abas, F5 após preencher, ou remount
- **Caminho:** duas chaves → dois kits preparados para o mesmo funcionário sem 3C. Com 3C, `UNIQUE(exchange_request_id)` bloqueia o segundo. Re-registro do mesmo `preparation_id` com outra chave → `delivery_already_registered`.
- **Evidência:** leitura estática; ciclo 2 não alterou essa geração.
- **Impacto:** fila de kits órfãos; não duplica estoque no mesmo prep. Duplo clique na mesma página permanece idempotente.
- **Correção mínima:** chave estável por funcionário+conteúdo na sessão, ou um prep pendente por funcionário — decisão futura.
- **Aceitação:** dois submits da mesma tela = um prep — **não executado aqui**.

### F-3D-08 — Snapshot de preparação omite lote/marca
- **Severidade original:** BAIXA — **corrigido para kits novos**
- **Estado final:** **CONFIRMADO CORRIGIDO** (kits gerados após o ajuste). **PARCIAL** só para kits preparados antes da correção (sem as chaves no JSON).
- **Arquivo/linha:** `prepare_epi_kit_3d` 251–255 (`lot_number`, `brand_model`); `register_epi_delivery_3d` 307–313
- **Condição:** o mesmo `stock_batch_id` tem lote/marca alterados entre preparar e registrar
- **Caminho atual:** o snapshot grava lote/marca do estoque; o registro compara `ca`, `variant`, `lot_number` e `brand_model` (este último par só se a chave existir no JSON) e levanta `prepared_kit_context_changed`.
- **Evidência:** SQL. Provas locais: “preparação preserva lote e marca”, “registro nega lote alterado”, “registro nega marca alterada”, “registro revalida CA”. Não reproduzidas aqui.
- **Impacto residual:** kits antigos sem as chaves ainda passam na revalidação de lote/marca; a UI de preparação/lista ainda não *mostra* lote/marca (só o servidor os defende).
- **Correção mínima residual:** nenhuma obrigatória no 3D para kits novos.
- **Aceitação:** alterar lote no batch após prep → `prepared_kit_context_changed` e estoque intacto — prova local.

### F-3D-09 — `can_operate(..., NULL)` ainda é verdadeiro para engenheiro; 3D contorna, legado não
- **Severidade:** BAIXA (residual conhecido)
- **Estado final:** **PARCIAL** (mitigado no 3D; legado nos triggers)
- **Arquivo/linha:** `can_operate` em `20260912073507_user_operation_permissions.sql` (`p_team_id is null or …`); RPCs 3D com ramo admin; `guard_epi_delivery_team_3d`; prova nova de `close_epi_delivery_quantity`
- **Condição:** funcionário sem equipe + perfil engenheiro com `epi:write`
- **Caminho 3D:** RPC recusa (`management_access_denied`). Caminho legado: `can_operate('epi:write', NULL)` passa; o insert/close deve morrer no trigger / na RPC de close.
- **Evidência:** leitura de `can_operate`; prova local “engenheiro restrito não encerra entrega sem equipe pela RPC legada”. Sem reprodução.
- **Impacto:** 3D não amplia `can_operate`. A defesa do legado continua sendo trigger/RPC específica.
- **Correção mínima:** não alterar o significado global de `can_operate`.
- **Aceitação:** engenheiro restrito não prepara, não registra 3D e não fecha entrega de sem-equipe — parcial nas provas anexas.

### F-3D-10 — Origem 3C e baterias anexas não são reprodução desta auditoria
- **Severidade:** n/a (evidência)
- **Estado final:** **LACUNA DE EVIDÊNCIA** (reduzida, não fechada)
- **Arquivo:** `MANIFESTO_SHA256.json`, `resultado-3d.json`, logs `*-final.log`, `resultado-segredos-3d.json` (scan de fontes em `2026-09-28T23:48Z`, anterior a este ZIP), recibo do ZIP ciclo 1
- **Condição:** o pacote afirma 3C 70/70, Web 148/148, rede 8/8, 77/77 3D, typecheck/lint/build
- **Caminho:** sem o ZIP 3C e sem executar o laboratório, hashes de origem e resultados Auth/JWT não são reobtidos. O scan direto **deste** ZIP não está dentro do pacote.
- **Impacto:** confiança nas baterias continua a depender do emissor. Os 67 hashes *deste* extrato e o SHA do ZIP ciclo 2 **foram** conferidos aqui.
- **Correção mínima:** fora de escopo (ciclo encerrado). Distinguir sempre prova local de reprodução.
- **Aceitação:** conferência cruzada origem 3C + recibo do ZIP Grok ciclo 2 no mesmo instante — incompleta neste ambiente.

### F-3D-11 — Superfície PostgREST 3D ampla para `authenticated`
- **Severidade:** BAIXA (defesa em profundidade)
- **Estado final:** **CONFIRMADO** — **não é bypass**
- **Arquivo/linha:** nove `GRANT EXECUTE … TO authenticated` no contrato; allowlist só em `portalFetch` (duas RPCs pessoais)
- **Condição:** JWT de funcionário + chave `anon` + cliente fora do wrapper
- **Caminho:** o browser portal bloqueia `prepare_epi_kit_3d` na allowlist; PostgREST ainda expõe a RPC. A autorização real está na função (`profiles.active` / titularidade / `can_operate`).
- **Evidência:** grants + `REVOKE` de tabelas; provas locais com cliente raw relatam 4xx. Estaticamente coerente. Ciclo 2 não mudou o modelo de grant.
- **Impacto:** o wrapper não é fronteira. Sem caminho estático de João criar entrega ou confirmar Maria.
- **Correção mínima:** manter revoke+checagem na RPC. Não tratar allowlist como controle de acesso.
- **Aceitação:** já coberto nas provas anexas; reexecução fora de escopo.

---

## O que a leitura estática **não** abriu como falha 3D nova

| Tema | Leitura no ciclo 2 |
| --- | --- |
| Agrupamento | `epi_delivery_groups_3d.id` = `delivery_group_id` da baixa atômica |
| Kit ≠ prep ≠ entrega ≠ confirmação | prep não baixa estoque; registro chama o lote existente; grupo nasce pendente |
| RLS / grants 3D | `ENABLE RLS` + `REVOKE ALL` tabelas/sequence; sem política permissiva; `service_role` sem EXECUTE nas 9 RPCs |
| SECURITY DEFINER | `owner postgres`, `search_path=''`, nomes qualificados, guarda de homônimos na instalação |
| IDOR / querystring / body | RPC pessoal sem `employee_id`; wrapper oficial só envia grupo/ação/item/categoria/relato/chave |
| Replay / idempotência | locks 8031/8032/8033 + unique keys; segundo evento ≠ `RESOLVIDA` recusado |
| Histórico 3D editável | triggers de imutabilidade em prep/grupo/eventos; entrega 3D só fecha status |
| Vazamento admin → portal | DTO 3D sem nota interna; parser de chaves exatas; allowlist sem tabelas |
| Correções 04–06 e 08 | não enfraquecem titularidade nem `epi:write` |
| `aplicar-ajustes-auditoria-3d.mjs` | recorta as 4 funções da fonte SQL e regrava grants `authenticated` only; `my_epi_delivery_groups_3d` é drop+create por mudança de retorno |

## Suficiência para o futuro 3E (não implementar PDF)

Presente nas **novas** linhas 3D: nome, código, unidade, CA, variante, quantidade, lote/marca no prep e na entrega (via rotina de lote), horários de servidor, grupo, vínculo 3C/kit, eventos append-only, mensagem pública e nota interna separadas.

Ainda insuficiente sozinho para ficha oponível: entregas pré-3D dependem do catálogo; sem API de série temporal; lista Gestão e portal projetam o último evento (com o ganho da última divergência na Gestão); nome do responsável Gestão não é snapshot textual; conclusão 3C e destino do EPI anterior indefinidos; coexistência com lote legado (F-3D-01).

## Veredito do ciclo 2 (último)

- **CRÍTICO confirmado aberto no escopo local do 3D:** não.
- **ALTO confirmado aberto (autorização / IDOR / injeção de titular):** não.
- **Corrigidos no ponto reclamado:** F-3D-04, F-3D-05, F-3D-06, F-3D-08 (kits novos).
- **Abertos de processo / residual / 3E:** F-3D-01, F-3D-03, F-3D-07, F-3D-09; F-3D-02 como decisão documentada; F-3D-05/04 com residual de projeção histórica.
- **Evidência:** F-3D-10 e F-3D-11 permanecem nos termos do ciclo 1.
- **Não há terceiro ciclo, baseline 3D, publicação nem implementação de 3E/PDF nesta auditoria.**