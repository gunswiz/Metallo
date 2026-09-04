part of '../../app.dart';

class ConsumptionMaterialDetailPage extends StatefulWidget {
  const ConsumptionMaterialDetailPage(
      {super.key,
      required this.rows,
      required this.teams,
      required this.itemId,
      this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String itemId;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialDetailPage> createState() =>
      _ConsumptionMaterialDetailPageState();
}

class _ConsumptionMaterialDetailPageState
    extends State<ConsumptionMaterialDetailPage> {
  late String? teamId = widget.initialTeamId;
  @override
  Widget build(BuildContext context) {
    final itemRows = widget.rows
        .where((r) =>
            r['item_id']?.toString() == widget.itemId &&
            (teamId == null || r['origin_team_id']?.toString() == teamId))
        .toList();
    final item = itemRows.isEmpty ? null : itemRows.first['items'] as Map?;
    final currentTrend = _monthlyTrend(itemRows, 3);
    final previousTrend = _monthlyTrend(itemRows, 6).take(3).toList();
    final currentTotal =
        currentTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    final previousTotal =
        previousTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes do material')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                      color: const Color(0xFF0C3766),
                      borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.blur_linear_rounded,
                      size: 38, color: Color(0xFF248BFF))),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(item?['name']?.toString() ?? 'Material',
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 20)),
                    Text('Código: ${item?['code'] ?? ''}',
                        style: const TextStyle(color: Colors.white54)),
                    const SizedBox(height: 5),
                    if ((item?['category']?.toString() ?? '').isNotEmpty)
                      Chip(
                          label: Text(item!['category'].toString()),
                          visualDensity: VisualDensity.compact)
                  ])),
            ]),
            const SizedBox(height: 14),
            _teamDropdown(
                widget.teams, teamId, (v) => setState(() => teamId = v)),
            const SizedBox(height: 14),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              'Consumo de ${item?['name'] ?? 'material'} (${item?['unit'] ?? 'un'})',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 16),
                          SizedBox(
                              height: 250,
                              child: ConsumptionGroupedBarChart(
                                  current: currentTrend,
                                  previous: previousTrend)),
                        ]))),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: _SmallMetric(
                      title: 'Total no período atual',
                      value: _formatQty(currentTotal),
                      suffix: item?['unit']?.toString() ?? 'un')),
              const SizedBox(width: 10),
              Expanded(
                  child: _SmallMetric(
                      title: 'Total no período anterior',
                      value: _formatQty(previousTotal),
                      suffix: item?['unit']?.toString() ?? 'un'))
            ]),
            const SizedBox(height: 10),
            _MetricCard(
                eyebrow: 'VARIAÇÃO NO PERÍODO',
                title: '',
                value:
                    '${_percentChange(currentTotal, previousTotal)?.abs().toStringAsFixed(1) ?? '0.0'}%',
                suffix: '',
                change: _percentChange(currentTotal, previousTotal),
                comparisonText: 'comparado aos 3 meses anteriores'),
          ]),
    );
  }
}
