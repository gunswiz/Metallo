# Marco 3T — Pedir material pelo app (09/10/2026)

Teste online, dados fictícios.

- **App** › Solicitações › **Pedir material**: escolhe o material (só materiais, sem equipamentos), quantidade (aceita vírgula), observação opcional e "Enviar pedido".
  Lista "Meus pedidos" com a situação (esperando resposta, atendido, recusado, cancelado) e a resposta do escritório; pode cancelar enquanto estiver esperando.
  Reenvio não duplica (chave única). Limite de 10 pedidos esperando resposta por pessoa.
- **Gestão** › **Pedidos dos funcionários** › nova seção **Pedidos de material**: **Atendido** (com resposta opcional) ou **Recusar** (motivo obrigatório; o funcionário vê).
  Pedidos abertos entram no contador "Pedidos dos funcionários" do Início.
- Marcar como atendido **não mexe no estoque**: a saída/consumo continua sendo lançada normalmente (ajuda a lembrar de alimentar o consumo diário).
- Quem responde: administrador, engenheiro ou líder ativo (tela exige permissão de EPI).
- Banco: `teste-online/3t-pedido-material.sql` (tabela privada `pedidos_material_3t`; RPCs `my_materiais_3t`, `create_/my_/cancel_pedido_material_3t`, `admin_pedidos_material_3t`, `decide_pedido_material_3t`).
- Provas `teste-online/provas-3t-online.mjs`: **13/13**. Testes `10_TESTES/pedido-material-3t.test.ts`.
