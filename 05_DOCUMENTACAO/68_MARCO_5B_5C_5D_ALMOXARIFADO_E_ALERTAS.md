# Marco 5B, 5C e 5D — Almoxarifado: baixa do pedido, estoque baixo e vencimentos

Ambiente: TESTE ONLINE (Supabase `cvimwiqokkujfhwynhmt`, dados fictícios). Produção não foi tocada.

## 5B — Pedido atendido dá baixa no estoque
- Tela **Pedidos** (Gestão): cada pedido de material mostra a **equipe** do funcionário e o **saldo na obra**.
- Ao marcar **Atendido**, a caixa **"Dar baixa no estoque"** já vem marcada quando há saldo. O material sai do estoque da obra como **consumo da equipe**, com a observação "Pedido pelo app nº X — Nome".
- Pode desmarcar se a saída já foi lançada à mão (não lança em dobro).
- Sem saldo: a baixa é recusada com aviso claro e o pedido **continua aberto**.
- Usa a mesma regra de consumo de sempre (`consume_material`): permissão da equipe, saldo e histórico de movimentações.
- Banco: `5b-pedido-baixa-estoque.sql` — `admin_pedidos_material_5b`, `decide_pedido_material_5b`, tabela `private.pedido_material_baixa_5b`.

## 5C — Aviso no celular da Gestão (estoque baixo e vencimentos)
- De segunda a sexta, às **7h05** (Fortaleza), o celular de quem é admin/engenheiro e ligou os avisos recebe **um único aviso** só com as **novidades**: material/EPI abaixo do mínimo, ASO, treinamentos, C.A. e lotes de EPI vencidos ou vencendo em 30 dias.
- O que já foi avisado não se repete por 7 dias. Na segunda-feira vem o **resumo da semana**.
- Sem novidade, não manda nada.
- Banco: `5c-alertas-gestao.sql` (`private.alertas_hoje_5c`, `private.aviso_alertas_5c`, agendamento `metallo-alertas-gestao`). Envio pela função `lembrete-consumo` (`{"acao":"alertas"}`, protegida pela chave do agendador no Vault).

## 5D — Validade do C.A. e lotes de EPI
- Na ficha do EPI, novo quadro **Validade do C.A.** (data). Mostra "vencido" / "vence em até 30 dias".
- O painel inicial lista: EPI com C.A. vencido, C.A. vencendo em 30 dias e lotes de EPI vencidos/vencendo.
- Banco: `private.epi_ca_validade_5d`, `admin_set_ca_validade_5d`, `ca_validades_5d`, `vencimentos_epi_5d`.

## Provas
- `provas-5b-online.mjs`: **22/22** (baixa correta, sem duplicar, sem saldo mantém aberto, atender sem baixa, permissões, validade do C.A., disparo sem chave recusado).
- Disparo real no emulador Android (AVD `Metallo_API_36`): notificação "Metallo · alertas novos" chegou no Chrome da Gestão.
- Testes web: 60 arquivos, 456 testes, typecheck e lint limpos.
