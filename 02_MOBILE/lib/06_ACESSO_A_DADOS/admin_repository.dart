import 'package:supabase_flutter/supabase_flutter.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

import 'dashboard_repository.dart';
import 'normalizar_texto_opcional.dart';

class AdminRepository {
  AdminRepository(this.client, this.dashboardRepository);
  final SupabaseClient client;
  final DashboardRepository dashboardRepository;

  Future<Map<String, dynamic>?> currentProfile() async {
    final uid = client.auth.currentUser?.id;
    if (uid == null) return null;
    return await client
        .from('profiles')
        .select(
            'id,full_name,role,active,team_id,operation_permissions,operation_team_ids,teams(name)')
        .eq('id', uid)
        .maybeSingle();
  }

  Stream<Map<String, dynamic>?> watchCurrentProfile() async* {
    final uid = client.auth.currentUser?.id;
    if (uid == null) {
      yield null;
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final key = 'metallo_profile_cache_$uid';
    Map<String, dynamic>? cached;
    try {
      final raw = prefs.getString(key);
      if (raw != null) {
        cached = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      }
    } catch (_) {
      cached = null;
    }
    if (cached?['id'] == uid) yield cached;
    try {
      await for (final rows
          in client.from('profiles').stream(primaryKey: ['id']).eq('id', uid)) {
        if (client.auth.currentUser?.id != uid) return;
        final profile =
            rows.isEmpty ? null : Map<String, dynamic>.from(rows.first);
        if (profile == null) {
          await prefs.remove(key);
        } else {
          await prefs.setString(key, jsonEncode(profile));
        }
        cached = profile;
        yield profile;
      }
    } catch (_) {
      if (cached == null) rethrow;
      yield cached;
    }
  }

  Future<List<Map<String, dynamic>>> fetchProfiles() async {
    final rows = await client
        .from('profiles')
        .select(
            'id,full_name,role,team_id,active,created_at,operation_permissions,operation_team_ids,teams(name)')
        .order('full_name');
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> createTeam(String name, String? description) async {
    await client.rpc('create_team_admin', params: {
      'p_name': name.trim(),
      'p_description': nullableText(description),
      'p_location_type': 'field',
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> updateTeam(String id, String name, String? description) async {
    await client.rpc('update_team_admin', params: {
      'p_team_id': id,
      'p_name': name.trim(),
      'p_description': nullableText(description),
    });
    await dashboardRepository.refreshDashboard();
  }

  Future<void> deleteTeam(String id) async {
    await client.rpc('delete_team_admin', params: {'p_team_id': id});
    await dashboardRepository.refreshDashboard();
  }

  Future<void> createEmployee({
    required String fullName,
    required String email,
    required String password,
    required String role,
    required String teamId,
    List<String>? operationPermissions,
    List<String>? operationTeamIds,
  }) async {
    final response = await client.functions.invoke(
      'create-employee',
      body: {
        'full_name': fullName.trim(),
        'email': email.trim(),
        'password': password,
        'role': role,
        'team_id': teamId,
        'operation_permissions': operationPermissions,
        'operation_team_ids': operationTeamIds,
      },
    );
    final data = response.data;
    if (response.status < 200 || response.status >= 300) {
      throw Exception(data is Map
          ? (data['error'] ?? 'Falha ao criar funcionário')
          : 'Falha ao criar funcionário');
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
    required List<String>? operationPermissions,
    required List<String>? operationTeamIds,
  }) async {
    await client.rpc('admin_update_profile_access', params: {
      'p_user_id': userId,
      'p_full_name': fullName.trim(),
      'p_role': role,
      'p_team_id': teamId,
      'p_active': active,
      'p_operation_permissions': operationPermissions,
      'p_operation_team_ids': operationTeamIds,
    });
  }

  Future<void> deleteEmployee(String userId) async {
    final response = await client.functions.invoke(
      'delete-employee',
      body: {'user_id': userId},
    );
    final data = response.data;
    if (response.status < 200 || response.status >= 300) {
      throw Exception(data is Map
          ? (data['error'] ?? 'Falha ao excluir usuário')
          : 'Falha ao excluir usuário');
    }
    if (data is Map && data['ok'] != true) {
      throw Exception(data['error'] ?? 'Falha ao excluir usuário');
    }
  }
}
