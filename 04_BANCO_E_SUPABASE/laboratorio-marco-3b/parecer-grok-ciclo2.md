# Auditoria adversarial somente leitura — Marco 3B Meus EPIs, ciclo 2 (último)

**SIMULAÇÃO SEM VALOR OFICIAL.** Inspeção passiva do ZIP. Nada disto é baseline, publicação, ponto oficial ou REP-P. O auditor **não executou** scripts do projeto, SQL, Auth, testes, containers nem rede do laboratório. `resultado-3b.json`, logs, `REDE_SANITIZADA.json` e recibos de scan são **evidência fornecida**, não reproduzida aqui.

## Cadeia de integridade

| Item | Resultado |
| --- | --- |
| ZIP | `Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo2.zip` |
| SHA-256 do ZIP | `5f1530ae05644bd267ba99692b0eddc6915d336fbe9546587d19e9dc083f4f79` — **confere** com o valor declarado |
| Entradas | **49** — confere com `zip_entries` e com `unzip -Z1 \| wc -l` |
| `MANIFESTO_SHA256.json` | `id=METALLO-3B-AUDITORIA-CICLO2`, `is_approved_baseline=false`, rótulo obrigatório presente |
| Inventário | 48 caminhos com `bytes`+`sha256` — **todos conferem**. O 49º é o próprio manifesto |
| Origem declarada | `METALLO-3A-LAB-20260928-R1` / `907e26c0b51fdd781a2233a03782c31349630ab3e9dc61e5f96ada0005d52c4a` |
| ZIP da origem | **não incluso** (declarado). `BASELINE_3A_MANIFESTO.json` tem `id` idêntico; os 6 arquivos de `BASELINE_3A_RELEVANTE/` conferem com os hashes desse manifesto 3A |
| Parecer ciclo 1 | SHA-256 do texto **sem** quebra final = `f6b8510341e68f83700ff319b0ef246bfec63c768bd1cbff937bfa3db5a233df` — confere com o documento 40 |
| Recibo scan ZIP 1 | `outputs/…Ciclo1.zip.verificacao.json`: hash `4a6c28843655bbf6ddce8f885c63995ea1faac954c4954d74cd8a1e39d8d58a9`, 45 entradas, `findings: []` |
| Escopo | laboratório sintético; remoto intocado; sem autorização de baseline 3B |

Varredura passiva deste ZIP: sem PEM, sem `sb_secret_` real, sem JWT completo, sem `postgres://user:pass@`. Menções a `service_role` estão em comentário, teste negativo ou helper de servidor. `.env`, `backups/` e chaves privadas **não** estão nas 49 entradas.

**Nenhum achado CRÍTICO ou ALTO confirmado e aberto no escopo local inspecionável.**

---

## Confronto F-3B-01 a F-3B-13

### F-3B-01 — Origem imutável não é verificável por hash neste pacote
- **Severidade:** Baixa (custódia)
- **Ciclo 1:** LACUNA DE EVIDÊNCIA
- **Ciclo 2:** **LACUNA DE EVIDÊNCIA (preservada; mitigada parcialmente)**
- **Confronto:** O documento 40 classifica PARTIAL. O ZIP 3A continua fora. Há manifesto 3A embutido e recorte relevante com hashes coincidentes; o responsável declara conferência local do SHA-256 `907e26c0…`. Isso **não** permite ao auditor recalcular o hash do ZIP 3A.
- **Situação final:** lacuna de custódia independente **aberta**. Não é falha do produto 3B.

### F-3B-02 — Dono, catálogo vivo, overloads e grants
- **Severidade:** Média (confiança na prova)
- **Ciclo 1:** LACUNA DE EVIDÊNCIA
- **Ciclo 2:** **PARCIAL**
- **Confronto:** `resultado-3b.json` agora inclui bloco sanitizado `catalog`: `owner=postgres`, `security_definer=true`, `empty_search_path=true`, `anon_execute=false`, `authenticated_execute=true`, `signatures="1"`, `zero_arguments=true`. `provas-3b.mjs` L27–L35 consulta `pg_proc`/ACL. O auditor **não** executou o banco.
- **Situação final:** evidência de segunda mão **ampliada**, não prova de primeira mão.

