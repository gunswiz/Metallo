# Parecer de auditoria adversarial — Marco 3E, ciclo 1

**Escopo:** inspeção passiva do ZIP `Metallo-Marco3E-FichaHistorico-Auditoria-20260929-Ciclo1.zip` e do recibo externo.  
**Rótulo obrigatório:** SIMULAÇÃO SEM VALOR OFICIAL. Sem baseline 3E. Sem produção, publicação ou remoto.  
**Limite deste auditor:** listar, extrair, ler, comparar e hashear. **Não** executei scripts, SQL, testes, Auth, containers, rotas nem Supabase. Os `41/41` e logs do emissor são prova **local do emissor**, não reprodução independente.

## Controles de integridade (não são aprovação)

| Controle | Resultado |
| --- | --- |
| SHA-256 do ZIP | **Confere** `aa0d72bd950cb7eefe1c93afcbfd315da65cf8c769de17ccd0e08bf212a68570` (anexo = recibo) |
| Entradas | **84** arquivos; manifesto lista **83** + o próprio `MANIFESTO_SHA256.json` |
| Hashes manifesto × disco | **0 mismatches, 0 missing** |
| Origem declarada | `METALLO-3D-LAB-20260929-R1` / `4246426837e90324b1e2242ca2162dd0d2b0d3cd49c72abb8c209283ec6b9516` — **não recomputada** (ZIP 3D ausente, como previsto) |
| Recortes `BASELINE_3D_RELEVANTE` | hashes batem com `origin_sha256` do delta 3D→3E |
| `is_approved_baseline` | `false` no manifesto e no recibo |
| Recibo de scan | `passed: true`, `findings: []`, `values_redacted: true`; alerta de “cookie literal” em `provas-3e.mjs` triado como `NOT_SECRET` (jar em memória) — conferido no fonte |
| PDFs | 4 hashes e contagens de páginas (1 / 2 / 2 / 24) conferem; A4 `595.28 × 841.89`; texto extraído e renderização local 72–100 dpi |

Contrato SQL 3E ≡ catálogo aplicado (`owner=postgres`, `search_path=""`, `SECURITY DEFINER`, helper privado sem `EXECUTE` a `anon/authenticated/service_role`, públicas só `authenticated`).

---

## Conclusão executiva

**Não há achado CRÍTICO ou ALTO confirmado e aberto neste escopo** (IDOR João↔Maria no PDF/RPC 3E, `employee_id` injetável na RPC pessoal, `report_id` como índice, filtro livre, rota Gestão sem `epi:write`, relatório que grava entrega/estoque, vazamento de CPF/ASO/salário/nota interna no payload 3E, segredo no pacote, ou PDF que apresente Capacete atendido por Luva).

Permanecem **médios herdados / baixos / lacunas / riscos futuros**. Isto **não** aprova baseline, produção ou publicação.

---

## Achados

### F-3E-01 — Entrega some do relatório se o item sair do catálogo
- **Severidade:** Baixa  
- **Estado:** CONFIRMADO  
- **Arquivo/linha:** `contrato-ficha-historico.sql` ~30–32; catálogo `private.epi_report_payload_3e`  
- **Condição:** `from public.epi_deliveries d join public.epi_items i on i.id=d.item_id ... and i.item_kind='epi'` (INNER JOIN).  
- **Exploração/falha:** item excluído ou `item_kind` alterado → linha histórica omitida, sem aviso de “entrega órfã”.  
- **Evidência:** SQL e definição aplicada idênticas.  
- **Impacto:** histórico incompleto; não é IDOR.  
- **Correção mínima:** `LEFT JOIN` + cartão “item de catálogo indisponível”, ou recusar item sem snapshot.  
- **Aceitação:** entrega com `item_id` inexistente ainda aparece identificada como lacuna de catálogo.

### F-3E-02 — Prévia Gestão trata negação de acesso como “laboratório indisponível”
- **Severidade:** Baixa  
- **Estado:** CONFIRMADO  
- **Arquivo/linha:** `funcionarios/[id]/epi/page.tsx` ~30–32; contraste `pdf/route.ts` ~35–38  
- **Condição:** `report3e(id).catch(() => null)` sem distinguir `epi_report_access_denied`, `employee_not_found` e falha de lab.  
- **Exploração/falha:** operador com `epi:write` global mas sem equipe no SQL vê a mesma mensagem de queda do lab. A rota PDF responde **404** no deny e **400** em filtro/período inválidos — melhor.  
- **Evidência:** código; provas do emissor (`URL de PDF Gestão sem permissão` → 307 por `requireCapability` antes do SQL).  
- **Impacto:** UX e diagnóstico; **não** entrega o PDF da outra pessoa.  
- **Correção mínima:** mapear `access_denied` / `employee_not_found` para 404 homogêneo na prévia.  
- **Aceitação:** João Gestão sem escopo em Maria recebe 404/indisponível, nunca o corpo do relatório.

