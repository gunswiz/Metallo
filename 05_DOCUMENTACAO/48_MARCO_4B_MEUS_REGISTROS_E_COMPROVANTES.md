# Marco 4B — Meus Registros e Comprovantes

## Estado e limites

**MARCO 4B — MEUS REGISTROS, COMPROVANTES E SHELL DO METALLO COLABORADOR — FUNCIONAL EM LABORATÓRIO.** Fechamento técnico e baseline autorizados expressamente pelo responsável em 01/10/2026. Avaliação visual/manual **APROVADA**; teste de carga **CONCLUÍDO**; auditoria Grok **CONCLUÍDA**, com um ciclo e oito itens confrontados, sem crítico/alto confirmado e aberto. O risco médio de disponibilidade permanece aberto. Baseline: **`METALLO-4B-LAB-20261001-R1`**, válida somente junto do recibo externo de secret scan direto aprovado e SHA-256 correspondente. Conferência e artefatos na seção 12. **PARADO após o fechamento. Marco 4C não iniciado.**

**SIMULAÇÃO SEM VALOR OFICIAL. NÃO IMPLANTADO NO SUPABASE REMOTO. NÃO LIBERADO PARA FUNCIONÁRIOS REAIS. NÃO É PRODUÇÃO. NÃO É CONFORMIDADE REP-P. NÃO É AUTORIZAÇÃO DE PONTO OFICIAL. NÃO AUTORIZA PUBLICAÇÃO.**

Origem imutável: `METALLO-4A-LAB-20261001-R1`, ZIP `outputs/Metallo-Marco4A-BaselineAprovada-20261001-R1.zip`, SHA-256 `50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d`. Conferido antes da implementação. O arquivo não foi modificado.

## 1. O que o colaborador encontra

Em **Meu Ponto → Meus registros**, consulta somente suas marcações brutas, com data, horário e estado “Registro realizado”. Não há pareamento de entradas/saídas, intervalos, faltas, extras, saldo ou cálculo de jornada.

Filtros: Hoje, últimas 48 horas, 7, 30 e **60 dias**, além de período personalizado. O responsável solicitou expressamente a consulta de 60 dias nesta rodada. São 20 registros por página, sem o corte de 50 itens do resumo 4A. Período personalizado admite até 366 dias inclusivos; não é política de apagamento/retenção. A consulta exibe somente os fatos efetivamente existentes, sem criar marcações para completar dias vazios.

“Ver recibo” abre o resumo pessoal e desloca o foco para seu título. “Baixar recibo em PDF” gera o documento autenticado. “Baixar comprovantes das últimas 48 horas” reúne um PDF por marcação em ZIP. O texto “comprovantes” do botão não muda a classificação dos documentos: todos são recibos de laboratório explicitamente não oficiais.

O resumo de 50 marcações do fluxo 4A permanece recolhido na URL original de Meu Ponto. A Gestão somente leitura foi preservada. A etapa autorizada de shell substitui a navegação inferior pelo menu lateral; detalhes na seção 9.

## 2. Arquitetura e autorização

Não há outro núcleo de ponto ou tabela de marcações. `laboratorio-marco-4b/registros.mjs` lê o mesmo PGlite 4A/2F por `core.checkpoint`, com consultas parametrizadas. Não executa DDL, INSERT, UPDATE ou DELETE. **Nenhuma migration, RPC, grant ou RLS novo foi criado/aplicado no Supabase.** SQL de datas artificiais existe somente na fixture descartável do ensaio, para verificar limites temporais sem adulterar marcações existentes.

O adaptador existente em `127.0.0.1:3106` recebe a identidade exclusivamente de `auth.verifyPersonal`: JWT assinado local, Auth real, RPC pessoal PostgREST e sessão ativa. O cliente não fornece `employee_id`, identidade ou intenção. A camada de leitura usa a autorização/reconciliação 2F e confere a integridade 4A antes/depois da consulta. O adaptador revalida Auth/vínculo/sessão antes de responder. O guard interno do núcleo verifica contexto e ledger; não substitui a verificação do funcionário ativo no Auth/RPC pessoal feita pela fronteira HTTP.

Rotas internas: POST `/lab-point/v4b/list`; GET `/receipt/:event_id`, `/last48` e `/authorize` sob o mesmo prefixo. Host e origem são restritos a loopback. Querystrings são recusadas. IDs inexistentes e IDs de outra pessoa não revelam documentos.

Gateway Next local: `/api/ponto-registros/list`, `/receipt/:event_id`, `/last48`. Funciona somente com flags de prévia local, host `127.0.0.1:3101` e Bearer válido. Corpo de filtro limitado durante a leitura a 512 bytes. Sem cookies como autoridade, URL assinada pública, Storage, diretório temporário de downloads ou fallback remoto. No browser/bundle não existe service_role.

PDF/ZIP são gerados em memória no servidor Next, a partir de DTO estrito e mínimo. Antes de liberar bytes, o gateway chama novamente `/authorize`: Auth, identidade, vínculo, sessão, versão da autorização e prontidão. Falha nessa verificação impede a resposta do arquivo. Cache `private, no-store`, `nosniff` e `no-referrer`. O nome de arquivo deriva exclusivamente de UUID validado, nunca de parâmetros de nome/caminho.

Logout/troca de conta desmonta a área, cancela requisições e ignora resultados tardios. URL blob existe apenas durante a transferência e é revogada imediatamente. Uma cópia já baixada pelo funcionário não pode ser apagada/revogada remotamente pelo portal.

## 3. Modelo do recibo

PDF A4 de uma página, logo Metallo, texto selecionável, data/hora da marcação, instante de conclusão, fuso Fortaleza UTC−03:00 e referência sintética original. Rótulos visíveis:

- SIMULAÇÃO SEM VALOR OFICIAL.
- NÃO É COMPROVANTE REP-P OFICIAL.
- NÃO POSSUI ASSINATURA PAdES/ICP-BRASIL.
- DADOS HISTÓRICOS LIMITADOS.

`event_id` identifica uma única marcação e permanece em referência técnica discreta e no nome de arquivo. Não há UUID de funcionário, intenção, equipe, obra, GPS bruto, credenciais ou hash completo no PDF humano. LAB-4A é sequência sintética; não é NSR. Hash não é assinatura.

`marking_at` vem da intenção 4A registrada pelo servidor; `recorded_at` vem do recibo original. Para legado sem recibo 4A, são usados os instantes recebimento/commit já preservados no evento do núcleo, com referência `LAB-LEGADO` e limitação histórica explícita. Se há intenção 4A existente, seu instante é preservado mesmo antes da finalização de seu recibo técnico. Não há escrita retroativa.

Nome histórico, CPF, nome legal do empregador, CNPJ/CPF legal, CEI/CAEPF/CNO e endereço/local não foram preservados nominalmente nessa origem. O PDF informa a lacuna; não lê o cadastro atual para reconstruí-los. Referências de snapshots do núcleo continuam na evidência interna original. Nome, equipe, obra e estabelecimento atuais não são incorporados ao documento antigo.

Regenerar o mesmo recibo com a versão `4B-LAB-v1` e a mesma logo produz os mesmos bytes, inclusive metadata de criação/modificação baseada no instante histórico, sem relógio atual. Esse determinismo não é assinatura nem promessa de identidade binária entre versões futuras do renderizador. A fronteira futura é a função `buildPointReceipt` entregar bytes a um assinador posteriormente autorizado; nenhum assinador/certificado/chave foi implementado.

## 4. Janelas e extração

Hoje e 7/30/60 dias usam dias civis de Fortaleza, incluindo hoje, com limite superior no instante do servidor. Período personalizado inclui todas as datas inicial/final até seu último milissegundo. Últimas 48 horas é uma janela móvel de instantes, calculada pelo banco: `agora - 48h` até `agora`, filtrando horário da marcação, não do download nem do commit.

