# Parecer de auditoria adversarial independente — Marco 3H, ciclo 1

**SIMULAÇÃO SEM VALOR OFICIAL.** Este parecer não autoriza baseline 3H, publicação, produção, Supabase remoto, funcionários reais, ponto oficial, REP-P nem Marco 3I. O auditor atuou apenas em inspeção passiva. Os gates 58/58 e 217/217 anexados não foram reexecutados e não contam como prova independente deste ciclo.

## Identidade do pacote

| Item | Valor observado |
| --- | --- |
| ZIP recebido | `/workspace/attachments/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo1.zip` |
| SHA-256 do ZIP | `ad1b26e18c8ba5cf4e1a0516cf94510f184164ce89bd43f524213a3a5b22e382` (confere com o esperado) |
| Entradas do ZIP | **47 arquivos** (`unzip -l`) |
| `MANIFESTO_SHA256.json` | 46 arquivos hasheados (exclui a si mesmo) |
| `INVENTARIO_3H.json` | 45 arquivos (exclui a si mesmo e o manifesto) |
| Arquivos extraídos | 47; hashes SHA-256 de todas as 46 entradas do manifesto **idênticos** aos declarados |
| Origem declarada | `METALLO-3G-LAB-20260930-R1` |
| SHA-256 declarado da origem | `36d40d4eb85f594b75f904b899b13c02cd3283efa451bb25cdc4ed3c4b00323f` |
| ZIP da origem no pacote | **não incluído** (`origin_zip_included: false`) |
| Manifesto 3G anexado | `BASELINE_3G_MANIFESTO.json`, SHA-256 `28ac088b8c102cfebae5a6a09d7161501857c6e14fff1765ffae84ecd49a5221` (confere com `origin.manifest_sha256`) |

Não se afirma recomputação do ZIP da origem 3G. Apenas o manifesto da origem foi conferido.

`is_approved_baseline` no manifesto 3H: **false**. Rótulo obrigatório: SIMULAÇÃO SEM VALOR OFICIAL.

## Veredito do ciclo 1

- **CRÍTICO / ALTO confirmado no escopo local: nenhum.**
- **CRÍTICO / ALTO aberto (hipótese explorável com evidência local suficiente): nenhum.**
- Há inconsistências **médias/baixas confirmadas por código**, lacunas de evidência (inclusive a não-execução independente das suítes) e riscos futuros já em parte admitidos no documento 46.
- **Não autorizo baseline 3H.** Máximo de dois ciclos; este é o primeiro.

Não tratei acesso `postgres`/administrador do host como bypass do portal. Não tratei HTML escapado pelo React como execução. Não somei 58 + 217.

---

## Material inspecionado (passivo)

Documento de instrução `PROMPT_REVISAO_SOMENTE_LEITURA.md`; documento 46 `05_DOCUMENTACAO/46_MARCO_3H_COMUNICADOS.md`; `LEIA-ME.md`; `AGENTS.md`; `APROVACAO_MANUAL_3H.md`; `INVENTARIO_3H.json`; `MANIFESTO_SHA256.json`; `BASELINE_3G_MANIFESTO.json`; `RESULTADOS_3H.json`.

Contrato SQL `04_BANCO_E_SUPABASE/laboratorio-marco-3h/contrato-comunicados.sql` (integral); catálogo `catalogo-local-ciclo1.json` (tabelas 3H, ACLs, policies, functions, privileges); provas anexadas `provas-3h.mjs` e `resultado-3h.json` (58 nomes, todos `ok: true`, **não executadas**); `web-completa-3h.json` (217/217 declarado, **não executado**); gerador `gerar-pacote-auditoria-3h.py` (somente leitura).

Web 3H: `contrato-3h.ts`, `comunicados-3h.ts` (dados e actions), `communication-form.tsx`, `comunicados/page.tsx`, `meus-comunicados.tsx`, `colaborador-app.tsx`, `colaborador/page.tsx`, `use-colaborador-session.ts` (RPCs e sessão), `colaborador-local.ts` (allowlist), `session.ts`, `sidebar-nav.tsx`, `proxy.ts`, `next.config.ts`, `server.ts`, `ambienteSupabase.ts`, `colaborador-laboratorio.ts`, CSS de comunicados (Gestão e portal), testes `comunicados-3h.test.tsx` e `colaborador-seguranca.test.ts`.

