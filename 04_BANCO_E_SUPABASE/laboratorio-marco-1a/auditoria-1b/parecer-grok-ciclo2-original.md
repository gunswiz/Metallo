Parecer 1B — Auth LOCAL — Ciclo 2 (fotografia 27/09/2026)

Método: somente leitura do ZIP Ciclo2. Nenhuma execução, API, SQL, container ou credencial. Evidências dinâmicas são as depositadas; inspeção estática não as reproduz.

Perímetro: delta de sessão/concorrência + complementos de lacuna. Quatro migrations e a regra empresarial não mudaram. O parecer do Ciclo1 está íntegro em auditoria-1b/parecer-grok-ciclo1-original.md (SHA-256 5b533dfcce0c2b24a8e53d090f737d841d15b10f07fa12ced067b5e3cb4f118e, conferido nesta sessão). A conclusão do Ciclo1 não aprova esta delta por si só.

Contabilidade (não somar com o Ciclo1): Auth real 17/17; interface/concorrência 16/16; guardas/rotas 22/22; base 682/682 (135 T15); banco 31/31; qualidade 44/44; Web 92/96 (quatro falhas Gestão idênticas); rede 8/8 com porta 3101. Ciclo1 (15/13/14/81) permanece histórico.

Estado dos achados 1B-01 … 1B-17
ID Ciclo1	Estado neste ZIP
1B-01 a 1B-02, 1B-06, 1B-10 a 1B-13, 1B-16	Mantidos. Código de ambiente, DTO, obra inerte, offline, camadas 01–07 e limites XSS/CSP inalterados no essencial.
1B-03	Complementado: rede-auth-real.json marca source: portalFetch | harness pela convenção cache=no-store deste harness. Pedidos portalFetch (90) só nos quatro caminhos pessoais; admin/revoke ficaram no harness.
1B-04	Mantido. proxy.ts da Gestão e ambienteSupabase.ts agora estão no pacote para leitura. Prévia continua sem chamar updateSession.
1B-05 / 1B-07	Reforçados: exclusão de verify passou a ser por geração, não um cadeado global. Poll 5s + aba oculta + latência seguem sem imediatismo universal.
1B-08	Complementado com oito testes de page.tsx (Host/localhost/192.168/ausente, UUID na rota, sem flags, entrega local). APIs Next simuladas.
1B-09	Complementado: verificar-rede-local.mjs aceita prévia; rede-final.json inclui 3101 em listeners loopback, loopback IPv4, Ethernet do host e rede Docker separada. Sem 2ª máquina.
1B-14	Hashes das quatro migrations idênticos ao Ciclo1 e ao campo historical_zip_sha256 declarado pelo empacotador. ZIP T15 binário não veio ao auditor.
1B-15	Sem mudança: zoom 200% real e avaliação manual pendentes.
1B-17	Reproduzido e tratado. Ver 1B2-01.
Achados do Ciclo 2
1B2-01 — 1B-17: troca cross-tab deixou de ser só hipótese
Severidade: Informativo (correção no alcance laboratorial)
Status: CONFIRMADO no código + evidência depositada (não reexecutada aqui)
Arquivo/trecho: use-colaborador-session.ts L90–98 — qualquer storage da chave (ou key === null) faz invalidate(), dispose dos clientes ativo/encerrando, zera perfil e chama verify(). O newValue não vira DTO.
Precondição: duas sessões na mesma origem; evento storage (real entre abas ou simulado no jsdom)
Risco concreto evitado: João permanecer na UI até o poll de 5s depois de Maria gravar a mesma chave
Evidência: cross-tab-antes.json — o novo teste falhou com “Olá, João” ainda no DOM; cross-tab-depois.json — o mesmo caso passou após o hook; três unitários atuais (limpeza imediata, RPC atrasada do titular velho, logout atrasado não apaga a sessão nova); integração real João↔Maria 17/17 com sessões Auth verdadeiras e evento DOM simulado
Correção mínima: já aplicada no hook; SQL intocado
Teste que o fecha: os três unitários + o par real sessão real substituída por outra aba não mistura os titulares
1B2-02 — Geração invalida login/logout/RPC tardios
Severidade: Informativo
Status: CONFIRMADO no desenho + testes de mock depositados
Arquivo/trecho: endSession L21–36 (if (ticket !== generation.current) return antes de removeItem/go("login")); verify L54–77 e login L113–120 com o mesmo ticket; checking.current === ticket (não bloqueia geração nova)
Precondição: RPC, signOut ou signIn ainda pendentes quando chega evento/nova geração
Risco concreto evitado: perfil antigo pintar depois da troca; logout local apagar a sessão que outra aba acabou de gravar
Evidência: unitários “resposta atrasada…” e “logout atrasado não apaga sessão nova”
Correção mínima: nenhuma adicional para o caso ensaiado
Teste que o fecha: já depositados
1B2-03 — Janela residual: getClient() durante signOut sem evento storage
Severidade: Baixa
Status: HIPÓTESE (não reproduzida neste ZIP)
Arquivo/trecho: endSession anula client.current e só então await signOut; getClient faz client.current ??= portalClient(...). Poll/foco no mesmo generation podem abrir outro cliente enquanto o storage antigo ainda existe
Precondição: logout local em curso, sem storage de outra aba, poll/foco no mesmo ticket
Risco concreto: flash curto do perfil antigo, ou setProfile tardio até o finally/replace incrementar a geração na troca de rota. Não autoriza outro titular: a RPC continua presa ao token que aquele cliente enviar. O caso “logout + sessão nova de outra aba” já está coberto (1B2-02)
Evidência: só leitura do fluxo; não há teste de poll-durante-logout isolado
Correção mínima (se o Work quiser fechar a hipótese): getClient recusar mint enquanto endingClient.current existir, salvo após invalidate() de storage
Teste que o fecha: signOut atrasado + verify de poll sem evento storage, assertindo que o perfil não reaparece depois de go("login")
1B2-04 — Atribuição app/harness depende da marca no-store
Severidade: Informativo
Status: CONFIRMADO como convenção do harness, não como prova criptográfica
Arquivo/trecho: colaborador-auth-real.integration.tsx L40 e afterAll L57–59; rede-auth-real.json nota explícita
Precondição: somente portalFetch deste cliente define cache: "no-store"
Risco concreto: se o harness ou outro SDK passar a enviar no-store, a etiqueta mexe. No dump atual: zero portalFetch fora da allowlist; admin só no harness
Evidência: 149 pedidos, origem única http://127.0.0.1:54321
Correção mínima: manter a nota; opcional header de teste dedicado
Teste que o fecha: o expect do afterAll já fecha o dump desta corrida
1B2-05 — page.tsx coberto por mock, não por HTTP vivo
Severidade: Informativo / lacuna residual consciente
Status: LACUNA de transporte (código + unitários presentes)
Arquivo/trecho: colaborador-seguranca.test.ts L14–30; page.tsx L13–18
Precondição: headers() e notFound() simulados
Risco concreto: regressão do regex de Host ou do notFound seria pega pelos unitários; um bind 0.0.0.0 real não é o que esses testes medem (isso cai em 1B-09/rede)
Evidência: oito casos no arquivo; 22/22 no resumo
Correção mínima: nenhuma obrigatória no Ciclo2
Teste que o fecha: HTTP vivo só faria sentido se 3101 saísse do loopback — o ensaio de rede diz que não
1B2-06 — Rede 3101 complementada; IPv6 da prévia de propósito fora
Severidade: Informativo
Status: CONFIRMADO no JSON depositado
Arquivo/trecho: verificar-rede-local.mjs ports.push(3101) e loopback 3101 só em 127.0.0.1; rede-final.json passed: true, oito checks, porta 3101 nas sondas Ethernet (não conecta) e na rede Docker separada
Precondição: launcher --hostname 127.0.0.1 --port 3101
Risco concreto residual: nenhuma 2ª máquina física (declarado). ::1:3101 não é ensaiado porque o bind da prévia é IPv4
Evidência: checks nomeados no JSON
Correção mínima: nenhuma
Teste que o fecha: já no pacote
1B2-07 — Proxy da Gestão lido; sem guarda 127.0.0.1 no helper
Severidade: Informativo
Status: CONFIRMADO
Arquivo/trecho: 01_WEB/05_ACESSO_A_DADOS/Supabase/proxy.ts (updateSession + getClaims); ambienteSupabase.ts só exige NEXT_PUBLIC_* presentes
Precondição: flags de prévia desligadas (ramo Gestão)
Risco concreto no 1B: nulo enquanto METALLO_COLABORADOR_PREVIEW|VISUAL=1 — o proxy.ts raiz 404a o que não é /colaborador e não chama updateSession. Fora da prévia, o helper da Gestão continua genérico (esperado)
Evidência: 01_WEB/proxy.ts L5–21
Correção mínima: não misturar esse helper com o guard 1B
Teste que o fecha: já existe o ramo de prévia; não ampliar Gestão aqui
1B2-08 — Comparação T15 é do empacotador, não inspeção independente do ZIP original
Severidade: Informativo / lacuna residual
Status: LACUNA (declarada com honestidade no relatório 27)
Arquivo/trecho: resumo-final.json historical_zip_sha256 = hashes locais; SHA recalculado aqui igual ao Ciclo1
Precondição: Work teve o ZIP T15 na montagem; este auditor não
Risco concreto: nenhum no SQL presente; a cadeia de custódia do T15 original continua sendo afirmação do empacotador
Evidência: bytes locais + parecer T15 DOCX intacto
Correção mínima: anexar o ZIP T15 só se o responsável quiser confronto binário por um terceiro
Teste que o fecha: sha256sum dos quatro SQL (feito nesta leitura)
1B2-09 — Bundle Next e ZIP T15 binário continuam fora
Severidade: Informativo
Status: LACUNA consciente
Arquivo/trecho: secret-scan.json do Ciclo2 (não reinspecionei o bundle, que não veio)
Risco concreto: scan de fontes/ZIP ≠ inspeção do chunk .next-local-preview
Evidência: pacote allowlist; LEIA-ME
Correção mínima: nenhuma nesta rodada final automática
Teste que o fecha: fora do limite das duas rodadas
1B2-10 — Sem crítico/alto novo na delta
Severidade: Informativo (veredito)
Status: CONFIRMADO no alcance estático + evidência depositada
Arquivo/trecho: hook, colaborador-local.ts (hash idêntico ao Ciclo1 e985c228…), migrations, RPC, UI
Precondição: este ZIP
Risco concreto: não encontrado caminho estático que misture titulares via evento, reative cliente disposed para gravar storage, aceite DTO ampliado, fale com remoto, ou altere SQL auditado
Evidência: 1B2-01…08; 17/17 e 92/96 depositados
Correção mínima: não exigida para crítico/alto
Teste que o fecha: reexecução é do Work; auditor não executa
Quesitos 1–12 (Ciclo 2)
Ambiente: intacto + page.tsx agora exercitado por mock. Middleware de prévia segue sem Gestão.
Credenciais: allowlist e scan inalterados; metadados de rede separados. CSP/dev e localStorage continuam limites.
Sessão: 1B-17 tratado; geração cobre RPC/login/logout tardios nos testes novos; hipótese 1B2-03 é residual e baixa. JWT ≠ RPC.
Revogação: igual ao Ciclo1 (poll/aba oculta). App não usa lab-revoke-auth-failure.
Isolamento: reforçado na troca de chave; RPC sem identidade escolhida.
Equipe / FK / Gestão: SQL e copy iguais.
Obra/futuros: iguais.
Offline/cache: iguais; ocorrência Edge transitória preservada.
Rede: 3101 no mesmo ensaio; sem 2ª máquina.
Regressão: 682/31/44; Web 92/96 com as mesmas quatro falhas; hashes SQL iguais.
A11y: mínimo de dev; zoom 200% e AT pendentes.
Organização: hook/dados/config/testes; proxy Gestão incluído por transparência, sem arquitetura paralela.
Respostas finais

