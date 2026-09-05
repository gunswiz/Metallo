import 'package:metallo/core/formatters.dart';
import 'package:metallo/data/models/equipment_asset.dart';

String equipmentFamilyKey(EquipmentAsset asset) {
  final normalized = removePortugueseAccents(asset.name.toLowerCase());
  if (normalized.contains('maquina de solda')) return 'family:welding_machine';
  return 'item:${asset.itemId}';
}

String equipmentFamilyLabel(List<EquipmentAsset> assets) =>
    equipmentFamilyKey(assets.first) == 'family:welding_machine'
        ? 'Máquinas de solda'
        : assets.first.name;
