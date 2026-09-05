import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/team.dart';

DateTime consumptionPeriodStart(DateTime now, String period) {
  if (period == 'week') {
    return DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
  }
  return DateTime(now.year, now.month, 1);
}

DateTime consumptionPeriodEnd(DateTime now, String period) => period == 'week'
    ? consumptionPeriodStart(now, period).add(const Duration(days: 7))
    : DateTime(now.year, now.month + 1, 1);
DateTime _rowDate(Map<String, dynamic> r) =>
    DateTime.tryParse(r['created_at']?.toString() ?? '')?.toLocal() ??
    DateTime(1970);
List<Map<String, dynamic>> filterConsumption(List<Map<String, dynamic>> rows,
        String? teamId, DateTime start, DateTime end) =>
    rows.where((r) {
      final d = _rowDate(r);
      return (teamId == null || r['origin_team_id']?.toString() == teamId) &&
          !d.isBefore(start) &&
          d.isBefore(end);
    }).toList();
double sumConsumption(List<Map<String, dynamic>> rows) => rows.fold<double>(
    0, (a, r) => a + ((r['quantity'] as num?)?.toDouble() ?? 0));
double? consumptionPercentChange(double current, double previous) =>
    previous == 0 ? null : ((current - previous) / previous * 100);
String formatConsumptionQuantity(double v) =>
    v.toStringAsFixed(v % 1 == 0 ? 0 : 2).replaceAll('.', ',');
String formatConsumptionDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
String consumptionPeriodLabel(int days) => days == 7
    ? '7 DIAS'
    : days == 30
        ? '30 DIAS'
        : days == 90
            ? '3 MESES'
            : '6 MESES';
String consumptionScaleLabel(int days) => days == 7
    ? 'por dia'
    : days == 30
        ? 'a cada 5 dias'
        : days == 90
            ? 'a cada 15 dias'
            : 'por mês';
List<Map<String, dynamic>> consumptionTrend(List<Map<String, dynamic>> rows,
    DateTime start, DateTime end, int periodDays) {
  if (periodDays >= 180) {
    final out = <Map<String, dynamic>>[];
    var cursor = DateTime(start.year, start.month, 1);
    while (cursor.isBefore(end)) {
      final next = DateTime(cursor.year, cursor.month + 1, 1);
      final bucketStart = cursor.isBefore(start) ? start : cursor;
      final bucketEnd = next.isAfter(end) ? end : next;
      if (bucketStart.isBefore(bucketEnd)) {
        out.add({
          'label':
              '${cursor.month.toString().padLeft(2, '0')}/${cursor.year.toString().substring(2)}',
          'qty': sumConsumption(
              filterConsumption(rows, null, bucketStart, bucketEnd))
        });
      }
      cursor = next;
    }
    return out;
  }
  final bucketDays = periodDays <= 7
      ? 1
      : periodDays <= 30
          ? 5
          : 15;
  final out = <Map<String, dynamic>>[];
  var cursor = start;
  while (cursor.isBefore(end)) {
    final next = cursor.add(Duration(days: bucketDays));
    final bucketEnd = next.isAfter(end) ? end : next;
    final label = bucketDays == 1
        ? '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}'
        : '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}';
    out.add({
      'label': label,
      'qty': sumConsumption(filterConsumption(rows, null, cursor, bucketEnd))
    });
    cursor = next;
  }
  return out;
}

String hasMixedConsumptionUnits(List<Map<String, dynamic>> rows) {
  final units = <String>{};
  for (final r in rows) {
    final u = (r['items'] as Map?)?['unit']?.toString();
    if (u != null && u.isNotEmpty) units.add(u);
  }
  if (units.isEmpty) return 'un/kg/L';
  return units.take(3).join('/');
}

