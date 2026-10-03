# Parecer — Metallo Marco 2B, ciclo 1 (somente leitura)

**Objeto:** pacote `Metallo-Marco2B-PontoExperimental-Auditoria-20260927-Ciclo1.zip`  
**Modo:** inspeção estática. Não executei scripts, SQL, Auth, testes, containers nem rede do laboratório. Contagens de suíte abaixo são **evidência relatada** no ZIP, não reexecução.  
**Decisão pedida:** não há aprovação de baseline 2B nem de publicação neste parecer.

---

## 1. Integridade do pacote

| Verificação | Resultado |
|---|---|
| SHA-256 do ZIP | **Confere:** `0fd2111e86edfacc7c9998f7aaa3becf32c37ad015f6364c6f97322969ff6436` |
| Entradas do ZIP | **68** (68 `ZipInfo`) |
| Manifesto | **67** artefatos + o próprio `MANIFESTO_SHA256.json` |
| Hash e tamanho de cada artefato vs manifesto | **67/67 conferem** |
| Baseline 1C declarada | `ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae` (citada; ZIP 1C original **não** está no pacote) |
| `DELTA_1C_2B.json` | **55** caminhos: 31 novos, 10 modificados, 14 inalterados |
| Cópias em `BASELINE_1C/` vs `sha256_1c` do delta | **conferem** nos 10 modificados |
| Fontes atuais vs `sha256_atual` do delta | **conferem** |

Coerência do manifesto: **sim**. Não há arquivo extraído fora do manifesto nem hash divergente.

O scan interno (`resultado-segredos-2b.json`) registra `findings: []`, `clientBundles: 75`, `sourceFiles: 28`, ZIP com 68 entradas **sem** SHA-256 do ZIP no JSON. Isso é compatível com o aviso de que o relatório *dentro* do ZIP antecede ou não pode autorreferenciar o hash final. Varredura estática neste ambiente não achou JWT completo, PEM privado, `sb_secret_*` real nem senha; ocorrências de `service_role` / `supabase.co` estão em testes de recusa, scanner ou documentação.

---

## 2. Síntese do desenho (código, não execução)

Superfície 2B, no que o ZIP contém:

- Browser só em `127.0.0.1` → `/api/ponto-lab/*` (prévia `3101`) → `http://127.0.0.1:3103/lab-point/v1/*` → PGlite isolado.
- Auth/JWKS/`my_employee_profile` em `http://127.0.0.1:54321`.
- Contrato POST: exatamente `contract_version` + `idempotency_key`; titular **não** vem do body/URL/query.
- JWT: parse + `alg=ES256` + `iss`/`aud`/`role`/`sub`/`session_id`/`exp`/`iat` + verify ECDSA via JWKS + `/auth/v1/user` + RPC pessoal (1 linha, UUID).
- Revalidação pessoal de novo imediatamente antes do commit (`authorizeCurrent`).
- Trigger `BEFORE UPDATE OR DELETE` só em `lab_time_event`.
- Hash SHA-256 canônico; **não** é assinatura (declarado).

Isso é coerente com o documento 34. PGlite **não** é segundo Supabase; também declarado.

---

## 3. Achados numerados

Severidade no **laboratório local sintético** (não produção, não REP-P).

### A1 — Janela residual Auth ↔ commit (PGlite ≠ Auth)

- **Classe:** limite declarado / risco residual (não exploração comprovada neste pacote).
- **Severidade lab:** média como risco de *protótipo*; baixa no ensaio atual porque é admitido e fail-closed quando a revogação é *percebida*.
- **Onde:** `servidor.mjs` L39–43; `nucleo.mjs` L27–41; `auth-local.mjs` L16–37.
- **Raciocínio:** `verifyPersonal` e o `SELECT lab_context` não compartilham transação com o Auth. `authorizeCurrent()` roda *depois* dos INSERTs e *antes* do commit implícito. Se Auth revogar **depois** dessa última chamada e **antes** do commit, o código não tem como anular atomicamente. Os 5/5 (`provas-revogacao-concorrente-2b.mjs`) injetam `LabError` no hook — interleaving **controlado**, não corrida real entre dois bancos.
- **Prova no ZIP:** núcleo relata token antigo ≥400 após `revokePreviewAccount`; refresh e novo login ≥400. Não há traço de commit sobrevivente *após* Auth já revogado na ordem testada.
- **Correção de produto (não deste gate sintético):** ponte de revogação / um só critério de commit.

### A2 — Trigger append-only só em `lab_time_event`; dono da infra remove trigger

- **Classe:** limite declarado (F8) + lacuna de defesa em profundidade.
- **Severidade lab:** baixa para o atacante de browser (PGlite sem porta SQL no desenho); alta só para **administrador da máquina**.
- **Onde:** `schema.sql` L39–43; ausência de trigger em `lab_intent_result` e `lab_context`.
- **Raciocínio:** UPDATE/DELETE do original são negados no SQL e as provas isoladas relatam a mensagem `Original sintético imutável`. Quem pode `DROP TRIGGER` ou `UPDATE lab_intent_result` reescreve mapeamento de chave→evento e pode recomputar SHA-256. Hash não assina autoria — o próprio documento 34 diz isso.
- **Não é vulnerabilidade de titular João/Maria no HTTP.**

