**SIMULAÇÃO SEM VALOR OFICIAL.** Pacote de revisão, ciclo 2 final. **Não** é baseline, uso real, produção, publicação ou REP-P.

## Métodos e limites

Mesma inspeção passiva do ciclo 1: listar, extrair, ler, buscar e SHA-256. **Não** executei projeto, SQL, testes, scripts, Auth, containers, endpoints ou rede. **Não** reexecutei provas.

- ZIP C2: `731c1bed14d812b646427802b0b7ace6d786c44853188ad7a1183cdae1dedf63`, 254 entradas (manifesto: 253 arquivos + ele mesmo).
- Recibos externos: C1 `edc90b89…` / 250 / `findings: []`; C2 `731c1bed…` / 254 / `findings: []`. Conferem com os ZIPs.
- `is_approved_baseline: false`. Origem declarada 2B inalterada.
- Hashes de `integridade.mjs`, `plano-testes-2d.json`, `resultado-2d.json` e doc 36 batem com o manifesto.
- Backup sintético entregue permanece `99f599d2…` (três eventos). A 49ª corrida gerou outro SHA de exportação (`9d529b0b…`) sem substituir o entregue.

---

## Confronto D-01 a D-06

| Achado C1 | Confronto C2 | Veredito |
| --- | --- | --- |
| **D-01** médio — contexto fora da âncora | Âncora/digest **continuam** só E/R + epoch (`eventDigest` / `stateOf`). Hipótese “revogação Auth revertida só com snapshot local ativo”: `provas-auth-real-2d.mjs` após `revokePreviewAccount` + restart lê o contexto de João e exige `active===true` e `context_status==='active'`, depois POST/retry 401/403 e `count()===3`. `resultado-auth-real-2d.json` traz `revoked_auth_with_active_local_snapshot_denied: true`. | **Confirmado.** Não é falha do gate 2D de E/R. Adulterar só `lab_context` sem passar pelo Auth **permanece** risco privilegiado, como o confronto admite. |
| **D-02** médio/baixo — resultado/metadados sem trigger | Trigger só em `lab_time_event`. J ainda detecta mapping/epoch. Epoch precisa avançar; contexto precisa renovar. | **Confirmado.** Não é proteção contra DBA. |
| **D-03** baixo — plano reescrito na execução | `--plan` grava e sai; execução faz `assert.deepEqual` + `expected` e registra `plan_sha256` / `plan_read_only_during_execution`. Relatório 2D: SHA `fd076ad7…` = bytes do plano no ZIP; Auth `b3ed7ce4…`. Histórico 47/47, 47/47, 48/48 preservado em `previous_runs`. | **Confirmado** (o `--plan` ainda *pode* regravar o arquivo, mas não na corrida de prova). |
| **D-04** baixo — contrato health | Doc 36 lista dez chaves; `health()` devolve exatamente essas; teste B compara `Object.keys` ordenadas com a lista. `estado-final.json.health` tem as mesmas dez. | **Confirmado.** |
| **D-05** baixo — listener sem núcleo | Lock segue impedindo segundo PGlite; HTTP 503 / `UNAVAILABLE` no filho de ensaio. Bootstrap real na 3103. | **Aceito** como diagnóstico intencional, não segundo writer. |
| **D-06** sessão/`auth.sessions` | Sem mudança em `verifyPersonal`. | **Confirmado** como A2/A4 futuro. |

---

## Precisão sub-ms (achado interno)

Não há `CHECK` em `schema.sql` que impeça gravar fração sub-ms. A recusa é a consulta do verificador:

```63:66:04_BANCO_E_SUPABASE/laboratorio-marco-2b/integridade.mjs
    const imprecise = (await db.query("select count(*)::int as n from lab_time_event where date_trunc('milliseconds',server_received_at_utc)<>server_received_at_utc or date_trunc('milliseconds',server_committed_at_utc)<>server_committed_at_utc")).rows[0].n;
    if(imprecise)fail('TIMESTAMP_PRECISAO_NAO_SUPORTADA');
```

O 49º caso (`+ interval '1 microsecond'` em `server_received_at_utc`) está no plano, no executor e em `resultado-2d.json` como PASS (2398 ms). Hash v1 inalterado (recomputei no C1; o algoritmo é o mesmo). Limitação de `created_at` sub-ms permanece explícita no doc 36.  
Leitura rigorosa: o `UPDATE` privilegiado ainda **escreve**; o gate recusa **retomada**. Adequado ao objetivo “Date/JSON não escondem 1 µs nos horários v1”. Não é crítico/alto.

---

## Evidências gravadas (não reexecutadas)

- Storage 49/49; caso novo J sub-ms; crashes C intactos.
- `temporal_rollback`: epoch 5 vs 3; 5 IDs esperados, 3 observados, 2 ausentes (`58f1f92c…`, `9f016dda…`), `writes_blocked: true`.
- Auth 17/17 (nomes iguais ao plano; asserção extra no caso de João revogado, sem 18º item — aceitável).
- Verificador herdado: `verificacao-previa-parada.json` e `estado-final.preview_shutdown.stopped_integrity` PASS, 38 eventos, âncora `MATCH` (adoção declara 29 herdados + ensaios posteriores na cópia 2D).
- Transporte 13/13 e regressões citadas constam no manifesto; **não somar**.
- UI: `web_unchanged_from_2b: true`.

---

## Crítico/alto no escopo mínimo local

**Nenhum crítico ou alto aberto** que impeça o fechamento técnico local do 2D sintético, na leitura passiva deste ciclo 2.

Limitações que **devem permanecer escritas** (não são fechamento de custódia):

- dono do host / DBA (banco **e** âncora, código, trigger);
- energia, disco, fsync de diretório;
- múltiplos writers (lock cooperativo);
- janela de revogação entre Auth e commit;
- A2/A4 sessão/logout;
- hash ≠ assinatura digital;
- contexto mutável fora da âncora.

**Não autorizo baseline 2D.** O doc 36 ainda diz, no caput da §9, “segundo ciclo em preparação”; o restante da seção já é confronto — só inconsistência editorial.

Ciclo automático encerrado (limite 2). Qualquer baseline exige decisão nova do responsável, fora deste parecer.