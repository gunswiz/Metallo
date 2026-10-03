# Marco 3H — Comunicados

**Estado oficial em 01/10/2026:** **MARCO 3H — COMUNICADOS — FUNCIONAL EM LABORATÓRIO; fechamento formal autorizado e registrado**. Avaliação manual **APROVADA**, dois ciclos independentes concluídos e confrontados, nenhum crítico/alto confirmado aberto. Baseline autorizada: **METALLO-3H-LAB-20261001-R1**, cuja validade exige o recibo externo de scan direto aprovado e SHA exato do ZIP. Não houve publicação externa ou alteração do Supabase remoto. Publicar/arquivar comunicado neste documento significa operação apenas no banco local com dados fictícios. **SIMULAÇÃO SEM VALOR OFICIAL.**

## Origem e organização

- Origem imutável `METALLO-3G-LAB-20260930-R1`, ZIP `Metallo-Marco3G-BaselineAprovada-20260930-R1.zip`, SHA-256 `36d40d4eb85f594b75f904b899b13c02cd3283efa451bb25cdc4ed3c4b00323f`. Hash e recibo da baseline aprovados foram conferidos antes de iniciar; o ZIP não foi alterado.
- O novo SQL é `04_BANCO_E_SUPABASE/laboratorio-marco-3h/contrato-comunicados.sql`, aplicado **apenas** ao PostgreSQL do Supabase Docker local. Não integra as migrations remotas. O laboratório permanece em loopback.
- A navegação inferior do Colaborador conserva seis itens; Comunicados entra por card no Início e por item lateral em telas largas. Gestão usa `admin:manage`, sem ampliar permissões gerais.

### Conferência de rastreabilidade do checkout

A comparação por SHA-256 das entradas de código/documentação/evidências presentes diretamente no ZIP 3G encontrou **244 arquivos idênticos, 13 diferentes e nenhum ausente**. Seis diferenças pertencem à implementação 3H: sessão do portal, allowlist de transporte, teste de segurança, aplicativo e rota do Colaborador e retorno adicional do helper de contas sintéticas.

As outras sete diferenças já têm datas de modificação anteriores ao 3H e foram preservadas: `colaborador-preview.test.tsx` (provas 3G de troca de conta/contadores); `verificar-rede-local.mjs` (destino de evidência 3D); `resultado-3a.json` e `resultado-3b.json` (rodadas sintéticas anteriores); `resultado-segredos-3b.json` (scan anterior do pacote 3C); documentos 38 e 39 (recibos externos acrescentados depois de congelar seus ZIPs). Elas não são apresentadas como alterações desta rodada. A comparação cobre as entradas diretas do pacote; não afirma que o ZIP contém todo o checkout nem altera as origens aninhadas. As responsabilidades novas e demais arquivos 3H fora desse inventário estão descritos abaixo.

## Contrato de dados e autorização

Três tabelas privadas têm responsabilidades distintas: `communications_3h` guarda conteúdo, público e ciclo de vida; `communication_revisions_3h` guarda snapshots append-only de criação, publicação, correção e arquivo; `communication_views_3h` guarda a **primeira** abertura por comunicado e funcionário. Não há tabela de alvos individualizados: um comunicado tem um único público `ALL`, `TEAM` ou `WORK` e o alvo correspondente. Não há grants diretos de tabela para `authenticated`, `anon` ou `service_role`; RLS está habilitada e sem políticas permissivas. As RPCs `SECURITY DEFINER` usam `search_path=''`, objetos qualificados, `auth.uid()` e validação interna. A função de contexto fica no schema `private` sem `EXECUTE` para cliente. A RPC administrativa é concedida a `authenticated` somente como porta de entrada e nega qualquer ator que não seja administrador global ativo. `anon` não tem `EXECUTE`.

O Colaborador nunca fornece `employee_id`, `team_id`, `work_id` ou papel como autoridade. `my_communications_3h` e `open_communication_3h` resolvem a identidade ativa e o funcionário ativo no servidor. O contexto atual de equipe/obra repete a resolução conservadora já aprovada em Minha Obra 1C/Minha Equipe 3A: exatamente uma alocação ativa, ou equipe de origem apenas quando não existe histórico de alocação; equipe e obra devem estar ativas. Vínculos encerrados ou ambíguos não autorizam comunicados específicos. A equipe ausente não impede `ALL`. Mudança de equipe/obra faz perder novos acessos ao público anterior, inclusive por ID direto. A visualização histórica registrada continua preservada.

