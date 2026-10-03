# Plano de backup e recuperação — proposta para revisão

**27/09/2026 — escopo adicional de planejamento 2C:** foi acrescentado o procedimento proposto para o núcleo sintético PGlite do Marco 2B, no final deste documento. A baseline `METALLO-2B-LAB-20260927-R1` é fotografia de fontes/evidências, **não backup do banco ativo**. Nenhum backup, restore ou agendamento foi executado nesta rodada. As metas históricas abaixo pertencem ao plano geral; as metas do ensaio 2C estão explicitamente separadas. **SIMULAÇÃO SEM VALOR OFICIAL.**

**Estado atualizado em 26/09/2026:** plano criado; **não existe restauração comprovada do projeto Supabase conectado**. Segundo o responsável, esse projeto não é usado pela empresa: todos os registros atuais, inclusive histórico, movimentações e EPI, são de teste. Foi realizado apenas ensaio local isolado com dados sintéticos, descrito abaixo. A [cópia anterior do código](09_BACKUP_E_RECUPERACAO.md) não substitui backup do banco. O projeto conectado está no plano Free: [backup automático diário do Supabase é dos planos Pro/Team/Enterprise](https://supabase.com/docs/guides/platform/backups); no Free, exportação independente precisa ser implantada e testada. Nada foi agendado ou pago nesta etapa.

## Objetivos iniciais e responsáveis

Para **desenvolvimento com dados sintéticos**, meta provisória: RPO de 24 h (perda máxima tolerada) e RTO de 24 h (tempo até recuperar). **Não são garantias atingidas**, porque ainda não há exportação periódica nem ensaio integral. Para uso oficial do REP-P, DP, jurídico, TI e direção devem definir metas próprias mais exigentes com base em operação e lei; só assumir a meta depois de backup, redundância e restauração testados. Propor TI como executor e custodiante, responsável de segurança como revisor mensal, direção/DP como aprovadores da retomada. Nomear titulares e substitutos antes de ativar dados reais.

| Componente | O que salvar | Destino e frequência propostos | Retenção inicial proposta | Restauração/validação |
| --- | --- | --- | --- | --- |
| PostgreSQL Gestão | schema, dados, roles/grants/policies/funções/extensões, histórico de migration, versão Postgres | Exportação lógica diária criptografada para armazenamento fora do projeto; manifesto/hash e log de sucesso; cópia antes de migration | 7 diárias, 4 semanais, 12 mensais, sujeita a política de retenção/LGPD | Banco **novo e isolado**; validar contagens, FKs, RLS, funções, grants e fluxo sintético de Gestão. Nunca restaurar sobre produção para ensaio. |
| Supabase Storage | bytes dos objetos, metadados, bucket, path, hash, política, vínculo com registro de banco | Inventário e cópia criptografada diária em destino independente quando houver buckets | Mesma janela do banco, compatibilizando versões | Restaurar objetos em bucket privado isolado, comparar hash e vínculo com metadados; testar URLs/negação. Hoje: 0 buckets no projeto conectado. |
| Código Git | commits, tags, migrations, Edge Functions, infraestrutura, documentação e **mudanças locais não commitadas** antes de intervenção | Remoto Git com acesso limitado + espelho diário independente; snapshot local antes de intervenção | Histórico conforme política Git; espelhos 30 dias ou mais após decisão | Checkout em pasta nova, instalar dependências, executar testes; não publicar `.env` ou credenciais. |
| Secrets e configuração | inventário de nomes/escopos, valores no cofre, variáveis de ambiente, Auth, SMTP, URL, chaves de serviço e signing keys | Cofre de segredos com controle de acesso e recuperação, exportação do **inventário sem valores** junto ao manifesto; revisão trimestral | Conforme política do cofre e ciclo de rotação | Recriar manualmente em ambiente isolado, girar credenciais comprometidas; não pôr secrets em Git/backup do banco. |
| Certificados futuros | certificados/chaves privadas de assinatura, cadeia, validade, procedimentos de emissão/revogação | Cofre/HSM ou serviço aprovado, cópia protegida quando exportável e permitida, inventário de expiração | Conforme finalidade e exigência legal a validar | Testar assinatura/verificação em laboratório; não criar ou comprar certificado agora. |
| REP-P futuro | originais, NSR, comprovantes, AFD, evidências, metadados de integridade, logs e configuração versionada | Projeto dedicado preferido, backup independente, objetos fora do banco, cópias imutáveis/segregadas após desenho legal | Definir com DP/jurídico antes do uso oficial | Recuperar em projeto isolado; comprovar sequência, autenticidade, assinaturas, AFD e ausência de alteração dos originais. Não existe hoje. |

[A documentação Supabase](https://supabase.com/docs/guides/platform/backups) esclarece que backup de banco contém metadados do Storage, **não os objetos**. Portanto, “restaurar o banco” não recupera arquivo apagado. Também recomenda exportações externas no plano Free. A meta de frequência acima é proposta, não rotina já em execução.

## Procedimento de restauração planejado

1. Abrir incidente, registrar horário, causa, última cópia válida e ponto desejado. Preservar a origem e congelar escritas antes de qualquer recuperação real.
2. Selecionar backup e manifesto, verificar hash, criptografia e acesso por dois responsáveis. Criar destino **novo**, com credenciais e rede segregadas; nunca sobrescrever a produção para testar.
3. Recriar versão compatível de PostgreSQL/extensões e aplicar o dump; verificar logs de erro, objetos, índices, FKs, grants, RLS, policies, triggers e funções. Confirmar histórico de migrations contra manifesto. Não habilitar clientes públicos nesse estágio.
4. Recriar buckets privados e restaurar objetos correspondentes ao mesmo ponto temporal do banco. Verificar hashes e amostra de leitura; não tornar bucket público para “facilitar” a restauração.
5. Repor configurações e secrets pelo cofre, com chaves **de ensaio**; validar autenticação, papéis e negativas de acesso. Testar Gestão com dados sintéticos. No futuro REP-P, testar integridade, ordem/NSR, comprovantes e exportações com revisores independentes.
6. Documentar diferenças, duração, perda efetiva, decisão de retorno, responsáveis e evidências. Rotacionar credenciais usadas no ensaio quando necessário. Para retorno real, exigir autorização operacional específica.

## Ensaio executado e próximo ensaio obrigatório

| Campo | Ensaio realizado em 25/09/2026 |
| --- | --- |
| Origem | Instância local PGlite A, com 2 vínculos sintéticos (`active`/`revoked`), sem dados do Supabase. |
| Destino | Instância local PGlite B recém-criada, isolada. |
| Procedimento | Criar dados, exportar snapshot comprimido, abrir nova instância e comparar todas as linhas ordenadas. Código em [ensaio-restauracao-sintetica.test.mjs](../06_TESTES_E_QUALIDADE/ensaio-restauracao-sintetica.test.mjs). |
| Duração observada | 2.918 ms no comando local; snapshot de 4.554.747 bytes. |
| Resultado | 2/2 linhas iguais; teste passou. |
| Problemas/limites | Nenhum erro no ensaio local. **Não** exercitou `pg_dump`/`pg_restore`, Supabase Auth, Storage, secrets, rede, volume real, RLS do projeto conectado ou recuperação completa. |

**Próximo ensaio:** após reconciliação, preparar dump de um **ambiente isolado com dados sintéticos**, restaurar em segundo destino isolado com PostgreSQL/Supabase compatível, restaurar também objetos fictícios de Storage e configuração de teste, medir RPO/RTO e colher evidências. Não usar dados pessoais nem restaurar sobre produção. Até passar, o requisito “backup testado do sistema” permanece **pendente**.

## Marco 2C — backup e restore do nucleo sintetico

### B1. Escopo, consistência e metas propostas

Referência: [planejamento 2C](35_MARCO_2C_REVOGACAO_RECUPERACAO_RESILIENCIA.md), baseado na baseline aprovada 2B. Salvar em conjunto originais, resultados idempotentes, snapshots, bloqueios/versões quando existirem, schema/constraints/triggers/funções, metadados da linhagem e manifestos. Credenciais e tokens não são artefatos de auditoria. Configuração e contas Auth necessárias à reprodução serão recriadas de modo controlado no laboratório sintético; backup PGlite não é backup do Auth/Supabase.

**Backup consistente** é um corte verificável das tabelas e metadados relacionados, com E/R coerentes. Copiar arquivos enquanto o banco escreve pode misturar instantes e não será aceito como backup. O PostgreSQL documenta as condições de parada ou snapshot consistente para cópia de filesystem; isso não valida automaticamente uma técnica de snapshot no PGlite/Windows. [Backup físico PostgreSQL](https://www.postgresql.org/docs/current/backup-file.html).

| Item | Proposta para o ensaio local, não garantia atingida |
| --- | --- |
| RPO do corte | **Zero perda relativa ao conjunto de N eventos do corte consistente**. Não significa zero perda desde o último backup se houve novos eventos depois. |
| RTO | Meta inicial **30 minutos** para restaurar/verificar cópia de até 1.000 eventos sintéticos, em máquina equivalente; medir e revisar. Não é SLA de produção. |
| Frequência de ensaio | Backup antes/depois de cada campanha autorizada que modifica o banco; pelo menos um restore descartável por mudança de versão/schema/persistência. Nada agendado no 2C. |
| Destino | Diretório técnico de backup segregado do banco vivo, ignorado pelo Git, nunca sobre a origem; cópia adicional fora do host só depois de destino/permissões autorizados. |
| Retenção provisória | Sete cortes de ensaio e a última cópia comprovadamente restaurável, sem apagar a última boa em falha. Prazo real e descarte dependem do responsável. |
| Papéis | Executor técnico prepara; responsável/revisor confere resultado e autoriza retomada. Não criar usuários/privilégios agora. |
| Privacidade | Somente dados sintéticos; mesmo assim, não incluir senhas/JWT/refresh/service role no pacote de auditoria. Backup com credenciais, se futuramente necessário, exige cofre separado. |

### B2. Procedimento futuro de backup consistente

1. Registrar runtime/schema/contrato e identificação do laboratório. Retirar readiness, bloquear novas gravações e drenar/reverter transações pendentes, preservando a origem. Medir N e as tuplas completas E/R/contexto de um corte único.
2. Preferir exportação suportada do PGlite com `dumpDataDir` enquanto banco está aberto e **sem writers**, acompanhada por fechamento limpo antes de retomar a operação. `loadDataDir` permite carregar essa exportação no destino; compatibilidade é voltada ao PGlite e não é garantida entre versões PostgreSQL. [API de exportação PGlite](https://pglite.dev/docs/api). Verificar funcionamento/versão exatos antes de escrever automação.
3. Alternativa de ensaio: fechar banco de forma limpa e só então copiar **todo** o diretório consistente. Não misturar cópia parcial com exports de momentos distintos. Cópia fria também exige restore testado; “copiou sem erro” não encerra o gate.
4. Gerar arquivo inicialmente identificado como incompleto; concluir gravação/fechamento suportados, calcular SHA-256 e ler novamente. Renomear para final apenas após sucesso, sem sobrescrever cópia boa. Provar os limites do filesystem antes de prometer durabilidade; não ativar modo de durabilidade relaxada como otimização de backup.
5. Manifesto: `backup_id`, linhagem/banco, versão de schema/contrato/hash, versões Node/PGlite/PostgreSQL identificável, backend de persistência, horário do corte, geração/epoch/cursor de autorização, contagens e hashes ordenados de tuplas, limites de idempotência, total de arquivos/bytes e SHA-256. Campo inexistente no 2B deve constar como **não disponível**, não inventado.
6. Preservar inventário/âncora do corte fora do destino que será restaurado. Hash guardado só dentro do próprio backup não demonstra atualidade ou proteção contra administrador do backup.
7. Abrir cópia em destino descartável separado e comparar conforme B3. Só rotular como “restaurável no runtime ensaiado” após passar. Guardar evidência de falha e a cópia anterior se falhar; não ligar à API pessoal para testar.

`relaxedDurability` permite retorno antes de completar flush em certos backends; não será aceito como premissa de confirmação durável sem ensaio próprio. Node filesystem, IndexedDB e memória têm comportamentos diferentes. O laboratório usa diretório no servidor Node; ensaio só em memória não prova recuperação de processo. [Filesystems PGlite](https://pglite.dev/docs/filesystems).

### B3. Restore descartável e comparação integral

1. Validar manifesto/hash, compatibilidade e caminho; selecionar **novo diretório** e instância sem publicação de portas. Não sobrescrever banco vivo nem reiniciar serviços correntes nesta rodada.
2. Restaurar cópia, manter readiness falsa e impedir acesso dos clientes. Não criar dados/snapshots novos automaticamente antes de medir o material restaurado.
3. Comparar conjuntos ordenados, não somente contagens: cada `event_id`, titular, `idempotency_key`, todos os timestamps/contextos, versão do contrato, hash original; cada resultado/chave/request_hash/vínculo ao evento. Recalcular hashes pelo verificador legado e verificar correspondência E↔R e FKs/uniques.
4. Exigir exatamente os **mesmos N eventos do corte**, sem perda, duplicação, órfão ou troca de titular. Comparar triggers/funções/constraints/grants e schema com referência confiável, antes de qualquer reparo.
5. Fechar e reabrir a cópia em **novo processo**; repetir verificações e retries das mesmas chaves, com autenticação local real em ensaio posteriormente autorizado. João não lê Maria e vice-versa. Não trocar IDs Auth para “adaptar” o backup sem registrar e reavaliar o vínculo.
6. Reconciliar autorização com a fonte atual, gerações e âncora. Snapshot restaurado ACTIVE não é autorização de hoje. Sessões restabelecidas por backup do Auth não reabrem acesso sem verificação da autoridade/epoch atual.
7. Medir duração, integridade, divergências, RPO observado e limites de cobertura. Destino só fica pronto após aprovação do ensaio; se há rollback temporal ou incerteza, permanece isolado. Esse procedimento não autoriza promover a cópia para uso real.

### B4. Restore antigo + idempotência: cenário obrigatório

**Linha:** criar E1/K1 → backup B com N=1 → criar E2/K2 e E3/K3, ambos confirmados → restaurar B → repetir K1 e K2.

- K1 existia no backup: se autorizado, retorna E1 com mesmos bytes relevantes; nenhuma linha adicional.
- K2 foi confirmado depois de B: a cópia antiga o desconhece. Executar o POST normal pode gerar E2' e apagar a evidência da confirmação anterior na visão restaurada. Gerar novo `generation_id` não torna isso correto e não recupera E2.
- Comparar backup/generation/maxima com âncora externa e registro de cortes/reconciliação. Ao detectar atraso, **não liberar novas marcações nem tratar K2 ausente como nunca usado**. Restituir E2/E3 de journal/cópia confiável se existir; caso contrário, manter incidente/quarentena. Não reconstruir original a partir de relato do browser ou hash sem payload.
- Mesmos N prova restauração do corte; não prova ausência de perda dos eventos posteriores. Para retomar com zero perda de todas as confirmações, é necessária fonte durável desses eventos e de suas chaves, fora do backup antigo. Sem ela, a promessa é impossível.

| Mecanismo avaliado | Detecta / recupera | Limitação |
| --- | --- | --- |
| `generation_id` só no banco | Identifica o banco em operação | Restaura junto e não detecta rollback sozinho |
| `backup_epoch` no manifesto | Identifica o corte | Precisa catálogo máximo confiável fora do restore; cópia do manifesto antigo também pode parecer válida |
| Geração monotônica de restore fora da cópia | Sinaliza que houve recuperação e invalida confiança antiga | Não recupera eventos/chaves; não comparar UUIDs lexicograficamente como contador |
| Âncora externa com contador/inventário/hash | Detecta divergência entre estado restaurado e último corte conhecido | Eventos depois da âncora não estão cobertos; hash detecta, não restaura |
| Journal externo completo | Pode recuperar eventos, resultados e chaves depois do backup | Precisa ordenação, integridade, retenção e protocolo entre gravações; não assumir atomicidade de banco+journal |
| Fonte de autorização atual | Evita reviver vínculo revogado em restore do núcleo | Se fonte também retrocede, depende de âncora/geração independente |

**Proposta mínima 2D:** detectar restore antigo e **recusar retomada automática**. Planejar journal/âncora independente com escritor privilegiado isolado em marco próprio se for exigida retomada completa. Arquivo de manifesto em outra pasta sob o mesmo administrador serve para ensaio de erro operacional, não para prova contra aquele administrador.

### B5. Critérios e limites de aceitação

Passar B01–B03 do documento 35; repetir nas versões/topologias que vierem a ser autorizadas; preservar artefatos, hashes e negativas. Testar origem/cópia/âncora perdidas separadamente. Contagem igual com hashes diferentes reprova. Um arquivo ausente/corrompido que provoca criação automática de banco novo reprova. Não expor SQL para facilitar verificação. Nenhum teste, backup, restore, serviço, journal, assinatura ou política de retenção foi implementado no 2C.
