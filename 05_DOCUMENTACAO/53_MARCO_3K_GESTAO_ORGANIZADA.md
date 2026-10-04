# Marco 3K — Gestão organizada (computador formal, celular rápido)

Data: 04/10/2026 · Branch `laboratorio-colaborador` · publicado só no **teste online** (produção intocada).

## Problema
"Obras e pedidos" misturava 13 tarefas em 6 abas (só a primeira tinha 5 formulários e 2 tabelas). A mesma ação
aparecia em vários lugares (entrega de EPI em 5). No celular: menu lateral virava faixa rolando de lado, sem botão
Sair, abas estourando a tela e tabelas rolando para o lado.

## Nova organização
- **Computador**: menu em grupos — Início, Lançar · ESTOQUE (Estoque das obras, Materiais, EPIs e fardamento,
  Itens pessoais, Equipamentos, Histórico) · PEDIDOS (Pedidos à ADM, Pedidos dos funcionários, Máquinas alugadas) ·
  PESSOAS (Funcionários, Funcionários em apoio, Equipes, Comunicados, Ponto) · OBRAS E RELATÓRIOS (Obras, Consumo,
  Relatórios) · ADMINISTRAÇÃO. Abas do grupo no topo de cada tela.
- **Celular**: barra fixa embaixo — Início · Lançar · Pedidos · Menu (lista completa + Sair).
- **Início**: atalhos grandes + "Precisa de você" (pedidos dos funcionários, pedidos para receber, pedidos à ADM em
  andamento, alertas da ADM com o caminho certo) + indicadores.
- **Lançar**: uma ação por tela, formulário já aberto — Registrar consumo, Receber material ou EPI, Entregar EPI
  (no teste vai para o fluxo com confirmação no app), Pedir à ADM, Transferir ou dar baixa, Mover equipamento,
  Transferir EPI. A fila sem internet continua igual.
- "Obras e pedidos" foi dividida: `/estoque` (cartões por local, com busca), `/pedidos-adm` (Em andamento /
  Concluídos), `/locacoes`, `/apoio`, `/obras`. Endereços antigos `/obras?section=...` redirecionam.

## Técnica
- Menu: `09_CONFIGURACOES/navegacao-gestao.ts` (grupos, ações de Lançar, mapa das seções antigas).
- `SiteOperations` ganhou modos por tela; `MaterialOperations` aceita `kinds`/`title`; `PedidosObra` aceita
  `showForm`/`showOrders` e filtro; `FormulariosAbertos` abre o formulário nas telas de uma ação.
- Ícones em `02_COMPONENTES_VISUAIS/icones-menu.ts` (módulo comum). Lição: tela do servidor não pode ler objeto
  exportado de módulo "use client" (a primeira publicação quebrou o Início por isso; há teste de guarda).
- Testes: `gestao-navegacao-3k.test.tsx`.

## Ajuste após teste no celular (04/10)
- Pedidos dos funcionários: o nome e o texto ficavam espremidos ao lado do formulário. Agora, no celular, a linha
  vira cartão (texto em cima, formulário embaixo, largura toda) e o nome não é mais cortado com "...".
- Todas as tabelas da Gestão viram cartões no celular: `RotulosTabelas` (no AppShell) copia o título de cada coluna
  para a célula (`data-label`) e o CSS mostra "COLUNA  valor" em cada linha. No computador nada muda.