Contexto de autorização anterior (não ampliação de escopo): `is_active_admin` no histórico 3; `contrato-equipe.sql` 3A; migrations de identidade / equipe opcional / obra atual; helper `criar-contas-previa-1b.mjs` (sem chave embutida); `03_COMPARTILHADO/03_REGRAS_E_PERMISSOES/src/index.ts`.

## Comandos passivos utilizados

`sha256sum` do ZIP; `unzip -l` e extração para `/tmp/marco3h`; `find` + `sha256sum` de cada arquivo; leitura integral/parcial dos fontes; `grep`/`python3` só para inventário, hashes, catálogo JSON, listagem dos 58 checks e varredura textual de padrões de segredo. **Nenhum** script do ZIP, teste, SQL, Auth, container, endpoint, localhost ou credencial foi executado.

Varredura textual: menções a `service_role` são ACL/comentário/teste sintético; o helper 1A lê a chave do `supabase status` local em tempo de execução e **não a embute** no pacote. Nenhum JWT real, senha de laboratório ou connection string com segredo foi encontrado nos arquivos anexados.

---

## Controles observados (não são autorização)

1. Tabelas `private.communications_3h`, `communication_revisions_3h`, `communication_views_3h`: RLS ligada, **policies nulas**, ACL somente `postgres`, `REVOKE` de `public/anon/authenticated/service_role`. Catálogo concorda.
2. RPCs 3H `SECURITY DEFINER`, `search_path=''`, owner `postgres`. `private.communication_context_3h` **sem EXECUTE** para cliente.
3. `GRANT EXECUTE` das seis RPCs públicas 3H **somente** a `authenticated`; `anon` e `service_role` sem EXECUTE nessas funções (catálogo).
4. Admin: `auth.uid()` + `public.is_active_admin()` no início de save/publish/archive/admin list. Portal: contexto por `auth.uid()`, sem `employee_id`/`team_id`/`work_id` como autoridade.
5. Público: CHECK de tabela e validação RPC; `NULL` de equipe/obra **não** satisfaz `=`; ALL exige team/work nulos.
6. Contexto ATUAL alinhado a 1C/3A: uma alocação ativa, ou equipe de origem só sem histórico; equipe/obra precisam estar ativas; ambíguo/encerrado ⇒ só ALL.
7. Listar (`my_communications_3h`) não grava view; `open_communication_3h` faz `INSERT ... ON CONFLICT DO NOTHING`; PK `(communication_id, employee_id)`.
8. Web portal: allowlist só `my_communications_3h` e `open_communication_3h` entre as RPCs 3H; `cache: "no-store"`; ticket de geração na sessão; `MeusComunicados` remonta com `key={profile.employee_id}`; HTML da mensagem em texto + `white-space: pre-wrap`; sem `dangerouslySetInnerHTML`.
9. Gestão: `requireCapability("admin:manage")` + `requireCommunicationLab3h()` (preview local e URL `http://127.0.0.1:54321`); sidebar `localOnly`.
10. Visualização acompanhada de ressalva explícita de que **não é assinatura/concordância/ciência trabalhista**.

Provas anexadas (58) cobrem rascunho, João/Maria/sem equipe/inativo, IDOR, params extra, grants de tabela, abertura/reabertura/duas abas, pin, expiração forçada no servidor, revisão, archive, paginação, engenheiro, mudança de equipe, vínculo ambíguo/encerrado, idempotência de create/publish. **São evidência do laboratório, não deste auditor.**

---

## Separação exigida

### CRÍTICO / ALTO confirmado
Nenhum.

### CRÍTICO / ALTO aberto no escopo local
Nenhum. Hipóteses de IDOR João/Maria, injeção de `employee_id`/`team_id`/`work_id` e leitura direta de tabela privada **não se sustentam no contrato inspecionado**: as RPCs pessoais não aceitam esses parâmetros como autoridade; tabelas privadas não têm GRANT/policies; o PostgREST, no desenho anexado, recusa argumento fora da assinatura. Sem execução independente, isso permanece **não elevado a vulnerabilidade comprovada por este ciclo**.

