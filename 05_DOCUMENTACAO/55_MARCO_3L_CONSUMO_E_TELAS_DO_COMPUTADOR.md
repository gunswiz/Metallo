# Marco 3L — Consumo com gráficos e telas formais no computador (05/10/2026)

Só no laboratório / teste online (dados fictícios). Produção intocada.

## O que mudou
- **Consumo** (`/consumo`): painel para o dono olhar.
  - Escolha da medida (unidades, caixas, kg, litros). Medidas diferentes nunca se somam.
  - Números grandes: total do período com variação contra o período anterior, média por dia trabalhado, equipe que mais consumiu, material mais consumido.
  - Gráfico de colunas dia a dia (semana a semana acima de 45 dias), com linha de média e valor ao passar o mouse/tocar.
  - Rosca "Para onde foi o consumo" (até 7 fatias; o resto vira "Outros"), barras por equipe e por categoria.
  - Ranking de materiais com participação, período anterior e variação; lançamentos recolhidos no fim.
  - Paleta categórica validada para o fundo escuro (`CORES_CONSUMO`); a cor segue o material.
- **Estoque das obras**: no computador vira tabela material × local com coluna Total (zerado em vermelho); no celular continuam os cartões.
- **Treinamentos e ASO**: no computador vira tabela (funcionário, situação, ASO, NRs em etiquetas coloridas, ações); no celular continuam os cartões.
- **Funcionários em apoio**: mostra só quem está de fato ajudando outra equipe (tabela com origem, destino, desde, até, Encerrar). A lista completa fica recolhida. Botão gigante corrigido (regra `.list-row > .button`).
- **Comunicados**: prévia ao vivo "como o funcionário vê no app", "Fixar no topo" corrigido (caixa de marcar esticava por causa de `.panel-body label input`), barra "X de Y já viram", abas de Pessoas no topo.
- Classes utilitárias `.so-computador` / `.so-celular` (corte em 820 px).

## Limite conhecido
- Sem preço no cadastro de materiais, o painel mostra **quantidades**, não R$. Próximo passo sugerido: custo unitário no material (ou no recebimento do pedido) para mostrar "quanto foi gasto".

## Dados fictícios
- `04_BANCO_E_SUPABASE/teste-online/semear-consumo-3l.sql`: 13 materiais, saldos (alguns abaixo do mínimo), ~90 dias de consumo das equipes Solda A e Montagem B, e Pedro em apoio à Montagem B.
- Ordem de reset: … → `semear-teste-online.mjs` → `semear-treinamentos-5a.sql` → `semear-consumo-3l.sql`.

## Testes
- `10_TESTES/gestao-telas-3l.test.tsx` (6) e ajuste em `gestao-navegacao-3k.test.tsx` (tabela + cartões).
