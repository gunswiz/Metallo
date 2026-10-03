O hash do ciclo 2 confere: `f130eb6d95585078d5c98b7bf12dcf002dbc34d6500d2267add32860ea4d64f2`. São 78 entradas; o manifesto cobre 77 arquivos e não se autoinclui. Os 77 hashes internos batem. O catálogo estrutural está idêntico ao declarado, SHA-256 `8902b1f16bd7a3111a71d43349f939913e9a7cccfbc428ad4c26410c5ea19571`. A origem 3H continua só declarada; o ZIP de origem não foi recomputado.

Leitura passiva: `sha256sum`, `unzip -l`, extração em `/tmp/audit-4a-c2`, hashes e confronto de texto com o ciclo 1. `http-lab.mjs` e as fontes 2B/2F do pacote estão byte a byte iguais às do ciclo 1. Não executei provas, SQL, Auth nem rede. O 80/80 e o 13/13 são evidência do responsável, não reprodução desta auditoria.

Não há crítico nem alto confirmado aberto. F-4A-01 fecha no código. F-4A-02 e F-4A-04 foram erro de leitura do ciclo 1 e ficam retirados.

## Confronto

| ID | Severidade | Estado no ciclo 2 | Confronto |
|---|---|---|---|
| F-4A-01 | ALTO | FECHADO no código; ensaio dinâmico não reexecutado aqui | O antes descrito em `resultado-auditoria-4a.json` é o caminho que o ciclo 1 leu: v1 gravava original sem intenção nem recibo. A correção não altera o HTTP 2F. `servidor-4a.mjs` linha 30 sobe `startSessionServer`. `sessao-http.mjs` troca `record`, `history`, `outcome` e `outcomeHistoric` por negação 404. O `http-lab.mjs` chama esses métodos no objeto recebido; o `catch` devolve o status do `LabError`. Logout atual/global não é substituído. O documento 47, linha 53, passa a descrever esse bloqueio. O proxy Next ainda encaminha `/api/ponto-lab/events` à 3105; a escrita é recusada no adaptador. |
| F-4A-02 | — | RETIRADO | `private.employee_portal_accounts` tem só `auth_user_id`, `registered_by` e `registered_at`. A coluna `status` é de `employee_identity`. O ciclo 1 misturou as duas. A frase “conta portal ativa” do documento significa conta registrada mais identidade ativa, não um status inexistente. |
| F-4A-03 | BAIXO | LIMITE RESIDUAL, não bypass atual | O código continua com `JSON.stringify` sem canonização própria. O confronto mostra que, no PGlite atual, jsonb de chaves reordenadas volta igual. Isso não foi reexecutado aqui e não cobre outro driver nem tipo numérico. Não é falha confirmada do laboratório. |
| F-4A-04 | — | RETIRADO | `is_active_admin()` já era a primeira função do catálogo do ciclo 1; a saída da ferramenta truncou a lista. Definição: perfil do `auth.uid()` com `active` e `role = 'admin'`. Não é `SECURITY DEFINER`. ACL: `authenticated` e `service_role`. `search_path` é `public, pg_temp`. A Gestão chama o RPC com o JWT do usuário. Isso sustenta o leitor administrador ativo. Não vi o enum de `role` além dessa definição. |
| F-4A-05 | INFORMATIVO | MANTIDO, aceito | RLS de `lab4a` sem `FORCE` e sem política. O owner do host ignora RLS. Não é IDOR de funcionário. O documento já dizia isso. |
| F-4A-06 | INFORMATIVO | MANTIDO, aceito | Coordenada plausível continua declarada pelo cliente. Fora do intervalo vira `UNKNOWN` e não bloqueia nem muda `marking_at`. Recibo e Gestão não recebem lat/lon. Não é veredito de fraude. |
| F-4A-07 | INFORMATIVO | MANTIDO, risco futuro | Sequência sintética e hash JSON não são NSR nem campo 8 do AFD 004. O documento não os apresenta como arquivo oficial. |
| F-4A-08 | INFORMATIVO | MANTIDO, limite residual | A fila e o elo anterior seguem de processo único. Válido para o servidor único em 3106. Não é corrida reproduzida. |
| F-4A-09 | INFORMATIVO | MANTIDO, gate aberto | HLB, ARP, HA, retenção, comprovante e hipótese LGPD continuam não concluídos e não são vulnerabilidade deste laboratório. |
| F-4A-10 | BAIXO | LIMITE RESIDUAL, não injeção do titular | A interpolação `id=in.(...)` permanece em `servidor-4a.mjs` linha 51. Os IDs saem da coluna `uuid`. O teste do pacote só prova o tipo e que o banco rejeita cast inválido; não prova o filtro PostgREST. Não há caminho do funcionário para injetar esse valor. |

Nenhum achado novo reproduzível no escopo. O adaptador não nega `inspect`; a saúde já usava isso e não grava evento. Núcleo 2F e instância aprovada não foram reescritos.

Contagens deste ciclo: crítico aberto 0; alto aberto 0; médio 0; baixo residual 2 (F-4A-03 e F-4A-10, sem bypass confirmado); informativo mantido 5. Retirados 2.

SIMULAÇÃO SEM VALOR OFICIAL. Não implantado no Supabase remoto. Não liberado para funcionários reais. Não é produção, conformidade REP-P, ponto oficial nem autorização de publicação. Não autorizo baseline 4A, marco 4B nem publicação. Este foi o segundo e último ciclo; não peço terceiro.