List<Map<String, dynamic>> groupConsumedMaterials(
    List<Map<String, dynamic>> current, List<Map<String, dynamic>> previous) {
  final grouped = <String, Map<String, dynamic>>{};
  for (final r in [...current, ...previous]) {
    final id = r['item_id']?.toString() ?? '';
    final item = r['items'] as Map?;
    grouped.putIfAbsent(
        id,
        () => {
              'id': id,
              'code': item?['code']?.toString() ?? '',
              'name': item?['name']?.toString() ?? 'Material',
              'unit': item?['unit']?.toString() ?? 'un',
              'category': item?['category']?.toString() ?? 'Outros',
              'qty': 0.0,
              'prev': 0.0
            });
  }
  for (final r in current) {
    final id = r['item_id']?.toString() ?? '';
    if (grouped[id] != null) {
      grouped[id]!['qty'] = (grouped[id]!['qty'] as double) +
          ((r['quantity'] as num?)?.toDouble() ?? 0);
    }
  }
  for (final r in previous) {
    final id = r['item_id']?.toString() ?? '';
    if (grouped[id] != null) {
      grouped[id]!['prev'] = (grouped[id]!['prev'] as double) +
          ((r['quantity'] as num?)?.toDouble() ?? 0);
    }
  }
  final out = grouped.values.where((g) => (g['qty'] as double) > 0).toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}

String _consumptionCategory(Map<String, dynamic> row) {
  final item = row['items'] as Map?;
  final configured = item?['category']?.toString().trim() ?? '';
  if (configured.isNotEmpty) return configured;
  final name = item?['name']?.toString().toLowerCase() ?? '';
  if (name.contains('disco') ||
      name.contains('lixa') ||
      name.contains('abrasiv')) {
    return 'Abrasivos';
  }
  if (name.contains('eletrodo') ||
      name.contains('arame') ||
      name.contains('solda')) {
    return 'Consumíveis de soldagem';
  }
  if (name.contains('gás') ||
      name.contains('gas') ||
      name.contains('oxigênio') ||
      name.contains('argon')) {
    return 'Gases';
  }
  return 'Outros';
}

List<Map<String, dynamic>> groupConsumptionCategories(
    List<Map<String, dynamic>> rows) {
  final m = <String, double>{};
  for (final r in rows) {
    final c = _consumptionCategory(r);
    m[c] = (m[c] ?? 0) + ((r['quantity'] as num?)?.toDouble() ?? 0);
  }
  final total = m.values.fold<double>(0, (a, b) => a + b);
  final out = m.entries
      .map((e) => {
            'name': e.key,
            'qty': e.value,
            'pct': total == 0 ? 0.0 : e.value / total * 100
          })
      .toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}

List<Map<String, dynamic>> monthlyConsumptionTrend(
    List<Map<String, dynamic>> rows, int months) {
  final now = DateTime.now();
  final out = <Map<String, dynamic>>[];
  for (int i = months - 1; i >= 0; i--) {
    final m = DateTime(now.year, now.month - i, 1);
    final n = DateTime(now.year, now.month - i + 1, 1);
    out.add({
      'label':
          '${m.month.toString().padLeft(2, '0')}/${m.year.toString().substring(2)}',
      'qty': sumConsumption(filterConsumption(rows, null, m, n))
    });
  }
  return out;
}

const consumptionColors = [
  metalloChartPrimary,
  Color(0xFF59B85B),
  Color(0xFFFFA726),
  Color(0xFF8E63E7),
  Color(0xFF7B8CA2),
  Color(0xFF27C5C3)
];

class ConsumptionOverviewData {
  const ConsumptionOverviewData({
    required this.currentRows,
    required this.previousRows,
    required this.currentTotal,
    required this.previousTotal,
    required this.percentChange,
    required this.ranking,
    required this.categories,
  });

  final List<Map<String, dynamic>> currentRows;
  final List<Map<String, dynamic>> previousRows;
  final double currentTotal;
  final double previousTotal;
  final double? percentChange;
  final List<Map<String, dynamic>> ranking;
  final List<Map<String, dynamic>> categories;
}