ZIP contém exclusivamente eventos pessoais selecionados por essa janela. Ausência retorna `SEM_REGISTROS_48H` e mensagem humana, sem arquivo vazio. Limite explícito de laboratório: 500 recibos por extração; excesso falha com mensagem, sem ZIP parcial/truncado. Não se declara atendimento regulatório universal com esse limite. Histórico anterior continua disponível na consulta paginada. Downloads não criam eventos de ponto, não alteram snapshots, hashes ou épocas de recuperação e não coletam GPS.

## 5. Matriz normativa — consulta oficial em 01/10/2026

Referências: [Portaria 671 compilada em 21/07/2026, disponibilizada pelo MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/WORDPortarian671de8denovembrode2021compilada21.07.2026.pdf), [página oficial REP](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) e [Perguntas e Respostas oficiais, especialmente itens 12, 30, 40 e 41](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP).

Arts. 79/80: conteúdo mínimo, acesso após marcação e extração de pelo menos 48 horas. Art. 88 §1º e resposta 30: comprovante eletrônico REP-P requer PAdES com certificado ICP-Brasil válido. Arts. 78/91 e resposta 12: registro de programa no INPI. A classificação abaixo identifica lacunas; **não declara conformidade**.

A = disponível no laboratório; B = técnica implementada, não oficial; C = ausente; D = depende de identidade/infraestrutura legal; E = depende de REP-P futuro. Categorias podem coexistir.

| Campo/requisito | Classe | Evidência ou lacuna do 4B |
|---|---|---|
| Título regulatório | C/E | Título usado identifica recibo de laboratório |
| NSR | C/E | Referência LAB existente, sem equivalência oficial |
| Empregador | C/D | Marca/logo, sem snapshot nominal legal |
| CNPJ/CPF do empregador | C/D | Não armazenado/preenchido |
| CEI/CAEPF/CNO aplicável | C/D | Não presumido |
| Local da prestação/estabelecimento | C/D | Referência interna sem endereço histórico nominal |
| Trabalhador | A/C | Autoridade pessoal comprovada; nome histórico ausente |
| CPF do trabalhador | C/D | Não preenchido com documento fictício/real |
| Data/horário | A/B | Instantes originais do servidor; HLB oficial não comprovada |
| Registro INPI REP-P | C/E | Não solicitado/criado |
| SHA-256 da marcação | A/B/E | Cadeias sintéticas existentes; não equivalem ao leiaute REP-P |
| Assinatura eletrônica | C/D/E | Sem PAdES, ICP-Brasil ou status assinado |
| PDF e consulta individual | B | Geração técnica autenticada local |
| Extração de 48h | B | ZIP pessoal; limite de 500 e laboratório sintético |

Os demais requisitos, identidades legais, disponibilidade, NSR por estabelecimento, AFD/AEJ e REP-P futuro permanecem nos gates do documento 47 e da matriz de conformidade vigente. Nenhuma aquisição de certificado ou decisão jurídica foi feita.

## 6. Provas e resultados

Resultados independentes; **não somar suítes sobrepostas**:

| Suíte | Resultado | Evidência local em `laboratorio-marco-4b/` |
|---|---|---|
| 4B local real + fixtures temporais | 51/51 | `resultado-4b.json`, `provas-4b.log` |
| Web completa antes do shell | 271/271 | `web-completa-4b.json` |
| Web completa após o shell | 284/284 | `web-shell-completa.json` |
| Afetados pelo shell | 82/82, incluídos na Web | `web-shell-especificos.json` |
| Novos cenários do shell | 13/13, incluídos na Web | `colaborador-shell-4b.test.tsx` |
| 4B Web/PDF/gateway específicos | 25/25, incluídos na Web | Três arquivos `4b.test.*` |
| Regressão 4A | 80/80 | `regressao-4a.json` |
| Regressão segurança pós-auditoria 4A | 13/13 | `regressao-auditoria-4a.json` |
| Regressão 2F | 28/28 | `regressao-2f.json` |
| Banco | 31/31 | `banco.log` |
| Qualidade | 44/44 | `qualidade.log` |
| Rede | 8/8 | `rede.json` |
| TypeScript/lint/build | aprovados | Logs respectivos |

Provas incluem João/Maria nos dois sentidos, IDs/URL/query/body manipulados, conta sem equipe, inatividade na fronteira HTTP, identidade revogada com token antigo, token inválido no HTTP, expiração do mesmo JWT real assinado em guard com relógio controlado somente no processo de ensaio, logout real e refresh real. O relógio do Windows/serviço não foi alterado; não se alega espera natural pela expiração de uma sessão real. Leituras simultâneas/pacotes repetidos preservam originais. Fixture SQL isolada prova 48h versus 60 dias e paginação de 66 eventos sem truncar aos 50. Não prova marcações históricas reais de funcionários.

Gateway em ensaios controlados revalida após PDF/ZIP e bloqueia bytes quando há logout/revogação/falha de dependência durante geração. UI descarta resposta tardia e bloqueia duplo clique. Esses testes controlados complementam os testes reais; não são apresentados como corrida real de energia/rede/produção.

Conferência PDF: `recibo-4a-sintetico.pdf` gerado pelo endpoint real e `recibo-legado-sintetico.pdf` gerado da fixture explícita do renderizador. `recibos-48h-sinteticos.zip` é uma amostra de download operacional pessoal, **não pacote de auditoria nem baseline**. A4/texto/avisos e ausência de assinatura/GPS conferidos por extração e renderização. A evidência final registra hashes sem credenciais.

Na conferência visual, a mudança periódica da função de sessão fechava o recibo. A área 4B passou a usar o provedor de token mais recente sem reinicializar a consulta da mesma conta; um teste específico cobre a renovação. Logout/troca de conta continuam cancelando respostas tardias. O recibo permaneceu aberto no Edge durante os polls de sessão.

Uma execução completa paralela retornou 270/271 por timeout em `colaborador-perfil-equipe.test.tsx`, caso “laboratório indisponível elimina dados antigos e permite nova tentativa”. O resultado foi preservado em `web-4b-tentativa-270-de-271.json`. O arquivo e sua implementação não foram alterados pelo 4B. Sem mudar teste ou timeout, a execução isolada passou 9/9 (`perfil-equipe-rechecagem.json`) e a completa com dois workers passou 271/271. O resultado sugere sensibilidade à execução concorrente; não constitui falha funcional comprovada do 4B nem justificativa para retirar o teste.

Conferência final e secret scan de fontes/evidências/bundles/PDF/ZIP: `verificacao-final-4b.json`; zero achados. A evidência de layout confirma larguras úteis 390/768/1280, foco no título/botão do recibo e ausência de overflow nos controles do 4B. O viewport temporário foi restaurado.

## 7. Arquivos e responsabilidades

Novos arquivos necessários:

- `04_BANCO_E_SUPABASE/laboratorio-marco-4b/registros.mjs`: seleção pessoal sobre registros originais, sem escrita.
- `laboratorio-marco-4b/provas-4b.mjs`: ensaio real local e fixtures temporais descartáveis.
- `laboratorio-marco-4b/verificar-4b.py`: conferência final de evidências, baseline de origem, arquivos congelados, PDF/ZIP e segredos.
- `01_WEB/05_ACESSO_A_DADOS/Ponto/registros.ts`: contrato mínimo estrito e transporte do browser.
- `01_WEB/03_FUNCOES_E_LOGICA/Relatorios/ponto-recibo-4b.ts`: conteúdo PDF não assinado e pacote ZIP.
- `01_WEB/app/api/ponto-registros/[...path]/route.ts`: gateway local e autorização após geração.
- `01_WEB/app/colaborador/[[...screen]]/meus-registros.tsx`: consulta/download, ciclo de vida de conta e foco.
- Três testes na camada Web: recibo/ZIP, interface pessoal e gateway/autorização.
- Este documento: responsabilidade nova do 4B, sem duplicar encerramento 4A.
- PDFs, JSONs, logs e screenshots junto do laboratório: provas distintas do mesmo marco; não novos resumos concorrentes.

