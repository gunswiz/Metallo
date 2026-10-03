# Marco 3B — Meus EPIs (funcional em laboratório)

**Origem imutável:** `METALLO-3A-LAB-20260928-R1`, SHA-256 `907e26c0b51fdd781a2233a03782c31349630ab3e9dc61e5f96ada0005d52c4a`, conferida antes do trabalho. **Marco 3B — Meus EPIs funcional em laboratório.** O responsável aprovou a prévia atualizada em 100% e 200% e autorizou o fechamento formal e a baseline `METALLO-3B-LAB-20260928-R1` em 28/09/2026. O SHA-256 da baseline consta no recibo externo do ZIP. Isso não autoriza publicação ou alteração do Supabase remoto.

## Modelo existente e fonte de verdade

| Parte | Papel no modelo | Uso no portal 3B |
| --- | --- | --- |
| `epi_employees` | Funcionário e estado `active`; equipe opcional | Verifica titular ativo, sem exigir equipe ou obra. |
| `epi_items` | Catálogo de EPI, uniforme e ferramenta pessoal | Fornece nome e unidade. A consulta restringe `item_kind = 'epi'`. |
| `epi_employee_item_sets`, `epi_employee_items` | Conjunto configurado e quantidade recomendada | Não prova entrega nem posse; não é exibido. |
| `epi_deliveries` | Entregas, quantidade, CA e variante registrados no ato, motivo, estado e encerramento | **Fonte de verdade do 3B.** `current_status = 'active'` compõe “Registros ativos”; estados `returned`, `replaced`, `lost`, `damaged` e `consumed` compõem Histórico. Fechamento parcial cria uma linha encerrada e reduz a quantidade da linha ativa. |
| `epi_monthly_acknowledgements` | Confirmação mensal por funcionário | Não liga a confirmação a uma entrega específica; o portal não afirma “entrega confirmada”. |
| RPCs operacionais (`register_epi_delivery*`, `fulfill_epi_request`, fechamento) | Mutação na Gestão | Não são usadas nem liberadas pela tela pessoal. |

`delivery_reason` só possui `initial`, `replacement` e `additional`; ele descreve o tipo de entrega, não o motivo factual da troca. `note` e `lot_snapshot` são administrativos. A tela não infere desgaste, perda, prazo de validade, situação normativa do CA ou vencimento do EPI. O nome vem do catálogo atual; não há snapshot histórico do nome. O CA exibido vem exclusivamente de `ca_snapshot` na entrega e fica oculto quando ausente. Tamanho/variante vem de `variant_snapshot`. O código da unidade é traduzido apenas para singular/plural em português.

## Contrato pessoal e segurança

`04_BANCO_E_SUPABASE/laboratorio-marco-3b/contrato-epis.sql` define `public.my_personal_epi()` sem argumentos. O caminho é `auth.uid()` → `private.employee_portal_accounts` → `private.employee_identity.status = active` → `public.epi_employees.active` → próprias entregas EPI. A consulta não usa `team_id` ou obra para titularidade. `SECURITY DEFINER` tem `search_path = ''`, nomes qualificados, proprietário `postgres` verificado no catálogo local, `EXECUTE` apenas para `authenticated` e nenhum `SELECT *`. Não muda RLS ou grants das tabelas operacionais. A função foi aplicada **somente** ao banco Docker local; não foi adicionada às migrations remotas.

O retorno mínimo é: `item_name`, `ca_number`, `quantity`, `unit`, `variant`, `delivered_at`, `delivery_reason`, `current_status`, `closed_at`. Não retorna IDs de funcionário, item, lote ou entrega; CPF, ASO, salário, dado médico, fornecedor, custo, estoque, observações, ator administrativo, assinatura ou hashes. O adaptador local aceita somente a rota RPC exata, valida essas nove chaves e recusa ampliação do DTO. URL e API ficam fixas em `127.0.0.1`; não há fallback remoto.

## Interface e estados

Rota: `http://127.0.0.1:3101/colaborador/epis`. Atalho do Perfil, acesso rápido do Início e navegação desktop/mobile ativados. A tela segue a identidade visual e a logo existentes. Seção **Registros ativos** mostra lançamentos com estado ativo; **Histórico**, os encerrados com estado e data de encerramento registrada. Sem EPI, exibe “Nenhuma entrega ativa registrada no momento.” e preserva o acesso. “Registrado em” expressa a data do lançamento administrativo; a tela informa que não comprova recebimento ou aceite do titular. Erro de rede descarta a lista e exibe “Dados de EPIs temporariamente indisponíveis.” com tentativa novamente. Troca de conta entre abas, foco, saída e mudança de visibilidade limpam a apresentação antes de nova leitura. Nenhum dado EPI é persistido em cache próprio.

