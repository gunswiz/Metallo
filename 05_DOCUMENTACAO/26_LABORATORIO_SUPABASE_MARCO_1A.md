# Laboratório Supabase descartável — Marco 1A

## Atualização vigente — 27/09/2026

**27/09/2026 — MARCO 1B — FUNCIONAL EM LABORATÓRIO.** Fechamento formal autorizado pelo responsável nesta conversa após aprovação manual da interface atual, incluindo cores e logo Metallo. Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados em laboratório. Documento vigente do fechamento: relatório27. Não é autorização de implantação ou publicação.

O parecer original **PARECER_AUDITORIA_T15_REVISAO_FINAL_20260927.docx**, preservado no laboratório, aceitou o fechamento técnico local do T15 sem novo crítico/alto. O responsável autorizou posteriormente o **Marco1B funcional exclusivamente local com Auth do laboratório**. Marco0 técnico e Marco1A/T05/T15 permanecem concluídos no limite auditado; nenhuma fundação SQL foi alterada nesta rodada. A implementação, provas, pacote1B e pendências estão no [relatório27 vigente](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). As seções abaixo são histórico T15 e anteriores; proibições antigas de Auth1B e contagens Web67/71 referem-se àquelas fotografias. Remoto e produção continuam não autorizados.


**Registro histórico anterior à autorização Auth1B (não é o estado atual):** Marco0 fechado tecnicamente; base412 do1A encerrada em laboratório; núcleo pessoal da delta547 aceito pelo parecer. T-15 com critérios locais comprovados e gate **682/682**, então aguardando nova revisão independente. Limites e decisões atuais nos relatórios27 e30; não interpretar o limite histórico de1B somente visual como estado vigente.

**Rodada atualT15:**682/682 reais,31/31 banco,44/44 qualidade,13/13 prévia,67/71 Web (mesmas falhas), replay incluindo a quarta migration aprovado. T-15 anterior já era negado pela RLS transitiva no ensaio real; adicionadas quatro guardas explícitas sem alterar can_operate/DTO. Duas conexões concorrentes e deliver_epi/close_epi exercitados. Detalhes no relatório30. As seções abaixo preservam o contexto histórico de reconstrução; números547 referem-se à rodada anterior.

## Ambiente

| Item | Confirmação |
| --- | --- |
| WSL | Versão 2.7.14.0; distribuição padrão `docker-desktop` em WSL 2. |
| Docker | Desktop 4.92.0, Engine 29.8.0 ativo, containers Linux, 16 CPUs e 8.277.094.400 bytes de memória disponíveis ao daemon no novo ensaio. |
| Windows | 16.295 MiB de RAM total; 5.868 MiB livres na leitura da primeira rodada; nova leitura em auditoria-final/ambiente.json. |
| CLI do projeto | Supabase 2.117.0, sem reinstalação ou atualização. |
| Pilha local | PostgreSQL 17.6, Auth, PostgREST, Storage e Edge Runtime iniciaram. API `http://127.0.0.1:54321`, banco `127.0.0.1:54322`, Studio `http://127.0.0.1:54323`. |

O [script de início](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/iniciar-laboratorio.ps1) valida CLI, Docker Linux, contexto local, ausência de vínculo remoto e proteção de rede. A prévia visual 1B foi criada em rodada posterior; continua sem Auth real do produto, ponto ou projeto REP-P pago.

**Rede — situação A comprovada em 26/09/2026:** após autorização explícita para o alcance global da opção oficial **Docker Desktop → Port binding behavior → Localhost only**, foi aplicado `PortBindingBehavior=local-only-port-binding` no arquivo de configuração documentado do Desktop, com cópia anterior preservada e reinício. A CLI 2.117.0 permaneceu inalterada. As cinco portas 54321/54322/54323/54324/54327 passaram a escutar **somente 127.0.0.1 e ::1**, tanto nos bindings efetivos Docker quanto nos listeners Windows. Não houve alteração de firewall, Defender, rede física ou arquivos internos da CLI.

O [ensaio anterior](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/teste-rede-local-20260926.json) permitia acesso por 192.168.0.3 a partir de outro container, apesar da regra de firewall. O [ensaio corrigido](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-final/rede-depois.json) passou **8/8**: loopback IPv4/IPv6 acessível nas cinco portas, Auth health HTTP200, IP Ethernet inacessível pelo host e pela rede Docker separada; a sonda alcançou o servidor sintético de controle. Firewall permaneceu ativo. Não houve segunda máquina física da LAN; esse limite permanece explícito. A conclusão A decorre do bind real, não só da existência de firewall. A configuração afeta novos containers de outros projetos, alcance autorizado pelo responsável.

