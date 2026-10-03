# Reconciliação de migrations e tipos — leitura de 25/09/2026

**Estado atual:** baseline real reconstruída e gate local aprovado; ver relatórios 26 e 30. A nova migration de equipe opcional altera somente no laboratório a nulabilidade de `epi_employees.team_id` e o corpo do DTO pessoal. Os tipos compartilhados da Gestão continuam representando o contrato remoto; a prévia pessoal já usa `team_name: string | null`. Implantação futura deve reconciliar os tipos de Gestão e seus fluxos para equipe nula. A análise de fixture e preparação abaixo é histórica, não pendência atual de Docker.

**Lacuna concreta de bootstrap:** os 33 SQLs remotos não contêm `CREATE TABLE` para oito tabelas EPI presentes no catálogo efetivo (`epi_deliveries`, `epi_employee_item_sets`, `epi_employee_items`, `epi_employees`, `epi_items`, `epi_monthly_acknowledgements`, `epi_requests`, `epi_stock_batches`). As nove migrations EPI locais de 02–03/09 entram cronologicamente entre os históricos remotos de 01/09 e 04/09 e são candidatas para teste de reconstrução, não equivalência já demonstrada. As 57 definições efetivas de funções também foram salvas e verificadas por hash para apoiar a comparação posterior.

## Adendo de catálogo efetivo — 26/09/2026

Foi salvo um [manifesto sanitizado do catálogo remoto](../06_TESTES_E_QUALIDADE/fixtures/supabase-remoto-catalogo-20260926.json), obtido por consultas **somente leitura**: 288 KB, SHA-256 `1bbbe231114abfbe26b0bbec6f7f354cefee9d4fa727be3386cb5c25781cd05b`. Inclui nomes/definições de colunas, constraints, índices, policies, grants, gatilhos, views, flags de RLS, assinaturas/privilégios e fingerprints dos corpos de funções, extensões e dependências com `auth.users`. **Não contém linhas de usuários, credenciais, tokens nem corpos de funções**. Os corpos podem ser reconsultados no histórico/catálogo para reprodução controlada. O [comparador executável](../06_TESTES_E_QUALIDADE/comparar-schema-remoto-local.mjs) carrega o fixture 0.9.8, permissões, obras e a migration 1A em PGlite, e imprime diferenças contra o manifesto; não conecta nem escreve no remoto.

