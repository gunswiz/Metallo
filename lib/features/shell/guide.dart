import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/features/shell/tutorial.dart';

class HelpTopic {
  const HelpTopic(this.title, this.icon, this.summary, this.example, this.steps,
      this.result,
      {this.warning, this.restricted = false});
  final String title;
  final IconData icon;
  final String summary;
  final String example;
  final List<String> steps;
  final String result;
  final String? warning;
  final bool restricted;
}

int helpTopicDestinationIndex(HelpTopic topic) {
  final title = topic.title.toLowerCase();
  if (title.contains('equipamento')) return 1;
  if (title.contains('material') || title.contains('consumo')) return 0;
  if (title.contains('histórico')) return 4;
  return 2;
}

class HelpGuidePage extends StatefulWidget {
  const HelpGuidePage(
      {super.key, required this.role, this.onStartGuidedPractice});
  final String role;
  final Future<void> Function(HelpTopic)? onStartGuidedPractice;
  @override
  State<HelpGuidePage> createState() => _HelpGuidePageState();
}

class _HelpGuidePageState extends State<HelpGuidePage> {
  String query = '';

  static const topics = [
    HelpTopic(
        'Primeiros passos',
        Icons.rocket_launch_outlined,
        'Entenda a tela inicial, as equipes e a COSEM.',
        'Você precisa conferir o estoque da Equipe Wellington antes de uma entrega.',
        [
          'Abra Início.',
          'Toque na equipe desejada.',
          'Consulte os resumos e os itens distribuídos.'
        ],
        'Você começa a operação no local correto.'),
    HelpTopic(
        'Materiais e distribuição',
        Icons.inventory_2_outlined,
        'Localize materiais e veja quanto existe em cada equipe.',
        'Pesquise “003” para encontrar eletrodo e ver sua distribuição.',
        [
          'Abra Materiais.',
          'Use a busca por nome ou código.',
          'Toque no resultado para abrir a distribuição.'
        ],
        'As quantidades da COSEM e das equipes aparecem juntas.'),
    HelpTopic(
        'Registrar consumo',
        Icons.remove_circle_outline,
        'Dê baixa somente no estoque da equipe que utilizou o material.',
        'A Equipe Milton utilizou 4 discos de corte durante o dia.',
        [
          'Abra a equipe ou a aba Materiais.',
          'Escolha o material e Registrar consumo.',
          'Informe 4 e confirme.'
        ],
        'O estoque diminui e o consumo entra no ranking.',
        warning:
            'Nunca registre consumo na COSEM se o material foi utilizado por uma equipe.'),
    HelpTopic(
        'Equipamentos e patrimônios',
        Icons.handyman_outlined,
        'Consulte tipos de equipamento e cada patrimônio físico.',
        'Uma máquina trifásica muda da Equipe Wellington para a Equipe Milton.',
        [
          'Abra Equipamentos.',
          'Escolha o tipo da máquina.',
          'Selecione o patrimônio e use Transferir.'
        ],
        'O mesmo patrimônio passa a aparecer na nova equipe.',
        warning: 'Transferir não significa cadastrar uma máquina nova.'),
    HelpTopic(
        'Equipamento alugado substituído',
        Icons.swap_horiz_rounded,
        'Registre a troca feita pela locadora sem enviar a máquina para manutenção.',
        'A locadora recolheu o patrimônio 11700120 e entregou outro patrimônio.',
        [
          'Abra o patrimônio alugado.',
          'Escolha a opção de substituição.',
          'Informe os dados da máquina recebida.'
        ],
        'A troca fica rastreada sem manter a máquina antiga em operação.'),
    HelpTopic(
        'Entrega completa de EPI',
        Icons.health_and_safety_outlined,
        'Entregue EPIs, fardas e itens pessoais ao mesmo funcionário.',
        'Wellington recebeu máscara de solda, duas fardas e uma trena.',
        [
          'Abra Gestão de EPI.',
          'Toque em Entrega e escolha Wellington.',
          'Use os filtros e adicione as quantidades.',
          'Confirme a entrega completa.'
        ],
        'Todos os itens saem da COSEM e aparecem agrupados no relatório.',
        warning: 'Confira funcionário, itens e quantidades antes de confirmar.',
        restricted: true),
    HelpTopic(
        'Devolvido, danificado ou perdido',
        Icons.assignment_turned_in_outlined,
        'Atualize individualmente a situação de um item entregue.',
        'Uma trena foi perdida, mas os outros itens da mesma entrega continuam em uso.',
        [
          'Abra Relatórios na Gestão de EPI.',
          'Toque na entrega agrupada.',
          'Toque na trena e marque Perdido.'
        ],
        'Somente a situação da trena será alterada.',
        restricted: true),
    HelpTopic(
        'Histórico e conferência',
        Icons.history_rounded,
        'Encontre operações antigas por tipo, nome ou código.',
        'Confira quem registrou o consumo de disco de corte.',
        [
          'Abra Histórico.',
          'Toque em Filtrar histórico.',
          'Selecione Consumo e pesquise “disco”.'
        ],
        'A operação, data, equipe e responsável ficam visíveis.'),
  ];