Os dados de três cartões adicionados à conta **João Sintético** para a prévia são fictícios e locais: duas entregas ativas e uma substituída. Não são dados da empresa. A tela foi verificada no Edge com larguras efetivas de 1280, 640 e 375 pixels CSS; não houve rolagem horizontal nem texto truncado. **O responsável aprovou manualmente a prévia atualizada, após os dois ciclos de auditoria, em 100% e 200% em 28/09/2026.** A navegação tem headings em ordem, listas/pares termo-valor semânticos, estado vazio e erro anunciados, links e botão de nova tentativa com foco visível. Não há fonte de 12px no módulo.

## Provas locais

- `04_BANCO_E_SUPABASE/laboratorio-marco-3b/provas-3b.mjs` e `resultado-3b.json`: **48/48** com Auth, JWT e PostgREST reais locais após o confronto do ciclo 1. João/Maria isolados, atual/histórico, DTO mínimo, CA da entrega, nenhum uniforme como EPI, acesso operacional direto negado, seis campos de ataque em body e querystring, ID de entrega na URL, `select=*`, funcionário inativo com entrega existente, ativo sem EPI, estado sem equipe e obra realmente desativada, fechamento parcial 3→2+1, JWT residual revogado, novo login e refresh após revogação.
- `01_WEB/10_TESTES/colaborador-epis.test.tsx`: **10/10** para tela, estado vazio, troca de conta, atualização por foco, sessão expirada, indisponibilidade, logout demorado, parser/segredos, allowlist e rota local. O teste vigente de Perfil foi atualizado para o novo atalho. A saída global segue coberta pela regressão do Perfil.
- Web completa **136/136** após as correções; banco **31/31**; qualidade **44/44**. Essas suítes se sobrepõem e não devem ser somadas. TypeScript, lint e build aprovados. Rede local **8/8**, incluindo loopback, Ethernet e container em rede separada, com firewall habilitado; segundo computador físico permanece não testado. Secret scan local **0 achados** em 11 fontes e 76 bundles; cada ZIP de auditoria é escaneado diretamente antes do envio. Uma execução concorrente intermediária ficou em 135/136 por falha intermitente no ensaio anterior de recuperação de Minha Equipe; o arquivo isolado passou 9/9 e a suíte Web seguinte passou 136/136. A causa exata da intermitência não foi demonstrada; o teste não foi removido ou enfraquecido.

## Auditoria independente e confronto — ciclo 1

O pacote `Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo1.zip` tem 45 entradas, SHA-256 `4a6c28843655bbf6ddce8f885c63995ea1faac954c4954d74cd8a1e39d8d58a9`, scan direto sem achados e foi recebido em `https://grok.com/c/4cd82660-8e40-4b7a-8074-ff725d013afb`. O parecer original integral está em `04_BANCO_E_SUPABASE/laboratorio-marco-3b/parecer-grok-ciclo1.md`; seu texto sem a quebra final tem SHA-256 `f6b8510341e68f83700ff319b0ef246bfec63c768bd1cbff937bfa3db5a233df`. O auditor leu/extraiu o ZIP e calculou hashes por comandos passivos; não executou projeto, SQL, testes, Auth ou rede. Nenhum crítico/alto confirmado e aberto.

| Achado | Confronto local | Situação |
| --- | --- | --- |
| F-3B-01 | **PARTIAL.** A baseline 3A foi revalidada localmente pelo hash antes de empacotar; seu ZIP não foi enviado por conter endereços da máquina. Manifesto e versões anteriores relevantes constam no pacote. | Limite de verificação independente preservado. |
| F-3B-02 | **PARTIAL.** O script consulta `pg_proc`/ACL reais, mas o ciclo 1 só anexou os booleanos. O resultado 48/48 agora inclui valores sanitizados de owner, DEFINER, search_path, ACL e contagem de assinaturas. | Evidência ampliada para o ciclo 2; auditor ainda não executa o banco. |
| F-3B-03 | **VALID.** `CREATE OR REPLACE` sozinho não impedia overload preexistente. O SQL local agora aborta se houver outra assinatura e fixa explicitamente o proprietário postgres. | Corrigido no laboratório e reaplicado. |
| F-3B-04 | **VALID.** “Recebido em”/“Em uso” podiam sugerir aceite. A tela agora diz “Registrado em”, “Registros ativos” e informa que não comprova recebimento/aceite. | Corrigido; UI 10/10 e Web 136/136. |
| F-3B-05 | **VALID.** Nome/unidade vêm do catálogo vivo; renomear ou reclassificar item pode alterar/ocultar o histórico. A tela explicita o primeiro limite; não há snapshot histórico no esquema. | Risco residual de integridade; requer decisão de modelo antes de promoção. |
| F-3B-06 | **VALID.** Faltava ensaio de fechamento parcial. O teste real agora fecha 1 de 3 e comprova 2 ativos + 1 encerrado, data/CA iguais e total 3. | Lacuna de teste sanada; apresentação permanece em duas seções, com rótulo de registro. |
| F-3B-07 | **VALID.** O antigo ensaio “sem obra” apenas repetia “sem equipe”. Agora cria obra, verifica a obra pessoal, desativa a obra e só então consulta os EPIs. | Corrigido; 48/48. |
| F-3B-08 | **PARTIAL.** O teste real verificou João/Maria, admin e tabelas diretas; agora o JSON inclui status/contagens sanitizados de cada chamada operacional. | Evidência ampliada, sem afirmar reprodução pelo auditor. |
| F-3B-09 | **PARTIAL.** O SQL corta EPIs após revogação; o ban Auth é aplicado pelo helper de servidor local. O helper entra no pacote do ciclo 2, sem credenciais. | Testes locais de JWT antigo, login e refresh passam; janela residual geral continua risco herdado. |
| F-3B-10 | **VALID como risco futuro.** A função existe só no laboratório por decisão expressa. | Sem publicação/migration remota. |
| F-3B-11 | **INVALID como ausência de scan.** O recibo externo do ZIP 1 registra hash idêntico e zero achados; não cabe dentro do próprio ZIP por autorreferência. | Recibo incluído no ciclo 2. |
| F-3B-12 | **NOT VERIFIABLE.** Rede 8/8 local e sanitizada; segundo computador físico não ensaiado. | Limite residual mantido, sem inferir produção. |
| F-3B-13 | **INVALID como falha do produto.** Auditoria somente leitura proíbe reexecução; logs são evidência local, não reprodução independente. | Declaração explícita mantida. |

