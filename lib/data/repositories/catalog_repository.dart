import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/equipment_ownership.dart';
import 'dashboard_repository.dart';
import 'repository_utils.dart';

class CatalogRepository {
  CatalogRepository(this.client, this.dashboardRepository);
  final SupabaseClient client;
  final DashboardRepository dashboardRepository;

  Future<List<Map<String, dynamic>>> fetchMaterialCatalog() async {
    final rows = await client
        .from('items')
        .select('id,code,name,unit,category,description')
        .eq('active', true)
        .eq('item_type', 'material')
        .order('code');
    final inventory = await client.from('inventory').select('item_id,quantity');
    final totals = <String, num>{};
    for (final raw in inventory as List) {
      final row = Map<String, dynamic>.from(raw as Map);
      final id = row['item_id']?.toString();
      if (id == null) continue;
      totals[id] = (totals[id] ?? 0) + ((row['quantity'] as num?) ?? 0);
    }
    return (rows as List).map((e) {
      final row = Map<String, dynamic>.from(e as Map);
      row['total_quantity'] = totals[row['id']?.toString()] ?? 0;
      return row;
    }).toList();
  }

  Future<List<Map<String, dynamic>>> fetchEquipmentCatalog() async {
    final rows = await client
        .from('assets')
        .select(
            'id,asset_code,serial_number,status,team_id,notes,items!inner(id,code,name,item_type,active),teams(name)')
        .eq('active', true)
        .eq('items.item_type', 'equipment')
        .eq('items.active', true)
        .order('asset_code');
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> updateEquipmentItem(
      {required String itemId,
      required String code,
      required String name}) async {
    await client.rpc('update_item_admin', params: {
      'p_item_id': itemId,
      'p_code': code.trim(),
      'p_name': name.trim(),
      'p_description': null,
      'p_category': null,
      'p_unit': 'un',
      'p_minimum_stock': 0,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> updateEquipmentAsset({
    required String assetId,
    required String assetCode,
    required String? serialNumber,
    required String teamId,
    required String status,
    required String? notes,
    String ownershipType = 'owned',
    String? rentalCompany,
    String? rentalEndDate,
  }) async {
    await client.rpc('update_asset_admin', params: {
      'p_asset_id': assetId,
      'p_asset_code': assetCode.trim(),
      'p_serial_number': nullableText(serialNumber),
      'p_team_id': teamId,
      'p_status': status,
      'p_notes': buildEquipmentNotes(
          ownershipType: ownershipType,
          rentalCompany: rentalCompany,
          rentalEndDate: rentalEndDate,
          notes: notes),
      'p_active': true,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> deactivateEquipmentAsset(String assetId) async {
    await client.rpc('deactivate_asset_admin', params: {'p_asset_id': assetId});
    await dashboardRepository.refreshDashboard();
  }

  Future<void> updateMaterialItem({
    required String itemId,
    required String code,
    required String name,
    required String unit,
    String? category,
    String? description,
  }) async {
    await client.rpc('update_item_admin', params: {
      'p_item_id': itemId,
      'p_code': code.trim(),
      'p_name': name.trim(),
      'p_description': nullableText(description),
      'p_category': nullableText(category),
      'p_unit': unit.trim().isEmpty ? 'un' : unit.trim(),
      'p_minimum_stock': 0,
      'p_active': true,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> deactivateMaterialItem(String itemId) async {
    await client.rpc('deactivate_item_admin', params: {'p_item_id': itemId});
    await dashboardRepository.refreshDashboard();
  }

  Future<void> createMaterial({
    required String code,
    required String name,
    required String teamId,
    required int quantity,
    String unit = 'un',
  }) async {
    await client.rpc('create_material_for_team', params: {
      'p_code': code.trim(),
      'p_name': name.trim(),
      'p_description': null,
      'p_category': null,
      'p_unit': unit.trim().isEmpty ? 'un' : unit.trim(),
      'p_minimum_stock': 0,
      'p_team_id': teamId,
      'p_quantity': quantity,
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> createEquipment({
    required String code,
    required String name,
    required String assetCode,
    required String teamId,
    String? serialNumber,
    String ownershipType = 'owned',
    String? rentalCompany,
    String? rentalEndDate,
    String? notes,
  }) async {
    await client.rpc('create_equipment_for_team', params: {
      'p_code': code.trim(),
      'p_name': name.trim(),
      'p_asset_code': assetCode.trim(),
      'p_serial_number': nullableText(serialNumber),
      'p_description': null,
      'p_category': null,
      'p_team_id': teamId,
      'p_notes': buildEquipmentNotes(
          ownershipType: ownershipType,
          rentalCompany: rentalCompany,
          rentalEndDate: rentalEndDate,
          notes: notes),
    });
    await dashboardRepository.refreshDashboard();
  }
}
