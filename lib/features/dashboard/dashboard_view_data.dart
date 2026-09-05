import 'package:metallo/data/models/equipment_asset.dart';
import 'package:metallo/data/models/material_stock.dart';
import 'package:metallo/data/models/team.dart';

int dashboardTeamCount(List<Team> teams) =>
    teams.where((team) => !team.isCentral).length;

int dashboardMaterialCount(List<MaterialStock> materials) =>
    materials.map((material) => material.itemId).toSet().length;

List<MaterialStock> dashboardTeamMaterials(
  List<MaterialStock> materials,
  String teamId,
) =>
    materials.where((material) => material.teamId == teamId).toList();

List<EquipmentAsset> dashboardTeamEquipment(
  List<EquipmentAsset> equipment,
  String teamId,
) =>
    equipment.where((asset) => asset.teamId == teamId).toList();

List<MaterialStock> filterDashboardMaterials(
  List<MaterialStock> materials,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return materials
      .where((material) =>
          normalizedQuery.isEmpty ||
          '${material.code} ${material.name}'
              .toLowerCase()
              .contains(normalizedQuery))
      .toList();
}

List<EquipmentAsset> filterDashboardEquipment(
  List<EquipmentAsset> equipment,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return equipment
      .where((asset) =>
          normalizedQuery.isEmpty ||
          '${asset.code} ${asset.name} ${asset.assetCode}'
              .toLowerCase()
              .contains(normalizedQuery))
      .toList();
}

List<Map<String, dynamic>> filterDashboardTeamPeople(
  List<Map<String, dynamic>> people,
  String teamId,
  String query,
) {
  final normalizedQuery = query.trim().toLowerCase();
  return people
      .where((person) =>
          person['team_id']?.toString() == teamId &&
          (normalizedQuery.isEmpty ||
              (person['full_name']
                      ?.toString()
                      .toLowerCase()
                      .contains(normalizedQuery) ??
                  false)))
      .toList();
}

String teamDetailSearchHint(int tab) => switch (tab) {
      0 => 'Pesquisar material por nome ou código',
      1 => 'Pesquisar equipamento, código ou patrimônio',
      _ => 'Pesquisar integrante',
    };