O iniciador agora bloqueia a partida antes de criar containers sem a restrição Localhost only, e para a pilha se os bindings/listeners não forem exclusivos de loopback. O firewall existente permanece defesa complementar. A prova foi repetida após servir as Edge Functions. Consulte a [consolidação final e evidências](28_PACOTE_FINAL_AUDITORIA_MARCOS_0_1A_1B.md) para reprodução, reversão, alcance e limites.

**Estado final:** pilha parada com volumes preservados; nenhum container do laboratório ou das sondas ativo e **zero listeners** nas portas 54320–54329 e 8083, conforme [estado-final.json](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/auditoria-final/estado-final.json). Após encerrar o laboratório, a prévia visual foi iniciada separadamente em 127.0.0.1:3101 para revisar a indicação Sem equipe atribuída. Nenhum modo Auth foi ativado.

## Baseline e migration

Os 33 SQLs históricos do remoto em [historico-remoto](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/historico-remoto/) passaram 33/33 hashes; as 57 funções efetivas passaram 57/57 hashes normalizados. Foram aplicados apenas ao Postgres local, intercalando nove migrations EPI ausentes do histórico exportado. O seed genérico de kits exigia `auth.uid()` antes de existir usuário, então somente sua estrutura, policies e grants foram aplicados. Dois detalhes do catálogo efetivo ausentes no histórico foram ajustados somente no laboratório: default de `epi_professions.uniform_color` e corpo de `set_epi_employee_items`.

A [comparação pré-1A](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/comparacao-laboratorio-pre1a.json) coincidiu nas classes de aplicação: 31 relações, 274 colunas, 169 constraints, 126 índices, 70 policies, 17 triggers, 57 funções, cinco extensões e 420 grants de tabela. Houve zero diferenças de corpo nas 57 funções. Diferenças restantes são schemas de infraestrutura e duas FKs internas de versões diferentes do Auth. A exposição Data API foi confirmada separadamente por HTTP somente leitura abaixo.

## Schemas expostos pela Data API

GET `teams?select=id&limit=0` com chave pública e `Accept-Profile` foi usado sem retornar linhas nem alterar configuração. A resposta `PGRST106` para um nome inexistente enumerou os schemas permitidos. [Evidência remota](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/schemas-expostos-remoto-20260926.json) e [evidência local](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/schemas-expostos-local.json): **ambos expõem `public` e `graphql_public`**. `private`, `auth` e `storage` retornaram HTTP 406 `PGRST106` em ambos. Em `public`, a rota de teste retornou HTTP 401/42501 por falta de `SELECT` anônimo; em `graphql_public`, HTTP 404 `PGRST205` porque `teams` não existe ali. Esses erros confirmam aceitação do schema, não leitura de dados. **Diferença observada: nenhuma na lista de schemas expostos.** O cliente pessoal usa somente `public.my_employee_profile()`; a migration 1A não expõe `private`.

A [migration 1A](../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql) foi aplicada **somente no laboratório**. A [comparação pós-1A](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/comparacao-laboratorio-post1a.json) não mostrou objetos de aplicação remotos ausentes. Os extras são os três objetos de identidade e dependências da 1A: 24 colunas, 19 constraints, dez índices e seis FKs. Após T-05, o total adicional é de seis triggers e dez funções; três policies foram modificadas especificamente e a coluna team_id passou a aceitar NULL. `stock_team` e `employee_work_team` têm corpos alterados para bloquear consultas de ID arbitrário do portal.

## Provas reais da rodada anterior e complementação

O [executor](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/executar-provas-reais.mjs) criou João, Maria, admin e conta revogada com e-mails `.invalid`, EPI e entregas sintéticos. O resultado anterior preservado em auditoria-complementar/gate194-anterior.json tem **194/194** verificações aprovadas, 60 leituras nas 30 tabelas e 43 assinaturas RPC, sem armazenar tokens, senhas ou chaves.

| Área | Evidência |
| --- | --- |
| Auth/JWT | Inscrição pública HTTP 422; contas criadas com ticket administrativo; JWT ES256 verificado contra JWKS; JWT adulterado rejeitado pelo PostgREST com HTTP 401. |
| João e Maria | Cada um recebeu só o próprio DTO, sem ASO. Tentativas cruzadas, filtros por ID alheio, argumento de ID na RPC pessoal e tabela privada não vazaram dados. |
| 30 tabelas REST | 60 leituras João/Maria: apenas a própria linha de `profiles`; demais tabelas retornaram zero linhas. |
| 43 RPCs | Guardas retornaram negação identificada; helpers permitidos retornaram falso ou nulo; RPC pessoal retornou só João. Hashes das 30 tabelas públicas e três privadas permaneceram iguais. A sobrecarga de dois argumentos de `create_team_admin` deu ambiguidade HTTP 300 sem executar; `set_updated_at` é trigger e não rota chamável. |
| Edge Functions | Fonte de `admin-invite-user` e `delete-employee` lida do remoto via conector somente leitura e copiada ao laboratório; `create-employee` veio do repositório. As três negaram João com HTTP 403 e o token antigo revogado com HTTP 401. A nova `revoke-portal-account`, exclusiva do laboratório, negou João com HTTP 403, revogou a conta sintética por HTTP 200 com JWT admin e aceitou repetição sem novo evento de auditoria. Servidas na mesma rede Docker local do Auth. |
| Gestão | Admin leu perfis, equipes, obras, itens, estoque, EPI, entregas e pedidos; `is_active_admin()` retornou true; criação e edição de equipe sintética por RPC funcionaram. |

