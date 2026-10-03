# Marco 4A — Meu Ponto: marcação online e geolocalização por evento

**Estado em 01/10/2026: MARCO 4A — MEU PONTO ONLINE + GEOLOCALIZAÇÃO — FUNCIONAL EM LABORATÓRIO. FECHAMENTO TÉCNICO CONCLUÍDO, baseline aprovada METALLO-4A-LAB-20261001-R1 criada e verificada. Avaliação manual APROVADA; dois ciclos Grok preservados e confrontados; nenhum crítico/alto confirmado e aberto no escopo local.** Scan DIRETO do ZIP final aprovado, zero segredos confirmados. SHA final e recibos na seção 15. Não autoriza produção, publicação ou próximo marco.

**SIMULAÇÃO SEM VALOR OFICIAL.**

- NÃO IMPLANTADO NO SUPABASE REMOTO.
- NÃO LIBERADO PARA FUNCIONÁRIOS REAIS.
- NÃO É PRODUÇÃO.
- NÃO É CONFORMIDADE REP-P.
- NÃO É AUTORIZAÇÃO DE PONTO OFICIAL.
- NÃO AUTORIZA PUBLICAÇÃO.

## 1. Origem, fronteiras e organização

Origem conferida antes das alterações: **METALLO-3H-LAB-20261001-R1**, `outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip`, SHA-256 **389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd**. O ZIP permanece imutável. O inventário dessa baseline é uma seleção de fontes e evidências; não é um backup executável integral do banco ou de todo o checkout. Não se amplia a garantia do inventário para arquivos não incluídos nele.

O núcleo aprovado 2F e suas dependências são reutilizados pelas interfaces `record`, `outcome`, `history`, `checkpoint`, autorização e reconciliação. **25 fontes dos laboratórios 2B–2F presentes na origem foram comparadas e permanecem idênticas.** Não foram alterados código, SQL ou dados da instância de ponto 2F aprovada.

O 4A usa **uma instância sintética própria do mesmo núcleo PGlite**, em `backups/metallo-ponto-lab-pglite-4a`, com a âncora própria de autorização. O schema adicional `lab4a` reside nessa instância embutida, sem porta SQL/PostgREST. Isso mantém a fronteira existente entre identidade no Supabase local e registro no núcleo de laboratório. O SQL 4A não é uma migration remota nem foi aplicado ao Supabase local. Os ensaios criam exclusivamente contas/vínculos sintéticos no Supabase Docker existente.

As responsabilidades 01–07 foram preservadas. Este documento concentra decisões, matriz normativa e roteiro do novo marco. Evidências ficam em `04_BANCO_E_SUPABASE/laboratorio-marco-4a`; dados privados sintéticos permanecem em `backups`, ignorado pelo Git.

## 2. Fontes oficiais verificadas antes da implementação

Consulta realizada em **01/10/2026**. Não foi usada autoridade normativa de blog. As referências orientam a arquitetura e seus gates; não constituem parecer jurídico ou certificação do laboratório.

| Fonte oficial | Versão/data observada | Relação com o marco |
|---|---|---|
| [MTE — Registro Eletrônico de Ponto](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) | Página atualizada em 31/07/2026 | Entrada oficial para REP e leiautes vigentes |
| [MTE — Portarias consolidadas](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/portarias-consolidadas) e [Portaria 671 compilada](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/WORDPortarian671de8denovembrode2021compilada21.07.2026.pdf) | Página de 27/07/2026; PDF compilado em **21/07/2026**, 210 páginas, com alterações de 2026 | Anexo IX vigente: relógio digital, HLB, originais, ARP, redundância/HA; arts. 79, 80, 87 e 88 para comprovantes e assinaturas |
| [MTE — leiaute AFD](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf) | **Versão 004**, 6 páginas; referência da página REP de 31/07/2026 | Contrato de referência do registro tipo 7 REP-P: NSR, tempos, CPF, coletor, online/offline e hash |
| [MTE — leiaute AEJ](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-eletronico-de-jornada-aej.pdf) | **Versão 002**, 6 páginas; referência de 31/07/2026 | Tratamento posterior de jornada; fora da marcação bruta 4A |
| [Decreto 10.854/2021](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/decreto/d10854.htm) | Texto consolidado consultado em 01/10/2026 | Arts. 31 e 32: fidelidade, vedação às restrições e alterações indevidas das marcações |
| [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) | Texto consolidado consultado em 01/10/2026, incluindo alterações de 2026 | Finalidade, necessidade, transparência, hipótese legal, direitos e segurança |
| [ANPD — guia de legítimo interesse](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse) | Página modificada em 23/01/2025 | Avaliação de finalidade, necessidade e balanceamento; não aprova automaticamente GPS de empregados |
| [ANPD — RIPD](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd) | Página atualizada em **23/09/2026** | Avaliação de risco antes de eventual tratamento real |

**Divergência registrada:** documentos antigos do Marco 0 citam a compilação de 07/01/2026. O 4A segue a compilação oficial **21/07/2026**, cujo PDF foi obtido nesta rodada; não reescreve o registro histórico antigo. O 2A já citava a compilação de julho, mas relatava dificuldade de obtê-la. AFD 004/AEJ 002 coincidem com as referências desse planejamento. No PDF compilado há texto antigo riscado próximo do Anexo IX; a análise considerou o trecho vigente.

Não foi identificada nessas fontes uma obrigação genérica de GPS, geofence bloqueadora ou veredito automático de fraude. A localização do 4A é um contexto escolhido para o produto, sujeito à validação de privacidade e trabalhista antes de produção.

## 3. Arquitetura, tempo e fluxo online

1. O funcionário entra no Auth local. JWT assinado, sessão ainda ativa e RPC pessoal real resolvem `auth.uid → conta portal registrada → identidade ativa → funcionário ativo`. `private.employee_portal_accounts` é registro de provisionamento, sem coluna `status`; a revogação é representada na identidade e no Auth, não em um estado inventado nessa tabela.
2. Meu Ponto consulta relógio e histórico **sem solicitar localização**. O relógio HH:MM:SS usa uma referência do servidor e a passagem monotônica de `performance.now()`, com atualização a cada 30 segundos. Referência com mais de 60 segundos ou intervalo monotônico inválido é descartada (`--:--:--`).
3. O clique explícito gera uma chave de intenção UUID em memória. O servidor registra `marking_at` usando `clock_timestamp()` do banco local, antes da aquisição de GPS. Esse é o **momento de início da intenção recebido pelo servidor**, sujeito à latência de rede, e não uma prova do instante físico do clique.
4. Somente após o início online confirmado, o navegador faz **uma** aquisição de localização. Ausência de GPS não bloqueia a operação.
5. O contexto é persistido antes da chamada ao núcleo. O núcleo revalida autorização/sessão e a fonte 2F, incluindo a checagem antes do commit. `recorded_at` vem do commit real do núcleo e permanece separado de `marking_at`.
6. O adaptador acrescenta um recibo imutável com SHA-256 encadeado do evento completo, incluindo referência ao hash 2F. Uma queda depois do commit pode ser recuperada consultando a mesma intenção: a consulta completa o recibo de um evento existente e **nunca cria uma marcação**.
7. A UI só mostra sucesso após receber um evento confirmado. Atualiza o histórico pessoal e a referência sintética. Erro de leitura posterior não apaga o recibo confirmado nem inventa outro evento.

