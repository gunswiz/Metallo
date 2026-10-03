# Auditoria adversarial independente — Marco 3D, ciclo 1

**Método:** leitura estática do ZIP, extração local, hashes e comparação de texto. **Não houve reprodução:** scripts, SQL, Auth, PostgREST, testes, containers e Supabase remoto não foram executados. As provas `68/68` são evidência do laboratório anexado, não reexecução independente.

**Rótulo obrigatório:** SIMULAÇÃO SEM VALOR OFICIAL. Sem baseline 3D. Sem implantação remota.

## Integridade do pacote

| Item | Resultado |
| --- | --- |
| ZIP recebido | `1f5ef6b268f9eafc215b0d11547fdf18e2ad6b0c90d166d8badf6bd55d2879cc` (SHA-256 deste anexo, calculado aqui) |
| Manifesto interno | `METALLO-3D-AUDITORIA-CICLO1`, `is_approved_baseline: false` |
| Arquivos do manifesto | 64/64 com tamanho e SHA-256 conferidos no extrato |
| Origem 3C declarada | `METALLO-3C-LAB-20260928-R1` / `bf3f1bb34813f03afaa9fac613ef4ede24a0f35f3ca3292670dda230cc63c3a6` — **não verificável aqui** (ZIP 3C ausente) |
| Scan de segredos | `resultado-segredos-3d.json` anterior ao ZIP (`2026-09-28T23:48Z`), escopo “sem ZIP Grok” |

## Conclusão de autorização (escopo local estático)

**Não há achado CRÍTICO ou ALTO confirmado e aberto de quebra de autorização** no código 3D inspecionado.

Caminhos pedidos, em leitura estática:

- Funcionário criar entrega 3D: `prepare_epi_kit_3d` / `register_epi_delivery_3d` exigem `profiles.active`; o portal usa perfil **inativo**. João/Maria caem em `management_access_denied` antes de `employee_id`.
- João confirmar/divergir Maria (e o inverso): `respond_epi_delivery_3d` resolve o titular só por `auth.uid()` + identidade ativa; grupo alheio → `delivery_not_found`; `delivery_id` de outro grupo → `delivery_item_not_found`.
- Maria ver João: `my_epi_delivery_groups_3d` filtra pelo vínculo pessoal; tabelas 3D sem GRANT e sem política RLS utilizável.
- Gestão sem `epi:write` preparar/entregar/tratar: RPCs 3D usam `can_operate('epi:write', team_id)` ou admin global se equipe nula; actions Next exigem `epi:write`.
- `employee_id` / `acknowledgement_id` no body: a RPC pessoal não tem esses parâmetros; o titular não é escolhido pelo cliente.
- Replay / cinco cliques: lock consultivo + `unique(group_id, idempotency_key)` + recusa se o último evento ≠ `RESOLVIDA`.
- Token revogado / inativo: a consulta pessoal exige `link.status='active'`, conta portal e funcionário ativos.

Isso é **análise estática**. A bateria Auth/JWT/PostgREST 68/68 é prova local do pacote, não reprodução desta auditoria.

---

## Achados

### F-3D-01 — Entrega legada paralelo ao fluxo 3D
- **Severidade:** MÉDIA (integridade de processo, não bypass de papel)
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `01_WEB/app/actions/epi-completo.ts` (`deliverEpiBatch`, `fulfillEpi`); `04_BANCO_E_SUPABASE/supabase/migrations/20260912073507_user_operation_permissions.sql` (`register_epi_delivery_batch`, `register_epi_delivery`); `entrega-em-lote/page.tsx` (modo local esconde a UI legada, a RPC permanece)
- **Condição:** ator Gestão autenticado com `epi:write` (ou admin)
- **Caminho:** `register_epi_delivery_batch` / `register_epi_delivery` / `fulfill_epi_request` criam `epi_deliveries` **sem** `epi_prepared_kits_3d` e **sem** `epi_delivery_groups_3d`. O portal 3D só lista grupos 3D.
- **Evidência:** actions e RPCs ainda granted a `authenticated`; o modo local apenas omite `SiteOperations`.
- **Impacto:** kit sugerido / preparado / entrega / confirmação deixam de ser etapas obrigatórias. Há entrega com baixa de estoque invisível em “Recebimento de EPIs”.
- **Correção mínima:** no laboratório 3D, recusar as RPCs legadas quando o destino deveria ser o fluxo 3D, ou exigir grupo 3D para novas entregas pessoais.
- **Aceitação:** tentativa de lote legado para o mesmo funcionário sintético não gera linha em `epi_deliveries` sem grupo 3D (prova de laboratório; não executada aqui).

