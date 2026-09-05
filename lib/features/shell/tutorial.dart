import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';

class _TutorialStep {
  const _TutorialStep(
      {required this.page,
      required this.icon,
      required this.title,
      required this.body,
      this.example,
      this.howTo,
      this.result,
      this.warning});
  final int page;
  final IconData icon;
  final String title;
  final String body;
  final String? example;
  final List<String>? howTo;
  final String? result;
  final String? warning;
}

List<_TutorialStep> _tutorialStepsForRole(String role) {
  final steps = <_TutorialStep>[
    const _TutorialStep(
      page: 2,
      icon: Icons.home_outlined,
      title: 'Início e equipes',
      body:
          'A tela inicial resume cada equipe e a COSEM. Toque em um card para consultar materiais, equipamentos e integrantes sem precisar percorrer uma lista enorme.',
      example:
          'Exemplo: toque em “Equipe Wellington” para ver seus materiais, equipamentos e registrar um consumo para essa equipe.',
      result: 'Você encontra o setor certo antes de fazer qualquer operação.',
    ),
    const _TutorialStep(
      page: 0,
      icon: Icons.search_rounded,
      title: 'Encontre materiais rapidamente',
      body:
          'Na aba Materiais, pesquise pelo nome ou código. Ao escolher um material já cadastrado, use a pesquisa do seletor em vez de procurar manualmente em uma lista longa.',
      example: 'Exemplo: pesquise “003” ou “eletrodo”.',
      howTo: [
        'Abra Materiais.',
        'Digite o nome ou código.',
        'Toque no material para ver sua distribuição.'
      ],
      result: 'O aplicativo mostra quanto existe na COSEM e em cada equipe.',
    ),
    const _TutorialStep(
      page: 1,
      icon: Icons.handyman_outlined,
      title: 'Equipamentos e patrimônio',
      body:
          'Consulte equipamentos por nome, código ou patrimônio. O patrimônio identifica a peça física e continua o mesmo quando ela muda de equipe.',
      example:
          'Exemplo: abra “Máquina de solda trifásica” para visualizar cada patrimônio e sua equipe atual.',
      warning: 'Não cadastre novamente o mesmo patrimônio ao transferi-lo.',
    ),
    const _TutorialStep(
      page: 3,
      icon: Icons.bar_chart_rounded,
      title: 'Consumo e tendências',
      body:
          'Use Consumo para acompanhar materiais utilizados por equipe e período. Os gráficos ajudam a perceber aumento, redução e os itens mais consumidos.',
      example:
          'Exemplo: 4 discos de corte usados pela Equipe Milton devem ser registrados como consumo dessa equipe.',
      result:
          'O estoque diminui e o ranking é atualizado para o período escolhido.',
    ),
    const _TutorialStep(
      page: 4,
      icon: Icons.history_rounded,
      title: 'Histórico e filtros',
      body:
          'O Histórico registra as operações. Pesquise por nome ou código e use o botão Filtrar histórico para separar entradas, consumos, reposições e transferências.',
      example:
          'Exemplo: filtre por Consumo e pesquise “disco” para conferir quem registrou a baixa.',
      warning:
          'Alterações no histórico devem ser feitas somente para corrigir um registro incorreto.',
    ),
  ];

  if (role == 'leader') {
    steps.addAll(const [
      _TutorialStep(
          page: 0,
          icon: Icons.add_box_outlined,
          title: 'Rotina do Encarregado',
          body:
              'Você pode registrar as operações permitidas para a sua própria equipe. Antes de confirmar, confira material, quantidade e equipe para evitar correções posteriores.'),
      _TutorialStep(
          page: 3,
          icon: Icons.construction_rounded,
          title: 'Registrar consumo com cuidado',
          body:
              'Consumo reduz o estoque da sua equipe. Confirme o material e a quantidade antes de concluir a operação.'),
      _TutorialStep(
          page: 1,
          icon: Icons.build_rounded,
          title: 'Manutenção de equipamento',
          body:
              'Na aba Equipamentos, toque no patrimônio e escolha Enviar para manutenção. Durante a manutenção ele fica indisponível. Quando voltar, use Retornar da manutenção e confirme a equipe de destino.'),
    ]);
  } else if (role == 'engineer') {
    steps.addAll(const [
      _TutorialStep(
          page: 2,
          icon: Icons.groups_2_outlined,
          title: 'Visão do Engenheiro',
          body:
              'Você pode consultar e operar em todas as equipes e na COSEM. Sempre confira a origem e o destino antes de registrar uma movimentação.'),
      _TutorialStep(
          page: 0,
          icon: Icons.warehouse_outlined,
          title: 'Reposição pela COSEM',
          body:
              'Na reposição, a origem deve ser a COSEM e o destino uma equipe de campo. Use a busca por código ou nome para selecionar o material correto.'),
      _TutorialStep(
          page: 1,
          icon: Icons.build_rounded,
          title: 'Ciclo de manutenção',
          body:
              'Toque em um equipamento para enviá-lo à manutenção. O patrimônio permanece rastreado e o status muda para Em manutenção. No retorno, escolha a equipe/local e registre a conclusão do serviço.'),
    ]);
  } else if (role == 'admin') {
    steps.addAll(const [
      _TutorialStep(
          page: 2,
          icon: Icons.admin_panel_settings_outlined,
          title: 'Administração',
          body:
              'O ícone de Administração no topo dá acesso a usuários e equipes. Use essas funções para atribuir cargo e equipe e manter a estrutura organizada.'),
      _TutorialStep(
          page: 4,
          icon: Icons.edit_note_rounded,
          title: 'Correções de histórico',
          body:
              'Como Admin, você pode corrigir registros do histórico. Faça isso somente quando necessário, pois a correção precisa manter o estoque consistente.'),
      _TutorialStep(
          page: 0,
          icon: Icons.inventory_rounded,
          title: 'Catálogo e códigos',
          body:
              'Mantenha um único código por material. Para equipamentos, use o código do tipo e um patrimônio único para cada unidade física.'),
      _TutorialStep(
          page: 1,
          icon: Icons.build_rounded,
          title: 'Manutenção e retorno',
          body:
              'Em Equipamentos, use Enviar para manutenção para retirar temporariamente o patrimônio de operação sem perder seu rastreio. Depois use Retornar da manutenção, escolha a equipe/local e confira o registro no Histórico.'),
    ]);
  }
  return steps;
}

