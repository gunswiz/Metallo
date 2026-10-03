class MaterialStock {
  final String inventoryId;
  final String itemId;
  final String teamId;
  final String code;
  final String name;
  final String unit;
  final int quantity;
  final String status;
  final List<String> servedTeamIds;
  final String? locationName;

  const MaterialStock({
    required this.inventoryId,
    required this.itemId,
    required this.teamId,
    required this.code,
    required this.name,
    required this.unit,
    required this.quantity,
    required this.status,
    this.servedTeamIds = const [],
    this.locationName,
  });

  bool servesTeam(String id) => teamId == id || servedTeamIds.contains(id);

  factory MaterialStock.fromMap(Map<String, dynamic> m) {
    final item = Map<String, dynamic>.from(m['items'] as Map);
    return MaterialStock(
      inventoryId: m['id'] as String,
      itemId: m['item_id'] as String,
      teamId: m['team_id'] as String,
      code: item['code'] as String,
      name: item['name'] as String,
      unit: (item['unit'] as String?) ?? 'un',
      quantity: (m['quantity'] as num?)?.toInt() ?? 0,
      status: (m['status'] as String?) ?? 'available',
      servedTeamIds: (m['served_team_ids'] as List?)?.cast<String>() ?? const [],
      locationName: m['location_name'] as String?,
    );
  }
}
