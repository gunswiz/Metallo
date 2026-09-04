part of '../../app.dart';

class ConsumptionGraphsPage extends StatefulWidget {
  const ConsumptionGraphsPage(
      {super.key, required this.rows, required this.teams, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String? initialTeamId;
  @override
  State<ConsumptionGraphsPage> createState() => _ConsumptionGraphsPageState();
}

class _ConsumptionGraphsPageState extends State<ConsumptionGraphsPage> {
  late String? teamId = widget.initialTeamId;
  int tab = 0;
  int periodDays = 180;
  String? materialId;
  @override
  Widget build(BuildContext context) {
    final teamRows = widget.rows
        .where(
            (r) => teamId == null || r['origin_team_id']?.toString() == teamId)
        .toList();
    final now = DateTime.now();
    final end =
        DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    final start = end.subtract(Duration(days: periodDays));
    final filtered = _filterConsumption(teamRows, null, start, end);
    final trend = _consumptionTrend(teamRows, start, end, periodDays);
    final categories = _groupCategories(filtered);
    final materials = _groupMaterials(filtered, const []);
    if (materialId != null &&
        !materials.any((g) => g['id'].toString() == materialId))
      materialId = null;
    materialId ??=
        materials.isNotEmpty ? materials.first['id'].toString() : null;
    final materialRows = materialId == null
        ? <Map<String, dynamic>>[]
        : teamRows
            .where((r) => r['item_id']?.toString() == materialId)
            .toList();
    final materialTrend = materialId == null
        ? <Map<String, dynamic>>[]
        : _consumptionTrend(materialRows, start, end, periodDays);
    final displayTrend = tab == 2 ? materialTrend : trend;
    final totals =
        displayTrend.map((e) => (e['qty'] as num).toDouble()).toList();
    final total = totals.fold<double>(0, (a, b) => a + b);
    final avg = totals.isEmpty ? 0.0 : total / totals.length;
    final maxValue =
        totals.isEmpty ? 0.0 : totals.reduce((a, b) => a > b ? a : b);
    final avgTitle = periodDays <= 7
        ? 'Média diária'
        : periodDays <= 30
            ? 'Média por faixa'
            : periodDays <= 90
                ? 'Média quinzenal'
                : 'Média mensal';
    return Scaffold(
      appBar: AppBar(title: const Text('Consumo em gráficos')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Expanded(
                  child: _teamDropdown(
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
                  DropdownMenuItem(value: 90, child: Text('90 dias')),
                  DropdownMenuItem(value: 180, child: Text('6 meses')),
                ],
                onChanged: (v) => setState(() => periodDays = v ?? 180),
              )),
            ]),
            const SizedBox(height: 14),
            SegmentedButton<int>(segments: const [
              ButtonSegment(value: 0, label: Text('Evolução')),
              ButtonSegment(value: 1, label: Text('Por categoria')),
              ButtonSegment(value: 2, label: Text('Por material')),
            ], selected: {
              tab
            }, onSelectionChanged: (v) => setState(() => tab = v.first)),
            if (tab == 2 && materials.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                  initialValue: materialId,
                  decoration: const InputDecoration(labelText: 'Material'),
                  items: materials
                      .map((g) => DropdownMenuItem(
                          value: g['id'].toString(),
                          child: Text('${g['code']} • ${g['name']}',
                              overflow: TextOverflow.ellipsis)))
                      .toList(),
                  onChanged: (v) => setState(() => materialId = v)),
            ],
            const SizedBox(height: 14),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              tab == 1
                                  ? 'Consumo por categoria'
                                  : tab == 2
                                      ? 'Evolução por material'
                                      : 'Evolução do consumo (${_consumptionScaleLabel(periodDays)})',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 4),
                          Text(
                              tab == 1
                                  ? 'Participação no período'
                                  : '${_dateBr(start)} - ${_dateBr(end.subtract(const Duration(days: 1)))} • ${_mixedUnits(filtered)}',
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 12)),
                          const SizedBox(height: 18),
                          SizedBox(
                              height: 260,
                              child: tab == 1
                                  ? ConsumptionDonutChart(
                                      data: categories, showLabels: true)
                                  : ConsumptionLineChart(data: displayTrend)),
                        ]))),
            if (tab != 1) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _SmallMetric(
                        title: avgTitle,
                        value: _formatQty(avg),
                        suffix: _mixedUnits(filtered))),
                const SizedBox(width: 10),
                Expanded(
                    child: _SmallMetric(
                        title: 'Maior consumo',
                        value: _formatQty(maxValue),
                        suffix: _mixedUnits(filtered))),
              ]),
              const SizedBox(height: 10),
              _SmallMetric(
                  title: 'Total no período',
                  value: _formatQty(total),
                  suffix: _mixedUnits(filtered)),
            ],
          ]),
    );
  }
}