### F-3B-03 — Contrato sem amarração de owner nem limpeza de overload
- **Severidade:** Baixa (robustez do script)
- **Ciclo 1:** CONFIRMADO
- **Ciclo 2:** **FECHADO no texto do contrato local**
- **Confronto:** `contrato-epis.sql` L5–L15 aborta com `my_personal_epi_overload_not_allowed` se existir assinatura com `pronargs <> 0`; L49 faz `ALTER FUNCTION … OWNER TO postgres`. Não há `DROP FUNCTION` de todas as assinaturas — o contrato **recusa** catálogo sujo em vez de limpá-lo. Para laboratório isso atende o risco apontado (PostgREST resolver outra forma).
- **Situação final:** defeito de robustez do script **corrigido no artefato**. Estado real do Docker permanece no JSON (F-3B-02).

### F-3B-04 — “Recebido em” / “Em uso” sem prova de aceite
- **Severidade:** Baixa (afirmação de UI)
- **Ciclo 1:** CONFIRMADO
- **Ciclo 2:** **FECHADO quanto aos rótulos originais**
- **Confronto:** `meus-epis.tsx` usa “Registrado em”, “Registros ativos”, “Ativo no registro” e rodapé explícito de que a tela **não comprova recebimento ou aceite**. Teste UI L48–L50 recusa “Recebido em”. A data continua sendo `epi_deliveries.delivered_at`. Vocabulário “entrega” permanece operacional, agora qualificado.
- **Situação final:** extravasamento de aceite dos rótulos C1 **não reproduzido** no código C2.

### F-3B-05 — Nome e unidade históricos seguem o catálogo vivo
- **Severidade:** Baixa (integridade de apresentação)
- **Ciclo 1:** CONFIRMADO
- **Ciclo 2:** **CONFIRMADO — residual aberto**
- **Confronto:** Contrato L30–L43 ainda lê `item.name` / `item.unit` do catálogo e restringe `item.item_kind = 'epi'`. CA/variante continuam snapshot da entrega. Rodapé e documento 40 **divulgam** o limite; **não o removem**. Nenhuma prova ensaiou `UPDATE` de nome ou `item_kind` após a entrega.
- **Caminho de falha (inalterado):** rename reescreve o histórico pessoal; reclassificar para não-`epi` **omite a linha** sem erro visível de contrato.
- **Situação final:** risco de modelo **confirmado e aberto**. Texto de UI **não** fecha o achado.

### F-3B-06 — Fechamento parcial fora das provas
- **Severidade:** Baixa
- **Ciclo 1:** LACUNA DE EVIDÊNCIA
- **Ciclo 2:** **FECHADO quanto à lacuna de ensaio**; residual de apresentação
- **Confronto:** `provas-3b.mjs` L94–L106 cria quantidade 3, chama `close_epi_delivery_quantity` (Gestão) com 1, exige ativa `quantity=2` + encerrada `quantity=1`, mesma data/CA, soma 3. `http_samples` registra `close_status=200`, `active_quantity=2`, `closed_quantity=1`, `total_quantity=3`. A UI **não** agrupa as duas linhas; ficam “Registros ativos” + “Histórico” com o mesmo “Registrado em”.
- **Situação final:** o modelo e o ensaio 3→2+1 existem na evidência fornecida. Ambiguidade visual residual, agora com rótulo de registro, **não** é exploração.

### F-3B-07 — “Sem obra” não removia obra
- **Severidade:** Baixa (qualidade do ensaio)
- **Ciclo 1:** CONFIRMADO
- **Ciclo 2:** **FECHADO no script de provas**
- **Confronto:** L84–L91 separam “sem equipe” (`team_id=null`) de obra real: insert em `worksites`, `my_current_work` com 1 linha, `active=false`, depois obra 0 **e** EPIs pessoais 2.
- **Situação final:** lacuna do ensaio C1 **corrigida no texto**. Runtime só no JSON.

### F-3B-08 — Isolamento João/Maria e admin Gestão
- **Severidade:** Informativa
- **Ciclo 1:** PARCIAL
- **Ciclo 2:** **PARCIAL (evidência HTTP ampliada)**
- **Confronto:** Função sem argumento de terceiro; portal com `not profile.active`. JSON relata isolamento, admin vazio, body/query/URL. `http_samples` de leitura direta: **status 200, rows 0** (RLS vazia, não 4xx) para João/Maria em `epi_deliveries`, `epi_items`, `epi_employee_items`, `epi_monthly_acknowledgements`. Sem tokens. Amostra “João/Maria pessoais” usa o `j` **anterior** ao split (2/1) — higiene da evidência, não vazamento visto.
- **Situação final:** desenho sólido no código; runtime de segunda mão.

