import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/equipment_asset.dart';
import 'dashboard_repository.dart';
import 'repository_utils.dart';

class MovementRepository {
  MovementRepository(this.client, this.dashboardRepository);
  final SupabaseClient client;
  final DashboardRepository dashboardRepository;

  Future<void> consumeMaterial({
    required String itemId,
    required String teamId,
    required int quantity,
    String? note,
  }) async {
    await client.rpc('consume_material', params: {
      'p_item_id': itemId,
      'p_team_id': teamId,
      'p_quantity': quantity,
      'p_note': nullableText(note) ?? 'Consumo pelo aplicativo',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> replenishMaterial({
    required String itemId,
    required String centralTeamId,
    required String destinationTeamId,
    required int quantity,
    String? note,
  }) async {
    await client.rpc('replenish_material', params: {
      'p_item_id': itemId,
      'p_origin_team_id': centralTeamId,
      'p_destination_team_id': destinationTeamId,
      'p_quantity': quantity,
      'p_note': nullableText(note) ?? 'Reposição da Central pelo aplicativo',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> transferEquipment({
    required String assetId,
    required String toTeamId,
  }) async {
    await client.rpc('register_asset_movement', params: {
      'p_asset_id': assetId,
      'p_movement_type': 'transfer',
      'p_destination_team_id': toTeamId,
      'p_new_status': 'available',
      'p_note': 'Transferência pelo aplicativo',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> returnRentedEquipment(EquipmentAsset asset, String? note) async {
    if (asset.ownershipType != 'rented') {
      throw StateError('Somente equipamentos alugados podem ser devolvidos.');
    }
    await client.rpc('return_rented_equipment', params: {
      'p_asset_id': asset.id,
      'p_note': note,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> sendEquipmentToMaintenance({
    required String assetId,
    String? note,
  }) async {
    await client.rpc('register_asset_movement', params: {
      'p_asset_id': assetId,
      'p_movement_type': 'maintenance',
      'p_destination_team_id': null,
      'p_new_status': 'maintenance',
      'p_note': nullableText(note) ?? 'Equipamento enviado para manutenção',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> returnEquipmentFromMaintenance({
    required String assetId,
    required String toTeamId,
    String? note,
  }) async {
    await client.rpc('register_asset_movement', params: {
      'p_asset_id': assetId,
      'p_movement_type': 'return',
      'p_destination_team_id': toTeamId,
      'p_new_status': 'available',
      'p_note': nullableText(note) ?? 'Retorno da manutenção',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<List<Map<String, dynamic>>> fetchMaterialConsumption() async {
    final rows = await client
        .from('movements')
        .select(
          'id,item_id,origin_team_id,destination_team_id,created_at,quantity,movement_type,note,items(name,code,unit,category),origin:origin_team_id(name),destination:destination_team_id(name)',
        )
        .eq('movement_type', 'consumption')
        .order('created_at', ascending: false);
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchHistory() async {
    final material = await client
        .from('movements')
        .select(
          'id,item_id,origin_team_id,destination_team_id,created_at,quantity,movement_type,note,items(name,code),origin:origin_team_id(name),destination:destination_team_id(name)',
        )
        .order('created_at', ascending: false)
        .limit(60);

    final assets = await client
        .from('asset_movements')
        .select(
          'id,asset_id,origin_team_id,destination_team_id,previous_status,new_status,created_at,movement_type,note,assets(asset_code,items(name,code)),origin:origin_team_id(name),destination:destination_team_id(name)',
        )
        .order('created_at', ascending: false)
        .limit(60);

    final rows = <Map<String, dynamic>>[];
    for (final e in material as List) {
      rows.add({...Map<String, dynamic>.from(e as Map), '_kind': 'material'});
    }
    for (final e in assets as List) {
      rows.add({...Map<String, dynamic>.from(e as Map), '_kind': 'equipment'});
    }
    rows.sort((a, b) {
      final ad = DateTime.tryParse(a['created_at']?.toString() ?? '') ??
          DateTime(1970);
      final bd = DateTime.tryParse(b['created_at']?.toString() ?? '') ??
          DateTime(1970);
      return bd.compareTo(ad);
    });
    return rows.take(100).toList();
  }

  Future<void> updateMaterialHistory({
    required String id,
    required int quantity,
    required String? originTeamId,
    required String? destinationTeamId,
    required String? note,
  }) async {
    await client.rpc('admin_update_material_movement', params: {
      'p_movement_id': id,
      'p_quantity': quantity,
      'p_origin_team_id': originTeamId,
      'p_destination_team_id': destinationTeamId,
      'p_note': nullableText(note),
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> deleteMaterialHistory(String id) async {
    await client.rpc('admin_delete_material_movement', params: {
      'p_movement_id': id,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> updateAssetHistory({
    required String id,
    required String destinationTeamId,
    required String status,
    required String? note,
  }) async {
    await client.rpc('admin_update_asset_movement', params: {
      'p_movement_id': id,
      'p_destination_team_id': destinationTeamId,
      'p_new_status': status,
      'p_note': nullableText(note),
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> deleteAssetHistory(String id) async {
    await client.rpc('admin_delete_asset_movement', params: {
      'p_movement_id': id,
    });
    await dashboardRepository.refreshDashboard();
  }
}