### A3 — Idempotência concorrente sem mapeamento de unique violation

- **Classe:** hipótese de robustez / risco futuro. **Não comprovada** como falha neste PGlite.
- **Severidade lab:** baixa (evidência relatada 5 POSTs → 1 `201` e o mesmo `event_id`).
- **Onde:** `nucleo.mjs` L28–36; `provas-2b.mjs` L63–66.
- **Raciocínio:** o fluxo é “SELECT prior → INSERT”. Não há `ON CONFLICT` nem tratamento de `23505`. Se dois writers sobrepusessem a transação, o perdedor tenderia a **500 `ERRO_LABORATORIO`**, não `200 DUPLICADO`. O 64/64 relatado implica que, *nesta* API + PGlite de um processo, as transações se serializaram o bastante para todos devolverem o mesmo `event_id`. Isso **não** prova motor SQL com dois clientes independentes.
- **Exploração no lab atual:** não demonstrada. Em outro runtime, o cliente já reconsulta `/intent/UUID` (UI) e reutiliza a chave em 5xx.

### A4 — Prova de isolamento João/Maria **no transporte** é tautológica

- **Classe:** lacuna de prova (não vulnerabilidade do núcleo).
- **Severidade:** n/a como exploit; média como qualidade de evidência 9/9.
- **Onde:** `provas-transporte-2b.mjs` L26–37.
- **Raciocínio:** `otherBefore` é o histórico da Maria **antes** do POST do João; o check “Maria não contém João” usa essa lista antiga. O núcleo 64/64 *depois* dos dois POSTs é que prova isolamento. O transporte é proxy almost-dumb (`route.ts` L26–31) e não escolhe titular — a falha é do ensaio, não do contrato.
- **O que falta:** GET Maria *após* o 201 do João no caminho `3101`.

### A5 — TypeScript / lint / build sem artefato no ZIP

- **Classe:** lacuna de evidência.
- **Onde:** documento 34 alega “passou / passou / passou”; no ZIP só `web-completa.log` (Vitest **114/114**, 21 arquivos, 16,41s).
- **Raciocínio:** não invento que o `tsc`/ESLint/build rodaram. A UI 5/5 existe no fonte `colaborador-ponto.test.tsx` (5 `it(...)`); a inclusão no 114 é **relatada**, não listada por nome no log.

### A6 — Zoom 200% e segundo host físico

- **Classe:** limites já declarados; não tratar como exploit.
- **Onde:** doc 34; `rede.json` `physical_lan_test`: “Nao executado…”. Listeners relatados só em `127.0.0.1`/`::1` para `3101`/`3103`/`54321+`.
- **Código alinhado:** `servidor.mjs` L33 e L62 (`host===127.0.0.1:3103`, `listen(3103,'127.0.0.1')`); transporte L12; página L16 (`127.0.0.1:\d+`); CSP do `proxy.ts` L15 (`connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:3101`).
- CSS `.shell{overflow:hidden}` pode cortar em zoom alto — é pendência de prévia, não de titularidade.

### A7 — `getAccessToken` lê sessão persistida, não `getUser`

- **Classe:** hipótese leve; mitigada no servidor.
- **Severidade lab:** baixa.
- **Onde:** `use-colaborador-session.ts` L149–155 vs API `verifyPersonal` em todo pedido.
- **Raciocínio:** a UI pode enviar JWT ainda no `localStorage` após revogação local incompleta. O servidor revalida criptografia + `/auth/v1/user` + RPC. As provas relatam token antigo sem gravação/leitura. Não há bypass estático.

### A8 — Scan de segredos: contagem e autorreferência

- **Classe:** lacuna processual, não achado de vazamento neste ZIP.
- **Onde:** `resultado-segredos-2b.json` (28 fontes vs “30” do enunciado; ZIP sem hash; script `verificar-segredos-2b.mjs` L47–58 usa `tar` no ZIP).
- **Raciocínio:** zero findings no relatório interno. Confirmei ausência de material óbvio no conteúdo extraído. Não posso atestar os 75 bundles (não vêm no ZIP).

### A9 — `request_hash` cobre só `contract_version`

- **Classe:** risco futuro de contrato, irrelevante hoje.
- **Onde:** `nucleo.mjs` L26, L30.
- **Raciocínio:** o body permitido tem só dois campos; chave igual + versão diferente já dá 409 (relatado). Se o contrato ganhar campo sem mudar essa hash, o conflito fica cego.

Nada no código revisado mostra: escolha de titular por query/URL/body; fallback `supabase.co`; `service_role` no cliente; listagem cross-tenant; relógio do cliente no evento; UPDATE/DELETE ordinário do original.

---

## 4. Confrontação adversarial (pedido × código × prova relatada)

