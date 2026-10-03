# Parecer de auditoria independente — Marco 3H, ciclo 2 (segundo e último)

**SIMULAÇÃO SEM VALOR OFICIAL.** Este parecer não autoriza baseline 3H, publicação, produção, Supabase remoto, funcionários reais, ponto oficial, REP-P nem Marco 3I. Não solicita terceiro ciclo. O fechamento eventual é decisão separada do responsável.

O auditor atuou só em inspeção passiva. Os gates 70/70 e 223/223 anexados **não foram reexecutados** e não são prova independente deste ciclo. Suítes não foram somadas (os 37 testes afetados estão dentro da Web).

## Identidade do pacote

| Item | Valor observado |
| --- | --- |
| ZIP | `Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo2.zip` |
| SHA-256 | `eb5530dc86382c180129c6dedcaf6607803617cfbb43e162d433205633942d8b` — confere com o esperado |
| Entradas | **57 arquivos** |
| Manifesto | **56** hashes; **0 divergências** no disco |
| Inventário | **55** caminhos (exclui inventário e manifesto) |
| `is_approved_baseline` | false |
| Origem | `METALLO-3G-LAB-20260930-R1`, SHA declarado `36d40d4eb85f594b75f904b899b13c02cd3283efa451bb25cdc4ed3c4b00323f` |
| ZIP da origem | não incluído. Manifesto 3G anexado: SHA `28ac088b8c102cfebae5a6a09d7161501857c6e14fff1765ffae84ecd49a5221` — confere. **Não recomputei o ZIP 3G.** |
| Parecer ciclo 1 | `parecer-grok-ciclo1-original.md`, 22.338 bytes, SHA-256 `eb4e41b9f040d6a172e22bb376b646637bf885238053b4ddd311796dddb6bc9d` — confere com o documento 46 |
| Recibo scan ciclo 1 | `outputs/…Ciclo1.zip.verificacao.json`: passed true, findings vazio, SHA do ZIP ciclo 1 igual ao já conferido no ciclo 1 |

## Veredito do ciclo 2

- **CRÍTICO / ALTO confirmado:** nenhum.
- **CRÍTICO / ALTO aberto no escopo local:** nenhum.
- A classificação do desenvolvimento **não foi aceita automaticamente**. Os quatro defeitos de código do ciclo 1 (F-3H-01 a F-3H-04) têm correção visível no fonte deste pacote, dentro dos limites que o próprio documento 46 declara. Lacunas, hipóteses e riscos de produto **permanecem riscos/lacunas**, não viram vulnerabilidade comprovada.
- **Não autorizo baseline 3H.**

## Material e comandos passivos

Lidos integralmente o prompt do ciclo 2 e o documento 46 (incluindo a matriz). Confrontados `correcao-ciclo1.sql`, `contrato-comunicados.sql` (validação de título), `contrato-3h.ts`, `communication-form.tsx`, `comunicados-3h.ts` (actions), `page.tsx`, `submit-button.tsx`, `operacoesObra.ts` (`localEventTime`), `comunicados-gestao-3h.test.tsx`, trechos de `provas-3h.mjs` (asserts novos, não executados), `resultado-3h.json` (70 nomes), `web-completa-3h.json` (223/223, 33 arquivos), `catalogo-local-ciclo2.json` (12 funções / 10 tabelas, só metadados), migration `20260906221331_harden_rpc_and_close_public_signup.sql` (trecho `is_active_admin`), `RESULTADOS_3H.json`, parecer ciclo 1 e recibo de scan ciclo 1.

Comandos: `sha256sum` do ZIP; `unzip -l` e extração em `/tmp/marco3h2`; `find`; comparação SHA-256 de cada entrada do manifesto; leitura e `grep`/`python3` de catálogo, provas e hashes. **Nenhum** script, teste, SQL, Auth, container, endpoint, localhost ou credencial foi executado. O gerador/scan do ZIP não foi executado.

---

## Confronto dos 13 achados do ciclo 1