Comunicado começa `DRAFT` e só se torna visível na ação explícita `publish_communication_3h`. Depois da publicação, título, mensagem, fixação e expiração podem ser corrigidos com versão esperada, ator, horário do servidor e snapshot anterior/posterior; o público publicado não muda. `ARCHIVED` preserva conteúdo, revisões e aberturas, mas impede nova leitura pessoal. Fixados precedem os demais; dentro de cada grupo, publicação mais recente primeiro. Expiração é comparada no servidor e não apaga fatos. Listagens são paginadas, de 1 a 30 itens por chamada; a Web usa 20. O contador do Início mostra `20+` se houver pelo menos 20 não lidos.

Título: 1–120 caracteres. Mensagem: 1–4000 caracteres de texto simples, preservando quebras de linha. Controles, `<` e `>` são recusados no servidor; React apresenta apenas texto escapado, sem HTML ou links executáveis. Abertura registra `first_viewed_at` por `INSERT ... ON CONFLICT DO NOTHING`; listar não registra visualização. A segunda abertura e duas abas mantêm o mesmo evento. **Visualizado/aberto não é assinatura, concordância, aceite ou ciência trabalhista formal.** Revisão posterior não reinicia o estado de não lido do mesmo funcionário neste marco.

O resumo administrativo conta pessoas **elegíveis no contexto atual** e aberturas dessas pessoas; não exibe listagem nominal. Em rascunhos e arquivos, a UI chama a contagem de “Público potencial atual” porque não há entrega ativa. Os números altos vistos no laboratório incluem identidades sintéticas criadas por rodadas de testes anteriores, não funcionários reais.

## Prévia local para avaliação

- Gestão: `http://127.0.0.1:3102/comunicados` → **Novo comunicado** → salvar rascunho ou publicar. A página também permite publicar rascunho, corrigir com revisão e arquivar.
- Colaborador: `http://127.0.0.1:3101/colaborador/inicio` → card **Comunicados** ou `http://127.0.0.1:3101/colaborador/comunicados` → **Não lidos** / **Todos** → abrir card. A abertura mostra a hora registrada e a ressalva de que não é assinatura.
- Credenciais de Gestão, João, Maria e funcionário sem equipe estão somente em `backups/credenciais-previa-3h.json`, arquivo local **ignorado pelo Git**. Não copiar para ZIP, relatório ou conversa externa. Se houver outra sessão ativa no navegador, sair e entrar com a conta sintética do arquivo.
- Seis avisos sintéticos estão preparados: Todos, Equipe João, Equipe Maria, Obra João, Todos fixado e Todos com expiração. João deve ver Todos, sua equipe e sua obra; Maria deve ver Todos e sua equipe; sem equipe vê somente Todos. A Gestão pode criar outro aviso de teste e acompanhar contagens. Conferir em 100%, 200%, largura estreita, teclado e foco antes de aprovar.
- Na retomada, Docker e servidores Web estavam parados. O Docker instalado foi reaberto, a pilha existente iniciou pelo script protegido e os dados 3H permaneceram no banco. Colaborador e Gestão foram disponibilizados novamente em 3101 e 3102: ambas as URLs responderam HTTP 200; os listeners conferidos de 3101/3102/54321/54322 estão somente em `127.0.0.1` ou `::1`. A Gestão usa o modo pessoal `METALLO_COLABORADOR_PREVIEW=0`, com URL/chave pública locais e diretório de build separado; esse modo pessoal bloquearia suas rotas com 404 se ligado. Não houve mudança de código para reiniciar.

## Provas e estado da qualidade antes da auditoria

- Banco/Auth/JWT/PostgREST/RPC locais: **58/58** em `04_BANCO_E_SUPABASE/laboratorio-marco-3h/resultado-3h.json`. Cobrem rascunho, publicação, público, João/Maria, sem equipe, funcionário inativo, IDOR, IDs injetados, gestor engenheiro sem permissão, expiração, pin, primeira abertura, reabertura, duas abas, duplo clique, revisão, arquivamento, histórico preservado, XSS, comprimentos e paginação. A prova remove os comunicados que cria ao terminar; a massa de prévia fica separada.
- Grants locais: `authenticated` e `anon` sem `SELECT` direto em `private.communications_3h`; `anon` sem `EXECUTE` na RPC de criação. `authenticated` pode chamar a RPC, que exige administrador ativo no servidor.
- Web completa: **217/217**, 32 arquivos. O novo teste 3H e o teste de transporte verificam a UI pessoal, troca de conta, ausência de fallback após falha e a lista fechada de RPCs locais.
- TypeScript, ESLint sem avisos e build Next: **aprovados**.
- Fluxo real pela interface: Gestão salvou rascunho, publicou e arquivou uma amostra sintética; o Colaborador abriu um aviso e viu o registro de visualização. Edge em zoom real de 200% reportou `devicePixelRatio=2` e largura do documento menor que a viewport nas duas telas, sem rolagem horizontal. A prévia em largura padrão foi inspecionada visualmente. A mudança automática de viewport móvel não se refletiu no navegador controlado; a verificação visual móvel fica no roteiro manual.
- Na retomada, a política de segurança da automação recusou selecionar a aba que exibia a página de erro de conexão. Não foi tentado contorno por outra superfície. Isso limita a conferência visual adicional de largura reduzida/teclado nesta retomada; não substitui a avaliação manual nem invalida as observações anteriores registradas acima.

