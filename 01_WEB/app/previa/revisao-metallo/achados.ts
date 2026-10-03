export type AuditFinding = {
  id: string;
  title: string;
  priority: "Alta" | "Média";
  decision: "Corrigir" | "Unificar" | "Manter e distinguir";
  found: string;
  consequence: string;
  proposal: string;
  where: string;
  sources: string[];
};

export const findings: AuditFinding[] = [
  {
    id: "01", title: "Estoque da obra e estoque da equipe não são consultados da mesma forma", priority: "Alta", decision: "Corrigir",
    found: "A área nova resolve o estoque compartilhado da obra. A ficha antiga da equipe consulta inventory pelo team_id, e o mobile não carrega o vínculo da equipe com a obra nessa consulta.",
    consequence: "Se A guarda o estoque de A e B, a ficha de B pode ficar sem saldo. No mobile, o botão de consumo usa a permissão da equipe que guarda o estoque, não necessariamente da equipe que executou o serviço.",
    proposal: "Mostrar o estoque físico da obra em todos os caminhos e selecionar separadamente a equipe que consumiu. Manter um saldo único; não duplicar saldos para fazer a tela funcionar.",
    where: "Materiais / Equipes ↔ Obras e pedidos → Estoque",
    sources: ["01_WEB/05_ACESSO_A_DADOS/Repositorios/metallo-repository.ts", "02_MOBILE/lib/06_ACESSO_A_DADOS/dashboard_repository.dart", "02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO/Materiais/dialogos_materiais.dart", "04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql"],
  },
  {
    id: "02", title: "Devolução antiga pode deixar uma pendência de locação aberta", priority: "Alta", decision: "Corrigir",
    found: "A tela antiga chama return_rented_equipment e desativa a máquina. A área nova fecha também rental_return_requests, mas somente quando a devolução passa por rental_resolve.",
    consequence: "Se a ADM devolver pela tela antiga depois de receber um aviso da obra, a pendência pode continuar aberta. Tentar concluir por ela depois chama novamente a devolução de uma máquina já inativa.",
    proposal: "Uma única operação para confirmar a devolução física e encerrar a pendência correspondente. O aviso do encarregado e o encerramento da cobrança continuam sendo etapas distintas.",
    where: "Equipamentos → Devolver à locadora ↔ Obras e pedidos → Máquinas alugadas",
    sources: ["01_WEB/app/(02_SISTEMA)/equipamentos/[id]/page.tsx", "04_BANCO_E_SUPABASE/supabase/migrations/20260906075309_web_mobile_parity.sql", "04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql"],
  },
  {
    id: "03", title: "Trocar uma máquina pode misturar duas identidades físicas", priority: "Alta", decision: "Corrigir",
    found: "Substituir equipamento locado troca código e série no mesmo registro de patrimônio e anota o número anterior em observações.",
    consequence: "Os movimentos antigos continuam ligados ao mesmo patrimônio, agora identificado pelo número da máquina nova. A observação existe, mas a identificação histórica fica menos clara.",
    proposal: "Preservar o registro da máquina devolvida e vincular a substituta como outro patrimônio. Manter a opção Substituir, mas com histórico separado de cada máquina e vínculo entre elas.",
    where: "Equipamentos → Substituir equipamento locado",
    sources: ["01_WEB/app/actions/substituir-locado.ts", "02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO/Equipamentos/dialogos_equipamentos.dart"],
  },
  {
    id: "04", title: "Há duas previsões de devolução para a mesma locação", priority: "Média", decision: "Unificar",
    found: "Equipamentos mostra assets.rental_end_date. A área nova grava rental_admin_details.expected_return. O alerta dá preferência à data nova quando ambas existem.",
    consequence: "A data mostrada na ficha antiga pode ser diferente da data que gera o alerta da ADM.",
    proposal: "Uma previsão de devolução compartilhada pelas telas. Distinguir claramente previsão, devolução física e fim confirmado da cobrança.",
    where: "Equipamentos → Fim previsto ↔ Máquinas alugadas → Valores e datas",
    sources: ["01_WEB/app/(02_SISTEMA)/equipamentos/[id]/page.tsx", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/locacoes.tsx", "04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql"],
  },
  {
    id: "05", title: "O local do lote de EPI desaparece nas telas antigas", priority: "Alta", decision: "Corrigir",
    found: "A nova área mostra lote, C.A. e obra. As consultas antigas de EPI não incluem worksite_id na projeção, e o seletor de entrega web não identifica a origem física do lote.",
    consequence: "Dois lotes do mesmo EPI e tamanho podem parecer equivalentes, embora estejam em locais diferentes. O usuário depende da recusa do banco para descobrir uma escolha incompatível.",
    proposal: "Um seletor de entrega com funcionário, equipe de trabalho, obra, lote, C.A. e saldo disponível. Abrir esse mesmo fluxo pela ficha da pessoa, por EPI e pela obra.",
    where: "EPI → Entregar / Funcionário ↔ Obras e pedidos → Entrega individual",
    sources: ["02_MOBILE/lib/06_ACESSO_A_DADOS/epi_repository.dart", "01_WEB/02_COMPONENTES_VISUAIS/epi-delivery-form.tsx", "01_WEB/05_ACESSO_A_DADOS/Repositorios/metallo-repository.ts", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/estoque.tsx"],
  },
  {
    id: "06", title: "O consumo do mobile ainda mistura unidades em resumos", priority: "Alta", decision: "Corrigir",
    found: "O web recebeu totais separados e gráfico circular. No mobile, consumptionOverview, consumptionRange e a comparação de equipes ainda somam linhas de medidas diferentes e exibem um rótulo combinado.",
    consequence: "O mesmo período pode aparecer com um total misturado no aplicativo e totais separados no web. Isso não indica que houve mais consumo: a apresentação e o cálculo são diferentes.",
    proposal: "Levar ao mobile a separação por medida aprovada no web. Percentuais e comparações sempre dentro da mesma unidade; nenhum fator de conversão de caixa será presumido.",
    where: "Mobile → Consumo, gráficos, materiais e comparação de equipes",
    sources: ["02_MOBILE/lib/01_TELAS/07_CONSUMO/calcular_consumo.dart", "02_MOBILE/lib/01_TELAS/07_CONSUMO/consumption_page.dart", "02_MOBILE/lib/01_TELAS/07_CONSUMO/consumption_teams_compare_page.dart", "01_WEB/02_COMPONENTES_VISUAIS/consumption-dashboard.tsx"],
  },
  {
    id: "07", title: "A mesma operação tem formulários com recursos diferentes", priority: "Alta", decision: "Unificar",
    found: "Consumo, entrada, transferência de equipamento e entrega de EPI existem nas áreas antigas e no módulo novo. Data do fato, fila local e motivos detalhados foram concentrados nos formulários novos.",
    consequence: "A pessoa precisa saber qual caminho oferece o recurso necessário. Uma entrega tardia ou sem conexão se comporta de forma diferente dependendo de onde foi iniciada.",
    proposal: "Manter atalhos onde fazem sentido, mas usar uma única implementação do formulário e das regras. Obras deve dar contexto e atalhos, não ser um segundo almoxarifado.",
    where: "Materiais / Equipamentos / EPI / Movimentações ↔ Obras e pedidos",
    sources: ["01_WEB/app/actions/operations.ts", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/estoque.tsx", "02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO/Materiais/dialogos_materiais.dart", "02_MOBILE/lib/01_TELAS/09_OBRAS_E_PEDIDOS/operation_form.dart"],
  },
  {
    id: "08", title: "Entrada direta e recebimento do pedido podem registrar a mesma chegada", priority: "Alta", decision: "Unificar",
    found: "A entrada direta adiciona estoque sem um pedido. O recebimento também adiciona estoque e atualiza o pedido. São comandos separados, sem uma etapa comum que identifique a origem da chegada.",
    consequence: "Há risco de o operador lançar uma compra como entrada direta e depois confirmar o pedido da mesma compra. A proteção contra reenvio não identifica dois lançamentos distintos como o mesmo fato.",
    proposal: "Uma porta de entrada chamada Receber itens: escolher Pedido existente ou Entrada sem pedido. Ao selecionar um pedido, mostrar solicitado, recebido e faltante e atualizar estoque e recebimento juntos.",
    where: "Materiais → Entrada / Obras → Compra direta ↔ Pedidos → Confirmar o que chegou",
    sources: ["01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/estoque.tsx", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/pedidos.tsx", "04_BANCO_E_SUPABASE/supabase/migrations/20260912073518_site_operations.sql"],
  },
  {
    id: "09", title: "A permissão concedida não produz os mesmos botões em todas as telas", priority: "Média", decision: "Corrigir",
    found: "Na tela antiga de itens de EPI do mobile, a entrada de estoque aparece somente para admin. A área nova oferece entrada de EPI conforme epi:write. Há critérios diferentes na interface para operações semelhantes.",
    consequence: "Um responsável autorizado encontra a operação em Obras, mas não no catálogo de EPI. Isso faz a permissão parecer incompleta ou sem efeito.",
    proposal: "Aplicar a mesma regra de operação e equipe nos dois ambientes. Preservar tarefas exclusivas da ADM, como editar cadastros e conceder acesso; não liberar administração apenas por ter direito de registrar EPI.",
    where: "Mobile → EPI / Itens ↔ Obras e pedidos → Entrada de EPI",
    sources: ["02_MOBILE/lib/01_TELAS/04_EPIS_E_FUNCIONARIOS/items_page.dart", "02_MOBILE/lib/01_TELAS/09_OBRAS_E_PEDIDOS/site_operations_page.dart", "02_MOBILE/lib/04_FUNCOES_E_LOGICA/user_access.dart"],
  },
  {
    id: "10", title: "Um lançamento recusado pode segurar os demais na fila", priority: "Média", decision: "Corrigir",
    found: "As filas web e mobile interrompem o envio no primeiro erro. A interface permite reenviar ou retirar, mas não oferece uma revisão guiada do lançamento recusado.",
    consequence: "Uma quantidade inválida, lote incompatível ou permissão revogada pode manter os lançamentos seguintes aguardando. Uma falha de rede e uma recusa definitiva precisam de orientações diferentes.",
    proposal: "Centralizar pendências e mostrar motivo, conteúdo e próxima ação. Preservar a identificação nas retentativas; antes de corrigir um envio de resposta incerta, conferir se já foi registrado para não duplicar.",
    where: "Obras e pedidos → Lançamentos pendentes",
    sources: ["01_WEB/02_COMPONENTES_VISUAIS/obras-pedidos.tsx", "02_MOBILE/lib/06_ACESSO_A_DADOS/site_operations_repository.dart"],
  },
  {
    id: "11", title: "Equipe de origem e equipe de apoio precisam aparecer juntas", priority: "Média", decision: "Corrigir",
    found: "O apoio temporário preserva epi_employees.team_id e usa employee_assignments. A área nova mostra origem e equipe de trabalho; fichas e listagens antigas ainda consultam a equipe de origem.",
    consequence: "Uma pessoa em apoio pode parecer vinculada à equipe errada numa tela, enquanto a outra apresenta o local de trabalho atual. Não se deve corrigir isso mudando sua equipe permanente.",
    proposal: "Manter apoio temporário e cadastro permanente como conceitos distintos, exibindo Origem e Trabalhando com em todas as fichas relevantes.",
    where: "Funcionários / Equipes ↔ Obras e pedidos → Funcionários em apoio",
    sources: ["01_WEB/05_ACESSO_A_DADOS/Repositorios/metallo-repository.ts", "02_MOBILE/lib/06_ACESSO_A_DADOS/epi_repository.dart", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/funcionarios.tsx"],
  },
  {
    id: "12", title: "Solicitação individual de EPI e compra para a obra têm finalidades diferentes", priority: "Média", decision: "Manter e distinguir",
    found: "epi_requests representa a necessidade de um funcionário; supply_orders representa aquisição para abastecer a obra. O recebimento de uma compra repõe estoque, mas não representa a entrega ao funcionário.",
    consequence: "Excluir um desses fluxos perderia uma informação útil. Usar apenas o nome Pedido para ambos pode levar a acreditar que comprar ou receber já confirmou a entrega pessoal.",
    proposal: "Manter os dois registros com nomes claros: Necessidade do funcionário e Pedido de compra/locação. Reunir a consulta da ADM e conectar necessidade, compra, recebimento e entrega, sem baixar estoque duas vezes.",
    where: "Funcionário → Solicitar EPI ↔ Pedidos e recebimentos",
    sources: ["02_MOBILE/lib/06_ACESSO_A_DADOS/epi_repository.dart", "01_WEB/app/(02_SISTEMA)/epis/solicitacoes/page.tsx", "01_WEB/02_COMPONENTES_VISUAIS/ObrasEPedidos/pedidos.tsx"],
  },
];

export const modules = [
  { id: "obras", title: "Obras", purpose: "Contexto da obra e das equipes, com visão do estoque compartilhado e atalhos para os fluxos únicos.", current: "Obras e pedidos reúne cadastros, compras, estoque, EPI, pessoas, locações e alertas num segundo conjunto de telas.", keep: "Cadastro de obra, vínculo de equipes, situação da obra e visão do estoque físico.", move: "Pedidos ficam em Pedidos. Os botões de consumo, entrega e transferência abrem os mesmos formulários dos módulos correspondentes." },
  { id: "materiais", title: "Materiais", purpose: "Consultar o estoque por obra ou COSEM, receber itens e registrar consumo identificado pela equipe.", current: "Materiais e Obras oferecem entradas e consumo por caminhos diferentes.", keep: "Catálogo, saldos, transferência entre locais, entrada sem pedido e consumo.", move: "Uma tela Receber itens e um formulário de consumo, disponíveis também por atalhos na obra." },
  { id: "epi", title: "EPI e pessoas", purpose: "Funcionário, kit, entrega, baixa, lotes por local e ficha para assinatura no mesmo contexto.", current: "Entregas novas estão em Obras, enquanto kit, baixas e PDF ficam na ficha antiga.", keep: "Kit, motivos de reposição, baixa parcial, C.A., PDF individual e relatório geral.", move: "Apoio temporário aparece na ficha da pessoa e na obra. Entrega abre o mesmo seletor de lote em qualquer acesso." },
  { id: "equipamentos", title: "Equipamentos e locações", purpose: "Acompanhar a máquina física, sua localização, transferências e ciclo de locação.", current: "Equipamentos tem devolução direta e substituição; Obras tem avisos, providências e cobrança.", keep: "Próprios e alugados, número da locadora, histórico, aviso de liberação e controle da ADM.", move: "Uma ficha por máquina e um fluxo de devolução. Separar retorno físico e término da cobrança." },
  { id: "pedidos", title: "Pedidos e recebimentos", purpose: "Solicitações da obra, aprovação registrada pela ADM, compras e faltantes.", current: "Pedidos novos ficam escondidos dentro de Obras; entradas diretas não perguntam sobre um pedido existente.", keep: "Lista de itens, aprovação pelo patrão registrada pela ADM, recebimentos parciais e histórico.", move: "Recebimentos feitos por Materiais ou pela obra atualizam o mesmo pedido. Necessidades individuais de EPI ficam identificadas." },
  { id: "consumo", title: "Consumo", purpose: "Análise em quantidades e percentuais, sempre separada por unidade de medida.", current: "O web já recebeu a separação aprovada. Resumos do mobile continuam somando medidas diferentes.", keep: "Gráfico circular, comparação por equipe, material, período e lançamentos rastreáveis.", move: "Levar a mesma lógica ao mobile. Registrar consumo usa o formulário único de Materiais." },
  { id: "adm", title: "Administração", purpose: "Acessos, permissões, cadastros e central de pendências para quem administra.", current: "Alertas estão em telas diferentes e o módulo novo oferece apenas atalhos para seções inteiras.", keep: "Usuários com login separados dos funcionários, permissões por operação e alertas exclusivos da ADM.", move: "Uma central com links para a pendência exata. Relatórios gerais e histórico continuam disponíveis como consultas." },
];
