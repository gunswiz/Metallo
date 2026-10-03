# Parecer de auditoria adversarial — Marco 3E, ciclo 2 (último)

**Rótulo:** SIMULAÇÃO SEM VALOR OFICIAL. Sem baseline 3E. Sem produção, publicação ou remoto.  
**Limite deste auditor:** listar, extrair, ler, comparar e hashear. **Não** executei scripts do projeto, SQL, migrations, testes, Auth, containers, rotas, rede do laboratório nem Supabase. `55/55`, `17/17`, `165/165` e logs são prova **local do emissor**, não reprodução independente.  
**Origem 3D declarada:** `METALLO-3D-LAB-20260929-R1` / `4246426837e90324b1e2242ca2162dd0d2b0d3cd49c72abb8c209283ec6b9516`. ZIP completo da origem **ausente**; o hash da origem **não foi recomputado**. Manifesto 3D anexado confere (`d9dbe5be1a51f589a866b52486b336dd92d8924e80acd6049c936928d5900fd3`). Recortes `BASELINE_3D_RELEVANTE` batem com `origin_sha256` do delta.

---

## Integridade do pacote (não é aprovação)

| Controle | Resultado |
| --- | --- |
| SHA-256 do ZIP anexo | **Confere** `d2ea506abafa677f5d87b9df69e63bf05a99893e2223ee8ae41a917ecdf0011f` (anexo = recibo externo = valor pedido) |
| Entradas | **97** no ZIP; manifesto lista **96** + o próprio `MANIFESTO_SHA256.json` |
| Hashes manifesto × disco | **0 mismatches, 0 missing, 0 size mismatch** |
| `is_approved_baseline` | `false` no manifesto e no recibo |
| Recibo externo ciclo 2 | `passed: true`, `findings: []`, `values_redacted: true`; 7 alertas de “cookie literal” em `provas-3e.mjs` triados `NOT_SECRET` |
| Recibos bloqueados pré-envio | anexados (`Ciclo2-PreTriagem`, `Ciclo2-PreTriagemScanner`); montagens **não** enviadas |
| Scan interno 291 arquivos | agora no ZIP (`resultado-segredos-3e.json`): `passed: true`, `findings: []` |
| PDFs | 4 hashes e páginas (1 / 2 / 2 / 24) conferem com ciclo 1 e com o recibo; A4 `595.28 × 841.89`; `Producer: pdf-lib` |

Contrato SQL 3E e catálogo aplicado coincidem no JOIN corrigido (`item_kind='epi' or g.id is not null`), `owner=postgres`, `search_path=""`, `SECURITY DEFINER`, helper privado sem `EXECUTE` a `anon/authenticated/service_role`, públicas 3E só `authenticated`. Sem overload das RPCs 3E. FK `epi_deliveries.item_id → epi_items(id)` e `UNIQUE (exchange_request_id)` em `epi_delivery_groups_3d` e kits **constam no catálogo**.

---

## Conclusão executiva

**Não há achado CRÍTICO ou ALTO confirmado e aberto neste escopo** (IDOR João↔Maria no PDF/RPC 3E, `employee_id` injetável na RPC pessoal, `report_id` como índice persistente, filtro livre, rota Gestão sem `epi:write`, relatório que grava entrega/estoque, vazamento de CPF/ASO/salário/nota interna no payload 3E, segredo operacional no pacote, ou PDF que apresente Capacete atendido por Luva).

Permanecem **médio herdado condicionado**, **baixos residuais**, **riscos futuros** e **lacunas de ensaio** (provas HTTP não reexecutadas aqui).  
**Não aprovo baseline 3E, produção, publicação, certificação jurídica/SST nem fechamento de guarda.** Este é o segundo e último ciclo; não solicito terceiro.

---

## Confronto — estado final de todos os achados do ciclo 1