### Médios / baixos confirmados ou parciais
Ver F-3H-01 a F-3H-04.

### Hipóteses, lacunas e riscos futuros
Ver F-3H-05 em diante.

---

## Achados

### F-3H-01 — Expiração da Gestão interpretada sem fuso explícito

- **Severidade:** MÉDIA  
- **Estado:** CONFIRMADO (código; sem reexecução)  
- **Arquivo/linha:** `01_WEB/app/(02_SISTEMA)/comunicados/communication-form.tsx` (campo `datetime-local`, `defaultValue` por `expires_at.slice(0, 16)`); `01_WEB/app/actions/comunicados-3h.ts` linhas 17–18 (`Date.parse` + `toISOString`).  
- **Condição necessária:** comunicado com `expires_at`; operador usa o formulário da Gestão; fuso do processo Node (container) distinto do fuso em que o valor `YYYY-MM-DDTHH:MM` foi pensado; ou regravação de correção sem alterar o campo.  
- **Caminho:** o browser envia instante **sem offset**; o server action interpreta no fuso do Node e grava timestamptz; o SQL compara no relógio do servidor. Recarregar correção corta `+00:00` e, ao salvar de novo, pode deslocar o instante.  
- **Evidência:** ausência de offset no `datetime-local`; Zod exige `z.iso.datetime({ offset: true })` só **depois** dessa conversão. O contrato SQL de expiração em si usa `clock_timestamp()`/`now()` corretamente.  
- **Impacto:** aviso some cedo demais ou permanece visível além da intenção da Gestão. Não é bypass de público.  
- **Correção mínima:** persistir e reapresentar instante com offset explícito (ou UTC fixo na UI) sem `slice(0,16)` cego.  
- **Teste de aceitação:** criar com expiração 18:00 America/Fortaleza; reler o valor gravado; salvar correção sem editar expiração; o timestamptz permanece idêntico.

### F-3H-02 — Título aceita `<>` na RPC; documento e Zod recusam

- **Severidade:** BAIXA  
- **Estado:** CONFIRMADO (código). Não é XSS comprovado.  
- **Arquivo/linha:** `contrato-comunicados.sql` 92–95 (título: só `[[:cntrl:]]`; mensagem: `[<>]` + controles); `contrato-3h.ts` 8–9 (título e mensagem recusam `<>`); documento 46 afirma recusa de `<` e `>` no servidor; `provas-3h.mjs` testa HTML só em `p_message`.  
- **Condição:** chamador autenticado **administrador ativo** via RPC direta, fora do `safeParse` Web.  
- **Caminho:** `save_communication_3h` com `p_title` contendo `<script>…</script>`. A UI renderiza `{item.title}` / `{selected.title}` como texto React (escapado).  
- **Evidência:** assimetria SQL vs Zod/doc; nenhum sink `innerHTML`/`dangerouslySetInnerHTML` nos fontes 3H.  
- **Impacto:** defesa em profundidade incompleta; risco só se futura superfície interpolar HTML cru.  
- **Correção mínima:** aplicar ao título a mesma recusa de `<>` e controles que a mensagem.  
- **Teste de aceitação:** RPC admin com título `<b>x</b>` retorna `invalid_communication_text`; mensagem equivalente continua recusada.

### F-3H-03 — Redirect de erro na Gestão regenera idempotency key

- **Severidade:** BAIXA  
- **Estado:** PARCIAL  
- **Arquivo/linha:** `comunicados/page.tsx` (Novo comunicado chama `randomUUID()` a cada render); `comunicados-3h.ts` actions 36–42 (erro de save/publish redireciona sem devolver o id/key).  
- **Condição:** primeira `save_communication_3h` efetiva no banco, mas a action trata a resposta como erro (timeout, falha só do publish, corpo inesperado) e recarrega `/comunicados?error=…`.  
- **Caminho:** o formulário novo nasce com outra `idempotencyKey`; reenvio cria **segundo** comunicado. O contrato SQL de `ON CONFLICT (idempotency_key)` só ajuda se a **mesma** chave for reutilizada (duplo clique na mesma montagem — coberto nas provas anexadas).  
- **Evidência:** UUID no Server Component; redirects genéricos; provas 53–54 cobrem concorrência com a **mesma** chave, não o retry pós-redirect.  
- **Impacto:** duplicata operacional no laboratório; não amplia público.  
- **Correção mínima:** em erro após insert conhecido, redirecionar com o id existente ou reapresentar a mesma chave.  
- **Teste de aceitação:** simular save 200 + publish 500; retry não cria segundo `idempotency_key`.

