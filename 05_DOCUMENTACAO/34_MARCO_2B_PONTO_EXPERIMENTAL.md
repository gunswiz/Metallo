# MARCO 2B — PONTO EXPERIMENTAL ONLINE E SINTÉTICO FUNCIONAL EM LABORATÓRIO

**Continuação documental em 27/09/2026:** o [Marco 2C](35_MARCO_2C_REVOGACAO_RECUPERACAO_RESILIENCIA.md) planeja tratamento dos riscos residuais, sem mudar implementação ou resultados 2B. A baseline aprovada permanece imutável, incluindo a versão deste relatório arquivada no ZIP. Nenhuma baseline 2C foi criada; o conteúdo de fechamento abaixo é preservado.

**Estado em 27/09/2026:** fechamento formal e baseline **METALLO-2B-LAB-20260927-R1** autorizados expressamente pelo responsável nesta conversa: “AUTORIZO FORMALMENTE O FECHAMENTO DO MARCO 2B E A CRIAÇÃO DA BASELINE APROVADA”. Prévia **aprovada visualmente** na mensagem “tá perfeito”; **dois ciclos independentes Grok concluídos e confrontados**, sem crítico/alto comprovado no material e escopo local examinados. **Zoom real de 200% e avaliação visual confirmados manualmente** na resposta “ta tudo ok, ja vi” à pendência específica; registro posterior ao ciclo 2, sem aferição automática do valor. A origem imutável é `METALLO-1C-LAB-20260927-R1`, SHA-256 `ea672a8c90c0f1b4de6c5e739404508b1fc68523e0d8c6d91bcd24f8621f70ae`. A conclusão do pacote é comprovada pelo recibo externo de integridade e secret scan do ZIP identificado abaixo; qualquer achado impede sua conclusão. **SIMULAÇÃO SEM VALOR OFICIAL; não é REP-P, ponto oficial, produção, piloto real ou autorização de publicação.**

## Fechamento formal e fotografia aprovada

| Marco | Estado oficial |
| --- | --- |
| 0 | Fechado tecnicamente |
| 1A/T05/T15 | Concluído e auditado em laboratório |
| 1B | Funcional em laboratório |
| 1C | Minha Obra funcional em laboratório |
| 2A | Planejamento concluído |
| 2B | Ponto Experimental Online e Sintético funcional em laboratório |

Baseline: **METALLO-2B-LAB-20260927-R1**. ZIP: `outputs/Metallo-Marco2B-BaselineAprovada-20260927-R1.zip`. O `MANIFESTO_SHA256.json` dentro do ZIP contém inventário de arquivos, hashes, delta completo desde 1C, resultados finais, estados oficiais, referências dos dois pareceres, aprovação visual/zoom, autorização de fechamento e limites. `LEIA-ME.md` orienta a leitura sem duplicar o relatório vigente. O SHA-256 externo está em `.zip.sha256`; `.zip.verificacao.json` vincula a varredura final diretamente ao hash do ZIP, sem a autorreferência de inserir esse recibo no próprio arquivo examinado.

A composição segue a fotografia documental/de fontes da baseline 1C e acrescenta somente os arquivos do escopo 2B revisado e suas evidências, sem tratar o checkout inteiro como aprovado. Não é cópia de banco ativo, backup de dados nem distribuição instalável completa. Configurações privadas, contas/senhas, `.env`, bancos PGlite, caches, dependências instaladas e bundles não integram o ZIP. A inspeção também verifica o conteúdo interno dos DOCX herdados. As baselines 1B R1, 1B R2 e 1C R1 são conferidas por hash antes/depois e não são sobrescritas.

Esta rodada altera somente os documentos vigentes e gera a fotografia autorizada. O novo `laboratorio-marco-2b/gerar-baseline-2b.mjs` tem responsabilidade específica de validar as provas existentes, compor o delta 2B, chamar o scanner existente e impedir sobrescrita/conclusão sem varredura aprovada; reutiliza o padrão dos geradores 1B/1C. Nenhum código funcional do produto ou teste é alterado. Os resultados abaixo são os finais já executados, conferidos nos artefatos, sem alegar nova execução nesta rodada. Sem terceira auditoria Grok, novo módulo ou publicação. Supabase remoto intocado.