Atualizados: servidor 4A para hospedar rotas 4B na mesma porta; `meu-ponto-online.tsx` para compor a área; CSS vigente; proxy local; package/lock para declarar `fflate@0.7.5` já existente no cache; helper de rede existente para gravar evidência 4B; mapa da documentação. Nenhum arquivo do núcleo 2B–2F foi alterado. Organização 01–07 preservada.

## 8. Riscos e avaliação manual

Persistem: administrador do host controla banco/âncora; segunda máquina física não ensaiada; relógio do laboratório não prova HLB oficial; ausência de snapshots legais/nome históricos, NSR/INPI/PAdES; limites de memória e até 500 recibos no ZIP; produção/disponibilidade/múltiplos writers não comprovados. Há uma janela residual entre a última autorização e a entrega dos bytes: não existe revogação atômica de um download já autorizado/em transmissão. Não há escrita de marcação nessa janela. Cópias exportadas anteriormente permanecem sob posse de quem as baixou. Nenhum risco é resolvido por inventar assinatura ou preencher dados antigos.

Prévia: `http://127.0.0.1:3101/colaborador/ponto#meus-registros`. Gestão existente: `http://127.0.0.1:3102/ponto-laboratorio` (somente leitura, sem nova capacidade 4B).

Roteiro: selecionar 60 dias; conferir horários; abrir um recibo e baixar PDF; extrair ZIP de 48h; testar período vazio; comparar João/Maria; sair/trocar conta; conferir teclado, celular e zoom real 100%/200%. Conferência automatizada das larguras úteis 390/768/1280 fica em `visual-4b.json`. **O valor real de zoom no menu do Edge precisa de confirmação manual nesta rodada; atalhos automatizados não forneceram prova suficiente. Não inferir zoom apenas de devicePixelRatio.**

A etapa de avaliação foi superada pela autorização adversarial atual. Após carga, auditoria e confronto, parar sem baseline 4B, 4C, publicação ou Supabase remoto.


## 9. SHELL DE NAVEGAÇÃO DO METALLO COLABORADOR

### Motivação e referência

Etapa visual/navegação autorizada dentro do 4B, em 01/10/2026; não é outro marco e não encerra o 4B. O responsável descreveu a hierarquia do RHID como referência conceitual: registro de ponto prioritário, menu lateral e separação das consultas. Não foram recebidos novos prints nesta rodada. A implementação usa a logo e os tokens Metallo existentes, sem reproduzir componentes ou identidade de outro produto.

A Home anterior com cards de todos os módulos e a barra inferior foram substituídas por uma Home simples e um drawer único. O cabeçalho com botão de menu permanece disponível durante a rolagem. O nome curto aparece na saudação; o drawer preserva o nome completo com quebra de texto, função genérica Colaborador e equipe pessoal legitimamente disponível, ou **Sem equipe atribuída**. Nenhum identificador técnico é exibido nesse cabeçalho.

### Home e responsabilidades

- Identidade, data e hora de referência do servidor local em Fortaleza.
- Meu Ponto e horários brutos de hoje, sem classificação entrada/saída, jornada, falta, extra, saldo ou zero fictício.
- Botão grande Registrar ponto, no fluxo normal da página, sem camada fixa cobrindo conteúdo. Reutiliza o componente 4A e suas operações originais de intenção, GPS, idempotência e commit; esta etapa modifica somente sua apresentação.
- Marcações de hoje reutilizam a consulta pessoal 4B. São exibidas as 20 mais recentes, em ordem visual cronológica, com aviso quando houver mais. A última marcação exibida é a mais recente do dia. Todas permanecem consultáveis pela paginação da página de registros.
- Dois atalhos: Meus registros e Comprovantes, exatamente os mesmos destinos do drawer.
- Pendências reutilizáveis: entregas de EPI sem resposta, itens pessoais aguardando confirmação e comunicados não lidos. Consultas somente leitura já existentes. Uma falha parcial é apresentada como consulta incompleta; não é convertida em ausência de pendências. A contagem é descartada na mudança de conta/saída e atualizada ao voltar à Home ou retomar foco. Não há contador de documentos, treinamento ou contracheque inventado.

`DrawerColaborador` cuida exclusivamente da navegação, identidade e acessibilidade do menu. Usa dialog nativo modal, scroll próprio e bloqueio do fundo, Escape, Tab/Shift+Tab e retorno de foco. `PendenciasColaborador` cuida somente dos resumos pessoais e reutiliza `usePersonalDetail`. `ColaboradorApp` continua compondo as telas e a sessão. `MeuPontoOnline` e `MeusRegistros` recebem variantes de apresentação; não existe segundo núcleo ou renderizador de recibos.

### Menu e URLs

| Grupo | Destinos |
|---|---|
| Início | `/colaborador/inicio` |
| Meu Ponto | Registrar ponto `/colaborador/ponto`; Meus registros `/colaborador/registros`; Comprovantes `/colaborador/comprovantes` |
| EPI e Itens | Meus EPIs; Meus itens pessoais; Solicitar troca de EPI, apontando à seção 3C existente |
| Trabalho | Minha equipe; Minha obra; Comunicados |
| Solicitações | Minhas solicitações, com subtítulo **Solicitações de EPI**, apontando ao histórico 3C existente |
| Minha Conta | Meu perfil; Segurança, apontando à seção 3F existente |
| Final do menu | Sair, pelo encerramento seguro atual |

As duas novas URLs são entradas de apresentação do mesmo `MeusRegistros`. A primeira conserva 60 dias e paginação de 20, com recibo individual; a segunda inicia nas últimas 48 horas e mostra a extração ZIP e os recibos. `/colaborador/ponto#meus-registros` e `/colaborador/ponto#comprovantes` continuam disponíveis. Foram acrescentadas somente âncoras no histórico de solicitações e seção de segurança para alcançar componentes existentes. O drawer aguarda a seção autenticada aparecer (observer limitado a 10 segundos), posiciona a rolagem abaixo do cabeçalho e o foco. Isso corrige o fragmento que chegava à página antes de seu histórico ser montado; não executa ação de negócio.

Não há troca improvisada de conta. Documentos, contracheques, ASO, jornada, quiosque e assinatura de período não aparecem como módulos vazios. Solicitações administrativas futuras continuam fora do escopo; o link atual informa sua limitação a EPI. A Segurança mantém os requisitos do 3F: a configuração de credencial pessoal continua requerendo a origem localhost; na origem 127.0.0.1 a tela informa essa condição, sem bypass ou transferência de sessão entre origens. A categoria Documentos poderá receber destinos quando houver implementação e autorização próprias, sem alterar agora política médica ou de dados.

### Arquivos desta etapa