| Classe | Remoto | Fixture + migrations locais | Diferença relevante |
| --- | ---: | ---: | --- |
| Relações `public`/`private` | 31 | 34 | As três tabelas de identidade são somente locais; `private.user_provisioning_tickets` está sem RLS no remoto e com RLS no fixture, sem grant cliente observado. |
| Colunas | 274 | 298 | As 24 extras pertencem às três tabelas de identidade; nenhuma coluna compartilhada diferiu na comparação textual. |
| Constraints, excluindo `NOT NULL` interno | 169 | 188 | As 19 extras são de identidade; nenhuma constraint compartilhada diferiu textualmente. |
| Índices | 126 | 81 | **55 índices remotos faltam no fixture**, incluindo índices de movimentações; dez extras locais são de identidade. |
| Policies | 70 | 70 | Nomes e expressões comparadas coincidem após normalizar a representação de roles. Isso não prova REST/Auth. |
| Gatilhos de usuário `public`/`private`/`auth` | 17 | 18 | Fixture não contém três gatilhos reais de `auth.users`; quatro gatilhos de identidade são somente locais. |
| Funções `public`/`private` | 57 | 66 | Nove funções extras são da fundação 1A. **55/57 corpos comuns** têm fingerprint igual após normalizar CRLF/LF; dois corpos diferentes são `employee_work_team` e `stock_team`, modificados localmente para bloquear portal. Flags `SECURITY DEFINER`, retorno, volatilidade e `search_path` coincidem; **49 flags `anon EXECUTE` e 13 `authenticated EXECUTE` diferem**, refletindo grants incorretos/incompletos do fixture. |
| Views `public`/`private` | 0 | 0 | Nenhuma observada nesses dois schemas. |
| Grants de tabela para `anon`/`authenticated`/`service_role` | 420 | 31 | 390 entradas remotas ausentes no fixture; uma entrada local extra (`epi_requests` INSERT). Não usar o fixture como prova de superfície REST. |
| FKs para `auth.users` | 21 | 17 | Dez dependências remotas Auth ausentes no fixture; seis extras são da identidade local. |
| Extensões remotas | 5 | — | `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1; PGlite não representa a pilha Supabase completa. |

Os schemas observados incluem `public`, `private`, `auth`, `storage`, `realtime`, `extensions`, `graphql`, `graphql_public`, `vault`, `supabase_migrations` e dois schemas de snapshot fechados. O setting SQL `pgrst.db_schemas` retornou `null`: **a lista efetiva de schemas expostos pela Data API ainda não foi obtida**. Foram inventariadas três Edge Functions remotas ativas (`admin-invite-user`, `create-employee`, `delete-employee`) e zero buckets de Storage; duas das funções implantadas não têm fonte local nesta árvore. O [inventário do portal](25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md) separa chamadas tentáveis de acesso efetivamente autorizado.

**Conclusão:** há representação reproduzível para detectar drift do catálogo, mas **não há ainda laboratório fiel ao remoto**. Docker/Podman, `psql`, `pg_dump`, CLI Supabase e PostgREST não estão disponíveis neste host. PGlite não executa Auth/PostgREST nem reproduz os grants/gatilhos/Auth do remoto. O gate de aplicação da migration 1A e de conclusão do Marco 1A permanece fechado. Não houve `db push`, reset ou aplicação no remoto.

**Atualização de 26/09/2026 — resultado ainda parcial.** Uma leitura adicional do catálogo efetivo remoto (somente metadados, sem linhas de funcionários) levantou **75 colunas** nas sete tabelas dirigidas de identidade/EPI/equipes/obras, **16 policies**, **45 constraints**, **34 índices**, **6 triggers** e resumos de grants para **7 tabelas**. Foram listadas **57 funções** em `public`/`private` para revisão de definição, segurança e privilégio. Extensões instaladas observadas: `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1 e `uuid-ossp` 1.1. Esta é uma amostra dirigida, não um dump integral do esquema nem prova de que todas as funções/objetos remotos derivam dos arquivos locais. Não foi executado DDL remoto.

**Gate que permanece aberto:** os SQLs históricos remotos podem ser lidos de `supabase_migrations.schema_migrations.statements`; os 12 pares de arquivo que coincidem por nome foram comparados abaixo. Ainda falta mapear/reproduzir os **21 históricos somente remotos**, a origem dos **nove arquivos EPI somente locais**, comparar os objetos efetivos relevantes (bodies de funções, policies, grants, triggers, constraints, índices e extensões) com a reprodução descartável, e executar testes Auth/REST/RPC/RLS nela. O fixture `metallo-0.9.8-schema.sql` com migrations locais é útil para detectar regressão lógica, mas não é réplica certificada do remoto. Portanto **não há equivalência efetiva final**, não se pode aplicar a migration de identidade ao projeto compartilhado, e tipos não devem ser regenerados sobre o arquivo manual. O projeto conectado contém somente dados de teste e ainda não opera na empresa; a restrição protege o ambiente de desenvolvimento compartilhado.

### Comparação do SQL histórico dos 12 pares

Leitura somente do campo `statements[1]` do histórico remoto, comparada ao arquivo local em 26/09. Em **dez pares**, o texto é igual após normalizar CRLF/LF e espaços finais. Nos outros **dois**, o texto executável é igual após remover apenas linhas inteiras de comentário `--` e linhas vazias; o arquivo local tem comentários explicativos adicionais. Essa comparação textual não prova que o **esquema efetivo** seja idêntico depois de migrations remotas sem par.

