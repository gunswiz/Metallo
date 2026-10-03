Trabalhou por 2m 59s

Recebi os dois anexos. Conferência passiva apenas: não executei scripts, SQL, Auth, testes, containers nem rede.

Integridade
Item	Resultado
ZIP	Metallo-Marco3A-PerfilEquipe-Auditoria-20260928-Ciclo2.zip
SHA-256 calculado	21a634d04216de94e7e2fe8680800ebc9878ee7e8a936caf646e2d248f6d3c18
Recibo externo	mesmo SHA-256; passed: true; 48 entradas; 1.285 itens no scan direto (1.040 aninhados); findings: []; known_sensitive_values: 8 (agulhas de busca, não achados)
Manifesto	METALLO-3A-AUDITORIA-CICLO2; is_approved_baseline: false; 47 arquivos inventariados + o próprio manifesto = 48 entradas
Hashes manifesto × extraídos	0 divergências de SHA-256 e tamanho
Origem declarada	METALLO-2F-LAB-20260928-R1 / 5b7b50ddf9385b58731b84852d54626c9893d0a812151e4e7cd157b568b34097 — consistente em LEIA-ME, manifesto 3A, doc 39 e BASELINE_2F_MANIFESTO.json (is_approved_baseline: true)
ZIP 2F original	ausente de propósito; o SHA-256 da origem não é recalculável neste pacote
Núcleo 2F	ponto-lab.ts idêntico (572648a2…); migration 1A/T05 de perfil e AGENTS.md idênticos aos instantâneos 2F
Hash do ZIP final no ZIP	corretamente ausente (autorreferência)

Não há CRÍTICO nem ALTO confirmado e aberto no escopo local inspecionável.

Confronto F3A-C1-01 a F3A-C1-11
F3A-C1-01 — Parser personalTeam vs profissão em branco
Severidade: MÉDIA (disponibilidade; não vazamento)
Status: RESOLVIDO no fonte e na prova anexada (antes CONFIRMADO)
Arquivo/linha: contrato-equipe.sql 37–39; colaborador-local.ts 46–49; provas-3a.mjs 48 e 58; colaborador-perfil-equipe.test.tsx 126–128; resultado-3a.json check “função em branco…” e DTO de João
Condição necessária: integrante ativo com profession só de espaços (a coluna é tratada como NOT NULL no laboratório; NULL não foi o caso reproduzido)
Caminho de falha (antigo): SQL emitia "  " / vazio; o parser exigia string com trim() e lançava
Evidência atual: SQL faz coalesce(nullif(pg_catalog.btrim(member.profession), ''), 'Função não informada'); o ensaio insere '  '; o DTO anexado traz "Colega Sem Função 3A" / "Função não informada"; o parser aceita esse rótulo. Perfil próprio já usava profession?.trim() || "Função não informada"
Impacto residual: nenhum no contrato atual, se a RPC aplicada for exatamente este SQL
Correção mínima: já aplicada no laboratório
Teste de aceitação: colega ativo com profissão em branco → HTTP 200 + UI sem alerta de contrato
F3A-C1-02 — Isolamento tabular / SELECT *
Severidade: ALTA somente se as políticas fossem permissivas ao portal; no catálogo capturado, para João/Maria/anon, não o são
Status: PARCIAL (lacuna principal do ciclo 1 sanada no pacote; execução não reproduzida aqui)
Arquivo/linha: resultado-3a.json rls_policies + http_samples; provas-3a.mjs 34–36 e 79–90; policies em 20260926224000_unassigned_employee_management_scope.sql; private.is_active_user() no histórico 1A (exige profiles.active = true); config.toml 13 (schemas = ["public", "graphql_public"])
Condição necessária: authenticated portal com GRANT+RLS que devolva linha operacional
Caminho de falha: cliente oficial só chama RPC (portalFetch allowlist); cliente modificado faria GET /rest/v1/<tabela>?select=*
Evidência: catálogo vivo das quatro tabelas; João/Maria select=* → 200 e row_count: 0 nas quatro; anon → 200/0 em três tabelas e 401 em teams; admin Gestão GET epi_employees?select=id&limit=1 → 200 / 1 linha; RPC pessoal do admin → []. Isso é coerente com portal not p.active (falha is_active_user / can_operate) e admin operacional p.active
Impacto: no desenho capturado o DTO mínimo da RPC não é contornável por João/Maria/anon nessas quatro tabelas
Correção mínima: nenhuma adicional no portal; se quiserem catálogo completo, incluir with_check e GRANT anon/authenticated por tabela
Teste de aceitação: o ensaio 49/49 já cobre o critério “401/403 ou []” para os três atores

