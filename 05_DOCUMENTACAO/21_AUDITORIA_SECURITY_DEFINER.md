# Auditoria das funções `SECURITY DEFINER` — 25/09/2026

**Adendo de reconciliação 26/09/2026:** o [catálogo remoto sanitizado](../06_TESTES_E_QUALIDADE/fixtures/supabase-remoto-catalogo-20260926.json) registra 57 funções `public`/`private`; a comparação com fixture+1A local encontrou 55 corpos comuns com fingerprint equivalente após CRLF/LF, e dois alterados intencionalmente (`employee_work_team`, `stock_team`). As flags de `SECURITY DEFINER`, retorno, volatilidade e `search_path` das funções comuns coincidem, mas o fixture difere do remoto em **49 flags de EXECUTE para `anon` e 13 para `authenticated`**. Portanto testes PGlite não representam os grants REST reais. O [inventário de superfície](25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md) lista as 39 funções públicas com EXECUTE para `authenticated`, incluindo invokers e uma função de trigger, e separa rota tentável de autorização efetiva. Nenhuma função foi alterada no remoto.

**Adendo local de 26/09/2026:** a migration ainda não aplicada `20260925120000_employee_identity_foundation.sql` altera `public.stock_team` e `public.employee_work_team` para recusar contas registradas no portal, sem mudar o resultado para administrador da Gestão no ensaio PGlite. Acrescenta `admin_register_portal_account`, `admin_link_employee_identity(uuid,uuid,text,text,text)`, `admin_revoke_employee_identity` e `my_employee_profile()`; as três primeiras exigem admin ativo, e a última deriva o titular de `auth.uid()`/vínculo ativo, sem `employee_id` de entrada. `private.employee_portal_accounts` fica sem grant de tabela a clientes; o trigger impede ativar seu perfil de Gestão. **A tabela abaixo descreve o remoto antes dessas alterações**, onde os helpers continuam sem guarda. Não afirmar que o remoto já foi corrigido. Mesmo localmente, a enumeração completa de rotas REST/RPC com JWT real permanece pendente.

## Escopo e interpretação

Inventário **read-only do catálogo remoto efetivo** do projeto de **testes**, ainda não usado pela empresa: 46 funções `SECURITY DEFINER` em `public`/`private`; 34 de `public` têm `EXECUTE` para `authenticated`, 3 helpers de `private` também, e 9 não têm execução por `authenticated`. Nenhuma das 46 tem execução por `anon`. Inspecionei definição, grants e `search_path`; não executei operações mutantes no remoto. “Segura (Gestão)” significa que a checagem está presente no código inspecionado, **não** certificação de ausência de falhas. Todas as 34 públicas podem ser chamadas diretamente por cliente autenticado via RPC se `public` estiver exposto; `TO authenticated` não substitui a checagem interna. `private` não é rota pública do Data API na configuração usual, embora haja `EXECUTE` SQL. Nenhuma função atual deve ser herdada implicitamente pelo portal pessoal ou REP-P.

Legenda: **A** = administrador ativo; **O** = `can_operate` com permissão/equipe; **P** = perfil ativo e validação de papel/equipe; **U** = `auth.uid()`/perfil, sem recorte pessoal; **—** = não valida identidade. `F` = `search_path=''` e referências qualificadas; `P` = `public` ou `public,pg_temp` (menos robusto; `authenticated` não tem `CREATE` em `public` no projeto observado). “Ajustar” indica revisão antes de portal ou melhoria de defesa, não exploração comprovada.

