# Auditoria adversarial somente leitura — Marco 3B Meus EPIs, ciclo 1

**SIMULAÇÃO SEM VALOR OFICIAL.** Inspeção passiva do ZIP. Nada disto é baseline, publicação, ponto oficial ou REP-P. O auditor **não executou** scripts do projeto, SQL, Auth, testes, containers nem rede do laboratório. Resultados em `resultado-3b.json`, logs e `REDE_SANITIZADA.json` são **evidência fornecida**, não reproduzida aqui.

## Cadeia de integridade

| Item | Resultado |
| --- | --- |
| ZIP | `Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo1.zip` |
| SHA-256 do ZIP | `4a6c28843655bbf6ddce8f885c63995ea1faac954c4954d74cd8a1e39d8d58a9` — **confere** |
| Entradas | 45 (confere com `zip_entries`) |
| `MANIFESTO_SHA256.json` | `id=METALLO-3B-AUDITORIA-CICLO1`, `is_approved_baseline=false`, rótulo obrigatório presente |
| Inventário | 44 caminhos com `bytes`+`sha256` — **todos conferem** com os arquivos extraídos. O 45º é o próprio manifesto (fora da lista `files`) |
| Origem declarada | `METALLO-3A-LAB-20260928-R1` / `907e26c0b51fdd781a2233a03782c31349630ab3e9dc61e5f96ada0005d52c4a` |
| ZIP da origem | **não incluso** (declarado em `LEIA-ME.md`). Há manifesto 3A embutido (`id` bate) e recorte `BASELINE_3A_RELEVANTE/` |
| Escopo | laboratório sintético; remoto intocado; sem autorização de baseline 3B |

## Controles observados no código (não são falhas)

A cadeia pretendida está no contrato local `04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql`:

- `SECURITY DEFINER` + `search_path = ''` + nomes qualificados + `language sql stable`
- zero argumentos; nove colunas; sem `SELECT *`
- `auth.uid()` → `private.employee_identity` (`status='active'`) → `private.employee_portal_accounts` → `public.profiles` com `not profile.active` → `epi_employees.active` → `epi_deliveries` do próprio `employee_id` → `epi_items` com `item_kind='epi'`
- titularidade **não** usa `team_id` nem obra
- `REVOKE ALL` de `public, anon, authenticated` e `GRANT EXECUTE` só a `authenticated`

No cliente:

- allowlist de fetch só para loopback `http://127.0.0.1:54321` e RPCs pessoais (`portalFetch`)
- parser de EPI exige exatamente as nove chaves e recusa IDs/campos extras
- sem cache próprio da lista; foco/visibilidade/storage/logout zeram a apresentação antes de nova leitura
- URL remota / `service_role` bloqueados na config de servidor

A UI **não** afirma validade normativa do CA (só “CA registrado”, oculto se vazio) e **não** usa `epi_monthly_acknowledgements` nem kits como prova de posse.

**Nenhum achado CRÍTICO ou ALTO confirmado e aberto no escopo local inspecionável.**

---

## Achados

### 1. F-3B-01 — Origem imutável não é verificável por hash neste pacote
- **Severidade:** Baixa (cadeia de custódia)
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `LEIA-ME.md` L6–L8; `MANIFESTO_SHA256.json` `origin`; `BASELINE_3A_MANIFESTO.json` `id`
- **Condição:** O SHA-256 `907e26c0…` refere-se ao ZIP 3A, que não veio no pacote.
- **Caminho de falha:** Substituição ou divergência do artefato 3A não seria detectável só com este ZIP.
- **Evidência:** 45 entradas listadas; nenhum arquivo cujo hash seja `907e26c0…`. O JSON 3A embutido tem SHA-256 próprio `0edebec38efc0fbfa80b0c3986f01f65fbc9d8da4a7a2d516b43343557a38648`.
- **Impacto:** A âncora “origem imutável” fica declaratória neste ciclo.
- **Correção mínima:** Anexar, fora do ZIP 3B ou em recibo externo, o hash conferido do ZIP 3A e um manifesto de arquivos 3A usados no delta.
- **Teste de aceitação:** `sha256sum` do ZIP 3A = `907e26c0…` e cada `old_sha256` do delta existe nesse ZIP.