Classificação do emissor lida em `05_DOCUMENTACAO/43_MARCO_3E_FICHA_HISTORICO_EPI_PDF.md` e provas locais. Abaixo: juízo **independente** após releitura do código/SQL/PDFs/catálogo.

### F-3E-01 — Entrega some do relatório se o item sair do catálogo
- **Severidade:** Baixa (residual)
- **Estado final:** PARCIAL — **corrigido para entrega 3D com grupo**; residual documentado no legado sem grupo
- **Arquivo/linha:** `contrato-ficha-historico.sql` 30–35; catálogo `private.epi_report_payload_3e` (definição aplicada idêntica)
- **Condição:** continua `JOIN` interno em `epi_items` (a FK impede órfão por exclusão). O predicado passou a `(i.item_kind='epi' or g.id is not null)`.
- **Exploração/falha:** reclassificar item de grupo 3D para uniforme **não** apaga a entrega; uniforme **sem** grupo continua fora. Exclusão do item referenciado é bloqueada pela FK (prova emissor + catálogo). Não houve disable de constraint para fabricar órfão (`reproducao-ciclo1.json`: antes 1 entrega, após `item_kind` 0, depois restaurado — reprodução **pré-correção**).
- **Evidência:** SQL + catálogo + `resultado-3e.json` (“reclassificação… preserva…”, “FK impede exclusão…”, “uniforme sem grupo 3D não vira EPI”).
- **Impacto:** histórico 3D agrupado sobrevive à reclassificação atual. Legado sem snapshot de classificação ainda depende do catálogo vigente.
- **Correção mínima residual:** aceitar o limite documentado **ou**, só se a política exigir, snapshot de `item_kind` no registro legado — fora do que o 3E inventariou.
- **Aceitação:** entrega 3D com grupo e item reclassificado permanece; uniforme sem grupo não entra; `DELETE` do item referenciado falha na FK.
- **Confronto do emissor:** PARTIAL — **aceito**.

### F-3E-02 — Prévia Gestão trata negação como “laboratório indisponível”
- **Severidade:** Baixa (residual de status HTTP da página)
- **Estado final:** CONFIRMADO no ciclo 1; **corrigido no código**; residual de framework documentado
- **Arquivo/linha:** `funcionarios/[id]/epi/page.tsx` 30–33; `epi-report-3e.ts` 5–13; `pdf/route.ts` 35–38
- **Condição:** `epi_report_access_denied` e `employee_not_found` → `{status:404, message:"Relatório indisponível."}`; a prévia chama `notFound()`; demais falhas seguem 503 com texto de lab.
- **Exploração/falha:** a página Next, após iniciar streaming, pode responder **200** com boundary `NEXT_HTTP_ERROR_FALLBACK;404` (documentação oficial Next.js citada pelo emissor). A rota PDF responde **404 literal**, corpo neutro, `Cache-Control: private, no-store`. Prova emissor `denied_preview`: `status:200`, `not_found_marker:true`, `false_offline_message:false`, `personal_report_visible:false`.
- **Evidência:** código + `resultado-3e.json` + logs de diagnóstico preservados.
- **Impacto:** **não** entrega o PDF/relatório da outra pessoa. Diferença 200×404 é de transporte da prévia, não de autorização SQL.
- **Correção mínima residual:** nenhuma obrigatória no 3E; não exigir 404 literal da página streamed.
- **Aceitação:** João Gestão sem escopo em Maria: sem corpo de relatório na prévia; PDF 404 neutro.
- **Confronto do emissor:** VALID — corrigido — **aceito**, com o residual de status da página registrado, sem promovê-lo a IDOR.