| Arquivo | Alteração e responsabilidade |
|---|---|
| `app/colaborador/[[...screen]]/drawer-colaborador.tsx` — novo | Menu modal com agrupamentos, foco, identidade e links; não havia equivalente do drawer pessoal |
| `app/colaborador/[[...screen]]/pendencias-colaborador.tsx` — novo | Resumo reutilizável entre módulos pessoais, sem nova fonte de dados ou escrita |
| `10_TESTES/colaborador-shell-4b.test.tsx` — novo | 13 cenários de navegação/teclado/Home/pendências e preservação de chamadas 4A/4B |
| `colaborador-app.tsx`, `colaborador.module.css` | Composição da Home, cabeçalho persistente, remoção do menu duplicado e estilos dos agrupamentos com tokens existentes |
| `meu-ponto-online.tsx`, `meus-registros.tsx` | Variantes exclusivamente de apresentação; reutilização da ação e consulta atuais |
| `page.tsx`, `use-colaborador-session.ts` | Admitir os dois nomes de tela novos; no hook mudou somente a união TypeScript, sem regra de autorização ou sessão |
| `meu-perfil.tsx`, `epi-troca.tsx` | Âncoras acessíveis para as seções já implementadas |
| `10_TESTES/setup.ts` | Suporte de apresentação do dialog no JSDOM, que não implementa showModal/close; o modal nativo foi conferido no Edge |
| `colaborador-preview.test.tsx`, `colaborador-epis.test.tsx`, `colaborador-obra.test.tsx`, `colaborador-auth-real.integration.tsx` | Localizadores de navegação/saída adaptados ao drawer, preservando os testes de isolamento, revogação e logout pendente |
| Este documento; evidências em `laboratorio-marco-4b/` | Atualização vigente e provas específicas da etapa; sem documento paralelo |

Reutilizados: BrandLogo, tokens, sessão pessoal, usePersonalDetail, MeuPontoOnline, MeusRegistros e módulos 3C/3F/3G/3H. Removidos da composição: sidebar permanente, barra inferior e grade de cards/recursos futuros da Home. Atalhos antigos exportados por módulos continuam disponíveis para compatibilidade de componentes/testes; não são renderizados na nova Home. Dívida preservada: a URL original de Meu Ponto conserva a apresentação detalhada anterior, enquanto a Home usa sua variante compacta. Não foi feita migração da árvore de rotas.

**Banco nesta etapa: zero migrations, zero RPCs novas, zero RLS, zero grants.** Nenhum arquivo SQL ou servidor do laboratório foi alterado. Núcleo 2F e regras 4A preservados. Não houve comando de banco, intervenção no Docker/firewall nem contato com Supabase remoto nesta reorganização.

### Validação e avaliação

Web completa **284/284**, incluindo os **13/13** cenários novos. Afetados **82/82** (subconjunto, não somar). TypeScript, lint e build aprovados, com logs `shell-*.log`. As provas reais 4B 51/51 e regressões anteriores da seção 6 são evidências preservadas da implementação precedente; não são apresentadas como reexecutadas nesta etapa visual.

Na primeira passagem, dois testes de logout ainda procuravam Sair no cabeçalho antigo. Os localizadores foram atualizados para abrir o drawer e acionar a mesma saída; as asserções de limpeza imediata, foco, memória e sessão permaneceram. Não houve remoção de teste, extensão de timeout ou alteração das regras de segurança para obter aprovação.

Edge: larguras úteis **360/390/412/768/1280**, orientação vertical, Home e drawer sem overflow horizontal ou controles fora da tela. Modal nativo ativo, cinco agrupamentos, foco inicial em Fechar menu, Shift+Tab → Sair, Tab → Fechar menu e Escape → Abrir menu comprovados. Links de registros/60 dias, recibo individual, Comprovantes/48h, solicitações 3C e Segurança 3F conferidos no browser. Nome longo completo coberto no teste de componente; quebra CSS permite preservar sua leitura no drawer. Evidência em `visual-shell-4b.json` e screenshots `shell-home-390.png` / `shell-menu-390.png`.

O percentual real 100%/200% no menu do navegador depende da conferência manual solicitada ao responsável; não é inferido de viewport ou devicePixelRatio. A aprovação visual/manual atual foi concedida expressamente no anexo de autorização adversarial; não se inventa uma confirmação separada do percentual de zoom.

Prévia local: **Home** `http://127.0.0.1:3101/colaborador/inicio`; **Meus registros** `http://127.0.0.1:3101/colaborador/registros`; **Comprovantes** `http://127.0.0.1:3101/colaborador/comprovantes`. O drawer é aberto pelo botão no cabeçalho da Home e das demais telas autenticadas. Conferir a saudação, nome completo, agrupamentos, marcações, botão principal, períodos, recibos, extração de 48h, celular e zoom 100%/200%.

**Estado atualizado: avaliação manual aprovada; carga concluída e auditoria confrontada na seção 11. Baseline 4B não criada. 4C não iniciado. Sem publicação. Supabase remoto intocado. SIMULAÇÃO SEM VALOR OFICIAL.**


## 10. TESTE DE CARGA E CONCORRÊNCIA

### Plano e isolamento

Ensaio autorizado em 01/10/2026: 50 usuários Auth reais **do laboratório**, cada qual com JWT, sessão, funcionário, identidade e vínculo próprios. Cinco sem equipe. Senhas aleatórias, JWT e refresh ficam somente na memória do gerador. Não existe usuário real, Auth remoto ou token persistido nos resultados.

`carga-fixtures.mjs` prepara um núcleo PGlite novo em `backups/marco-4b-ensaios/carga-<UUID>`. Insere, antes da medição, 22 eventos históricos sintéticos por pessoa: 21 entre 3 e 53 dias, mais um com 61 dias. São fixtures de leitura/paginação, não gravações HTTP históricas nem eventos da baseline. Hash, integridade e âncora desse banco novo são conferidos antes da carga. Os eventos novos medidos passam exclusivamente pelo fluxo HTTP begin/commit 4A.

`carga-4b.mjs` libera 50 callbacks pela mesma barreira. Medem-se início/fim de cada requisição e dispersão do primeiro disparo por usuário. Não há throttle sequencial entre os 50 usuários. As operações seguintes de um mesmo usuário seguem as dependências reais. Há fases de begin, commit, replay/retry/duplo POST, Home/dia/60 dias com duas páginas, 50 PDFs, 50 ZIPs, uso misto/logout/login/revogação/manipulação de IDs. Esperas usadas no cenário de revogação são registradas; não reduzem a concorrência das fases sincronizadas.

O processo original 3105/3106 e seu banco permanecem ativos. A revisão automática recusou encerrá-lo à força, por risco ao estado preservado; a operação não ocorreu. A solução usa **portas loopback separadas** 3103 (Next start), 3107 (mesmos handlers 4A/4B) e 3108 (mesmo encerramento 2F). A única opção dos gateways admite as portas locais 3106 ou 3107, sem URL/host arbitrário; ambas ainda exigem flags de laboratório, Bearer, Host/Origin e os mesmos guards. O HTTP de carga usa o Host contratual 127.0.0.1:3101 sobre TCP 3103, sem modificar a origem do Auth. A configuração/seleção dessas portas foi testada; não há bypass de autenticação.

Para reutilizar os handlers, o servidor 4A recebeu uma função de inicialização exportada, mantendo o caminho padrão da prévia. O núcleo 2B–2F, seu SQL e algoritmos permanecem congelados. Não se duplicaram handlers, renderizador PDF ou regras de autorização.

Duas tentativas de preparação falharam antes de carga útil: faltavam variáveis obrigatórias do laboratório; depois o fetch nativo não preservou o Host contratual. Evidências preservadas em `carga-tentativa-01-configuracao.json` e `carga-tentativa-02-host.json`. O transporte dedicado passou a node:http. Nenhuma dessas tentativas é aprovação de carga.

### Métricas e provas

Resultados integrais por requisição, fase, identidade e intenção: `carga-resultado.json`. CPU/RAM do host e conexões PostgreSQL (incluindo a consulta do amostrador) em `carga-recursos.jsonl`. Recursos do host incluem também a prévia e aplicativos abertos; não são consumo isolado do núcleo. `validar-carga-4b.py` usa pypdf/zipfile, distintos de pdf-lib/fflate, para conferir cada PDF e membro ZIP recebido, incluindo A4, UUID do evento, referência, horários originais, avisos e conjunto pessoal exato.

