import '../04_FUNCOES_E_LOGICA/formatters.dart';

class EquipmentOwnershipInfo {
  final String type;
  final String? rentalCompany;
  final String? rentalStartDate;
  final String? rentalEndDate;
  final String? notes;
  const EquipmentOwnershipInfo(
      {this.type = 'owned',
      this.rentalCompany,
      this.rentalStartDate,
      this.rentalEndDate,
      this.notes});
  bool get isRented => type == 'rented';
}

EquipmentOwnershipInfo parseEquipmentOwnership(String? rawNotes) {
  var type = 'owned';
  String? company;
  String? startDate;
  String? endDate;
  final visible = <String>[];
  for (final line in (rawNotes ?? '').split('\n')) {
    if (line.startsWith('#metallo:ownership=')) {
      type = line.substring('#metallo:ownership='.length) == 'rented'
          ? 'rented'
          : 'owned';
    } else if (line.startsWith('#metallo:rental_company=')) {
      final value = line.substring('#metallo:rental_company='.length);
      if (value.isNotEmpty) company = Uri.decodeComponent(value);
    } else if (line.startsWith('#metallo:rental_end=')) {
      final value = line.substring('#metallo:rental_end='.length).trim();
      if (value.isNotEmpty) endDate = value;
    } else if (line.startsWith('#metallo:rental_start=')) {
      final value = line.substring('#metallo:rental_start='.length).trim();
      if (value.isNotEmpty) startDate = value;
    } else if (line.trim().isNotEmpty) {
      visible.add(line);
    }
  }
  return EquipmentOwnershipInfo(
      type: type,
      rentalCompany: company,
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      notes: visible.isEmpty ? null : visible.join('\n'));
}

EquipmentOwnershipInfo equipmentOwnershipFromMap(Map<String, dynamic> map) {
  final legacy = parseEquipmentOwnership(map['notes'] as String?);
  return EquipmentOwnershipInfo(
    type: map['ownership_type']?.toString() ?? legacy.type,
    rentalCompany: map['rental_company']?.toString() ?? legacy.rentalCompany,
    rentalStartDate:
        map['rental_start_date']?.toString() ?? legacy.rentalStartDate,
    rentalEndDate: map['rental_end_date']?.toString() ?? legacy.rentalEndDate,
    notes: map['user_notes']?.toString() ?? legacy.notes,
  );
}

String? buildEquipmentNotes(
    {required String ownershipType,
    String? rentalCompany,
    String? rentalStartDate,
    String? rentalEndDate,
    String? notes}) {
  final lines = <String>[
    '#metallo:ownership=${ownershipType == 'rented' ? 'rented' : 'owned'}'
  ];
  if (ownershipType == 'rented' &&
      (rentalCompany?.trim().isNotEmpty ?? false)) {
    lines.add(
        '#metallo:rental_company=${Uri.encodeComponent(rentalCompany!.trim())}');
  }
  if (ownershipType == 'rented' &&
      (rentalStartDate?.trim().isNotEmpty ?? false)) {
    lines.add('#metallo:rental_start=${rentalStartDate!.trim()}');
  }
  if (ownershipType == 'rented' &&
      (rentalEndDate?.trim().isNotEmpty ?? false)) {
    lines.add('#metallo:rental_end=${rentalEndDate!.trim()}');
  }
  if (notes?.trim().isNotEmpty ?? false) lines.add(notes!.trim());
  return lines.join('\n');
}

String equipmentTypeDisplayName(String name) {
  final normalized = removePortugueseAccents(name.trim().toLowerCase());
  return normalized == 'maquina de solda' ? 'Máquina de solda trifásica' : name;
}