### F-3E-03 — Extração sempre carrega o histórico completo (até 3.000)
- **Severidade:** Baixa no laboratório; média residual fora dele
- **Estado final:** CONFIRMADO (desenho) / RISCO FUTURO (produção/carga)
- **Arquivo/linha:** helper SQL 8–11; `projectEpiReport` filtra depois; PDF corta em 1.200; mensagem 422 distinta
- **Condição:** teto SQL independente do período. Texto público: *“Reduzir o período não reduz a extração atual.”* Limite do renderer: *“Escolha um período menor.”* Mensagens **distintas**, como pedido.
- **Evidência:** SQL + `epiReportFailure` + unidade 1.201 + prova emissor 3.001 em transação descartada, sem persistência/estoque.
- **Impacto:** recusa controlada; sem escrita. DoS sob carga **não** foi reproduzido aqui nem declarado como falha de desempenho comprovada.
- **Correção mínima:** só se for produção — filtrar/paginar no SQL.
- **Aceitação:** 3.001 entregas → `epi_report_too_large` / 422; 1.201 eventos → recusa do PDF sem truncar.
- **Confronto:** PARTIAL — **aceito**. Não extrapolo desempenho, impressão ou zoom.

### F-3E-04 — `can_operate` padrão de engenheiro cobre qualquer equipe
- **Severidade:** Média **se** o papel default (`operation_team_ids` NULL) for o de produção
- **Estado final:** PARCIAL — regra **herdada 3D**, não alterada no 3E
- **Arquivo/linha:** catálogo `public.can_operate`: `else p.role = 'engineer' or p.team_id = p_team_id` quando a lista é nula; `admin_epi_report_3e` 68–71
- **Condição:** engenheiro com lista **explícita A** é negado em B (RPC, prévia, PDF — prova emissor). Engenheiro **NULL** conserva alcance global **de propósito**. Portal pessoal não aceita `employee_id`.
- **Evidência:** definição aplicada; testes 3E distinguem A/B explícito vs default NULL; núcleo `can_operate` intocado.
- **Impacto:** não é bypass de restrição explícita. É decisão de modelo anterior ao 3E.
- **Correção mínima:** revisão empresarial dos defaults **antes de produção** (fora do delta 3E).
- **Aceitação:** engenheiro só da equipe A recebe deny ao UUID da equipe B; NULL permanece documentado.
- **Confronto:** PARTIAL — regra herdada — **aceito**. Não trato o default NULL como IDOR 3E novo.

### F-3E-05 — Gestão emite relatório de funcionário inativo
- **Severidade:** Baixa (política SST × desligamento)
- **Estado final:** LACUNA sanada como **regra documentada** — não é falha aberta
- **Arquivo/linha:** `admin_epi_report_3e` não testa `e.active`; `my_epi_report_3e` exige `e.active` + vínculo `active` + `not p.active` no perfil portal
- **Condição:** titular inativo/JWT revogado some no portal; Gestão autorizada lê história, sem reativar login.
- **Evidência:** SQL + provas “Gestão autorizada conserva histórico de funcionário inativo”, “JWT residual revogado não emite”, “revogação pessoal não apaga história da Gestão”.
- **Impacto:** continuidade histórica, não reabertura de conta.
- **Correção mínima:** nenhuma no código 3E; política de retenção/desligamento permanece gate futuro.
- **Aceitação:** pessoal inativo/revogado deny; Gestão com escopo lê.
- **Confronto:** VALID — lacuna sanada — **aceito**.

### F-3E-06 — Subconsulta `new_group_id` sem `LIMIT`
- **Severidade:** n/a como falha atual
- **Estado final:** HIPÓTESE **encerrada** — INVALID como vulnerabilidade 3E
- **Arquivo/linha:** helper ~50–51; catálogo `epi_delivery_groups_3d_exchange_request_id_key UNIQUE (exchange_request_id)` (e o mesmo nos kits)
- **Evidência:** constraint aplicada + prova “grupo de entrega tem unicidade aplicada por pedido de troca”. Sem `LIMIT` que esconderia duplicata.
- **Impacto:** só se a unicidade 3D for removida.
- **Correção mínima:** não adicionar `LIMIT` cosmética.
- **Aceitação:** UNIQUE visível no catálogo; segundo grupo no mesmo pedido é impossível no estado aplicado.
- **Confronto:** INVALID como falha atual — **aceito**.