A aprovação depende da comparação pós-carga entre intenções confirmadas, eventos persistidos, titular e recibo, preservação dos 1.100 eventos iniciais, integridade/âncora e estado pronto. HTTP 200 sozinho não aprova. Identidade dos PDFs é associada pela cadeia autenticada → evento → titular no banco; não se fabrica nome legal histórico no documento. O descarte de resposta pós-commit é controlado pelo cliente e não representa queda física de conexão/disco.

**A terceira carga útil concluiu os sete cenários, com aceitação de integridade e arquivos comprovada nas condições documentadas abaixo.** Não há SLA jurídico/comercial. Mesmo um ensaio aprovado comprova somente as condições locais documentadas, com **um writer PGlite serializado**, sem HA, produção ou writers distribuídos. O percentual de zoom não é inferido do teste HTTP.

### Arquivos novos necessários

- `carga-fixtures.mjs`: criação das identidades/sessões e bootstrap do banco descartável.
- `carga-4b.mjs`: disparo HTTP concorrente, cenários e métricas, sem credenciais persistidas.
- `validar-carga-4b.py`: parser independente dos artefatos realmente recebidos e resumo de recursos.
- Evidências JSON/log: resultados de execuções distintas, mantidos no laboratório.

SIMULAÇÃO SEM VALOR OFICIAL. Remoto intocado. Nenhuma baseline 4B ou etapa 4C.


### Falha preservada e correção técnica da espera

Primeira carga útil (`carga-tentativa-03-saturacao.json`): 570 requisições em 267,86 s; 106 respostas 2xx, 82 respostas 4xx e 382 respostas 5xx. A execução NÃO passou. Os limites de 10 s (gateway de ponto) e 30 s (registros) interromperam a espera enquanto o writer serializado seguia sua fila de verificação/gravação. Retries sobrepostos agravaram a fila. O harness também teve falhas derivadas ao tentar usar eventos não obtidos; estas são preservadas, não interpretadas como prova de IDOR.

Post-mortem independente (`carga-postmortem-01.json`): 1.100 → 1.143 eventos; 43 novos duráveis, 12 confirmados ao cliente e 31 persistidos sem confirmação obtida nessa execução; nenhum dos 12 confirmados foi perdido, zero chaves duplicadas, 43 recibos, zero órfãos e originais inalterados. Núcleo READY ao reabrir. Não se afirma aprovação dos demais cenários: somente 12 PDFs chegaram e nenhum ZIP validado nessa tentativa. Não houve achado de conteúdo incorreto nos 12 PDFs recebidos.

Correção limitada ao transporte LOCAL: gateway de ponto espera até 60 s e browser até 65 s; gateway de registros/arquivos até 90 s e browser até 95 s, preservando cancelamento por logout/navegação. Cliente de carga: 100 s. São prazos técnicos finitos e documentados, não SLA e não alteração do TTL de 120 s da intenção, horário, autorização ou commit. Uma tentativa de remover uma verificação duplicada foi recusada pela revisão automática e revertida: **todos os guards originais permanecem antes/depois e após geração**, sem cache de autorização/integridade. O núcleo 2F continua byte a byte preservado. O teste repete o mesmo volume, 50 novas identidades e 1.100 originais; não reduz dataset, usuários, conteúdo ou critérios para passar.

A repetição conserva os erros anteriores e só pode substituir o estado de aceitação após completar a conferência de persistência e arquivos. Regressões Web aplicáveis foram reexecutadas. As amostras do host incluem a execução breve da suíte Web de regressão, além de aplicativos e prévia abertos; não se alegam recursos exclusivos de um ambiente de benchmark isolado.


### Segunda carga útil e agendamento na fronteira HTTP

A repetição com prazos coerentes (`carga-tentativa-04-starvation.json`) gravou e confirmou **70/70 intenções distintas**, preservou 1.100 originais, zero duplicação/perda confirmada/cross-user/recibo órfão e estado READY. Ainda NÃO passou: 43 falhas de cenários, incluindo 34 respostas 5xx e erros derivados no harness por listas não recebidas; 50 PDFs chegaram ao todo entre fases e 39 ZIPs foram conferidos. O parser não encontrou corrupção nos arquivos recebidos. Não se apresenta esse número como cumprimento da fase de 50 PDFs/ZIPs sincronizados.

A hipótese técnica restante era starvation de I/O nas cadeias de microtasks das verificações completas do writer. A fronteira HTTP recebeu `agendamento-http.mjs`: mantém FIFO e todos os métodos/guards originais, sem cache, cede `setImmediate` entre operações completas. Não modifica SQL, transação, hashes, TTL, epoch, autoridade ou algoritmos do núcleo 2F. `agendamento-http.test.mjs` prova oportunidade de I/O entre duas operações e preservação de uma rejeição de sessão, sem impedir a seguinte: **2/2**. Após esse ajuste, a terceira carga útil repetiu o volume de 50 usuários/1.100 eventos; seus resultados reais estão no tópico seguinte.

A medição de revogação passou a usar a primeira resposta negada de uma requisição **iniciada após a conclusão da revogação**, mantendo também a linha temporal das requisições em andamento. Não se toma início de uma chamada anterior como prova de bloqueio instantâneo, nem se interpreta uma janela calculada de zero como atomicidade de download.


### Resultado final da carga (terceira execução útil)

**50 identidades simultâneas**, cinco sem equipe; pico de **54 requisições em andamento** (replays), dispersão do primeiro disparo 2,30–6,00 ms por fase. **Zero falhas de cenário**. 902 requisições HTTP medidas pelos gateways/sessão, 426,591 s, 2,114 req/s; 495 respostas 2xx, **405 respostas 4xx esperadas** de ataques/revogação/logout e **2 respostas 503 recuperadas** na carga mista. Sete recuperações/retries: cinco respostas pós-commit intencionalmente descartadas e duas esperas expiradas de begin, sempre com a mesma chave. Não se oculta a degradação residual; não é resultado “zero 5xx”. Nenhum timeout do cliente de carga ou erro de transporte. As métricas excluem preparação, RPCs internos e chamadas auxiliares de login/admin; não são contagem de todo o tráfego da infraestrutura.

Latência medida: p50 **11,286 s**, p95 **61,257 s**, p99 **63,763 s**, máximo **64,425 s**. Tempos altos no writer único, sem extrapolar capacidade de produção. Os dois begins de 503 na carga mista foram recuperados e cada intenção produziu seu único resultado durável.

Persistência: **70 intenções distintas confirmadas → 70 eventos → 70 recibos**; 1.100 → 1.170 registros. Zero duplicação, perda confirmada, crossing ou original alterado; estado READY. Todos os 50 históricos percorreram duas páginas de até 20 e retornaram o conjunto pessoal esperado, excluindo o evento de 61 dias. Os sete cenários terminaram sem falha.

Arquivos: fase sincronizada com **50 PDFs e 50 ZIPs**; mais dez de cada na carga mista. Parser independente: **60 PDFs individuais e 60 ZIPs**, zero erros, conjunto e conteúdo pessoais corretos, A4, horários originais e avisos verificados. Resultado integral em `carga-validacao-arquivos.json`; duas amostras sintéticas de u0 acompanham o pacote, incluindo ZIP real e seus membros. Nenhum nome histórico legal foi inventado.

Revogação: cinco identidades sintéticas foram revogadas durante a carga mista; zero sucesso em operação iniciada após a confirmação. A primeira resposta negada de chamada iniciada após essa confirmação foi observada em **0,493 / 0,540 / 2,020 / 2,262 / 2,469 s**, respectivamente. São limites observados que incluem intervalo dos probes e latência, não duração exata/atômica da revogação. A primeira chamada em andamento de cada usuário iniciou antes e foi negada depois; não foi usada para alegar bloqueio instantâneo. As demais 45 identidades continuaram suas operações. Logout da sessão atual e novo login foram reais para outras cinco identidades.