### F-3E-03 — Extração sempre carrega o histórico completo (até 3.000)
- **Severidade:** Baixa no laboratório; média residual fora dele  
- **Estado:** CONFIRMADO (desenho) / RISCO FUTURO (produção)  
- **Arquivo/linha:** helper SQL ~8–11 e agregações; `projectEpiReport` filtra depois; `buildEpiReport3ePdf` corta em 1.200  
- **Condição:** atalho “hoje” ou intervalo curto ainda materializa até 3.000 entregas + 3.000 feedbacks + 3.000 eventos de troca.  
- **Exploração/falha:** DoS de CPU/memória no PostgREST/Node, não “período enorme” em si. Há teto e `epi_report_too_large`.  
- **Evidência:** contrato + gerador + documentação (limites admitidos).  
- **Impacto:** indisponibilidade local; sem escrita.  
- **Correção mínima (só se for a produção):** filtrar período/tipo no SQL ou paginar.  
- **Aceitação:** consulta `today` de titular com 3.001 entregas falha de forma controlada, sem 5xx opaco.

### F-3E-04 — `can_operate` padrão de engenheiro cobre qualquer equipe
- **Severidade:** Média **se** esse papel for usado em produção sem `operation_team_ids`; fora do delta 3E  
- **Estado:** PARCIAL (modelo herdado 3D, reutilizado pelo 3E)  
- **Arquivo/linha:** catálogo `public.can_operate` — `p.role = 'engineer' or p.team_id = p_team_id` quando `operation_team_ids` é nulo  
- **Condição:** `admin_epi_report_3e` delega o escopo a `can_operate('epi:write', team)`.  
- **Exploração/falha:** engenheiro ativo sem lista de equipes lê ficha/histórico de outra equipe via URL `/funcionarios/{uuid}/epi`. Não é João portal → Maria: portal tem `not p.active` e a RPC pessoal não aceita `employee_id`.  
- **Evidência:** definição no catálogo; provas 3E cobrem admin, portal cruzado, engenheiro **com permissões vazias**, não engenheiro default × outra equipe.  
- **Impacto:** IDOR de gestão **se** o papel default for o de produção.  
- **Correção mínima:** exigir `operation_team_ids` explícito para não-admin (mudança de núcleo de permissão; **fora** do 3E se o emissor não quiser tocar 3D).  
- **Aceitação:** engenheiro só da equipe A recebe deny SQL/HTTP ao pedir o UUID da equipe B.

### F-3E-05 — Gestão pode emitir relatório de funcionário inativo; ensaio 3E não cobre esse caso
- **Severidade:** Baixa (pode ser requisito SST)  
- **Estado:** LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** `admin_epi_report_3e` não testa `e.active`; `my_epi_report_3e` exige `e.active` + vínculo `active`  
- **Condição:** titular inativo/revogado some no portal (prova emissor: inativo e JWT após `revokePreviewAccount`). Gestão autorizada ainda chama o helper.  
- **Evidência:** SQL vs provas (`funcionário inativo não recebe relatório pessoal` apenas na RPC pessoal).  
- **Impacto:** continuidade histórica para SST **ou** acesso após desligamento, conforme política ainda não escrita.  
- **Correção mínima:** documentar a regra; se a política for “não emitir”, filtrar `e.active` também no admin.  
- **Aceitação:** caso de teste explícito inativo × Gestão, alinhado à política.

### F-3E-06 — Subconsulta `new_group_id` sem `LIMIT`
- **Severidade:** Baixa  
- **Estado:** HIPÓTESE encerrada na origem 3D; **não confirmada como falha 3E**  
- **Arquivo/linha:** helper 3E ~47–48; `contrato-entrega-confirmacao.sql` declara `exchange_request_id uuid unique` em grupos e kits  
- **Condição:** dois grupos no mesmo pedido quebrariam o `SELECT` escalar.  
- **Evidência:** unicidade 3D no contrato de origem. Catálogo 3E não relista o `UNIQUE`, mas a coluna existe.  
- **Impacto:** só se a unicidade 3D for removida.  
- **Correção mínima:** `LIMIT 1` / `ORDER BY` defensivo no 3E.  
- **Aceitação:** dois grupos no mesmo `exchange_request_id` são impossíveis ou o relatório não 500.

