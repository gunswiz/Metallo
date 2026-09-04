import 'package:supabase_flutter/supabase_flutter.dart';

import 'dashboard_repository.dart';
import 'repository_utils.dart';

class AdminRepository {
  AdminRepository(this.client, this.dashboardRepository);
  final SupabaseClient client;
  final DashboardRepository dashboardRepository;

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
      throw Exception(data is Map
          ? (data['error'] ?? 'Falha ao excluir usuário')
          : 'Falha ao excluir usuário');
    }
    if (data is Map && data['ok'] != true) {
      throw Exception(data['error'] ?? 'Falha ao excluir usuário');
    }
  }
}