Recursos (165 amostras): CPU do host até **50%**, RAM livre mínima **2.669.584.384 bytes**, até **46 conexões PostgreSQL**, incluindo observação e serviços existentes; PostgreSQL/max_connections em `carga-postgres-ambiente.json`. Host AMD/Windows/Node e configuração integral no resultado. Há saturação aparente da fila de verificações do writer, sem OOM ou corrupção observada. Não foram executados 75/100 usuários, múltiplos writers, segundo computador, queda física, HA ou produção.

Após correção: regressão 4B real novamente **51/51**; Web completa **286/286** (inclui duas novas provas da opção de porta), agendamento **2/2**, TypeScript/lint/build aprovados. Demais gates 4A 80/80, auditoria 4A 13/13, 2F 28/28, banco 31/31, qualidade 44/44 e rede 8/8 são provas vigentes preservadas; não somar sobreposições e não alegar nova execução destes gates.

**Estado atualizado: carga de integridade concluída nas condições locais e auditoria independente confrontada na seção 11. Nenhuma baseline 4B, Marco 4C, publicação ou alteração remota.**


### Escopo exato da carga e pacote selecionado

A carga da Home exercita a consulta HTTP pessoal das marcações do dia, associada aos testes do shell/pendências e à prévia manual. Não é automação de 50 browsers, nem mede renderização/hidratação de 50 telas, nem carga simultânea dos três RPCs antigos de pendências. Essa limitação deve ser confrontada pelo auditor; não se declara esse cenário adicional comprovado. O pacote inclui seus serviços/DTOs/SQL existentes para permitir revisão do isolamento e composição do shell.

Um pacote preparatório de 173 entradas passou no scan e foi preservado, **não enviado**. Antes do envio, a seleção foi complementada com logo/tokens e dependências existentes das pendências (3D/3G/3H); o arquivo `Ciclo1-Final` é o pacote selecionado do primeiro ciclo. Não se trata de segundo ciclo de auditoria, não sobrescreve o preparatório nem cria baseline.


## 11. Auditoria adversarial independente

Avaliação manual aprovada pelo responsável; primeiro ciclo enviado automaticamente ao Grok após confirmar o anexo processado. Conversa: https://grok.com/c/6c4ea377-cc82-47f6-885f-091b2d9c668d. Pacote selecionado `Metallo-Marco4B-RegistrosComprovantes-Auditoria-20261001-Ciclo1-Final.zip`, SHA-256 `9781552cba3062b07aec753a8f91ef3f8539638468fc02d604ae2d04ef509e47`. Scan DIRETO: 183 entradas do ZIP mais dois PDFs dentro da amostra ZIP, manifesto/hashes/CRC conferidos, zero achados. Preparatório de 173 entradas preservado sem envio.

Auditor autorizado somente a listar/abrir/extrair/pesquisar/comparar/calcular hashes. Não autorizado a executar projeto, SQL, testes, Auth, endpoints, carga, containers, alterações ou remoto. Máximo dois ciclos. Prompt efetivamente enviado e screenshot preservados no laboratório; metadados em `auditoria-4b.json`. **Ciclo 1 concluído e confrontado: oito itens, nenhum crítico/alto confirmado e aberto.** O auditor conferiu 182 hashes do manifesto, extraiu/leu os arquivos e os dois PDFs da amostra, e declarou não executar o projeto ou o laboratório. Sua conclusão sobre 50 usuários/70 eventos é leitura das evidências do produtor, não reexecução independente.

A primeira tentativa terminou no serviço Grok com **“Grok não conseguiu concluir a resposta”**, sem parecer. Texto e screenshot da falha preservados em `grok-ciclo1-falha-servico.txt` / `.png`. Foi acionado **Tentar novamente** uma vez pelo Work, na mesma conversa, com o mesmo ZIP/hash e prompt. Ao concluir, a UI conservava quatro variantes: a primeira com falha de serviço, a segunda interrompida após uma observação preliminar, a terceira com modelo temporariamente indisponível e a quarta com o parecer integral. Esse histórico foi lido passivamente e preservado em `grok-ciclo1-versoes.json`; não se atribui a origem das variantes adicionais sem evidência. Não houve novo ZIP, alteração intermediária ou novo prompt de auditoria. **Um ciclo de conteúdo concluído; falhas/variantes de serviço não são pareceres concluídos.**

Parecer original preservado sem edição em `parecer-grok-ciclo1-original.md`, SHA-256 **`62c6869a19dd798005b666d5d90ce01d232fc29badf6856569608a948be070df`**. A captura textual visível e a imagem `grok-ciclo1-parecer.png` complementam o original. URL da variante final: a mesma conversa, `?rid=580b1bbb-8609-4c8e-ad29-7ef9072c6057`.

### Confronto de todos os achados

As classificações abaixo avaliam a afirmação do auditor; **VALID em um controle ou risco declarado não significa vulnerabilidade aberta**.

| ID | Severidade/natureza do parecer | Confronto | Evidência local e decisão |
|---|---|---|---|
| 4B-C1-01 | Médio — disponibilidade | **VALID** | Requests 433/437, usuários 5/9: 503 de begin; mesma chave recuperada, 200/201 e um único evento/recibo. `carga-4b.mjs:56`, timeouts dos gateways e fila HTTP confirmam a degradação. Leitura direta posterior do banco descartável confirmou cada chave e 70 eventos/70 recibos, zero novo recibo ausente/órfão. Risco médio de disponibilidade preservado; não exigir zero 5xx nem alterar SLA/TTL. |
| 4B-C1-02 | Baixo — alcance da prova de revogação | **PARTIAL** | A carga revoga cinco identidades (45–49), como exigido para algumas contas; não revoga as 50. Zero sucesso iniciado após conclusão e limites observados de 0,493–2,469 s. `last_success_end_ms=0` representa ausência de sucesso, não sucesso no instante zero. Revogação depois da leitura e antes do retorno tem prova real em `provas-4b.mjs:56`; guards depois de gerar PDF/ZIP têm testes de gateway, não ensaio real de 50 downloads revogados durante geração. Essa cobertura adicional e a janela final continuam não comprovadas, sem alegar revogação instantânea. |
| 4B-C1-03 | Baixo — alcance da inspeção de arquivos | **VALID** | O Grok recebeu uma amostra de u0 e dois membros PDF, não todos os 60 PDFs/60 ZIPs. Reexecutado localmente `validar-carga-4b.py` sobre **todos os downloads recebidos**: 60/60, zero erro, hashes/conteúdo/A4/conjuntos pessoais corretos. Parser independente de pdf-lib/fflate; não é reexecução pelo auditor. Limitação externa preservada, nenhuma evidência local de corrupção/cruzamento. |
| 4B-C1-04 | Informativo — logs silenciosos | **VALID — sanado na evidência atual** | Arquivos vazios isoladamente não provam aprovação. Nova execução de `tsc --noEmit` e `eslint . --max-warnings=0` capturou comando, início/fim, **exit_code=0** de ambos e hash dos logs, no documento de execução `auditoria-4b.json`. Logs continuam silenciosos, sem inventar linhas de sucesso nem mudar gates. Nenhuma alteração de implementação. |
| 4B-C1-05 | Risco futuro — autorização → envio | **VALID como limite declarado** | Gateway gera em memória, chama authorize depois e não libera bytes se falhar (`route.ts:43`); servidor revalida pessoal/sessão antes de JSON (`servidor-4a.mjs:79`). Testes de PDF/ZIP negados após geração sustentam o controle. Não prova atomicidade entre a última autorização e a entrega dos bytes. Arquivos já baixados e administrador do host permanecem riscos; não há bypass local confirmado. |
| 4B-C1-06 | Risco futuro — RLS e Gestão | **PARTIAL** | `extensao.sql:33` ativa RLS e revoga grants sem policy de acesso; conexão privilegiada do PGlite é uma fronteira local explícita, não API remota pública. `servidor-4a.mjs:54` exige JWT, Auth, admin ativo e sessão ativa para a visão administrativa; consulta global de Gestão é distinta da consulta pessoal. Teste de admin sem download pessoal passou. Futuro acesso remoto/policies/privilégios precisa revisão própria; não se demonstra exposição local por ausência de policy. |
| 4B-C1-07 | Controle — isolamento pessoal | **VALID como controle sustentado** | `registros.mjs` filtra exclusivamente por authUserId autenticado em lista/recibo/48h; não aceita employee_id. Testes reais João→Maria, Maria→João, admin/sem equipe e HTTP/PDF/ZIP estão em `provas-4b.mjs:41–44,77–80,100` e resultado 51/51. Carga nega IDs/URLs/corpos e valida titulares/arquivos. Os corpos brutos de todas as provas individuais não foram enviados; essa limitação não deve virar alegação de vazamento, nem os nomes dos testes substituir asserções/código. |
| 4B-C1-08 | Risco futuro — capacidade | **VALID** | Um writer PGlite, um Next, 50 usuários HTTP/54 requests em andamento, 2,114 req/s e latências altas. Não prova produção, cluster, HA, pool distribuído ou múltiplos writers; nenhum SLA foi criado. |