| Par por nome | Resultado do corpo SQL |
| --- | --- |
| `secure_epi_mutations` | Igual após normalizar fim de linha |
| `fix_confirmed_functional_bugs` | Igual após normalizar fim de linha |
| `web_platform_hardening` | Igual após normalizar fim de linha |
| `web_mobile_parity` | Igual após normalizar fim de linha |
| `allow_epi_stock_entries_for_operators` | Igual após normalizar fim de linha |
| `harden_rpc_and_close_public_signup` | SQL executável igual; comentários locais adicionais |
| `close_partial_epi_delivery` | Igual após normalizar fim de linha |
| `restore_auth_profile_trigger_execution` | SQL executável igual; comentários locais adicionais |
| `secure_admin_user_provisioning` | Igual após normalizar fim de linha |
| `strip_user_provisioning_token` | Igual após normalizar fim de linha |
| `user_operation_permissions` | Igual após normalizar fim de linha |
| `site_operations` | Igual após normalizar fim de linha |

## Problema e risco

O projeto remoto conectado (`Almoxarifado Online`, `sa-east-1`, PostgreSQL 17.6) lista **33** migrations. O responsável esclareceu que é um ambiente de **desenvolvimento/testes**, sem uso operacional pela empresa, e que todo o histórico de dados atual é de teste. A pasta local contém **23** arquivos SQL após a criação da fundação de identidade, incluindo uma alteração operacional ainda não rastreada no Git. Versões diferentes para nomes iguais **não demonstram SQL equivalente**. Rodar `db push`, reset ou reaplicar os arquivos locais pode duplicar tabelas, falhar no meio, mudar privilégios ou apagar comportamento de Gestão **em desenvolvimento**. Nenhum desses comandos foi executado.

## Estado remoto real

Histórico consultado por listagem de migrations. A última entrada é `20260912073518_site_operations`. Há tabelas remotas `epi_employees`, `epi_deliveries`, `epi_requests`, `epi_employee_items`, `epi_profession_items`, `epi_stock_batches`, `employee_assignments`, `worksites`, `site_operation_receipts`; logo parte do esquema de EPI existe, mas **a origem histórica exata não foi demonstrada**. A consulta não encontrou `public.company_settings`, embora o histórico cite duas migrations com esse nome: conferir outro schema, renomeação ou retirada antes de concluir equivalência. Não foi feita leitura de linhas pessoais nem alteração remota.

### Somente no histórico remoto por nome — 21

| Versão | Nome |
| --- | --- |
| 20260831150748 | initial_almoxarifado_schema |
| 20260831150949 | lock_down_movement_rpc |
| 20260831151027 | index_movement_performed_by |
| 20260831151331 | auth_profile_and_individual_assets |
| 20260831151419 | index_asset_movement_teams |
| 20260831151815 | secure_initial_admin_bootstrap |
| 20260831151934 | support_admin_user_activation |
| 20260831152721 | remove_unused_admin_helper |
| 20260831202340 | fix_inventory_asset_writes_and_realtime |
| 20260831203026 | atomic_team_inventory_creation |
| 20260831213111 | reuse_material_catalog_code_across_teams |
| 20260831213152 | reuse_equipment_catalog_code_across_teams |
| 20260831224431 | marco3_admin_roles_history_teams |
| 20260831224626 | marco3_role_permissions |
| 20260901010548 | marco4_locations_catalog_admin |
| 20260901014803 | marco4_cosem_name |
| 20260901021824 | fix_material_movement_types |
| 20260901024254 | marco4_2_engineer_role |
| 20260901024309 | marco4_2_register_movement_engineer |
| 20260905032804 | company_settings_phase_one |
| 20260905032907 | company_settings_policy_cleanup |

## Estado local real

Os arquivos locais começam em `20260902231312_epi_management.sql`. **Somente local por nome — 11:** nove arquivos EPI abaixo, a migration operacional `20260912190000_unify_existing_operations.sql` já presente como arquivo não rastreado antes deste trabalho, e `20260925120000_employee_identity_foundation.sql` criada nesta continuação.

| Versão | Nome |
| --- | --- |
| 20260902231312 | epi_management |
| 20260903001647 | epi_profession_kits |
| 20260903050000 | epi_grouped_deliveries |
| 20260903061000 | epi_requests |
| 20260903070000 | epi_employee_item_sets |
| 20260903133000 | epi_stock_variants |
| 20260903140500 | close_epi_requests_on_delivery |
| 20260903154000 | epi_request_variants |
| 20260903184203 | aso_and_rental_return |
| 20260912190000 | unify_existing_operations — não rastreada no início |
| 20260925120000 | employee_identity_foundation — nova, somente local |