### F-3H-04 — Formulário da Gestão sem guarda de submissão pendente

- **Severidade:** BAIXA  
- **Estado:** CONFIRMADO (código de UI)  
- **Arquivo/linha:** `communication-form.tsx` botões submit sempre habilitados; `page.tsx` 31–32 (Publicar/Arquivar na lista).  
- **Condição:** duplo clique em correção (versão incrementa) ou em publicar da lista.  
- **Caminho:** segunda chamada com `p_expected_version` velho → `communication_version_conflict`; primeira pode ter persistido. Utilizador vê erro genérico. Create novo é protegido pela chave enquanto o form não remonta.  
- **Evidência:** ausência de `useFormStatus`/disabled; SQL de versão existe.  
- **Impacto:** UX e possível retrabalho; não é IDOR.  
- **Correção mínima:** desabilitar submit enquanto a action pendente e reconsultar versão após conflito.  
- **Teste de aceitação:** dois submits simultâneos de correção: um sucesso, outro conflito explícito, sem terceiro snapshot.

### F-3H-05 — Correção posterior não reabre “não lido”

- **Severidade:** BAIXA (produto / ciência)  
- **Estado:** RISCO FUTURO (comportamento explícito do marco)  
- **Arquivo/linha:** `communication_views_3h` só `first_viewed_at`; documento 46: “Revisão posterior não reinicia o estado de não lido”.  
- **Condição:** funcionário já abriu; Gestão corrige título/mensagem.  
- **Caminho:** lista “Não lidos” omite o aviso; o texto novo só aparece se reabrir “Todos”.  
- **Evidência:** schema + doc.  
- **Impacto:** aviso corrigido pode não ser relido. Não é assinatura.  
- **Correção mínima (se o responsável quiser no 3I+):** marcar “atualizado após sua abertura” sem fingir ciência formal.  
- **Teste de aceitação:** João abre v2; admin grava v3; João em “Não lidos” não vê o card; em “Todos” vê “Atualizado em…”.

### F-3H-06 — Janela entre contexto, elegibilidade e INSERT da view

- **Severidade:** BAIXA  
- **Estado:** RISCO FUTURO / HIPÓTESE residual (admitida no doc 46)  
- **Arquivo/linha:** `open_communication_3h` 205–216 (SELECT sem `FOR UPDATE` da linha do comunicado antes do INSERT).  
- **Condição:** archive/expiração/mudança de equipe no mesmo instante da abertura.  
- **Caminho:** passa no SELECT e ainda grava view; ou o inverso. Histórico de view é propositalmente preservado após archive/expiração.  
- **Evidência:** código + documento 46 (“janela de concorrência”).  
- **Impacto:** contagem “visualizaram” vs elegíveis atuais pode divergir por um evento. Sem leitura cruzada João/Maria.  
- **Correção mínima:** `SELECT … FOR UPDATE` da linha `communications_3h` antes do INSERT, recusando se já não publicável.  
- **Teste de aceitação:** archive concorrente com open: ou view+ainda publicado no instante, ou `communication_unavailable` sem view nova.

### F-3H-07 — Contador do Início e lista admin de alvos são tetos

- **Severidade:** BAIXA  
- **Estado:** RISCO FUTURO (documentado)  
- **Arquivo/linha:** `meus-comunicados.tsx` 23–28 (`20+`); `comunicados-3h.ts` `readCommunicationTargets3h` `limit(1000)`; `admin_communications_3h` reconstrói elegíveis por identidade.  
- **Condição:** ≥20 não lidos; ou >1000 equipes/obras ativas; ou muitas identidades sintéticas.  
- **Caminho:** subcontagem / alvo ausente no `<select>` / listagem admin lenta.  
- **Evidência:** código + doc 46.  
- **Impacto:** operação, não isolamento João/Maria.  
- **Correção mínima:** documentar tetos na UI; paginar alvos.  
- **Teste de aceitação:** 21 não lidos ⇒ “20+”; 1001ª equipe ativa não selecionável ou paginada.

