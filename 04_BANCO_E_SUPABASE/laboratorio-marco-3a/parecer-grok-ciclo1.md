Trabalhou por 3m 8s
Auditoria independente adversarial — Marco 3A ciclo 1

SIMULAÇÃO SEM VALOR OFICIAL. Inspeção passiva apenas. Não reexecutei testes, SQL, Auth, containers, endpoints nem rede. Não autorizo baseline 3A, publicação, produção, funcionários reais, ponto oficial ou REP-P.

Conferência de integridade
Item	Resultado
ZIP recebido	Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo1.zip
SHA-256 calculado	ce4c22f74533fbf9353534d82269c663538e884ade0968025a64a45ba3e67a8b
Recibo .verificacao.json	mesmo SHA-256; passed: true; 42 entradas; 1.278 itens aninhados no scan direto; findings: []
Manifesto	METALLO-3A-AUDITORIA-CICLO1; is_approved_baseline: false; 41 arquivos + o próprio manifesto = 42 entradas
Hashes do manifesto × arquivos extraídos	0 divergências de SHA-256 e tamanho
Origem declarada	METALLO-2F-LAB-20260928-R1 / 5b7b50ddf9385b58731b84852d54626c9893d0a812151e4e7cd157b568b34097 — consistente em LEIA-ME, manifesto 3A, doc 39 e BASELINE_2F_MANIFESTO.json (id 2F e is_approved_baseline: true)
ZIP 2F original	ausente de propósito (endereços de rede). O SHA-256 da origem não é recalculável neste pacote
Instantâneos 2F relevantes	hashes batem com o manifesto 2F embutido; o núcleo ponto-lab.ts não mudou (572648a2…)
Escopo declarado	laboratório local sintético; remoto intocado; sem baseline 3A

Delta 3A (36 itens no manifesto): telas Perfil/Equipe, parser personalTeam, RPC my_team_summary, provas 3A, docs e evidências. Sessão 2F foi só estendida com readTeamSummary. Destino do cliente permanece http://127.0.0.1:54321.

Síntese dos 11 eixos

No código inspecionável, a RPC my_team_summary() não tem parâmetros; resolve titular por auth.uid() → employee_portal_accounts → identidade active → epi_employees.active → profiles.not active; usa SECURITY DEFINER com search_path = ''; faz REVOKE ALL de public/anon/authenticated e GRANT EXECUTE só a authenticated. A equipe atual copia a regra 1C de my_current_work() (um vínculo vigente ou equipe-base sem histórico; ambíguo/encerrado → NULL). O DTO SQL é team_name, work_name, member_count, members[{name,profession}]. O cliente não envia team_id/employee_id e rejeita chaves extras. Isolamento João↔Maria e admin Gestão vazio estão alegados em resultado-3a.json (33/33), não reproduzidos aqui.

Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionável. Há um defeito médio de contrato cliente/SQL e várias lacunas de prova (RLS, rede física, zoom, overloads).

