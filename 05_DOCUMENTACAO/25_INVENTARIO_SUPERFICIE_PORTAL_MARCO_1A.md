# Inventário de superfície alcançável por uma conta de portal — Marco 1A

**Estado vigente — 27/09/2026:** Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados estritamente em laboratório (base682/682); **MARCO 1B — FUNCIONAL EM LABORATÓRIO**, com interface aprovada e fechamento expressamente autorizado pelo responsável. Decisão, baseline e pendências no [relatório27](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO, PONTO OFICIAL OU REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Os estados/contagens inferiores deste documento são históricos, salvo seção explicitamente vigente.

**AtualizaçãoT15:** itens/sets/ack possuem guardas explícitas de equipe não nula para não-admin, com USING/WITH CHECK em acknowledgement; administração existente preservada. REST real e fingerprints, duas conexões concorrentes e roteador deliver_epi/close_epi foram validados. Ver mapa-t15.json e policies-t15-efetivas.sql no laboratório. O catálogo atual difere do snapshot remoto em7 policies (3T05+4T15); nenhum grant remoto/local foi ampliado.

**SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL:** a regra histórica que escondia o DTO pela equipe inativa. DTO próprio permanece com team_name=null; revogação pessoal/funcionário inativo continuam negando. Na Gestão, NULL não amplia autorização; can_operate global inalterada, correção específica de policies/escrita na migration20260926224000.

**Estado em 26/09/2026:** catálogo do Supabase compartilhado lido sem mutações. Não existe conta de portal ou migration 1A nesse projeto. As decisões abaixo descrevem o **candidato local** (conta marcada, perfil de Gestão inativo e vínculo ativo), com o comportamento remoto atual destacado quando difere. Um grant para `authenticated` significa que a rota pode ser tentada; o resultado depende da policy/guarda. Este inventário não equivale a teste PostgREST com JWT real.

**Limite de exposição confirmado:** requisições HTTP somente leitura com `Accept-Profile` demonstraram que **remoto e laboratório expõem `public` e `graphql_public`**. `private`, `auth` e `storage` retornaram `PGRST106`/HTTP 406 em ambos; [evidências](26_LABORATORIO_SUPABASE_MARCO_1A.md#schemas-expostos-pela-data-api). O catálogo remoto tem 30 tabelas em `public`, todas com algum `SELECT` concedido a `authenticated` e RLS ativo; nenhuma view em `public`/`private`. Há 39 funções `public` executáveis por `authenticated` (incluindo uma função de trigger), três helpers `private` com EXECUTE e três Edge Functions remotas observadas. O Storage tem zero buckets. O laboratório acrescentou uma Edge Function de revogação.

## Tabelas REST candidatas

| Rota | Policy de leitura atual | Resultado esperado para portal local | Prova/limite |
| --- | --- | --- | --- |
| `public.asset_movements` | `asset_movements_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.assets` | `assets_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.employee_assignments` | `assignments_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_deliveries` | `epi_deliveries_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_employee_item_sets` | `epi_employee_item_sets_admin_write, epi_employee_item_sets_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_employee_items` | `epi_employee_items_admin_write, epi_employee_items_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_employees` | `epi_employees_admin_write, epi_employees_read` | Leitura negada para perfil Gestão inativo | PostgREST real com JWT: relatório 26 |
| `public.epi_item_variants` | `epi_item_variants_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_items` | `epi_items_admin_write, epi_items_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_monthly_acknowledgements` | `epi_ack_read, epi_ack_write` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_profession_items` | `epi_profession_items_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_professions` | `epi_professions_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_requests` | `epi_requests_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_stock_batches` | `epi_stock_admin_write, epi_stock_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.epi_stock_transfers` | `epi_transfers_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.inventory` | `inventory_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.items` | `items_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.movements` | `movements_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.operation_reasons` | `operation_reasons_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.profile_access_audit` | `profile_access_audit_admin_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.profiles` | `profiles_read` | Própria linha permitida; colegas negados | PostgREST real com JWT: relatório 26 |
| `public.rental_admin_details` | `rental_details_admin` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.rental_return_requests` | `returns_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.site_operation_receipts` | `receipts_own` | Somente recibos operacionais do próprio actor_id, se existirem | PostgREST local: leitura verificada; relatório 26 |
| `public.supply_order_events` | `order_events_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.supply_order_lines` | `order_lines_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.supply_orders` | `orders_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.teams` | `teams_read` | Leitura negada para perfil Gestão inativo | PostgREST real com JWT: relatório 26 |
| `public.work_locations` | `work_locations_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |
| `public.worksites` | `works_read` | Leitura negada para perfil Gestão inativo | PostgREST local: leitura verificada; relatório 26 |

As três novas tabelas `private.employee_portal_accounts`, `private.employee_identity` e `private.employee_identity_audit` ficam sem grant de tabela a `anon`/`authenticated`, com RLS ligado e sem policy permissiva. Mesmo se `private` for exposto por engano, o cliente não deve lê-las. A RPC `my_employee_profile()` é o único retorno pessoal positivo local: ID, nome, profissão e equipe do vínculo de `auth.uid()`; sem ASO e sem argumento `employee_id`.

## RPCs com EXECUTE para authenticated no catálogo remoto

| RPC / assinatura | Resultado esperado ou risco | Prova/limite |
| --- | --- | --- |
| `public.add_epi_stock_batch(p_item_id uuid, p_quantity integer, p_variant text, p_ca_number text, p_brand_model text, p_lot_number text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_delete_asset_movement(p_movement_id uuid)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_delete_material_movement(p_movement_id uuid)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_update_asset_movement(p_movement_id uuid, p_destination_team_id uuid, p_new_status text, p_note text)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_update_material_movement(p_movement_id uuid, p_quantity integer, p_origin_team_id uuid, p_destination_team_id uuid, p_note text)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_update_profile(p_user_id uuid, p_full_name text, p_role text, p_team_id uuid, p_active boolean)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.admin_update_profile_access(p_user_id uuid, p_full_name text, p_role text, p_team_id uuid, p_active boolean, p_operation_permissions text[], p_operation_team_ids uuid[])` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.can_operate(p_permission text, p_team_id uuid)` | Chamada permitida; deve retornar false para portal. | RPC real com JWT: relatório 26 |
| `public.close_epi_delivery_quantity(p_delivery_id uuid, p_quantity integer, p_status text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.consume_material(p_item_id uuid, p_team_id uuid, p_quantity numeric, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_epi_item_with_stock(p_code text, p_name text, p_item_kind text, p_unit text, p_ca_number text, p_brand_model text, p_minimum_stock integer, p_return_policy text, p_initial_quantity integer, p_variant text, p_lot_number text)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_equipment_for_team(p_code text, p_name text, p_asset_code text, p_serial_number text, p_description text, p_category text, p_team_id uuid, p_notes text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_equipment_for_team_v2(p_code text, p_name text, p_asset_code text, p_serial_number text, p_description text, p_category text, p_team_id uuid, p_user_notes text, p_ownership_type text, p_rental_company text, p_rental_start_date date, p_rental_end_date date)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_material_for_team(p_code text, p_name text, p_description text, p_category text, p_unit text, p_minimum_stock integer, p_team_id uuid, p_quantity integer)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_team_admin(p_name text, p_description text)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.create_team_admin(p_name text, p_description text, p_location_type text)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.deactivate_asset_admin(p_asset_id uuid)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.deactivate_item_admin(p_item_id uuid)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.delete_team_admin(p_team_id uuid)` | RPC da Gestão exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.employee_work_team(p_employee_id uuid, p_at timestamp with time zone)` | Remoto retorna equipe por UUID arbitrário; guarda local nega portal. | RPC real com JWT: relatório 26 |
| `public.fulfill_epi_request(p_request_id uuid, p_stock_batch_id uuid)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.is_active_admin()` | Chamada permitida; deve retornar false para portal. | RPC real com JWT: relatório 26 |
| `public.register_asset_movement(p_asset_id uuid, p_movement_type text, p_destination_team_id uuid, p_new_status text, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.register_epi_delivery(p_employee_id uuid, p_item_id uuid, p_stock_batch_id uuid, p_quantity integer, p_delivery_reason text, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.register_epi_delivery_batch(p_employee_id uuid, p_lines jsonb, p_delivery_reason text, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.register_movement(p_item_id uuid, p_movement_type text, p_quantity integer, p_origin_team_id uuid, p_destination_team_id uuid, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.replenish_material(p_item_id uuid, p_origin_team_id uuid, p_destination_team_id uuid, p_quantity numeric, p_note text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.request_epi_item(p_employee_id uuid, p_item_id uuid, p_quantity integer, p_requested_variant text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.return_rented_equipment(p_asset_id uuid, p_note text)` | Invoker; exige admin ativo. | RPC real com JWT: relatório 26 |
| `public.run_site_operation(p_command text, p_data jsonb, p_operation_id uuid, p_occurred_at timestamp with time zone)` | Definer operacional; portal inativo falha; proibido para ponto. | RPC real com JWT: relatório 26 |
| `public.set_epi_employee_items(p_employee_id uuid, p_lines jsonb)` | Invoker; escrita depende da RLS operacional, negada ao portal inativo. | RPC real com JWT: relatório 26 |
| `public.set_updated_at()` | Função de trigger; chamada direta não é rota de negócio. | RPC real com JWT: relatório 26 |
| `public.site_dashboard()` | Chamada permitida; arrays operacionais vazios no ensaio SQL. | RPC real com JWT: relatório 26 |
| `public.stock_team(p_team_id uuid)` | Remoto retorna equipe por UUID arbitrário; guarda local nega portal. | RPC real com JWT: relatório 26 |
| `public.update_asset_admin(p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_notes text, p_active boolean)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.update_equipment_admin(p_item_id uuid, p_item_code text, p_item_name text, p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_notes text, p_active boolean)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.update_equipment_admin_v2(p_item_id uuid, p_item_code text, p_item_name text, p_asset_id uuid, p_asset_code text, p_serial_number text, p_team_id uuid, p_status text, p_user_notes text, p_ownership_type text, p_rental_company text, p_rental_start_date date, p_rental_end_date date, p_active boolean)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.update_item_admin(p_item_id uuid, p_code text, p_name text, p_description text, p_category text, p_unit text, p_minimum_stock numeric, p_active boolean)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |
| `public.update_team_admin(p_team_id uuid, p_name text, p_description text)` | RPC operacional exige permissão/equipe ou admin ativo. | RPC real com JWT: relatório 26 |

**RPCs novas somente locais:** `admin_register_portal_account(uuid)`, `admin_link_employee_identity(uuid,uuid,text,text,text)` e `admin_revoke_employee_identity(uuid,text)` exigem administrador ativo; conta portal recebe `admin_required` nos testes aplicáveis. `my_employee_profile()` é permitida só se a conta portal, o vínculo e o funcionário estão ativos e o perfil da Gestão permanece inativo; João/Maria receberam apenas o próprio DTO em SQL. As funções de gatilho privado não têm execução concedida ao cliente.

**Helpers private com EXECUTE no remoto:**

| Função | Decisão | Prova/limite |
| --- | --- | --- |
| `private.current_team_id()` | Helper da Gestão; `private` não confirmado como schema exposto. Portal inativo deve falhar ou obter apenas contexto vazio. | Data API private: HTTP 406 PGRST106 |
| `private.is_active_user()` | Helper da Gestão; `private` não confirmado como schema exposto. Portal inativo deve falhar ou obter apenas contexto vazio. | Data API private: HTTP 406 PGRST106 |
| `private.is_admin()` | Helper da Gestão; `private` não confirmado como schema exposto. Portal inativo deve falhar ou obter apenas contexto vazio. | Data API private: HTTP 406 PGRST106 |

## Edge Functions e Storage

| Rota | Remoto observado | Decisão para portal |
| --- | --- | --- |
| `admin-invite-user` | Ativa, `verify_jwt=true`; código implantado consulta usuário e perfil admin ativo antes de criar conta. Não há fonte correspondente no repositório. | Negada por admin; confirmar com JWT real em laboratório. |
| `create-employee` | Ativa, `verify_jwt=true`; fonte local e implantação fazem checagem admin ativo, criam perfil de Gestão `active=true`. | Negada por admin; não usar como provisionamento pessoal. |
| `delete-employee` | Ativa, `verify_jwt=true`; código implantado exige admin ativo. Não há fonte correspondente no repositório. | Negada por admin; futura FK de identidade impede apagar histórico. |
| Storage | `storage.buckets` vazio. | Sem rota de objeto hoje; criar policies e testes por módulo antes de abrir qualquer bucket. |

## Gate de segurança

Provar este inventário com João, Maria, conta revogada e admin da Gestão em pilha descartável com Auth, JWT e PostgREST. Materializar linhas em cada família de policy; tentar listagem, filtro por ID alheio e RPCs administrativas/operacionais. Confirmar schemas expostos, grants efetivos e Edge Functions de fato implantadas. O [comparador de catálogo](../06_TESTES_E_QUALIDADE/comparar-schema-remoto-local.mjs) já mostra divergências de grants e gatilhos entre fixture e remoto; portanto o teste PGlite não encerra este gate.



## Cobertura medida após A-02 A-04 e A-11

Gate atual 445/445; a rodada auditada anterior foi 412/412. Escritas REST:30 tabelas,2 atores,3 verbos=180 requisições, mais2 PATCH de profiles.active;124 HTTP403/42501 e58 HTTP200/[];33 fingerprints SHA-256 com contagens inalterados. GraphQL:rota responde, mas pg_graphql desabilitada e nenhum objeto exposto; não equivale a validar RLS de GraphQL ativo. Storage:zero buckets.

43 assinaturas RPC:6 executadas,33 negadas por guarda SQL identificada,2 negadas por privilégio SQL sem afirmar corpo executado,1 somente roteamento PostgREST (300/PGRST203) e1 função trigger não chamável (404/PGRST202). O argumento inexistente em my_employee_profile também é roteamento404/PGRST202; defesa SQL deriva auth.uid() sem receber employee_id.

O dashboard real retornou suas12 coleções vazias, inclusive works/teams/employees/alerts. O endpoint lab-revoke-auth-failure é exclusivo de ensaio, exige admin e nunca deve ser implantado. Inventário detalhado: auditoria-complementar/inventario-rpc-executado.json. Ver [confronto final e decisão vigente](30_CONFRONTO_AUDITORIA_FINAL_E_FECHAMENTO_1A.md).