### F-3H-08 — Conferência visual estreita/teclado desta retomada não é independente

- **Severidade:** BAIXA (acessibilidade operacional)  
- **Estado:** LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** documento 46 (200% com `devicePixelRatio=2`; viewport móvel automático não refletido; política da automação recusou aba de erro na retomada); CSS 3H tem `overflow-wrap`, `min-height: 44px`, `:focus-visible`.  
- **Condição:** auditor passivo sem executar o browser do laboratório.  
- **Caminho:** regressão visual em 320px/teclado não reobservada aqui.  
- **Evidência:** texto do doc 46 + CSS lido.  
- **Impacto:** não eleva a falha de autorização.  
- **Correção mínima:** roteiro manual curto em 320px, 200% e só-teclado, registrado pelo responsável.  
- **Teste de aceitação:** Gestão e Colaborador: tab order visível, sem scroll horizontal em 320px e 200%.

### F-3H-09 — Suítes 58/58 e 217/217 não foram reexecutadas

- **Severidade:** n/a (governança da evidência)  
- **Estado:** LACUNA DE EVIDÊNCIA  
- **Arquivo/linha:** `resultado-3h.json` (`passed: 58`); `web-completa-3h.json` (`numPassedTests: 217`); `RESULTADOS_3H.json`.  
- **Condição:** mandato de auditoria passiva.  
- **Caminho:** não aplicável.  
- **Evidência:** arquivos anexados vs proibição de executar testes/SQL/Auth.  
- **Impacto:** o ciclo não pode “fechar” qualidade como se o auditor tivesse rodado as suítes.  
- **Correção mínima:** confronto ponto a ponto no ciclo 2, se autorizado, ainda sem o auditor executar o laboratório.  
- **Teste de aceitação:** matriz achado × prova local, sem somar suítes.

### F-3H-10 — Cobertura explícita de `employee_id`/`view_id` injetados é indireta

- **Severidade:** BAIXA  
- **Estado:** LACUNA DE EVIDÊNCIA (não é falha encontrada)  
- **Arquivo/linha:** `my_communications_3h(p_unread_only,p_limit,p_offset)`; `open_communication_3h(p_id)`; provas 22–23 testam `p_team_id`/`p_work_id` extras (assinatura PostgREST), não `p_employee_id`/`p_view_id`.  
- **Condição:** cliente envia JSON extra.  
- **Caminho esperado:** 400 de assinatura **ou** ignorar chave; o corpo da função não lê `employee_id` do cliente.  
- **Evidência:** assinaturas SQL + allowlist Web.  
- **Impacto:** lacuna de prova, não bypass visível.  
- **Correção mínima:** uma asserção nas provas locais com `p_employee_id` da Maria no token do João.  
- **Teste de aceitação:** HTTP ≠ 200 ou lista/abertura inalterada; view da Maria permanece 0.

### F-3H-11 — `now()` na listagem vs `clock_timestamp()` na escrita

- **Severidade:** BAIXA  
- **Estado:** HIPÓTESE (janela intra-transação)  
- **Arquivo/linha:** `my_communications_3h`/`open_communication_3h` usam `now()`; save/publish usam `clock_timestamp()`.  
- **Condição:** transação longa no instante exato de expiração.  
- **Caminho:** item no limiar visível/oculto por milissegundos.  
- **Evidência:** texto SQL.  
- **Impacto:** desprezível no laboratório.  
- **Correção mínima:** unificar em `clock_timestamp()` nas comparações de `expires_at`.  
- **Teste de aceitação:** expiração `clock_timestamp()+10ms` some na open imediatamente seguinte.

### F-3H-12 — Catálogo local: `is_active_admin()` INVOKER