### F-3E-07 — PDF é projeção regenerável, sem guarda/assinatura
- **Severidade:** n/a jurídica neste marco  
- **Estado:** RISCO FUTURO (aceite documentado)  
- **Arquivo/linha:** `epi-report-3e-pdf.ts` (`pdf-lib`, `report_id` = `gen_random_uuid()`); doc 43  
- **Condição:** hashes do pacote ≠ assinatura do PDF; `report_id` não é índice persistente; nova emissão ≠ arquivo antigo.  
- **Evidência:** código + quatro amostras + metadados `Producer: pdf-lib`.  
- **Impacto:** disputa sobre “o PDF de setembro” não é resolvida pelo 3E.  
- **Correção mínima:** gate futuro de arquivo/retenção; não fingir ICP-Brasil.  
- **Aceitação:** documentação de guarda externa antes de uso real.

### F-3E-08 — Gates NR-6 / LGPD / SST / retenção / identidade empresarial
- **Severidade:** n/a neste laboratório  
- **Estado:** RISCO FUTURO  
- **Arquivo/linha:** `43_MARCO_3E_...md` fontes oficiais e checklist  
- **Condição:** confirmação do portal **não** é assinatura avançada/qualificada/ICP-Brasil no texto do produto; ciência manuscrita é campo da via impressa; aviso de **não** confirmação retroativa está no histórico.  
- **Evidência:** PDF extraído (“não substitui nem cria retroativamente…”); ficha: “espaços acima não indicam assinatura já realizada”; sem CNPJ/razão social inventados.  
- **Impacto:** uso real sem esses gates seria decisão de negócio, não falha de código 3E.  
- **Correção mínima:** não fechar baseline; cumprir o checklist.  
- **Aceitação:** parecer jurídico/SST datado.

### F-3E-09 — Administrador do host/banco
- **Severidade:** fora do app  
- **Estado:** RISCO FUTURO / risco administrativo do host  
- **Condição:** `SECURITY DEFINER` + owner `postgres` lê histórico completo. RLS não se aplica ao owner.  
- **Evidência:** catálogo; doc 43 admite o poder do host.  
- **Impacto:** quem opera o Docker/lab lê tudo. Distinto de João↔Maria no app.  
- **Correção mínima:** controles de host, não patch 3E.  
- **Aceitação:** acesso postgres do lab restrito e auditado.

### F-3E-10 — Cópia baixada sobrevive a logout
- **Severidade:** Baixa (aceite)  
- **Estado:** RISCO FUTURO  
- **Arquivo/linha:** `epi-relatorios.tsx` (Blob revogado ~1 s / unmount); rota PDF `Cache-Control: private, no-store`  
- **Condição:** arquivo já gravado no disco do usuário não é apagável pelo portal.  
- **Evidência:** código + teste de troca de conta que descarta Blob pendente; doc 43.  
- **Impacto:** guarda no endpoint do colaborador.  
- **Correção mínima:** aviso de guarda (já existe) + política.  
- **Aceitação:** após logout, nova emissão exige sessão; Blob anterior não reabre no SPA.

### F-3E-11 — Suíte Web 158/159 em corrida, 159/159 isolada
- **Severidade:** n/a 3E  
- **Estado:** LACUNA DE EVIDÊNCIA (ensaio, não o contrato PDF)  
- **Arquivo/linha:** doc 43; `web-tentativa-paralela.log` citado, não reexecutado aqui  
- **Condição:** flake de “Colega B” / lab indisponível sob carga.  
- **Impacto:** confiança no ritual de CI, não no IDOR 3E.  
- **Correção mínima:** isolamento estável; não enfraquecer o teste.  
- **Aceitação:** duas corridas Web sequenciais 159/159.

### F-3E-12 — Recibo interno `resultado-segredos-3e.json` não veio no ZIP
- **Severidade:** Informativa  
- **Estado:** LACUNA DE EVIDÊNCIA (parcialmente coberta)  
- **Condição:** doc 43 aponta esse arquivo; o pacote traz só o recibo **externo** do ZIP.  
- **Evidência:** inventário 84 arquivos; varredura própria sem JWT/senha/`service_role` real; ASO só na ficha Gestão pré-3E, **ausente** dos quatro PDFs e do DTO 3E.  
- **Impacto:** não dá para auditar o scan interno 291 arquivos; o ZIP em si está limpo no que foi lido.  
- **Correção mínima:** anexar o recibo redigido no ciclo 2, se houver.  
- **Aceitação:** scan do ZIP final + lista de triagem sem valores.

