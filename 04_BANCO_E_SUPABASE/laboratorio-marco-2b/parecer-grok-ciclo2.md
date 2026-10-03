# Confronto ciclo 2 — Marco 2B (somente leitura)

Inspeção estática dos anexos. Não executei projeto, SQL, testes, Auth, containers nem rede do laboratório. Suítes citadas são **evidência relatada** no pacote.

---

## Integridade

| Artefato | SHA-256 | Conferência |
|---|---|---|
| ZIP ciclo 2 | `3ce816b021dcfa6087d14cfa2d7306edeb35e6f62afc009f70f81ecab1429bd2` | **confere** (74 entradas) |
| Manifesto interno | 73 artefatos | **73/73** hash+tamanho |
| Baseline 1C original | `ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae` | **confere** (164 entradas) |
| `DELTA_1C_2B.json` | 60 caminhos (36 novos, 11 modificados, 13 inalterados) | **confere** o “delta de 60” |
| Recibo externo de segredos | `findings: []`; ZIP ciclo 2 com o hash acima; recibos ciclo 1 e 1C | **confere** com os ZIPs anexados |

Cópias `BASELINE_1C/` do ciclo 2 **coincidem byte a byte** com os mesmos caminhos no ZIP 1C original, inclusive `colaborador-obra.test.tsx` = `0e6dc34b8f6cfefd6e1af7f8ea1679dd31d0944e60d554073bc6b0ae38266b5f`.

O relatório **interno** do ZIP (18:19Z) antecede o empacotamento do ciclo 2: varre 1C + ciclo 1, 33 fontes, 75 bundles, zero findings, **sem** o SHA do ZIP ciclo 2. Isso é o comportamento esperado. O recibo **externo** é que identifica o ciclo 2.

Produto/API/schema/UI de ponto **inalterados** em relação ao ciclo 1 (`nucleo.mjs`, `servidor.mjs`, `auth-local.mjs`, `schema.sql`, `route.ts`, `ponto-lab.ts`, `meu-ponto.tsx`, hook, `colaborador-app.tsx`, `minha-obra.tsx`). Núcleo 64/64, revogação 5/5 e indisponibilidade 1/1 são os **mesmos bytes** do ciclo 1.

---

## Classificação final A1–A9

| ID | Ciclo 1 | Ciclo 2 | Classe agora |
|---|---|---|---|
| **A4** isolamento no transporte após POST | lacuna (GET Maria *antes* do POST João) | GET Maria **depois** do POST João; POST Maria; GET João depois; intents cruzadas 404; relatório **13/13** | **Sanado** (prova). Produto HTTP não mudou. |
| **A5** tsc/lint/build + 5 testes UI | lacuna de artefato | `typecheck.log` / `lint.log` / `build.log` sem erro; `web-completa.log` nomeia os 5 `colaborador-ponto.test.tsx` e guarda 113/114 → 114/114 | **Sanado** (evidência no ZIP). |
| **A8** scan externo identificável | lacuna processual | recibo externo com SHA exato dos 3 ZIPs, 0 findings | **Sanado como recibo**. Bundles 75 continuam evidência **local do laboratório**, não reexecutada aqui. |
| **A1** janela Auth ↔ commit | limite | inalterado; doc 34 preserva | **Residual** (protótipo). Não bloqueia o ensaio local de um processo. |
| **A2** dono da infra / trigger | limite F8 | inalterado | **Residual**. Não é acesso HTTP do admin Gestão. |
| **A3** unique violation / multi-writer | hipótese | inalterado; sem prova de 23505 neste runtime | **Hipótese futura**. |
| **A6** zoom 200% e 2º host | limite | aprovação visual mantida; **200% real ainda sem prova**; rede sem 2º host | **Residual / pendência explícita do gate local de prévia.** Não é exploit. |
| **A7** `getSession` no cliente | hipótese mitigada | código igual; API ainda revalida JWT+user+RPC | **Hipótese**; não é bypass comprovado. |
| **A9** `request_hash` só da versão | risco de contrato futuro | contrato igual | **Hipótese futura**. |

Nenhum item virou vulnerabilidade crítica/alta comprovada.

---

## A4 — o que o código da prova passou a exigir

Em `provas-transporte-2b.mjs` L37–45 o ensaio agora:

1. POST João → GET Maria e exige HTTP **200** + ausência do `event_id` novo;  
2. POST Maria → GET Maria contém o próprio; GET João **200** e não contém Maria;  
3. intent Maria consultada por João → **404** (já havia o sentido inverso).

`resultado-transporte-2b.json` (`at` 18:18:04Z) lista **13 checks `ok: true`**. A tautologia do ciclo 1 foi removida. Continuo a não ter reexecução independente; a correção é de **desenho da prova**, alinhada ao pedido.

O doc 34 registra um retry em que 3103 estava parado e foi religado em loopback. Isso não enfraquece o 13/13 final; só lembra que o transporte 503 (1/1) é caminho separado.

---

## Ajuste do teste de Obras (A5 colateral)

Diff **único** vs baseline 1C / vs ciclo 1:

```diff
   expect(await screen.findByText("Consultando sua obra no laboratório…")).toBeInTheDocument();
   expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
+  await waitFor(() => expect(finish).toBeTypeOf("function"));
   await act(async () => { finish({ data: [], error: null }); });
   expect(await screen.findByText("Nenhuma obra atribuída no momento.")).toBeInTheDocument();
   expect(screen.getByText("Seu acesso pessoal continua disponível.")).toBeInTheDocument();
```

- SHA da versão anterior = SHA da baseline 1C original (`0e6dc34b…`). Afirmação **confirmada**.  
- `waitFor` já era importado; não saiu asserção (`loading`, sem obra antiga, texto de ausência, sessão não encerrada, `signOut` não chamado).  
- `minha-obra.tsx` idêntico ao ciclo 1.  
- O 113/114 no log é exatamente `finish is not a function` na linha 72 da versão antiga — corrida de mock, não regressão de produto.  
- Segunda corrida (15:18:57) passa o mesmo teste em 100 ms e totaliza **114/114**, com os cinco testes de Meu Ponto nomeados nas duas execuções.

Avaliação: correção de harness **aceitável**. Não é enfraquecimento. Não toca a tela. Não reabre A4.

`typecheck.log` e `lint.log` são curtos (só o comando); não trazem a string “exit 0”, mas também não trazem diagnóstico. `build.log` mostra compile + TypeScript + 39 páginas, inclusive `ƒ /api/ponto-lab/[...path]` e `ƒ /colaborador/[[...screen]]`. Trato A5 como sanado no nível de artefato pedido.

---

## Crítico / alto? Gate local?

**Não há crítico ou alto comprovado** na superfície local do 2B após o ciclo 2.

Pendências **remanescentes do gate LOCAL** (não são autorização de baseline):

1. **Zoom real 200%** — ainda sem prova separada. Manter explícito.  
2. **Segundo host físico** — continua indisponível; evidência de rede segue loopback + Docker.  
3. **A1/A2/A3** — limites/hipóteses do protótipo de um processo; o próprio pacote recusa atomicidade entre bancos, resistência ao dono da máquina e portabilidade de concorrência.  
4. Bundles Web: 75 varridos **no laboratório**; daqui só existe o recibo.

O que o ciclo 2 fechou para o confronto de evidência: A4, A5, A8.

---

## Decisão (inalterada)

Não aprovo **baseline 2B**, **publicação**, **REP-P**, **ponto oficial** nem **uso real**.  
Simulação local sintético; dois ciclos de auditoria somente leitura encerrados neste parecer, sem exploit aberto no material examinado.