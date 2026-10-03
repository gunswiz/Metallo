# Marco 2A — arquitetura do ponto experimental sintético

**Estado em 27/09/2026:** arquitetura 2A concluída e decisão A aprovada para o ensaio 2B local. Referência imutável `METALLO-1C-LAB-20260927-R1`, ZIP SHA-256 `ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae`. Nenhuma baseline anterior foi alterada. A implementação experimental posterior está registrada no documento 34; esta arquitetura não autoriza REP-P, ponto oficial, dados reais, Supabase remoto ou publicação.

Este documento preserva o desenho e os gates propostos no 2A; expressões como “futuro” nas seções seguintes descrevem aquele momento de planejamento. O [Marco 2B](34_MARCO_2B_PONTO_EXPERIMENTAL.md) registra o que foi efetivamente implementado depois da autorização. O [contrato Gestão↔REP-P](CONTRATO_GESTAO_REP_P.md), o [modelo de ameaças](THREAT_MODEL_COLABORADOR_REP_P.md), a [matriz regulatória](MATRIZ_DE_CONFORMIDADE_REP_P.md) e o [roadmap](22_AMBIENTE_REP_P_E_ROADMAP.md) continuam responsáveis pelos temas transversais. Nenhuma proposta abaixo afirma conformidade ou autorização de uso trabalhista.

## 1. Fronteiras e responsabilidades

```text
Metallo Colaborador (sessão pessoal; dispositivo não confiável)
    ↓ pedido sem employee_id como titular
Meu Ponto, futuro coletor/interface (ainda inexistente)
    ↓ API própria, autenticada, versionada e idempotente
Núcleo isolado de ponto (futuro serviço de ensaio)
    ├─ identidade e snapshot versionado do vínculo
    ├─ relógio do servidor e validação
    ├─ original conceitualmente imutável + sequência transacional futura
    ├─ recibo/consulta pessoal e trilha de auditoria
    └─ exportações/assinaturas futuras, fora do 2B inicial

Metallo Gestão (cadastro e contexto)
    ↓ outbox → canal autenticado → inbox → snapshot versionado
Núcleo isolado de ponto
    ↑ consulta/relatórios autorizados, nunca UPDATE/DELETE de originais
```

Gestão é sistema administrativo; Colaborador é cliente pessoal; o futuro REP-P é a autoridade de originais. O coletor não vira núcleo regulado e não recebe credencial administrativa. O caminho de gravação do núcleo usa seu snapshot local, sem depender de consulta síncrona à Gestão. `run_site_operation`, a hora fornecida pelo cliente e a fila operacional da Gestão não servem de contrato de ponto. A API de ensaio do 2B, se autorizada, deve ter nome e indicador inequívocos de **SIMULAÇÃO SEM VALOR OFICIAL**.

## 2. Fontes oficiais consultadas e limite de versão

Consulta: **27/09/2026**. A informação de versão abaixo é a exibida pela fonte nessa data; páginas dinâmicas exigem nova conferência antes de especificar leiautes ou implantar. A busca no domínio oficial localizou texto indexado da compilação de **07/01/2026**, porém a URL direta retornou **404** ao abrir. O índice oficial consultado posteriormente aponta para um PDF de **21/07/2026**, que não pôde ser recuperado nesta sessão por timeout. Assim, a existência indexada da versão de janeiro foi confirmada, mas seu PDF não foi recuperado integralmente nem confirmado como versão vigente; a versão de julho deve ser conferida antes de qualquer contrato normativo. Não se declara conformidade.