---

## Controles obrigatórios — resultado da inspeção

| Tema | Resultado neste pacote |
| --- | --- |
| João PDF/dados de Maria e inverso | RPC pessoal sem `employee_id`; allowlist do `portalFetch` só `my_epi_report_3e`; PostgREST extra-args → overload 400 (prova emissor). Código consistente. |
| `employee_id` em RPC/body/URL | Pessoal: ignorado/recusado. Gestão: parâmetro explícito + `can_operate` / admin se `team_id` nulo. |
| `report_id` enumerável | Novo UUID por emissão; rota PDF **não** lê `report_id`. |
| Filtro querystring | Allowlist de eventos; período validado (`2026-02-30` e invertido recusados no modelo). |
| Rota PDF Gestão | `requireCapability("epi:write")` + SQL; lab URL travada a `127.0.0.1:54321`. |
| Sem equipe | Pessoal segue; Gestão só `admin` ativo. |
| Inativo / JWT residual | Pessoal exige perfil portal inativo + funcionário/vínculo ativos; prova emissor de revoke. |
| Relatório altera fatos | Helper só `SELECT` + `now()`/`gen_random_uuid()`. |
| SECURITY DEFINER / grants / RLS | Catálogo ≡ contrato 3E; tabelas de feedback/grupos/troca sem SELECT autenticado direto. |
| CPF/ASO/salário/notas | Fora do `jsonb_build_object` 3E; PDFs sem esses tokens. ASO permanece na página Gestão **pré-3E** (`funcionarios/[id]/page.tsx`) — fora do payload PDF. |
| Segredo no pacote | Nenhum valor operacional; cookies das provas são jar em memória. |
| Cache / Blob / geração pendente | `no-store`; revoke; `active`/`generation` na sessão; teste de troca João→Maria. |
| Injeção HTML/filename | React escapa a prévia; PDF `drawText` + `safe()`; filename = tipo + UUID sanitizado. |
| Datas / fuso / inclusivo | `America/Fortaleza`; origem fora do recorte citada sem virar evento (filtrado: `10/01/2026` só como origem; sem evento “Entrega registrada” de janeiro). |
| Ficha ≠ histórico | Ficha = `status=active` + rótulo de feedback; histórico = linha do tempo. Confirmação ≠ entrega. 3C APROVADA ≠ entrega (prova + texto “aprovação não equivale à entrega”). |
| CA | `ca_snapshot`; sem validade de produto. |
| Legado | `legacy_name`/`legacy_unit` quando snapshot nulo. |
| Capacete × Luva | Fixture de teste corrigida para mesmo `item_id`; ramo incompatível avisa e **não** declara atendimento. Prova emissor: `exchange_item_mismatch`, estoque da Luva inalterado. PDFs da amostra **não** sugerem Luva no lugar de Capacete. |
| Responsável nominal | SQL fixa `responsible_name_snapshot: null`; PDF: aviso, sem UUID como nome; `responsible_id` só no DTO. |
| Referências | `Entrega NNN` / `Grupo NNN` locais; estáveis no filtro (teste unitário). |
| PDFs | Logo, A4, margens ~42 pt, `Página X de Y`, eventos em cards, ciência **uma vez** (p. 2/2, 2/2, 24/24), aviso integral, enums humanizados, plural 1 unidade / 2 unidades. Render 100 dpi ≠ zoom de navegador. |

---

## O que permanece aberto

- **Crítico/Alto confirmado neste ciclo:** nenhum.  
- **Médio:** F-3E-04 (herança `can_operate`, só relevante se o papel default for produção).  
- **Baixo confirmado:** F-3E-01, F-3E-02, F-3E-03 (lab).  
- **Lacunas:** F-3E-05, F-3E-11, F-3E-12; provas HTTP 3E do emissor não reexecutadas aqui.  
- **Riscos futuros / gates:** F-3E-07, F-3E-08, F-3E-09, F-3E-10.

**Não aprovo baseline 3E, produção, publicação nem fechamento jurídico.** Ciclo 1 encerrado do lado do auditor; o emissor confronta e para.