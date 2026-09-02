import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

class Team {
  final String id;
  final String name;
  final String? description;
  final String locationType;

  const Team({
    required this.id,
    required this.name,
    this.description,
    this.locationType = 'field',
  });

  bool get isCentral => locationType == 'central';

  factory Team.fromMap(Map<String, dynamic> m) => Team(
        id: m['id'] as String,
        name: m['name'] as String,
        description: m['description'] as String?,
        locationType: (m['location_type'] as String?) ?? 'field',
      );
}

class MaterialStock {
  final String inventoryId;
  final String itemId;
  final String teamId;
  final String code;
  final String name;
  final String unit;
  final int quantity;
  final String status;

  const MaterialStock({
    required this.inventoryId,
    required this.itemId,
    required this.teamId,
    required this.code,
    required this.name,
    required this.unit,
    required this.quantity,
    required this.status,
  });

  factory MaterialStock.fromMap(Map<String, dynamic> m) {
    final item = Map<String, dynamic>.from(m['items'] as Map);
    return MaterialStock(
      inventoryId: m['id'] as String,
      itemId: m['item_id'] as String,
      teamId: m['team_id'] as String,
      code: item['code'] as String,
      name: item['name'] as String,
      unit: (item['unit'] as String?) ?? 'un',
      quantity: (m['quantity'] as num?)?.toInt() ?? 0,
      status: (m['status'] as String?) ?? 'available',
    );
  }
}

class EquipmentAsset {
  final String id;
  final String itemId;
  final String teamId;
  final String code;
  final String name;
  final String assetCode;
  final String? serialNumber;
  final String status;

  const EquipmentAsset({
    required this.id,
    required this.itemId,
    required this.teamId,
    required this.code,
    required this.name,
    required this.assetCode,
    this.serialNumber,
    required this.status,
  });

  factory EquipmentAsset.fromMap(Map<String, dynamic> m) {
    final item = Map<String, dynamic>.from(m['items'] as Map);
    return EquipmentAsset(
      id: m['id'] as String,
      itemId: m['item_id'] as String,
      teamId: m['team_id'] as String,
      code: item['code'] as String,
      name: item['name'] as String,
      assetCode: m['asset_code'] as String,
      serialNumber: m['serial_number'] as String?,
      status: (m['status'] as String?) ?? 'available',
    );
  }
}

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

class MetalloRepository {
  MetalloRepository(this.client);
  final SupabaseClient client;

  final _dashboardController = StreamController<DashboardSnapshot>.broadcast();
  RealtimeChannel? _channel;
  Timer? _debounce;
  DashboardSnapshot? _cache;
  bool _realtimeStarted = false;

  Future<Map<String, dynamic>?> currentProfile() async {
    final uid = client.auth.currentUser?.id;
    if (uid == null) return null;
    return await client
        .from('profiles')
        .select('id,full_name,role,active,team_id,teams(name)')
        .eq('id', uid)
        .maybeSingle();
  }

  Future<List<Map<String, dynamic>>> fetchProfiles() async {
    final rows = await client
        .from('profiles')
        .select('id,full_name,role,team_id,active,created_at,teams(name)')
        .order('full_name');
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<DashboardSnapshot> fetchDashboard() async {
    final teamsRaw = await client
        .from('teams')
        .select('id,name,description,location_type')
        .eq('active', true)
        .order('created_at');

    final inventoryRaw = await client
        .from('inventory')
        .select(
          'id,item_id,team_id,quantity,status,items!inner(id,code,name,unit,item_type,active)',
        )
        .eq('items.item_type', 'material')
        .eq('items.active', true)
        .gt('quantity', 0)
        .order('created_at');

    final assetsRaw = await client
        .from('assets')
        .select(
          'id,item_id,asset_code,serial_number,team_id,status,items!inner(id,code,name,item_type,active)',
        )
        .eq('active', true)
        .eq('items.item_type', 'equipment')
        .eq('items.active', true)
        .not('team_id', 'is', null)
        .order('created_at');

    return DashboardSnapshot(
      teams: (teamsRaw as List)
          .map((e) => Team.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      materials: (inventoryRaw as List)
          .map((e) => MaterialStock.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      equipment: (assetsRaw as List)
          .map((e) => EquipmentAsset.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }

  Future<void> refreshDashboard() async {
    try {
      final data = await fetchDashboard();
      _cache = data;
      if (!_dashboardController.isClosed) _dashboardController.add(data);
    } catch (e, st) {
      if (!_dashboardController.isClosed) _dashboardController.addError(e, st);
    }
  }

  Stream<DashboardSnapshot> watchDashboard() {
    if (!_realtimeStarted) {
      _realtimeStarted = true;
      Future.microtask(refreshDashboard);

      void schedule() {
        _debounce?.cancel();
        _debounce = Timer(const Duration(milliseconds: 180), refreshDashboard);
      }

      _channel = client
          .channel('metallo-dashboard-v3')
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'teams',
              callback: (_) => schedule())
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'items',
              callback: (_) => schedule())
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'inventory',
              callback: (_) => schedule())
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'assets',
              callback: (_) => schedule())
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'movements',
              callback: (_) => schedule())
          .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'asset_movements',
              callback: (_) => schedule());
      _channel!.subscribe();
    }