### F-3H-01 — Expiração sem offset

- **Original:** MÉDIA, CONFIRMADO.
- **Estado neste ciclo:** CORRIGIDO no código inspecionado. Evidência de banco anexa, não reexecutada por mim.
- **Arquivo/linha:** `contrato-3h.ts` 8–19 (`communicationExpiryIso3h` força `-03:00`; `communicationExpiryLocal3h` reapresenta via `localEventTime` em `America/Fortaleza` e reanexa segundos/milissegundos); `communication-form.tsx` 17 e 47–48 (`step="any"`, valor controlado); `page.tsx` 10 (exibição em Fortaleza); `operacoesObra.ts` 161–171.
- **Condição residual:** operador fora de Fortaleza ainda grava o relógio de Fortaleza, agora explícito no rótulo. Fortaleza não tem horário de verão; `-03:00` fixo é coerente.
- **Evidência:** teste Web anexado espera `2035-09-30T18:00` → `2035-09-30T21:00:00.000Z` e round-trip de `.123Z`. Prova anexada 38–39 compara epoch 21:00 UTC após gravação e correção. Não reexecutei.
- **Impacto residual:** baixo, de operação, não de autorização.
- **Correção mínima:** nenhuma adicional neste marco.
- **Aceite já descrito no pacote:** 18h Fortaleza permanece 21h UTC depois de corrigir sem editar a expiração.

### F-3H-02 — Título aceitava `<>` na RPC

- **Original:** BAIXA, CONFIRMADO (não era XSS).
- **Estado neste ciclo:** CORRIGIDO no SQL inspecionado.
- **Arquivo/linha:** `contrato-comunicados.sql` 92 (`p_title ~ '[<>]'`) e `correcao-ciclo1.sql` 10. Mesma assinatura; grants do catálogo ciclo 2 continuam só `postgres` + `authenticated`; owner `postgres`; `search_path=""`.
- **Evidência:** prova anexada 07 exige `invalid_communication_text` para título `<b>x</b>`. React continua texto escapado. Não tratei isso como execução.
- **Impacto residual:** caracteres Unicode parecidos com `<` não são recusados; não são execução no React.
- **Correção mínima:** nenhuma obrigatória neste marco.
- **Aceite:** RPC admin com título `<b>x</b>` recusada; mensagem `<script>` continua recusada.

### F-3H-03 — Erro regenerava idempotency key

- **Original:** BAIXA, PARCIAL.
- **Estado neste ciclo:** CORRIGIDO **no limite da mesma intenção**. Não prometo deduplicação entre chaves diferentes.
- **Arquivo/linha:** `comunicados-3h.ts` (actions) 13–48: sem `randomUUID()` de fallback; chave ausente falha o parse e não chama RPC; erro de save/publish/conexão **retorna estado** em vez de redirect; redirect só após sucesso, fora do `try`. `communication-form.tsx` 19 e 25: `useState(idempotencyKey)` ignora UUID novo do pai no re-render (teste anexado troca a prop e a chave oculta permanece).
- **Condição residual:** recarregar ou fechar a página inicia outra intenção (`page.tsx` 24 e 35 ainda geram UUID na montagem). Publicar/arquivar da lista ainda redirecionam em erro (56–71 das actions); isso não carrega a chave de criação.
- **Caminho que deixou de existir:** save confirmado + publish falho no formulário novo, com a mesma montagem, não troca a chave. Teste anexado F03 cobre esse retry (mesmo `p_idempotency_key` e mesmo id).
- **Impacto residual:** duplicata só se o operador iniciar outra intenção de propósito. SQL continua `ON CONFLICT` só para a mesma chave.
- **Correção mínima:** nenhuma além do limite já escrito no documento 46.
- **Aceite:** erro sem redirect; segundo envio com a mesma chave; ausência de chave não cria.

### F-3H-04 — Botões sem pending