| Função `public` executável por `authenticated` | Finalidade / altera dados? | Guarda de identidade, papel e equipe | Path | Classificação e risco |
| --- | --- | --- | --- | --- |
| `add_epi_stock_batch` | lote EPI; sim | O `epi:write`, item/variante | F | Segura (Gestão); não herdar. |
| `admin_delete_asset_movement` | desfaz/exclui movimento; sim | A, último movimento | P | Ajustar trilha/retificação; não herdar. Exclui histórico de movimentações de teste no estado atual. |
| `admin_delete_material_movement` | desfaz/exclui movimento; sim | A, estoque e exceções | F | Ajustar trilha/retificação; não herdar. |
| `admin_update_asset_movement` | corrige movimento; sim | A, equipe/status | P | Segura (Gestão), endurecer path; não herdar. |
| `admin_update_material_movement` | corrige movimento; sim | A, origem/destino/estoque | F | Segura (Gestão); não herdar. |
| `admin_update_profile` | papel, equipe, ativação; sim | A, campos permitidos | F | **Ajustar antes do portal:** pode ativar `collaborator` sob políticas amplas. |
| `admin_update_profile_access` | permissões operacionais; sim | A, delega à função acima | F | **Ajustar antes do portal:** mesmo caminho de ativação. |
| `can_operate` | calcula permissão; não | U, perfil ativo, papel e equipe quando passada | F | Segura (Gestão); não é prova de titularidade pessoal. |
| `close_epi_delivery_quantity` | fecha quantidade EPI; sim | O `epi:write` e equipe do empregado | F | Segura (Gestão); não herdar. |
| `consume_material` | consumo; sim | P/O `consumption:write`, equipe | F | Segura (Gestão); não herdar. |
| `create_epi_item_with_stock` | item e estoque EPI; sim | A | F | Segura (Gestão); não herdar. |
| `create_equipment_for_team` | equipamento; sim | P/O `equipment:write`, equipe | F | Segura (Gestão); não herdar. |
| `create_equipment_for_team_v2` | equipamento/locação; sim | P/O `equipment:write`, equipe | F | Segura (Gestão); não herdar. |
| `create_material_for_team` | material/estoque; sim | P/O `materials:write`, equipe | F | Segura (Gestão); não herdar. |
| `create_team_admin(text,text)` | equipe; sim | A | P | Segura (Gestão), endurecer path; não herdar. |
| `create_team_admin(text,text,text)` | equipe/tipo; sim | A | P | Segura (Gestão), endurecer path; não herdar. |
| `deactivate_asset_admin` | inativa ativo; sim | A | P | Segura (Gestão), endurecer path; não herdar. |
| `deactivate_item_admin` | inativa item; sim | A, impedimentos de estoque/ativo | P | Segura (Gestão), endurecer path; não herdar. |
| `delete_team_admin` | exclui equipe; sim | A, verificações de vínculo/estoque | F | Segura (Gestão); não herdar. |
| `employee_work_team` | revela equipe de `employee_id` arbitrário; não | **—** | F | **Precisa ajuste:** `authenticated` consulta UUID de outro funcionário sem verificar titularidade. Não herdar. |
| `fulfill_epi_request` | entrega pedido; sim | O `epi:write` e equipe do empregado | F | Segura (Gestão); não herdar. |
| `register_asset_movement` | movimenta ativo; sim | P/O `equipment:write`, equipe | F | Segura (Gestão); não herdar. |
| `register_epi_delivery` | entrega EPI; sim | O `epi:write` e equipe do empregado | F | Segura (Gestão); não herdar. |
| `register_epi_delivery_batch` | entrega lote EPI; sim | O `epi:write` e equipe do empregado | F | Segura (Gestão); não herdar. |
| `register_movement` | movimenta material; sim | P/O `materials:write`, equipe | F | Segura (Gestão); não herdar. |
| `replenish_material` | transfere estoque; sim | P/O `materials:write`, equipe | F | Segura (Gestão); não herdar. |
| `request_epi_item` | pedido operacional de EPI; sim | O `epi:write` e equipe do empregado | F | Segura (Gestão); **não é** pedido pessoal. |
| `run_site_operation` | roteador de operações de obra; sim | U no início; checagens por comando A/O e chamadas delegadas | F | **Precisa ajuste/revisão por comando** antes do portal; superfície extensa. `p_occurred_at` é informado pelo cliente, inadequado para hora de ponto. |
| `stock_team` | revela equipe de estoque de equipe arbitrária; não | **—** | F | **Precisa ajuste:** consulta sem guarda; não herdar. |
| `update_asset_admin` | edita ativo; sim | A | P | Segura (Gestão), endurecer path; não herdar. |
| `update_equipment_admin` | edita equipamento; sim | A | F | Segura (Gestão); não herdar. |
| `update_equipment_admin_v2` | edita equipamento/locação; sim | A | F | Segura (Gestão); não herdar. |
| `update_item_admin` | edita item; sim | A | P | Segura (Gestão), endurecer path; não herdar. |
| `update_team_admin` | edita equipe; sim | A | P | Segura (Gestão), endurecer path; não herdar. |