| Fonte oficial, URL e versão/data observada | Consequência arquitetural / validação pendente |
| --- | --- |
| [MTE — portarias consolidadas](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/portarias-consolidadas), página atualizada **27/07/2026**, lista a Portaria MTP 671/2021 e aponta para PDF de **21/07/2026**; PDF de destino não recuperado nesta consulta. | Confirmar texto consolidado e alterações dos arts. 74–91 e Anexo IX com advogado trabalhista antes de fixar obrigações de REP-P, NSR e comprovante. |
| [MTE — Registro Eletrônico de Ponto](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep), atualizado **31/07/2026**. | Distingue REP-C, REP-A e REP-P; aponta leiautes atualizados e atestado. Não confundir protótipo com REP-P apto ao uso. |
| [MTE — Perguntas e Respostas REP](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP), página atualizada **28/04/2025**, respostas com datas individuais. | Respostas 12/14: REP-P exige registro de software no INPI; 38: AFD pertence ao REP, AEJ ao programa de tratamento; 41: sequência NSR por estabelecimento; 28–30/33–34: padrões e responsáveis pelas assinaturas. Confirmar contra a Portaria compilada antes do produto oficial. |
| [MTE — leiaute AFD](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf), publicação anunciada **31/07/2026**, campo `versao` **004** no PDF. | Formato, NSR, identificação do empregador/INPI, fuso e integridade demandam modelo de dados; nenhuma exportação é implementada no 2A/2B inicial. |
| [MTE — leiaute AEJ](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-eletronico-de-jornada-aej.pdf), publicação anunciada **31/07/2026**, campo `versaoAej` **002**. | AEJ é saída do tratamento, separada do original. Não calcular jornada no coletor/núcleo inicial. |
| [INPI — Programas de Computador](https://www.gov.br/inpi/pt-br/servicos/programas-de-computador/programas-de-computador), página sem versão numerada, consultada em **27/09/2026**. | Registro de programa e versão são gates de REP-P futuro, não tarefas do protótipo; validar titularidade, procedimento e custo antes do uso oficial. |
| [ITI — Certificação Digital](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital), atualizado **06/03/2026**. | Hash não é assinatura digital; custodiar certificado/chave fora de clientes e revalidar política ICP-Brasil, responsável e formato antes de AFD/AEJ/comprovante. |
| [Planalto — LGPD compilada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), texto sem versão numerada consultado em **27/09/2026**; [ANPD — RIPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd), atualizada **23/09/2026**. | Minimização, finalidade, acesso, transparência e avaliação de risco; privacidade/advogado definem hipótese legal, necessidade de RIPD, retenção e procedimentos para GPS/foto/BYOD. |
| [Planalto — CLT, art. 74](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm), texto sem versão numerada consultado em **27/09/2026**. | DP/advogado confirmam obrigação por estabelecimento, forma de controle, exceções e instrumentos coletivos aplicáveis à empresa concreta. |

**Revisão humana obrigatória:** advogado trabalhista e DP devem confirmar texto vigente da Portaria, CCT/ACT, empregadores/estabelecimentos, jornada, comprovante, NSR, AFD/AEJ, atestado, registro INPI e contingência; encarregado/privacidade devem validar LGPD, RIPD e retenção. A pesquisa é arquitetura, não parecer jurídico. A [matriz existente](MATRIZ_DE_CONFORMIDADE_REP_P.md) registra requisitos para revisão, todos não iniciados.

## 3. Contrato conceitual do evento original

O contrato definitivo será versionado após a revisão normativa. Para o protótipo sintético, separar claramente o **original recebido e confirmado**, a **requisição pendente** e a **projeção derivada**:

| Campo conceitual | Autoridade e sentido |
| --- | --- |
| `event_id`, `contract_version` | Gerados/validados pelo núcleo; identificam o original e a interpretação do envelope. |
| `idempotency_key` | Gerada pelo coletor por intenção de marcação; repetição da mesma chave devolve o mesmo resultado, sem criar segundo original. Não identifica trabalhador. |
| `worker_snapshot`, `employment_snapshot` | Resolvidos no servidor a partir de `auth.uid()` → conta portal → identidade ativa → funcionário ativo e do snapshot versionado; incluem identificadores legais somente após validação do DP. `employee_id` do cliente nunca escolhe titular. |
| `employer_snapshot`, `establishment_snapshot` | Cópia versionada do contexto empresarial validado; CNPJ, estabelecimento, obra, CNO/CAEPF e vínculo real permanecem **pendentes**, sem valores inventados. Obra operacional não substitui estabelecimento legal. |
| `server_received_at_utc`, `server_committed_at_utc` | Tempo do serviço confiável na recepção e confirmação; armazenar em UTC com fonte/sincronização observáveis. |
| `client_observed_at`, `client_offset`, `client_timezone` | Metadados não autoritativos para diagnóstico de atraso/offline; nunca reescrevem horário servidor. Fuso IANA e offset devem preservar a representação aplicável à exportação futura. |
| `collector_id/version`, `channel`, `device_context` | Origem e versão do coletor, minimizando identificadores do dispositivo; sem GPS/foto por padrão. |
| `nsr` | **Futuro** número por estabelecimento conforme versão normativa confirmada; ausente no protótipo até desenho e gate específicos. |
| `payload_hash`, `receipt_ref` | Hash de bytes canônicos e referência do resultado; hash detecta mudança em relação à âncora preservada, mas não autentica autor nem substitui assinatura. |

O **original** não tem `UPDATE`/`DELETE` para app, Gestão, DP ou administrador operacional. `status` de envio/processamento, recibo, exportação e decisões vivem em registros **derivados ou eventos adicionais**, vinculados por `event_id`; não se altera o original para passar de “pendente” a “confirmado”. Retificação ou omissão futura acrescenta pedido, decisão, autor, motivo, instante e vínculo ao original; nunca corrige silenciosamente o timestamp ou apaga histórico. O protótipo deverá impedir também escrita privilegiada rotineira; DBA/infraestrutura exigem controles de acesso, auditoria externa, backup e verificação independente, pois permissão SQL por si só não impede administrador de banco.

## 4. Tempo, concorrência, NSR e recibo

`momento do clique` é observação do aparelho e pode estar errado; `momento recebido` é relógio do servidor ao aceitar a requisição; `momento oficial adotado` depende de regra normativa/operacional ainda não decidida. No ensaio online proposto, o candidato é o instante de recepção do servidor, registrado separadamente do clique e do commit. Latência, reenvio e perda da resposta não autorizam substituir o horário por relógio local. Qualquer política para evento recebido atrasado/offline precisa de decisão trabalhista antes de uso real.

Uma intenção recebe uma chave idempotente estável. O núcleo verifica identidade/vínculo atual, chave e payload; sob transação, uma única intenção produz no máximo um original e uma resposta persistida. Chave igual com payload diferente é conflito auditável. Duas requisições simultâneas com a mesma chave recebem a mesma confirmação; chaves distintas não são automaticamente fundidas por proximidade temporal sem política explícita. Após perda da conexão **depois do commit**, a consulta pela chave retorna o mesmo evento, sem duplicar. A UI só mostra “registrado” após confirmação do servidor; “enviando” e “resultado desconhecido” são distintos.

Para futuro NSR, a resposta 41 do MTE indica sequência por estabelecimento. Proposta técnica, sujeita à norma: contador por estabelecimento com linha travada/serialização dentro da mesma transação que grava o original, restrições únicas e teste de concorrência/rollback; não usar `MAX(nsr)+1`. Uma sequência nativa de banco pode deixar lacunas em rollback e exige análise do requisito de incremento unitário; não escolhê-la sem ensaio e revisão jurídica. Reconfiguração, restauração, múltiplos nós e eventos administrativos da sequência também exigem desenho específico. Nada disso é criado nesta rodada.

O recibo conceitual ao trabalhador conteria identificador, horário adotado e fuso, empregador/estabelecimento, referência verificável e informação clara de status; **não é comprovante legal**. Antes de produção, validar forma, disponibilidade, extração, assinatura e responsabilidade conforme Portaria/leiaute vigente. A resposta 40 do MTE trata acesso eletrônico ao comprovante após cada marcação e extração de período mínimo; o protótipo não deve simular cumprimento dessa obrigação.

## 5. Offline e localização/foto: desenho sem coleta

Fila offline futura: uma intenção local com chave idempotente, instante do aparelho rotulado como não confiável, versão do contrato, payload mínimo e estado `pendente`; reenvio com mesma chave, autenticação renovada, resposta definitiva e resolução de conflito. Reinstalação, aparelho desligado, fila perdida, vínculo revogado e múltiplos dispositivos podem tornar a intenção irrecuperável ou inadequada. O protótipo 2B não deve chamar isso de ponto oficial nem prometer validade de registro offline. Política legal, integridade/assinatura local e contingência humana são decisões posteriores.

Não haverá rastreamento contínuo. Se localização for aprovada depois, coletar somente no evento, com permissão contextual, precisão/idade registradas, ausência de GPS tratada sem bloqueio cego e contestação humana. FakeGPS e local fora da obra geram sinal de verificação, não punição automática. Obra atual do 1C não prova local físico de trabalho. Foto é hipótese separada, **não reconhecimento facial**: justificar finalidade, necessidade, alternativa sem foto, acesso, retenção e RIPD antes de qualquer coleta. Biometria não integra este plano de implementação.

## 6. Isolamento do núcleo e ponte Gestão ↔ ponto

| Alternativa | Segurança e operação | Custo/backup/disponibilidade | Juízo do 2A |
| --- | --- | --- | --- |
| A. Mesmo Supabase, schemas separados | RLS e grants ajudam, mas `service_role`, Auth, recursos e erro administrativo atravessam a fronteira. | Menos infraestrutura; backup, disponibilidade e incidentes acoplados à Gestão. | Não preferida para REP-P oficial. Pode existir somente como ensaio descartável, sem chamá-lo de isolamento forte. |
| B. Projeto Supabase separado | Banco/Auth/credenciais e migrações isolados; exige ponte de identidade e contexto, revisão de funções privilegiadas e observabilidade. | Projeto, operação, backup, restauração e disponibilidade próprios; preço/plano dependem de cotação futura. | **Preferência arquitetural provisória** para núcleo futuro, condicionada a custo, DPA, região, recuperação e segurança. Nenhum projeto criado. |
| C. Backend/banco dedicados fora do Supabase | Controle mais fino do perímetro, tempo, assinatura e transação; maior responsabilidade de engenharia e segurança. | Operação, disponibilidade, suporte e custo próprios; integração/Auth possivelmente mais complexos. | Alternativa a comparar em protótipo arquitetural, sem escolha por custo apenas. |

O [contrato existente](CONTRATO_GESTAO_REP_P.md) define outbox/inbox, `event_id`, `entity_version`, snapshot, retry e reconciliação. Gestão publica mudanças de vínculo/empregador/estabelecimento em outbox transacional; ponte autenticada aplica em inbox idempotente no núcleo. Versão antiga não reescreve snapshot atual; versão futura fora de ordem aguarda reconciliação. O ponto confirmado se preserva mesmo se Gestão cair. Se o núcleo cair, a Gestão não grava “ponto alternativo” como se fosse original; há estado de indisponibilidade e procedimento humano pendente. O núcleo não concede acesso direto irrestrito às tabelas de Gestão nem a Gestão aos originais. Restore precisa reconciliar cursores, versões e hashes sem alterar marcações.

Papéis propostos: trabalhador consulta próprios registros; DP/operador trata solicitações com trilha; administrador operacional gerencia configuração autorizada; serviço do núcleo grava originais e sequência; custodiante de chave assina; auditor lê evidências. Administrador operacional não edita/apaga original, timestamp ou NSR. Dupla revisão para identidade/retificação de alto impacto. DBA é ameaça privilegiada distinta, mitigada por segregação, logs externos, cópias verificáveis e procedimento de recuperação.

## 7. Riscos herdados do 1C e tratamento antes do ponto

| Risco | Impacto concreto no ponto e controle recomendado | Bloqueia 2B sintético? / produção? | Ensaio futuro obrigatório |
| --- | --- | --- | --- |
| F5 — token residual após revogação | JWT antigo pode continuar criptograficamente válido; **cada gravação** consulta vínculo/identidade atual no servidor, não apenas claim. Revogar refresh e impedir novo login; definir TTL e contingência. | Não, se gate de negação com token antigo passar; **sim** para produção sem política aprovada. | Revogar entre autenticação e commit; token antigo, refresh e novo login; nenhum original após revogação. |
| F7 — função privilegiada | `SECURITY DEFINER` mal delimitada pode ultrapassar RLS/escopo. Preferir serviço isolado com grants mínimos, revisão de `search_path`, argumentos, proprietário e auditoria. | Não, se 2B usar superfície local mínima auditada; **sim** para produção sem revisão independente. | Invocação anônima/portal/admin, alteração de ID, catálogo de grants e regressão Gestão. |
| F8 — apagamento administrativo de histórico | UPDATE/DELETE privilegiado destrói prova; negar a papéis operacionais, cópia externa verificável, trilha independente e restauração testada. | Não para simulação descartável claramente rotulada; **sim** para ponto oficial. | Tentativas de UPDATE/DELETE por cada papel e DBA simulado; detectar divergência/restore. |
| F9 — logout em produção | Sessão em outra aba/dispositivo ou token roubado pode permanecer ativo. Definir logout global, TTL, revogação e resposta a incidente antes de uso real. | Não, se testes de sessão do laboratório cobrirem isolamento; **sim** para produção sem política. | Troca de conta, múltiplas abas/dispositivos, logout demorado, token antigo e sessão expirada. |

## 8. Ameaças: risco → controle → teste 2B/futuro

| Ameaça | Controle proposto | Teste futuro |
| --- | --- | --- |
| Funcionário duplica clique, reenvia ou reproduz request | Chave idempotente, resultado persistido, conflito de payload; rate limit sem perder intenção legítima. | Repetição, replay, duas requisições simultâneas, resposta perdida após commit. |
| Usuário troca ID ou registra por colega | Titular só por `auth.uid()` e vínculo ativo no núcleo; nenhum `employee_id` decisório no pedido. | João→Maria, Maria→João, ID/URL/body manipulados, RLS/API diretas. |
| JWT roubado ou residual | Vínculo atual por pedido, sessão curta/revogação e alerta. | Token antigo após revogação, refresh, login novo, logout entre abas. |
| Relógio adulterado, timezone/DST ou rede lenta | Servidor autoritativo; horários distintos e fuso preservado; cliente só diagnóstico. | Relógio adiantado/atrasado, fusos, horário de verão, latência e chegada tardia. |
| Fila offline, reinstalação ou reenvio fora de ordem | Não prometer marcação oficial; chave estável, estado pendente, reconciliação e política humana. | Desligar rede/aparelho, perder fila, reenvio, duas instalações, vínculo revogado. |
| FakeGPS, GPS ausente ou localização antiga | GPS opcional, precisão/idade explícitas, revisão humana; sem punição automática. | Permissão negada, GPS desligado/falso, fora da obra; verificar ausência de rastreamento. |
| Admin/DBA altera original, NSR ou histórico | RBAC, append-only operacional, auditoria externa, backup e hashes independentes. | Negativas UPDATE/DELETE; mutação privilegiada detectada; restore divergente. |
| Queda durante gravação, rollback parcial ou NSR concorrente | Uma transação para original/resultado/seq.; bloqueio por estabelecimento; recuperação idempotente. | Falha em cada etapa, rollback, 100+ requisições paralelas, lacunas/duplicatas. |
| Gestão ou núcleo indisponível; ponte atrasada | Snapshot local versionado, outbox/inbox, alerta de idade e política de contingência. | Falha separada de cada lado, replay fora de ordem, snapshot obsoleto, recuperação. |
| Chave/certificado comprometido ou hash recalculado | Custódia fora do app, assinatura futura e âncora externa; rotação e resposta a incidente. | Negar segredo no bundle, verificar adulteração e assinatura de ensaio quando existir. |

## 9. Matriz conceitual LGPD e retenção

Nenhum prazo legal é fixado aqui. “Revisar retenção” inclui base legal, necessidade, acesso, backup, descarte, direitos e exceções de preservação de prova; DP, advogado e privacidade devem aprovar antes de dados reais.

| Categoria | Finalidade possível e acesso mínimo | Decisão pendente |
| --- | --- | --- |
| Original de ponto | Prova de marcação; trabalhador próprio, DP/auditor conforme função. | Base legal, campos exigidos e retenção trabalhista/contenciosa. |
| Localização eventual | Contexto de evento, jamais rastreamento contínuo; acesso excepcional. | Necessidade, alternativa sem GPS, RIPD, precisão, retenção curta proporcional. |
| Foto eventual | Evidência complementar sem reconhecimento facial; acesso restrito. | Necessidade/alternativa, RIPD, consentimento não presumido, retenção e resposta a incidente. |
| Logs técnicos | Diagnóstico e segurança, sem token/corpo sensível; suporte limitado. | Prazo, pseudonimização, acesso e descarte. |
| Auditoria | Quem tentou/grava/trata/exporta; auditor independente. | Imutabilidade/âncora, prazo e acesso de fiscalização. |
| Recibos | Consulta/extração pelo titular e prova de integridade. | Forma legal, assinatura, disponibilidade e retenção. |
| Identidade/snapshots | Resolver vínculo e contexto do instante; serviço do núcleo e DP. | CPF/matrícula, recontratação, correção versionada, minimização e descarte. |

## 10. UX conceitual de “Meu Ponto”

**Exemplo fictício, não interface implementada:** `Meu Ponto · Hoje · 07:02 Entrada · 12:01 Saída · 13:00 Entrada · [BATER PONTO — INATIVO NESTE MARCO]`. A tela futura deve distinguir: **pronto**, **enviando**, **registrado somente após confirmação**, **offline/pendente sem valor oficial**, **erro**, **duplicado reconhecido como o mesmo evento** e **sessão inválida**. Se a resposta se perde após envio, mostrar “verificando resultado”, consultar a chave e evitar segunda intenção silenciosa. Não há cálculo de horas, banco de horas, adicional noturno, tolerância, intervalo automático, folha ou compensação. CCT/ACT, DP e contabilidade tratam regras de jornada separadas do original.

## 11. Decisões da empresa, sem exigir respostas agora

**A — antes de autorizar 2B sintético:** definir responsável técnico do ensaio e isolamento local; confirmar que todo dado é fictício e que nenhum recibo/exportação será apresentado como oficial; decidir se o 2B testará apenas online (recomendado); definir fonte de tempo do serviço, comportamento de falha e nomenclatura de “simulação”; conferir versão compilada da Portaria 671 antes de tornar qualquer campo normativo definitivo.

**B — antes de piloto com pessoas reais:** decidir BYOD ou aparelho da empresa, GPS/foto ou nenhuma coleta, ponto fora da obra, contingência/offline, identidade e recontratação, quem corrige inconsistências, CNPJ/estabelecimentos/obra/CNO, Auth e logout, retenção/RIPD, suporte e recuperação; DP/advogado/privacidade precisam aprovar. Piloto não é autorizado pelo 2A.

**C — antes de produção/REP-P:** escolher projeto Supabase separado ou backend dedicado, orçamento/contratos/DPA, titular do registro INPI, custódia ICP-Brasil, NSR/AFD/AEJ/recibo/atestado conforme norma vigente, CCT/ACT, responsável por auditoria/backup/continuidade e decisão formal da empresa. Nada disso está aprovado.

## 12. Plano de testes para eventual Marco 2B

Todos com dados sintéticos e ambiente local isolado; são **gates futuros**, não resultados já executados.

| Camada | Provas obrigatórias |
| --- | --- |
| Unitários/contrato | Versão desconhecida, DTO mínimo, data/fuso, chave idempotente, estados UI e ausência de cálculo de jornada. |
| Integração/Auth | JWT real João/Maria, revogação, refresh/login, logout, vínculo ambíguo/inativo, conta sem obra/equipe; ID cliente ignorado/rejeitado. |
| Transação/concorrência | Duplo clique/retry/replay, mesmo ID/payload divergente, commits simultâneos, rollback em cada etapa, resposta perdida, sequência sem duplicata; volume concorrente. |
| Offline/rede | Pilha desligada, rede lenta, fila **apenas conceitual** no 2B se não autorizada, loopback/Ethernet/container separados, nenhum fallback remoto. |
| Segurança | Grants/RLS/RPC/API, João↔Maria, admin/DBA, UPDATE/DELETE negados, logs sem segredos, token roubado/residual, auditoria de função privilegiada. |
| Recuperação | Backup/restore em ambiente descartável, original/recibo/seq. consistentes, replay outbox/inbox, falha Gestão e núcleo separadas. |
| Auditoria/conformidade eventual | Reconciliar evidências e hashes, parecer independente; leiautes, assinatura, INPI, AFD/AEJ e comprovante só em gate posterior específico com advogado/DP. |

O gate 2B deverá definir contagens **antes** de rodar, guardar saídas integrais e negativas, não somar suítes sobrepostas, corrigir crítico/alto no laboratório e confrontar auditoria. Testes de ponto não foram executados no 2A porque o módulo não existe.

## 13. Auditoria futura e decisão de avanço

Não enviar automaticamente esta documentação ao Grok. Se uma revisão posterior for autorizada, o prompt deve permitir **comandos passivos de listar, abrir/extrair ZIP, calcular hash e pesquisar texto**, sempre em somente leitura; deve proibir scripts do projeto, SQL/migrations, Auth, containers, endpoints/rede do projeto e alteração de arquivos ou do Supabase remoto. O auditor deve separar evidência verificada, inferência e hipótese, confrontar fontes oficiais atuais e registrar limites.

**Decisão registrada:** o responsável autorizou o Marco 2B somente online, local e sintético. O documento 34 registra sua implementação e seus testes; a conferência integral da Portaria vigente continua pendente para qualquer requisito normativo definitivo. **Não autoriza implantação, piloto real ou produção.**

**Arquivos desta rodada:** este documento novo concentra a responsabilidade própria do Marco 2A; `22_AMBIENTE_REP_P_E_ROADMAP.md` recebe apenas o vínculo/estado do marco; `MATRIZ_DE_CONFORMIDADE_REP_P.md` recebe nota de versão das fontes. Nenhuma pasta 01–07 foi movida ou reorganizada. Não há SQL, código, testes, interface ou baseline novos.
