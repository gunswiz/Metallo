# Contrato arquitetural proposto — Gestão ↔ REP-P

**Estado:** desenho para revisão, sem integração implementada, sem criação de projeto dedicado ou marcação oficial. O Metallo atual ainda é ambiente de testes da empresa; todos os seus dados atuais são testes. O REP-P dedicado é preferência preliminar, dependente de custo, plano, DPA, região, Auth, backup, integração e recuperação aprovados.

**27/09/2026 — complemento de planejamento 2C:** o núcleo sintético 2B já existe somente no laboratório; o contrato de integração REP-P abaixo continua futuro. O [plano 2C](35_MARCO_2C_REVOGACAO_RECUPERACAO_RESILIENCIA.md) usa a baseline imutável METALLO-2B-LAB-20260927-R1. Para esse ensaio, a consulta síncrona à identidade continua sendo a proposta conservadora; a preferência assíncrona das seções históricas não autoriza removê-la. **SIMULAÇÃO SEM VALOR OFICIAL.** Nenhum contrato de API ou código foi alterado.

## Fronteira e dados mínimos

Gestão é fonte de cadastro/contexto, não autoridade para modificar originais de ponto. O REP-P armazena cópia mínima, versionada e previamente sincronizada. No futuro, o conjunto necessário deverá incluir: `employee_id` interno estável, identificador empresarial/matrícula validado pelo DP, estado e intervalo do vínculo, empregador/CNPJ, estabelecimento, fuso, contexto de equipe/obra quando pertinente e versões das regras aplicáveis. CPF só se necessário por obrigação comprovada e com tratamento restrito; ASO/EPI não fazem parte do fluxo de marcação. O identificador humano estável e os dados empresariais concretos dependem da empresa.

Cada mensagem terá `source_id`, `entity_id`, `schema_version`, `entity_version` monotônica por entidade, `event_id` único, `effective_at` de negócio e `produced_at` do servidor. Mensagens são assinadas/autenticadas entre serviços, com escopo mínimo e origem verificável; não aceitar atributos editáveis pelo app. O contrato deve rejeitar versão desconhecida, aplicar eventos de forma idempotente pelo `event_id`, descartar reordenação antiga e registrar divergências para reconciliação. Alteração que quebra compatibilidade exige nova `schema_version` e janela de migração. O formato definitivo não está fixado.

**Envelope conceitual:** `source_id` identifica a origem autorizada; `event_id` é imutável e globalmente único para deduplicação; `entity_id` é o UUID interno da pessoa/vínculo; `entity_version` cresce a cada mudança da entidade; `schema_version` governa interpretação do payload; `effective_at` indica quando o contexto de negócio passou a valer; `produced_at` é horário do serviço emissor; `payload_checksum` permite detectar alteração do envelope/payload canônico. Nenhum desses campos isoladamente concede acesso. A ponte deve autenticar serviço a serviço com credencial própria, autorizar tipo de evento e registrar recepção sem expor chave administrativa ao app.

## Snapshot, eventos e indisponibilidade

1. Uma carga inicial transmite snapshot com versão e checksum; eventos posteriores comunicam criação/alteração/inativação de vínculo e contexto, sem sobrescrever histórico já usado. O REP-P confirma aplicação com cursor e versão. Reprocessamento usa o mesmo `event_id` e não duplica estado.
2. Sincronização é assíncrona, com fila durável, retries limitados com backoff, canal de falhas e alerta de atraso. Medir `produced_at → applied_at`, versão pendente e idade do snapshot; definir limite aceitável **com DP/operação** antes do uso real.
3. A API futura de registro de ponto lê snapshot **local ao REP-P** e não faz consulta síncrona à Gestão no caminho crítico. Falha da Gestão não altera originais já gravados. Para trabalhador sem snapshot válido, vínculo conflitante ou revogação pendente, a política operacional e jurídica de contingência precisa ser decidida antes da liberação; não inventar autorização offline.
4. Reconciliação periódica compara versão, contagem, checksum e estados por entidade; divergência gera alerta e correção de snapshot **aditiva e auditada**. Não editar marcações antigas. Toda marcação preserva sua própria versão/contexto do instante: trabalhador, identificador, empregador, estabelecimento, vínculo, coletor e equipe/obra se usada.
5. Revogação do vínculo é evento de alta prioridade, mas a segurança do acesso pessoal no banco não depende da chegada do evento à Gestão: o banco de identidade verifica estado atual. A política de marcação durante atraso de sincronização precisa de limite explícito.