`employee_work_team` e `stock_team` não provaram vazamento de dados clínicos ou escalada mutante no uso atual: retornam UUIDs e o catálogo de equipes já é amplamente legível a perfil ativo. **O risco muda** quando existir usuário pessoal: não devem servir de autorização nem continuar expostos sem revisão. As funções `admin_delete_*` alteram histórico da Gestão, mas não há originais REP-P nessas tabelas. O futuro REP-P precisa de armazenamento e privilégios próprios, sem `UPDATE/DELETE` de originais por papéis de Gestão.

| Função `private` executável por `authenticated` | Efeito e guarda | Path | Decisão |
| --- | --- | --- | --- |
| `current_team_id` | lê equipe do próprio `auth.uid()` com perfil ativo; não escreve | P | Helper de Gestão; não usar como identidade de empregado. |
| `is_active_user` | verdadeiro para **qualquer** perfil ativo, inclusive `collaborator`; não escreve | P | **Precisa ajuste** antes do portal; abre várias políticas de leitura. |
| `is_admin` | verifica `auth.uid()`, perfil ativo e papel admin; não escreve | P | Helper de Gestão; endurecer path em revisão futura. |

Nove funções sem `EXECUTE` para `authenticated`/`anon`: `private.enforce_metallo_user_provisioning`, `public.claim_initial_admin`, `public.enforce_epi_delivery_close`, `public.handle_new_user`, `public.issue_user_provisioning_ticket`, `public.preserve_epi_item_system_key`, `public.revoke_user_provisioning_ticket`, `public.sync_asset_legacy_metadata`, `public.validate_profile_access`. São gatilhos/rotinas internas ou bootstrap/serviço; **não classificadas como “não usadas”** sem examinar `pg_depend`/chamadores e operação. `claim_initial_admin` não está executável por cliente autenticado no catálogo consultado.

## Novas funções locais do Marco 1A

`admin_register_portal_account`, `admin_link_employee_identity` e `admin_revoke_employee_identity` são `SECURITY DEFINER`, `search_path=''`, execução concedida somente a `authenticated`, checam `auth.uid()` e administrador ativo e usam tabelas qualificadas. `my_employee_profile()` é `SECURITY DEFINER` pessoal, sem parâmetro de funcionário e com seleção explícita de quatro campos. Foram testadas com dados sintéticos. Não estão no remoto e não ativam contas automaticamente. Os gatilhos privados de histórico/auditoria não têm execução por cliente. Revisar novamente após qualquer mudança de grants/políticas no remoto.

## Decisão sobre avisos adjacentes

O advisor também apontou proteção contra senhas vazadas desligada. Isso permite que senha já conhecida em vazamentos seja reutilizada; [a documentação Supabase](https://supabase.com/docs/guides/auth/password-security) informa que a proteção nativa está disponível no plano **Pro ou superior**. O projeto conectado está no plano **Free**. Recomendo exigir senha forte, MFA administrativo e considerar Pro/proteção de vazadas ao planejar produção; **nenhuma mudança de plano/Auth foi feita**.

RLS sem política em `metallo_safe_20260903.snapshot`, `metallo_safe_posttest_20260904.snapshot` e `metallo_safe_posttest_20260904.tones_cleanup`: todos os três têm RLS ativo; `authenticated` não tem USAGE nos schemas nem SELECT nas tabelas, e `anon` não tem SELECT. Colunas observadas (`table_name`, `captured_at`, `row_count`, `rows`, `checksum`) sugerem snapshots internos, mas a finalidade/retenção precisa ser confirmada com o responsável que os criou. **Mantê-los fechados**; não criar policy permissiva para apagar aviso. Não foram lidas as linhas `rows`.