Transportes: Next pessoal em **127.0.0.1:3101** → `/api/ponto-online/...` → servidor 4A em **127.0.0.1:3106**. Saúde e encerramento de sessão continuam em **127.0.0.1:3105**, reutilizando o HTTP 2F através de `sessao-http.mjs`. Nessa instância 4A, `record/history/outcome/outcomeHistoric` legados são negados: POST/GET v1 de eventos/intenção retornam 404, inclusive pelo gateway Next, sem evento adicional. O núcleo e a instância aprovada 2F permanecem intactos. Identidade/Auth/RPCs utilizam exclusivamente **127.0.0.1:54321**. A Gestão usa o transporte de servidor, origem **127.0.0.1:3102**. Host, origem, método, caminho, tamanho e propriedades do pedido são validados. Não há destino remoto de reserva.

**Autoridade temporal:** relógio do sistema do servidor local usado pelo PGlite. O relógio do cliente e `captured_at` do GPS não definem a hora da marcação. **Sincronismo HLB, deriva máxima regulamentar e infraestrutura de tempo confiável NÃO foram comprovados.** O servidor informa `source=LOCAL_SERVER`, `hlb_verified=false`. Um administrador que mude o relógio do host pode afetar o tempo; a produção exige monitoramento e validação próprios.

Datas são persistidas como `timestamptz` e transmitidas em ISO UTC. O contexto **America/Fortaleza**, UTC−03:00, é preservado e usado na apresentação. Não há classificação automática Entrada/Saída/Intervalo/Retorno, cálculo de jornada, ajuste ou movimento do horário original.

### Campos e responsabilidades

| Estrutura | Campos relevantes | Função |
|---|---|---|
| `lab4a.intent` | `idempotency_key`, `auth_user_id`, `employee_id`, `marking_at`, `timezone`, `collector=BROWSER`, `online=true` | Intenção online identificada no servidor |
| `lab4a.context` | chave, `location` mínimo, `request_hash` | Contexto durável da mesma intenção; consistência do reenvio |
| `public.lab_time_event` do núcleo reutilizado | identidade/vínculo, chave, commit do servidor, sequência e hash próprios 2F | Evento confirmado original, com autorização e integridade 2F |
| `lab4a.receipt` | sequência **sintética**, chave, `event_id`, `recorded_at`, `previous_hash`, `hash_version=1`, `payload_hash` | Recibo técnico encadeado da extensão |

A cadeia do recibo inclui versão, sequência, evento, pessoa, chave, dois horários, timezone, coletor, online, contexto geográfico, hash 2F e hash anterior. **Hash não é assinatura, prova absoluta de autoria ou registro INPI.** A representação canônica 4A é diferente do leiaute AFD oficial. A sequência LAB-4A pode ter lacunas transacionais; não é declarada NSR oficial.

## 4. Geolocalização e transparência

- `getCurrentPosition` somente no fluxo iniciado pelo botão; **nenhum `watchPosition`**, trajetória, reverse geocoding ou pedido de localização no login, carregamento, navegação, leitura do histórico ou atualização do relógio.
- Opções: `enableHighAccuracy=false`, `maximumAge=0`, `timeout=8000 ms`. Watchdog próprio de 8500 ms impede uma espera sem fim. Cancelamento da tela ignora callbacks tardios. A API de aquisição única não oferece cancelamento físico equivalente a `clearWatch`; não é mantido observador nem processado resultado tardio.
- São solicitadas somente as permissões de localização do navegador durante a operação. Não são solicitados contatos, galeria, chamadas ou localização em background. O laboratório não concede permissão permanente automaticamente.
- Campos mínimos: latitude, longitude, precisão em metros e `captured_at` quando retornados válidos; `location_status`; `provider=BROWSER_GEOLOCATION`; `mock_signal=NOT_EXPOSED`. Provider identifica a API usada, não inventa se a origem física foi GPS/Wi-Fi.
- `AVAILABLE`: coordenadas válidas e precisão até 100 m. `LOW_ACCURACY`: precisão declarada acima de 100 m; limiar técnico de apresentação, **sem geofence, punição ou impedimento**.
- `DENIED`, `UNAVAILABLE`, `TIMEOUT` e `UNKNOWN`: valores geográficos nulos, marcação preservada. Fora do intervalo, NaN/null, precisão negativa, data inválida ou valor não reconhecido são `UNKNOWN`.
- O browser não fornece um sinal confiável de localização simulada. Uma alegação de `POSSIBLE_MOCK` no payload é tratada como `UNKNOWN`; não se cria veredito de fraude ou falsa capacidade de detectar FakeGPS.
- A informação anterior ao botão explica finalidade e ausência de rastreamento. **É transparência, não declaração de consentimento jurídico.**

Nos testes, coordenadas são **fictícias**. A automação no Edge não acionou a localização do computador. Para avaliação manual neste host, **negar a permissão** permite verificar a marcação sem coletar localização real; os cenários de GPS disponível/impreciso foram comprovados com dados sintéticos nos testes.

### Privacidade — gate obrigatório aberto

**VALIDAÇÃO PRIVACIDADE/LGPD ANTES DE PRODUÇÃO: NÃO CONCLUÍDA.**

| Tema | Situação do laboratório / decisão futura |
|---|---|
| Finalidade | Contexto técnico pontual de marcação sintética; sem fiscalização contínua, residência inferida ou avaliação automática do empregado |
| Necessidade | Dados mínimos por evento; não há mapa ou coordenadas na Gestão. Necessidade/proporcionalidade reais ainda devem ser justificadas |
| Duração | Massa sintética permanece no diretório ignorado durante a avaliação técnica; não foi fixado prazo jurídico de retenção real. Política, descarte e retenção futura pendentes |
| Acesso | Funcionário: seus recibos sem coordenadas. Gestão: administrador global ativo, nomes/horários/status/precisão/referência, sem coordenadas. Administrador do host tem acesso técnico residual |
| Segurança | Binds loopback, JWT/sessão/vínculo reais, DTO mínimo, originais imutáveis nas APIs, sem segredo administrativo no browser, sem fallback remoto |
| Direitos do titular | Canal, informação, acesso, correção de dados cadastrais, retenção de originais e resposta a solicitações precisam ser definidos antes de uso real; não se apaga original pela UI |
| Hipótese legal | **A validar formalmente**. A permissão de GPS no browser não resolve a hipótese legal trabalhista/LGPD |
| RIPD | Necessidade e riscos devem ser avaliados antes de tratamento real, conforme orientação ANPD |

## 5. Autorização, RLS/RPCs e imutabilidade

O cliente envia apenas chave e contexto geográfico permitido. `employee_id`, `punch_id`, `account_id`, `identity_id`, `team_id`, `work_id`, horário, coletor e outras propriedades extras são recusados; URL/querystring não troca titularidade. João e Maria não leem nem reutilizam as intenções um do outro.