O ciclo 2 foi o último autorizado. Nenhum achado de baixo risco foi ocultado ou tratado como crítico/alto sem prova. A alteração textual da tela permanece disponível na prévia local para avaliação, sem publicação.

## Auditoria independente e confronto — ciclo 2 final

O segundo e último pacote `Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo2.zip` tem 49 entradas, SHA-256 `5f1530ae05644bd267ba99692b0eddc6915d336fbe9546587d19e9dc083f4f79`, scan direto com zero achados e foi recebido em `https://grok.com/c/fb2b5d3c-66f7-430a-8f55-6bce1f2dc69a`. O parecer original integral está em `04_BANCO_E_SUPABASE/laboratorio-marco-3b/parecer-grok-ciclo2.md`; seu texto sem quebra final tem SHA-256 `5804ef805a073289744ed5fef7139d1a2c0423bac24b8b4122365c794c82116d`. O auditor confirmou hash e inventário por inspeção passiva; não reexecutou projeto, SQL, Auth, testes ou rede.

O confronto final de **cada** F-3B-01 a F-3B-13 está no parecer integral e deve ser lido junto da tabela local acima. Em resumo: F-3B-03 e 04 foram fechados no código; F-3B-06 e 07 tiveram a lacuna de ensaio sanada; F-3B-11 teve o recibo do ciclo 1 conferido. F-3B-02, 08 e 09 continuam parcialmente verificáveis pelo auditor, pois o runtime só foi executado localmente. F-3B-01, 12 e 13 permanecem limites da auditoria passiva e de rede física. F-3B-10 continua risco de promoção futura. **F-3B-05 permanece confirmado e aberto:** nome/unidade históricos seguem o catálogo atual e uma mudança de `item_kind` pode omitir linha. O texto explicativo da tela não corrige o esquema.

Dois achados novos foram confrontados:

| Achado | Confronto local | Situação |
| --- | --- | --- |
| F-3B-14 | **INVALID como falha de scan.** O recibo externo do ZIP 2 foi criado após fechar o artefato, com SHA-256 idêntico, 49 entradas e `findings: []`. Ele não pode integrar o próprio ZIP por autorreferência. | Recibo em `outputs/Metallo-Marco3B-MeusEPIs-Auditoria-20260928-Ciclo2.zip.verificacao.json`; limite de inspeção do auditor preservado. |
| F-3B-15 | **VALID como risco residual de apresentação.** Fechamento parcial aparece em registros ativos e histórico, com mesma data/CA; o ensaio 3→2+1 prova quantidades, mas não há agrupamento visual. | Baixo; deve ser decidido e tratado antes de uso real, sem confundir com vazamento ou dupla entrega comprovada. |

**Nenhum CRÍTICO ou ALTO confirmado e aberto no escopo local.** O responsável autorizou depois o fechamento formal e a baseline 3B, mantendo **F-3B-05** e **F-3B-15** como riscos baixos explícitos; esta decisão não afirma que eles foram corrigidos. Não houve terceiro ciclo Grok, publicação, alteração do Supabase remoto ou início do Marco 3C.

## Limites e próximos passos

A consulta é somente leitura. Não implementa solicitação/troca pelo funcionário, assinatura, alerta de vencimento, GPS, foto, biometria, produção, ponto oficial, REP-P nem dados reais. O núcleo 2F permanece congelado. A aprovação visual em 100%/200% e os dois ciclos Grok somente leitura foram concluídos e confrontados com código e provas locais. O fechamento 3B é **exclusivamente local e sintético**, com riscos baixos F-3B-05/F-3B-15 preservados. Não é produção, não é uso por funcionários reais, não é ponto oficial e não é REP-P. A recomendação futura é **Marco 3C — Solicitar Troca de EPI**, sem implementação nesta rodada.

**SIMULAÇÃO SEM VALOR OFICIAL.**
