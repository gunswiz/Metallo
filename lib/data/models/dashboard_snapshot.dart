import 'equipment_asset.dart';
import 'material_stock.dart';
import 'team.dart';

class DashboardSnapshot {
  final List<Team> teams;
  final List<MaterialStock> materials;
  final List<EquipmentAsset> equipment;

  const DashboardSnapshot({
    required this.teams,
    required this.materials,
    required this.equipment,
  });
}