- **Severidade:** n/a informativo  
- **Estado:** LACUNA DE EVIDÊNCIA / nota de catálogo  
- **Arquivo/linha:** histórico `20260831224431_…sql` cria `SECURITY DEFINER`; catálogo 3H exporta `security_definer: false`, `search_path=public,pg_temp`, EXECUTE também a `service_role`.  
- **Condição:** chamada direta vs aninhada nas RPCs 3H DEFINER (`postgres`).  
- **Caminho:** nas RPCs 3H, `auth.uid()` continua sendo o JWT; a leitura de `profiles` no owner ignora RLS (`force_rls=false`). João/engenheiro ainda falham o predicado `role='admin' AND active`. **Não classificado como bypass do portal.**  
- **Evidência:** divergência fonte histórico × catálogo; 3H não recria a função.  
- **Impacto:** rastreio de baseline, não exploração 3H visível.  
- **Correção mínima:** se houver ciclo 2, alinhar definição vigente e grants ao texto congelado.  
- **Teste de aceitação:** `\df+ is_active_admin` no laboratório = contrato documentado.

### F-3H-13 — Ausência de anexos / PDF / storage / push / 3F / ciência formal

- **Severidade:** n/a (limite de marco)  
- **Estado:** RISCO FUTURO se alguém tratar view como prova trabalhista  
- **Arquivo/linha:** documento 46; UI `meus-comunicados.tsx` 77 e 86; Gestão `page.tsx` 19.  
- **Condição:** uso fora do laboratório sintético.  
- **Caminho:** interpretação jurídica indevida.  
- **Evidência:** ressalvas presentes; nenhum código de storage/PDF/passkey 3H.  
- **Impacto:** governança.  
- **Correção mínima:** manter o rótulo; não ligar REP-P a `first_viewed_at`.  
- **Teste de aceitação:** texto de ressalva visível na abertura; nenhum endpoint de anexo 3H.

---

## Temas obrigatórios — síntese sem achado elevado

| Tema | Resultado passivo |
| --- | --- |
| SECURITY DEFINER / search_path / owner / EXECUTE / RLS | Contrato e catálogo coerentes para as seis RPCs e três tabelas 3H |
| auth.uid() vs IDs do cliente | IDs de funcionário/equipe/obra não são autoridade nas RPCs pessoais |
| Isolamento João/Maria / ALL / TEAM / WORK / sem equipe | Predicados SQL + provas anexadas; sem equipe só ALL se contexto team/work nulos |
| IDOR / injeção URL/query/body/RPC | Portal sem id na URL; Gestão valida UUID; extras fora da assinatura |
| Rascunho / expirado / arquivado | Filtro `PUBLISHED` e `expires_at`; archive impede nova leitura |
| Revisões / views privadas | Sem GRANT; append-only com unique (id, version) |
| Admin ativo vs papel sem permissão | `is_active_admin` + `admin:manage`; engenheiro recusado nas provas anexadas |
| Listar ≠ abrir; abertura idempotente; uma conta ≠ outra | INSERT ON CONFLICT; PK por employee_id |
| Correção / versão / snapshot / concorrência | version + FOR UPDATE no save/publish/archive; open sem FOR UPDATE (F-3H-06) |
| Troca de conta / logout / duas abas / cache / contador | generation + unmount + key de employee; portalFetch no-store; contador 20+ (F-3H-07) |
| Publish duplicado / retry / timeout | SQL idempotente na mesma chave; retry pós-erro Web parcial (F-3H-03) |
| Expiração no servidor | Sim; UI Gestão pode gravar instante errado (F-3H-01) |
| Fixação | Só ORDER BY; não altera predicado de público |
| XSS/HTML/SVG/javascript | Mensagem recusada na RPC; título assimétrico (F-3H-02); React texto |
| Paginação / N+1 / erros / privacidade | limit 1–30; erros de Gestão genéricos; resumo admin sem lista nominal |
| Foco / teclado / 200% / largura | CSS preparado; evidência visual independente incompleta (F-3H-08) |

## Conclusão

O desenho 3H inspecionado é **conservador na autorização** (tabelas cegas ao cliente, contexto no servidor, público estreito, view por funcionário). O ciclo 1 **não encontrou bypass confirmado** João/Maria, escalada de funcionário a Gestão, nem XSS executável nos fontes apresentados.

Os pontos que impedem baseline são de **governança e de integridade operacional** (expiração na UI, assimetria de validação, evidências não reexecutadas, riscos futuros já escritos no documento 46), não um CRÍTICO aberto.

**Parar antes de baseline 3H e Marco 3I. Supabase remoto intocado. SIMULAÇÃO SEM VALOR OFICIAL.**
