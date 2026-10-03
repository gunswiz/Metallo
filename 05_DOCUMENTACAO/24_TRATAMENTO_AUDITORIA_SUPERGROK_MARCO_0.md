# Tratamento dos 17 achados SuperGrok — Marco 0 e fundação 1A

**Estado vigente — 27/09/2026:** Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados estritamente em laboratório (base682/682); **MARCO 1B — FUNCIONAL EM LABORATÓRIO**, com interface aprovada e fechamento expressamente autorizado pelo responsável. Decisão, baseline e pendências no [relatório27](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO, PONTO OFICIAL OU REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Os estados/contagens inferiores deste documento são históricos, salvo seção explicitamente vigente.

**Entrada:** parecer de 17 achados fornecido pelo responsável em 26/09/2026. **Método:** para cada item confrontei fonte/entrada, guarda, efeito e fronteira; procurei contraprova no estado atual; usei ensaio SQL local quando existia; separei a evidência do parecer da conclusão atual. As severidades abaixo são **as originais do SuperGrok**, não novas notas minhas. `VÁLIDO` pode descrever defeito histórico ou gate futuro sem implicar vulnerabilidade explorável hoje. O Metallo ainda não opera na empresa: os 10 funcionários de EPI, os três perfis administrativos e todos os históricos, movimentações e relatórios atuais são testes. Não há REP-P nem marcações oficiais.

**Rubrica de validação (até cinco critérios):** (1) caminho concreto da entrada até dado/operação; (2) guarda mais próxima e precondições; (3) estado remoto atual versus migration apenas local; (4) reprodução proporcional por SQL/RLS ou interface real, quando disponível; (5) contraprova e lacuna de Auth/REST/ambiente. Os testes PGlite não são apresentados como JWT assinado nem PostgREST.

| Nº | Achado resumido | Severidade original | Classificação atual | Status |
| --- | --- | --- | --- | --- |
| 1 | `collaborator` ativo e leitura cruzada | CRÍTICA | VÁLIDO | Fronteira pessoal local passou Auth/JWT/REST; remoto não recebeu migration |
| 2 | `create-employee` ativo sem identidade | CRÍTICA | VÁLIDO | Edge da Gestão negou portal; conta pessoal sintética foi provisionada por fluxo dedicado no laboratório |
| 3 | ASO em `epi_employees` | ALTA | PARCIALMENTE VÁLIDO | DTO e REST locais não expuseram ASO; segregação futura pendente |
| 4 | Revogação sem Auth | ALTA | VÁLIDO | Revogação SQL + ban Auth locais; token antigo, refresh e novo login testados |
| 5 | Associação civil e homônimos | ALTA | PARCIALMENTE VÁLIDO | UUID+nome+matrícula local; DP/senha/recontratação pendentes |
| 6 | Helpers de equipe privilegiados | MÉDIA agora / ALTA no portal | VÁLIDO | Guardas locais testadas por RPC real; remoto ainda antigo |
| 7 | `run_site_operation` para ponto | ALTA se reutilizado / MÉDIA na Gestão | VÁLIDO | Risco de reutilização; invariante documentada; REP-P inexistente |
| 8 | Histórico mutável da Gestão | ALTA para REP-P / MÉDIA na Gestão | VÁLIDO | Fronteira documentada; originais inexistentes |
| 9 | Migrations/schema divergentes | ALTA | VÁLIDO | Baseline local compatível comparada; deployment remoto ainda exige plano próprio |
| 10 | Falta de contrato entre projetos | ALTA futura | VÁLIDO | Válido na época; contrato refinado; integração pendente |
| 11 | Restore real não demonstrado | ALTA futura / INFORMATIVA agora | VÁLIDO | Ensaio PGlite apenas; restore integral pendente |
| 12 | Catálogo `SECURITY DEFINER` tentável | MÉDIA | PARCIALMENTE VÁLIDO | 43 assinaturas RPC exercitadas com JWT real no laboratório |
| 13 | Offline/GPS/replay/app adulterado | ALTA futura / INFORMATIVA hoje | VÁLIDO | Requisito futuro; invariantes registradas |
| 14 | Comprovante/AFD/AEJ/ICP ausentes | INFORMATIVA no Marco 0 / ALTA se chamado REP-P | VÁLIDO | Gate futuro; não iniciado por decisão de marco |
| 15 | LGPD/GPS/foto/BYOD/RIPD | MÉDIA de processo | VÁLIDO | Lacuna futura documentada; decisão humana pendente |
| 16 | Ameaça interna e segregação | ALTA | VÁLIDO | Modelo atualizado; controles operacionais futuros |
| 17 | Testes antigos superestimavam cobertura | MÉDIA | VÁLIDO | Gate real 194/194; banco 22/22; qualidade 35/35; zero TODO/skipped |

## 1. `collaborator` ativo quebra isolamento João/Maria

**Evidência original:** `private.is_active_user()` aceitava perfil ativo; `profiles_read` combinava própria linha com usuário ativo; leituras de equipes e operações usavam esse helper. **Confronto:** [fixture](../06_TESTES_E_QUALIDADE/fixtures/metallo-0.9.8-schema.sql) contém `profiles_read` e `teams_read`; o catálogo remoto preserva essas 70 policies. A [migration 1A](../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql) cria marcador de conta pessoal, mantém seu perfil de Gestão inativo e impede ativação após registro. `my_employee_profile()` exige `auth.uid()` e vínculo ativo. **Classificação/decisão:** **VÁLIDO NA ÉPOCA / RESOLVIDO NO DESENHO LOCAL**, não no Supabase compartilhado. Não reutilizar `collaborator` como autorização pessoal. **Teste/resultado:** João/Maria sintéticos veem só o próprio DTO e não enumeram outros perfis ou funcionários no PGlite; teste passou. **Resultado posterior:** JWT/REST/PostgREST e matriz das rotas foram aprovados no laboratório; implantação remota pendente.

## 2. `create-employee` criava `collaborator` ativo sem identidade

**Evidência original e atual:** [Edge Function](../04_BANCO_E_SUPABASE/supabase/functions/create-employee/index.ts) usa `collaborator` como padrão, confirma e-mail e ativa `profiles` depois de criar Auth; não cria `epi_employees` nem vínculo pessoal. No remoto há também `admin-invite-user`, que ativa perfil da Gestão. Ambas exigem admin ativo; esse comportamento é da Gestão em testes. **Classificação/decisão:** **VÁLIDO NA ÉPOCA** como advertência contra reaproveitamento no portal. A migration local exige marcador Auth servidor `employee_portal`, registro próprio e perfil inativo; o trigger barra ativação posterior. **Teste/resultado:** admin de Gestão não passa como conta pessoal; tentativa privilegiada de ativar portal falha; testes SQL passaram. **Resultado posterior:** fluxo de provisionamento sintético dedicado e Auth real foram ensaiados no laboratório; operacionalização/implantação remota pendente. Não alterar o fluxo atual remotamente nesta rodada.

## 3. ASO no mesmo registro operacional

**Evidência original:** `aso_exam_date`/`aso_expiry_date` ficam em `epi_employees`; uma permissão operacional EPI ou `select *` futuro poderia incluir saúde. **Contraprova importante:** ativar `collaborator` sozinho **não concedia automaticamente** leitura de ASO; `epi_employees_read` depende de `can_operate('epi:write',...)`. **Classificação:** **PARCIALMENTE VÁLIDO** como risco de desenho, não vazamento automático comprovado. **Correção atual:** `my_employee_profile()` seleciona explicitamente ID, nome, profissão e equipe; não há `SELECT *` pessoal nem ASO. **Teste/resultado:** lista de colunas do DTO verificada com João/Maria; acesso direto à tabela negado em SQL local. **Resultado posterior:** REST real não expôs ASO; avaliar separar SST/saúde antes de módulos pessoais que precisem da tabela; sem migração destrutiva agora.

## 4. Revogação de identidade não revogava Auth

**Evidência:** `admin_revoke_employee_identity` local revoga vínculo, inativa perfil e grava auditoria, mas não chama Auth. [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions) e [sign out](https://supabase.com/docs/guides/auth/signout) confirmam que refresh sessions e access tokens têm semânticas distintas: access token emitido permanece válido até expirar. A referência de [admin sign out](https://supabase.com/docs/reference/javascript/auth-admin-signout) não demonstra API por simples `user_id`; [ban administrativo](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) existe, mas sua combinação com refresh exige ensaio. **Classificação:** **VÁLIDO; parcialmente mitigado**. **Teste/resultado:** mesmo sujeito JWT simulado, após revogação, recebe DTO vazio; histórico preservado. **Resultado posterior:** banco + ban Auth impediram refresh e novo login; token antigo perdeu DTO. Falha parcial entre etapas não foi simulada. Nunca pôr chave administrativa no cliente. Ver [desenho 1A](19_IDENTIDADE_COLABORADOR_MARCO_1A.md).

## 5. Conta 1:1 não bastava para identidade trabalhista

**Evidência:** unicidade histórica de `auth_user_id` já impedia mover conta de João para Maria; só nome e `verification_method` não provavam pessoa civil, e senha temporária podia circular. **Classificação:** **PARCIALMENTE VÁLIDO**: o mérito da unicidade era anterior, a conferência humana era insuficiente. **Correção atual:** vínculo exige UUID interno, nome e matrícula/identificador empresarial; mantém índice único por funcionário ativo, trilha e bloqueio de reaproveitar conta. **Teste/resultado:** nome/matrícula errados, duplicidade de conta e funcionário foram rejeitados no PGlite. **Aberto:** DP confirmar procedimento real, homônimos com segunda pessoa quando necessário, senha inicial de uso único ou convite seguro e regra formal de recontratação. O campo `verification_method` registra uma alegação do operador, não documento probatório.

## 6. `employee_work_team` e `stock_team` sem titularidade

**Evidência original/remota:** duas funções `SECURITY DEFINER` com EXECUTE para `authenticated` aceitavam UUID arbitrário sem titularidade. Retornam UUID de equipe, **não ASO** nem dados clínicos. **Classificação:** **VÁLIDO NA ÉPOCA / RESOLVIDO PARA PORTAL NO SQL LOCAL**. A migration adiciona guarda `private.is_portal_account(auth.uid())`; não serve de autorização pessoal. **Teste/resultado:** João recebe `null` ao consultar equipe de Maria; admin Gestão mantém os resultados esperados; testes passaram. **Resultado posterior:** REST/JWT local negou as consultas arbitrárias; migration continua ausente do remoto. Avaliar mover helpers para `private`/reduzir grants quando não quebrar Gestão.

## 7. `run_site_operation` inadequado para ponto

**Evidência:** [migration de obras](../04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql) aceita `p_operation_id` e `p_occurred_at` do cliente; [repositório Mobile](../02_MOBILE/lib/06_ACESSO_A_DADOS/site_operations_repository.dart) usa fila `SharedPreferences`. Isso é operação da Gestão e não há marcação de ponto nesse fluxo. **Classificação:** **VÁLIDO como risco condicionado à reutilização**, não defeito atual do REP-P inexistente. **Decisão/correção:** [contrato arquitetural](CONTRATO_GESTAO_REP_P.md) fixa API própria, tempo servidor, NSR/idempotência próprios e original aditivo. **Teste/resultado:** portal sintético não executou `run_site_operation`; ponto não foi testado porque não existe. **Aberto:** implementar/testar núcleo próprio em marcos posteriores, sem copiar fila/hora/UUID atuais.

## 8. Histórico mutável da Gestão

**Evidência:** funções `admin_delete_material_movement`, `admin_delete_asset_movement` e `admin_update_*` alteram movimentos operacionais; a migration local não remove isso. **Classificação:** **VÁLIDO como separação de domínios**, sem chamar toda correção administrativa da Gestão de bug. **Decisão:** originais REP-P futuros sem UPDATE/DELETE para trabalhador, gestor, tratamento ou admin operacional; correção aditiva e auditoria separada. **Correção/teste atual:** invariante no [contrato](CONTRATO_GESTAO_REP_P.md) e [modelo de ameaças](THREAT_MODEL_COLABORADOR_REP_P.md); não há original REP-P para testar. **Aberto:** implementar grants, trilha e testes no projeto próprio antes de ponto oficial.

## 9. Migrations e esquema local/remoto divergentes

**Evidência:** 33 entradas remotas, 23 arquivos locais; doze pares por nome têm SQL executável equivalente, mas 21 históricos só remotos e nove EPI só locais. O [catálogo remoto sanitizado](../06_TESTES_E_QUALIDADE/fixtures/supabase-remoto-catalogo-20260926.json) e o [comparador](../06_TESTES_E_QUALIDADE/comparar-schema-remoto-local.mjs) mostram 70 policies compartilhadas iguais, mas 55 índices remotos ausentes no fixture, três gatilhos reais de Auth ausentes, 390 grants de tabela remotos ausentes e 49/13 diferenças de EXECUTE `anon`/`authenticated` em funções. Dois corpos comuns diferem porque a migration 1A alterou os helpers localmente. **Classificação:** **VÁLIDO**. **Teste/resultado:** comparador executou e registrou diferenças; não é prova de equivalência. **Resultado posterior:** baseline descartável, schemas expostos e testes end-to-end concluídos no laboratório; aplicação remota exige plano próprio. Não aplicar 1A remotamente; detalhes em [reconciliação](20_RECONCILIACAO_MIGRATIONS_E_TIPOS.md).

## 10. Dois projetos sem contrato de sincronização

**Evidência:** REP-P dedicado é apenas preferência; nenhum fluxo entre projetos existia. Mudança de equipe às 06:55 e entrega atrasada torna o contexto ambíguo. **Classificação:** **VÁLIDO NA ÉPOCA / DESENHO DOCUMENTADO AGORA**, implementação ainda aberta. **Correção:** [contrato](CONTRATO_GESTAO_REP_P.md) define envelope `source_id/event_id/entity_id/entity_version/schema_version/effective_at/produced_at/checksum`, outbox/inbox, duplicata, ordem, retry, falha, snapshot e reconciliação pós-restore. Ponto consulta snapshot local, sem Gestão síncrona. **Teste/resultado:** revisão documental apenas; não há dois projetos/lab integrado. **Aberto:** limites de atraso e contingência dependem de DP/jurídico/operação.

## 11. Backup/restore real não demonstrado

**Evidência:** [ensaio](../06_TESTES_E_QUALIDADE/ensaio-restauracao-sintetica.test.mjs) exporta e restaura duas instâncias PGlite com dados sintéticos; não cobre Supabase Auth, Storage, configuração, integrações ou segredos. **Classificação:** **VÁLIDO**; severidade futura não deve ser transportada como incidente atual. **Correção:** [plano de recuperação](PLANO_DE_BACKUP_E_RECUPERACAO.md) separa DB, Auth/configuração, Storage e hashes. **Teste/resultado:** ensaio sintético passou na bateria; não é RTO/RPO oficial. **Aberto:** ensaio integral em destino isolado antes de uso real, sem bloquear 1A local.

## 12. Catálogo `SECURITY DEFINER` tentável pelo portal

**Evidência:** remoto tem 34 funções `public` `SECURITY DEFINER` com EXECUTE para `authenticated`, além de funções invoker. **Contraprova:** **34 funções não são 34 vulnerabilidades**; a [auditoria RPC](21_AUDITORIA_SECURITY_DEFINER.md) encontrou guardas de admin/permissão em muitas. O risco é a conta pessoal compartilhar a role SQL `authenticated` e poder tentar as rotas. **Classificação:** **PARCIALMENTE VÁLIDO**. **Correção atual:** perfil de Gestão inativo, helpers específicos guardados, DTO próprio e [inventário de 39 RPCs públicas tentáveis](25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md). **Teste/resultado:** chamadas SQL de admin/operacional e dashboard foram negadas/vazias nos cenários focados; não houve execução de todas as RPCs com JWT real. **Resultado posterior:** matriz REST/RPC completa passou no laboratório; considerar BFF/grants menores em evolução futura sem quebrar Gestão.

## 13. Offline, relógio, replay, GPS e app adulterado

**Evidência:** fila/horário/UUID do cliente existem na Gestão; REP-P não existe. **Classificação:** **VÁLIDO como requisito futuro**, não vulnerabilidade presente no ponto. **Correção atual:** [modelo de ameaças](THREAT_MODEL_COLABORADOR_REP_P.md) e [contrato](CONTRATO_GESTAO_REP_P.md) registram tempo servidor, não copiar offline, idempotência, GPS como sinal, revisão humana, Play Protect diferente de Play Integrity e RIPD/BYOD prévios. **Teste/resultado:** nenhuma prova dinâmica de ponto possível nesta etapa. **Aberto:** implementação, testes de replay/concorrência e política de contingência aprovada.

## 14. Comprovante, AFD, AEJ, espelho, ICP e Storage ausentes

**Evidência:** matriz de conformidade marca itens como não iniciados; remoto tem zero buckets e não há REP-P. **Classificação:** **VÁLIDO como gate futuro**, não bug do Marco 0. **Decisão:** não criar artefatos simulados para “fechar” achado. **Correção/teste atual:** [matriz](MATRIZ_DE_CONFORMIDADE_REP_P.md) e [roadmap](22_AMBIENTE_REP_P_E_ROADMAP.md) mantêm requisitos e especialistas; nenhum teste de conformidade foi alegado. **Aberto:** verificar normas/leiautes vigentes, NSR, comprovantes, assinatura/ICP, INPI e Storage nos marcos apropriados antes de chamar o produto de REP-P.

## 15. LGPD, GPS, foto, biometria e RIPD

**Evidência:** não há coleta real de ponto/GPS/foto no novo produto; base, retenção, BYOD e RIPD dependem da empresa. **Classificação:** **VÁLIDO como lacuna de processo futura**. **Correção atual:** [riscos](REGISTRO_DE_RISCOS_JURIDICOS.md), [matriz](MATRIZ_DE_CONFORMIDADE_REP_P.md) e [modelo de ameaças](THREAT_MODEL_COLABORADOR_REP_P.md) registram minimização, inventário, revisão jurídica/privacidade, canal de contestação e nenhuma punição automática por GPS. **Teste/resultado:** revisão documental; não há coleta a ensaiar. **Aberto:** decisões da empresa/especialistas antes de dados reais, sem travar identidade local.

## 16. Ameaça interna de administrador/encarregado

**Evidência:** o vínculo 1A é aprovado por um admin ativo; REP-P/tratamento/ICP ainda não existem. Acumular essas capacidades futuramente ampliaria fraude/alteração de prova. **Classificação:** **VÁLIDO como risco arquitetural**, não exploração atual. **Correção atual:** [modelo de ameaças](THREAT_MODEL_COLABORADOR_REP_P.md) distingue trabalhador malicioso, admin/encarregado, erro DP, conta/token comprometidos, `service_role`, migration, sync, restore e ICP; [contrato](CONTRATO_GESTAO_REP_P.md) separa original/tratamento/identidade. **Teste/resultado:** auditoria de desenho, nenhum controle operacional real ensaiado. **Aberto:** dual control em vínculo sensível, DP distinto de tratamento, custódia ICP e auditoria independente.

## 17. Testes antigos davam falsa sensação de cobertura

**Evidência original:** três TODO, fixture antigo, ausência de JWT/PostgREST e contas pessoais apenas inativas na Gestão. **Confronto atual:** [testes 1A](../06_TESTES_E_QUALIDADE/identidade-colaborador-banco.test.mjs) têm João/Maria com **vínculo ativo** e perfil de Gestão deliberadamente inativo, DTO próprio, bloqueios, token antigo simulado e regressão básica; os TODO foram eliminados. O [comparador de catálogo](../06_TESTES_E_QUALIDADE/comparar-schema-remoto-local.mjs) mostra que o fixture ainda diverge fortemente em grants/Auth. **Classificação:** **VÁLIDO NA ÉPOCA / TODO RESOLVIDOS AGORA; COBERTURA FINAL AINDA ABERTA**. **Teste/resultado final desta rodada:** `pnpm test:db`: 22/22; `pnpm test:quality`: 35/35; zero falhas/TODO/skipped. **Resultado posterior:** JWT assinado, Auth, REST/PostgREST, refresh e superfície inventariada foram exercitados no laboratório com 194/194 aprovações.

## Correções de interpretação incorporadas

1. `employee_work_team` retorna equipe, não ASO. ASO exige outro caminho de leitura/autorização.
2. 34 RPCs privilegiadas acessíveis a `authenticated` não equivalem a 34 vulnerabilidades; cada guarda deve ser verificada.
3. Snapshots com RLS sem policy podem estar corretamente fechados; os schemas de snapshot não têm USAGE para `anon`/`authenticated` no catálogo observado.
4. Proteção nativa de senha vazada indisponível no plano Free é limitação de plano, não CVE; planejar controle de senha/MFA sem afirmar vulnerabilidade específica.
5. As lacunas de REP-P futuro não congelam o trabalho **local** de identidade/RLS do Marco 1A.
6. `epi_employees.created_by` é o cadastrador e não vínculo entre conta Auth e trabalhador.

## Decisão histórica anterior à correção de rede

**SUPERADO pelas evidências do relatório 28 e pelo isolamento A comprovado posteriormente.** O texto a seguir foi preservado como registro da restrição anterior; não é decisão vigente. O parecer final e a decisão atual estão no relatório30.

> **Marco 0: FECHADO TECNICAMENTE.** Diagnóstico, 17 achados, reconciliação e laboratório com Auth/REST reais foram concluídos no escopo técnico local. **Marco 1A: GATE FUNCIONAL APROVADO NO LABORATÓRIO; FECHAMENTO FORMAL PENDENTE DA REDE**, sem implantação remota. João e Maria foram exercitados por JWT real/PostgREST nas rotas inventariadas; nenhuma vulnerabilidade crítica/alta de identidade ficou aberta no ambiente candidato. A restrição de portas ainda não está comprovadamente mitigada e impede nova inicialização da pilha pelo revisor automático. O Supabase compartilhado não foi modificado. A prévia 1B é apenas visual; ponto, requisitos legais do REP-P, recuperação integral e liberação da empresa são decisões posteriores.
