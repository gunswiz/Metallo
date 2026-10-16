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
A imagem parada (public/galpao-poster.webp, 160 KB) é gerada do mesmo modelo 3D (estrutura montada) pelo script tmp/gerar-poster.mjs.

## Acessibilidade
- Nenhum texto com menos de 13 px no visual novo (login, painel do galpão, app).
- Testado em 320 px e 360 px: sem rolagem lateral; formulário visível sem rolar no login simples.

## Provas
- Testes novos: galpao-modelo (modelo completo), redesign-teste, login-galpao-3d (regra de decisão e telas). Total: 512 testes, tipos e lint limpos.
