import 'package:flutter/material.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/features/consumption/widgets.dart';
import 'package:metallo/features/consumption/calculations.dart';

class ConsumptionMaterialsPage extends StatefulWidget {
  const ConsumptionMaterialsPage(
      {super.key, required this.rows, required this.teams, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialsPage> createState() =>
      _ConsumptionMaterialsPageState();
}

class _ConsumptionMaterialsPageState extends State<ConsumptionMaterialsPage> {
  late String? teamId = widget.initialTeamId;
  DateTime anchor = DateTime.now();
  int periodDays = 7;
  @override
  Widget build(BuildContext context) {
    final end = DateTime(anchor.year, anchor.month, anchor.day)
        .add(const Duration(days: 1));
    final start = end.subtract(Duration(days: periodDays));
    final prevStart = start.subtract(Duration(days: periodDays));
    final current = filterConsumption(widget.rows, teamId, start, end);
    final previous = filterConsumption(widget.rows, teamId, prevStart, start);
    final grouped = groupConsumedMaterials(current, previous);
    final total = sumConsumption(current);
    final change = consumptionPercentChange(total, sumConsumption(previous));
    final periodLabel = consumptionPeriodLabel(periodDays);
    return Scaffold(
      appBar: AppBar(title: const Text('Consumo de materiais')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Expanded(
                  child: teamConsumptionDropdown(
                      widget.teams, teamId, (v) => setState(() => teamId = v))),
              const SizedBox(width: 10),
              Expanded(
                  child: DropdownButtonFormField<int>(
                initialValue: periodDays,
                decoration: const InputDecoration(
                    labelText: 'Período',
                    prefixIcon: Icon(Icons.calendar_month_outlined)),
                items: const [
                  DropdownMenuItem(value: 7, child: Text('7 dias')),
                  DropdownMenuItem(value: 30, child: Text('30 dias')),
                  DropdownMenuItem(value: 90, child: Text('3 meses')),
                  DropdownMenuItem(value: 180, child: Text('6 meses')),
                ],
                onChanged: (v) => setState(() {
                  periodDays = v ?? 7;
                  anchor = DateTime.now();
                }),
              )),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              IconButton.filledTonal(
                  onPressed: () => setState(() =>
                      anchor = anchor.subtract(Duration(days: periodDays))),
                  icon: const Icon(Icons.chevron_left)),
              Expanded(
                  child: Center(
                      child: Text(
                          '${formatConsumptionDate(start)} - ${formatConsumptionDate(end.subtract(const Duration(days: 1)))}',
                          style:
                              const TextStyle(fontWeight: FontWeight.w900)))),
              IconButton.filledTonal(
                  onPressed: () => setState(
                      () => anchor = anchor.add(Duration(days: periodDays))),
                  icon: const Icon(Icons.chevron_right)),
            ]),
            const SizedBox(height: 10),
            ConsumptionMetricCard(
                eyebrow: 'TOTAL CONSUMIDO EM $periodLabel',
                title: '',
                value: formatConsumptionQuantity(total),
                suffix: hasMixedConsumptionUnits(current),
                change: change,
                comparisonText: 'vs período anterior'),
            const SizedBox(height: 12),
            Card(
                child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Column(children: [
                      Container(
                          color: Colors.white.withValues(alpha: .045),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          child: const Row(children: [
                            Expanded(
                                flex: 5,
                                child: Text('Material',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 2,
                                child: Text('Quantidade',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 2,
                                child: Text('Unidade',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 3,
                                child: Text('Vs. período ant.',
                                    textAlign: TextAlign.end,
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70)))
                          ])),
                      if (grouped.isEmpty)
                        const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('Nenhum consumo neste período.')),
                      for (final g in grouped) ConsumptionTableRow(data: g),
                    ]))),
          ]),
    );
  }
}
