class MaterialStock {
  final String inventoryId;
  final String itemId;
  final String teamId;
  final String code;
  final String name;
  final String unit;
  final int quantity;
  final String status;

  const MaterialStock({
    required this.inventoryId,
    required this.itemId,
    required this.teamId,
    required this.code,
    required this.name,
    required this.unit,
    required this.quantity,
    required this.status,
  });

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
    );
  }
}