- **Original:** BAIXA, CONFIRMADO.
- **Estado neste ciclo:** CORRIGIDO na UI inspecionada.
- **Arquivo/linha:** `communication-form.tsx` 20 e 53–54 (`useActionState` + `disabled={pending}` nos dois submits); `submit-button.tsx` 5–7; `page.tsx` 32–33 reutiliza `SubmitButton` em publicar/arquivar.
- **Evidência anexa, não reexecutada:** teste de um único RPC enquanto pending; prova 47–48 (um 200, um `communication_version_conflict`, uma revisão nova). Conflito não é sobrescrito no cliente: a mensagem pede recarregar a versão.
- **Impacto residual:** duas abas/dois browsers ainda competem por versão; o segundo deve falhar. Não é IDOR.
- **Correção mínima:** nenhuma neste marco.
- **Aceite:** dois submits da mesma correção → um sucesso, um conflito, uma revisão nova.

### F-3H-05 — Correção não reabre “não lido”

- **Original:** BAIXA, RISCO FUTURO.
- **Estado neste ciclo:** MANTIDO como RISCO FUTURO de produto. Decisão explícita do marco; documento 46 não alterou a regra. Não é vulnerabilidade.
- **Evidência:** schema de `communication_views_3h` sem versão; texto do documento 46.
- **Correção mínima:** só se houver decisão empresarial posterior, fora deste ciclo.
- **Aceite:** João que já abriu não volta a “Não lidos” após correção; “Todos” mostra atualização.

### F-3H-06 — Janela contexto / open / view

- **Original:** BAIXA, HIPÓTESE / RISCO FUTURO.
- **Estado neste ciclo:** MANTIDO. O desenvolvimento não vendeu correção completa; concordo. `open_communication_3h` continua SELECT sem `FOR UPDATE` antes do INSERT. Não há caminho João→Maria nesse desenho.
- **Correção mínima:** não exigida para fechar o marco. Lock só da linha do comunicado não fecha troca de equipe.
- **Aceite residual:** archive/expiração concorrentes não concedem leitura de outro funcionário.

### F-3H-07 — Tetos 20+ e 1000 alvos

- **Original:** BAIXA, RISCO FUTURO.
- **Estado neste ciclo:** MANTIDO. Código de teto não mudou. Não amplia autorização.
- **Correção mínima:** evolução operacional posterior, não bloqueio deste ciclo.

### F-3H-08 — Lacuna visual estreita/teclado

- **Original:** BAIXA, LACUNA DE EVIDÊNCIA.
- **Estado neste ciclo:** MANTIDO. Inspeção passiva não observa 320px/teclado. Aprovação manual e nota de 200% do ciclo 1 permanecem evidência do responsável, não minha. Não é autorização indevida.

### F-3H-09 — Gates não reexecutados pelo auditor

- **Original:** LACUNA DE EVIDÊNCIA.
- **Estado neste ciclo:** MANTIDO como limite do mandato. O pacote anexa 70/70 e 223/223. Isso não é execução independente minha.

### F-3H-10 — Injeção de `employee_id` / `view_id` / `target_id`

- **Original:** BAIXA, LACUNA DE EVIDÊNCIA (não era bypass visível).
- **Estado neste ciclo:** cobertura anexada no script e no `resultado-3h.json` (checks 25–29). Assinaturas de `my_communications_3h` e `open_communication_3h` **não ganharam** esses parâmetros (catálogo ciclo 2). A recusa esperada é de assinatura PostgREST; a consulta anexada afirma zero views da Maria depois das tentativas. **Não reexecutei.** Não elevo a vulnerabilidade. Encerrado como lacuna de prova do ciclo 1, com evidência local nova.
- **Aceite no pacote:** João com `p_employee_id` da Maria, `p_view_id` e `p_target_id` não grava view da Maria.

### F-3H-11 — `now()` versus `clock_timestamp()`

- **Original:** BAIXA, HIPÓTESE.
- **Estado neste ciclo:** MANTIDO. Leitura ainda usa `now()`; escrita usa `clock_timestamp()`. Não alteraram a semântica 1C/3A. Não é exploração comprovada.