private não está em api.schemas. Separação PostgREST de private sustenta-se no config inspecionado. GRANT USAGE histórico em private para authenticated não equivale a expor tabelas no REST.

F3A-C1-03 — Overloads de my_team_summary
Severidade: BAIXA
Status: PARCIAL (consulta de catálogo agora existe no script + relato JSON; pg_proc vivo não foi visto por este auditor)
Arquivo/linha: provas-3a.mjs 32–33; contrato-equipe.sql 4–6; check “existe só a RPC pessoal sem argumentos”
Condição necessária: outra public.my_team_summary(...) com pronargs > 0
Caminho de falha: regprocedure da assinatura vazia não conta overloads
Evidência: query count(*), min(pronargs), max(pronargs) exigindo 1|0|0; fonte entregue sem args; body team_id/employee_id tratado como ≥400 no relato
Impacto: baixo no SQL do pacote
Correção mínima: já no ensaio; promover o SQL a migration só com autorização
Teste de aceitação: uma função, pronargs=0; injeção continua ≥400
F3A-C1-04 — Rede sanitizada / segundo host
Severidade: BAIXA (limite declarado)
Status: LACUNA DE EVIDÊNCIA (limite preservado; prova sanitizada ampliada)
Arquivo/linha: REDE_SANITIZADA.json; doc 39 §Provas; manifesto 2F residual_risks
Condição necessária: bind fora de loopback ou alcance por outro host físico
Caminho de falha: IPs não-loopback omitidos; physical_lan_test: "segundo computador físico não ensaiado"
Evidência: listeners Windows e bindings Docker só 127.0.0.1/::1 nas portas 54321–54324, 54327, 3101, 3105; 12 conexões positivas em loopback; 21 negativas no IP de rede do host e 21 na rede separada; firewall “habilitado” como relato
Impacto: não prova LAN física
Correção mínima: ensaio com segundo computador, se o fechamento exigir “rede isolada”
Teste de aceitação: host Ethernet e segundo PC não conectam; bind só loopback
F3A-C1-05 — Zoom 200%
Severidade: BAIXA
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: doc 39; manifesto visual_approval; CSS de Perfil/Equipe no pacote; suíte UI 9/9 em jsdom
Condição necessária: corte ou scroll horizontal em 200%
Caminho de falha: automação não mediu zoom real do navegador
Evidência: aprovação manual do responsável em 28/09/2026; CSS com min-width:0 / overflow-wrap — insuficiente como prova visual independente
Impacto: aceitação visual não verificável por este ciclo
Correção mínima: captura datada ou teste de overflow, se exigirem prova independente
Teste de aceitação: Perfil e Equipe sem scroll horizontal em viewport estreita e 200%, com foco visível
F3A-C1-06 — employee_id no contrato de perfil
Severidade: BAIXA
Status: RISCO FUTURO
Arquivo/linha: PersonalProfile; colaborador-app.tsx 66–68 (key={profile.employee_id}); parser de equipe recusa chave extra
Condição necessária: tela futura renderizar o UUID ou logá-lo
Caminho de falha: 3A não coloca o id no JSX de Perfil/Equipe; colegas não levam id
Evidência: fontes; teste UI queryByText(/CPF|ASO…/)
Impacto: hoje sem exposição visual 3A
Correção mínima: manter fora do DOM; não transportar id à árvore se o contrato 1A permitir no futuro
Teste de aceitação: DOM sem UUID de funcionário; parser de equipe recusa id em members
F3A-C1-07 — SQL só no laboratório
Severidade: MÉDIA (governança / deriva)
Status: PARCIAL (intencional)
Arquivo/linha: laboratorio-marco-3a/contrato-equipe.sql; supabase/migrations/ sem my_team_summary
Condição necessária: apply noutro banco sem search_path='', REVOKE ou owner correto
Caminho de falha: DEFINER herda privilégio do owner
Evidência: SQL explícito; doc “somente laboratório”; remoto declarado intocado
Impacto: sem trilha de migration se alguém copiar o SQL à mão
Correção mínima: migration idempotente após autorização, com os mesmos REVOKE/GRANT/search_path
Teste de aceitação: catálogo pós-apply idêntico; anon sem EXECUTE
F3A-C1-08 — Higiene de evidências
Severidade: BAIXA
Status: PARCIAL (melhorou; residual documental)
Arquivo/linha: doc 39 tabela de provas ainda cita rede.json e o scan do ciclo 1 (1.278 / ce4c22f7…); pacote 2 traz REDE_SANITIZADA.json e o recibo do ciclo 1 só como histórico
Condição necessária: parecer que trate números da doc como scan deste ZIP
Caminho de falha: o recibo que cobre este anexo é o .verificacao.json externo (21a634d0…, 48 entradas, 1.285 itens)
Evidência: manifesto e recibo externo alinhados entre si; doc 39 parcialmente defasada
Impacto: não indica segredo presente; enfraquece um pouco a custódia narrativa
Correção mínima: alinhar a tabela da doc 39 ao recibo do ciclo 2 (sem embutir o hash no ZIP)
Teste de aceitação: um SHA-256 de pacote citado só no recibo externo + manifesto de conteúdo
F3A-C1-09 — Consistência obra/equipe por work_name
Severidade: BAIXA
Status: HIPÓTESE
Arquivo/linha: meu-perfil.tsx 18–19; my_current_work() vs my_team_summary() (mesma regra de vínculo)
Condição necessária: duas obras ativas homônimas e resolução divergente
Caminho de falha: comparação por nome aceitaria falso acordo
Evidência: work_id existe só na RPC de obra; o DTO 3A não o traz. Relato JSON: nomes coincidem nos casos ensaiados
Impacto: improvável no sintético atual; não é falha observada
Correção mínima: opcional — work_id no DTO da equipe (sem ids de colegas)
Teste de aceitação: duas “Obra X” → Perfil falha fechado se os ids divergirem
F3A-C1-10 — Token residual, logout e abas
Severidade: BAIXA
Status: PARCIAL (alinhado ao residual 2F)
Arquivo/linha: provas-3a.mjs 116–118; use-colaborador-session.ts 63–107 e 157–174; use-personal-detail.ts 12–18; teste UI de logout global (mock)
Condição necessária: JWT ainda válido após revogar identidade; Equipe pinta [] antes do poll de perfil
Caminho de falha: RPCs revogadas devolvem [] (200), não 401. personalTeam([]) = “Sem equipe”. Encerrar sessão depende de verify() (foco / 5 s / hidden). Ticket/generation descarta resposta atrasada. Storage event descarta cliente. Logout global reusa /lab-point/v1/session/global do 2F
Evidência: fonte + checks de token residual vazios + UI mockada. Não há captura de corrida real de duas abas
Impacto: janela curta de “sem equipe” com chrome de sessão; não se pode tratar equipe vazia como revogação — funcionário ativo sem equipe deve permanecer (check 40 e teste UI)
Correção mínima: só se a política mudar para “revogado = sessão morta no mesmo tick” no [] de perfil
Teste de aceitação: após revogar identidade, perfil vazio encerra sessão; equipe vazia sozinha não
F3A-C1-11 — Suficiência da evidência alegada
Severidade: MÉDIA (sobre a prova, não sobre exploit visto)
Status: PARCIAL
Arquivo/linha: manifesto 49/49, 9/9, 126/126, 31/31, 44/44, 8/8; logs; resultado-3a.json com DTO e row_count
Condição necessária: tratar logs como reexecução independente
Caminho de falha: este auditor não reexecutou nada. UI 9/9 mocka Auth/RPC. Núcleo de ponto 2F intacto. Scan: sem JWT/service_role/senha literal no pacote
Evidência: hashes ok; HTTP samples sanitizados; logs sem tokens
Impacto: desenho 3A é inspecionável e coerente com 1C/2F; a execução 49/49 permanece relato
Correção mínima: já há corpo sanitizado por check essencial; basta não vender o JSON como reexecução Grok
Teste de aceitação: leitor passivo reconcilia cada check com o contrato SQL — possível para o núcleo 3A
Achados novos do ciclo 2
F3A-C2-01 — Doc vigente ainda aponta artefato ausente neste ZIP
Severidade: BAIXA
Status: PARCIAL (higiene)
Arquivo/linha: 39_MARCO_3A_MEU_PERFIL_MINHA_EQUIPE.md tabela “Rede… laboratorio-marco-3a/rede.json”
Condição: usar essa linha como evidência de rede do ciclo 2
Caminho: o pacote traz REDE_SANITIZADA.json, não rede.json
Evidência: find do ZIP; manifesto
Impacto: só custódia documental
Correção mínima: apontar o sanitizado
Teste de aceitação: todo caminho citado na doc existe no ZIP ou é marcado como anexo interno fora do pacote de auditoria
F3A-C2-02 — Dump RLS sem with_check
Severidade: BAIXA
Status: LACUNA DE EVIDÊNCIA
Arquivo/linha: provas-3a.mjs 34 (qual apenas); teams_admin_insert.condition: null no JSON
Condição: política INSERT/UPDATE permissiva no WITH CHECK
Caminho: pg_policies.qual é nulo em INSERT; o histórico 1A tem with check (private.is_admin())
Evidência: contraste JSON × SQL histórico. Não é política permissiva comprovada
Impacto: nulo para o portal (só SELECT foi ensaiado, que é o que importa ao 3A)
Correção mínima: incluir with_check no dump
Teste de aceitação: INSERT autenticado portal em teams falha
F3A-C2-03 — graphql_public permanece em api.schemas
Severidade: BAIXA
Status: RISCO FUTURO (herdado; não é bypass visto)
Arquivo/linha: config.toml 13
Condição: GraphQL expor as mesmas tabelas com RLS diferente
Caminho: PostgREST GraphQL no schema public sob as mesmas policies
Evidência: config apenas; sem ensaio /graphql/v1
Impacto: se RLS do portal continua a zerar linhas, GraphQL deve zerar também — hipótese não promovida
Correção mínima: ensaio GraphQL select=* equivalente, ou tirar graphql_public do laboratório se não for usado
Teste de aceitação: João/Maria/anon não leem roster operacional via GraphQL