### Observações preliminares e precisão dos termos

A variante interrompida 2 insinuava hash divergente da amostra ZIP, sem parecer. **Hipótese refutada pela conferência dos arquivos**: `carga-amostra-u0.zip` tem SHA **`63326754310817addc3c0836478de0a470fed28224e9ff12473ca0c24c6c1ba4`**, igual ao download/validação, manifesto e parecer final 4B-C1-03. Não houve substituição do arquivo. A hipótese foi preservada no histórico, sem convertê-la em achado confirmado.

Os hashes iniciais das execuções úteis diferem porque cada ensaio cria identidades/UUIDs e banco novos. A comparação válida é antes/depois **dentro de cada run**, não entre fixtures distintas. No postmortem 01, os 31 eventos persistidos sem confirmação obtida pelo cliente tinham seus recibos: 43 eventos/43 recibos, zero recibo ausente. Não eram recibos órfãos, nem perda dos 12 pontos confirmados. Essa execução continua reprovada; não foi reparada silenciosamente no mesmo banco.

A checagem SQL suplementar inicialmente exigiu recibo físico 4A para todos os 1.170 eventos e falhou por encontrar os **1.100 históricos de bootstrap**, que são LEGACY e não foram gerados pelo fluxo HTTP 4A. A premissa foi corrigida a partir de `carga-fixtures.mjs:40–48`, preservando a falha no metadado. Nova conferência por transação somente leitura: 1.100 originais com mesmo hash, **70 eventos novos/70 recibos 4A**, zero novo recibo ausente ou recibo órfão, ambas as chaves de 503 únicas e pertencentes ao titular. Não se criaram recibos nem se alterou qualquer evento para fazer a prova passar.

### Retestes, riscos e decisão de parada

Após o parecer foram reexecutados somente os gates de evidência afetados: **TypeScript exit 0, lint exit 0, parser 60 PDFs/60 ZIPs**, e conferência somente leitura do banco descartável. Não houve correção de código após o parecer, alteração SQL/schema, novo dataset ou repetição da carga integral. Os resultados anteriores 51/51, Web 286/286, agendamento 2/2 e demais regressões da seção 10 permanecem identificados por execução, sem soma de suítes sobrepostas.

**Ciclo 2 não necessário**: nenhum crítico/alto confirmado, nenhuma correção de implementação relevante após o parecer; o saneamento de logs é evidencial. Não enviar novo pacote ou novo ciclo apenas para conseguir aprovação. Risco médio aberto: disponibilidade/latência no writer único. Limites baixos/informativos: cobertura de revogação amostrada, inspeção externa por amostra e ausência de ensaio de 50 browsers/pendências completos. Riscos futuros: autorização→bytes, cópias já baixadas, administrador do host, writers distribuídos, energia/disco, segundo host e produção.

**Recomendação: elegível para autorização posterior de fechamento técnico restrito ao laboratório, com esses riscos explicitamente preservados.** Auditoria confrontada não congela baseline, não encerra automaticamente o marco nem atesta capacidade de produção. **PARAR** nesta rodada. Nenhuma baseline 4B, nenhum 4C, nenhum deploy/publicação, funcionário real, ponto oficial ou REP-P. **SUPABASE REMOTO INTOCADO. SIMULAÇÃO SEM VALOR OFICIAL.**

Os serviços descartáveis encerraram; nenhum listener 3103/3107/3108 permanece. Prévia original 3101/3105/3106 e Supabase local continuam, todos loopback. O processo original 29172 foi preservado; aplica o código de servidor carregado antes desta rodada. O agendamento novo foi provado no serviço de carga e será carregado em novas inicializações, sem forçar reinício da prévia atual. O núcleo 2B/2D/2E/2F teve **23 arquivos JS/SQL** comparados com a baseline 4A: nenhum alterado.

O estado “sem baseline 4B” descrito na seção 11 é o registro histórico da parada após a auditoria, anterior à autorização de fechamento. O estado vigente é o da seção 12. Sem 4C, sem produção/publicação, sem contato ou alteração no Supabase remoto.

## 12. Fechamento técnico autorizado — 01/10/2026

O responsável autorizou especificamente a conferência final, o congelamento do estado aprovado e a criação de **`METALLO-4B-LAB-20261001-R1`**. A aprovação manual permanece **APROVADA**; a auditoria permanece **CONCLUÍDA**; a carga permanece **CONCLUÍDA**. Não se iniciou funcionalidade nem se mudou regra de negócio nesta etapa.

### Baseline e rastreabilidade

- ZIP: `outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip`.
- SHA-256 final: recibo externo `Metallo-Marco4B-BaselineAprovada-20261001-R1.zip.sha256`.
- Scan direto, contagens finais, triagem e aprovação: `Metallo-Marco4B-BaselineAprovada-20261001-R1.zip.verificacao.json`. A baseline só é aprovada com `passed=true`, zero segredos confirmados e hash exato do ZIP; não se grava o próprio SHA dentro do arquivo que ele identifica.
- Origem imutável: **`METALLO-4A-LAB-20261001-R1`**, SHA-256 **`50a9c1c87f362f621d6fbe66f3a95a563b787a6145e5fcc918840a162177909d`**.
- Dentro do ZIP: `MANIFESTO_SHA256.json`, `INVENTARIO_4B.json`, `DELTA_4A_4B.json`, `RESULTADOS_4B.json`, manifesto da origem e documentação vigente. O manifesto contém hashes/tamanhos de cada arquivo e delta completo de novos/alterados/removidos em relação ao payload 4A.
- Evidência da conferência: `04_BANCO_E_SUPABASE/laboratorio-marco-4b/verificacao-fechamento-4b.json`. O gerador `gerar-baseline-4b.py` tem responsabilidade própria de verificar/congelar este marco; reutiliza helpers históricos sem executar os geradores anteriores. Esses dois arquivos novos são necessários para a fotografia 4B e sua conferência. Os recibos e índices gerados têm a responsabilidade de rastrear/verificar o pacote, sem duplicar este relatório vigente.
- Fotografia seletiva cumulativa de fontes e evidências, **não** checkout executável, dump sensível ou backup integral. As baselines anteriores e os pacotes de auditoria são preservados pelos hashes existentes. Capturas visuais permanecem no host, com referências/hashes no manifesto, para não carregar conteúdo de conta/navegador para o ZIP.