Critérios locais 1B comprovados neste envelope (código + depósito, sem reexecução):

flags/URL/host; visual sem Auth; fetch pessoal; DTO de quatro campos; isolamento João/Maria inclusive troca de chave; equipe opcional; obra inerte; logout/revogação/ban/expiração/offline na matriz 17; disposal e geração contra resposta/logout tardios nos casos ensaiados; 3101 no ensaio de rede; page.tsx recusa Host/UUID/sem flags em unitário; migrations 1A/T05/T15 com os mesmos SHA; quatro falhas Web ainda abertas de propósito.

O que falta:

avaliação visual manual (inclui zoom 200%); ZIP T15 e bundle Next nas mãos deste auditor; HTTP vivo de page.tsx (não exigível com bind loopback já medido); prova do poll-durante-logout sem storage (1B2-03); sessão anti-XSS / CSP de produção / 2ª máquina / imediatismo de revogação.

Há bloqueador crítico/alto concreto e reproduzível?

Não, no alcance desta leitura. 1B-17 foi reproduzido como baixa, corrigido no hook e coberto por falha-antes / passagem-depois + Auth real. Não resta exploração estática de titularidade, segredo administrativo no cliente, fallback remoto no fetch 1B ou alteração das quatro migrations.

Contrato 1A / T05 / T15 intacto?

Sim, nos bytes deste ZIP. Nenhuma migration/RPC/policy/FK/permissão da Gestão foi a correção da delta. O parecer T15 original permanece no DOCX.

O responsável ainda precisa avaliar a prévia?

Sim. Este ciclo esgota a cota automática de duas rodadas. Não proponho terceira rodada. A prévia em http://127.0.0.1:3101/colaborador/login continua laboratório. Este texto não autoriza publicação, produção, REP-P, ponto oficial, funcionários reais nem remoto.