Não transformo em vulnerabilidade: overload secreto no banco vivo; colisão de work_name; dois employee_assignments vigentes (o SQL falha fechado); contas portal revogadas ainda listadas no rol como funcionários ativos (é o modelo: roster = epi_employees.active, não identidade portal).

O que o fonte sustenta (não são falhas confirmadas)
Cadeia auth.uid() → conta portal → identidade active → funcionário active → not p.active
Zero argumentos; SECURITY DEFINER; search_path = ''; tabelas public. / private. qualificadas; REVOKE ALL + GRANT EXECUTE só a authenticated
Cliente: allowlist de path + origem http://127.0.0.1:54321; rpc("my_team_summary") sem payload; sem fallback remoto
Admin Gestão: leitura operacional preservada; RPC pessoal vazia
Sem equipe / equipe inativa / ambíguo / encerrado / troca A→B: mesma regra 1C; sem equipe não revoga o funcionário
DTO sem CPF/ASO/telefone/salário/EPI/ponto/ids de colegas
Pacote sem .env, sem backup de credenciais, sem chave privada
Veredito
CRÍTICO confirmado aberto: nenhum.
ALTO confirmado aberto: nenhum.
ALTO em lacuna do ciclo 1 (RLS portal nas quatro tabelas): encerrado no pacote por catálogo + amostras HTTP; a execução em si continua relato (F3A-C1-11).
MÉDIO confirmado do ciclo 1 (profissão): fechado no SQL, no parser e na prova anexada.
Restam limites declarados: segundo host físico, zoom só manual, SQL fora de migrations, comparação de obra por nome, token residual até expirar (já no residual 2F).

Marco 3A pode seguir para pedido de fechamento em laboratório, com esses limites explícitos. Isso não é baseline, publicação, produção, funcionário real, ponto oficial nem REP-P. A baseline aprovada permanece METALLO-2F-LAB-20260928-R1. Não criei baseline, não publiquei e não toquei no Supabase remoto.

SIMULAÇÃO SEM VALOR OFICIAL.
