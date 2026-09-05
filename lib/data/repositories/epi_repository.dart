import 'package:supabase_flutter/supabase_flutter.dart';

import 'dashboard_repository.dart';
import 'repository_utils.dart';

class EpiRepository {
  EpiRepository(this.client, this.dashboardRepository);
  final SupabaseClient client;
  final DashboardRepository dashboardRepository;

  Future<List<Map<String, dynamic>>> fetchEpiEmployees() async {
    try {
      final rows = await client
          .from('epi_employees')
          .select(
              'id,full_name,registration_code,profession,team_id,shirt_size,pants_size,shoe_size,aso_exam_date,aso_expiry_date,active,created_at,teams(name)')
          .eq('active', true)
          .order('full_name');
      return (rows as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } on PostgrestException catch (e) {
      if (e.code != 'PGRST205' && !e.message.contains('epi_employees')) rethrow;
      final dashboard = await dashboardRepository.fetchDashboard();
      final field = dashboard.teams.where((t) => !t.isCentral).toList();
      Map<String, dynamic> preview(String id, String name, String profession,
          int teamIndex, String shirt, String pants, String shoe) {
        final team = field.isEmpty
            ? dashboard.teams.first
            : field[teamIndex % field.length];
        return {
          'id': id,
          'full_name': name,
          'registration_code': 'DEMO-$id',
          'profession': profession,
          'team_id': team.id,
          'shirt_size': shirt,
          'pants_size': pants,
          'shoe_size': shoe,
          'active': true,
          'teams': {'name': team.name},
          '_preview': true
        };
      }

      return [
        preview('001', 'João Silva', 'Soldador', 0, 'G', '42', '41'),
        preview(
            '002', 'Carlos Santos', 'Montador industrial', 0, 'M', '40', '40'),
        preview('003', 'Marcos Oliveira', 'Soldador', 1, 'GG', '44', '42'),
        preview('004', 'Paulo Souza', 'Ajudante', 2, 'M', '40', '39'),
      ];
    }
  }

  Future<List<Map<String, dynamic>>> fetchEpiItems() async {
    final rows = await client
        .from('epi_items')
        .select(
            'id,code,system_key,name,item_kind,unit,ca_number,brand_model,minimum_stock,replacement_days,active,created_at')
        .eq('active', true)
        .order('name');
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchEpiStock() async {
    final rows = await client
        .from('epi_stock_batches')
        .select(
            'id,item_id,quantity,variant,ca_number,brand_model,lot_number,expires_on,received_at,epi_items(code,system_key,name,item_kind,unit)')
        .order('received_at', ascending: false);
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchEpiDeliveries() async {
    final rows = await client
        .from('epi_deliveries')
        .select(
            'id,employee_id,team_id,item_id,stock_batch_id,delivery_group_id,quantity,delivered_at,delivery_reason,current_status,variant_snapshot,ca_snapshot,brand_model_snapshot,lot_snapshot,note,epi_employees(full_name,profession),epi_items(code,system_key,name,item_kind,unit),teams(name)')
        .order('delivered_at', ascending: false);
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchEpiRequests() async {
    final rows = await client
        .from('epi_requests')
        .select(
            'id,employee_id,team_id,item_id,quantity,requested_variant,status,created_at,fulfilled_at,epi_employees(full_name,profession,shoe_size),epi_items(code,system_key,name,item_kind,unit,ca_number),teams(name)')
        .order('created_at', ascending: false);
    return (rows as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<void> requestEpiItem({
    required String employeeId,
    required String itemId,
    required int quantity,
    String? requestedVariant,
  }) async {
    await client.rpc('request_epi_item', params: {
      'p_employee_id': employeeId,
      'p_item_id': itemId,
      'p_quantity': quantity,
      'p_requested_variant': nullableText(requestedVariant),
    });
  }

  Future<void> fulfillEpiRequest(String requestId, String stockBatchId) async {
    await client.rpc('fulfill_epi_request', params: {
      'p_request_id': requestId,
      'p_stock_batch_id': stockBatchId,
    });
  }

  Future<void> createEpiEmployee({
    required String fullName,
    required String profession,
    required String teamId,
    String? registrationCode,
    String? shirtSize,
    String? pantsSize,
    String? shoeSize,
  }) async {
    await client.from('epi_employees').insert({
      'full_name': fullName.trim(),
      'profession': profession.trim(),
      'team_id': teamId,
      'registration_code': nullableText(registrationCode),
      'shirt_size': nullableText(shirtSize),
      'pants_size': nullableText(pantsSize),
      'shoe_size': nullableText(shoeSize),
    });
  }

  Future<void> updateEpiEmployee({
    required String id,
    required String fullName,
    required String profession,
    required String teamId,
    String? registrationCode,
    String? shirtSize,
    String? pantsSize,
    String? shoeSize,
  }) async {
    await client.from('epi_employees').update({
      'full_name': fullName.trim(),
      'profession': profession.trim(),
      'team_id': teamId,
      'registration_code': nullableText(registrationCode),
      'shirt_size': nullableText(shirtSize),
      'pants_size': nullableText(pantsSize),
      'shoe_size': nullableText(shoeSize),
    }).eq('id', id);
  }

  Future<void> renewEmployeeAso(
      String employeeId, DateTime examDate, DateTime expiryDate) async {
    await client
        .from('epi_employees')
        .update({
          'aso_exam_date': examDate.toIso8601String().substring(0, 10),
          'aso_expiry_date': expiryDate.toIso8601String().substring(0, 10),
        })
        .eq('id', employeeId)
        .select('id')
        .single();
  }

  Future<Map<String, dynamic>> fetchEpiEmployeeItemSet(
      String employeeId) async {
    final sets = await client
        .from('epi_employee_item_sets')
        .select('employee_id')
        .eq('employee_id', employeeId);
    final rows = await client
        .from('epi_employee_items')
        .select('employee_id,item_id,required_quantity')
        .eq('employee_id', employeeId);
    return {
      'configured': (sets as List).isNotEmpty,
      'rows': (rows as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
    };
  }

  Future<void> setEpiEmployeeItems(
      String employeeId, List<Map<String, dynamic>> lines) async {
    await client.rpc('set_epi_employee_items', params: {
      'p_employee_id': employeeId,
      'p_lines': lines,
    });
  }

  Future<void> createEpiItem({
    required String code,
    required String name,
    required String kind,
    required String unit,
    String? caNumber,
    String? brandModel,
    int minimumStock = 0,
    int? replacementDays,
  }) async {
    await client.from('epi_items').insert({
      'code': code.trim(),
      'name': name.trim(),
      'item_kind': kind,
      'unit': unit.trim().isEmpty ? 'un' : unit.trim(),
      'ca_number': nullableText(caNumber),
      'brand_model': nullableText(brandModel),
      'minimum_stock': minimumStock,
      'replacement_days': replacementDays,
    });
  }

  Future<void> updateEpiItem({
    required String id,
    required String code,
    required String name,
    required String kind,
    required String unit,
    String? caNumber,
    String? brandModel,
    int minimumStock = 0,
    int? replacementDays,
  }) async {
    await client.from('epi_items').update({
      'code': code.trim(),
      'name': name.trim(),
      'item_kind': kind,
      'unit': unit.trim().isEmpty ? 'un' : unit.trim(),
      'ca_number': kind == 'epi' ? nullableText(caNumber) : null,
      'brand_model': nullableText(brandModel),
      'minimum_stock': minimumStock,
      'replacement_days': replacementDays,
    }).eq('id', id);
  }

  Future<void> deactivateEpiItem(String id) async {
    await client.from('epi_items').update({'active': false}).eq('id', id);
  }

  Future<void> addEpiStock({
    required String itemId,
    required int quantity,
    String? caNumber,
    String? brandModel,
    String? lotNumber,
    String? variant,
  }) async {
    await client.from('epi_stock_batches').insert({
      'item_id': itemId,
      'quantity': quantity,
      'ca_number': nullableText(caNumber),
      'brand_model': nullableText(brandModel),
      'lot_number': nullableText(lotNumber),
      'variant': nullableText(variant),
    });
  }

  Future<void> registerEpiDelivery({
    required String employeeId,
    required String itemId,
    required String stockBatchId,
    required int quantity,
    String reason = 'initial',
    String? note,
  }) async {
    await client.rpc('register_epi_delivery', params: {
      'p_employee_id': employeeId,
      'p_item_id': itemId,
      'p_stock_batch_id': stockBatchId,
      'p_quantity': quantity,
      'p_delivery_reason': reason,
      'p_note': nullableText(note),
    });
  }

  Future<void> registerEpiDeliveryBatch({
    required String employeeId,
    required List<Map<String, dynamic>> lines,
    String reason = 'initial',
    String? note,
  }) async {
    await client.rpc('register_epi_delivery_batch', params: {
      'p_employee_id': employeeId,
      'p_lines': lines,
      'p_delivery_reason': reason,
      'p_note': nullableText(note),
    });
  }

  Future<void> closeEpiDelivery(String id, String status) async {
    await client.from('epi_deliveries').update({
      'current_status': status,
      'closed_at': DateTime.now().toUtc().toIso8601String(),
      'closed_by': client.auth.currentUser?.id,
    }).eq('id', id);
  }
}