## Arquivos da rodada e limites

Novas responsabilidades: contrato e provas locais em `laboratorio-marco-3h/`; contrato DTO em `01_WEB/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h.ts`; leitura e guarda de ambiente em `01_WEB/05_ACESSO_A_DADOS/Supabase/comunicados-3h.ts`; ações e tela da Gestão em `01_WEB/app/actions/comunicados-3h.ts` e `01_WEB/app/(02_SISTEMA)/comunicados/`; tela pessoal em `01_WEB/app/colaborador/[[...screen]]/meus-comunicados.tsx`; teste Web `01_WEB/10_TESTES/comunicados-3h.test.tsx`; este documento. Estilos novos ficam ao lado de cada tela, sem arquitetura paralela. O arquivo de credenciais e a evidência JSON ficam respectivamente em `backups` ignorado e no laboratório.

Arquivos existentes atualizados: navegação e roteamento do Colaborador, sessão e allowlist local, navegação da Gestão, teste de segurança do portal, helper sintético 1A (somente retorno adicional das credenciais administrativas para a preparação local) e mapa do projeto. A organização 01–07 e as baselines anteriores foram preservadas.

Riscos restantes para avaliação: o contador do Início representa os primeiros 20 não lidos; a lista administrativa de alvos carrega até 1000 equipes/obras ativas; há uma janela de concorrência entre leitura do vínculo atual e registro de abertura, como em outras consultas online; o conteúdo administrativo continua dependendo de redação adequada pela Gestão. Nenhum desses pontos autoriza dados reais, publicação ou uso trabalhista formal. Não há anexos, PDF, assinatura 3F, comentários, respostas, push, e-mail, SMS ou WhatsApp.

## Aprovação manual e autorização de auditoria

O responsável aprovou a avaliação manual do Marco 3H no texto enviado em 30/09/2026, identificado como **“MARCO 3H — AUTORIZAÇÃO PARA AUDITORIA INDEPENDENTE GROK”**. A autorização preserva os gates 58/58 e 217/217, permite pacote sanitizado, scan direto do ZIP e **no máximo dois ciclos** de inspeção passiva Grok, com confronto individual de todos os achados. Ela não autoriza baseline, publicação, remoto ou Marco 3I. Não se extrapola essa aprovação para uma nova prova automatizada de viewport/teclado.

O auditor pode ler, extrair, pesquisar, comparar e conferir hashes em seu ambiente. Permanecem proibidos executar projeto, SQL, testes, migrations, Auth, containers, endpoints ou rede do laboratório, usar credenciais e modificar arquivos. Pareceres integrais e hashes serão preservados no laboratório; resultados e matriz de confronto serão atualizados neste documento.

### Ciclo 1 enviado

- Pacote: `outputs/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo1.zip` — **46 arquivos inventariados, 47 entradas**.
- SHA-256: `ad1b26e18c8ba5cf4e1a0516cf94510f184164ce89bd43f524213a3a5b22e382`.
- Scan **direto de todas as entradas**: manifesto, hashes e tamanhos conferidos, 18 valores de credenciais locais comparados somente em memória, **zero achados**. Recibo externo `.zip.verificacao.json` e digest `.zip.sha256` preservados em `outputs`.
- Conversa nova, sessão existente autenticada, modo Expert: `https://grok.com/c/fc9db24d-7beb-4955-96d6-0032ed7d169a`. O nome do anexo foi conferido na UI antes de enviar o prompt; o auditor depois informou que o hash confere.
- Web repetida para preservar relatório integral: **217/217**, zero falhas, em `laboratorio-marco-3h/web-completa-3h.json`. O catálogo de 12 funções e dez tabelas guarda somente metadados estruturais, sem linhas de usuários, credenciais ou tokens, em `catalogo-local-ciclo1.json`.
- O novo gerador/scan `gerar-pacote-auditoria-3h.py` tem a responsabilidade de selecionar explicitamente as fontes, inventariar, conferir a origem e varrer o ZIP final. Não inclui `credenciais-previa-3h.json`, dumps ou exportações de sessão.
- Parecer integral recebido: `laboratorio-marco-3h/parecer-grok-ciclo1-original.md`, 22.338 bytes, SHA-256 `eb4e41b9f040d6a172e22bb376b646637bf885238053b4ddd311796dddb6bc9d`. Preservado sem edição. Auditor declarou somente hash, extração, leitura/pesquisa e parsing passivos; não executou projeto, SQL, testes, Auth, containers ou rede do laboratório. Conferiu o SHA do ZIP e os 46 hashes do manifesto. Encontrou 13 achados e **nenhum crítico/alto confirmado ou aberto**.