**Entrega e recuperação:** Gestão grava alteração e evento em uma **outbox transacional**; um emissor lê, envia e repete com backoff. REP-P grava `event_id`, versão e resultado em **inbox transacional** antes de confirmar, tornando duplicata um no-op verificável. Versão futura fora de ordem fica em espera/retry; versão antiga é registrada como obsoleta; falha permanente vai para fila de erro com alerta e intervenção auditada. Após restore de qualquer lado, comparar cursor, maior `entity_version`, quantidade e checksum por lote/entidade; reproduzir eventos faltantes ou novo snapshot versionado, sem editar marcações passadas. Uma revogação usa prioridade de transporte e alerta de atraso, mas a garantia de acesso pessoal imediato continua no estado atual do banco de identidade.

| Falha simulada | Comportamento técnico proposto | Decisão externa pendente |
| --- | --- | --- |
| Gestão offline | REP-P consulta último snapshot local e sinaliza sua idade; fila de Gestão retoma depois. | DP/jurídico definem quando snapshot fica inadequado para nova marcação. |
| REP-P offline | Gestão preserva eventos na outbox; nenhum registro de ponto é fingido no banco de Gestão. | Procedimento trabalhista de contingência e comunicação aos empregados. |
| Evento duplicado | Inbox reconhece `event_id` e não aplica duas vezes. | Nenhuma regra trabalhista nova. |
| Evento fora de ordem | Não aplicar versão N+1 antes de N; solicitar replay ou snapshot de recuperação. | Limite máximo de atraso aceitável. |
| Restore com versões diferentes | Comparar cursores/checksums, fazer replay aditivo e auditar divergência. | Quem aprova retomada e reconciliação de casos ambíguos. |

## Autoridade e segregação

`run_site_operation`, `p_occurred_at` do cliente, UUID operacional e fila `SharedPreferences` da Gestão **não serão usados** para ponto. O REP-P terá API própria; servidor define horário, idempotência e NSR transacional. Originais são append-only para papéis de app, gestor, tratamento e admin operacional. Tratamento acrescenta decisões/eventos relacionados, sem UPDATE/DELETE no original. O operador que vincula identidade não controla sozinho tratamento, originais, chave ICP ou auditoria; considerar dupla confirmação do DP para casos de risco.

## Auth do REP-P: alternativas ainda abertas

| Modelo | UX e operação | Segurança/revogação/acoplamento |
| --- | --- | --- |
| A. Auth compartilhado/validação entre serviços | Login único simples; depende de confiança entre projetos e gestão de chave/JWKS. | Revogação e disponibilidade acopladas; evitar aceitar claim isolada como autorização. |
| B. Auth dedicado com ponte segura | Pode exigir nova sessão ou troca de token controlada. | Isola credenciais e sessões, mas ponte e recuperação de conta ficam mais complexas. |
| C. Identidade central com tokens internos curtos | SSO possível com emissão de token restrito ao REP-P. | Mais componentes e operação; permite escopo/TTL curto, exige revogação e observabilidade consistentes. |

**Recomendação provisória:** para o REP-P dedicado, avaliar B como base de isolamento, com ponte servidor a servidor e experiência de login único somente após ensaio de segurança, revogação, falhas e privacidade. A pode simplificar UX mas aumenta dependência; C pode fazer sentido com serviço central maduro. Não implementar escolha de Auth antes de definir operador, custo, DPA, indisponibilidade e recuperação.

## Gates de implementação