Funcionário ativo com vínculo/identidade ativos **sem equipe** permanece autorizado. A equipe não define identidade. Funcionário inativo, identidade revogada ou sessão encerrada perde autorização. A camada 2F conserva sua versão de autorização/reconciliação; nenhuma regra de horário contratual, atraso, jornada, autorização do gestor ou geofence foi adicionada.

**Não foi criada RPC pessoal 4A `SECURITY DEFINER`.** São reutilizadas as RPCs já aprovadas de contexto pessoal, sessão 2E e origem 2F. A Gestão exige tanto `admin:manage` na Web quanto administrador global ativo e sessão real no servidor; administrador sem identidade pessoal não recebe autoridade para marcar. Nenhum papel de equipe ampliou sua permissão, e `can_operate(permission,NULL)` permaneceu intacta.

As três tabelas embutidas têm RLS ativada, nenhuma política permissiva e nenhum grant público de schema/tabelas/seq/funções. Não são expostas no Supabase/PostgREST. A autorização pessoal principal é feita pelo servidor confiável antes de acessar o núcleo; **RLS do banco embutido não substitui essa autorização nem protege contra o proprietário do host**. O helper de imutabilidade é um trigger comum, não uma RPC acessível ao usuário.

UPDATE/DELETE da intenção, contexto, recibo e evento original são bloqueados por triggers e não existem nas APIs. Também não há endpoint para corrigir horário, pessoa, coordenadas ou coletor. Um administrador do host ainda pode controlar arquivos, owner, relógio e âncoras: limitação preservada, sem alegação de inviolabilidade absoluta.

## 6. Idempotência, falhas e sessões

- Duplo clique: bloqueio síncrono em memória e botão ocupado. Duas abas da mesma origem: Web Locks por funcionário. Sem suporte a Web Locks, a prévia informa a necessidade de Edge compatível e não inicia o evento.
- Mesma chave e mesmo contexto: mesmo evento, mesmos horários, sem duplicação. Mesma chave com outra pessoa ou contexto modificado: negada.
- Outra ação voluntária após confirmação gera chave nova e outra marcação neutra. Não há deduplicação por janela de horário que suprima eventos voluntários.
- Retry manual reutiliza chave/contexto em memória, sem nova aquisição GPS. Resposta perdida consulta a intenção confirmada antes de exibir sucesso.
- Intenção sem commit expira após 120 segundos, **mesmo se o contexto já estava durável**. Não cria marcação tardia com horário antigo. Evento já confirmado pode ser recuperado sob autorização ativa. Expiração é uma fronteira técnica online; não compara horário contratual.
- Sem conexão: mensagem de resultado não confirmado; **sem fila offline, persistência local de intenção, sincronização automática ou POST automático ao voltar à rede**. Reabrir a tela consulta apenas o histórico confirmado. Se não houve confirmação, não há sucesso fictício.
- Troca de conta/logout desmonta operação, cancela processamento local e ignora respostas antigas. Falha de autorização limpa recibo/histórico. Uma leitura iniciada antes da marcação não sobrescreve o histórico recém-confirmado.
- A janela residual entre checagem externa Auth e commit, já documentada no 2F, não é declarada eliminada pelo 4A. As provas locais cobrem a revogação reproduzida durante a transação.

## 7. MATRIZ REGULATÓRIA

### AFD: contrato de referência, sem arquivo oficial gerado

| Campo regulamentar (AFD 004, tipo 7) | Campo atual | Estado no laboratório | Lacuna REP-P oficial |
|---|---|---|---|
| NSR | sequência 2F e `synthetic_sequence`/LAB-4A | Sequências de laboratório | NSR definitivo por estabelecimento, eventos e regras completos; lacunas do contador sintético não qualificam NSR |
| CPF | identidade pessoal interna/`worker_ref` sintético | Nenhum CPF real coletado para 4A | Cadastro e validação de CPF com hipótese legal e formato regulamentar |
| Data/hora da marcação | `marking_at` | Tempo do servidor ao iniciar intenção online | HLB/deriva, latência e estratégia de captura certificável |
| Data/hora da gravação | `recorded_at`/commit 2F | Distinta do momento da marcação | Representação de 24 caracteres do AFD e infraestrutura oficial |
| Timezone | UTC ISO + `America/Fortaleza` | Contexto preservado, UI UTC−03:00 | Formatação regulamentar completa e cenários de outros fusos |
| Coletor | `BROWSER` definido no servidor | Não aceita texto arbitrário do cliente | Mapeamento normativo `02` e demais coletores futuros |
| Online/offline | `online=true` imposto no servidor | Somente online | Representação normativa online `0`/offline `1`; offline fica para autorização posterior |
| SHA-256 | hash 2F + hash canônico encadeado 4A | Integridade técnica local | Ordem/bytes, encadeamento e demais registros do leiaute AFD vigente; hash atual não satisfaz automaticamente esse formato |

O AFD 004 define coletor mobile `01`, browser `02`, desktop `03`, dispositivo `04` e outros `05`; o valor técnico `BROWSER` não é exportação AFD. Não há arquivo AFD/AEJ falso. **AEJ e Espelho são tratamento posterior, fora da marcação bruta 4A.**

### ARP, comprovante e infraestrutura

As tabelas append-only e verificações de hash são aprendizado de armazenamento original no laboratório. **Não são denominadas ARP oficial.** A extensão usa mais de uma transação durável para intenção/contexto/evento/recibo e possui recuperação após commit reproduzida; isso não prova redundância, alta disponibilidade ou contingência regulamentares.

O recibo mostra data, horário, online, condição geográfica e referência sintética. **Não é Comprovante de Registro de Ponto oficial**: não inclui empregador/local/CPF/NSR/INPI/assinatura oficial e não atende automaticamente o PDF assinado e acesso/extratação previstos nos arts. 79/80/87/88. A futura extração deve cobrir ao menos as últimas **48 horas**, conforme a Portaria vigente. O limite técnico atual de 50 eventos não substitui esse gate.

**Gates antes de produção — TODOS NÃO CONCLUÍDOS:** validação jurídica trabalhista; CCT/ACT aplicável; DP/contabilidade; privacidade/LGPD e hipótese legal; necessidade/RIPD; política de geolocalização; registro do programa INPI; Atestado Técnico e Termo de Responsabilidade; ARP e NSR definitivos; AFD vigente; AEJ vigente; Espelho; comprovante oficial; assinaturas exigidas e ICP-Brasil quando aplicável; relógio/HLB; infraestrutura, backup, HA e retenção; resposta a incidente. Nenhum registro, aprovação MTE ou homologação foi obtido neste marco.

## 8. Interfaces e roteiro de avaliação manual

**Colaborador:** `http://127.0.0.1:3101/colaborador/ponto`.