### Confronto integral do ciclo 1

Classificações são do desenvolvimento após confronto; a severidade original não é reescrita no parecer. Lacuna/hipótese não é vulnerabilidade comprovada.

| Achado | Original | Confronto | Evidência e disposição |
| --- | --- | --- | --- |
| F-3H-01 | Médio, confirmado | VALID; corrigido | `datetime-local` sem offset e corte UTC deslocavam a intenção. Gestão agora declara Fortaleza, serializa `-03:00` e reapresenta com o formatter operacional existente; conserva segundos/milissegundos. Teste de round-trip, action com 18h→21h UTC e banco com o mesmo instante após revisão. |
| F-3H-02 | Baixo, confirmado | VALID; corrigido | SQL recusava HTML só na mensagem; título era texto escapado (sem XSS demonstrado). Recusa `<>` adicionada no título, prova RPC de `invalid_communication_text`. `correcao-ciclo1.sql` substitui somente a mesma função local, sem mexer na assinatura, owner/grants ou migration remota. |
| F-3H-03 | Baixo, parcial | VALID para retry na mesma intenção; corrigido nesse limite | Save confirmado + publish falho reproduzido por mock da action real. Erro retorna estado ao formulário com campos controlados e chave preservada; retry usa mesma chave e mesmo ID. Falta da chave é recusada. Redirect só no sucesso. SQL já impede segunda criação/revisão quando a chave é repetida. Recarregar/fechar deliberadamente a página ainda inicia outra intenção; não se promete deduplicação entre chaves diferentes. |
| F-3H-04 | Baixo, confirmado | VALID; corrigido | `useActionState` bloqueia os dois submits; publicação/arquivo reutilizam `SubmitButton`/`useFormStatus`. Testes de pending, recuperação após erro e dois submits; prova real de duas correções concorrentes: um sucesso, um conflito de versão, uma única nova revisão. Conflito não sobrescreve estado: operador deve recarregar a versão atual. |
| F-3H-05 | Baixo, risco futuro | VALID como risco de produto | Revisão não reinicia não lido, decisão explícita já documentada; abertura anterior permanece. Sem mudança empresarial nesta rodada. |
| F-3H-06 | Baixo, hipótese/risco | PARTIAL; residual preservado | Contexto, seleção e view não têm garantia de exclusão de toda mudança concorrente. Não há prova de João ler Maria. Lock de comunicado sozinho não fecha janela de identidade/equipe; não foi vendido como correção completa. Histórico de abertura permanece intencionalmente após archive. |
| F-3H-07 | Baixo, risco futuro | VALID como teto/custo operacional | Contador `20+`, alvos até 1000, resolução por identidade na contagem administrativa. Não ampliam autorização; preservados para evolução proporcional. |
| F-3H-08 | Baixo, lacuna visual | PARTIAL / observação independente NOT VERIFIABLE | Aprovação manual e provas anteriores 100/200% preservadas. Automação não confirmou viewport móvel novo; inspeção passiva não observa teclado/320px. Sem inventar nova prova ou chamar isso de autorização indevida. |
| F-3H-09 | Governança, lacuna | PARTIAL como limite do auditor; não defeito comprovado | Auditor não executa por mandato. Desenvolvimento repetiu as provas e anexou resultados integrais; isso não é execução independente pelo Grok. Suítes não são somadas. |
| F-3H-10 | Baixo, lacuna | VALID como cobertura faltante; sanada | Novas chamadas PostgREST reais recusam `p_employee_id` da Maria, `p_view_id` e `p_target_id` no JWT do João. Consulta local confirma zero visualizações da Maria após tentativas. Assinaturas não receberam parâmetros novos. |
| F-3H-11 | Baixo, hipótese temporal | PARTIAL; risco residual | `now()` é início da transação na leitura; `clock_timestamp()` é tempo de escrita. RPC ordinária não tem prazo/zero janela garantidos; hipótese de transação longa não é exploração comprovada. Não alterada a semântica global da resolução 1C/3A. |
| F-3H-12 | Informativo, lacuna de catálogo | INVALID como divergência indevida; contexto sanado | Migration posterior `20260906221331_harden_rpc_and_close_public_signup.sql` muda expressamente `is_active_admin` para INVOKER e restringe EXECUTE. Catálogo atual concorda. 3H não cria essa função. Arquivo posterior incluído no ciclo 2; não reintroduzido DEFINER nem ampliados grants. |
| F-3H-13 | Governança, risco futuro | VALID como limite | Abertura não é assinatura, concordância ou ciência formal; sem anexos/PDF/storage/push/3F. Avisos continuam visíveis. Sem decisão jurídica nesta rodada. |