### F-3E-07 — PDF é projeção regenerável, sem guarda/assinatura
- **Severidade:** n/a jurídica neste marco
- **Estado final:** RISCO FUTURO (aceite)
- **Arquivo/linha:** `epi-report-3e-pdf.ts`; `report_id = gen_random_uuid()`; rota PDF **não** lê `report_id` da query
- **Evidência:** quatro amostras com UUIDs de laboratório distintos; metadados pdf-lib; hashes do pacote ≠ assinatura do PDF. Amostras **idênticas** às do ciclo 1 (hashes conferidos).
- **Impacto:** disputa sobre “o PDF de setembro” não se resolve no 3E.
- **Correção mínima:** gate futuro de arquivo/retenção; não fingir ICP-Brasil.
- **Confronto:** VALID — risco futuro — **aceito**.

### F-3E-08 — Gates NR-6 / LGPD / SST / retenção / identidade empresarial
- **Severidade:** n/a neste laboratório
- **Estado final:** RISCO FUTURO
- **Evidência nos PDFs extraídos:** confirmação descrita como fato do portal; ciência manuscrita com aviso *“não substitui nem cria retroativamente…”*; ficha: *“espaços acima não indicam assinatura já realizada”*; sem CNPJ, ICP-Brasil, assinatura avançada/qualificada. Checklist jurídico na doc 43 permanece aberto.
- **Confronto:** VALID — gates de uso real — **aceito**.

### F-3E-09 — Administrador do host/banco
- **Severidade:** fora do app
- **Estado final:** RISCO FUTURO / risco administrativo do host
- **Evidência:** `SECURITY DEFINER` + owner `postgres`; RLS não limita o owner. Distinto de João↔Maria.
- **Confronto:** VALID — **aceito**.

### F-3E-10 — Cópia baixada sobrevive a logout
- **Severidade:** Baixa (aceite)
- **Estado final:** RISCO FUTURO
- **Arquivo/linha:** `epi-relatorios.tsx` 26–31 e 53–59 (`revokeObjectURL` no unmount e ~1 s); rota PDF `no-store`; sessão com `generation` / `endingClient`
- **Confronto:** VALID — limite preservado — **aceito**.

### F-3E-11 — Suíte Web em corrida 158/159
- **Severidade:** n/a 3E
- **Estado final:** LACUNA de ensaio **reduzida**, não eliminada
- **Evidência do emissor (não reexecutada):** `web-tentativa-paralela.log` (158/159 anterior); duas corridas sequenciais ciclo 2 **165/165** (`web-ciclo2-sequencial-1.log` / `2`). Causa por carga continua inferência.
- **Confronto:** PARTIAL — duas repetições aprovadas — **aceito como redução de lacuna**, sem garantia anti-flake.

### F-3E-12 — Recibo interno `resultado-segredos-3e.json` ausente
- **Severidade:** Informativa
- **Estado final:** LACUNA **fechada neste pacote**
- **Evidência:** arquivo presente, 101 100 bytes, `passed: true`, `findings: []`, `values_redacted: true`, 291 arquivos, 10 credenciais locais só em memória. Recibo **externo** do ZIP é outro artefato. Alertas brutos de cookie/CPF-na-logo triados; PDFs sem token CPF/ASO/salário/nota interna.
- **Confronto:** VALID — evidência acrescentada — **aceito**.

Nenhum F-3E-13 novo confirmado. O status 200+boundary da prévia fica como residual de F-3E-02, não como vulnerabilidade separada.

---

## Controles obrigatórios — inspeção deste ciclo