Achados numerados
F3A-C1-01 — Parser personalTeam rejeita profession nula/vazia que a RPC pode emitir
Severidade: MÉDIA
Status: CONFIRMADO (falha de contrato no fonte; não é vazamento)
Arquivo/linha: 01_WEB/05_ACESSO_A_DADOS/Supabase/colaborador-local.ts 37–51; 04_BANCO_E_SUPABASE/laboratorio-marco-3a/contrato-equipe.sql 37–39; contraste com PersonalProfile.profession anulável na linha 5 do mesmo TS e em my_employee_profile().
Condição necessária: equipe atual válida com pelo menos um integrante ativo cuja profession seja NULL ou só espaços (o titular pode ter profissão nula no perfil).
Caminho da falha: SQL faz jsonb_build_object('name', full_name, 'profession', profession) sem coalescer; o parser exige typeof profession === "string" && profession.trim() e lança; usePersonalDetail vira “Equipe/Perfil indisponível”.
Evidência: código lado a lado; o ensaio 3A só inseriu colegas com profissão preenchida ('Montador', 'Caldeireiro', 'Profissão de teste').
Impacto: disponibilidade fail-closed da tela; não vaza CPF/ASO. Pode bloquear Perfil inteiro porque MeuPerfil combina obra+equipe e trata throw como erro.
Correção mínima: no SQL, coalesce(nullif(trim(profession),''), 'Função não informada') ou no parser aceitar null/vazio como no perfil próprio; alinhar os dois.
Teste de aceitação: funcionário ativo sem profissão na equipe atual → RPC 200 e UI lista o nome sem alert de contrato inválido.
F3A-C1-02 — Isolamento tabular das tabelas operacionais não é auditável neste pacote
Severidade: ALTA se as políticas forem permissivas; não confirmada
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: provas-3a.mjs 66–69; ausência de policies/migrations de RLS para epi_employees, teams, employee_assignments, worksites, private.*.
Condição necessária: authenticated com GRANT/RLS que permita SELECT na própria equipe ou em colunas sensíveis.
Caminho da falha: cliente oficial só chama a RPC; um cliente modificado faria GET /rest/v1/epi_employees?select=*. O ensaio só pede id,full_name da Maria (outra equipe) e teams da equipe B. Não testa SELECT * da equipe A, nem employee_assignments, nem colunas CPF/ASO/salário.
Evidência: policies fora do ZIP; teste estreito; a doc 39 afirma que tabelas “não foram liberadas”, sem o SQL correspondente.
Impacto: se RLS for “mesmo time = linha inteira”, o DTO mínimo da RPC é contornável.
Correção mínima: incluir no pacote as policies vigentes + ensaio GET sem filtro e select=* como João, Maria, admin e anon, em epi_employees/assignments/worksites.
Teste de aceitação: todos esses GET → 401/403 ou []; nenhuma coluna proibida em qualquer linha.
F3A-C1-03 — Catálogo da RPC não fecha overloads com argumentos
Severidade: BAIXA
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: provas-3a.mjs 28–31; contrato-equipe.sql 4–6.
Condição necessária: existir public.my_team_summary(...) com parâmetros além da versão zero-arg.
Caminho da falha: oid='public.my_team_summary()'::regprocedure ancora só a assinatura vazia; o check “SECURITY DEFINER e sem argumentos” valida prosecdef e 4 colunas, não pronargs nem count(*) de overloads. Body extra é testado só contra a função zero-arg (espera HTTP ≥400).
Evidência: query de catálogo no script; função no pacote realmente não tem args.
Impacto: baixa no fonte entregue; furo de prova se o laboratório tiver overload residual.
Correção mínima: SELECT proname, pronargs, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname='my_team_summary' e exigir uma linha com pronargs=0.
Teste de aceitação: exatamente uma função; injeção de team_id/employee_id continua ≥400 e sem roster alheio.
F3A-C1-04 — Rede: prova sanitizada, sem segunda máquina física
Severidade: BAIXA (limite declarado)
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: REDE_SANITIZADA.json; doc 39 §Provas; verificar-rede-local.mjs 59; manifesto 2F residual_risks.
Condição necessária: bind/exposição fora de loopback ou alcance por outro host.
Caminho da falha: o JSON sanitizado omite IPs não-loopback, nomes de container e o rede.json bruto citado pela doc. physical_lan_test: “segundo computador físico não ensaiado”.
Evidência: 8 checks ok: true só como relato; portas 54321–54324, 54327, 3101, 3105.
Impacto: não prova LAN física; não é evidência de segunda máquina, como o próprio LEIA-ME avisa.
Correção mínima: manter o sanitizado no pacote de auditoria e um anexo interno com bind loopback verificável; ensaio com host físico extra se for exigir “rede isolada”.
Teste de aceitação: listener/bind apenas 127.0.0.1/::1; host Ethernet e um segundo computador não conectam nas portas do laboratório.
F3A-C1-05 — Zoom 200% e viewport só com aprovação manual
Severidade: BAIXA
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: 05_DOCUMENTACAO/39_MARCO_3A_MEU_PERFIL_MINHA_EQUIPE.md (aprovação 28/09/2026); manifesto visual_approval.
Condição necessária: corte/scroll horizontal ou perda de foco em 200%.
Caminho da falha: a doc admite que a automação não mediu zoom real. CSS está no pacote; comportamento visual não.
Evidência: frase de responsável; suíte UI 8/8 é jsdom, não zoom.
Impacto: acessibilidade/aceitação visual não verificável de forma independente.
Correção mínima: captura datada 100%/200% no pacote ou teste de overflow do layout.
Teste de aceitação: Perfil e Equipe sem scroll horizontal em viewport estreita e em zoom 200%, com foco visível.
F3A-C1-06 — employee_id permanece no contrato de perfil e vira key React
Severidade: BAIXA
Status: RISCO FUTURO
Arquivo/linha: my_employee_profile() (migration 1A); colaborador-app.tsx 66–68; PersonalProfile.
Condição necessária: tela futura renderizar profile.employee_id ou vazar no DOM/log.
Caminho da falha: 3A não exibe o UUID; usa-o só como key e no parser. Colegas não levam id no DTO da equipe.
Evidência: fontes; doc 39 descreve o identificador como contrato de autenticação, sem exibição.
Impacto: hoje não há exposição visual no 3A; aumenta superfície se alguém “só imprimir o profile”.
Correção mínima: manter fora do JSX; se possível, não transportar o id até a árvore de telas.
Teste de aceitação: DOM de Perfil/Equipe sem UUID de funcionário; parser de equipe continua recusando id em members.
F3A-C1-07 — my_team_summary não está em supabase/migrations
Severidade: MÉDIA (governança / deriva de ambiente)
Status: PARCIAL (intencional no laboratório; risco se “aplicar na mão” noutro destino)
Arquivo/linha: laboratorio-marco-3a/contrato-equipe.sql; pasta supabase/migrations só tem 1A/1C.
Condição necessária: função criada noutro banco sem search_path='', sem REVOKE ou com owner indevido.
Caminho da falha: DEFINER herda privilégios do owner; grant/search_path errados reabrem search-path hijack ou EXECUTE a anon.
Evidência: SQL de laboratório explícito; doc “aplicada somente no laboratório”.
Impacto: o remoto declarado intocado não recebe a função por este pacote; um apply descuidado fora do lab não tem trilha de migration.
Correção mínima: só após autorização, migration idempotente com os mesmos REVOKE/GRANT/search_path.
Teste de aceitação: catálogo pós-apply idêntico ao contrato; anon sem EXECUTE.
F3A-C1-08 — Higiene das evidências: números e hashes internos destoam
Severidade: BAIXA
Status: PARCIAL
Arquivo/linha: doc 39 (scan “1.228 itens”, rede.json); resultado-segredos-3a.json (1.280 itens, ZIP c65170cd… / 44 entradas); recibo externo (1.278 / ce4c22f7… / 42).
Condição necessária: parecer que trate o JSON interno como scan do ZIP final.
Caminho da falha: o scan embutido é de um ZIP anterior; o recibo externo é o que cobre o anexo atual. Contagens de segredos e o caminho rede.json não batem com o pacote.
Evidência: três artefatos no próprio ZIP + anexo .verificacao.json.
Impacto: não indica segredo presente; enfraquece a cadeia de custódia da prova.
Correção mínima: regenerar resultado-segredos-3a.json após o ZIP final (sem autorreferência) e alinhar a doc.
Teste de aceitação: um único SHA-256 de pacote citado em manifesto, scan interno e recibo externo.
F3A-C1-09 — Consistência Perfil/Obra/Equipe só pelo work_name
Severidade: BAIXA
Status: HIPÓTESE
Arquivo/linha: meu-perfil.tsx 18–19; RPCs 1C e 3A.
Condição necessária: duas obras ativas com o mesmo nome e resolução divergente (bug futuro na regra de vínculo).
Caminho da falha: (team?.work_name ?? null) !== (work?.work_name ?? null) aceitaria pares errados homônimos. Os algoritmos atuais são iguais, então a divergência exigiria outra falha.
Evidência: comparação por nome; work_id existe em my_current_work e não entra no DTO da equipe.
Impacto: falso “ok” em colisão de nomes; hoje improvável no sintético.
Correção mínima: devolver work_id no DTO da equipe (ainda sem ids de colegas) e comparar UUID.
Teste de aceitação: duas obras “Obra X” em equipes diferentes → Perfil falha fechado se a RPC de obra e a de equipe divergirem de id.
F3A-C1-10 — Token residual e logout: prova de RPC vazia, não de UX concorrente completa
Severidade: BAIXA
Status: PARCIAL
Arquivo/linha: provas-3a.mjs 96–98; use-colaborador-session.ts 63–107 e 157–174; use-personal-detail.ts 12–18; teste UI logout global (mock).
Condição necessária: JWT ainda válido após admin_revoke_employee_identity; tela Equipe atualiza antes do poll de my_employee_profile.
Caminho da falha: RPCs revogadas devolvem [] (200), não 401. personalTeam([]) = “Sem equipe atribuída”; o encerramento de sessão depende de verify() (foco / 5 s / hidden). Resposta atrasada é descartada por ticket/generation no fonte. Duas abas: storage descarta cliente e perfil. Logout global reusa pointRequest('/lab-point/v1/session/global') do 2F.
Evidência: fonte + JSON 33/33 + teste UI mockado; sem captura de corrida real.
Impacto: janela curta de “sem equipe” com sessão ainda pintada; alinhado ao risco residual 2F de token até expirar.
Correção mínima: se a política for “revogado = sessão morta na hora”, tratar [] de perfil e equipe como fim de sessão no mesmo tick.
Teste de aceitação: após revogar identidade, qualquer uma das duas RPCs some da UI e a tela cai no login sem roster antigo, inclusive com resposta atrasada.
F3A-C1-11 — Sufficiência geral da evidência alegada vs. o que o ZIP prova
Severidade: MÉDIA (sobre a prova, não sobre um exploit visto)
Status: PARCIAL
Arquivo/linha: manifesto results 33/33, 8/8, 125/125, 31/31, 44/44, 8/8; logs banco.log/web.log/qualidade.log/build.log; resultado-3a.json.
Condição necessária: tratar logs locais como reexecução independente.
Caminho da falha: suítes Web/banco/qualidade não incluem o ensaio PostgREST 3A (33 casos estão só no JSON/script). UI 8/8 mocka Auth/RPC. Núcleo 2F de ponto não foi alterado (bom), mas também não revalida 3A. Scan de segredos no pacote: nenhum JWT/service_role/senha Lab!… literal; menções são código do scanner e testes negativos (queryByText(/CPF|ASO…/)).
Evidência: hashes ok; logs sem tokens; known_sensitive_values: 8 no recibo = valores usados para procurar, não achados.
Impacto: o desenho 3A no fonte é coerente com 1C/2F; a execução 33/33 não é verificável passivamente.
Correção mínima: anexar output bruto (status HTTP + DTO mascarado) por check, sem senhas.
Teste de aceitação: cada check 3A com corpo sanitizado reproduzível a partir do contrato SQL.
O que o fonte sustenta (não são vulnerabilidades confirmadas)
Cadeia auth.uid() + conta portal + identidade ativa + funcionário ativo + not p.active (perfil portal ≠ Gestão).
Sem args; search_path vazio; tabelas qualificas public./private..
Cliente: allowlist de path + origem loopback; rpc("my_team_summary") sem payload.
Admin Gestão: excluído pela cláusula not p.active (e o ensaio alega data.length === 0).
Sem equipe / equipe inativa / vínculo ambíguo / encerrado / troca A→B: a regra SQL é a mesma de my_current_work().
Sem fallback remoto no adapter 3A.
Pacote sem .env, sem backups/credenciais-previa-colaborador.json, sem chave privada.
Hipóteses explicitamente não promovidas a falha
Overload secreto de my_team_summary no banco vivo.
RLS “mesmo time vê linha completa”.
Colisão de work_name.
Dois employee_assignments vigentes para a mesma equipe (active_count=2 → equipe vazia; fail-closed).
Veredito
CRÍTICO confirmado aberto: nenhum.
ALTO confirmado aberto: nenhum.
ALTO em lacuna: F3A-C1-02 (RLS/tabelas).
MÉDIO confirmado: F3A-C1-01 (contrato profession).
Baseline 3A, publicação, produção, funcionários reais, ponto oficial e REP-P: não autorizados.
Origem 2F permanece a baseline aprovada; 3A é candidato de laboratório com evidência parcialmente suficiente para o desenho e insuficiente para fechar RLS, rede física e zoom sem novo ciclo de provas.