**Limites obrigatórios:** SIMULAÇÃO SEM VALOR OFICIAL; somente laboratório online/sintético; sem pessoas reais, produção, ponto oficial, REP-P, implantação remota ou publicação. Não iniciados Marco 2C, GPS, foto, biometria, offline, cálculo de jornada, AFD, AEJ ou NSR oficial. Recomendação apenas: submeter à decisão do responsável um próximo marco de planejamento da consistência de revogação e recuperação do laboratório; nenhuma implementação autorizada por este fechamento.

## Arquitetura executada

```text
Metallo Colaborador (somente 127.0.0.1:3101)
  → /api/ponto-lab/{events|intent/UUID} (transporte local exato)
  → API própria 127.0.0.1:3103/lab-point/v1/*
  → PGlite/PostgreSQL isolado em backups/metallo-ponto-lab-pglite (ignorado pelo Git)

Supabase CLI 1A (somente 127.0.0.1:54321)
  → Auth/JWKS e my_employee_profile para validar identidade e vínculo pessoal
  → nenhum INSERT/UPDATE de ponto no banco operacional
```

O núcleo usa um **banco PostgreSQL embutido PGlite separado**, sem porta SQL, credenciais SQL no navegador, projeto cloud ou gasto. Esta opção atende à separação local pedida, mas **não equivale a um segundo Supabase completo** e não é arquitetura de produção. O serviço de marcação tem porta própria `3103` apenas em loopback. A rota de transporte na prévia usa `3101` porque a política de conteúdo da Web só permite conexões de navegador à própria origem e ao Auth local. Ela aceita apenas os caminhos e métodos do laboratório, exige Host `127.0.0.1:3101`, JWT no pedido, corpo pequeno, `no-store` e encaminhamento fixo a `127.0.0.1:3103`; fora do modo local da prévia retorna 404. Não há fallback remoto.

## Contrato e dados

- `POST /lab-point/v1/events`: `{"contract_version":1,"idempotency_key":"UUID"}`; não aceita `employee_id`, `worker_id`, horário ou campos extras. Retorna `REGISTRADO_NO_LABORATORIO` (201), `DUPLICADO` (200) ou erro explícito. Chave igual com versão/payload diferente gera conflito 409.
- `GET /lab-point/v1/events`: somente os eventos do titular **de hoje em America/Fortaleza**, limitados a 50. `GET /lab-point/v1/intent/UUID` consulta resultado da mesma intenção, também apenas do titular. Nenhuma rota lista todos os trabalhadores ou aceita ID de funcionário como titular.
- Resposta pessoal mínima: `event_id`, `server_received_at_utc`, `payload_hash`. A UI mostra **Marcação de teste**, horário confirmado pelo servidor, sem classificar entrada/saída/intervalo nem calcular jornada.
- `lab_context`: `auth_user_id`, UUID técnico do funcionário sintético, referências `LAB-*` de trabalhador/vínculo/empregador/estabelecimento, `active`, `context_status`, `context_version`, atualização e validade. Não copia ASO, CPF, colegas, EPI ou observações da Gestão. No início do serviço, João/Maria são autenticados novamente no Auth local antes de renovar o snapshot por até **24 horas**; contexto revogado/inativo/ambíguo ou vencido falha fechado. O acesso pessoal é revalidado em cada pedido e outra vez imediatamente antes do commit de uma marcação.
- `lab_time_event` é o original sintético: UUID, chave idempotente única, versão, referências do snapshot, timestamps UTC de recepção e commit gerados no servidor, coletor/canal, SHA-256 e `created_at`. Trigger nega `UPDATE`/`DELETE` ordinários. `lab_intent_result` persiste o resultado na mesma transação do original. Não há NSR, AFD, AEJ, recibo legal ou assinatura.
- O hash é SHA-256 da serialização JSON canônica do vetor ordenado `[event_id, auth_user_id, idempotency_key, contract_version, worker_snapshot_ref, employment_snapshot_ref, employer_snapshot_ref, establishment_snapshot_ref, context_version, server_received_at_utc, server_committed_at_utc, collector_version, channel]`. `created_at` é carimbo auxiliar do banco e não participa desse hash. **Hash não é assinatura digital nem prova jurídica de autoria**; um administrador de infraestrutura ainda pode alterar o banco e recomputá-lo.