### 2. F-3B-02 — Dono, catálogo vivo, overloads e grants não inspecionáveis aqui
- **Severidade:** Média (confiança na prova, não vazamento visto no SQL)
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `contrato-epis.sql` L4–L37; `provas-3b.mjs` L27–L32; `resultado-3b.json` checks 1–4
- **Condição:** Owner `postgres`, `prosecdef`, `search_path` vazio, `anon` sem EXECUTE, uma assinatura `pronargs=0` só aparecem no JSON de laboratório.
- **Caminho de falha:** Catálogo local diferente do contrato (owner não-postgres, overload com argumentos, `search_path` residual) não pode ser confirmado sem violar o modo passivo.
- **Evidência:** O SQL **não** contém `OWNER TO` nem `DROP FUNCTION` de outras assinaturas. `resultado-3b.json` afirma `ok: true` às 13:27Z; o auditor não reexecutou `pg_proc`.
- **Impacto:** A superfície DEFINER fica bem desenhada no texto; o estado real do banco Docker não é prova de primeira mão neste ciclo.
- **Correção mínima:** Incluir no pacote um dump só-leitura sanitizado de `pg_proc`/`acl` da função (sem dados de contas) gerado no mesmo instante do JSON.
- **Teste de aceitação:** Recibo de catálogo com `proowner=postgres`, `prosecdef`, `proconfig` com `search_path=""`, `pronargs=0`, `count=1`, EXECUTE autenticado e não-anon.

### 3. F-3B-03 — Contrato local sem amarração de owner nem limpeza de overload
- **Severidade:** Baixa
- **Status:** CONFIRMADO (defeito de robustez do script, não exploração vista)
- **Arquivo/linha:** `contrato-epis.sql` L4–L37
- **Condição:** `CREATE OR REPLACE` da assinatura zero-arg não remove overload pré-existente nem fixa o dono.
- **Caminho de falha:** Aplicar o contrato sobre catálogo sujo deixa `my_personal_epi(uuid)` (ou similar) ao lado da função correta; PostgREST pode resolver outra forma.
- **Evidência:** Arquivo único da função 3B; nenhuma migration remota contém `my_personal_epi`.
- **Impacto:** Risco de aplicação, não de leitura do texto atual.
- **Correção mínima:** `DROP FUNCTION IF EXISTS public.my_personal_epi();` (todas as assinaturas) + `ALTER FUNCTION … OWNER TO postgres` no contrato de laboratório.
- **Teste de aceitação:** Após aplicar em base limpa e em base com overload plantado, `count(*)=1` e `pronargs=0`.

### 4. F-3B-04 — “Recebido em” / “Em uso” sem prova de aceite do titular
- **Severidade:** Baixa (afirmação de interface)
- **Status:** CONFIRMADO
- **Arquivo/linha:** `meus-epis.tsx` L22–L28, L36–L41; `40_MARCO_3B_MEUS_EPIS.md` L13–L16; `contrato-epis.sql` L17–L19
- **Condição:** A data vem de `epi_deliveries.delivered_at` (lançamento administrativo). Não há vínculo com `epi_monthly_acknowledgements` nem assinatura da entrega.
- **Caminho de falha:** O titular lê “Recebido em” e “Em uso” / “Nenhum EPI atribuído” como confirmação de posse ou aceite; o esquema só prova que existe linha de entrega com `current_status`.
- **Evidência:** A própria documentação diz que ack mensal “não liga a confirmação a uma entrega específica” e que o portal “não afirma entrega confirmada”, mas o rótulo da tela é “Recebido em”.
- **Impacto:** Interpretação indevida em contexto de SST; sem vazamento cruzado.
- **Correção mínima:** Trocar para “Registrado em” / “Lançado em”; “Em uso” → “Entrega ativa no registro”.
- **Teste de aceitação:** Texto da tela não usa “recebido”, “confirmado” nem “atribuído” como sinônimo de aceite; teste de UI atualizado.

