import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/dashboard_snapshot.dart';
import '../models/equipment_asset.dart';
import '../models/material_stock.dart';
import '../models/team.dart';

class DashboardRepository {
  DashboardRepository(this.client);
  final SupabaseClient client;

  final _dashboardController = StreamController<DashboardSnapshot>.broadcast();
  RealtimeChannel? _channel;
  Timer? _debounce;
  DashboardSnapshot? _cache;
  bool _realtimeStarted = false;

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
          'id,item_id,asset_code,serial_number,team_id,status,notes,items!inner(id,code,name,item_type,active)',
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
          .map(
              (e) => MaterialStock.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
      equipment: (assetsRaw as List)
          .map((e) =>
              EquipmentAsset.fromMap(Map<String, dynamic>.from(e as Map)))
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

  Future<void> dispose() async {
    _debounce?.cancel();
    await _channel?.unsubscribe();
    await _dashboardController.close();
  }
}