### Correções e resultados após confronto

- Testes afetados: **37/37**, três arquivos (11 específicos de comunicados, incluindo seis novos da Gestão; demais verificam transporte/segurança). Não somar esse subconjunto à Web completa.
- Provas Auth/JWT/PostgREST/RPC: **70/70**, resultado integral em `resultado-3h.json`. As 58 anteriores foram conservadas, com 12 adicionais: título, IDs/view alheia, fuso, correção concorrente e revogação com JWT antigo. A massa de prova é sintética e seus avisos são removidos ao terminar; amostras de prévia ficam separadas.
- Web completa final: **223/223**, 33 arquivos, `web-completa-3h.json`. Uma execução com paralelismo padrão teve 222/223: espera por “Colega B” no teste antigo de recuperação da equipe. O arquivo inalterado passou **9/9** isolado; a suíte completa com `--maxWorkers=4` passou integralmente. Isso é compatível com flutuação sob concorrência, sem prova de regressão funcional; nenhum teste/assert/timeout foi removido, relaxado ou editado.
- TypeScript `tsc --noEmit`: exit 0; lint `eslint . --max-warnings=0`: exit 0; build Next: exit 0, log integral `build-ciclo2.txt`. Build usa URL/chave pública do laboratório em memória; não é publicação. Avisos experimentais de Web Crypto/ML-DSA do Node presentes no log, sem erro de build.
- `catalogo-local-ciclo2.json`: exportação estrutural nova, **12 funções/10 tabelas**, nenhuma linha de usuário, token ou credencial. Owner/search_path/ACL/RLS preservados. O modo `catalog2` do gerador reproduz a exportação em Docker named pipe local.
- Novos arquivos justificados: `correcao-ciclo1.sql` (delta SQL reaplicável local); `comunicados-gestao-3h.test.tsx` (retry, fuso e pending de server action/form); original do parecer e evidências integrais de teste/build/catálogo. O botão e formatter existentes foram reutilizados. Não há arquitetura paralela nem alteração do núcleo de ponto.
- O pacote ciclo 1 e a origem 3G permanecem imutáveis. Ciclo 2 conterá as correções, os contextos e esta matriz. **Nenhum crítico/alto confirmado aberto no confronto local do ciclo 1.**

### Ciclo 2 enviado — segundo e último

- Pacote `outputs/Metallo-Marco3H-Comunicados-Auditoria-20260930-Ciclo2.zip`: **56 arquivos no manifesto, 57 entradas**, SHA-256 `eb5530dc86382c180129c6dedcaf6607803617cfbb43e162d433205633942d8b`.
- Scan direto de todas as entradas: hashes/tamanhos/manifesto íntegros, 18 credenciais conhecidas comparadas apenas em memória, **zero achados**, recibo `.zip.verificacao.json`. Nenhum segredo/conta/arquivo de autenticação/dump enviado.
- Mesmo histórico de auditoria, modo Expert: `https://grok.com/c/fc9db24d-7beb-4955-96d6-0032ed7d169a`. Upload concluído e nome do ciclo 2 confirmado em “Anexos da conversa” **antes** de enviar o prompt. Mensagem enviada e auditor inspecionando; evidência de envio `grok-ciclo2-envio.jpg`.
- O documento dentro do ZIP é a fotografia do confronto anterior ao envio. Este recibo externo e o confronto final posterior atualizam a documentação vigente sem regenerar o pacote enviado. Não haverá terceiro ciclo automático.

### Parecer e confronto final do ciclo 2

Parecer original completo preservado sem edição em `laboratorio-marco-3h/parecer-grok-ciclo2-original.md`: **13.587 bytes**, SHA-256 `a2ad7e0203b82f3a15ea9ea7da97b11921ce9256701048b2865c0fdfcc0c015e`. O Grok conferiu o SHA do pacote e todos os 56 hashes, sem divergência. Declarou somente inspeção passiva e **nenhum crítico/alto confirmado ou aberto**; reconheceu as quatro correções, a cobertura F10 e o contexto F12, sem afirmar execução independente dos testes. Não solicitou terceiro ciclo. Prova visual do parecer: `grok-ciclo2-final.jpg`.

