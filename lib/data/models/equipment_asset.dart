import 'equipment_ownership.dart';

class EquipmentAsset {
  final String id;
  final String itemId;
  final String teamId;
  final String code;
  final String name;
  final String assetCode;
  final String? serialNumber;
  final String status;
  final String ownershipType;
  final String? rentalCompany;
  final String? rentalEndDate;
  final String? notes;

  const EquipmentAsset({
    required this.id,
    required this.itemId,
    required this.teamId,
    required this.code,
    required this.name,
    required this.assetCode,
    this.serialNumber,
    required this.status,
    this.ownershipType = 'owned',
    this.rentalCompany,
    this.rentalEndDate,
    this.notes,
  });

  factory EquipmentAsset.fromMap(Map<String, dynamic> m) {
    final item = Map<String, dynamic>.from(m['items'] as Map);
    final ownership = parseEquipmentOwnership(m['notes'] as String?);
    return EquipmentAsset(
      id: m['id'] as String,
      itemId: m['item_id'] as String,
      teamId: m['team_id'] as String,
      code: item['code'] as String,
      name: equipmentTypeDisplayName(item['name'] as String),
      assetCode: m['asset_code'] as String,
      serialNumber: m['serial_number'] as String?,
      status: (m['status'] as String?) ?? 'available',
      ownershipType: ownership.type,
      rentalCompany: ownership.rentalCompany,
      rentalEndDate: ownership.rentalEndDate,
      notes: ownership.notes,
    );
  }
}