### F-3H-12 — `is_active_admin` INVOKER

- **Original:** nota / LACUNA de catálogo.
- **Estado neste ciclo:** contexto sanado. Não trato como divergência indevida nem como bypass.
- **Evidência:** `20260906221331_harden_rpc_and_close_public_signup.sql` linhas 6–8: `alter function … security invoker`; `revoke` de public/anon; `grant` a `authenticated` e `service_role`. Catálogo ciclo 2: `security_definer: false`, `search_path=public, pg_temp`, ACL igual. 3H não recria a função nem devolve DEFINER.
- **Impacto:** nenhum bypass de portal demonstrado. `auth.uid()` continua sendo o JWT; predicado exige admin ativo.

### F-3H-13 — View não é ciência trabalhista; sem anexos/3F

- **Original:** RISCO FUTURO de governança.
- **Estado neste ciclo:** MANTIDO como limite do marco. Ressalvas continuam na UI e no documento 46. Sem storage/PDF/push/passkey 3F neste pacote.

---

## Achado novo do ciclo 2

### F-3H-14 — Execução Web anexa com 222/223 sob paralelismo padrão

- **Severidade:** BAIXA (evidência), não é falha de autorização.
- **Estado:** LACUNA DE EVIDÊNCIA. Não confirmo regressão funcional.
- **Arquivo/linha:** documento 46, seção “Correções e resultados”; `web-completa-3h.json` final `223/223`, 33 arquivos, `success: true`.
- **Condição:** suíte com workers padrão, teste antigo de recuperação de equipe (“Colega B”), arquivo declarado inalterado.
- **Caminho:** timeout de espera, não assert de comunicados. Documento diz 9/9 isolado e suíte inteira com `maxWorkers=4`, sem relaxar assert/timeout. Não reexecutei nenhuma das duas.
- **Impacto:** flutuação documentada, não ocultada. Não elevo a defeito 3H.
- **Correção mínima:** nenhuma neste ciclo; não pedir terceiro ciclo por isso.
- **Aceite:** o relatório integral anexado é 223/223; a execução 222/223 fica registrada como não independente e não somada.

Não encontrei regressão nova em owner, `search_path`, EXECUTE, RLS, `auth.uid()`, isolamento João/Maria/sem equipe, rascunho/archive/revisão, pin ou allowlist do portal. Catálogo ciclo 2: tabelas 3H com RLS, policies nulas, ACL só `postgres`; contexto privado sem EXECUTE de cliente; RPCs 3H só `authenticated` além do owner.

## Separação final

| Grupo | Itens |
| --- | --- |
| CRÍTICO/ALTO confirmado | nenhum |
| CRÍTICO/ALTO aberto | nenhum |
| Corrigidos no fonte deste ciclo | F-3H-01, F-3H-02, F-3H-03 (mesma intenção), F-3H-04 |
| Cobertura anexa, não reexecutada | F-3H-10 |
| Contexto sanado, não é defeito | F-3H-12 |
| Riscos futuros / hipóteses mantidos | F-3H-05, F-3H-06, F-3H-07, F-3H-11, F-3H-13 |
| Lacunas mantidas | F-3H-08, F-3H-09, F-3H-14 |

## Conclusão

O ciclo 2 confronta os 13 achados. Os defeitos de código do ciclo 1 estão endereçados no limite declarado (fuso Fortaleza com offset e round-trip, `<>` no título SQL, chave estável na mesma intenção, pending no formulário e no botão reutilizado). Não há crítico ou alto confirmado aberto. Lacunas de execução independente, de viewport e de janela de contexto permanecem limites, não falhas elevadas.

**Parar. Sem terceiro ciclo. Sem baseline 3H, publicação, remoto, produção, funcionários reais, ponto oficial, REP-P ou Marco 3I. SIMULAÇÃO SEM VALOR OFICIAL.**