| Achado | Classificação final do confronto | Estado / evidência |
| --- | --- | --- |
| F-3H-01 | VALID | Médio corrigido: fuso explícito, round-trip, action e epoch real conservado. Grok confrontou formatter/parser/form/provas. |
| F-3H-02 | VALID | Baixo corrigido: SQL efetivo no catálogo recusa título HTML; RLS/grants/assinatura permanecem. Não foi XSS executável. |
| F-3H-03 | VALID | Baixo corrigido no retry da mesma montagem/intenção; campos e chave preservados, missing key negada. Recarregar/fechar a página pode iniciar chave distinta; não se promete dedup de intenções novas. |
| F-3H-04 | VALID | Baixo corrigido: pending nos submits; concorrência por versão falha segura sem revisão extra. Outra aba pode receber conflito e precisa recarregar. |
| F-3H-05 | VALID | Risco futuro baixo: correção não reinicia não lido; regra mantida. |
| F-3H-06 | PARTIAL | Hipótese/janela residual baixa de contexto/abertura/archive; sem IDOR demonstrado. Não há garantia contra toda mudança concorrente. |
| F-3H-07 | VALID | Tetos/custo operacionais baixos, mantidos: `20+`, até 1000 alvos e contagem por contexto atual. |
| F-3H-08 | NOT VERIFIABLE | Conferência visual independente de 320px/teclado não produzida no mandato passivo; aprovação manual e provas 100/200% anteriores permanecem. |
| F-3H-09 | PARTIAL | Limite do mandato: suítes locais anexadas não equivalem a execução pelo auditor. Não é defeito de autorização. |
| F-3H-10 | VALID | Lacuna do ciclo 1 sanada com cinco verificações reais de IDs extras e zero views de Maria. Auditor reconheceu evidências sem reexecutar. |
| F-3H-11 | PARTIAL | Hipótese temporal residual baixa `now()`/`clock_timestamp()`, mantida e sem exploração comprovada. |
| F-3H-12 | INVALID | Defeito de catálogo refutado por migration posterior e catálogo vigente; contexto sanado. Não houve reversão de hardening. |
| F-3H-13 | VALID | Limite de governança preservado: view não é ciência trabalhista nem assinatura; sem anexos/3F. |
| F-3H-14 (novo) | PARTIAL | Lacuna baixa sobre timeout Web, não regressão confirmada. Comparação direta com a origem 3G comprova arquivo de teste **idêntico byte a byte**: SHA `aa1831c6dc46a713bae3353bb7989e6d37114b2501d2b0fb2ea9fab1c0d99f8f`. Resultado final integral 223/223; a execução 222/223 e repetição isolada 9/9 estão registradas. Limitação de reexecução independente permanece. Nenhum teste foi enfraquecido. |

Não houve nova correção de código após o envio do ciclo 2: os fontes/testes/SQL/evidências selecionados conferem com o pacote enviado. Somente este documento recebeu os recibos e o confronto posteriores; o ZIP não foi regenerado. O checkout tem alterações de marcos anteriores, preservadas; a atribuição desta rodada usa a origem 3G e o inventário, não presume que todo `git status` seja 3H. `git diff --check` retornou exit 0 (avisos de normalização LF/CRLF do checkout, sem erro de whitespace).

### Estado funcional e resultados finais

| Superfície | Estado comprovado no laboratório |
| --- | --- |
| Todos / Equipe / Obra | Público atual resolvido no servidor; nulo não amplia TEAM/WORK; ativo sem equipe/obra permanece com ALL. |
| João / Maria | Isolados em ambas as direções; IDs injetados não autorizam contexto alheio nem registram view de outra pessoa. Inativo/revogado nega contratos pessoais. |
| Visualizações / não lidos | Listar não grava abertura; primeira abertura por pessoa é idempotente; reabertura/duas abas não duplicam; revisão não reinicia não lido. |
| Revisões | Criação/publicação/correção/arquivo preservam ator, versão, horário servidor e snapshots; concorrência rejeita versão antiga. |
| Expiração / arquivo | Expiração no servidor e formulário no horário declarado de Fortaleza; expirado/arquivado não abre nem lista; histórico anterior preservado. |
| XSS | Texto escapado React; HTML em título/mensagem recusado na RPC; sem sink HTML cru. |
| Avaliação manual | Aprovada pelo responsável antes da auditoria; sem inventar prova adicional de viewport móvel/teclado. |
| Auth/JWT/PostgREST/RPC 3H | **70/70**. |
| Web completa | **223/223**, 33 arquivos; subconjunto afetado **37/37** incluído nesse total, não somar. |
| TypeScript / lint / build | **Aprovados** após correções, sem publicação. |
| Rede / laboratório | Pilha sintética e prévias disponíveis; conferência final de listeners 3101/3102/54321/54322 somente `127.0.0.1`/`::1`; `docker ps` também mostra Studio/mail/analytics publicados só em loopback. Não substitui prova em segundo computador físico. |

