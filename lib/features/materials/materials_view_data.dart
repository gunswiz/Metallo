import 'package:metallo/core/formatters.dart';
import 'package:metallo/data/models/material_stock.dart';
import 'package:metallo/data/models/team.dart';

bool canOperateMaterials(String role) =>
    role == 'admin' || role == 'engineer' || role == 'leader';

List<Team> allowedMaterialTeams(
  List<Team> teams,
  String role,
  String? userTeamId,
) =>
    role == 'leader'
        ? teams.where((team) => team.id == userTeamId).toList()
        : teams;

List<MaterialStock> filterMaterialStocks(
  List<MaterialStock> materials,
  List<Team> teams,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.isEmpty) return materials.toList();
  return materials.where((material) {
    final teamName = findTeam(teams, material.teamId)?.name ?? '';
    return material.name.toLowerCase().contains(normalizedQuery) ||
        material.code.toLowerCase().contains(normalizedQuery) ||
        teamName.toLowerCase().contains(normalizedQuery);
  }).toList();
}

List<List<MaterialStock>> groupMaterialStocks(
  List<MaterialStock> materials,
) {
  final groups = <String, List<MaterialStock>>{};
  for (final material in materials) {
    groups.putIfAbsent(material.itemId, () => <MaterialStock>[]).add(material);
  }
  return groups.values.toList();
}

int materialGroupQuantity(List<MaterialStock> group) => group.fold<int>(
      0,
      (total, material) => total + material.quantity,
    );

String materialGroupDistributionLabel(List<MaterialStock> group) {
  final locationLabel = group.length == 1 ? 'local' : 'locais';
  return '${group.length} $locationLabel • código ${group.first.code}\n'
      'Toque para ver a distribuição';
}
