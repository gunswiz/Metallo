Parecer 1B — Auth LOCAL (fotografia 27/09/2026, ciclo 1)

Método: somente leitura do ZIP sanitizado. Nenhuma execução de script, teste, SQL, migration, container, API, localhost ou credencial. Evidências dinâmicas abaixo são as depositadas no pacote, não reproduzidas aqui. Inspeção estática não é prova dinâmica.

Alcance: implementação 1B + testes + auditoria-1b/ + quatro migrations + catálogos/T15 de contexto. ZIPs históricos só existem como hashes referenciados.

Contabilidade (declarada, não somada): Auth real 15/15 (jsdom + SDK/JWT/PostgREST/RPC reais); interface 13/13 (mocks); guardas 14/14; base 682/682 (inclui 135 T15); banco 31/31; qualidade 44/44 (inclui banco); Web 81/85 (quatro falhas Gestão); rede 8/8. Intermediário 11/14 e a leitura offline Edge transitória estão preservados como ocorrência, não como aprovação.

Achados
1B-01 — Sem crítico/alto novo no código 1B inspecionado
Severidade: Informativo (veredito de perímetro)
Status: CONFIRMADO no alcance estático + evidência depositada
Arquivo/trecho: colaborador-laboratorio.ts, colaborador-local.ts, use-colaborador-session.ts, page.tsx, proxy.ts, my_employee_profile efetivo
Precondição: flags locais, laboratório em http://127.0.0.1:54321, avaliação só neste ZIP
Risco concreto: nenhum bypass estático de titularidade, service_role no cliente, fallback remoto no fetch 1B, DTO ampliado aceito, ou consulta operacional de obra/estoque no app
Evidência: allowlist de fetch; RPC sem parâmetro de identidade; DTO de quatro campos com rejeição fail-closed; página notFound() sem flags e fora de 127.0.0.1:\d+; proxy de prévia não chama updateSession
Correção mínima: não exigida para fechar crítico/alto neste envelope
Teste que o fecha: já coberto pela matriz 15 + guardas; reexecução dinâmica fica com o Work, não com este auditor
1B-02 — Ambiente: flags exclusivas, URL rígida, visual sem Auth
Severidade: Informativo (controle presente)
Status: CONFIRMADO (estático) / prova unitária depositada
Arquivo/trecho: 01_WEB/09_CONFIGURACOES/colaborador-laboratorio.ts L3–16; next.config.ts L4 (falha no boot); page.tsx L13–16; iniciar-previa-1b.ps1 L10–20 (--hostname 127.0.0.1 --port 3101); iniciar-previa-visual-1b.ps1 (visual = PREVIEW=0, sem cliente no app)
Precondição: processo Next iniciado pelo launcher ou com as mesmas env
Risco concreto residual: alguém subir Next sem o launcher e com flags erradas — o guard aborta URL/localhost/remoto/service_role e recusa visual+auth juntos; sem flags a rota é notFound()
Evidência: testes em colaborador-seguranca.test.ts (URL remota, 192.168.0.3, localhost, trailing slash, service_role, modos mutuamente exclusivos) constam aprovados em web-final.json
Correção mínima: nenhuma
Teste que o fecha: já existe; falta só RSC de page.tsx (ver 1B-08)
1B-03 — Credenciais: service_role não segue ao cliente; fetch pessoal
Severidade: Informativo
Status: CONFIRMADO no cliente 1B / LACUNA no bundle Next completo (não está no ZIP)
Arquivo/trecho: colaborador-laboratorio.ts L12–16 (role JWT anon); colaborador-local.ts L8–13 allowlist
/auth/v1/token|user|logout e /rest/v1/rpc/my_employee_profile; redirect: "error", cache: "no-store", timeout 6s
Precondição: portalClient usado pela sessão
Risco concreto evitado: apikey administrativa no browser; PostgREST amplo (epi_employees, admin Auth, remoto)
Evidência: secret-scan.json findings: [], passed: true; nota explícita de que termo service_role ≠ valor. rede-auth-real.json: origem única http://127.0.0.1:54321. Pedidos com cache: "no-store" só nos quatro caminhos do app. Caminhos admin no mesmo JSON têm cache: null e vêm do harness (revokePreviewAccount / banPreviewAccount), não de portalFetch
Correção mínima: na próxima evidência, separar metadados “app” vs “fixture” para não misturar admin do ensaio com o cliente
Teste que o fecha: assertiva de que ColaboradorApp nunca registra /auth/v1/admin nem admin_revoke_*
1B-04 — CSP de desenvolvimento e NEXT_PUBLIC_* sobrescritos
Severidade: Baixa (não bloqueia laboratório)
Status: CONFIRMADO
Arquivo/trecho: proxy.ts L14 script-src 'self' 'unsafe-inline' 'unsafe-eval'; launchers definem NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 (visual ainda põe publishable visual-only)
Precondição: next dev da prévia
Risco concreto: XSS na origem 3101 leria localStorage da sessão (ver 1B-06). CSP de dev não é controle de produção. Sobrescrever NEXT_PUBLIC_* reduz fallback remoto da Gestão nesta sessão, mas o módulo Gestão não veio no ZIP
Evidência: texto do relatório 27 assume o limite; app 1B não usa NEXT_PUBLIC_* — URL está hardcoded LAB_URL
Correção mínima: manter o aviso; em produção futura, CSP sem eval e sessão não baseada só em localStorage
Teste que o fecha: não aplicável a 1B lab; checklist de build produtivo futuro
1B-05 — Sessão: ciclo, disposal, JWT ≠ autorização RPC
Severidade: Informativo
Status: CONFIRMADO no desenho + evidência depositada 15/15
Arquivo/trecho: use-colaborador-session.ts (getUser depois RPC; DTO vazio → endSession; generation invalida resposta tardia; unmount faz disposePortalClient; storage adapter active=false bloqueia setItem tardio; signOut({ scope: "local" }) + remoção da chave e do -code-verifier)
Precondição: SDK 2.115.0, persistSession + autoRefreshToken
Risco concreto residual: JWT matematicamente válido até exp após logout local; autorização pessoal cai na RPC (contrato 1A). Teste depositado: token antigo após revogação → []; refresh e novo login negados; JWT 60s + espera exp+32s → HTTP 401 do PostgREST; refresh vivo recupera; sessão encerrada + token velho na UI não devolve perfil
Evidência: auth-real.json 15/15; duração do caso de expiração ~92s; config.toml jwt_expiry = 3600 restaurado; estado-final.json jwt_expiry_seconds: 3600
Correção mínima: nenhuma para o laboratório
Teste que o fecha: já depositado; não reexecutado aqui
1B-06 — Tokens em localStorage e XSS da origem
Severidade: Baixa (limite declarado, não regressão)
Status: CONFIRMADO
Arquivo/trecho: colaborador-local.ts L36–41 chave metallo-colaborador-laboratorio
Precondição: script na origem http://127.0.0.1:3101
Risco concreto: comprometimento dessa origem lê access/refresh. Senha não é persistida (limpo no submit; teste real recusa senha no storage). DTO só em memória React. Cookie de sessão próprio ausente (document.cookie === "" no ensaio jsdom)
Evidência: relatório 27 e teste UI João/Maria
Correção mínima: não tratar isto como sessão de produção
Teste que o fecha: ensaio XSS está fora do 1B; documentar basta
1B-07 — Revogação visual não é imediata (poll 5s, aba oculta, checking)
Severidade: Baixa
Status: CONFIRMADO (desenho) — atraso é inerente, não bypass de RPC
Arquivo/trecho: use-colaborador-session.ts L46–47 (if (checking.current) return), L77 poll 5s só se visible e ≠ login, L79–80 aba oculta zera perfil e incrementa generation
Precondição: identidade já revogada no servidor; UI ainda aberta
Risco concreto: até ~5s + até 6s de timeout + skip se verify já corre. Aba oculta não polla; ao voltar, revalida. RPC já devolve vazio na hora (1A). Não é push
Evidência: relatório 27; testes reais de revogação/ban com timeout 13s passaram; Edge “Revogação real com João aberto” ok
Correção mínima: se o responsável quiser teto menor, baixar o intervalo ou ouvir onAuthStateChange além do poll — sem prometer imediatismo universal
Teste que o fecha: medir percentil do atraso UI após admin_revoke com aba visível/oculta (Work)
1B-08 — page.tsx / host header sem teste RSC no pacote
Severidade: Baixa
Status: LACUNA de prova (código presente)
Arquivo/trecho: page.tsx L13–18 notFound() se env nulo, host ≠ 127.0.0.1:\d+, path fora do conjunto login|inicio|perfil|equipe|obra
Precondição: request HTTP ao Next
Risco concreto: Host header forjado só importa se 3101 não estiver preso ao loopback. Launcher usa --hostname 127.0.0.1; estado-final.json lista 3101 só em 127.0.0.1. Cliente ainda exige window.location.hostname === "127.0.0.1"
Evidência: unitários cobrem colaboradorEnvironment, não o Server Component
Correção mínima: um teste de page.tsx com headers() mockado (host localhost, 192.168.x, path UUID)
Teste que o fecha: o acima, sem subir a pilha se o Work preferir mock
1B-09 — Rede: 5432x ensaiado; 3101 só listener + bind do launcher
Severidade: Baixa
Status: LACUNA parcial
Arquivo/trecho: verificar-rede-local.mjs ports [54321,54322,54323,54324,54327]; rede-final.json 8 checks ok (loopback, Docker bind, Ethernet do host negado, rede Docker separada com controle positivo, firewall on); estado-final.json adiciona 3101 em 127.0.0.1 apenas
Precondição: Windows/Docker do ensaio original
Risco concreto: prévia Next poderia ficar em 0.0.0.0 se alguém ignorar o launcher. Não há sonda Ethernet contra 3101 no JSON de rede. Pacote não alega segunda máquina física
Evidência: physical_lan_test textual no script; config.toml [db.network_restrictions] enabled=false / 0.0.0.0/0 é CIDR interno da stack — mitigação real é o publish em 127.0.0.1/::1
Correção mínima: incluir 3101 na mesma bateria de bind/Ethernet
Teste que o fecha: estender verificar-rede-local.mjs e regenerar rede-final.json (Work; auditor não executa)
1B-10 — Isolamento João/Maria e contrato de quatro campos
Severidade: Informativo
Status: CONFIRMADO no código + evidências depositadas
Arquivo/trecho: RPC efetiva sem argumentos, where i.auth_user_id = auth.uid(); personalProfile exige exatamente as chaves employee_id,full_name,profession,team_name e um único elemento; UI não lê search params nem pinta employee_id; path UUID → notFound()
Precondição: duas contas sintéticas
Risco concreto evitado: cliente escolher titular; DTO com CPF/ASO/colegas; troca por URL
Evidência: integração .eq("employee_id", other) → [] (filtro PostgREST no resultado, não escolha de identidade); Edge “URL com ID Maria conserva João” / nova aba; UI sem ASO/CPF
Correção mínima: nenhuma
Teste que o fecha: já depositado
1B-11 — Equipe nunca bloqueia funcionário ativo; FK intacta
Severidade: Informativo
Status: CONFIRMADO
Arquivo/trecho: migration 20260926213000 LEFT JOIN teams + team_id nullable; UI Perfil “Sem equipe atribuída”, Equipe “Sem equipe atribuída no momento.”; intermediário 11/14 falhou ao DELETE teams ainda referenciada — FK epi_employees_team_id_fkey sem CASCADE
Precondição: funcionário ativo + identidade ativa
Risco concreto evitado: logout/bloqueio só por equipe inativa/NULL/removida; alargamento can_operate(..., NULL)
Evidência: hashes migration = manifesto = resumo-final = replay-migrations.json; teste real corrigido desvincula antes de apagar
Correção mínima: nenhuma
Teste que o fecha: já depositado; não alterar a FK
1B-12 — Obra/futuros sem superfície operacional
Severidade: Informativo
Status: CONFIRMADO
Arquivo/trecho: colaborador-app.tsx obra = texto fixo; cards “EM DESENVOLVIMENTO” / “EM BREVE” sem onClick operacional; nenhum site_dashboard / estoque / RPC extra no cliente 1B
Precondição: sessão válida
Risco concreto evitado: consulta ampla a partir da prévia pessoal
Evidência: código + Edge “obra sem consulta operacional”
Correção mínima: nenhuma
Teste que o fecha: guarda de portalFetch já recusa /rest/v1/epi_employees
1B-13 — Offline / cache
Severidade: Informativo
Status: CONFIRMADO com ressalva Edge
Arquivo/trecho: friendlyPortalError; login renderiza sem depender do Auth no HTML; no-store no proxy e no fetch
Precondição: supabase stop real no ensaio
Risco concreto evitado: spinner eterno, destino remoto, senha persistida
Evidência: integração 15º caso passou (status 0, origem só 54321, no-store); Edge: “Offline: erro amigável sem perfil” ok:false (estado transitório) e inspeção seguinte ok:true com a mensagem final. Não contar a primeira leitura como aprovação
Correção mínima: opcional — atrasar o anúncio de erro até o estado terminal para o runner Edge
Teste que o fecha: gate jsdom já existe; runner Edge deve esperar role=alert
1B-14 — Regressão 1A/T05/T15 e quatro falhas Web
Severidade: Informativo (Gestão ainda aberta; fora do gate 1B)
Status: CONFIRMADO nos hashes deste ZIP / LACUNA vs ZIP T15 binário (ausente)
Arquivo/trecho: SHA-256 recalculados nesta sessão, idênticos ao manifesto/resumo-final/replay-migrations:
20260925120000 cc823519e7b9cb80b2c593757cc6b150ffbf5209a69a7b4a6fd9262a8085c302
20260926213000 31edf5e9a1fc78fd138b46e83719c86afc6d68e8a6c8a4333ae5ad3cb387ba6f
20260926224000 ef8fa075c46e9652dd5e7a6a4f31b97fd54e2138adaa6980c9360452b353c8c8
20260926233500 b27a73581aa2ba3666dbc7420f5d64f3037752db04908b289c52fa40bc515dca
Precondição: arquivos presentes iguais aos hasheados na montagem
Risco concreto evitado neste pacote: delta 1B mexer SQL/policy auditada
Evidência: gestao-fontes-inalteradas.json unchanged: true (hashes Gestão das quatro falhas, datados T15); web-final.json 81/85 com as mesmas quatro razões; 31_BACKLOG_GESTAO_QUATRO_FALHAS_WEB.md; parecer T15 no DOCX: fechamento local sem crítico/alto novo, remoto intocado, 1B funcional não autorizado naquela data
Correção mínima: nenhuma em 1B; Gestão permanece backlog
Teste que o fecha: 682/31/44 depositados; auditor não reexecutou
1B-15 — Acessibilidade mínima, não certificação
Severidade: Informativo / lacuna de prova
Status: CONFIRMADO no que foi medido; LACUNA no restante
Arquivo/trecho: colaborador.module.css — texto informativo ≥14px, inputs herdam fonte, a,button { min-height:44px }, :focus-visible outline 3px #f4cd87; labels htmlFor; logout aria-label="Sair"; role="status"|"alert"
Precondição: viewport 320/390/1280 no runner
Risco concreto: zoom 200% real não medido (atalhos do browser integrado não alteraram zoom); leitor de tela / WCAG completo ausentes
Evidência: acessibilidade.json pares de contraste >4,5:1; limitações explícitas
Correção mínima: avaliação manual 200% pelo responsável (já prevista)
Teste que o fecha: inspeção visual com zoom do SO/navegador, não só CDP do runner
1B-16 — Organização 01–07
Severidade: Informativo
Status: CONFIRMADO
Arquivo/trecho: config em 09_CONFIGURACOES, dados em 05_ACESSO_A_DADOS, sessão em 03_FUNCOES_E_LOGICA/Autenticacao, UI em app/colaborador, testes próprios, evidências em laboratorio-marco-1a/auditoria-1b/
Risco concreto evitado: cliente Gestão reutilizado; sessão misturada na tela; SQL fora de 04
Evidência: árvore do ZIP; lab-revoke-auth-failure existe só no laboratório e não é importado pelo app 1B
Correção mínima: nenhuma
Teste que o fecha: grep de import já feito nesta leitura
1B-17 — Hipótese cross-tab de dois logins na mesma chave
Severidade: Baixa
Status: HIPÓTESE
Arquivo/trecho: listener storage só trata !e.newValue (logout). Login Maria na aba B escreve a mesma chave; aba A não encerra, só revalida no poll/foco
Precondição: duas abas, duas contas sintéticas, mesma origem
Risco concreto: até 5s de perfil A na UI enquanto o storage já tem B; possível corrida de auto-refresh na mesma chave. Não troca titular via RPC: cada getUser+RPC segue o token que aquele cliente enviar
Evidência: código do listener; Edge testou logout cross-tab (remoção), não login cruzado
Correção mínima: se storage newValue mudar o sub, invalidar e verify() imediatamente
Teste que o fecha: aba A João, aba B Maria login, A deve sair ou passar a Maria após o evento, nunca misturar DTO
O que os 12 quesitos mostram
#	Quesito	Resultado neste envelope
1	Ambiente	Flags exclusivas, guarda no boot e antes da anon, URL/host 127.0.0.1, visual sem cliente. Sem flags → indisponível. Middleware de prévia não chama Gestão.
2	Credenciais	Sem service_role no caminho cliente. Scan do ZIP sem findings. Fetch allowlist + no-store + redirect error. CSP/dev ≠ produção.
3	Sessão	Login/leitura/refresh/expiração/logout/token antigo/ban cobertos na evidência 15/15. Disposal e storage morto no código. JWT ≠ RPC.
4	Revogação	DTO vazio / inativo / erro → login. App não usa lab-revoke-auth-failure. Poll 5s + rede + aba oculta = atraso de UI, não de SQL.
5	Isolamento	RPC sem identidade escolhida; 4 campos; URL UUID 404; testes João/Maria depositados.
6	Equipe	Não bloqueia ativo; copy correto; FK exigiu desvínculo no intermediário. Gestão não ampliada nas migrations hasheadas.
7	Obra/futuros	Texto estático; sem RPC extra.
8	Offline/cache	Login abre; mensagem amigável no gate real; Edge teve leitura precoce. Tokens SDK ≠ sessão anti-XSS.
9	Rede	8/8 nas portas 5432x; 3101 loopback no estado-final, sem sonda Ethernet própria. Sem 2ª máquina. Pilha declarada aberta em loopback.
10	Regressão	Hashes internos batem; TAP 31/44 e Web 81/85 com as 4 falhas nomeadas; parecer T15 preservado. ZIP T15 binário não está aqui.
11	A11y	Mínimo de dev medido; zoom 200% e AT pendentes.
12	Organização	Camadas corretas; sem arquitetura paralela 1B.
Respostas finais pedidas