- Mantém logo, cores Metallo e as seis opções inferiores aprovadas. Apresenta nome, relógio HH:MM:SS, explicação do GPS, botão, status acessível, recibo e últimas 50 marcações próprias. Não imprime hash, SQL ou UUID para uso comum.
- Conta sintética João está na prévia; Maria e sem equipe usam as credenciais já existentes em `backups/credenciais-previa-3h.json`. Esse arquivo é privado/ignorado; não enviar ao Grok ou copiar para documentação.
- Roteiro submetido ao responsável: **zoom pelo menu real do Edge em 100% e 200%**, texto, botão, foco, navegação inferior e rolagem vertical. A automação comprovou larguras CSS **390, 768 e 1280 px**, sem overflow horizontal da página, e não confirmou o valor numérico de zoom no menu. A avaliação manual da interface foi declarada **concluída e aprovada** no anexo da autorização desta rodada; essa aprovação não é apresentada como prova automatizada adicional de zoom.
- Para teste manual neste computador, negar a permissão de localização. A marcação deve confirmar online com a informação “Permissão de localização negada”, mantendo o horário. Não coletar localização real no laboratório sintético.
- Testar clique repetido durante envio, recibo/histórico, nova ação voluntária, sair e entrar como Maria, depois conta sem equipe. Não deve aparecer a contagem ou marcação de João em outra conta.
- Com servidor/conexão indisponível, verificar que não aparece confirmação falsa nem fila offline. Havendo resultado incerto, usar apenas a opção de verificar/reenviar a mesma intenção.

**Gestão:** `http://127.0.0.1:3102/ponto-laboratorio` → **Ponto · laboratório**, somente administrador global sintético ativo.

- Últimos 100 eventos com nome atual do funcionário, hora original e de gravação, estado da localização, precisão e referência sintética. Nome é consulta atual do cadastro, não snapshot nominal histórico; referência de pessoa permanece internamente.
- Sem mapa, latitude/longitude, hash, edição ou descarte de original. Tela estreita mantém rolagem horizontal **contida na tabela**, sem overflow horizontal da página.
- Conferir 100%/200%, nomes João/Maria, distinção de tempos e ausência de acesso para usuário não administrador. Falha de transporte nega leitura, sem fallback remoto.

Prévia, servidor e Supabase estão mantidos **somente em loopback** para essa avaliação. O laboratório não foi parado ao terminar, pois a entrega solicitada é uma prévia acessível.

## 9. Provas finais desta rodada

Resultados são apresentados separadamente; **não somar suítes sobrepostas**.

| Suíte | Resultado | Evidência |
|---|---|---|
| 4A: núcleo estendido, Auth/JWT/PostgREST reais e HTTP real | **77/77** | `laboratorio-marco-4a/resultado-4a.json` |
| Web específica 4A | **23/23**, incluída na Web completa | `01_WEB/10_TESTES/ponto-online.test.tsx` e JSON Web |
| Web completa | **246/246**, 34 arquivos | `laboratorio-marco-4a/web-completa-4a.json` |
| Regressão real 2F | **28/28** | `laboratorio-marco-2f/resultado-2f.json`, nova execução nesta rodada, fontes congeladas |
| Banco | **31/31** | `laboratorio-marco-4a/banco.log` |
| Qualidade | **44/44**, inclui a suíte Banco | `laboratorio-marco-4a/qualidade.log` |
| Rede | **8/8** | `laboratorio-marco-4a/rede.json` |
| TypeScript | Aprovado | `laboratorio-marco-4a/typecheck.log` e saída da execução |
| ESLint com zero avisos | Aprovado | `laboratorio-marco-4a/lint.log` e saída da execução |
| Build Next | Aprovado, sem publicação | `laboratorio-marco-4a/build.log` |
| Visual automatizado | 390/768/1280, foco visível; Gestão 390/1280 sem overflow da página | `laboratorio-marco-4a/visual-4a.json` e PNGs |
| Segredos, origem e fontes congeladas | **Aprovado:** 30 fontes/evidências + 182 bundles; zero segredo privado confirmado; 25 fontes congeladas idênticas | `laboratorio-marco-4a/verificacao-final-4a.json` |

As provas 4A abrangem GPS disponível/negado/indisponível/timeout/precisão alta e baixa/NaN/null/intervalos inválidos/mock não exposto; tempo do servidor e cliente alterado; reenvio e resposta perdida; João↔Maria; IDs e parâmetros injetados; sem equipe; sessão inativa/revogada; rollback reproduzido durante revogação; negação de UPDATE/DELETE; schema não exposto no PostgREST; origens externas; Gestão sem coordenadas; restart sem mudança dos originais. A Web completa preserva as regressões de login, Início, perfil, equipe, obra, EPIs, itens pessoais, comunicados e sessões. As falhas históricas da Gestão já haviam sido resolvidas em rodadas anteriores documentadas; não foram ocultadas ou removidas no 4A.

O scan inicialmente sinalizou exemplos de senha nos comentários públicos do SDK `@supabase/auth-js` e nomes JavaScript terminados em `_COOKIE`. A inspeção confirmou a origem: exemplos foram registrados por hash exato e contexto de comentário; o detector de cabeçalho foi delimitado para não confundir um identificador com um cookie. A comparação de credenciais privadas locais continua integral. A chave ANON pública do Supabase local, já aprovada para o browser, foi identificada separadamente. Nenhuma senha, chave administrativa ou sessão pessoal foi encontrada nas fontes/bundles/evidências examinados. Esse scan da implementação antecedeu o ZIP e não é apresentado como scan direto de pacote. Os scans dos pacotes de auditoria são registrados separadamente abaixo.

**Correções durante a validação:** a primeira tentativa de prova interpretava incorretamente que login da conta banida deveria retornar 200; foi corrigida a expectativa para login negado, preservando o controle. Corrigida expiração de intenção antiga mesmo com contexto durável; leitura antiga não pode apagar histórico recém-confirmado; allowlist do proxy Next ampliada apenas para o transporte local 4A; consulta de nomes da Gestão passou a buscar só os IDs dos eventos exibidos, evitando truncamento pelo limite global do cadastro; timestamp GPS fora do intervalo Date vira `UNKNOWN`; watchdog garante término de aquisição sem callback. As tentativas anteriores e respectivos estados estão no histórico do JSON 4A.

O primeiro ensaio de rede desta rodada usou o destino padrão do helper 1A e renovou `laboratorio-marco-1a/auditoria-final/rede-depois.json`. Isso foi identificado, sem modificar ZIP histórico. A repetição definitiva usa `METALLO_EVIDENCE_REVISION=4a` e registra `laboratorio-marco-4a/rede.json`; não se apresenta o arquivo renovado como uma nova prova da rodada original 1A.

## 10. Arquivos da rodada

Antes de criar, foram conferidos os helpers, transportes, tela Meu Ponto, provas e documentos existentes. Novas responsabilidades foram separadas nas camadas atuais:

| Novos arquivos | Responsabilidade nova |
|---|---|
| `01_WEB/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento.ts` | Aquisição única com validação/cancelamento/timeout |
| `01_WEB/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia.ts` | Fonte de referência e apresentação de timezone |
| `01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-online.ts` | DTO mínimo e transporte pessoal local |
| `01_WEB/05_ACESSO_A_DADOS/Ponto/ponto-gestao.ts` | Transporte de servidor com autorização administrativa |
| `01_WEB/app/api/ponto-online/[...path]/route.ts` | Gateway Next restrito ao laboratório |
| `01_WEB/app/colaborador/[[...screen]]/meu-ponto-online.tsx` | Tela de marcação online e geolocalização por evento |
| `01_WEB/app/(02_SISTEMA)/ponto-laboratorio/page.tsx` | Leitura administrativa mínima do novo marco |
| `01_WEB/10_TESTES/ponto-online.test.tsx` | Testes afetados de tempo, GPS, fluxo e cache |
| `laboratorio-marco-4a/ambiente.mjs`, `extensao.sql`, `extensao.mjs`, `servidor-4a.mjs`, `provas-4a.mjs`, `verificar-4a.py` | Ambiente local, schema adicional, adaptação do núcleo, servidor, provas e conferência final 4A |
| Este documento | Decisões, matriz regulatória e roteiro vigente 4A |

Arquivos existentes alterados: `colaborador-app.tsx` (seleção da tela 4A), `colaborador.module.css` (estilos), `sidebar-nav.tsx` (entrada administrativa local), `01_WEB/proxy.ts` (allowlist local), `laboratorio-marco-1a/verificar-rede-local.mjs` (porta 3106 e destino de evidência 4A), `MAPA_DO_METALLO.md` (localização do marco). A tela anterior `meu-ponto.tsx` e seus testes foram preservados como referência de regressão. JSONs, logs e PNGs 4A têm responsabilidade de evidência; não são documentos paralelos. O checkout já tinha alterações dos marcos anteriores, que não são atribuídas ao 4A.

## 11. Riscos e limites preservados

1. Administrador do host controla banco embutido, arquivos, relógio e âncoras. Hash local não elimina esse poder.
2. HLB e deriva/latência do relógio de produção não comprovadas. `marking_at` representa a recepção do início da intenção pelo servidor, não captura certificada do clique.
3. Queda real de energia/disco, múltiplos writers, redundância e HA da **extensão** 4A não comprovados. O fluxo usa transações sucessivas; backup/restore da extensão e sua âncora completa exigem plano próprio. As provas 2D/2F não provam automaticamente esse novo conjunto.
4. Janela residual Auth → commit, token residual e políticas de sessão/logout continuam nos limites documentados; não foram declarados eliminados.
5. GPS é informação declarada pelo browser, suscetível a simulação. Precisão não prova local físico, autoria ou fraude. Não há detector confiável de mock nesse coletor.
6. Outra máquina física não foi testada. Rede 8/8 prova binds reais de loopback, sondas pelo IP de rede e de container em rede separada com controle positivo, sem desligar firewall; não extrapola para teste físico inexistente.
7. Nome administrativo é cadastro atual; retenção, direitos, política GPS, hipótese legal/RIPD e gates REP-P permanecem abertos.
8. Limites de leitura são 50 eventos pessoais e 100 administrativos; não equivalem à extração regulamentar ou histórico completo de produção.
9. O hash versão 1 inclui objeto geográfico serializado pelo driver PGlite atual. A ordem de chaves via jsonb foi comprovada estável nesse driver; portabilidade entre drivers/representações de bigint não foi comprovada. Não reescrever hashes nem originais para antecipar mudança de infraestrutura.

**Parada da implementação original:** prévia entregue e avaliação manual aguardada. Essa etapa foi encerrada pelo responsável na autorização descrita abaixo.

## 12. Aprovação manual e autorização de auditoria

O responsável enviou em 01/10/2026 o anexo **“AUTORIZO A PRÓXIMA ETAPA DO: MARCO 4A — MEU PONTO ONLINE + GEOLOCALIZAÇÃO”** e declarou a avaliação manual **concluída e APROVADA**, após conferir a interface real. Autoriza congelamento do estado para revisão, pacote sanitizado, scan direto do ZIP, envio à sessão Grok já autenticada, preservação integral do parecer e confronto de todos os achados. Resultados 77/77, 23/23, 246/246, 28/28, 31/31, 44/44 e 8/8 permanecem como evidências anteriores à auditoria, sem somar suítes sobrepostas.

Máximo **dois ciclos Grok**, com segundo ciclo apenas se houver correção relevante. O auditor pode inspecionar passivamente arquivos/ZIP e calcular hashes no ambiente dele; não pode executar projeto, scripts/testes, SQL/migrations, banco, Auth, containers, endpoints ou rede do laboratório, nem modificar o projeto. Achados serão classificados internamente como VÁLIDO, PARCIAL, INVÁLIDO ou NÃO VERIFICÁVEL; hipótese não é falha confirmada.

Correções automáticas ficam limitadas a falhas locais, reproduzíveis e técnicas, sem mudança de produto, permissão ou decisão jurídica. Decisões de legislação/CCT/ACT, LGPD, punição, GPS bloqueador, retenção, produção ou infraestrutura paga exigem parar e relatar. Após auditoria/confronto e testes necessários, **PARAR para revisão**.

**Não autoriza baseline 4A, 4B, publicação, produção, funcionários reais, Supabase remoto ou REP-P oficial. SIMULAÇÃO SEM VALOR OFICIAL.**

## 13. Auditoria independente — ciclo 1 e confronto

Pacote enviado: **Metallo-Marco4A-MeuPonto-Auditoria-20261001-Ciclo1.zip**, SHA-256 **75c64e38022ad175a1648aeee42aaafbb8cfaf9478ea0a46f82eda4378c015c3**, **72 arquivos inventariados / 73 entradas**. Secret scan diretamente em TODAS as entradas: **zero achados**, manifesto/tamanhos/hashes conferidos, 22 valores de credenciais locais comparados somente em memória. Recibo: `outputs/...Ciclo1.zip.verificacao.json`. O pacote permanece inalterado após a correção.