### F-3D-02 — 3C aprovada ≠ entrega concluída; EPI anterior não fecha
- **Severidade:** MÉDIA (regra empresarial em aberto)
- **Estado:** CONFIRMADO (contrato + prova local anexada)
- **Arquivo/linha:** `contrato-entrega-confirmacao.sql` (`register_epi_delivery_3d`); `42_MARCO_3D_ENTREGA_CONFIRMACAO_EPI.md`; prova “EPI anterior e pedido 3C não são encerrados automaticamente”
- **Condição:** troca 3C `APROVADA` seguida de entrega 3D vinculada
- **Caminho:** a entrega nova não altera `epi_exchange_requests.status` nem `epi_deliveries.current_status` da origem. Encerramento do anterior só por RPC/tela legadas.
- **Impacto:** dois EPIs “ativos” e pedido 3C eterno. Confirmação pessoal não conclui o 3C. Fechamento manual precoce do anterior continua possível (fecha o fato, não o pedido).
- **Correção mínima:** decisão explícita (não implementar agora): o que conclui 3C e qual destino do EPI anterior.
- **Aceitação:** matriz documental 3E com os quatro estados (aprovada sem entrega / entregue pendente / confirmada / anterior encerrado).

### F-3D-03 — Fechamento parcial 3B incompatível com imutabilidade 3D
- **Severidade:** BAIXA a MÉDIA (operacional)
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `contrato-entrega-confirmacao.sql` `guard_epi_delivery_snapshot_3d` (compara `quantity` e snapshots); `close_epi_delivery_quantity` (reduz `quantity` e insere linha fechada)
- **Condição:** Gestão tenta encerrar só parte da quantidade de uma entrega que pertence a `epi_delivery_groups_3d`
- **Caminho:** o UPDATE de quantidade dispara `epi_3d_delivery_immutable`; a transação do split aborta. Encerramento **integral** (só status/closed_*) é permitido.
- **Impacto:** não reescreve o fato 3D (desejável), mas a tela 3B de fechamento parcial quebra nessas linhas. Documentado como F-3B-15 residual.
- **Correção mínima:** na UI/RPC de fechamento, tratar grupo 3D como “só integral ou novo evento 3E”; não alterar quantidade da linha original.
- **Aceitação:** split em linha 3D falha de forma previsível; split em linha só-3B continua; close 100% em linha 3D sucede.

### F-3D-04 — Lista administrativa 3D é só o último evento
- **Severidade:** BAIXA
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `admin_epi_delivery_feedback_3d` (lateral `order by id desc limit 1`); `entrega-em-lote/page.tsx` (`key={entry.group_id}`)
- **Condição:** após `EM_ANALISE` / `RESOLVIDA`
- **Caminho:** item, categoria e relato da divergência saem da fila; `internal_note` da resolução pode sobrescrever o contexto visível. A tabela append-only conserva a história; a RPC não a devolve.
- **Impacto:** Gestão trata o caso sem o detalhe na mesma tela; 3E não tem API de linha do tempo.
- **Correção mínima:** devolver o último evento de cada tipo ou a série completa do grupo (sem expor nota interna ao portal).
- **Aceitação:** após `RESOLVIDA`, a Gestão ainda vê o item/categoria/relato originais.

### F-3D-05 — Portal não recebe mensagem pública nem horário da manifestação
- **Severidade:** BAIXA (3E / UX)
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `my_epi_delivery_groups_3d` (só `feedback_status` = último `event_type`); DTO `PersonalDeliveryGroup3d`; `epi-recebimento.tsx`
- **Condição:** Gestão grava `public_message` em `RESOLVIDA`
- **Caminho:** o portal mostra “Divergência resolvida” sem texto, sem `occurred_at` da confirmação e sem responsável.
- **Impacto:** a confirmação existe como evento, mas o titular não reconstrói o diálogo. Insuficiente para ficha 3E no canal pessoal.
- **Correção mínima:** incluir `public_message`, `occurred_at` do último evento e, se a regra 3E exigir, nome do responsável Gestão — nunca `internal_note`.
- **Aceitação:** parser pessoal aceita esses campos e recusa `internal_note` (já recusa hoje).