| Tema | Resultado neste pacote |
| --- | --- |
| João PDF/dados de Maria e inverso | RPC pessoal sem parâmetros; allowlist `portalFetch` só `my_epi_report_3e`; provas emissor de extra-args e cruzamento. Código consistente. |
| `employee_id` em RPC/body/URL | Pessoal: função `()`; Gestão: `p_employee_id` + `can_operate` / admin se equipe nula. |
| `report_id` enumerável | Novo UUID por emissão; rota PDF ignora `report_id` na query (prova emissor). |
| Filtro querystring | Allowlist de eventos; `2026-02-30` e invertido recusados no modelo. |
| Rota PDF Gestão | `requireCapability("epi:write")` + SQL; lab URL travada a `127.0.0.1:54321`. |
| Sem equipe | Pessoal segue; Gestão só `admin` ativo (`equipe nula não amplia…`). |
| Inativo / JWT residual | Pessoal bloqueia; Gestão autorizada lê; prova de revoke. |
| Relatório altera fatos | Helper só `SELECT` + `now()`/`gen_random_uuid()`; provas “não altera entregas/feedback”. |
| SECURITY DEFINER / grants / RLS | Catálogo ≡ contrato 3E; feedback/grupos/troca sem SELECT autenticado direto. |
| CPF/ASO/salário/notas | Fora do `jsonb_build_object` 3E; quatro PDFs sem esses tokens. ASO permanece na ficha Gestão **pré-3E** (`funcionarios/[id]/page.tsx`) — fora do payload PDF. |
| Segredo no pacote | Nenhum valor operacional no que foi lido; cookies das provas = jar em memória (hashes de expressão conferidos no recibo). |
| Cache / Blob / geração pendente | `no-store`; revoke; ticket de geração na sessão. |
| Injeção HTML/filename | React na prévia; PDF `drawText` + `safe()`; filename = tipo + UUID sanitizado. |
| Datas / fuso / inclusivo | `America/Fortaleza`. Filtrado: `10/01/2026` só como origem da troca; **sem** evento “Entrega registrada” de janeiro. |
| Ficha ≠ histórico | Ficha = `status=active` + rótulo de feedback; histórico = linha do tempo. Confirmação ≠ entrega. “aprovação não equivale à entrega ou à confirmação” no PDF. |
| CA | `ca_snapshot` (CA-12345 na origem; CA-67890 na entrega de setembro). Sem validade de produto. |
| Legado | Flag + texto quando snapshot nulo. |
| Capacete × Luva | Fixture de teste: mesmo `item_id`; ramo incompatível avisa e **não** declara atendimento. Prova emissor: `exchange_item_mismatch`, estoque da Luva inalterado. PDFs da amostra: **0** ocorrências de “Luva”. |
| Responsável nominal | SQL fixa `responsible_name_snapshot: null`; PDF: aviso, sem UUID como nome; `responsible_id` só no DTO. |
| Referências | `Entrega 001/002`, `Grupo 001/002` locais; janeiro citado no filtro com a mesma referência. |
| PDFs | Logo, A4, margens 42–553 pt, `Página X de Y` em todas as páginas, ciência **uma vez** (p. 2/2, 2/2, 24/24), aviso integral, enums humanizados, `1 unidade` / `2 unidades`. Render 100/200% do emissor ≠ zoom de navegador. |

---

## O que permanece aberto

- **Crítico/Alto confirmado e aberto neste ciclo:** nenhum.
- **Médio:** F-3E-04 (herança `can_operate` com `operation_team_ids` NULL — só relevante se esse default for produção).
- **Baixo residual:** F-3E-01 (legado sem grupo / sem snapshot de classificação); F-3E-02 (status 200+boundary da prévia streamed vs 404 do PDF); F-3E-03 no laboratório.
- **Lacunas de ensaio:** HTTP/Auth 3E e suíte Web **não reexecutados por este auditor**; flake histórico reduzido por duas corridas 165/165 do emissor.
- **Riscos futuros / gates:** F-3E-03 produção, F-3E-07, F-3E-08, F-3E-09, F-3E-10.

**Não aprovo baseline 3E, produção, publicação nem fechamento jurídico.** Ciclo 2 encerrado do lado do auditor. O emissor confronta e **para, sem baseline**.