| Tema | Código | Prova no ZIP | Veredito |
|---|---|---|---|
| João ↔ Maria | `history`/`outcome` filtram `auth_user_id`; body sem ID | 64/64: cada um vê o seu, intent alheio 404, chave não transfere (409) | **Coberto no núcleo.** Transporte fraco (A4). |
| JWT criptográfico + estado | ES256 + JWKS + user + RPC | anon 401, JWT adulterado 401, admin Gestão 403 | **Coberto (relatado + estático).** |
| Token antigo / refresh / login pós-revogação | RPC `status='active'` + `not p.active` | ≥400 gravar/ler; refresh ≥400; login ≥400 | **Coberto no núcleo HTTP.** |
| Snapshot stale / inativo / ambíguo | `checkContext` | 64/64 isolado PGlite | **Coberto no core;** no HTTP o snapshot PGlite é seed 24h + Auth a cada request. |
| Idempotência e payload conflitante | keys exatas; 409 se hash/titular diferem | replay 200 mesmo `event_id`; v2 → 409 | **Coberto.** |
| Concorrência / resposta perdida / rollback | transação + failpoints | 5 iguais → 1 create (relatado); failpoints zerados; UI recupera `/intent` | **Coberto com ressalva A3.** |
| Imutabilidade / admin | trigger + admin sem perfil | UPDATE/DELETE negados no core; admin 403 | **Coberto no modelo lab; F8 permanece.** |
| Timestamp servidor | `new Date().toISOString()` no servidor; campos extras 400 | UTC `Z`; ±15s; `client_*` 400 | **Coberto** (não mexeram no relógio do host — declarado). |
| Segredo no browser/logs | cliente só anon; log de negativa = método/classe/HTTP/código | scan 0 achados; bundles fora do ZIP | **Fontes/logs do pacote limpos;** bundles = evidência externa. |
| Isolamento / sem fallback remoto | destinos fixos 127.0.0.1; rota 404 fora da prévia; 503 se `fetch` falha | 1/1 503; rede 8/8 relatada; sem 2º host | **Código sem fallback.** Rede = evidência relatada. |

Suítes **não somadas:** 64, 5, 9, 1, 114 (com 5 UI), 683, 45, 31, 44, 8. `qualidade.tap` inclui os testes de banco — 31 e 44 sobrepõem.

---

## 5. Há crítico/alto aberto?

**Não há vulnerabilidade crítica ou alta comprovada** na superfície do laboratório 2B com o material deste ZIP.

O que existe é:

- limites já escritos (janela Auth/PGlite, dono da infra, hash ≠ assinatura, sem 2º host, sem zoom 200%);
- lacunas de prova (transporte A4, lint/build, bundles, zoom);
- hipóteses de robustez (A3, A7, A9).

Nenhuma delas, **neste ciclo e neste escopo sintético**, demonstra João lendo/gravando Maria, admin Gestão marcando ponto pessoal, JWT `none`/adulterado aceito, fallback remoto, ou relógio de cliente no original.

---

## 6. O que bloquearia o gate técnico

Para **este** marco (prévia local, sem baseline, sem valor trabalhista):

**Não bloqueio o gate técnico 2B por exploit aberto.**  
**Bloqueio, como o pacote pede, baseline e publicação.**

Se o responsável quiser gate *mais* estrito antes de congelar 2B, as correções/evidências que eu exigiria (não são exploits atuais):

1. ReGET do histórico da Maria **depois** do POST do João via `3101` (fecha A4).  
2. Tratar unique violation → `200 DUPLICADO` ou `409` explícito (fecha A3).  
3. Artefatos de `tsc` / lint / build, ou retirar a frase “passou”.  
4. Scan final **externo** com SHA-256 do ZIP (já calculável: o hash acima).  
5. Zoom 200% só se quiserem vender a prévia visual como “sem corte” em qualquer escala.

Nada disso é conformidade REP-P. A matriz no ZIP e o doc 34 **não** declaram REP-P; este parecer também não.

---

## 7. Evidências que faltam (explícito)

- ZIP da baseline 1C para reconferir `ea672a8c…` além das cópias.  
- Bundles Web (75) e valores reais de `SERVICE_ROLE`/`JWT_SECRET` (corretamente fora do pacote).  
- Log nomeado dos 5 testes de UI dentro dos 114.  
- Captura/prova de zoom 200%.  
- Ensaio de rede com segundo host físico.  
- Fechamento atômico da janela Auth–PGlite (improvável neste protótipo).  
- Assinatura do original (SHA-256 sozinho não basta para uso real).

---

## 8. Conclusão

Pacote **íntegro e internamente coerente** com o manifesto e com o delta 1C→2B. O desenho estático do 2B é fail-closed no contrato pessoal, no JWT local e no loopback. As suítes citadas existem como JSON/TAP/log e os números batem com o que está *dentro* desses arquivos; **não** as rerodei.

**Não aprovar baseline 2B. Não publicar. Não tratar como ponto oficial.**  
Ciclo 1: **sem crítico/alto comprovado**; pendências são limite declarado, lacuna de prova ou robustez futura.