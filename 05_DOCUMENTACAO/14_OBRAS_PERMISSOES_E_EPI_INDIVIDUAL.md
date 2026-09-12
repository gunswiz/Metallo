# Metallo 0.10.0 — o que mudou e onde acessar

Esta atualização adapta o Metallo à rotina informada pela equipe: várias equipes na mesma obra, compras entregues diretamente no local, funcionários em apoio, EPI entregue por responsável e locações acompanhadas pela ADM.

## Primeiro acesso

No **web**, abra **Obras e pedidos** no menu lateral.

No **mobile**, toque no **ícone de obra/construção na barra superior**. A tela se chama **Obras e pedidos** e reúne as mesmas áreas do web. Deslize as abas horizontalmente para encontrar todas.

| Alteração | Caminho no web | Caminho no mobile | Como usar |
| --- | --- | --- | --- |
| Permissões por pessoa | Usuários → Criar acesso ou Editar → Permissões de operação | Administração → Criar acesso ao Metallo ou Gerenciar usuários → Permissões de operação | A ADM marca os direitos indicados pelo encarregado e as equipes autorizadas. |
| Um estoque por obra | Obras e pedidos → Obras e equipes | Ícone de obra → Obras e equipes | A ADM cadastra a obra, define a equipe que guarda o estoque e vincula as demais equipes. |
| Compra de material direto na obra | Obras e pedidos → Estoque e lançamentos → Registrar compra entregue direto na obra | Ícone de obra → Estoque e lançamentos → Compra entregue direto na obra | Informe equipe, material, quantidade e quando chegou. |
| Compra de EPI direto na obra | Obras e pedidos → Estoque e lançamentos → Compra de EPI entregue direto na obra | Mesmo caminho na tela de obras | Informe item, quantidade, tamanho/variante, C.A., marca/modelo e lote. |
| EPI da COSEM ou de outra obra | Obras e pedidos → Estoque e lançamentos → Transferir EPI da COSEM ou entre obras | Mesmo caminho na tela de obras | Escolha o lote de origem, destino e quantidade. C.A. e identificação do lote são preservados. |
| Consumo diário com data correta | Obras e pedidos → Estoque e lançamentos → Registrar consumo diário | Mesmo caminho na tela de obras | Informe a equipe que executou o serviço, inclusive COSEM, e a data/hora do consumo. |
| Comparação de consumo | Consumo | Aba Consumo na navegação inferior | Continua separado por equipe e período, com cores distintas nos gráficos. |
| Transferência de equipamento | Obras e pedidos → Estoque e lançamentos → Transferir equipamento para outra equipe | Ícone de obra → Estoque e lançamentos → Transferir equipamento | Uma confirmação registra o destino e o histórico. |
| Pedido de compra ou locação | Obras e pedidos → Pedidos e recebimentos → Novo pedido à ADM | Mesmo caminho na tela de obras | Adicione os itens e quantidades à lista e envie à ADM. |
| Aprovação e compra | Dentro do pedido → ADM: atualizar etapa do pedido | Dentro do pedido → ADM: atualizar etapa | A ADM registra o envio ao patrão, a aprovação recebida e a compra/locação providenciada. |
| Recebimento parcial | Pedido → Confirmar o que chegou | Mesmo botão dentro do pedido | Registre somente o que chegou. O sistema mostra solicitado, recebido e faltante. |
| Entrega de EPI por funcionário | Obras e pedidos → Estoque e lançamentos → Registrar entrega individual de EPI | Mesmo caminho na tela de obras | Selecione funcionário, lote, quantidade e motivo: primeira entrega, adicional, desgaste, perda ou dano. |
| Destino do EPI anterior | Funcionários → pessoa → itens atribuídos | Início → EPI e Pessoas → Funcionários → pessoa → item | Registre devolvido, substituído, perdido, danificado ou consumido, incluindo baixa parcial quando houver várias unidades. |
| PDF individual para assinatura | Funcionários → pessoa → PDF individual de EPI para assinatura | Início → EPI e Pessoas → Funcionários → pessoa → ícone de PDF | Gere a ficha, imprima ou compartilhe e colha a assinatura do funcionário. |
| Funcionário ajudando outra equipe | Obras e pedidos → Funcionários em apoio | Ícone de obra → Funcionários em apoio | A ADM informa a equipe de apoio, início e fim previsto opcional; depois pode encerrar o apoio. |
| Máquinas alugadas por obra/equipe | Obras e pedidos → Máquinas alugadas | Ícone de obra → Máquinas alugadas | Veja locadora, número da máquina, equipe e situação. |
| Aviso de máquina desnecessária | Máquina → Avisar à ADM que não precisamos mais | Mesmo botão dentro da máquina | Informe o motivo. A ADM combina a devolução e registra a entrega à locadora. |
| Valores e datas da locação | Máquina → ADM: valores e datas da locação | Máquina → ADM: valores e datas | Campos opcionais de valor, período, previsão de devolução e confirmação do fim da cobrança. |
| Encerrar ou reabrir obra | Obras e equipes → obra → Encerrar obra / Reabrir obra | Mesmo caminho na tela de obras | A ADM altera a situação da obra; máquinas ainda nela passam a aparecer nos alertas. |
| Alertas somente para a ADM | Sino superior ou Obras e pedidos → Alertas | Ícone de obra → aba Alertas | Acompanhe pedidos, faltantes, estoque, EPI, ASO e locações. |
| Lançamentos sem internet | Obras e pedidos → lista de pendentes | Ícone de obra → lista de pendentes | Veja os registros ainda não confirmados e use Atualizar e enviar pendentes / Enviar pendentes. |