[Conversa original Grok](https://grok.com/c/4602c4cb-7503-45c2-be55-b326df42e1f1). Expert, revisão passiva. O anexo foi visivelmente recebido antes do envio do prompt; o auditor confirmou o SHA-256 e os 72 hashes internos. Parecer integral preservado pelo botão **Copiar resposta**, sem editar o conteúdo, em `laboratorio-marco-4a/parecer-grok-ciclo1-original.md`, SHA-256 **d68decf352cf09b3615dfeac03dac95348299fb0c87862ddce235050a7dc5249**. Metadados e contexto: `auditoria-4a.json`. Comandos passivos declarados: hash, listagem/extração do ZIP e pesquisa de texto. Nenhuma execução independente do projeto foi alegada.

**Contagem original do auditor:** 10 achados: crítico 0, alto 1, médio 0, baixo 4, informativo 5. A conclusão original não foi aceita automaticamente. O confronto distingue achado e condição de exploração:

| ID | Severidade original | Classificação local | Confronto e resolução |
|---|---|---|---|
| F-4A-01 | Alto | **VÁLIDO — CORRIGIDO** | Reproduzido com Auth/JWT reais em núcleo descartável: POST v1 retornava 201, criava 1 original e 0 intenções/recibos/linhas Gestão 4A. `sessao-http.mjs` agora recusa operações de eventos v1 na instância 4A e preserva saúde/logout. Depois: 404, zero eventos adicionais. HTTP real 3105 e gateway Next 3101 negados; fluxo 4A continua funcional. Sem edição do núcleo congelado 2F. |
| F-4A-02 | Baixo | **INVÁLIDO como falha proposta; texto esclarecido** | A coluna `employee_portal_accounts.status` citada NÃO existe. Catálogo dentro do ZIP 1 contém somente `auth_user_id`, `registered_by`, `registered_at`; revogação real reside em `employee_identity.status` + Auth. A sugestão `a.status='active'` seria SQL inválido. Corrigida a expressão documental “conta ativa” para “conta registrada”; nenhuma regra/RPC modificada. |
| F-4A-03 | Baixo | **PARCIAL — risco de portabilidade** | `JSON.stringify` não canoniza objetos arbitrários entre drivers. Entretanto, duas ordens de entrada retornam jsonb idêntico no PGlite atual; cadeia existente/restart continuam verificáveis. Não se comprovou quebra atual nem falso aceite de adulteração. Portabilidade de driver/tipos preservada como limite futuro; originais/hash versão 1 intactos. |
| F-4A-04 | Baixo | **INVÁLIDO como lacuna do pacote** | `is_active_admin()` já é a primeira função do catálogo enviado. SHA do arquivo dentro do ZIP 1: **8902b1f16bd7a3111a71d43349f939913e9a7cccfbc428ad4c26410c5ea19571**. Definição exige `p.id=auth.uid()`, `p.active=true`, `p.role='admin'`; ACL/search_path constam. Provas reais adicionais: global ativo 200, admin inativo 403, JWT residual sem sessão ativa 403; funcionário negado na suíte 4A. |
| F-4A-05 | Informativo | **VÁLIDO — limite arquitetural conhecido** | Owner/host não é usuário PostgREST. RLS sem políticas limita papéis comuns, não proprietário. Acesso privilegiado continua risco explícito, sem alegar inviolabilidade contra administrador do host. |
| F-4A-06 | Informativo | **VÁLIDO — contexto não confiável** | GPS/precisão vêm do cliente e podem ser simulados; `AVAILABLE` não prova presença/autoria/fraude. Coordenadas não chegam aos DTOs pessoais/Gestão. Provas GPS/tempo e minimização preservadas; sem punição/detecção invasiva. |
| F-4A-07 | Informativo | **VÁLIDO — gate REP-P futuro** | Referência LAB/contadores/hash JSON não são NSR/AFD oficiais. Matriz já distingue browser 02, online 0/1, tempos e hash regulamentar. Nenhum AFD/AEJ/ARP/INPI criado ou declarado concluído. |
| F-4A-08 | Informativo | **PARCIAL — hipótese de múltiplos escritores** | A fila é de processo único; operação com múltiplos processos/escritores não foi comprovada. Nenhuma corrida na configuração atual foi demonstrada. Mantido um servidor/instância e gate futuro, sem afirmar que o ensaio de concorrência de chamadas prova múltiplos writers. |
| F-4A-09 | Informativo | **VÁLIDO — gates futuros abertos** | HLB, deriva/latência, HA/ARP, comprovante oficial, retenção e hipótese LGPD permanecem abertos. Nenhuma decisão jurídica/empresarial foi tomada nesta rodada. |
| F-4A-10 | Baixo | **PARCIAL — interpolação existe, condição não comprovada** | IDs vêm de `lab4a.intent.employee_id`, tipo SQL `uuid`, e não do cliente; banco rejeita valor malformado antes do filtro. Host proprietário corrompendo schema está fora da autoridade do funcionário. Não se comprovou injeção/IDOR; validação defensiva adicional seria opcional, não correção de bypass confirmado. |

**Confronto local do ciclo 1:** 5 VÁLIDOS (inclui o alto corrigido e limites informativos), 3 PARCIAIS, 2 INVÁLIDOS. Nenhum crítico/alto confirmado permanece aberto após a correção local. A confirmação independente está registrada no ciclo 2 abaixo. Não se transforma baixo/informativo/hipótese em vulnerabilidade alta por suposição.

### Provas após correção

- `resultado-auditoria-4a.json`: **13/13**, reprodução antes/depois descartável, exclusão de eventos v1, fluxo 4A, logout atual/global reais, catálogo, autorização Gestão ativa/inativa/sem sessão, jsonb e UUID. A gravação sombra ocorreu SOMENTE no banco descartável, não na instância da prévia/2F aprovado.
- `resultado-4a.json`: **80/80** após correção — os 77 testes anteriores preservados, mais 3 provas HTTP reais de rota v1 negada no servidor/gateway e leitura legada fechada. Os testes existentes não foram removidos/enfraquecidos.
- Web 23/23 específica e 246/246 completa; 2F 28/28; Banco 31/31; Qualidade 44/44; Rede 8/8; TS/lint/build aprovados permanecem nas evidências pré-auditoria. Nenhuma fonte Web, SQL Supabase ou fonte 2F foi modificada nesta correção; não se alega nova execução dessas suítes. Logout do adaptador foi novamente comprovado com Auth real. Não somar suítes sobrepostas.

Arquivos novos necessários nesta etapa: `sessao-http.mjs` (adaptação restrita do transporte já existente), `provas-auditoria-4a.mjs` e seu JSON (evidência específica antes/depois e confronto), `gerar-pacote-auditoria-4a.py` (pacote seletivo/scan direto), `catalogo-autorizacao-local.json` (estrutura/ACL/SQL sem linhas), `prompt-grok.md` (contrato do auditor), parecer original e `auditoria-4a.json` (proveniência). Documento vigente atualizado, sem relatório paralelo. Modificados somente `servidor-4a.mjs`, `provas-4a.mjs`, `verificar-4a.py` e documentação/evidências 4A. Baselines anteriores preservadas.

**Segundo ciclo necessário e executado:** correção concreta do F-4A-01. Pacote novo sanitizado, sem sobrescrever ciclo 1, para revisão final do bloqueio, dos testes e de TODOS os achados, incluindo as contradições F-4A-02/04. Não executar terceiro ciclo.

## 14. Ciclo 2 — parecer integral e confronto final

Pacote final: **Metallo-Marco4A-MeuPonto-Auditoria-20261001-Ciclo2.zip**, SHA-256 **f130eb6d95585078d5c98b7bf12dcf002dbc34d6500d2267add32860ea4d64f2**, **77 arquivos inventariados / 78 entradas**. O scan DIRETO de todas as entradas passou com **zero achados**, hashes/tamanhos/manifesto verificados e 22 credenciais locais comparadas exclusivamente em memória. Recibo `outputs/...Ciclo2.zip.verificacao.json`. Não é baseline; ambos os pacotes permanecem imutáveis.

O anexo carregado foi confirmado pelo nome completo antes do prompt. O auditor confirmou SHA do ZIP, 77 hashes internos e o catálogo. [Resposta original do ciclo 2](https://grok.com/c/4602c4cb-7503-45c2-be55-b326df42e1f1?rid=07798063-909e-4342-a79e-93c94f8cc0b9), preservada sem edição em `parecer-grok-ciclo2-original.md`; hash e data/contexto em `auditoria-4a.json`. Captura visual fiel da conclusão: `grok-ciclo2-final.jpg`. O auditor declarou comandos de leitura/hash/extração/comparação; não executou SQL, ensaios, Auth, containers ou rede do laboratório. Não recomputou a origem 3H, cujo ZIP não foi enviado. A verificação local da origem e das 25 fontes congeladas continua independente dessa declaração.

### TODOS os achados do ciclo 2 confrontados

| ID | Conclusão original do ciclo 2 | Classificação local e prova |
|---|---|---|
| F-4A-01 | Alto fechado no código | **VÁLIDO, corrigido e fechado localmente.** Adaptação restrita em `sessao-http.mjs` nega quatro métodos legados; serviço usa esse objeto, preservando logout/health. 13/13 comprovam antes/depois e sessões; 80/80 comprovam inclusive servidor/gateway Web reais. Não depende de ocultação na UI. |
| F-4A-02 | Retirado: erro de leitura | **INVÁLIDO.** Conferidos bytes do catálogo dentro do ZIP 1: não há coluna `status` na tabela de provisionamento. Texto documental esclarecido, sem mudar autorização/SQL. |
| F-4A-03 | Baixo residual, sem bypass atual | **PARCIAL.** Aceito limite entre drivers/tipos, sem falsificar prova de portabilidade. Ensaio comprova somente jsonb/PGlite atual e cadeia íntegra; não reescreve original. |
| F-4A-04 | Retirado: saída da ferramenta havia truncado o catálogo | **INVÁLIDO como lacuna.** Função/ACL/owner/search_path já presentes; provas reais ativo/inativo/sem sessão preservadas. A afirmação adicional “não vi enum role” não é novo achado: o catálogo também contém o CHECK de `profiles.role` (admin/engineer/leader/collaborator). Nenhuma permissão ampliada. |
| F-4A-05 | Informativo mantido | **VÁLIDO como limite de host/owner.** RLS não protege contra proprietário, já explicitado. Não é leitura cruzada de funcionário. |
| F-4A-06 | Informativo mantido | **VÁLIDO como contexto GPS não confiável.** Dados declarados não são prova de fraude/presença; coordenadas ausentes nos DTOs humanos e relógio permanece do servidor. |
| F-4A-07 | Informativo futuro mantido | **VÁLIDO como gate oficial aberto.** Sem NSR/AFD/AEJ/ARP/comprovante/REP-P/INPI oficiais; matriz não declara conclusão. |
| F-4A-08 | Informativo residual mantido | **PARCIAL.** Fila atual de um processo comprovada; múltiplos writers/instâncias não comprovados nem autorizados. Não se aceita hipótese como corrida atual reproduzida. |
| F-4A-09 | Informativo gate aberto | **VÁLIDO como limite futuro.** HLB/HA/ARP, política de retenção, privacidade e requisitos legais dependem de etapas/decisões posteriores. Sem resolver juridicamente nesta rodada. |
| F-4A-10 | Baixo residual sem injeção do titular | **PARCIAL.** Concorda-se que o ensaio prova UUID/recusa do cast, não a gramática completa do filtro PostgREST. Porém não há fonte de ID arbitrário do cliente: coluna UUID e autoria server-side. Nenhum bypass comprovado ou permissão ampliada; endurecimento opcional futuro. |

**Resultado final do auditor:** zero críticos/altos confirmados e abertos; zero médios; **dois baixos residuais** (F-4A-03/10, sem bypass confirmado), **cinco informativos**, dois achados retirados. O alto original foi corrigido e não é contado como aberto. Nenhum novo achado numerado/reproduzível foi apresentado. Classificações locais permanecem 5 VÁLIDOS, 3 PARCIAIS, 2 INVÁLIDOS; riscos informativos válidos não são vulnerabilidades locais abertas.

Não houve correção adicional após o ciclo 2 nem terceiro ciclo. Testes reexecutados nesta auditoria: **80/80 4A real e 13/13 específicos de confronto**. Demais regressões/resultados da seção 9 preservados; fontes Web/2F/SQL Supabase intactas na correção. Conferência final: 25 fontes congeladas idênticas, ZIPs/hashes/manifestos intactos, origem 3H intacta, listeners dos serviços Web/núcleo/Supabase somente `127.0.0.1`/`::1`, saúde 4A `READY`, `official=false`. A prévia continua disponível em loopback; não se declara ausência de listeners porque o laboratório está ativo para revisão.

**Parada ao terminar a auditoria:** foi recomendado solicitar autorização específica para o fechamento técnico e baseline, preservando todos os riscos/gates. A rodada de auditoria não criou baseline, 4B ou publicação. A autorização posterior e o fechamento estão descritos abaixo. Supabase remoto intocado; nenhum push/reset/migration/Auth/Storage remoto. SIMULAÇÃO SEM VALOR OFICIAL.

## 15. Fechamento técnico e baseline 4A — CONCLUÍDO EM LABORATÓRIO

Em 01/10/2026, o responsável enviou **“AUTORIZO FORMALMENTE O FECHAMENTO TÉCNICO DO: MARCO 4A — MEU PONTO ONLINE + GEOLOCALIZAÇÃO E A CRIAÇÃO DA BASELINE APROVADA EXCLUSIVAMENTE EM LABORATÓRIO”**. Autoriza somente conferências finais, baseline, ZIP, manifesto/inventário/delta, SHA-256 e secret scan DIRETO do ZIP final. Não autoriza 4B, terceiro ciclo Grok, publicação ou remoto.

Identificação: **METALLO-4A-LAB-20261001-R1**. ZIP: `outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip`. O SHA-256 FINAL e a confirmação de zero segredos estão nos recibos externos `.zip.sha256` e `.zip.verificacao.json`; não se insere o hash do próprio ZIP dentro dele, evitando autorreferência. A baseline só é válida com **passed=true, zero segredos confirmados, manifesto e hashes internos verificados e SHA exato**.

**Recibo FINAL após congelamento:** ZIP criado e reaberto, **382 arquivos inventariados / 383 entradas**, todos os tamanhos/hashes internos conferidos. SHA-256 **50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d**. Scan direto: **passed=true, ZERO SEGREDOS CONFIRMADOS**, seis PDFs herdados examinados por bytes/texto/metadados. Sete alertas brutos de cookie no arquivo histórico `laboratorio-marco-3e/provas-3e.mjs` foram triados como **NOT_SECRET**: expressões que referenciam variável em memória, sem literal de cookie; aceitação por hash exato do trecho e arquivo idêntico à origem, conforme triagem preservada no recibo 3H. Nenhuma exceção por arquivo inteiro e nenhum valor privado impresso.

Delta real 3H → 4A: **45 novos, 8 alterados, 4 removidos da seleção do ZIP**. Alterados: `sidebar-nav.tsx`, `colaborador-app.tsx`, `colaborador.module.css`, `01_WEB/proxy.ts`, helper `verificar-rede-local.mjs`, documento 38, `MAPA_DO_METALLO.md` e `LEIA-ME.md`. A diferença do documento 38 já estava no pacote auditado 4A e acrescenta o recibo externo do fechamento 2F; não foi escrita neste fechamento nem altera núcleo/SQL/dados 2F. As quatro remoções são somente capturas de navegação Grok, com hashes/justificativa no manifesto; sem apagar arquivos ou alterar baselines anteriores. **15 baselines anteriores intactas**, assim como ambos os pacotes Grok e pareceres originais.

Esta seção no workspace registra o SHA/scan calculados **depois** do ZIP. A cópia dentro da baseline preserva o documento do instante do congelamento, com identificação e condição de validade nos recibos externos; não foi regravada para incluir seu próprio hash. O ZIP está marcado somente leitura. Manifesto/inventário estão dentro dele; `.zip.verificacao.json` e `.zip.sha256` permanecem em `outputs` para conferência manual.

### Origem inequívoca e cadeia real

- Última baseline aprovada anterior: **METALLO-3H-LAB-20261001-R1**, ZIP `Metallo-Marco3H-BaselineAprovada-20261001-R1.zip`, SHA-256 **389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd**.
- Data registrada no manifesto 3H: **2026-10-01T05:12:31.360745+00:00**; **341 arquivos / 342 entradas**; manifesto, aprovação e recibo de scan conferidos.
- Cadeia existente reconstruída pelas referências SHA dos manifestos (não por nomes/mtime): **1B R1 → 1B R2 → 1C → 2B → 2D → 2E → 2F → 3A → 3B → 3C → 3D → 3E → 3F → 3G → 3H**. Os 15 ZIPs e seus hashes internos foram conferidos. R2 referencia R1 pelo campo real `r1`; a cadeia não inventa baseline de marcos que só tiveram planejamento/fechamento sem ZIP próprio.
- A baseline nova herda a seleção 3H e incorpora exclusivamente fontes/evidências auditadas 4A e artefatos de fechamento. Não é checkout executável ou backup integral; o inventário anterior não é expandido para arquivos que nunca estavam nele.

### Conferências finais necessárias

`laboratorio-marco-4a/verificacao-fechamento-4a.json` registra **passed=true**: fontes funcionais iguais ao pacote do ciclo 2; mudanças posteriores limitadas ao documento, proveniência e verificadores/evidências; 25 fontes congeladas 2B–2F intactas; cinco funções e sete tabelas com definição, estrutura, ACL/RLS iguais ao catálogo auditado.

Ensaio final pontual com login sintético transitório, token só em memória: POST v1 diretamente em 3105 e pelo gateway Next 3101 retornam **404**; histórico 4A antes/depois idêntico; nenhuma marcação nova e nenhuma localização real coletada. Sessão transitória encerrada no Auth local. Saúde **READY / official=false**, listeners Web/núcleo/Supabase somente **127.0.0.1/::1**. Sem mudança de rede ou permissões.

Resultados pós-correção preservados: **4A real 80/80**, **confronto/reprodução/sessões 13/13**. Demais resultados preservados: **Web específica 23/23**, **Web completa 246/246**, **2F 28/28**, **Banco 31/31**, **Qualidade 44/44**, **Rede 8/8**, TypeScript/lint/build aprovados. Não houve reexecução integral desses conjuntos neste fechamento nem soma de suítes sobrepostas; foi conferida equivalência do estado atual.

### Conteúdo e delta

O ZIP contém `MANIFESTO_SHA256.json` (todos os arquivos, tamanhos/hashes, origem/cadeia, deltas novos/alterados/removidos, resultados, aprovação, limites, auditorias e riscos) e `INVENTARIO_4A.json`. Os dois pareceres originais ficam integralmente preservados com seus hashes; pacotes Grok originais permanecem em `outputs`, referenciados pelo nome/SHA e acompanhados dos recibos de scan no novo ZIP. Nenhum pacote anterior foi regravado.

As capturas de navegação Grok foram excluídas apenas da **nova seleção do ZIP** para não carregar perfil/histórico da conta. Quatro capturas herdadas são registradas como removidas no delta, com hashes e justificativa; seus arquivos e baselines originais continuam intactos. Não há remoção de fonte funcional. PDFs sintéticos/pareceres herdados são examinados por bytes, texto e metadados; só a logo é mantida como imagem. Não foram editados pareceres/PDFs históricos.

Novo arquivo necessário: `gerar-baseline-4a.py`, responsabilidade específica do congelamento 4A autorizado, reutilizando os helpers existentes por AST sem executar geradores históricos. Novo JSON de conferência tem responsabilidade de evidência; este continua sendo o documento vigente. Organização 01–07 preservada.

### Auditoria, regras e riscos preservados

F-4A-01 permanece **VÁLIDO + REPRODUZIDO + CORRIGIDO + FECHADO**. F-4A-02/04 INVÁLIDOS; F-4A-03/08/10 PARCIAIS; F-4A-05/06/07/09 VÁLIDOS como riscos arquiteturais/futuros. **Zero críticos/altos confirmados abertos, zero médios, dois baixos residuais, cinco informativos. Dois ciclos concluídos; nenhum terceiro.** Os metadados da auditoria que dizem “baseline não criada” são a fotografia datada do encerramento daquela etapa; o manifesto/recibo desta baseline registram a autorização posterior.

Preservados: servidor como fonte autoritativa; `marking_at` separado de `recorded_at`; Fortaleza; GPS pontual após ação explícita, sem rastreamento, bloqueio por ausência/negação/baixa precisão ou punição/fraude automática; originais imutáveis pelas APIs e correções futuras aditivas/auditáveis; identidade server-side, João/Maria isolados, ativo sem equipe autorizado, equipe NULL sem acesso global; idempotência sem fila offline; hash técnico sem alegação de assinatura/autoria/ICP-Brasil; Gestão readonly para global ativo, sem coordenadas no DTO comum. Núcleo 2F preservado; 4A é extensão, não substituição.

Riscos mantidos integralmente: portabilidade do hash, filtro interno por UUID, host/relógio/âncoras privilegiados, GPS declarado/FakeGPS/spoofing, múltiplos writers/queda real/backup-restore da extensão não comprovados, janela Auth→commit/token/sessões, nomes cadastrais atuais e limites 50/100, ausência de ensaio em segunda máquina física, gates legais/CCT/ACT/DP, REP-P/HLB/ARP/HA/NSR/AFD/AEJ/comprovantes/assinaturas/INPI não concluídos, decisões LGPD/finalidade/hipótese/retenção/direitos/RIPD e infraestrutura oficial pendentes. Não há homologação, certificação, parecer jurídico favorável, aprovação MTE/ANPD ou prontidão legal para produção.

**FECHAMENTO TÉCNICO DO 4A CONCLUÍDO EM LABORATÓRIO; BASELINE VERIFICADA. TRABALHO PARADO.** Nenhum 4B iniciado, terceiro ciclo Grok ou publicação. Supabase remoto permaneceu intocado. **SIMULAÇÃO SEM VALOR OFICIAL. NÃO IMPLANTADO NO SUPABASE REMOTO. NÃO LIBERADO PARA FUNCIONÁRIOS REAIS. NÃO É PRODUÇÃO. NÃO É CONFORMIDADE REP-P. NÃO É AUTORIZAÇÃO DE PONTO OFICIAL. NÃO AUTORIZA PUBLICAÇÃO.**