### 5. F-3B-05 — Nome e unidade históricos seguem o catálogo vivo
- **Severidade:** Baixa (integridade de apresentação)
- **Status:** CONFIRMADO
- **Arquivo/linha:** `contrato-epis.sql` L17–L18 (`item.name`, `item.unit`); `40_MARCO_3B_MEUS_EPIS.md` L16
- **Condição:** CA e variante são snapshot da entrega; nome e unidade não são.
- **Caminho de falha:** Rename/reclassificação de `epi_items` reescreve o histórico pessoal. Se `item_kind` deixar de ser `'epi'`, a linha some da consulta (join restritivo).
- **Evidência:** Documentado de propósito. Provas 3B não ensaiam rename nem mudança de `item_kind` após a entrega.
- **Impacto:** Histórico pessoal instável; possível omissão silenciosa. Sem cruzamento João/Maria por si só.
- **Correção mínima:** Snapshot de `name`/`unit` na entrega (ou view que prefira snapshot).
- **Teste de aceitação:** Após `UPDATE epi_items SET name=…` e `item_kind='uniform'`, o DTO pessoal permanece estável e previsível segundo a regra escolhida.

### 6. F-3B-06 — Fechamento parcial não entra nas provas 3B
- **Severidade:** Baixa
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `20260907060320_close_partial_epi_delivery.sql` L160–L205; `provas-3b.mjs` L41–L52; `meus-epis.tsx` L36–L46
- **Condição:** O modelo cria linha encerrada + reduz quantidade da ativa, reutilizando `delivered_at` e `delivery_reason`. As provas inserem só uma ativa e uma `replaced` inteira.
- **Caminho de falha:** Duas linhas com o mesmo “Recebido em”, mesmas variante/CA e motivos iguais — uma “Em uso” e uma no histórico — sem ensaio de parser (`quantity>0`) nem de agrupamento visual.
- **Evidência:** `resultado-3b.json` `joao_rows: 2` corresponde a capacete ativo + luva substituída, não a split parcial. HTTP sample não menciona `delivery_group_id`.
- **Impacto:** Ambiguidade de leitura; risco de o usuário somar quantidades como duas entregas distintas.
- **Correção mínima:** Caso sintético de `close_epi_delivery_quantity` parcial nas provas 3B e, se quiser clareza, agrupar por `delivered_at`+item na UI sem expor IDs.
- **Teste de aceitação:** Entrega 3 un → fecha 1; RPC devolve ativa `quantity=2` e histórica `quantity=1`; UI não sugere duas recepções independentes.

### 7. F-3B-07 — “Sem obra” nas provas não remove obra
- **Severidade:** Baixa
- **Status:** CONFIRMADO (lacuna do ensaio)
- **Arquivo/linha:** `provas-3b.mjs` L78–L80
- **Condição:** Só se anula `epi_employees.team_id`. O check seguinte (“sem obra mantém EPIs próprios”) relê a mesma RPC no mesmo estado.
- **Caminho de falha:** Regressão que dependesse de worksite/assignment passaria como 44/44.
- **Evidência:** Nenhum `update` em `teams`, `worksites` ou `employee_assignments` entre os dois checks.
- **Impacto:** Cobertura superestimada do requisito “funcionário sem equipe ou obra”.
- **Correção mínima:** Separar o caso “sem obra” (assignment/worksite nulos ou inativos) do caso “sem equipe”.
- **Teste de aceitação:** Dois checks independentes, cada um com mutação explícita e restauração.

### 8. F-3B-08 — Isolamento João/Maria e admin Gestão: desenho sólido; runtime só relatado
- **Severidade:** Informativa
- **Status:** PARCIAL
- **Arquivo/linha:** `contrato-epis.sql` L20–L33; `provas-3b.mjs` L51–L60, L67–L74; policies em `20260902231312_epi_management.sql` L122–L123
- **Condição:** A função não aceita ID de terceiro. SELECT direto em tabelas operacionais continua `GRANT` a `authenticated`, mas RLS exige `profiles.active` + papel Gestão — contas do portal são `not active`.
- **Caminho de falha (teórico):** cliente não oficial chama `/rest/v1/epi_deliveries` — deve receber vazio/`4xx`, não as linhas do DEFINER. Extra body/query só quebraria se existisse overload (F-3B-03).
- **Evidência:** Fonte confirma o recorte. JSON relata João 2 / Maria 1, strings cruzadas ausentes, admin com lista vazia, seis pares body/query + URL com ID. Auditor não chamou PostgREST.
- **Impacto:** Nenhum vazamento **confirmado** no texto. A prova de rede/Auth continua de segunda mão.
- **Correção mínima:** Recibo HTTP sanitizado (status + chaves do JSON, sem tokens) além do booleano `ok`.
- **Teste de aceitação:** Mesmos casos com corpo de resposta redigido no pacote.