  List<HelpTopic> get visibleTopics {
    final canSeeEpi = widget.role == 'admin' || widget.role == 'engineer';
    final normalizedQuery = query.trim().toLowerCase();
    return topics.where((topic) {
      if (topic.restricted && !canSeeEpi) return false;
      final searchableText =
          '${topic.title} ${topic.summary} ${topic.example}'.toLowerCase();
      return searchableText.contains(normalizedQuery);
    }).toList();
  }

  Future<void> _startPractice(HelpTopic topic) async {
    if (widget.onStartGuidedPractice == null) {
      await _showPractice(context, topic);
      return;
    }
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Praticar no aplicativo'),
        content: const Text(
            'O guia ficará sobre as telas reais e poderá ser recolhido. Ao confirmar entregas, consumos ou outras operações, os dados reais serão alterados. Use este modo quando for realizar uma operação de verdade.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Abrir tela real'),
          ),
        ],
      ),
    );
    if (accepted == true) await widget.onStartGuidedPractice!(topic);
  }

  @override
  Widget build(BuildContext context) {
    final visible = visibleTopics;
    return Scaffold(
      appBar: AppBar(title: const Text('Guia prático')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Como podemos ajudar?',
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900)),
        const SizedBox(height: 5),
        const Text('Pesquise um assunto ou abra um exemplo passo a passo.',
            style: TextStyle(color: Colors.white60)),
        const SizedBox(height: 14),
        TextField(
          onChanged: (value) => setState(() => query = value),
          decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Ex.: consumo, máquina, EPI ou farda'),
        ),
        const SizedBox(height: 14),
        for (final topic in visible)
          _HelpTopicCard(
            topic: topic,
            usesRealApplication: widget.onStartGuidedPractice != null,
            onStartPractice: () => _startPractice(topic),
          ),
        if (visible.isEmpty)
          const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: Text('Nenhum assunto encontrado.'))),
      ]),
    );
  }
}

class _HelpTopicCard extends StatelessWidget {
  const _HelpTopicCard({
    required this.topic,
    required this.usesRealApplication,
    required this.onStartPractice,
  });

  final HelpTopic topic;
  final bool usesRealApplication;
  final VoidCallback onStartPractice;

  @override
  Widget build(BuildContext context) => Card(
        child: ExpansionTile(
          leading: Icon(topic.icon, color: metalloAccent),
          title: Text(
            topic.title,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          subtitle: Text(topic.summary),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TutorialInfo(
              icon: Icons.lightbulb_outline,
              title: 'Exemplo real',
              text: topic.example,
              color: const Color(0xFF65B5FF),
            ),
            TutorialInfo(
              icon: Icons.format_list_numbered,
              title: 'Como fazer',
              text: topic.steps
                  .asMap()
                  .entries
                  .map((step) => '${step.key + 1}. ${step.value}')
                  .join('\n'),
              color: const Color(0xFF9A8CFF),
            ),
            TutorialInfo(
              icon: Icons.check_circle_outline,
              title: 'Resultado',
              text: topic.result,
              color: metalloSuccess,
            ),
            if (topic.warning != null)
              TutorialInfo(
                icon: Icons.warning_amber_rounded,
                title: 'Atenção',
                text: topic.warning!,
                color: const Color(0xFFFFB74D),
              ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: onStartPractice,
              icon: const Icon(Icons.play_circle_outline),
              label: Text(usesRealApplication
                  ? 'Praticar no aplicativo'
                  : 'Praticar com demonstração'),
            ),
          ],
        ),
      );
}