Future<void> showMetalloTutorial(
  BuildContext context, {
  required String role,
  required ValueChanged<int> onNavigate,
}) async {
  final steps = _tutorialStepsForRole(role);
  var current = 0;
  onNavigate(steps.first.page);
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black.withValues(alpha: .72),
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) {
        final step = steps[current];
        return Dialog(
          backgroundColor: metalloSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFF245B8E)),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 520,
              maxHeight: MediaQuery.sizeOf(context).height * .72,
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: metalloIconBackground,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(step.icon, color: metalloAccent, size: 29),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Guia ${current + 1} de ${steps.length}',
                              style: const TextStyle(
                                color: Color(0xFF7CBFFF),
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              step.title,
                              style: const TextStyle(
                                  fontSize: 21, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Flexible(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(step.body,
                              style: const TextStyle(
                                  color: Colors.white70,
                                  height: 1.45,
                                  fontSize: 15)),
                          if (step.example != null)
                            TutorialInfo(
                                icon: Icons.lightbulb_outline,
                                title: 'Exemplo',
                                text: step.example!,
                                color: metalloGuideExample),
                          if (step.howTo != null)
                            TutorialInfo(
                                icon: Icons.format_list_numbered,
                                title: 'Como fazer',
                                text: step.howTo!
                                    .asMap()
                                    .entries
                                    .map((e) => '${e.key + 1}. ${e.value}')
                                    .join('\n'),
                                color: metalloGuideInstructions),
                          if (step.result != null)
                            TutorialInfo(
                                icon: Icons.check_circle_outline,
                                title: 'Resultado',
                                text: step.result!,
                                color: metalloSuccess),
                          if (step.warning != null)
                            TutorialInfo(
                                icon: Icons.warning_amber_rounded,
                                title: 'Atenção',
                                text: step.warning!,
                                color: metalloWarning),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  LinearProgressIndicator(
                    value: (current + 1) / steps.length,
                    minHeight: 5,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      TextButton(
                        style: TextButton.styleFrom(
                          minimumSize: const Size(64, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Pular'),
                      ),
                      const Spacer(),
                      if (current > 0) ...[
                        TextButton(
                          style: TextButton.styleFrom(
                            minimumSize: const Size(70, 44),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                          ),
                          onPressed: () {
                            setLocal(() => current--);
                            onNavigate(steps[current].page);
                          },
                          child: const Text('Voltar'),
                        ),
                        const SizedBox(width: 6),
                      ],
                      FilledButton(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(96, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          if (current == steps.length - 1) {
                            Navigator.pop(dialogContext);
                            return;
                          }
                          setLocal(() => current++);
                          onNavigate(steps[current].page);
                        },
                        child: Text(current == steps.length - 1
                            ? 'Concluir'
                            : 'Avançar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  );
}

class TutorialInfo extends StatelessWidget {
  const TutorialInfo({
    super.key,
    required this.icon,
    required this.title,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .09),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: .35))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 21),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(title,
                    style:
                        TextStyle(color: color, fontWeight: FontWeight.w900)),
                const SizedBox(height: 3),
                Text(text,
                    style: const TextStyle(color: Colors.white70, height: 1.4)),
              ]))
        ]),
      );
}