Antes da integração: schema remoto de Gestão reconciliado, identificadores aprovados por DP, contrato versionado, ambiente descartável com eventos duplicados/fora de ordem, teste de atraso/indisponibilidade, reconciliação e restore DB + Auth/configuração + Storage + hashes. Para GPS/foto/BYOD, RIPD e política de privacidade precedem coleta real. Para uso oficial, faltam ainda as decisões CNPJ/estabelecimentos/NSR, ICP, CCT/ACT e revisão jurídica/técnica; este contrato não afirma conformidade.

## Complemento 2C — autorizacao do nucleo sintetico

**Somente proposta.** A comparação das alternativas A–H e a ordem autorização→commit estão no documento 35. Os campos abaixo não existem por força deste texto e não serão acrescentados ao request pessoal atual nesta rodada.

### C1. Quem emite a versão

`context_version` do 2B incrementa ao renovar o snapshot local; não representa a versão empresarial nem o estado de sessão. Separar conceitualmente:

| Campo | Autoridade e incremento propostos | Função / limite |
| --- | --- | --- |
| `source_generation` | Coordenador da origem, registrado em referência de confiança fora de um restore unilateral | Distingue restauração/recriação da autoridade; UUID aleatório não é contador monotônico nem prova de geração mais recente. Geração desconhecida → UNKNOWN. |
| `authorization_version` | Escritor autorizado do registro pessoal, na transação que muda identidade/vínculo e grava a outbox | Cresce por mudança de autorização, inclusive revogação e reativação explícita. Renovar TTL local não incrementa a versão da origem. |
| `session_epoch` por usuário | Autoridade de encerramento global; incrementa no corte de sessões | Invalida autorizações anteriores ao global; login posterior precisa ser emitido/registrado após o corte, sem confiar em `iat` do cliente. |
| Revogação por `session_id` | Autoridade Auth/sessão + registro durável do corte relevante ao núcleo | Encerra sessão específica sem revogar todas; refresh válido de outra sessão não é bloqueado por engano. |
| `context_revision` | Fonte do contexto descritivo | Mudança de obra/equipe não revoga identidade ativa. Evento guarda o contexto usado; não reescreve original. |
| `database_generation` / `restore_generation` | Operação de recuperação, confrontada com referência independente | Identifica linhagem/restauração do núcleo; não concede acesso nem apaga chaves já usadas. |

**Alternativas:** contador único simplifica comparação, mas exige único escritor/coordenador para reunir todas as causas; vetor de versões de identidade/vínculo/sessão evita falsa autoridade única, porém exige validar todos os componentes. Recomenda-se versão agregada de **identidade/vínculo**, com sessão validada separadamente no primeiro desenho. Não fingir que uma chamada administrativa ao Auth e uma escrita da outbox são atômicas só porque os serviços compartilham host. Mudanças de sessão feitas fora do coordenador precisam de mecanismo suportado de observação/reconciliação; até defini-lo, manter introspecção e não declarar entrega completa de revogações.

Exemplo conceitual: versão 15 ACTIVE → autoridade confirma 16 REVOKED → núcleo aceita 16, persiste tombstone e máximo observado → pedido associado a 15 é negado após o corte local. Uma posterior 17 ACTIVE só vale se representar reativação explicitamente autorizada. Não permitir que retry de mensagem 15, refresh, reinício ou restore local reduzam o máximo 16.

O pedido do trabalhador continua sem `employee_id`, titular, epoch ou versão decisória fornecidos pelo cliente. Se uma fase futura transportar uma autorização interna, o servidor a emite/verifica com audiência, sujeito, vínculo, sessão, geração, versão, validade e nonce quando necessário; isso não concede ao navegador poder de escolher esses valores. Claim assinada ainda precisa de comparação com bloqueios atuais.

### C2. Entrega Gestão/identidade → núcleo

Fluxo conceitual: **mudança autorizada + outbox na origem → emissor autenticado → inbox + estado de autorização no núcleo → ACK durável**. Não transportar originais de ponto nessa fila; `identity_event_id` identifica mudança de identidade, `point_event_id` identifica marcação. Não existe commit único entre os dois bancos.

