import 'package:flutter/material.dart';

/// Bounded controls remain visible with the app's full-width button theme.
class GuidedPracticeCard extends StatefulWidget {
  const GuidedPracticeCard({
    super.key,
    required this.steps,
    required this.onClose,
    this.initialStep = 0,
  }) : assert(steps.length > 0);

  final List<String> steps;
  final VoidCallback onClose;
  final int initialStep;

  @override
  State<GuidedPracticeCard> createState() => _GuidedPracticeCardState();
}

class _GuidedPracticeCardState extends State<GuidedPracticeCard> {
  late int step = widget.initialStep.clamp(0, widget.steps.length - 1);
  bool collapsed = false;

  @override
  Widget build(BuildContext context) => Material(
        elevation: 12,
        color: const Color(0xFF102A43),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              const Icon(Icons.school_outlined, color: Color(0xFF52A9FF)),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Guia • ${step + 1}/${widget.steps.length}',
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
              IconButton(
                tooltip:
                    collapsed ? 'Mostrar orientação' : 'Recolher orientação',
                onPressed: () => setState(() => collapsed = !collapsed),
                icon: Icon(collapsed ? Icons.expand_more : Icons.expand_less),
              ),
              IconButton(
                tooltip: 'Encerrar guia',
                onPressed: widget.onClose,
                icon: const Icon(Icons.close),
              ),
            ]),
            if (!collapsed) ...[
              Flexible(
                child: SingleChildScrollView(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(widget.steps[step],
                        style: const TextStyle(fontSize: 16)),
                    const SizedBox(height: 6),
                    const Text(
                      'Use a tela real abaixo. Confirmações salvam dados reais.',
                      style: TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () {
                    if (step == widget.steps.length - 1) {
                      widget.onClose();
                    } else {
                      setState(() => step++);
                    }
                  },
                  icon: Icon(step == widget.steps.length - 1
                      ? Icons.check
                      : Icons.arrow_forward),
                  label: Text(step == widget.steps.length - 1
                      ? 'Concluir guia'
                      : 'Avançar'),
                ),
              ),
              if (step > 0)
                TextButton.icon(
                  onPressed: () => setState(() => step--),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Anterior'),
                ),
            ],
          ]),
        ),
      );
}