ConsumptionOverviewData consumptionOverview(
  List<Map<String, dynamic>> rows,
  String? teamId,
  String period,
  DateTime now,
) {
  final currentStart = consumptionPeriodStart(now, period);
  final currentRows = filterConsumption(
    rows,
    teamId,
    currentStart,
    consumptionPeriodEnd(now, period),
  );
  final previousStart = period == 'week'
      ? currentStart.subtract(const Duration(days: 7))
      : DateTime(now.year, now.month - 1, 1);
  final previousRows =
      filterConsumption(rows, teamId, previousStart, currentStart);
  final currentTotal = sumConsumption(currentRows);
  final previousTotal = sumConsumption(previousRows);
  return ConsumptionOverviewData(
    currentRows: currentRows,
    previousRows: previousRows,
    currentTotal: currentTotal,
    previousTotal: previousTotal,
    percentChange: consumptionPercentChange(currentTotal, previousTotal),
    ranking: groupConsumedMaterials(currentRows, previousRows),
    categories: groupConsumptionCategories(currentRows),
  );
}

class ConsumptionRangeData {
  const ConsumptionRangeData({
    required this.start,
    required this.end,
    required this.currentRows,
    required this.previousRows,
    required this.groupedMaterials,
    required this.total,
    required this.percentChange,
  });

  final DateTime start;
  final DateTime end;
  final List<Map<String, dynamic>> currentRows;
  final List<Map<String, dynamic>> previousRows;
  final List<Map<String, dynamic>> groupedMaterials;
  final double total;
  final double? percentChange;
}

ConsumptionRangeData consumptionRange(
  List<Map<String, dynamic>> rows,
  String? teamId,
  DateTime anchor,
  int periodDays,
) {
  final end = DateTime(anchor.year, anchor.month, anchor.day)
      .add(const Duration(days: 1));
  final start = end.subtract(Duration(days: periodDays));
  final previousStart = start.subtract(Duration(days: periodDays));
  final currentRows = filterConsumption(rows, teamId, start, end);
  final previousRows = filterConsumption(rows, teamId, previousStart, start);
  final total = sumConsumption(currentRows);
  return ConsumptionRangeData(
    start: start,
    end: end,
    currentRows: currentRows,
    previousRows: previousRows,
    groupedMaterials: groupConsumedMaterials(currentRows, previousRows),
    total: total,
    percentChange:
        consumptionPercentChange(total, sumConsumption(previousRows)),
  );
}

class ConsumptionGraphData {
  const ConsumptionGraphData({
    required this.start,
    required this.end,
    required this.filteredRows,
    required this.categories,
    required this.materials,
    required this.selectedMaterialId,
    required this.displayTrend,
    required this.total,
    required this.average,
    required this.maximum,
    required this.averageTitle,
  });

  final DateTime start;
  final DateTime end;
  final List<Map<String, dynamic>> filteredRows;
  final List<Map<String, dynamic>> categories;
  final List<Map<String, dynamic>> materials;
  final String? selectedMaterialId;
  final List<Map<String, dynamic>> displayTrend;
  final double total;
  final double average;
  final double maximum;
  final String averageTitle;
}

