import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'calcular_consumo.dart';

class ConsumptionUnitPicker extends StatelessWidget {
  const ConsumptionUnitPicker({super.key, required this.rows, required this.value, required this.onChanged});
  final List<Map<String, dynamic>> rows;
  final String? value;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Medida do consumo', style: TextStyle(fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: consumptionUnits(rows).map((unit) => ChoiceChip(
        label: Text(unit), selected: unit == value, onSelected: (_) => onChanged(unit),
      )).toList()),
      const Text('Totais e percentuais consideram apenas a medida selecionada. Caixa não é convertida em unidade.'),
    ]),
  );
}

class ConsumptionMaterialDonut extends StatelessWidget {
  const ConsumptionMaterialDonut({super.key, required this.rows, required this.unit});
  final List<Map<String, dynamic>> rows;
  final String? unit;
  @override
  Widget build(BuildContext context) {
    final groups = groupConsumedMaterials(filterConsumptionUnit(rows, unit), const []);
    final total = groups.fold<double>(0, (sum, item) => sum + (item['qty'] as num).toDouble());
    if (total <= 0) return const SizedBox.shrink();
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      Text('Participação por material · ' + (unit ?? '—'), style: const TextStyle(fontWeight: FontWeight.w800)),
      const SizedBox(height: 16),
      SizedBox(width: 180, height: 180, child: CustomPaint(
        painter: _ConsumptionDonutPainter(groups.map((group) => (group['qty'] as num).toDouble()).toList()),
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(formatConsumptionQuantity(total), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          Text(unit ?? '—'),
        ])),
      )),
      const SizedBox(height: 16),
      for (var index = 0; index < groups.length; index++)
        Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
          Container(width: 10, height: 10, color: consumptionColors[index % consumptionColors.length]),
          const SizedBox(width: 8),
          Expanded(child: Text(groups[index]['name'].toString())),
          Text(formatConsumptionQuantity((groups[index]['qty'] as num).toDouble()) + ' ' + (unit ?? '') + ' · ' + ((groups[index]['qty'] as num) / total * 100).toStringAsFixed(1) + '%'),
        ])),
    ])));
  }
}

class _ConsumptionDonutPainter extends CustomPainter {
  _ConsumptionDonutPainter(this.values);
  final List<double> values;
  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<double>(0, (sum, value) => sum + value);
    if (total <= 0) return;
    var start = -math.pi / 2;
    final rect = Offset.zero & size;
    for (var index = 0; index < values.length; index++) {
      final sweep = values[index] / total * math.pi * 2;
      canvas.drawArc(rect.deflate(14), start, sweep, false, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 24
        ..color = consumptionColors[index % consumptionColors.length]);
      start += sweep;
    }
  }
  @override
  bool shouldRepaint(covariant _ConsumptionDonutPainter oldDelegate) => true;
}