### Mesmo nome, versão diferente — corpo SQL comparado acima

| Nome | Remoto | Local |
| --- | --- | --- |
| secure_epi_mutations | 20260904195747 | 20260904193736 |
| fix_confirmed_functional_bugs | 20260905191817 | 20260905185609 |
| web_platform_hardening | 20260906142601 | 20260906021925 |
| web_mobile_parity | 20260906201809 | 20260906075309 |
| allow_epi_stock_entries_for_operators | 20260906203232 | 20260906082523 |
| harden_rpc_and_close_public_signup | 20260907011818 | 20260906221331 |
| restore_auth_profile_trigger_execution | 20260907221108 | 20260907183000 |
| secure_admin_user_provisioning | 20260907222004 | 20260907184500 |
| strip_user_provisioning_token | 20260907222411 | 20260907190000 |

Versão e nome coincidem em três: `20260907060320_close_partial_epi_delivery`, `20260912073507_user_operation_permissions`, `20260912073518_site_operations`. O corpo SQL desses três foi comparado textualmente; a igualdade do histórico não certifica todos os objetos efetivos.

## Correspondência de esquema observável

As nove migrations locais de EPI correspondem **tematicamente** às tabelas de EPI presentes no remoto. As migrations de obras correspondem a `worksites`, `employee_assignments` e `site_operation_receipts` presentes remotamente. Isso não prova que índices, constraints, RLS, grants, gatilhos e funções tenham a mesma definição. `employee_identity` **não existe** no remoto consultado. `public.company_settings` também não apareceu na consulta dirigida, apesar do histórico remoto. A migration `unify_existing_operations` existe apenas na árvore local; **não atribuir suas funções/alterações ao remoto** sem comparação objeto a objeto.

## Estratégia segura

1. Congelar snapshot do estado Git e da lista de migrations; preservar mudanças locais de Web/Mobile e o arquivo operacional não rastreado. Guardar uma cópia controlada dos SQLs remotos já acessíveis no histórico, sem reescrever a tabela de migrations para fazê-la “parecer limpa”.
2. A comparação textual dos 12 pares por nome foi feita. Reproduzir os 21 arquivos históricos sem par e fazer diff do **esquema efetivo** remoto contra cópia descartável: colunas, FKs, índices, políticas, grants, funções, gatilhos e extensões. Tratar os nove arquivos EPI locais como possível bootstrap fora do histórico, nunca como automaticamente pendentes.
3. Documentar mapa objeto→migration e divergências reais, inclusive `company_settings` e `unify_existing_operations`; separar mudanças já existentes das realmente novas. Preparar apenas migrations incrementais que partam do esquema remoto comprovado.
4. Ensaio em banco isolado com dados sintéticos, backup e plano de reversão; revisar SQL e executar testes de Gestão e segurança. Só depois pedir aprovação para qualquer aplicação ao banco conectado. A fundação de identidade é aditiva, mas **não deve ser publicada antes desse preflight**.

O CLI do Supabase não estava disponível neste ambiente (`supabase` fora do PATH e sem `node_modules/.bin/supabase.cmd`). A nova migration foi criada com convenção de nome local. Sua ausência do projeto remoto é intencional.

## Plano para tipos TypeScript

`03_COMPARTILHADO/01_TIPOS/src/database.ts` está alterado por outro trabalho e não declara todas as tabelas remotas de obras. Após reconciliação: salvar cópia e diff atual; gerar tipos do projeto **correto** em arquivo temporário; comparar com os tipos existentes e com usos Web/Mobile; incorporar só mudanças confirmadas sem apagar código manual; executar verificação de tipos e testes pertinentes; revisar diff final antes de substituir o arquivo. Não regenerar diretamente sobre esse arquivo enquanto o esquema e a migration operacional estiverem divergentes. **Status:** aguardando reconciliação; nenhum tipo foi sobrescrito.