### F-3D-06 — Após `RESOLVIDA`, UI pessoal só oferece divergência
- **Severidade:** BAIXA
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `epi-recebimento.tsx` (botão confirmar só se `feedback_status === null`); RPC permite `CONFIRMADO` ou `DIVERGENCIA` quando o último evento é `RESOLVIDA`
- **Caminho:** duas abas / cliente raw podem confirmar; a tela oficial não.
- **Impacto:** assimetria UI/contrato; não é IDOR.
- **Correção mínima:** alinhar tela e RPC (oferecer confirmar, ou negar confirmar depois de resolução).
- **Aceitação:** um teste de interface e um teste de RPC com o mesmo estado.

### F-3D-07 — Chave de idempotência da Gestão nasce a cada render
- **Severidade:** BAIXA
- **Estado:** CONFIRMADO (leitura estática)
- **Arquivo/linha:** `entrega-em-lote/page.tsx` (`keyId={randomUUID()}`, `idempotencyKey` por kit); `formulario-operacao.tsx` (trava só o `pending` da instância)
- **Condição:** duas abas, F5 após preencher, ou remount
- **Caminho:** duas chaves → dois kits preparados para o mesmo funcionário (sem 3C). Com 3C, o `UNIQUE(exchange_request_id)` bloqueia o segundo. Registro do mesmo `preparation_id` com outra chave → `delivery_already_registered`.
- **Impacto:** fila de kits órfãos; não duplica estoque no mesmo prep. Duplo clique na **mesma** página é idempotente (chave estável + `pending`).
- **Correção mínima:** chave estável por funcionário+conteúdo na sessão, ou um prep pendente por funcionário.
- **Aceitação:** dois submits da mesma tela = um prep; duas abas documentadas como conflito ou como segundo prep explícito.

### F-3D-08 — Snapshot de preparação omite lote/marca
- **Severidade:** BAIXA
- **Estado:** PARCIAL
- **Arquivo/linha:** `prepare_epi_kit_3d` (snapshot: item, código, unidade, CA, variante, qtd); `register_epi_delivery_3d` revalida esses campos, não `lot_number` / `brand_model`
- **Condição:** o mesmo `stock_batch_id` tem lote/marca alterados entre preparar e registrar
- **Caminho:** a entrega grava o lote/marca **atuais** via `register_epi_delivery_batch`; o kit preparado não denuncia a mudança.
- **Impacto:** CA/variante/nome são defendidos (prova local “CA alterado”). Lote/marca podem divergir da tela de preparação.
- **Correção mínima:** incluir lote/marca no `lines_snapshot` e na revalidação, ou imutabilizar esses campos do lote após uso em kit.
- **Aceitação:** alterar lote no batch após prep → `prepared_kit_context_changed` e estoque intacto.

### F-3D-09 — `can_operate(..., NULL)` ainda é verdadeiro para engenheiro; 3D contorna, legado não
- **Severidade:** BAIXA (residual conhecido)
- **Estado:** PARCIAL (mitigado no 3D; legado depende de triggers)
- **Arquivo/linha:** `can_operate` em `20260912073507_user_operation_permissions.sql` (`p_team_id is null or …`); RPCs 3D com ramo admin; `guard_epi_delivery_team_3d`; `private.guard_unassigned_employee_operation`
- **Condição:** funcionário sem equipe + perfil engenheiro com `epi:write`
- **Caminho 3D:** RPC recusa (`management_access_denied`). Caminho legado: `can_operate('epi:write', NULL)` passa; o insert deve morrer no trigger (`unassigned_employee_admin_required` / `epi_delivery_unassigned_admin_only`).
- **Impacto:** 3D não amplia `can_operate`. A defesa do legado é o trigger, não a RPC antiga.
- **Correção mínima:** não alterar o significado global de `can_operate`; manter os guards e cobrir close/lote legado sem equipe na prova 3D (já há prep restrito; close legado sem equipe não aparece na lista 68).
- **Aceitação:** engenheiro restrito não prepara, não registra 3D e não fecha entrega de sem-equipe.

### F-3D-10 — Origem 3C e baterias anexas não são reprodução desta auditoria
- **Severidade:** n/a (evidência)
- **Estado:** LACUNA DE EVIDÊNCIA
- **Arquivo:** `MANIFESTO_SHA256.json`, `resultado-3d.json`, `rede.json`, logs `*-final.log`, `resultado-segredos-3d.json`
- **Condição:** pacote afirma 3C 70/70, Web 147/147, rede 8/8, 68/68 3D, scan sem achados
- **Caminho:** sem o ZIP 3C e sem executar o laboratório, hashes de origem e resultados Auth/JWT não são reobtidos.
- **Impacto:** confiança no ciclo 1 depende do laboratório emissor.
- **Correção mínima:** no ciclo 2, anexar o recibo do scan **deste** ZIP e o SHA do pacote 3C original, ou um manifesto assinado do emissor.
- **Aceitação:** conferência cruzada origem 3C + scan do ZIP Grok no mesmo instante do empacotamento.

