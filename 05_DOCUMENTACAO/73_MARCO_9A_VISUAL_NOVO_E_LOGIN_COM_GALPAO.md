# Marco 9A — Visual novo (Gestão e app do funcionário) e login com galpão 3D

Só no ambiente de TESTE e nas prévias locais. O sistema oficial não muda: o visual novo liga apenas quando o endereço do banco é o de teste (ou prévia local explícita). Os testes provam isso.

## O que mudou
- Gestão: menu lateral, barra de cima com caminho (Metallo Gestão / tela), cartões, tabelas e botões no novo estilo. Tabelas ganharam rótulos por coluna para o celular.
- App do funcionário: menu fixo no computador (as 20 telas) e atalhos embaixo no celular (Início, Ponto, EPIs, Avisos, Mais). Botão Registrar ponto grande (56 px, letra 18 px).
- Login das duas áreas com o galpão da obra Plastamp montado em 3D (animação, vistas, interior). O formulário é o original (mesma validação e mensagens).
- Prévia local do ponto no computador (só em modo de desenvolvimento, porta 3101): destino do servidor continua fixo em HTTPS de teste.

## Celular antigo ou fraco (regra do login 3D)
Função pura `decidirModoLogin` (03_FUNCOES_E_LOGICA/Galpao/decidir-3d.ts):
- Computador (largura de 900 px ou mais), aparelho bom: mostra o 3D.
- Celular (menos de 900 px): login simples com a imagem do galpão e o botão "Ver animação do galpão". O 3D só carrega se a pessoa pedir.
- Aparelho fraco (memória de 2 GB ou menos, 2 núcleos ou menos, Chrome anterior à versão 90, economia de dados ou reduzir movimento ligados): sempre login simples, sem botão de animação.
- Se o 3D falhar, o login continua funcionando.
A imagem parada (public/galpao-poster.webp, aproximadamente 45 KB) é gerada do mesmo modelo 3D, com a obra completa vista pela frente, pelo script tmp/gerar-poster.mjs.

## Acessibilidade
- Nenhum texto com menos de 13 px no visual novo (login, painel do galpão, app).
- Testado em 320 px e 360 px: sem rolagem lateral; formulário visível sem rolar no login simples.

## Correção da frente e dos fundos — 17/10/2026
- A face com a escada amarela é o fundo do galpão e não possui janelas. A alvenaria foi fechada em toda essa face.
- A perspectiva inicial do login mostra a frente oposta à escada. Os nomes Frente e Fundo no seletor acompanham a identificação corrigida.
- As posições físicas das portas, escada, descida pela platibanda, linhas de vida e contraventamentos foram preservadas. Permanecem os 12 módulos longitudinais.
- A imagem do login simples foi regenerada com a mesma vista frontal e a obra completa.
- Revisados os commits do Claude `ac5a3e7` e `eccccb7`: mantidas a escolha de 3D por capacidade do aparelho, animação opcional no celular, textos maiores e a independência do teste do portal em relação à configuração externa.

## Calhas e bases soldadas — correção posterior de 17/10/2026
- Calhas contínuas nas duas laterais, acima das vigas e com o canal livre. As terças extremas terminam antes da calha; o fechamento interno sobrepõe a borda externa, sem atravessar o fundo do canal. As tampas ficam somente nas extremidades.
- Informação do responsável incorporada às 39 bases: chapa diretamente sobre a armadura da base e coluna soldada à chapa, sem parafusos nem chumbadores. Três passes sobrepostos de solda acompanham o perfil da coluna. A armação aparece antes da execução do piso; medidas dos detalhes continuam ilustrativas.
- A coluna encosta na chapa, sem o espaço que existia anteriormente. Os passes aparecem após o assentamento da coluna, antes da etapa das vigas.
- Seletor de vistas: **Calha e fechamento interno** e **Bases soldadas · 3 passes**. Atualizados os nomes das etapas e a imagem leve do login.

## Câmera livre — 17/10/2026
- Novo botão **Câmera livre** no painel do galpão das duas áreas. Permite observar por fora, atravessar o fechamento para entrar e subir acima da cobertura, sem ficar preso às vistas ou aos limites do passeio interno.
- Ao partir de uma vista de detalhe, mantém o foco nesse detalhe. Ao partir do interior, conserva a posição e a direção do olhar. **Ver estrutura**, **Obra completa** e a seleção de etapas mantêm a posição da câmera livre.
- Arrastar olha ao redor; Shift + arrastar ou botão direito desloca no plano da tela. A roda avança e recua de fato. W/A/S/D movem continuamente, Q/E descem/sobem e Shift acelera. A movimentação para ao soltar as teclas, perder o foco ou sair da tela.
- Velocidades **Precisão**, **Normal** e **Rápida**, botões de deslocamento e subida/descida para toque, e **Reenquadrar obra** para recuperar a vista geral. Esc sai da câmera; o botão **Voltar ao login** devolve o acesso ao formulário.
- O passeio interno existente permanece disponível. A animação continua opcional no celular; a câmera livre só inicia quando solicitada.

## Provas e prévia local
- Bateria completa anterior à correção das calhas/bases: 514 testes aprovados em 67 arquivos.
- Após essa correção: 15 testes aprovados em `galpao-modelo`, `login-galpao-3d` e `redesign-teste`; tipos e lint dos arquivos alterados sem erros. Verificados contato coluna/chapa, ausência de chumbadores, três passes por base, sequência de montagem e continuidade do fundo das calhas acima da estrutura nas duas laterais.
- Os testes continuam verificando a ausência de janelas nos fundos, o fechamento da alvenaria e a orientação inicial.
- Após a câmera livre: 22 testes aprovados em `galpao-camera`, `galpao-modelo`, `login-galpao-3d` e `redesign-teste`; tipos e lint dos arquivos alterados sem erros. Verificadas movimentação, recorte próximo à câmera, enquadramento, preservação da posição entre etapas, parada ao perder foco, limpeza dos controles e devolução do formulário.
- Conferência visual em computador (1440 × 1000) e celular (360 × 800): vista frontal, fundos sem janelas, imagem leve carregada, ausência de rolagem horizontal e ativação opcional da animação.
- Gestão: http://127.0.0.1:3102/login
- Funcionário: http://127.0.0.1:3101/colaborador/login
- No painel ampliado, selecionar a vista Fundo para conferir a face da escada.
- Para as correções mais recentes, selecionar **Calha e fechamento interno** ou **Bases soldadas · 3 passes**. As duas vistas foram conferidas com a obra completa.
- Evidências locais: `outputs/Metallo-Teste-Login.jpg`, `outputs/Metallo-Galpao-Fundos.jpg`, `outputs/Metallo-Galpao-Calha.jpg` e `outputs/Metallo-Galpao-Bases-Soldadas.jpg`.
- Câmera livre conferida em 1440 × 1000 e 360 × 800, com controles acessíveis e sem rolagem horizontal. Evidência: `outputs/Metallo-Galpao-Camera-Livre.jpg`. Para avaliar: abrir o login, clicar em **Câmera livre** e escolher **Ver estrutura** ou **Obra completa**; selecionar uma vista do interior e ativar a câmera livre permite começar já dentro da obra.
- Revisado pelo Claude em 18/10/2026 (somente visual: sem rede, sem dados, sem mudança de regra ou segurança; bateria completa de 523 testes, tipos e lint limpos) e publicado no ambiente de TESTE. Produção não muda.
