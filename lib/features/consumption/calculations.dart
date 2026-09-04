part of '../../app.dart';

DateTime _periodStart(DateTime now, String period) {
  if (period == 'week') {
    return DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
  }
  return DateTime(now.year, now.month, 1);
}

DateTime _periodEnd(DateTime now, String period) => period == 'week'
    ? _periodStart(now, period).add(const Duration(days: 7))
    : DateTime(now.year, now.month + 1, 1);
DateTime _rowDate(Map<String, dynamic> r) =>
    DateTime.tryParse(r['created_at']?.toString() ?? '')?.toLocal() ??
    DateTime(1970);
List<Map<String, dynamic>> _filterConsumption(List<Map<String, dynamic>> rows,
        String? teamId, DateTime start, DateTime end) =>
    rows.where((r) {
      final d = _rowDate(r);
      return (teamId == null || r['origin_team_id']?.toString() == teamId) &&
          !d.isBefore(start) &&
          d.isBefore(end);
    }).toList();
double _sumConsumption(List<Map<String, dynamic>> rows) => rows.fold<double>(
    0, (a, r) => a + ((r['quantity'] as num?)?.toDouble() ?? 0));
double? _percentChange(double current, double previous) =>
    previous == 0 ? null : ((current - previous) / previous * 100);
String _formatQty(double v) =>
    v.toStringAsFixed(v % 1 == 0 ? 0 : 2).replaceAll('.', ',');
String _dateBr(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
String _consumptionPeriodLabel(int days) => days == 7
    ? '7 DIAS'
    : days == 30
        ? '30 DIAS'
        : days == 90
            ? '3 MESES'
            : '6 MESES';
String _consumptionScaleLabel(int days) => days == 7
    ? 'por dia'
    : days == 30
        ? 'a cada 5 dias'
        : days == 90
            ? 'a cada 15 dias'
            : 'por mês';
List<Map<String, dynamic>> _consumptionTrend(List<Map<String, dynamic>> rows,
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
          'qty': _sumConsumption(
              _filterConsumption(rows, null, bucketStart, bucketEnd))
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
      'qty': _sumConsumption(_filterConsumption(rows, null, cursor, bucketEnd))
    });
    cursor = next;
  }
  return out;
}

String _mixedUnits(List<Map<String, dynamic>> rows) {
  final units = <String>{};
  for (final r in rows) {
    final u = (r['items'] as Map?)?['unit']?.toString();
    if (u != null && u.isNotEmpty) units.add(u);
  }
  if (units.isEmpty) return 'un/kg/L';
  return units.take(3).join('/');
}

List<Map<String, dynamic>> _groupMaterials(
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

List<Map<String, dynamic>> _groupCategories(List<Map<String, dynamic>> rows) {
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

List<Map<String, dynamic>> _monthlyTrend(
    List<Map<String, dynamic>> rows, int months) {
  final now = DateTime.now();
  final out = <Map<String, dynamic>>[];
  for (int i = months - 1; i >= 0; i--) {
    final m = DateTime(now.year, now.month - i, 1);
    final n = DateTime(now.year, now.month - i + 1, 1);
    out.add({
      'label':
          '${m.month.toString().padLeft(2, '0')}/${m.year.toString().substring(2)}',
      'qty': _sumConsumption(_filterConsumption(rows, null, m, n))
    });
  }
  return out;
}

const _consumptionColors = [
  Color(0xFF2B8CFF),
  Color(0xFF59B85B),
  Color(0xFFFFA726),
  Color(0xFF8E63E7),
  Color(0xFF7B8CA2),
  Color(0xFF27C5C3)
];