**Decisão após a auditoria:** o responsável autorizou expressamente o fechamento **restrito ao laboratório** e a baseline 3H em 01/10/2026, preservando os riscos/lacunas listados. O fechamento está registrado na seção abaixo. Não executado terceiro ciclo ou outro marco.

**Limites finais:** Supabase remoto intocado; nenhuma publicação externa; nenhum funcionário real; não é produção, conformidade REP-P, autorização de ponto oficial ou autorização de publicação. Organização 01–07 e origem 3G preservadas. **SIMULAÇÃO SEM VALOR OFICIAL.**

## Fechamento formal — 01/10/2026

O texto **“AUTORIZO FORMALMENTE O FECHAMENTO DO: MARCO 3H — COMUNICADOS”** autoriza exatamente `METALLO-3H-LAB-20261001-R1`. A origem `METALLO-3G-LAB-20260930-R1`, todos os ZIPs anteriores e os dois pacotes de auditoria permanecem congelados. O parecer passivo não autoriza a baseline; a decisão é do responsável, nesta autorização posterior.

### Conferência final proporcional

- Executados novamente somente os três arquivos existentes de testes afetados: **37/37**, exit 0, sem mudança de código/testes/assertions. Não foi repetida a Web inteira, Auth ou a massa de provas, e não se soma esse subconjunto ao resultado vigente **223/223**. Gates reais **70/70**, TypeScript/lint/build aprovados permanecem intactos.
- Leitura local comparou **12 funções** (corpo, owner, search_path, modo e ACL) com o catálogo do ciclo 2; correspondência integral. As **três tabelas privadas 3H** conservam RLS, owner e ACL, sem policies permissivas. Nenhum SQL de escrita ou migration foi executado neste fechamento.
- Fontes selecionadas do segundo ciclo não mudaram. O documento recebeu o confronto/fechamento; o gerador de baseline e a evidência de conferência são arquivos novos com responsabilidades específicas de congelamento e recibo local. `preparar-previa-3h.mjs` é a fixture sintética existente incluída como fonte, sem executá-la nem anexar o arquivo de credenciais que ela cria.
- `verificacao-fechamento-3h.json` guarda a conferência rápida, sem linhas de pessoas, tokens ou credenciais. Portas 3101/3102/54321/54322 somente em `127.0.0.1`/`::1`. HTTP local disponível; a Gestão sem cookie redireciona para seu login local. Essa conferência não é nova execução de login/Auth nem ensaio de corte real de rede.
- PDFs e núcleo 2F herdados são conferidos por hash e preservados. A presença de fontes/pareceres anteriores no pacote não incorpora PDF, passkey/3F, Storage ou push ao módulo Comunicados. O delta não reorganiza 01–07 e não transforma diferenças antigas do checkout em mudanças 3H.

### Baseline aprovada

- Identificação exata: **METALLO-3H-LAB-20261001-R1**.
- ZIP: `outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip`.
- `MANIFESTO_SHA256.json`: origem 3G, aprovação, resultados, referências/hashes dos dois pareceres, classificação F01–F14, riscos, limites, inventário integral e delta desde 3G. `INVENTARIO_3H.json` facilita leitura manual e exclui a si próprio e o manifesto para evitar autorreferência; o manifesto inclui seu hash.
- Recibos externos `.zip.sha256` e `.zip.verificacao.json` guardam SHA final, contagens, delta, hashes anteriores, scan e triagem. Não inserir o SHA do próprio ZIP dentro dele nem regenerar o pacote para acrescentar esse valor.
- Aprovação efetiva condicionada a **passed=true**, **zero segredos confirmados** e correspondência do SHA no recibo. O exame reabre todas as entradas do ZIP final, confere nomes/hashes/tamanhos, procura credenciais/arquivos indevidos e examina bytes/texto/metadados dos PDFs herdados. Eventuais falsos alertas só são aceitos com trecho/hash e triagem anterior idênticos; triagem fica preservada.
- Fotografia selecionada de fontes/evidências herdadas da 3G e acrescidas do 3H, **não é backup de banco nem checkout completo executável**. Não inclui contas, `.env`, dumps, cookies, session/local storage ou credenciais. Conteúdo 3H selecionado é sintético/estrutural; o módulo não introduz automaticamente CPF, salário, ASO, saúde, endereço, telefone ou documentos sensíveis. Redação administrativa ainda exige cuidado humano.

### Semântica preservada e riscos aceitos neste fechamento local

Rascunho só fica pessoalmente visível após publicação explícita; fixação apenas ordena, sem ampliar autorização. TODOS inclui ativo com portal/identidade/funcionário ativos mesmo sem equipe; EQUIPE/OBRA dependem do contexto **atual no servidor**, sem confiar em IDs do cliente e sem criar snapshot adicional de destinatários neste fechamento. João/Maria permanecem isolados.