O JWT ES256 é verificado criptograficamente com JWKS do Auth **local**, mais `iss`, `aud`, papel, UUID de `sub`/sessão e expiração. A API consulta `/auth/v1/user` e `my_employee_profile` com o mesmo token e compara o funcionário com o snapshot. A conta administrativa da Gestão não recebe acesso pessoal. Não há chave `service_role` nem segredo privado no navegador. O servidor não registra JWT, senha, refresh token, payload ou ID pessoal em seus logs; negativas registram apenas método, classe da rota, HTTP e código.

## Evidências e resultados próprios do 2B

As contagens abaixo são **suítes separadas** e não devem ser somadas, pois alguns cenários se sobrepõem. Todos os dados criados são fictícios e locais.

| Ensaio | Resultado | Evidência |
| --- | ---: | --- |
| Núcleo real: Auth/JWT, João/Maria, registro, idempotência, cinco pedidos simultâneos, rollback, revogação/token antigo/refresh/novo login, hash e negativas SQL | **64/64** | `04_BANCO_E_SUPABASE/laboratorio-marco-2b/resultado-2b.json` |
| Revogação percebida após INSERT e antes do COMMIT, rollback e ordem inversa | **5/5** | `resultado-revogacao-concorrente-2b.json`; ensaio controlado, parcialmente sobreposto aos 64 |
| Transporte real pela prévia `3101` até API `3103`, João/Maria e repetição | **13/13 após confronto** | `resultado-transporte-2b.json`; substitui a prova 9/9, corrigindo a leitura de Maria e acrescentando o sentido inverso |
| API desligada: transporte retorna 503, sem fallback | **1/1** | `resultado-indisponibilidade-2b.json`; a tela exibiu “LABORATÓRIO DE PONTO INDISPONÍVEL” e nenhuma confirmação antiga |
| UI Meu Ponto | **5/5**, dentro da Web completa | `01_WEB/10_TESTES/colaborador-ponto.test.tsx`: confirmação só após servidor, resposta perdida, reuso da chave offline, sessão inválida e DTO mínimo |
| Regressão Auth/João/Maria/T05/T15/Edge Functions | **683/683** | `base-real.json` e `base-real.log`, mais resultados complementares/T05/T15 na pasta 2B; não altera o 683/683 histórico do 1C |
| Regressão 1C real | **45/45** | `resultado-1c-regressao.json` e log na pasta 2B |
| Banco / qualidade | **31/31 / 44/44** | `banco.tap` e `qualidade.tap` desta rodada |
| Web completa / TypeScript / lint / build | **114/114 / passou / passou / passou** | `web-completa.log` nomeia os testes; `typecheck.log`, `lint.log`, `build.log` registram os comandos. A Web preserva o insucesso transitório 113/114 e a reexecução corrigida 114/114; ver confronto |
| Rede local | **8/8** | `rede.json`: listeners `3101`, `3103` e Supabase somente loopback; IP Ethernet negado no host e em outra rede Docker com controle positivo; firewall permaneceu ativo. Não houve segunda máquina física. |
| Segredos | **0 achados nas fontes, logs e 75 bundles Web; ZIP verificado antes do envio** | `resultado-segredos-2b.json`; compara valores reais do service role/JWT secret e senhas sintéticas sem exibi-los, além de padrões `sb_secret`/PEM; relatório final externo ao ZIP evita autorreferência |

Negativas adicionais: token adulterado/anon rejeitado; João não lê intenção de Maria e vice-versa; querystring, URL e corpo com ID alheio não escolhem titular; admin Gestão não marca; `UPDATE`/`DELETE` do original foram tentados e negados; relógios de cliente +2h, -2h, dia e fuso divergentes foram enviados como campos extras e recusados. Não se alterou o relógio físico do Windows. Cinco pedidos simultâneos com a mesma chave geraram exatamente um original; duas chaves diferentes geraram originais diferentes. Resposta perdida após commit foi recuperada pela chave sem nova linha.

