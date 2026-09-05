import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/consumption/widgets.dart';
import 'package:metallo/features/consumption/consumption_teams_compare_page.dart';
import 'package:metallo/features/consumption/consumption_material_detail_page.dart';
import 'package:metallo/features/consumption/consumption_materials_page.dart';
import 'package:metallo/features/consumption/consumption_graphs_page.dart';
import 'package:metallo/features/consumption/charts.dart';
import 'package:metallo/features/consumption/calculations.dart';

class ConsumptionPage extends StatefulWidget {
  const ConsumptionPage(
      {super.key,
      required this.movementRepository,
      required this.dashboardRepository,
      required this.stream});
  final MovementRepository movementRepository;
  final DashboardRepository dashboardRepository;
  final Stream<DashboardSnapshot> stream;

  @override
  State<ConsumptionPage> createState() => _ConsumptionPageState();
}

class _ConsumptionPageState extends State<ConsumptionPage> {
  String? teamId;
  String? unit;
  String period = 'month';

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.stream,
      builder: (context, ds) {
        if (!ds.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final teams = ds.data!.teams.where((t) => !t.isCentral).toList();
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.movementRepository.fetchMaterialConsumption(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final allRows = snap.data!;
            final units = consumptionUnits(allRows);
            final effectiveUnit = effectiveConsumptionUnit(allRows, unit);
            final rows = filterConsumptionUnit(allRows, effectiveUnit);
            final overview =
                consumptionOverview(rows, teamId, period, DateTime.now());

            return RefreshIndicator(
              onRefresh: () async {
                setState(() {});
                await widget.dashboardRepository.refreshDashboard();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 92),
                children: [
                  Row(
                    children: [
                      const Expanded(
                          child: Text('Consumo',
                              style: TextStyle(
                                  fontSize: 25, fontWeight: FontWeight.w900))),
                      IconButton(
                        tooltip: 'Consumo semanal',
                        icon: const Icon(Icons.table_rows_rounded),
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => ConsumptionMaterialsPage(
                                    rows: allRows,
                                    teams: teams,
                                    initialTeamId: teamId,
                                    initialUnit: effectiveUnit))),
                      ),
                      IconButton(
                        tooltip: 'Gráficos',
                        icon: const Icon(Icons.filter_alt_outlined),
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => ConsumptionGraphsPage(
                                    rows: allRows,
                                    teams: teams,
                                    initialTeamId: teamId,
                                    initialUnit: effectiveUnit))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Column(children: [
                    teamConsumptionDropdown(
                        teams, teamId, (v) => setState(() => teamId = v)),
                    if (units.length > 1) ...[
                      const SizedBox(height: 10),
                      consumptionUnitDropdown(units, effectiveUnit,
                          (value) => setState(() => unit = value)),
                    ],
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: period,
                      decoration: const InputDecoration(
                          labelText: 'Período',
                          prefixIcon: Icon(Icons.calendar_month_outlined)),
                      items: const [
                        DropdownMenuItem(
                            value: 'week', child: Text('Esta semana')),
                        DropdownMenuItem(
                            value: 'month', child: Text('Este mês')),
                      ],
                      onChanged: (v) => setState(() => period = v ?? 'month'),
                    ),
                  ]),
                  const SizedBox(height: 14),
                  ConsumptionMetricCard(
                    eyebrow:
                        'COMPARAÇÃO COM ${period == 'week' ? 'SEMANA' : 'MÊS'} ANTERIOR',
                    title: 'Total consumido',
                    value: formatConsumptionQuantity(overview.currentTotal),
                    suffix: hasMixedConsumptionUnits(overview.currentRows),
                    change: overview.percentChange,
                    comparisonText:
                        'vs ${period == 'week' ? 'Semana' : 'Mês'} anterior',
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Resumo por categoria',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                            const SizedBox(height: 14),
                            if (overview.categories.isEmpty)
                              const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 18),
                                  child: Text('Nenhum consumo neste período.',
                                      style: TextStyle(color: Colors.white54)))
                            else
                              Row(children: [
                                SizedBox(
                                    width: 130,
                                    height: 130,
                                    child: ConsumptionDonutChart(
                                        data: overview.categories)),
                                const SizedBox(width: 14),
                                Expanded(
                                    child: Column(children: [
                                  for (int i = 0;
                                      i < overview.categories.length && i < 5;
                                      i++)
                                    ConsumptionCategoryLegendRow(
                                        index: i, data: overview.categories[i])
                                ])),
                              ]),
                          ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Top 5 materiais mais consumidos',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                            const SizedBox(height: 8),
                            if (overview.ranking.isEmpty)
                              const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 14),
                                  child: Text('Nenhum consumo registrado.',
                                      style: TextStyle(color: Colors.white54)))
                            else
                              for (int i = 0;
                                  i < overview.ranking.length && i < 5;
                                  i++)
                                ConsumptionRankingRow(
                                    index: i,
                                    data: overview.ranking[i],
                                    onTap: () {
                                      Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                              builder: (_) =>
                                                  ConsumptionMaterialDetailPage(
                                                      rows: rows,
                                                      teams: teams,
                                                      itemId: overview
                                                          .ranking[i]['id']
                                                          .toString(),
                                                      initialTeamId: teamId)));
                                    }),
                          ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: OutlinedButton.icon(
                      icon: const Icon(Icons.show_chart_rounded),
                      label: const Text('Ver gráficos'),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ConsumptionGraphsPage(
                                  rows: allRows,
                                  teams: teams,
                                  initialTeamId: teamId,
                                  initialUnit: effectiveUnit))),
                    )),
                    const SizedBox(width: 10),
                    Expanded(
                        child: OutlinedButton.icon(
                      icon: const Icon(Icons.compare_arrows_rounded),
                      label: const Text('Comparar equipes'),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ConsumptionTeamsComparePage(
                                  rows: allRows,
                                  teams: teams,
                                  initialUnit: effectiveUnit))),
                    )),
                  ]),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