### F-3B-09 — JWT residual / revogação
- **Severidade:** Média (cadeia de sessão)
- **Ciclo 1:** PARCIAL
- **Ciclo 2:** **PARCIAL (helper agora inspecionável)**
- **Confronto:** `admin_revoke_employee_identity` (foundation L239–L272) só marca identidade `revoked` e perfil inativo; **não** dá ban no Auth. `revogar-conta-portal-servidor.mjs` aplica RPC + `ban_duration: "876000h"` só em `http://127.0.0.1:54321`. `criar-contas-previa-1b.mjs` L66–L68 delega `revokePreviewAccount` a esse helper. Provas relatam JWT residual → 0 EPIs; login e refresh ≥400 ou lista vazia.
- **Situação final:** corte SQL + ban de laboratório **visíveis no pacote**. Janela residual de token até o ban/expiração permanece **risco herdado**, não fechado por este marco.

### F-3B-10 — Função 3B só no contrato de laboratório
- **Severidade:** Média (governança)
- **Ciclo 1:** RISCO FUTURO
- **Ciclo 2:** **RISCO FUTURO (inalterado)**
- **Confronto:** `my_personal_epi` **não** está em `supabase/migrations/`. Cliente preso a `127.0.0.1:54321`. Documento 40 e AGENTS.md vedam publicação/remoto.
- **Situação final:** risco de promoção prematura, não do pacote atual.

### F-3B-11 — Segredos no pacote e recibo de scan
- **Severidade:** Baixa
- **Ciclo 1:** PARCIAL
- **Ciclo 2:** **FECHADO para o ZIP 1**; autorreferência do ZIP 2 preservada
- **Confronto:** Recibo externo do ciclo 1 está no pacote, hash idêntico ao parecer C1, `findings: []`. `resultado-segredos-3b.json` interno ainda tem `zip: null` (scan de fontes/bundles). Manifesto aponta `secret_scan_receipt` do **próprio** ZIP 2 **fora** deste arquivo — esperado por autorreferência.
- **Situação final:** pedido C1 atendido. Prova “0 achados no ZIP 2” não cabe dentro do ZIP 2.

### F-3B-12 — Rede sanitizada sem segundo host físico
- **Severidade:** Baixa
- **Ciclo 1:** LACUNA DE EVIDÊNCIA
- **Ciclo 2:** **LACUNA DE EVIDÊNCIA (preservada)**
- **Confronto:** `REDE_SANITIZADA.json` 8/8, listeners/bindings só loopback, IPs não-loopback omitidos, `physical_lan_test`: “segundo computador físico não ensaiado”.
- **Situação final:** limite conhecido. Não autoriza isolamento de produção.

### F-3B-13 — Suítes não reexecutadas pelo auditor
- **Severidade:** Informativa
- **Ciclo 1:** LACUNA DE EVIDÊNCIA
- **Ciclo 2:** **LACUNA DE EVIDÊNCIA (preservada)**
- **Confronto:** Manifesto: 48/48, 10/10, 136/136, 31/31, 44/44, TS/lint/build aprovados; `overlapping_suites_do_not_sum=true`. `web.log` “136 passed”; `banco.log` “tests 31”; qualidade inclui a matriz de banco. Timestamps de evidência ≠ instante desta inspeção. Intermitência histórica 135/136 permanece **não demonstrada** (declarada no doc 40).
- **Situação final:** qualidade **relatada**, não atestada por reexecução (proibida).

---

## Achados novos deste ciclo

Não há falha de produto **confirmada** além dos residuais já numerados. Itens abaixo não sobem a CRÍTICO/ALTO.

### F-3B-14 — Scan direto do ZIP do ciclo 2 não está dentro dele
- **Severidade:** Baixa
- **Status:** LACUNA DE EVIDÊNCIA
- **Arquivo/linha:** `MANIFESTO_SHA256.json` `secret_scan_receipt`; `LEIA-ME.md` L10; `resultado-segredos-3b.json` `zip: null`
- **Condição:** O recibo nomeado `outputs/Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo2.zip.verificacao.json` não é uma das 49 entradas.
- **Caminho de falha:** Segredo introduzido só no empacotamento do ciclo 2 não teria recibo **dentro** do artefato (o auditor fez varredura passiva própria e não viu padrão de segredo).
- **Evidência:** Inventário conferido; path do recibo C2 ausente; scan interno cobre 11 fontes + 76 bundles sem o ZIP final.
- **Impacto:** Mesma autorreferência já aceita no ciclo 1.
- **Correção mínima:** Manter o recibo C2 ao lado do ZIP, fora dele.
- **Teste de aceitação:** Fora do modo passivo desta auditoria.