**Limite de concorrência com revogação:** a API faz nova verificação pessoal antes do commit e reverte a transação quando percebe revogação nesse intervalo. Os 5/5 cobrem essa ordem controlada, e os 64/64 cobrem token antigo após revogação real. Como Auth e PGlite são bancos separados, existe uma janela residual entre a última verificação e o commit que não pode ser tornada atomicamente zero com este protótipo. Política/ponte de revogação e consistência devem ser desenhadas antes de qualquer uso real. O trigger append-only também não impede o proprietário do banco/infraestrutura de removê-lo; preserva-se o risco F8 do 1C.

## Prévia e cumprimento do gate

Prévia: **http://127.0.0.1:3101/colaborador/ponto**. O navegador exibiu logo Metallo, aviso de simulação, João sintético, histórico pessoal e nova confirmação; com a API desligada, exibiu indisponibilidade. A captura visual a 100% não mostrou corte na área observada e o documento tinha `scrollWidth = clientWidth` na leitura do navegador. O responsável respondeu **“tá perfeito”** após receber a prévia e foi registrada sua aprovação visual do estado apresentado. A confirmação separada do **zoom real de 200% foi recebida manualmente** em 27/09/2026, na resposta “ta tudo ok, ja vi” à pendência específica do menu do Edge. Os atalhos automatizados não modificaram a escala observada; a confirmação manual complementa a inspeção visual e não será apresentada como medição automática.

Após a aprovação visual, foram concluídos o pacote ZIP **sanitizado**, scan do próprio ZIP e os dois ciclos autorizados de auditoria adversarial Grok somente leitura e confronto, registrados abaixo (inspeção passiva de arquivos/ZIP permitida; execução de SQL, Auth, scripts, containers e rede do projeto proibida). A pendência visual de 200% foi concluída pela confirmação manual posterior. A autorização específica de fechamento formal e baseline foi recebida em seguida, separadamente da aprovação visual. A baseline 1C permanece a origem imutável da nova fotografia 2B.

Arquivos novos têm responsabilidades específicas: `laboratorio-marco-2b/` concentra schema, núcleo, Auth local, API e provas; `05_ACESSO_A_DADOS/Ponto/` contém somente o cliente do contrato; a rota `app/api/ponto-lab/` é transporte local exigido pela CSP; `meu-ponto.tsx` é apenas a tela; `colaborador-ponto.test.tsx` testa sua interação; este documento registra o estado 2B. Foram atualizados o hook, rota, navegação e CSS existentes do Colaborador, o proxy de prévia, um teste de Home e o teste de segurança; os executores históricos só ganharam destino de evidência 2B. As pastas 01–07 não foram reorganizadas.

## Auditoria independente — ciclo 1