Future<void> _showPractice(BuildContext context, HelpTopic topic) async {
  await Navigator.of(context).push(MaterialPageRoute(
    fullscreenDialog: true,
    builder: (_) => _PracticePage(topic: topic),
  ));
}

class _PracticePage extends StatefulWidget {
  const _PracticePage({required this.topic});
  final HelpTopic topic;
  @override
  State<_PracticePage> createState() => _PracticePageState();
}

class _PracticePageState extends State<_PracticePage> {
  int step = 0;

  void completeStep() {
    if (step < widget.topic.steps.length) setState(() => step++);
  }

  @override
  Widget build(BuildContext context) {
    final finished = step >= widget.topic.steps.length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Treinamento interativo'),
        leading: IconButton(
          tooltip: 'Voltar ao guia',
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Icon(finished ? Icons.verified_rounded : widget.topic.icon,
                color: finished ? metalloSuccess : metalloAccent, size: 48),
            const SizedBox(height: 12),
            Text(finished ? 'Treino concluído' : widget.topic.title,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text(widget.topic.example,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, height: 1.35)),
            const SizedBox(height: 20),
            LinearProgressIndicator(
                value: finished ? 1 : step / widget.topic.steps.length),
            const SizedBox(height: 22),
            if (finished) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(children: [
                    const Icon(Icons.check_circle_outline,
                        color: metalloSuccess, size: 42),
                    const SizedBox(height: 12),
                    Text(widget.topic.result,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    const Text(
                        'Você praticou todas as ações sem alterar os dados reais.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white60)),
                  ]),
                ),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.menu_book_outlined),
                label: const Text('Voltar ao guia'),
              ),
              TextButton.icon(
                onPressed: () => setState(() => step = 0),
                icon: const Icon(Icons.replay),
                label: const Text('Praticar novamente'),
              ),
            ] else ...[
              Text('Etapa ${step + 1} de ${widget.topic.steps.length}',
                  style: const TextStyle(
                      color: metalloAccent, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(widget.topic.steps[step],
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              _PracticeInteraction(
                key: ValueKey('${widget.topic.title}-$step'),
                instruction: widget.topic.steps[step],
                onComplete: completeStep,
              ),
              if (step > 0)
                TextButton.icon(
                  onPressed: () => setState(() => step--),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Rever etapa anterior'),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PracticeInteraction extends StatefulWidget {
  const _PracticeInteraction(
      {super.key, required this.instruction, required this.onComplete});
  final String instruction;
  final VoidCallback onComplete;
  @override
  State<_PracticeInteraction> createState() => _PracticeInteractionState();
}

class _PracticeInteractionState extends State<_PracticeInteraction> {
  final controller = TextEditingController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lower = widget.instruction.toLowerCase();
    final needsInput = lower.contains('pesquis') || lower.contains('informe');
    return Card(
      color: metalloFeatureCard,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(Icons.touch_app_outlined, color: metalloAccent),
            SizedBox(width: 8),
            Text('Área de prática',
                style: TextStyle(fontWeight: FontWeight.w900)),
          ]),
          const SizedBox(height: 14),
          if (needsInput) ...[
            TextField(
              controller: controller,
              keyboardType:
                  lower.contains('informe') ? TextInputType.number : null,
              decoration: InputDecoration(
                prefixIcon: Icon(lower.contains('pesquis')
                    ? Icons.search
                    : Icons.numbers_outlined),
                hintText: lower.contains('pesquis')
                    ? 'Digite o exemplo para pesquisar'
                    : 'Digite a quantidade do exemplo',
              ),
            ),
            const SizedBox(height: 12),
          ] else ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF0A1420),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(children: [
                const Icon(Icons.radio_button_unchecked, color: metalloAccent),
                const SizedBox(width: 12),
                Expanded(child: Text(widget.instruction)),
              ]),
            ),
            const SizedBox(height: 12),
          ],
          FilledButton.icon(
            onPressed: () {
              if (needsInput && controller.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Faça a ação do exemplo para continuar.')));
                return;
              }
              widget.onComplete();
            },
            icon: Icon(needsInput ? Icons.check : Icons.touch_app),
            label: Text(
                needsInput ? 'Confirmar na demonstração' : 'Executar ação'),
          ),
        ]),
      ),
    );
  }
}