### F-3B-15 — Duas linhas do fechamento parcial na UI, mesma data/CA
- **Severidade:** Baixa (apresentação)
- **Status:** RISCO FUTURO / residual de F-3B-06
- **Arquivo/linha:** `meus-epis.tsx` L36–L46; `provas-3b.mjs` L99–L104
- **Condição:** Parser aceita as duas linhas (`quantity>0`); a tela lista uma em ativos e uma no histórico, ambas com “Registrado em” idêntico. Não há agrupamento sem ID.
- **Caminho de falha:** Leitura leiga como duas recepções independentes. Rótulos e rodapé reduzem, não eliminam, a ambiguidade.
- **Evidência:** Código e ensaio 3→2+1. Nenhum teste de UI do split parcial.
- **Impacto:** Confusão de leitura, sem cruzamento João/Maria.
- **Correção mínima:** Agrupar visualmente por instante+item+CA sem expor IDs, ou uma linha “quantidade remanescente / encerrada”.
- **Teste de aceitação:** UI do caso 3→2+1 não sugere duas recepções distintas.

Nenhuma hipótese (rede LAN real, catálogo Docker divergente do JSON, intermitência 135/136) foi promovida a falha comprovada.

---

## Controles observados (não são falhas)

- `SECURITY DEFINER` + `search_path = ''` + nomes qualificados + 9 colunas explícitas + `auth.uid()` → identidade ativa → portal → `not profile.active` → funcionário ativo → entregas próprias → `item_kind='epi'`
- Titularidade **sem** `team_id`/obra
- `REVOKE ALL` + `GRANT EXECUTE` só a `authenticated`
- Cliente: allowlist loopback + RPCs pessoais; parser de nove chaves; `quantity > 0`; sem cache próprio; foco/visibilidade/logout zeram estado
- UI **não** afirma validade normativa do CA (“CA registrado”, oculto se vazio)
- `epi_monthly_acknowledgements` e kits **não** entram na tela
- Mutação `close_epi_delivery_quantity` **fora** da allowlist do portal

## Respostas objetivas ao pedido deste ciclo

| Tema pedido | Situação no pacote |
| --- | --- |
| Bloqueio de overload + OWNER postgres | Presente no contrato; catálogo vivo só no JSON sanitizado |
| Catálogo local sanitizado | `resultado-3b.json` `catalog` com owner, DEFINER, search_path, ACL, assinaturas |
| Rótulos lançamento ≠ aceite | “Registrado em” / rodapé; “Recebido em” ausente no código vigente |
| Obra efetivamente desativada | Ensaio no script: insert + `active=false` + `my_current_work` vazio |
| Fechamento parcial 3→2+1 | Ensaio + sample HTTP; UI em duas seções |
| Status/contagens HTTP sem tokens | `http_samples` 200/0 nas tabelas operacionais |
| Helper servidor de revogação | `revogar-conta-portal-servidor.mjs` no ZIP, usado pelas provas |
| Recibo scan do primeiro ZIP | Incluído; hash C1 confere |
| Nome/unidade vivos + omissão por reclassificação | **Risco confirmado preservado (F-3B-05)** |
| Segundo computador físico | **Não ensaiado (F-3B-12)** |

---

## Declaração final

**Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionável.**

Abertos no sentido útil para o responsável:

- **CONFIRMADO residual:** F-3B-05 (snapshot de nome/unidade; omissão se `item_kind` mudar)
- **PARCIAL / segunda mão:** F-3B-02, F-3B-08, F-3B-09 (janela de token herdada)
- **LACUNA:** F-3B-01, F-3B-12, F-3B-13, F-3B-14
- **RISCO FUTURO:** F-3B-10, F-3B-15
- **FECHADOS no artefato C2:** F-3B-03, F-3B-04, F-3B-06 (ensaio), F-3B-07, F-3B-11 (ZIP 1)

O responsável **pode considerar um pedido posterior de fechamento técnico local** do Marco 3B, com estes residuais explícitos no termo, **sem** criar baseline 3B, **sem** publicar, **sem** alterar Supabase remoto e **sem** valor oficial. Fechamento técnico local ≠ autorização de Marco 3C nem de promoção da RPC.

Não se cria baseline. Não se propõe execução pelo auditor. **SIMULAÇÃO SEM VALOR OFICIAL.**