**Revogação corrigida no laboratório:** a [prova anterior](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/resultado-revogacao-antes-correcao.json) mostrava que a RPC cortava o DTO, mas refresh e novo login ainda funcionavam. A função SQL passou a devolver o usuário Auth correspondente e aceitar repetição do mesmo motivo sem novo evento. A [Edge Function local de revogação](../04_BANCO_E_SUPABASE/laboratorio-marco-1a/supabase/functions/revoke-portal-account/index.ts) revoga primeiro no banco e depois aplica ban administrativo no Auth sem enviar chave de serviço ao cliente. A repetição real retornou HTTP 200 sem duplicar auditoria; token antigo perdeu o DTO imediatamente, refresh e novo login retornaram HTTP 400, enquanto refresh de João ativo retornou HTTP 200. Na prova anterior de194, a falha Auth não havia sido injetada. Essa lacuna foi superada pelo P3:502 após SQL, DTO vazio, refresh intermediário200 sem dados, retry200 e refresh/login400, sem duplicar auditoria.

Após a correção, `pnpm test:db` passou **22/22** e `pnpm test:quality` passou **35/35**, sem falhas, skips ou TODO. O material remoto foi apenas consultado; a fonte das duas Edge Functions recuperadas corresponde à versão lida em 26/09/2026, sem deploy.

## Complementação após o parecer final e decisão de equipe opcional

O [relatório 30](30_CONFRONTO_AUDITORIA_FINAL_E_FECHAMENTO_1A.md) registra a base412 auditada, a fotografia445 preservada e a execução atual **547/547**. A-13=68, 34 por pessoa: João e Maria percorrem os quatro estados com JWT existente, novo login, refresh, whitelist e negação cruzada. P3=13 inclui revogação de João sem equipe; Gestão T-05/T-10=68. A cobertura anterior445 se concentrava nos estados próprios de Maria. O relatório lista nominalmente os34 checks antigos sem atribuir cobertura retrospectiva.

**Decisão de produto aprovada em 26/09/2026:** funcionário ativo com identidade/vínculo pessoal ativo mantém acesso ao portal sem equipe. Equipe inativa, ausente ou removida produz `team_name=null`, apresentado como **Sem equipe atribuída**. Não altera identidade, login ou auditoria. A revogação pessoal e o funcionário inativo continuam negando o DTO.

A migration `20260926213000_portal_profile_optional_team.sql` tornou team_id nullable e preservou o DTO com LEFT JOIN. A migration posterior `20260926224000_unassigned_employee_management_scope.sql` corrigiu três policies e guardou escrita de entregas/pedidos; can_operate global e DTO pessoal ficaram idênticos. Ambas somente locais, mantendo FKs e a fundação histórica. DELETE de equipe com movimento falhou por FK. Replay dos42 SQLs baseline+dois ajustes+1A+dois deltas e idempotência passaram em PostgreSQL real; seis categorias de catálogo idênticas, banco temporário removido. Infraestrutura Auth/Storage foi aproveitada via schema-only, sem restore de dados. Evidências em replay-migrations.json e mapa-can-operate.json.

**SUPERADA EM 26/09/2026 PELA DECISÃO DE EQUIPE OPCIONAL:** a regra antiga de ocultar DTO por equipe inativa. Na Gestão, equipe NULL não amplia acesso de não-admin.

Banco **28/28**, qualidade **41/41**, prévia **13/13**, Web **67/71** com as mesmas quatro falhas da Gestão. Rede **8/8**, pilha encerrada sem listeners, firewall ativo. O resultado antigo está preservado no pacote auditado anterior; as evidências correntes são atualizadas nos mesmos arquivos, sem criar relatórios duplicados.

## Decisão

**Estado vigente — 27/09/2026:** Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados estritamente em laboratório (base682/682); **MARCO 1B — FUNCIONAL EM LABORATÓRIO**, com interface aprovada e fechamento expressamente autorizado pelo responsável. Decisão, baseline e pendências no [relatório27](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO, PONTO OFICIAL OU REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Os estados/contagens inferiores deste documento são históricos, salvo seção explicitamente vigente.

Fontes: [Supabase local](https://supabase.com/docs/guides/local-development), [Edge Functions locais](https://supabase.com/docs/guides/functions/development-environment), [sessões Auth](https://supabase.com/docs/guides/auth/sessions), [administração de usuários](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

