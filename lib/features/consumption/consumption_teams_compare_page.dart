part of '../../app.dart';

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
    final start = _periodStart(now, period), end = _periodEnd(now, period);
    final current = _filterConsumption(widget.rows, null, start, end);
    final teamTotals = <Map<String, dynamic>>[];
    for (final t in widget.teams) {
      final qty = _sumConsumption(current
          .where((r) => r['origin_team_id']?.toString() == t.id)
          .toList());
      teamTotals.add({'name': t.name, 'qty': qty});
    }
    teamTotals
        .sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
    final ranking = _groupMaterials(current, const []);
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
                  child: _SmallMetric(
                      title: teamTotals.isEmpty
                          ? 'Equipe'
                          : teamTotals.first['name'].toString(),
                      value: _formatQty(teamTotals.isEmpty
                          ? 0
                          : teamTotals.first['qty'] as double),
                      suffix: _mixedUnits(current))),
              const SizedBox(width: 10),
              Expanded(
                  child: _SmallMetric(
                      title: 'Todas as equipes',
                      value: _formatQty(_sumConsumption(current)),
                      suffix: _mixedUnits(current))),
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
                            _RankingRow(index: i, data: ranking[i]),
                        ]))),
          ]),
    );
  }
}