### F-3D-11 — Superfície PostgREST 3D ampla para `authenticated`
- **Severidade:** BAIXA (defesa em profundidade)
- **Estado:** CONFIRMADO (leitura estática) — **não é bypass**
- **Arquivo/linha:** nove `GRANT EXECUTE … TO authenticated` no contrato 3D; allowlist só no `portalFetch`
- **Condição:** JWT de funcionário + `anon` key + cliente fora do wrapper (curl, outra aba)
- **Caminho:** o browser portal bloqueia `prepare_epi_kit_3d` na allowlist, mas PostgREST ainda expõe a RPC. A autorização real está na função (`profiles.active` / titularidade), não no wrapper.
- **Impacto:** o wrapper não é fronteira. As provas locais exercitam exatamente esse cliente raw e relatam 4xx. Estaticamente coerente.
- **Correção mínima:** manter revoke+checagem na RPC (já feito). Não tratar allowlist como controle de acesso.
- **Aceitação:** já coberto nas provas anexas; reexecução fora de escopo.

---

## O que a leitura estática **não** abriu como falha 3D

| Tema | Leitura |
| --- | --- |
| Agrupamento | `delivery_group_id` reutilizado; `epi_delivery_groups_3d.id` = grupo da baixa atômica |
| Kit ≠ prep ≠ entrega ≠ confirmação (caminho 3D) | prep não baixa estoque; registro chama o lote existente; grupo nasce pendente |
| RLS / grants 3D | `ENABLE RLS` + `REVOKE ALL` tabelas/sequence; sem política permissiva no contrato; `service_role` sem EXECUTE nas 9 RPCs |
| SECURITY DEFINER | `owner postgres`, `search_path=''`, nomes qualificados, guarda de homônimos na instalação |
| IDOR / querystring | RPCs pessoais sem `employee_id`; GET `?employee_id=` não muda o recorte |
| Replay / idempotência | locks 8031/8032/8033 + unique keys |
| Histórico 3D editável | triggers de imutabilidade em prep/grupo/eventos; entrega 3D só fecha status |
| Vazamento admin → portal | DTO 3D sem nota interna; parser recusa campo extra; allowlist sem tabelas |
| Troca de conta / cache | geração de sessão + `disposePortalClient` + evento `storage` |
| Funcionário inativo / identidade revogada | joins exigem vínculo e funcionário ativos |

## Suficiência para o futuro 3E (não implementar PDF)

Presente nas **novas** linhas 3D:

- nome, código, unidade, CA, variante, quantidade, `delivered_at`/`occurred_at` de servidor  
- responsável Gestão (`delivered_by` / `actor_id` UUID, sem nome snapshot do ator)  
- grupo, profissão, equipe/obra (nulos se sem equipe)  
- nome do funcionário no grupo (coluna **anulável**; sintéticos antigos da evolução do contrato podem estar vazios)  
- vínculo 3C (`exchange_request_id`) e kit (`prepared_kit_id`)  
- eventos append-only com categoria/relato/mensagens  

Faltas materiais para ficha/período:

1. Entregas pré-3D ainda dependem do catálogo para nome/unidade (F-3B-05 residual).  
2. Sem RPC de série temporal: filtrar `delivered_at`/`occurred_at` e puxar eventos fora da janela pelos IDs é possível no SQL, não na API.  
3. Portal não traz confirmação com horário nem mensagem pública (F-3D-05).  
4. Lista Gestão não é histórico completo (F-3D-04).  
5. Nome do responsável Gestão e assinatura/QR/PIN/foto fora de escopo, como documentado.  
6. Regras de conclusão 3C e destino do EPI anterior indefinidas (F-3D-02).  

Os IDs encadeados **permitem** reconstruir a sequência se o 3E ler as tabelas; os snapshots atuais **não** bastam sozinhos para um PDF oponível sem preencher as lacunas acima.

## Veredito do ciclo 1

- **CRÍTICO confirmado aberto:** não.  
- **ALTO confirmado aberto (autorização/IDOR/injeção de titular):** não, no escopo local estático.  
- **Aberto de processo / 3E:** F-3D-01, F-3D-02, F-3D-03 a F-3D-09.  
- **Não propor baseline 3D nem publicação.** O contrato 3D, isolado, é defensivo; o risco residual é a coexistência com o lote legado e a ficha 3E ainda incompleta.