### 9. F-3B-09 — JWT residual / revogação: efeito no SQL sim; ban Auth não está no pacote
- **Severidade:** Média (cadeia de sessão)
- **Status:** PARCIAL
- **Arquivo/linha:** `contrato-epis.sql` L31–L32; `20260925120000_employee_identity_foundation.sql` L239–L272; `provas-3b.mjs` L82–L86
- **Condição:** Identidade `revoked` zera o join. `admin_revoke_employee_identity` não dá `ban` em `auth.users` no SQL inspecionado; o login negado após revogar depende de `revokePreviewAccount`, arquivo **fora** do ZIP (`laboratorio-marco-1a/criar-contas-previa-1b.mjs`).
- **Caminho de falha:** Token ainda válido no Auth até expirar/refresh — a RPC já deve voltar vazio (mitiga leitura de EPI). Novo login/refresh só estão no JSON.
- **Evidência:** Função filtra `identity_link.status='active'`. Helper de ban não veio. 3A já listava “janela residual de token/sessão herdada de 2F”.
- **Impacto:** Sem EPI após revogar identidade, se o contrato aplicado for este. Encerramento Auth completo não é auditável neste pacote.
- **Correção mínima:** Incluir o helper de revogação sanitizado ou o trecho que aplica ban/`session logout` no pacote 3B.
- **Teste de aceitação:** Com JWT pré-revogação: RPC 0 linhas; `/token` password e refresh falham ou não reabrem identidade.

### 10. F-3B-10 — Função 3B só existe no contrato de laboratório
- **Severidade:** Média (governança / drift)
- **Status:** RISCO FUTURO
- **Arquivo/linha:** `contrato-epis.sql` L1; `40_MARCO_3B_MEUS_EPIS.md` L20; pasta `supabase/migrations/` (sem `my_personal_epi`)
- **Condição:** Declarado: aplicada só no Docker local; remoto intocado.
- **Caminho de falha:** Publicar o front 3B contra um projeto sem a função, ou colar o SQL no remoto sem o restante da fundação 1A/3A.
- **Evidência:** Grep das migrations do pacote: a função não está lá. Flags de prévia exigem `127.0.0.1:54321`.
- **Impacto:** Hoje o cliente de laboratório está amarrado ao loopback. O risco é promoção prematura, não o pacote atual.
- **Correção mínima:** Manter fora de migrations até autorização explícita; checklist de promoção separado.
- **Teste de aceitação:** Pipeline de publish recusa bundle colaborador se a função não estiver no catálogo alvo autorizado.

### 11. F-3B-11 — Segredos no pacote e recibo de scan
- **Severidade:** Baixa
- **Status:** PARCIAL
- **Arquivo/linha:** `resultado-segredos-3b.json` (`zip: null`, `findings: []`); `verificar-segredos-3b.mjs` L51–L59; `LEIA-ME.md` L10
- **Condição:** O scan embutido cobriu 11 fontes + 76 bundles **sem** o ZIP final. O recibo do ZIP fica de propósito fora, por autorreferência.
- **Caminho de falha:** Segredo introduzido só no empacotamento escaparia ao JSON interno.
- **Evidência:** Varredura passiva deste ZIP: sem PEM, sem `sb_secret_`, sem JWT real, sem URL `postgres://user:pass@`. Há senha só como estado de formulário e `jwt-sintetico` em testes. `.env` / `backups/` / chaves privadas **não** estão nas 45 entradas.
- **Impacto:** Pacote inspecionado aparenta limpo; a prova “0 achados no ZIP” não está dentro dele.
- **Correção mínima:** Recibo externo com SHA-256 deste ZIP (já conhecido) e `findings: []`.
- **Teste de aceitação:** Scan do ZIP fechado com a mesma lista de padrões + nomes de entrada proibidos = zero.

