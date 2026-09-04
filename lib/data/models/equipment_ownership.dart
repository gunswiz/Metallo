import '../../core/formatters.dart';

class EquipmentOwnershipInfo {
  final String type;
  final String? rentalCompany;
  final String? rentalEndDate;
  final String? notes;
  const EquipmentOwnershipInfo(
      {this.type = 'owned',
      this.rentalCompany,
      this.rentalEndDate,
      this.notes});
  bool get isRented => type == 'rented';
}

EquipmentOwnershipInfo parseEquipmentOwnership(String? rawNotes) {
  var type = 'owned';
  String? company;
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
    } else if (line.trim().isNotEmpty) {
      visible.add(line);
    }
  }
  return EquipmentOwnershipInfo(
      type: type,
      rentalCompany: company,
      rentalEndDate: endDate,
      notes: visible.isEmpty ? null : visible.join('\n'));
}

String? buildEquipmentNotes(
    {required String ownershipType,
    String? rentalCompany,
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
