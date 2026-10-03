# Fechamento das pendências do Marco 0 — 25–26/09/2026

**Estado vigente — 27/09/2026:** Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados estritamente em laboratório (base682/682); **MARCO 1B — FUNCIONAL EM LABORATÓRIO**, com interface aprovada e fechamento expressamente autorizado pelo responsável. Decisão, baseline e pendências no [relatório27](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO, PONTO OFICIAL OU REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Os estados/contagens inferiores deste documento são históricos, salvo seção explicitamente vigente.

## Registro histórico das rodadas anteriores — superado quanto aos estados de marco

As avaliações antigas abaixo foram preservadas. Não representam rede pendente nem reabertura dos marcos; a decisão vigente está no relatório30.

## Adendo de 26/09/2026 após as diretrizes de auditoria

As seções históricas abaixo registram o estado anterior ao novo ensaio; para o estado corrente consultar [identidade 1A](19_IDENTIDADE_COLABORADOR_MARCO_1A.md), [tratamento dos 17 achados](24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md), [reconciliação](20_RECONCILIACAO_MIGRATIONS_E_TIPOS.md) e [inventário do portal](25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md). Agora há **sete testes SQL ativos, sem TODO**, para João, Maria, administrador e conta revogada; DTO pessoal sem ASO; guarda local dos helpers de equipe; e trigger contra ativação de conta portal na Gestão. Os 17 achados foram classificados, mas **Marco 0 e 1A continuam abertos**: faltam laboratório fiel, Auth/JWT/REST/PostgREST, refresh sessions e varredura dinâmica completa das rotas. Nada foi publicado ou aplicado no remoto. O contrato Gestão↔REP-P e o modelo de ameaças sanitizado foram versionados como proposta, sem implementar ponto.

**Resultado, atualizado em 26/09/2026:** o diagnóstico do Marco 0 foi preservado e as pendências foram tratadas até o limite seguro de trabalho local. **Marco 0 ainda não está fechado definitivamente**: os 17 achados foram classificados, porém falta equivalência do esquema remoto, prova de isolamento Auth/REST, recuperação integral futura e decisões humanas/jurídicas. **Marco 1A avançou na fundação local de identidade**. Nenhuma mudança de banco remoto, conta, projeto, gasto, publicação ou ponto oficial foi realizada. O responsável esclareceu que **o Metallo não funciona na empresa de fato**: todos os registros atuais do projeto conectado — inclusive histórico, movimentações e relatórios de EPI — são de teste. Os 10 funcionários e 3 perfis também são de teste.

Assim, os riscos trabalhistas de perda/alteração de marcações **ainda são futuros**, pois não há registros oficiais de ponto nem operação empresarial nesse sistema. A cautela com migrations preserva o ambiente compartilhado de desenvolvimento, o trabalho já feito e a validade dos ensaios; não pressupõe que ali existam dados empresariais oficiais.

## 1. Conta não ligada ao funcionário

**Problema:** `auth.users`/`profiles` não apontam para `epi_employees`. **Risco:** associar por nome/e-mail/equipe poderia atribuir dados a outra pessoa. **Solução escolhida e por que:** vínculo explícito, único por conta, único por funcionário ativo, com confirmação humana, datas, revogação e auditoria; preserva o cadastro operacional existente. **Alterações:** migration [employee_identity_foundation](../04_BANCO_E_SUPABASE/supabase/migrations/20260925120000_employee_identity_foundation.sql) e [desenho 1A com diagrama/matriz](19_IDENTIDADE_COLABORADOR_MARCO_1A.md). **Testes:** associação, bloqueio de não administrador, duplicidade, história e revogação em PGlite. **Status:** **parcialmente resolvido**; migration somente local, nenhuma identidade real vinculada.

## 2. Políticas operacionais não isolam João de Maria

**Problema:** perfil ativo pode ler dados de Gestão pelas políticas existentes (`profiles_read`, `private.is_active_user`, equipes e outras). `epi_employees` contém ASO. **Risco:** ativar portal usando o papel atual pode expor perfis, dados operacionais ou de saúde de colegas. **Solução escolhida e por que:** conta pessoal com vínculo próprio e perfil de Gestão inativo; DTO mínimo derivado de `auth.uid()` e identidade ativa, com trigger contra ativação no fluxo de Gestão. **Alterações:** SQL local e matriz no [Marco 1A](19_IDENTIDADE_COLABORADOR_MARCO_1A.md); nenhum grant de tabela privada a cliente. **Testes:** João/Maria com vínculo ativo e conta revogada em SQL/RLS, sem TODO; Auth/REST/JWT real ainda não ensaiados. **Status:** **parcialmente resolvido**; critério de todas as rotas no ambiente fiel ainda não comprovado, logo UI/login pessoais bloqueados.

## 3. `SECURITY DEFINER`, senha vazada e snapshots

**Problema:** 34 RPCs públicas privilegiadas executáveis por autenticados; advisor também aponta proteção contra senhas vazadas desligada e três tabelas com RLS sem policy. **Risco:** funções com guarda inadequada poderiam furar RLS; senha vazada facilita invasão; policy criada só para silenciar alerta poderia abrir snapshots. **Solução escolhida e por que:** [auditoria individual](21_AUDITORIA_SECURITY_DEFINER.md) de grants, identidade, papel, equipe, escrita e `search_path`; manter snapshots sem acesso. `employee_work_team`/`stock_team` exigem revisão antes do portal; roteador `run_site_operation` não serve ao ponto. **Alterações:** relatório, sem alterar funções remotas. **Testes:** inspeção estática/catálogo remoto e testes locais dos RPCs novos; não houve exploração dinâmica das 34 RPCs. Proteção de senha vazada nativa requer Pro segundo [Supabase](https://supabase.com/docs/guides/auth/password-security); plano atual Free, nenhuma ativação/custo. **Status:** auditoria **resolvida como inventário e classificação**, ajustes **pendentes**; senhas **aguardam decisão de plano**, snapshots **mantidos bloqueados**.

## 4. Histórico de migrations e tipos

**Problema:** 33 migrations remotas versus 23 arquivos locais; nove nomes iguais com versões diferentes, EPI local sem histórico remoto, arquivo operacional local ainda não aplicado. Tipos TypeScript estão incompletos para obras e alterados por outro trabalho. **Risco:** aplicação cega pode duplicar ou danificar Gestão; regeneração direta pode apagar mudanças manuais. **Solução escolhida e por que:** [relatório de reconciliação](20_RECONCILIACAO_MIGRATIONS_E_TIPOS.md) com listas exatas, correspondências observadas e preflight de SQL/schema; gerar tipos somente em arquivo temporário após isso. **Alterações:** relatório e migration nova local; nenhum `db push`, reset ou sobrescrita de tipos. **Testes:** comparação de histórico/metadados, ensaio da migration em esquema local; `pnpm test:quality` passou. **Status:** **parcialmente resolvido**; equivalência do SQL remoto e tipos finais pendentes.

## 5. Backup sem recuperação comprovada

**Problema:** a cópia anterior é de código; não mostra recuperação de PostgreSQL/Storage/Auth/secrets. **Risco:** perda ou inconsistência sem retorno mensurado; backup do banco não contém bytes do Storage. **Solução escolhida e por que:** [plano de backup e restauração](PLANO_DE_BACKUP_E_RECUPERACAO.md) por componente, dono, frequência, retenção, RTO/RPO, restore isolado. **Alterações:** plano e [ensaio sintético local](../06_TESTES_E_QUALIDADE/ensaio-restauracao-sintetica.test.mjs). **Testes:** duas instâncias PGlite, 2/2 registros iguais após snapshot/restauração, primeira medição 2.918 ms; não é ensaio completo Supabase. **Status:** plano **resolvido**, recuperação real **pendente**.

## 6. Fronteira e custo do REP-P

**Problema:** separar credenciais e originais implica custo/integração; mesmo schema mantém blast radius da Gestão. **Risco:** migração, função ou credencial de Gestão alcançar ponto oficial; projeto Free pode pausar e não oferece backup automático diário. **Solução escolhida e por que:** [comparação A/B e roadmap](22_AMBIENTE_REP_P_E_ROADMAP.md) prefere projeto dedicado, sujeito a orçamento, DPA, região, disponibilidade e recuperação. **Alterações:** análise, nenhum projeto criado. **Testes:** leitura de plano conectado e documentação oficial atual; sem ensaio de dois projetos. **Status:** **aguardando decisão** quando houver custo/criação; nenhum uso oficial autorizado.

## 7. Conformidade e revisão independente

**Problema:** dados do empregador/estabelecimento, CCT/ACT, retenção, localização, leiautes e responsabilidades legais não estão validados. O parecer SuperGrok foi recebido e confrontado, mas não substitui ensaios Auth/REST nem revisão jurídica. **Risco:** desenvolvimento técnico ser confundido com autorização legal ou prova de conformidade. **Solução escolhida e por que:** conservar [riscos](REGISTRO_DE_RISCOS_JURIDICOS.md), [matriz](MATRIZ_DE_CONFORMIDADE_REP_P.md), [modelo de ameaças versionado](THREAT_MODEL_COLABORADOR_REP_P.md), [pacote SuperGrok](18_PACOTE_REVISAO_MARCO_0.md) e [tratamento dos 17 achados](24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md). **Alterações:** roadmap 0→1A→1B→2→3→4→5→6→liberação; sem iniciar ponto. **Testes:** `pnpm test:quality` **35 passaram, 0 falhas, 0 TODO**; `pnpm test:db` **22 passaram, 0 falhas, 0 TODO**. **Status:** **requer especialistas**; não há atestado de conformidade.

## Bloqueios objetivos e próximo passo

1. Obter SQL histórico e diff efetivo do remoto antes de aplicar qualquer migration; preservar trabalho paralelo e reconciliar `unify_existing_operations`.
2. Verificar a fronteira pessoal em **todas** as tabelas/RPCs de Gestão em ambiente descartável fiel ao remoto, com JWT/Auth, REST/PostgREST, RPC e refresh; confirmar ausência de ASO e acesso cruzado. Os testes SQL locais foram completados, mas não satisfazem sozinhos este gate. Só então criar UI administrativa/login e disponibilizar prévia local para aprovação.
3. Implantar exportação/backup independente e ensaio integral em destino isolado, inclusive Storage e secrets de teste; medir metas reais.
4. Usar a classificação dos 17 achados como roteiro de correção e repetir auditoria após o laboratório fiel. Revisão DP, jurídico trabalhista e privacidade antes de REP-P oficial.
5. Decidir custo/projeto dedicado e eventuais recursos Pro somente quando houver necessidade concreta e autorização. Publicação de cada mudança depende de prévia e aprovação própria.

**Conclusão simples:** o alicerce do vínculo foi construído e testado localmente; a porta do aplicativo do colaborador permanece fechada até provar que uma conta ativa vê somente o próprio funcionário. O Marco 0 pode ser revisto agora, mas ainda não recebe a marca “fechado”.

