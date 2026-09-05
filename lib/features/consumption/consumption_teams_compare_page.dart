import 'package:flutter/material.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/features/consumption/widgets.dart';
import 'package:metallo/features/consumption/charts.dart';
import 'package:metallo/features/consumption/calculations.dart';

class ConsumptionTeamsComparePage extends StatefulWidget {
  const ConsumptionTeamsComparePage(
      {super.key, required this.rows, required this.teams});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  @override
  State<ConsumptionTeamsComparePage> createState() =>
      _ConsumptionTeamsComparePageState();
}

class _ConsumptionTeamsComparePageState
    extends State<ConsumptionTeamsComparePage> {
  String period = 'month';
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = consumptionPeriodStart(now, period),
        end = consumptionPeriodEnd(now, period);
    final current = filterConsumption(widget.rows, null, start, end);
    final teamTotals = consumptionTotalsByTeam(current, widget.teams);
    final ranking = groupConsumedMaterials(current, const []);
    return Scaffold(
      appBar: AppBar(title: const Text('Comparativo entre equipes')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            DropdownButtonFormField<String>(
                initialValue: period,
                decoration: const InputDecoration(
                    labelText: 'Período',
                    prefixIcon: Icon(Icons.calendar_month_outlined)),
                items: const [
                  DropdownMenuItem(value: 'week', child: Text('Esta semana')),
                  DropdownMenuItem(value: 'month', child: Text('Este mês'))
                ],
                onChanged: (v) => setState(() => period = v ?? 'month')),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(
                  child: ConsumptionSmallMetric(
                      title: teamTotals.isEmpty
                          ? 'Equipe'
                          : teamTotals.first['name'].toString(),
                      value: formatConsumptionQuantity(teamTotals.isEmpty
                          ? 0
                          : teamTotals.first['qty'] as double),
                      suffix: hasMixedConsumptionUnits(current))),
              const SizedBox(width: 10),
              Expanded(
                  child: ConsumptionSmallMetric(
                      title: 'Todas as equipes',
                      value: formatConsumptionQuantity(sumConsumption(current)),
                      suffix: hasMixedConsumptionUnits(current))),
            ]),
            const SizedBox(height: 12),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Consumo por equipe',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 16),
                          SizedBox(
                              height: 240,
                              child:
                                  ConsumptionHorizontalBars(data: teamTotals)),
                        ]))),
            const SizedBox(height: 12),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Ranking de materiais (geral da empresa)',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 8),
                          for (int i = 0; i < ranking.length && i < 5; i++)
                            ConsumptionRankingRow(index: i, data: ranking[i]),
                        ]))),
          ]),
    );
  }
}