## Configurar uma obra pela primeira vez

1. Cadastre as equipes normalmente, se ainda não existirem.
2. Como ADM, entre em **Obras e pedidos → Obras e equipes → Cadastrar obra e definir estoque**.
3. Escolha a equipe/local que representa o estoque físico da obra.
4. Use **Vincular mais uma equipe à obra** para incluir quem trabalha no mesmo local.
5. Confira os saldos. Os materiais ainda separados dessas equipes são somados ao estoque único, com registro da unificação no histórico.
6. Registre a transferência dos lotes de EPI que saem da COSEM para a obra. Os lotes anteriores permanecem como estoque central até essa transferência ser registrada.

A COSEM continua como local central. Antes de receber EPI diretamente em uma equipe de campo, vincule-a à obra correta. O sistema não adivinha onde estão os itens já cadastrados.

Ao mover uma equipe para outra obra, o estoque compartilhado permanece na obra anterior. A equipe principal que representa o estoque não pode ser transferida ou excluída enquanto estiver vinculada à obra. Encerrar a obra preserva o histórico e os saldos; não devolve materiais nem máquinas automaticamente.

## Permissões no cadastro

A conta de acesso pertence ao encarregado/responsável que registra operações. O cadastro de funcionário para EPI continua separado e **não exige conta nem celular do funcionário**.

A ADM pode liberar individualmente:

- Entradas e movimentações de materiais.
- Consumo.
- Cadastro e movimentação de equipamentos.
- Entregas, solicitações e baixas de EPI.
- Pedidos de compra e confirmação do recebimento.
- Solicitações de máquinas e avisos de devolução.

Em **Escolher equipes em que pode operar**, marque também as equipes adicionais que a pessoa atende. Uma lista explicitamente vazia não concede nenhuma equipe/operação. Desligar a personalização restaura os direitos padrão do cargo. Administradores mantêm acesso completo. Contas antigas conservam os padrões anteriores até a ADM mudar as escolhas.

As verificações também acontecem no banco. Retirar a permissão impede o envio de operações ainda pendentes, mesmo que o formulário tenha sido aberto antes da alteração. Mudanças de acesso ficam registradas para a ADM.

## Pedido, aprovação e recebimento

O fluxo é **Enviado à ADM → Aguardando o patrão → Aprovado → Compra/locação providenciada → Recebimento parcial ou completo**. A aprovação é registrada pela ADM depois de falar com o patrão; não exige uma conta para ele.

É possível pedir materiais, EPI e máquinas em uma lista. O encarregado não precisa preencher preços nem escolher a locadora na solicitação. No recebimento da máquina, informe a locadora e um número por máquina. No recebimento de EPI, informe o C.A. e a identificação do lote.

Recebeu 8 de 10? Registre 8. Somente 8 entram no estoque; as 2 restantes continuam pendentes. O histórico do pedido guarda cada recebimento e a etapa registrada pela ADM.

## Entregas e ficha individual de EPI

A entrega identifica **funcionário, equipe na data do fato, lote, variante, quantidade, C.A., motivo e responsável pelo lançamento**. Na troca, registre também o destino do item anterior pela ficha do funcionário.

A nova ficha PDF reúne todo o histórico disponível daquele funcionário, com data de entrega, item/variante, C.A. e quantidade. Inclui total, identificação da pessoa, páginas numeradas e campos para assinatura do funcionário, data e responsável pela conferência. A assinatura é colhida no documento; não há confirmação pelo celular do funcionário.

