# Marcos 3Q e 3R — Preço dos materiais e contrato do equipamento alugado (09/10/2026)

Teste online, dados fictícios. Produção intocada.

## 3Q — Consumo em R$
- **Materiais › Preços** (`/materiais/precos`, só administrador): preço por unidade de cada material (12,50). Só grava o que mudou; histórico de quem mudou no banco.
- **Consumo** abre em **R$** quando há preços: tudo somado (caixas, kg, litros), gráfico dia a dia, por equipe, por categoria e ranking em reais.
  Aviso dos materiais usados no período que ainda não têm preço. As medidas (unidades, caixas…) continuam nos botões.
- Valor **estimado pelo preço atual**. Preço visível só para administrador e engenheiro.
- Banco: `teste-online/3q-precos-materiais.sql` (tabelas privadas `item_prices_3q` e `item_price_history_3q`; RPCs `item_prices_3q`, `admin_set_item_prices_3q`).
  Preços fictícios: `teste-online/semear-precos-3q.sql`. Testes `10_TESTES/precos-consumo-3q.test.ts`.

## 3R — Equipamento alugado: contrato e valor real
- Pedido da ADM: no cadastro do equipamento **alugado**, informar **número do contrato** e **valor real do equipamento** (quanto a máquina vale, para perda/dano).
  **O valor do aluguel fica de fora**, por decisão da ADM.
- Campos aparecem em **Equipamentos › Novo** e em **Editar equipamento**, só quando "Alugado". Ambos opcionais.
- Detalhe do equipamento mostra o contrato (todos) e o valor (só administrador e engenheiro). A lista mostra "Locadora · Contrato …".
- Banco: `teste-online/3r-contrato-equipamento-alugado.sql` (tabela privada `asset_rental_details_3r`; gravar com a mesma permissão do cadastro de equipamento).
  Testes `10_TESTES/aluguel-contrato-3r.test.tsx`.
