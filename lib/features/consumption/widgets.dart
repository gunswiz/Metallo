import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/features/consumption/calculations.dart';

Widget teamConsumptionDropdown(
        List<Team> teams, String? value, ValueChanged<String?> onChanged) =>
    DropdownButtonFormField<String?>(
      initialValue: value,
      decoration: const InputDecoration(
          labelText: 'Equipe', prefixIcon: Icon(Icons.group_outlined)),
      items: [
        const DropdownMenuItem<String?>(
            value: null, child: Text('Todas as equipes')),
        ...teams.map((t) => DropdownMenuItem<String?>(
            value: t.id, child: Text(t.name, overflow: TextOverflow.ellipsis)))
      ],
      onChanged: onChanged,
    );

class ConsumptionMetricCard extends StatelessWidget {
  const ConsumptionMetricCard(
      {super.key,
      required this.eyebrow,
      required this.title,
      required this.value,
      required this.suffix,
      required this.change,
      required this.comparisonText});
  final String eyebrow, title, value, suffix, comparisonText;
  final double? change;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(14),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(eyebrow,
                style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    if (title.isNotEmpty)
                      Text(title, style: const TextStyle(fontSize: 12)),
                    Text(value,
                        style: const TextStyle(
                            fontSize: 29, fontWeight: FontWeight.w900)),
                    if (suffix.isNotEmpty)
                      Text(suffix,
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 11))
                  ])),
              if (change != null)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(
                      '${change! >= 0 ? '↑' : '↓'} ${change!.abs().toStringAsFixed(1)}%',
                      style: TextStyle(
                          color: change! > 0
                              ? metalloConsumptionDecrease
                              : metalloConsumptionIncrease,
                          fontWeight: FontWeight.w900,
                          fontSize: 18)),
                  Text(comparisonText,
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 10))
                ])
              else
                const Text('Sem base anterior',
                    style: TextStyle(color: Colors.white38, fontSize: 11)),
            ]),
          ])));
}

class ConsumptionSmallMetric extends StatelessWidget {
  const ConsumptionSmallMetric(
      {super.key,
      required this.title,
      required this.value,
      required this.suffix});
  final String title, value, suffix;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(13),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(color: Colors.white60, fontSize: 11)),
            const SizedBox(height: 5),
            Text(value,
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 21)),
            Text(suffix,
                style: const TextStyle(color: Colors.white38, fontSize: 10))
          ])));
}

class ConsumptionCategoryLegendRow extends StatelessWidget {
  const ConsumptionCategoryLegendRow(
      {super.key, required this.index, required this.data});
  final int index;
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
                color: consumptionColors[index % consumptionColors.length],
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 7),
        Expanded(
            child: Text(data['name'].toString(),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12))),
        Text('${(data['pct'] as double).toStringAsFixed(0)}%',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12))
      ]));
}

class ConsumptionRankingRow extends StatelessWidget {
  const ConsumptionRankingRow(
      {super.key, required this.index, required this.data, this.onTap});
  final int index;
  final Map<String, dynamic> data;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
      onTap: onTap,
      child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color: consumptionColors[index % consumptionColors.length],
                    borderRadius: BorderRadius.circular(5)),
                child: Text('${index + 1}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 11))),
            const SizedBox(width: 9),
            Expanded(
                child: Text(data['name'].toString(),
                    style: const TextStyle(fontWeight: FontWeight.w700))),
            Text(
                '${formatConsumptionQuantity(data['qty'] as double)} ${data['unit']}',
                style: const TextStyle(fontWeight: FontWeight.w800))
          ])));
}

class ConsumptionTableRow extends StatelessWidget {
  const ConsumptionTableRow({super.key, required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final q = data['qty'] as double,
        p = data['prev'] as double,
        c = consumptionPercentChange(q, p);
    return Container(
        decoration: BoxDecoration(
            border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: .06)))),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(children: [
          Expanded(
              flex: 5,
              child: Text(data['name'].toString(),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 12))),
          Expanded(
              flex: 2,
              child: Text(formatConsumptionQuantity(q),
                  style: const TextStyle(fontSize: 12))),
          Expanded(
              flex: 2,
              child: Text(data['unit'].toString(),
                  style: const TextStyle(fontSize: 12))),
          Expanded(
              flex: 3,
              child: Text(
                  c == null
                      ? '— 0,0%'
                      : '${c >= 0 ? '↑' : '↓'} ${c.abs().toStringAsFixed(1)}%',
                  textAlign: TextAlign.end,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: c == null
                          ? Colors.white54
                          : c > 0
                              ? metalloConsumptionDecrease
                              : metalloConsumptionIncrease)))
        ]));
  }
}