Registros antigos sem C.A. são apresentados como **Não informado**. O sistema não inventa um certificado. Novas entradas da área de obras exigem o C.A. quando o item é EPI. A ficha não soma fardamento ou ferramentas pessoais ao total de EPI.

Se uma entrega tiver uma unidade danificada e outra ainda em uso, a baixa parcial preserva o total originalmente entregue e sua data. O PDF não duplica a quantidade por causa dessa divisão.

## Funcionários em apoio e equipamentos

O apoio temporário preserva a equipe de origem do funcionário. Entregas de EPI usam a equipe em que ele estava trabalhando na data informada. Ao encerrar o apoio, a equipe de origem volta a ser a referência.

A transferência de equipamento registra origem, destino, responsável e horário com uma única confirmação. As consultas do histórico mostram a data do fato e quando foi registrado. As correções de histórico de materiais preservam o vínculo com o estoque físico anterior mesmo que a equipe já tenha mudado de obra.

## Máquinas alugadas e alertas

O aviso **não precisamos mais** cria uma pendência para a ADM. Ele não encerra sozinho a locação, a cobrança ou a presença da máquina na empresa. A ADM registra a devolução física e confirma separadamente a data em que a cobrança foi encerrada com a locadora.

Valores, período de cobrança e datas previstas são opcionais e visíveis somente para a ADM. O sistema não calcula valores que a obra não informou.

Os alertas ficam na área da ADM: pedidos sem providência, recebimentos incompletos, materiais/EPI abaixo do mínimo, ASO e reposição de EPI, avisos de devolução, devolução prevista vencida e máquina em obra encerrada. Um lembrete para conferir máquinas sem movimentação registrada há 14 dias não afirma que elas ficaram sem uso nesse período.

Esta entrega centraliza os alertas **dentro do Metallo**. Não cria envio por WhatsApp, e-mail ou notificação externa.

## Data do fato e trabalho sem internet

Nos formulários de **Obras e pedidos**, ajuste **Quando aconteceu?** se estiver registrando depois. O consumo entra na comparação pelo dia em que aconteceu. O horário do registro também é preservado para conferência.

No mobile, abra a área uma vez com internet para guardar a consulta naquele aparelho. Depois, os novos lançamentos dessa área podem ficar na fila local. O aplicativo tenta enviar ao abrir/retomar a tela e oferece o botão de envio manual. No web, a fila é guardada no navegador; uma página já aberta pode guardar lançamentos sem conexão, mas abrir/recarregar todo o site ainda exige internet.

- Um lançamento pendente **ainda não é saldo confirmado**.
- Retentativas usam a mesma identificação para evitar duplicidade se a resposta da rede se perder.
- Pendências e consultas salvas são separadas por conta.
- Erros de estoque, recebimento ou permissão ficam para conferência; não são descartados silenciosamente.
- Não apague os dados do navegador/aplicativo nem desinstale com pendências não enviadas.
- As telas antigas e a geração de PDF continuam exigindo conexão; a fila se aplica aos formulários de **Obras e pedidos**.

## Cores e organização

O azul da marca foi preservado. Materiais usam destaque verde, equipamentos e locações lilás, consumo laranja, EPI/pessoas amarelo e obras/histórico azul claro. Os gráficos de consumo distinguem as séries por cores e mantêm os nomes e valores visíveis.

No código, as telas web de estoque, pedidos, locações, funcionários e cadastro foram separadas em `01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos`. Formulários, fila local, permissões e geração de PDF possuem arquivos próprios. No mobile, a nova área está em `02_MOBILE/lib/01_TELAS/09_OBRAS_E_PEDIDOS`, com repositório e regras separados das telas.

## Atualização e teste local

No aplicativo oficial: **Minha conta → Verificar atualização**. A versão desta entrega é **0.10.0, build 50**. O APK oficial mantém o certificado usado nas atualizações anteriores.

Para desenvolver/testar neste computador:

```powershell
cd C:\Projetos\Metallo
pnpm dev:web
```

Abra `http://localhost:3000`. As credenciais são as mesmas do ambiente Supabase configurado. Mesmo rodando localmente, registrar uma operação altera o banco configurado; não é um ambiente de dados fictícios.

O APK de desenvolvimento usa o pacote `com.gunswiz.metallo.dev` e pode coexistir com o oficial. Os testes automáticos de banco usam dados fictícios em PostgreSQL local incorporado e não alteram os registros da empresa.