Triagem do scan: referências a cookies em variáveis de teste herdadas continuam com a revisão exata anterior. A busca adicional de credenciais literais também reconheceu `jwt-sintetico` em três mocks `getSession` de testes Web; não é JWT assinado nem credencial Auth. A primeira tentativa foi bloqueada porque um desses arquivos mudou desde 4A, embora permanecesse idêntico ao pacote 4B auditado. Candidato não aprovado e recibo preservados em `tmp/4b-candidato-nao-aprovado-01.zip` e `.zip.verificacao.json`; hashes no registro de fechamento. A triagem final exige **caminho + hash do trecho + hash da fonte auditada**, sem liberar tokens reais ou reduzir testes. Nenhuma baseline anterior ou aprovada foi sobrescrita. O scan final compara ainda as credenciais locais somente em memória e examina bytes/texto/metadados de PDF e todos os membros dos ZIPs sintéticos.

### Conferência final e resultados preservados

As fontes funcionais selecionadas continuam **idênticas às do ZIP auditado**. As únicas atualizações posteriores necessárias foram documentos/evidências de fechamento. Os **23 arquivos JS/SQL congelados do núcleo 2B–2F** continuam byte a byte iguais à baseline 4A. Catálogo local de funções, RLS, grants e estrutura de autorização conferido por leitura, sem alteração. **ZERO migration nova; ZERO RPC nova; ZERO alteração RLS; ZERO alteração grant no fechamento.**

| Suíte/gate | Resultado vigente |
|---|---:|
| 4B Auth/JWT/PostgREST/HTTP real | 51/51 |
| Web completa | 286/286 |
| Testes afetados | 43/43 |
| Agendamento HTTP | 2/2 |
| 4A | 80/80 |
| Confronto 4A | 13/13 |
| 2F | 28/28 |
| Banco | 31/31 |
| Qualidade | 44/44 |
| Rede | 8/8 |
| TypeScript / lint / build | APROVADOS |
| Parser independente | 60 PDFs e 60 ZIPs corretos |

**Não somar suítes sobrepostas.** Estes resultados preservam as execuções já identificadas, incluindo o reteste evidencial após o parecer; não representam nova bateria completa ou nova carga no fechamento documental. TypeScript/lint têm comando, datas, exit code 0 e hashes registrados. O ensaio completo, requests, recursos, tentativas reprovadas, postmortem, cenários e resultados integrais permanecem no pacote; também foram preservados **todos os 120 downloads finais**, verificados contra os hashes do resultado de carga. Banco privado, tokens, senhas, cookies e dados reais não são material do pacote.

### Carga, integridade e capacidade

**O laboratório concluiu ensaio com 50 identidades concorrentes, preservando integridade, mas apresentou degradação significativa de latência/disponibilidade.**

50 identidades Auth distintas, cinco sem equipe, sessões/JWT próprios; Node HTTP, pypdf + zipfile. Ryzen 7 5700X3D, 16 GB RAM, Windows build 26200, Node 24.19.0, Next 16.3.4, PostgreSQL 17.6 com `max_connections=100`, PGlite 0.5.8 e **um writer**. Serviços somente loopback.

Pico 54 requests em andamento; **902** medidos; duração **426,591 s**; throughput **2,114 req/s**; p50 **11,286 s**; p95 **61,257 s**; p99 **63,763 s**; maior latência **64,425 s**. 495 respostas 2xx; 405 respostas 4xx esperadas; **duas respostas 503 recuperadas**; zero timeout cliente; zero erro de transporte; sete retries/recuperações. As duas chaves de 503 foram conferidas no banco descartável: **um evento correto e um recibo correto por chave**.

**INTEGRIDADE PRESERVADA NO ENSAIO:** 1.100 originais preservados, 70 eventos novos, 70 recibos novos, zero recibo novo ausente, zero órfão, zero duplicação, zero perda confirmada e zero vazamento cruzado nas provas; estado **READY**. Parser independente conferiu 60 PDFs/60 ZIPs corretos. Falhas das tentativas anteriores continuam registradas; a execução final não as apaga.

**MÉDIO ABERTO — disponibilidade/latência:** writer único, p95 ~61 s, p99 ~64 s, dois 503 recuperados e throughput reduzido. A integridade não reduz esse risco. Não se declara capacidade validada para 50 usuários em produção. O teste não representa infraestrutura final, Internet real, Supabase remoto ou 50 navegadores completos; a Home de carga mediu marcações pessoais e não três RPCs de pendências simultâneos.

Cinco identidades foram revogadas: zero operações novas bem-sucedidas iniciadas após a conclusão da revogação. Janela observada **0,493–2,469 s**, incluindo intervalo de consulta e latência, **sem afirmação de revogação instantânea**.

### Auditoria e riscos mantidos

**Um ciclo Grok concluído e confrontado; ciclo 2 não necessário e não executado.** Não houve correção relevante de implementação após o parecer. O confronto integral dos oito achados está na seção 11 e em `auditoria-4b.json`, preservado como registro histórico daquela etapa. Logs silenciosos foram sanados por comprovação de exit code, sem inventar resultado nem mudar gate.

Pacote enviado preservado separadamente: **`Metallo-Marco4B-RegistrosComprovantes-Auditoria-20261001-Ciclo1-Final.zip`**, **183 entradas**, SHA-256 **`9781552cba3062b07aec753a8f91ef3f8539638468fc02d604ae2d04ef509e47`**, scan direto aprovado. Parecer original integral preservado, SHA **`62c6869a19dd798005b666d5d90ce01d232fc29badf6856569608a948be070df`**; conversa **https://grok.com/c/6c4ea377-cc82-47f6-885f-091b2d9c668d**. Nenhum novo envio/ciclo foi realizado no fechamento.

Além da disponibilidade média, permanecem os limites de cobertura da revogação, inspeção externa por amostras, **autorização → envio completo dos bytes**, cópias já baixadas que o servidor não pode revogar (sem classificá-las como falha de sessão), RLS/Gestão para arquitetura remota futura e controle do host pelo administrador. Não se comprova proteção contra host comprometido, cluster/HA, múltiplos writers, queda real de energia/disco ou segundo computador físico.

### Rede, governança e parada

Conferência por `netstat -ano`, healthcheck somente leitura e hashes: listeners da prévia/Gestão/núcleo em **127.0.0.1**, Supabase local em **127.0.0.1/::1**; **3103/3107/3108 encerrados**. Núcleo da prévia em **READY**. Não foi forçado reinício dos serviços originais nem alterada configuração de rede. O código de agendamento auditado será carregado em novas inicializações; a execução de carga já o comprovou.

Organização **01–07** e `AGENTS.md` preservados. Nenhuma alteração funcional, SQL ou núcleo congelado neste fechamento. **SUPABASE REMOTO INTOCADO. Nenhuma publicação. Nenhum funcionário, CPF ou jornada real.**

**SIMULAÇÃO SEM VALOR OFICIAL. NÃO IMPLANTADO NO SUPABASE REMOTO. NÃO LIBERADO PARA FUNCIONÁRIOS REAIS. NÃO É PRODUÇÃO. NÃO É CONFORMIDADE REP-P. NÃO É AUTORIZAÇÃO DE PONTO OFICIAL. NÃO AUTORIZA PUBLICAÇÃO.**

**PARAR após baseline + manifesto + SHA + scan aprovado. Não iniciar Marco 4C, segundo ciclo Grok ou outro módulo.**
