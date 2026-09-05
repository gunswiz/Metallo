import 'package:metallo/core/formatters.dart';

String _normalizeEpiSearch(Object? value) => removePortugueseAccents(
      value?.toString().trim().toLowerCase() ?? '',
    );

List<Map<String, dynamic>> filterActiveEpiEmployees(
  List<Map<String, dynamic>> employees,
  String query,
) {
  final normalizedQuery = _normalizeEpiSearch(query);
  return employees.where((employee) {
    final team = employee['teams'] as Map?;
    final searchableText = _normalizeEpiSearch([
      employee['full_name'],
      employee['profession'],
      employee['registration_code'],
      team?['name'],
    ].whereType<Object>().join(' '));
    return employee['active'] == true &&
        searchableText.contains(normalizedQuery);
  }).toList();
}

String? validEmployeeShoeSize(Map<String, dynamic> employee) {
  final raw = employee['shoe_size']?.toString().trim();
  final size = int.tryParse(raw ?? '');
  return size != null && size >= 38 && size <= 46 ? size.toString() : null;
}

List<Map<String, dynamic>> filterEpiCatalogItems(
  List<Map<String, dynamic>> catalogItems,
  String kind,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return catalogItems.where((catalogItem) {
    final matchesKind = kind == 'all' || catalogItem['item_kind'] == kind;
    final searchableText = [
      catalogItem['name'],
      catalogItem['code'],
      catalogItem['ca_number'],
      catalogItem['brand_model'],
    ].whereType<Object>().join(' ').toLowerCase();
    return matchesKind && searchableText.contains(normalizedQuery);
  }).toList();
}

List<Map<String, dynamic>> availableEpiStockBatches(
  List<Map<String, dynamic>> stockBatches,
) =>
    stockBatches
        .where((batch) => ((batch['quantity'] as num?)?.toInt() ?? 0) > 0)
        .toList();

List<Map<String, dynamic>> filterEpiStockBatches(
  List<Map<String, dynamic>> stockBatches,
  String kind,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return stockBatches.where((batch) {
    final item = batch['epi_items'] as Map?;
    final matchesKind = kind == 'all' || item?['item_kind'] == kind;
    final searchableText =
        '${item?['name']} ${item?['code']} ${batch['variant'] ?? ''}'
            .toLowerCase();
    return matchesKind && searchableText.contains(normalizedQuery);
  }).toList();
}

List<Map<String, dynamic>> summarizeEpiStock(
  List<Map<String, dynamic>> stockBatches,
) {
  final totalsByItem = <String, Map<String, dynamic>>{};
  for (final batch in stockBatches) {
    final catalogItem = Map<String, dynamic>.from(batch['epi_items'] as Map);
    final itemId = batch['item_id'].toString();
    final summary = totalsByItem.putIfAbsent(
      itemId,
      () => {...catalogItem, 'quantity': 0, 'variants': <String, int>{}},
    );
    final batchQuantity = (batch['quantity'] as num?)?.toInt() ?? 0;
    summary['quantity'] = (summary['quantity'] as int) + batchQuantity;

    final variant = batch['variant']?.toString().trim();
    if (variant == null || variant.isEmpty) continue;
    final variantTotals = summary['variants'] as Map<String, int>;
    variantTotals[variant] = (variantTotals[variant] ?? 0) + batchQuantity;
  }

  return totalsByItem.values.toList()
    ..sort((first, second) =>
        first['name'].toString().compareTo(second['name'].toString()));
}

List<Map<String, dynamic>> filterEpiStockSummaries(
  List<Map<String, dynamic>> stockSummaries,
  String kind,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return stockSummaries.where((stockSummary) {
    final searchableText =
        '${stockSummary['name']} ${stockSummary['code']} ${stockSummary['ca_number'] ?? ''}'
            .toLowerCase();
    return (kind == 'all' || stockSummary['item_kind'] == kind) &&
        searchableText.contains(normalizedQuery);
  }).toList();
}

List<Map<String, dynamic>> pendingEpiRequests(
  List<Map<String, dynamic>> requests,
) =>
    requests.where((request) => request['status'] == 'pending').toList();

List<Map<String, dynamic>> stockBatchesForEpiRequest(
  Map<String, dynamic> request,
  List<Map<String, dynamic>> stockBatches,
) {
  final requestedQuantity = (request['quantity'] as num?)?.toInt() ?? 1;
  return stockBatches
      .where((batch) =>
          batch['item_id'].toString() == request['item_id'].toString() &&
          (request['requested_variant'] == null ||
              batch['variant']?.toString() ==
                  request['requested_variant']?.toString()) &&
          ((batch['quantity'] as num?)?.toInt() ?? 0) >= requestedQuantity)
      .toList();
}

List<Map<String, dynamic>> buildEpiDeliveryLines(
  Map<String, int> selectedQuantities,
  List<Map<String, dynamic>> stockBatches,
) =>
    selectedQuantities.entries.map((selection) {
      final stockBatch = stockBatches.firstWhere(
        (batch) => batch['id'].toString() == selection.key,
      );
      return <String, dynamic>{
        'stock_batch_id': selection.key,
        'item_id': stockBatch['item_id'].toString(),
        'quantity': selection.value,
      };
    }).toList();
