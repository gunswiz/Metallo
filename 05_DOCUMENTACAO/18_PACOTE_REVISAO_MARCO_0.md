# Pacote de revisão independente — Marco 0

**Estado vigente — 27/09/2026:** Marco0 fechado tecnicamente; Marco1A/T05/T15 concluídos e auditados estritamente em laboratório (base682/682); **MARCO 1B — FUNCIONAL EM LABORATÓRIO**, com interface aprovada e fechamento expressamente autorizado pelo responsável. Decisão, baseline e pendências no [relatório27](27_PREVIA_VISUAL_COLABORADOR_MARCO_1B.md). **NÃO IMPLANTADO NO SUPABASE REMOTO; NÃO LIBERADO PARA FUNCIONÁRIOS REAIS; NÃO É PRODUÇÃO, PONTO OFICIAL OU REP-P; NÃO AUTORIZA PUBLICAÇÃO.** Os estados/contagens inferiores deste documento são históricos, salvo seção explicitamente vigente.

## Registro histórico das rodadas anteriores — superado quanto aos estados de marco

As avaliações antigas abaixo foram preservadas. Não representam rede pendente nem reabertura dos marcos; a decisão vigente está no relatório30.

**Adendo de 26/09/2026:** o responsável forneceu os 17 achados do SuperGrok. [O tratamento formal](24_TRATAMENTO_AUDITORIA_SUPERGROK_MARCO_0.md) confronta todos com o estado atual. A fundação local do Marco 1A foi revisada: [identidade](19_IDENTIDADE_COLABORADOR_MARCO_1A.md), [threat model versionado](THREAT_MODEL_COLABORADOR_REP_P.md), [contrato proposto](CONTRATO_GESTAO_REP_P.md), [auditoria RPC](21_AUDITORIA_SECURITY_DEFINER.md) e [superfície do portal](25_INVENTARIO_SUPERFICIE_PORTAL_MARCO_1A.md). Os antigos TODO foram eliminados, mas o Marco 1A continua pendente de laboratório fiel ao remoto e testes Auth/REST/JWT.

**Atualizado em:** 26/09/2026. **Objetivo:** tentar refutar o diagnóstico e a arquitetura antes de qualquer implementação de ponto. **Situação:** parecer original recebido e classificado; gates de esquema/Auth ainda abertos. Segundo o responsável, o Metallo ainda não é usado na empresa: **todos os dados existentes no projeto conectado, inclusive históricos, movimentações e relatórios de EPI, são de teste**. Os 10 cadastros de funcionários são de teste e os 3 perfis são contas usadas pela administração para testar.

| Item | Material / resultado |
| --- | --- |
| Objetivo, arquitetura e fluxos | [Diagnóstico e proposta](17_MARCO_0_COLABORADOR_REP_P.md), incluindo diagrama e roadmap. |
| Arquivos produzidos neste marco | Este pacote, diagnóstico, [registro de riscos](REGISTRO_DE_RISCOS_JURIDICOS.md), [matriz](MATRIZ_DE_CONFORMIDADE_REP_P.md) e modelo de ameaças salvo como artefato permanente Codex Security. Mudanças locais preexistentes em Web/Mobile/migration não pertencem ao Marco 0. |
| Modelo de ameaças | [Versão sanitizada no repositório](THREAT_MODEL_COLABORADOR_REP_P.md), acessível à revisão externa. |
| Migrations e schema | [Relatório local/remoto](20_RECONCILIACAO_MIGRATIONS_E_TIPOS.md): 33 entradas remotas e 23 arquivos locais, inclusive migration de identidade **somente local**, não aplicada. `20260912190000_unify_existing_operations.sql` não consta no histórico remoto. |
| Auth, permissões e RLS | [Identidade 1A](19_IDENTIDADE_COLABORADOR_MARCO_1A.md): vínculo 1:1 e DTO mínimo auditados no banco local; conta pessoal mantém perfil de Gestão inativo. Login/consulta pessoal no app não habilitados. |
| Funções privilegiadas | [Auditoria de 46 `SECURITY DEFINER`](21_AUDITORIA_SECURITY_DEFINER.md): 34 RPCs públicas acessíveis a `authenticated`, 3 helpers privados, 9 internas/sem acesso de cliente; riscos e ajustes classificados. |
| Storage | 0 buckets no projeto conectado. Política e backup de objetos futuros pendentes. |
| Testes e resultados | Em 26/09, `pnpm test:quality`: **35 passaram, 0 falhas, 0 TODO**; `pnpm test:db`: **22 passaram, 0 falhas, 0 TODO**. Incluem sete cenários SQL de identidade. Ensaio de restauração **local sintética** passou; não equivale a restaurar o Supabase ou testar Auth/REST. |
| Riscos e legislação | Registro de riscos e matriz. Fontes oficiais e data na seção final do diagnóstico. Não há parecer jurídico ou atestado de conformidade. |
| Backup e ambiente | [Plano de backup/restauração](PLANO_DE_BACKUP_E_RECUPERACAO.md) e [comparação de ambiente REP-P](22_AMBIENTE_REP_P_E_ROADMAP.md). Projeto dedicado é a preferência preliminar; nenhum projeto ou recurso pago criado. |
| Pendências | [Fechamento técnico](23_FECHAMENTO_PENDENCIAS_MARCO_0.md): reconciliação SQL e tipos, acesso pessoal ativo, revogação de sessão, restauração integral, ambiente/custo, dados legais, CCT/ACT, retenção/RIPD e revisão humana/SuperGrok. |