Critérios locais 1B comprovados neste envelope (código + evidência depositada, não reexecutada):

modo/flag/URL/host; visual sem Auth; cliente e fetch restritos; DTO mínimo fail-closed; isolamento por auth.uid(); equipe opcional sem bloqueio e sem colegas; obra inerte; logout limpa persistência visível; revogação/ban/expiração/offline no gate jsdom 15/15; hashes das quatro migrations intactos; T15/1A não reabertos no SQL presente; quatro falhas Web ainda no backlog, não “corrigidas” por skip.

O que falta (lacunas explícitas, sem inventar reprodução):

avaliação visual manual do responsável (incluindo zoom 200%); sonda de rede Ethernet para a porta 3101; teste RSC de page.tsx/Host; conferência binária com o ZIP T15 original (só hash referido); módulo 05_ACESSO_A_DADOS/Supabase/proxy da Gestão (importado, não chamado na prévia, arquivo ausente); prova cross-tab de dois logins na mesma chave; certificação WCAG/leitor de tela; qualquer afirmação sobre segunda máquina, remoto, produção ou XSS-resistência.

Há bloqueador crítico/alto reproduzível?

Não, no alcance desta auditoria somente leitura. Não foi encontrado no código 1B um caminho estático que envie service_role, fale com host remoto, aceite DTO ampliado, deixe o cliente escolher employee_id, consulte estoque/obra, ou altere policy/FK/RPC auditadas. Achados restantes são baixa/info, hipóteses ou lacunas de prova. Inspeção estática não substitui a matriz que o Work já depositou.

O contrato 1A / T05 / T15 permanece intacto neste ZIP?

Sim, internamente: bytes/hashes das quatro migrations coincidem com manifesto, resumo e replay; my_employee_profile efetivo continua quatro colunas, SECURITY DEFINER, search_path '', auth.uid(), LEFT JOIN de equipe; parecer T15 original está no DOCX e recusa publicação/remoto/ponto/REP-P. Não pude confrontar o ZIP T15 b5ff61bb… byte a byte porque ele não acompanha esta fotografia.

O responsável ainda precisa avaliar a prévia?

Sim. O próprio relatório 27 condiciona “MARCO1B FUNCIONAL EM LABORATÓRIO” a confronto desta auditoria e avaliação manual. Este parecer não autoriza publicação, produção, conformidade REP-P, ponto oficial, funcionários reais nem remoto. A prévia em http://127.0.0.1:3101/colaborador/login continua só laboratório, se o Work a mantiver aberta.

Declarações que este texto não faz: produção pronta; Gestão Web verde; imediatismo universal de revogação; sessão resistente a XSS; ensaio em segunda máquina; execução de qualquer conteúdo do ZIP pelo auditor.