Envelope mínimo proposto: identificador único da mensagem, origem/audiência, tipo de evento, `entity_id` interno sintético, geração, versão, versão do schema da mensagem, estado/causa mínima, `occurred_at` da origem, `produced_at`, identificador de correlação e checksum do payload canônico. Horários auxiliam diagnóstico, mas a ordenação usa versão/cursor, não relógio do cliente. Referência de sessão só quando necessária ao corte específico; é dado sensível operacional futuro, com acesso/retenção próprios, sem novo fingerprint de dispositivo.

1. A autoridade grava alteração e outbox na **mesma transação disponível naquele domínio**. Ações feitas somente por API Auth exigem desenho próprio para cobrir o intervalo entre sucesso e publicação; polling, hook suportado ou coordenação não podem ser presumidos completos sem teste.
2. Emissor envia pelo menos uma vez; timeout leva a retry da mesma mensagem com backoff/jitter e limite de pressão. Não descartar revogação por exceder tentativas: manter pendente, alertar e reconciliar.
3. Inbox valida origem/tipo/schema/sujeito e autenticação de serviço; persiste mensagem, versão aplicada, tombstone/estado e resultado em uma transação local. Só depois responde ACK. Mensagem repetida com mesmo conteúdo é no-op verificável; mesmo ID com conteúdo distinto é conflito de segurança.
4. Versão menor que a aplicada é registrada como obsoleta; nunca reativa. Mesma versão com conteúdo diferente → SUSPENDED/UNKNOWN e alerta. Lacuna em evento permissivo → bloquear e pedir replay/snapshot autoritativo.
5. Revogação autenticada de versão maior pode **negar imediatamente**, mesmo com gap, por conservadorismo; registrar gap e buscar reconciliação. Não conceder ACTIVE pulando lacunas. Essa exceção nega acesso, não inventa estados intermediários.
6. ACK contém mensagem/entidade/geração/versão/cursor efetivamente duráveis. Emissor guarda ACK, mede atraso e conserva histórico suficiente para replay. ACK de recebimento em memória não é confirmação de bloqueio aplicado.
7. Reconciliação compara máximos, geração, cursores, estados e checksums, por entidade e por intervalo. Ausência de mensagem na inbox não é prova de autorização. Heartbeat vazio não substitui reconciliação se houver gap.

### C3. Serialização, crash e restore da ponte

Evento de revogação e nova marcação devem disputar a mesma unidade de autorização no núcleo. Se revogação local confirma primeiro, pedido com versão antiga falha; se marcação confirma primeiro, seu original permanece. PGlite de um processo não prova que múltiplos processos usam a mesma trava. Locks/versionamento em outra topologia exigem protocolo/testes próprios.

| Falha | Estado proposto |
| --- | --- |
| Origem confirma mudança e emissor cai | Outbox permanece; próxima execução repete, não gera novo evento de identidade |
| Núcleo aplica e ACK se perde | Retry encontra inbox e devolve mesmo resultado/cursor |
| Núcleo cai antes de aplicar tudo | Transação local reverte inbox/estado juntos; retry repete |
| Canal/origem indisponível | Nova marcação nega quando não comprovar autorização atual; bloqueios conhecidos permanecem |
| Núcleo restaurado para versão 15, origem/âncora em 16 | Readiness falsa; replay/reconciliação até 16; nunca renovar 15 como se atual |
| Origem também restaurada para 15 | Contador em ambos os bancos não detecta rollback comum; referência externa confiável é necessária. Ausente → UNKNOWN, sem retomada permissiva |
| Nova geração da origem | Não comparar UUIDs por tamanho/ordem textual; exigir registro autenticado da geração e snapshot/reconciliação completos |

Geração/maxima mantidos apenas dentro do backup que foi restaurado não protegem contra rollback. A fonte da âncora e a independência administrativa são decisões A/B/C; o [plano de recuperação](PLANO_DE_BACKUP_E_RECUPERACAO.md#marco-2c--backup-e-restore-do-nucleo-sintetico) descreve o gate. Não escrever diretamente em tabelas gerenciadas do Auth para contornar ausência de mecanismo suportado. Nenhuma outbox, inbox, versão, endpoint ou rotina foi implementada nesta rodada.