## Perguntas para a auditoria

1. O diagnóstico do esquema comprova a falta de vínculo usuário–funcionário? Há alguma relação existente ignorada ou uma interpretação errada de `created_by`?
2. A arquitetura proposta evita que um administrador operacional altere originais, inclusive via RPC, backup, Storage e credencial de infraestrutura? Quais garantias são apenas operacionais?
3. A separação entre Supabase Gestão e REP-P cria riscos de identidade, sincronização, indisponibilidade ou inconsistência histórica? Que atributos precisam de snapshot no evento?
4. As políticas RLS atuais impedem leitura cruzada no **futuro** portal do colaborador? O que precisa mudar sem quebrar Gestão?
5. Que requisito da Portaria 671 compilada em 07/01/2026 ou dos leiautes oficiais AFD/AEJ está ausente, incorreto ou mal classificado na matriz?
6. O planejamento de GPS, foto, BYOD, retenção e incidentes é proporcional à LGPD e às orientações da ANPD? Onde o RIPD ou revisão jurídica deve anteceder coleta?
7. O roadmap contém uma etapa prematura que possa criar passivo trabalhista? Qual condição objetiva faltaria para liberar o primeiro fluxo **de teste** e, separadamente, para uso oficial?
8. A migration de identidade garante uma conta↔uma pessoa e história auditável sem reaproveitar conta? O bloqueio de ativação até revisão integral de RLS é suficiente como etapa local?
9. `employee_work_team`, `stock_team`, `run_site_operation` e as RPCs administrativas deixam caminho de leitura/escrita cruzada para o futuro portal? Mostre rota concreta e privilégio necessário.
10. A reconciliação distingue versão, nome, conteúdo e esquema efetivo? Que evidência adicional deve anteceder aplicação da migration local?
11. O plano de backup cobre objetos Storage, segredos e restauração isolada? Que teste faltaria para afirmar RTO/RPO de uso oficial?

## Prompt para SuperGrok

> Atue como auditor independente e adversarial do Marco 0 e da fundação local do Marco 1A do Metallo Colaborador / REP-P. Trabalhe **somente em leitura**: não modifique arquivos, Supabase, migrations, Git nem configuração; não faça deploy ou compras. Leia `17_MARCO_0_COLABORADOR_REP_P.md`, `REGISTRO_DE_RISCOS_JURIDICOS.md`, `MATRIZ_DE_CONFORMIDADE_REP_P.md`, o modelo de ameaças citado acima, e os relatórios `19` a `23` deste pacote; confira as alegações no repositório e em fontes oficiais atuais quando possível. O Metallo ainda não opera na empresa: todos os registros atuais, inclusive histórico, movimentações e relatórios de EPI, são de teste; os 10 funcionários e 3 perfis seguem essa mesma condição. Questione especialmente a divergência de migrations (nome versus SQL/schema), a segurança dos grants/RPCs, se um colaborador **ativo** conseguiria ver colegas por qualquer rota, revogação de token, ASO, histórico do vínculo e a diferença entre ensaio PGlite e recuperação real. Avalie também originais, NSR, concorrência, idempotência, offline, GPS/FakeGPS, comprovantes, AFD, AEJ, assinaturas, Storage, backup/restore, LGPD, Portaria 671 e limites da evidência. Para cada crítica, informe severidade, fato ou hipótese, evidência concreta com arquivo/função ou fonte oficial, cenário, consequência e correção recomendada. Separe pontos não verificáveis de defeitos confirmados. Não declare conformidade legal nem altere nada.

**Fluxo de resposta:** ao receber o parecer, confrontar cada crítica com repositório e fonte oficial; classificar válida/parcial/inválida, registrar decisão e correção no pacote, repetir testes automáticos e de segurança relevantes. Fechar o marco somente depois dos gates pendentes, sem publicar ou ativar ponto.