### 12. F-3B-12 — Prova de rede sanitizada e sem segundo host físico
- **Severidade:** Baixa
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `REDE_SANITIZADA.json` L138–L139; `40_MARCO_3B_MEUS_EPIS.md` L34; residual 3A
- **Condição:** 8/8 relatados em loopback / Ethernet / rede separada / firewall; IPs não-loopback omitidos; “segundo computador físico não ensaiado”.
- **Caminho de falha:** Exposição em LAN real, IPv6 de link-local ou host Windows mal sanitizado não está nesta prova.
- **Evidência:** JSON sanitizado, sem captura bruta. Auditor não sondou portas.
- **Impacto:** Limite já conhecido; não autoriza conclusão de isolamento de rede de produção.
- **Correção mínima:** Ensaio pontual com segundo host físico, ainda sanitizado.
- **Teste de aceitação:** Do segundo computador, conexões às portas 3101/54321 recusadas com firewall ligado.

### 13. F-3B-13 — Suítes 44/44, 10/10, 136/136 etc. não foram reexecutadas
- **Severidade:** Informativa
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `MANIFESTO_SHA256.json` `results`; `web.log` L8 “136 passed”; `banco.log` “tests 31”; `qualidade.log` “tests 44”; doc L32 (intermitência 135/136)
- **Condição:** O manifesto pede para não somar suítes sobrepostas. A doc admite falha intermitente anterior em Minha Equipe.
- **Caminho de falha:** Tratar os logs como reprodução independente.
- **Evidência:** Timestamps de logs ≠ timestamp do manifesto (15:29Z). Testes 3B de UI existem no ZIP e são coerentes com o código; a execução não ocorreu nesta auditoria.
- **Impacto:** Qualidade relatada, não atestada pelo auditor.
- **Correção mínima:** Nenhuma ação do auditor (proibido executar).
- **Teste de aceitação:** Fora de escopo deste modo.

---

## Respostas objetivas ao escopo

| Tema | Conclusão no texto / lacuna |
| --- | --- |
| DEFINER / search_path / grants / overloads | Contrato local adequado; catálogo vivo não visto (F-3B-02, F-3B-03) |
| `auth.uid()` e conta/identidade/funcionário ativos | Encadeamento explícito; portal ≠ Gestão (`not profile.active`) |
| Isolamento João/Maria | Desenho sem parâmetro de terceiro; runtime só no JSON (F-3B-08) |
| Admin Gestão | Join de portal + perfil inativo; esperado vazio |
| Revogação e JWT residual | RPC zera com identidade revogada; ban Auth fora do pacote (F-3B-09) |
| Sem equipe/obra | Sem equipe no SQL da consulta; ensaio “sem obra” vazio (F-3B-07) |
| `epi_deliveries` como fonte + `item_kind='epi'` | Sim, no contrato |
| Estados atual/histórico | UI parte `current_status==='active'`; demais no histórico |
| CA / variante | Snapshot da entrega; nome/unidade não (F-3B-05) |
| Fechamento parcial | Modelo existe; 3B não prova (F-3B-06) |
| DTO de nove campos | Contrato + parser exigem o conjunto exato |
| Leitura direta operacional | RLS Gestão; portal não deveria ver linhas; prova só relatada |
| Body/query/URL/ID | Sem overload no contrato; cliente não envia args; provas relatadas |
| Conta/abas, foco, logout | Código e testes de UI cobrem o descarte da lista |
| Indisponibilidade | Erro descarta lista; sem fallback remoto |
| Segredos | Pacote limpo na varredura passiva; scan do ZIP é externo (F-3B-11) |
| Rede | Sanitizada; sem 2º PC (F-3B-12) |
| UI promete confirmação ou validade de CA? | **Validade normativa: não.** **Confirmação de entrega: o rótulo “Recebido em”/“atribuído” extrapola o esquema (F-3B-04).** |

## Declaração final

**Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionável.**  
Os pontos confirmados são de redação de UI, snapshot incompleto, robustez do script SQL e qualidade de ensaio. O restante é lacuna de evidência (origem ZIP, catálogo vivo, Auth de revogação, parcial, rede física, suítes não reexecutadas) ou risco futuro de promoção.

Não se cria baseline 3B. Não se propõe execução pelo auditor. **SIMULAÇÃO SEM VALOR OFICIAL.**
