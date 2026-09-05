import 'package:metallo/core/formatters.dart';
import 'package:metallo/data/models/equipment_asset.dart';
import 'package:metallo/data/models/team.dart';

String equipmentFamilyKey(EquipmentAsset asset) {
  final normalized = removePortugueseAccents(asset.name.toLowerCase());
  if (normalized.contains('maquina de solda')) return 'family:welding_machine';
  return 'item:${asset.itemId}';
}

String equipmentFamilyLabel(List<EquipmentAsset> assets) =>
    equipmentFamilyKey(assets.first) == 'family:welding_machine'
        ? 'Máquinas de solda'
        : assets.first.name;

bool canOperateEquipment(String role) =>
    role == 'admin' || role == 'engineer' || role == 'leader';

List<Team> allowedEquipmentTeams(
  List<Team> teams,
  String role,
  String? userTeamId,
) =>
    role == 'leader'
        ? teams.where((team) => team.id == userTeamId).toList()
        : teams;

List<EquipmentAsset> filterEquipmentAssets(
  List<EquipmentAsset> equipment,
  List<Team> teams,
  String ownershipFilter,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return equipment.where((asset) {
    if (ownershipFilter != 'all' && asset.ownershipType != ownershipFilter) {
      return false;
    }
    if (normalizedQuery.isEmpty) return true;
    final teamName = findTeam(teams, asset.teamId)?.name ?? '';
    return asset.name.toLowerCase().contains(normalizedQuery) ||
        asset.assetCode.toLowerCase().contains(normalizedQuery) ||
        (asset.rentalCompany?.toLowerCase().contains(normalizedQuery) ??
            false) ||
        teamName.toLowerCase().contains(normalizedQuery);
  }).toList();
}

List<List<EquipmentAsset>> groupEquipmentAssets(
  List<EquipmentAsset> equipment,
) {
  final groups = <String, List<EquipmentAsset>>{};
  for (final asset in equipment) {
    groups
        .putIfAbsent(equipmentFamilyKey(asset), () => <EquipmentAsset>[])
        .add(asset);
  }
  return groups.values.toList();
}

String equipmentGroupSummary(List<EquipmentAsset> group) {
  final typeCount = group.map((asset) => asset.itemId).toSet().length;
  final typeLabel = typeCount == 1 ? 'tipo' : 'tipos';
  final equipmentLabel = group.length == 1 ? 'equipamento' : 'equipamentos';
  return '$typeCount $typeLabel • ${group.length} $equipmentLabel\n'
      'Toque para ver tipos e patrimônios';
}