ConsumptionGraphData consumptionGraphData(
  List<Map<String, dynamic>> rows,
  String? teamId,
  int periodDays,
  String? materialId,
  int selectedTab,
  DateTime now,
) {
  final teamRows = rows
      .where((row) =>
          teamId == null || row['origin_team_id']?.toString() == teamId)
      .toList();
  final end =
      DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
  final start = end.subtract(Duration(days: periodDays));
  final filteredRows = filterConsumption(teamRows, null, start, end);
  final overallTrend = consumptionTrend(teamRows, start, end, periodDays);
  final categories = groupConsumptionCategories(filteredRows);
  final materials = groupConsumedMaterials(filteredRows, const []);
  final selectedMaterialExists = materialId != null &&
      materials.any((group) => group['id'].toString() == materialId);
  final selectedMaterialId = selectedMaterialExists
      ? materialId
      : materials.isEmpty
          ? null
          : materials.first['id'].toString();
  final materialRows = selectedMaterialId == null
      ? <Map<String, dynamic>>[]
      : teamRows
          .where((row) => row['item_id']?.toString() == selectedMaterialId)
          .toList();
  final materialTrend = selectedMaterialId == null
      ? <Map<String, dynamic>>[]
      : consumptionTrend(materialRows, start, end, periodDays);
  final displayTrend = selectedTab == 2 ? materialTrend : overallTrend;
  final totals =
      displayTrend.map((point) => (point['qty'] as num).toDouble()).toList();
  final total = totals.fold<double>(0, (sum, quantity) => sum + quantity);
  final average = totals.isEmpty ? 0.0 : total / totals.length;
  final maximum = totals.isEmpty
      ? 0.0
      : totals.reduce((first, second) => first > second ? first : second);
  return ConsumptionGraphData(
    start: start,
    end: end,
    filteredRows: filteredRows,
    categories: categories,
    materials: materials,
    selectedMaterialId: selectedMaterialId,
    displayTrend: displayTrend,
    total: total,
    average: average,
    maximum: maximum,
    averageTitle: _consumptionAverageTitle(periodDays),
  );
}

String _consumptionAverageTitle(int periodDays) => switch (periodDays) {
      <= 7 => 'Média diária',
      <= 30 => 'Média por faixa',
      <= 90 => 'Média quinzenal',
      _ => 'Média mensal',
    };

class ConsumptionMaterialDetailData {
  const ConsumptionMaterialDetailData({
    required this.item,
    required this.currentTrend,
    required this.previousTrend,
    required this.currentTotal,
    required this.previousTotal,
    required this.percentChange,
  });

  final Map? item;
  final List<Map<String, dynamic>> currentTrend;
  final List<Map<String, dynamic>> previousTrend;
  final double currentTotal;
  final double previousTotal;
  final double? percentChange;
}

ConsumptionMaterialDetailData consumptionMaterialDetail(
  List<Map<String, dynamic>> rows,
  String itemId,
  String? teamId,
) {
  final itemRows = rows
      .where((row) =>
          row['item_id']?.toString() == itemId &&
          (teamId == null || row['origin_team_id']?.toString() == teamId))
      .toList();
  final item = itemRows.isEmpty ? null : itemRows.first['items'] as Map?;
  final currentTrend = monthlyConsumptionTrend(itemRows, 3);
  final previousTrend = monthlyConsumptionTrend(itemRows, 6).take(3).toList();
  final currentTotal = sumConsumptionPoints(currentTrend);
  final previousTotal = sumConsumptionPoints(previousTrend);
  return ConsumptionMaterialDetailData(
    item: item,
    currentTrend: currentTrend,
    previousTrend: previousTrend,
    currentTotal: currentTotal,
    previousTotal: previousTotal,
    percentChange: consumptionPercentChange(currentTotal, previousTotal),
  );
}

double sumConsumptionPoints(List<Map<String, dynamic>> points) =>
    points.fold<double>(
      0,
      (total, point) => total + (point['qty'] as double),
    );

List<Map<String, dynamic>> consumptionTotalsByTeam(
  List<Map<String, dynamic>> rows,
  List<Team> teams,
) {
  final totals = teams.map((team) {
    final teamRows = rows
        .where((row) => row['origin_team_id']?.toString() == team.id)
        .toList();
    return <String, dynamic>{
      'name': team.name,
      'qty': sumConsumption(teamRows),
    };
  }).toList();
  totals.sort((first, second) =>
      (second['qty'] as double).compareTo(first['qty'] as double));
  return totals;
}