**LISTAR ≠ VISUALIZAR.** Só abrir registra `first_viewed_at` (evento de primeira visualização); reabertura não cria duplicidade. **VISUALIZAÇÃO ≠ ASSINATURA, CONCORDÂNCIA, ACEITE OU CIÊNCIA TRABALHISTA FORMAL.** Revisão conserva ator/horário/conteúdo anterior; arquivo não apaga; expiração segue tempo do servidor, com apresentação/serialização Fortaleza corrigidas; HTML em título/mensagem é recusado e React escapa texto. Retry conserva a mesma chave/intenção montada; pending bloqueia cliques simples, sem prometer dedup entre intenções distintas.

Preservados **F05 VALID** (revisão não reinicia não lido), **F06 PARTIAL** (janela de concorrência), **F08 NOT VERIFIABLE** (independência visual estreita/teclado), **F11 PARTIAL** (hipótese temporal SQL) e **F14 PARTIAL / limite de ensaio** (222/223 intermediário, 9/9 isolado e arquivo idêntico à 3G, final 223/223). Preservados F07 (tetos), F09 (mandato passivo), F13 (semântica), retry simulado sem corte real de rede, riscos herdados de sessão/revogação/host e ausência de ensaio em segundo computador físico. Não existe uso real/produção para extrapolar essas provas sintéticas.

Não há bucket/upload/anexo/PDF do 3H, integração passkey/3F, Firebase, OneSignal, SMS, WhatsApp, provedor de e-mail ou push externo. Não foi iniciado Marco 3I, documentos, contracheques, treinamentos ou qualquer módulo novo.

**Estado obrigatório:** SUPABASE REMOTO INTOCADO. NÃO IMPLANTADO NO SUPABASE REMOTO. NÃO LIBERADO PARA FUNCIONÁRIOS REAIS. NÃO É PRODUÇÃO. NÃO É CONFORMIDADE REP-P. NÃO É AUTORIZAÇÃO DE PONTO OFICIAL. NÃO AUTORIZA PUBLICAÇÃO. **SIMULAÇÃO SEM VALOR OFICIAL.**

**Parada:** após conferir baseline e recibos, encerrar esta rodada. Sem terceira auditoria, publicação, alteração remota ou avanço automático.

### Recibo final da baseline — conferido em 01/10/2026

**Baseline criada e aprovada:** `METALLO-3H-LAB-20261001-R1`. ZIP final: `outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip`, **17.416.545 bytes**, **341 arquivos inventariados / 342 entradas**. SHA-256 real:

`389137f649221344292ee85d5602f3fbc0c746ce68b4107ee2b607c8b3f084bd`

Delta desde 3G: **39 novos, 8 alterados, zero removidos**. Os oito alterados são sessão, allowlist, `colaborador-preview.test.tsx`, teste de segurança, aplicativo/rota do Colaborador, helper de contas sintéticas e `LEIA-ME.md`. A diferença do teste de prévia já existia antes do 3H, conforme a seção de rastreabilidade; sua inclusão no delta não a transforma em desenvolvimento novo deste marco. Fontes novas 3H, mapa do projeto, contratos, evidências e manifesto da origem constam nominalmente no inventário do ZIP.

O ZIP final foi reaberto, todas as 342 entradas foram conferidas, os 341 hashes/tamanhos internos correspondem ao manifesto e o SHA corresponde aos dois recibos externos. Scan **DIRETO** aprovado: **zero segredos confirmados, zero achados abertos**, 18 valores de credenciais conhecidas comparados somente em memória. Houve **sete alertas brutos herdados** no teste `laboratorio-marco-3e/provas-3e.mjs`, todos `NOT_SECRET`: expressões de variáveis de cookie em memória, com trechos e hash do arquivo idênticos aos já triados na 3G. A triagem integral está em `.zip.verificacao.json`; não foi omitida nem usado valor de cookie literal.

As **14 baselines anteriores** permaneceram com os mesmos SHA-256, incluindo a origem 3G. Os dois pacotes/pareceres Grok também permaneceram exatos. O ZIP 3H foi marcado somente leitura; não foi sobrescrito ou regenerado. A versão deste documento dentro dele é a fotografia anterior ao scan, cuja condição de aprovação foi satisfeita pelo recibo final. Este acréscimo externo registra apenas SHA/contagens/scan depois do congelamento, sem alterar código nem o ZIP aprovado.

**MARCO 3H — COMUNICADOS — FUNCIONAL EM LABORATÓRIO. FECHAMENTO FORMAL CONCLUÍDO. SIMULAÇÃO SEM VALOR OFICIAL.** Trabalho encerrado aqui; sem Marco 3I, terceira auditoria, publicação ou Supabase remoto.