    return Stream<DashboardSnapshot>.multi((controller) {
      if (_cache != null) controller.add(_cache!);
      final sub = _dashboardController.stream.listen(
        controller.add,
        onError: controller.addError,
      );
      controller.onCancel = sub.cancel;
    }, isBroadcast: true);
  }

  Future<List<Map<String, dynamic>>> fetchMaterialCatalog() async {
    final rows = await client
        .from('items')
        .select('id,code,name,unit,category,description')
        .eq('active', true)
        .eq('item_type', 'material')
        .order('code');
    final inventory = await client
        .from('inventory')
        .select('item_id,quantity');
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
        .select('id,asset_code,serial_number,status,team_id,notes,items!inner(code,name,item_type,active),teams(name)')
        .eq('active', true)
        .eq('items.item_type', 'equipment')
        .eq('items.active', true)
        .order('asset_code');
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }


  Future<void> updateEquipmentAsset({
    required String assetId,
    required String assetCode,
    required String? serialNumber,
    required String teamId,
    required String status,
    required String? notes,
  }) async {
    await client.rpc('update_asset_admin', params: {
      'p_asset_id': assetId,
      'p_asset_code': assetCode.trim(),
      'p_serial_number': _nullable(serialNumber),
      'p_team_id': teamId,
      'p_status': status,
      'p_notes': _nullable(notes),
      'p_active': true,
    });
    await refreshDashboard();
  }

  Future<void> deactivateEquipmentAsset(String assetId) async {
    await client.rpc('deactivate_asset_admin', params: {'p_asset_id': assetId});
    await refreshDashboard();
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
      'p_description': _nullable(description),
      'p_category': _nullable(category),
      'p_unit': unit.trim().isEmpty ? 'un' : unit.trim(),
      'p_minimum_stock': 0,
      'p_active': true,
    });
    await refreshDashboard();
  }

  Future<void> deactivateMaterialItem(String itemId) async {
    await client.rpc('deactivate_item_admin', params: {'p_item_id': itemId});
    await refreshDashboard();
  }

  Future<void> createTeam(String name, String? description) async {
    await client.rpc('create_team_admin', params: {
      'p_name': name.trim(),
      'p_description': _nullable(description),
      'p_location_type': 'field',
    });
    await refreshDashboard();
  }

  Future<void> updateTeam(String id, String name, String? description) async {
    await client.rpc('update_team_admin', params: {
      'p_team_id': id,
      'p_name': name.trim(),
      'p_description': _nullable(description),
    });
    await refreshDashboard();
  }

  Future<void> deleteTeam(String id) async {
    await client.rpc('delete_team_admin', params: {'p_team_id': id});
    await refreshDashboard();
  }

  Future<void> createEmployee({
    required String fullName,
    required String email,
    required String password,
    required String role,
    required String teamId,
  }) async {
    final response = await client.functions.invoke(
      'create-employee',
      body: {
        'full_name': fullName.trim(),
        'email': email.trim(),
        'password': password,
        'role': role,
        'team_id': teamId,
      },
    );
    final data = response.data;
    if (response.status < 200 || response.status >= 300) {
      throw Exception(data is Map ? (data['error'] ?? 'Falha ao criar funcionário') : 'Falha ao criar funcionário');
    }
    if (data is Map && data['ok'] != true) {
      throw Exception(data['error'] ?? 'Falha ao criar funcionário');
    }
  }

  Future<void> updateProfileAdmin({
    required String userId,
    required String fullName,
    required String role,
    required String? teamId,
    required bool active,
  }) async {
    await client.rpc('admin_update_profile', params: {
      'p_user_id': userId,
      'p_full_name': fullName.trim(),
      'p_role': role,
      'p_team_id': teamId,
      'p_active': active,
    });
  }

  Future<void> deleteEmployee(String userId) async {
    final response = await client.functions.invoke(
      'delete-employee',
      body: {'user_id': userId},
    );
    final data = response.data;
    if (response.status < 200 || response.status >= 300) {
      throw Exception(data is Map ? (data['error'] ?? 'Falha ao excluir usuário') : 'Falha ao excluir usuário');
    }
    if (data is Map && data['ok'] != true) {
      throw Exception(data['error'] ?? 'Falha ao excluir usuário');
    }
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
    await refreshDashboard();
  }

  Future<void> createEquipment({
    required String code,
    required String name,
    required String assetCode,
    required String teamId,
    String? serialNumber,
  }) async {
    await client.rpc('create_equipment_for_team', params: {
      'p_code': code.trim(),
      'p_name': name.trim(),
      'p_asset_code': assetCode.trim(),
      'p_serial_number': _nullable(serialNumber),
      'p_description': null,
      'p_category': null,
      'p_team_id': teamId,
      'p_notes': null,
    });
    await refreshDashboard();
  }

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
      'p_note': _nullable(note) ?? 'Consumo pelo aplicativo',
    });
    await refreshDashboard();
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
      'p_note': _nullable(note) ?? 'Reposição da Central pelo aplicativo',
    });
    await refreshDashboard();
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
    await refreshDashboard();
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
      'p_note': _nullable(note) ?? 'Equipamento enviado para manutenção',
    });
    await refreshDashboard();
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
      'p_note': _nullable(note) ?? 'Retorno da manutenção',
    });
    await refreshDashboard();
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
      final ad = DateTime.tryParse(a['created_at']?.toString() ?? '') ?? DateTime(1970);
      final bd = DateTime.tryParse(b['created_at']?.toString() ?? '') ?? DateTime(1970);
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
      'p_note': _nullable(note),
    });
    await refreshDashboard();
  }

  Future<void> deleteMaterialHistory(String id) async {
    await client.rpc('admin_delete_material_movement', params: {
      'p_movement_id': id,
    });
    await refreshDashboard();
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
      'p_note': _nullable(note),
    });
    await refreshDashboard();
  }

  Future<void> deleteAssetHistory(String id) async {
    await client.rpc('admin_delete_asset_movement', params: {
      'p_movement_id': id,
    });
    await refreshDashboard();
  }

  Future<void> dispose() async {
    _debounce?.cancel();
    await _channel?.unsubscribe();
    await _dashboardController.close();
  }

  String? _nullable(String? value) {
    final v = value?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }
}