Após a aprovação visual, foi enviado ao [Grok](https://grok.com/c/03194895-5dba-48ca-a343-43ad45a23010) o pacote `outputs/Metallo-Marco2B-PontoExperimental-Auditoria-20260927-Ciclo1.zip`, SHA-256 `0fd2111e86edfacc7c9998f7aaa3becf32c37ad015f6364c6f97322969ff6436`. Possui 68 entradas, manifesto conferido de 67 artefatos e delta conferido de 55 arquivos em relação à baseline 1C. A varredura final externa ao ZIP passou: **zero achados**, 30 fontes/logs, 75 bundles e conteúdo integral das 68 entradas. O relatório interno antecede o empacotamento; o externo identifica o hash exato enviado. `grok-ciclo1.png` registra o envio.

O pedido autorizou apenas inspeção passiva do ZIP e arquivos no ambiente do auditor, inclusive extração, busca e hashes. Proibiu execução do projeto, SQL, testes, Auth, containers, chamadas à rede do laboratório e alterações. Pediu achados numerados com severidade no laboratório, arquivo/linha, caminho de exploração e distinção entre vulnerabilidade, hipótese, lacuna e risco futuro. A aprovação visual não foi apresentada como comprovação separada de zoom 200%, aprovação de baseline ou publicação.

O parecer original está em `laboratorio-marco-2b/parecer-grok-ciclo1.md`. O auditor confirmou o hash, 67/67 entradas do manifesto, delta e cópias da baseline incluídas. Declarou não executar o projeto e não encontrou crítico/alto comprovado na superfície HTTP local. A possibilidade de um administrador da máquina remover proteções foi classificada separadamente e não constitui acesso concedido ao administrador da Gestão.

### Confronto A1–A9 e saneamento do pacote

| Achado | Confronto local |
| --- | --- |
| A1 — janela Auth/commit | Procede como limite já declarado. A prova 5/5 injeta revogação no hook; não é commit distribuído atômico. Mantido como risco futuro, sem alegar janela zero. |
| A2 — controle da infraestrutura | Procede como limite F8. HTTP não oferece SQL, alteração de contexto ou de resultado; o proprietário local do banco continua capaz de remover triggers. Não ampliamos a arquitetura deste ensaio. |
| A3 — concorrência em outro motor/writers | Hipótese de robustez futura: PGlite de um processo passou cinco pedidos concorrentes e constraints únicas. Não foi demonstrado erro 23505 neste runtime. Migração para múltiplos writers exige estratégia explícita de conflito e nova prova; não se afirma portabilidade do ensaio. |
| A4 — histórico de Maria lido antes do POST | Confirmado. O teste lia `otherBefore`; corrigido para novo GET após POST de João. Acrescentados registro de Maria, leitura própria nova, GET João após POST Maria e negativa da intenção Maria. **13/13** via 3101→3103; runtime sem alteração. |
| A5 — logs ausentes | Saneado com logs próprios de TypeScript, lint e build, todos código de saída 0; Web repetida em modo detalhado identifica os cinco testes Meu Ponto dentro dos 114. |
| A6 — zoom/host físico | Na auditoria, 200% ainda estava pendente. Após o ciclo 2, o responsável confirmou manualmente o zoom e a avaliação visual; evidência complementar registrada abaixo, não reavaliada pelo Grok. Rede separada Docker com controle positivo passou; permanece o limite de segundo host físico não usado. |
| A7 — sessão persistida no cliente | Não é bypass: a API verifica JWT, usuário e vínculo atuais em cada pedido. Mantido o gate de token residual real. |
| A8 — scan externo e bundles | Relatório externo agora identifica o SHA-256 exato de cada ZIP e preserva recibos anteriores. Fontes/logs/ZIP e 75 bundles passaram localmente; bundles e segredos não enviados ao auditor, portanto não são prova independente executada por ele. |
| A9 — hash do pedido | Contrato atual aceita somente versão e chave. Se houver novos campos semânticos, serialização/hash e testes terão de evoluir juntos. Risco futuro, sem alterar contrato nesta rodada. |

Durante a repetição detalhada da Web surgiu **113/114**: o teste 1C “mantém loading sem obra antiga e informa ausência sem encerrar sessão” chamava `finish` antes de a RPC mockada atribuí-lo. A versão anterior do arquivo era idêntica byte a byte à baseline 1C (SHA-256 `0e6dc34b8f6cfefd6e1af7f8ea1679dd31d0944e60d554073bc6b0ae38266b5f`). Acrescentado `waitFor` pela função de conclusão antes de resolvê-la, mantendo todas as asserções, sem modificar a tela. A reexecução detalhada passou **114/114**. O log preserva as duas execuções e a baseline 1C permanece intocada.

O primeiro retry do transporte encontrou a API 3103 parada entre turnos (prévia 3101 e Supabase ativos). O serviço foi reiniciado em processo local de segundo plano, apenas loopback; a repetição corrigida passou 13/13. Não foi tratado erro de disponibilidade como prova de isolamento. Essas correções de evidência foram submetidas ao segundo ciclo descrito abaixo, sem ampliar o produto.

### Segundo ciclo concluído e confrontado

Enviado na mesma conversa o pacote `Metallo-Marco2B-PontoExperimental-Auditoria-20260927-Ciclo2.zip`, SHA-256 `3ce816b021dcfa6087d14cfa2d7306edeb35e6f62afc009f70f81ecab1429bd2`: 74 entradas, 73 artefatos no manifesto e delta de 60 arquivos. A baseline 1C original foi anexada separadamente após nova varredura e confirmação do hash imutável, e o relatório de segredos externo identifica ciclo1, baseline1C e ciclo2. O ZIP ciclo2 e as 33 fontes/logs e 75 bundles passaram com zero achados. O ciclo1 permanece preservado; ciclo2 não é baseline.

O parecer final `parecer-grok-ciclo2.md` e a captura `grok-ciclo2.png` foram preservados no laboratório. O Grok conferiu 73/73 hashes e tamanhos, o ZIP original 1C, as cópias byte a byte e o recibo externo. Classificou **A4 e A5 sanados**, **A8 sanado como recibo**, **A1/A2 residuais**, **A3/A7/A9 hipóteses futuras** e **A6 pendência explícita de zoom/limite de rede**. Confirmou que a mudança em Obras foi somente o `waitFor` do teste e não removeu asserções; runtime/API/schema/UI do ponto permaneceram idênticos entre ciclos. Não encontrou crítico/alto comprovado na superfície local. Não houve terceira rodada automática.

Confronto final local: a prova do transporte realmente faz novos GETs após os POSTs, o relatório contém 13 checks positivos, os logs registram os resultados declarados e as versões do produto continuam iguais às auditadas. Os limites de janela Auth/commit, controle da infraestrutura, outro runtime de concorrência, segundo host físico e bundles não reexecutados pelo auditor permanecem explícitos. Os dois pareceres são revisões estáticas independentes, não reexecuções dos testes. O auditor não autoriza baseline, publicação, ponto oficial, REP-P ou uso real; tampouco este registro o faz.

### Conferência visual posterior ao envio

O responsável autorizou expressamente o controle de zoom e sugeriu Ctrl + roda do mouse. A API de automação não oferece manter Ctrl durante a rolagem; o atalho Ctrl + 0 não mudou a escala observada e a política de segurança da ferramenta bloqueou a página interna de configurações de zoom do Edge. A automação não contornou esse bloqueio. No Edge, João sintético foi autenticado pela tela e a prévia foi inspecionada na escala atual: `devicePixelRatio=2`, `innerWidth=460`, `clientWidth=scrollWidth=453`. Aviso, botão e conteúdo são legíveis e acessíveis por rolagem vertical; não se observou overflow horizontal. Evidências: `meu-ponto-escala-ampliada.png` e `visual-escala-ampliada.json`. Esses valores, isoladamente, não medem o zoom do menu.

**Confirmação manual recebida em 27/09/2026:** ao selecionar a pendência “Falta confirmar o valor 200% no menu do Edge para registrar essa prova com precisão”, o responsável respondeu **“ta tudo ok, ja vi”**. Registrada a confirmação manual do zoom de 200% e da legibilidade, concluindo a pendência visual. O JSON existente identifica a origem manual e preserva as métricas e limitações da automação. Este complemento é posterior ao parecer final e ao ZIP do ciclo 2: não foi auditado pelo Grok, não altera os pacotes enviados e não inicia terceiro ciclo. A ausência de ensaio em segundo host físico permanece explícita. Atualizados apenas este documento, o roadmap vigente e o JSON de evidência; nenhum arquivo novo, alteração de produto, baseline ou publicação. Por ser atualização documental, não foi repetida a bateria de testes.

Na conferência visual, o núcleo foi deixado ativo para a avaliação: saúde `LAB_ONLINE`, `official=false`; listeners 3101/3103/54321 reconferidos em `127.0.0.1`. Naquele momento, ainda não havia autorização da baseline; a autorização posterior está registrada na seção de fechamento. Nenhum novo módulo, alteração remota ou publicação.

## Fonte normativa e limites

O [índice oficial MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/portarias-consolidadas) aponta para compilação da Portaria 671 em 21/07/2026. A compilação indexada de 07/01/2026 retornou 404 na URL direta e o PDF de julho não foi recuperado nesta sessão. O documento 33 e a matriz registram essa verificação; **nenhuma conformidade REP-P foi declarada**. DP e advogado trabalhista, privacidade e auditoria independente continuam gates antes de qualquer piloto com pessoas reais.
