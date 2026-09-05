import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/features/auth/profile_gate.dart';
import 'package:metallo/features/consumption/calculations.dart';
import 'package:metallo/features/epi/epi_catalog.dart';
import 'package:metallo/features/epi/epi_view_data.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient _testClient() => SupabaseClient(
      'https://example.invalid',
      'test',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );

class _PendingAdminRepository extends AdminRepository {
  _PendingAdminRepository(super.client, super.dashboardRepository);

  @override
  Stream<Map<String, dynamic>?> watchCurrentProfile() => Stream.value(null);
}

void main() {
  test('consumo nunca soma unidades diferentes no mesmo indicador', () {
    final rows = <Map<String, dynamic>>[
      {
        'quantity': 16,
        'items': {'unit': 'un'}
      },
      {
        'quantity': 2,
        'items': {'unit': 'caixa'}
      },
    ];

    expect(consumptionUnits(rows), ['caixa', 'un']);
    final units = filterConsumptionUnit(rows, 'un');
    expect(sumConsumption(units), 16);
    expect(hasMixedConsumptionUnits(units), 'un');
  });

  test('busca de funcionário inclui profissão, matrícula e equipe', () {
    final employees = <Map<String, dynamic>>[
      {
        'active': true,
        'full_name': 'Wellington Silva',
        'profession': 'Operador de Munck',
        'registration_code': 'MAT-42',
        'teams': {'name': 'Equipe São José'},
      },
    ];

    expect(filterActiveEpiEmployees(employees, 'munck'), hasLength(1));
    expect(filterActiveEpiEmployees(employees, 'mat-42'), hasLength(1));
    expect(filterActiveEpiEmployees(employees, 'sao jose'), hasLength(1));
  });

  test('tipo interno de EPI não muda quando código visível é editado', () {
    final boot = {'code': 'CODIGO-NOVO', 'system_key': 'EPI-BOT'};
    final glasses = {'code': 'OCULOS-2026', 'system_key': 'EPI-OCU'};

    expect(isBootEpiItem(boot), isTrue);
    expect(isGlassesEpiItem(glasses), isTrue);
    expect(validEmployeeShoeSize({'shoe_size': '38'}), '38');
    expect(validEmployeeShoeSize({'shoe_size': '46'}), '46');
    expect(validEmployeeShoeSize({'shoe_size': '37'}), isNull);
    expect(validEmployeeShoeSize({'shoe_size': '47'}), isNull);
  });

  test('histórico preserva mais de cem registros e mantém ordem', () {
    final material = List<dynamic>.generate(
      120,
      (index) => {
        'id': 'm$index',
        'created_at': DateTime(2026, 1, 1)
            .add(Duration(minutes: index))
            .toIso8601String(),
      },
    );
    final assets = List<dynamic>.generate(
      40,
      (index) => {
        'id': 'a$index',
        'created_at': DateTime(2026, 2, 1)
            .add(Duration(minutes: index))
            .toIso8601String(),
      },
    );

    final merged = mergeHistoryRows(material, assets);
    expect(merged, hasLength(160));
    expect(merged.first['id'], 'a39');
    expect(merged.last['id'], 'm0');
  });

  testWidgets('perfil ausente conclui em acesso pendente, não em spinner',
      (tester) async {
    final client = _testClient();
    final dashboard = DashboardRepository(client);
    addTearDown(dashboard.dispose);
    final admin = _PendingAdminRepository(client, dashboard);

    await tester.pumpWidget(MaterialApp(
      home: ProfileGate(
        authRepository: AuthRepository(client),
        dashboardRepository: dashboard,
        catalogRepository: CatalogRepository(client, dashboard),
        epiRepository: EpiRepository(client, dashboard),
        adminRepository: admin,
        movementRepository: MovementRepository(client, dashboard),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Acesso aguardando liberação'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  test('migração contém as proteções funcionais confirmadas', () {
    final sql = File(
      'supabase/migrations/20260905185609_fix_confirmed_functional_bugs.sql',
    ).readAsStringSync();

    expect(sql, contains("raise exception 'last_admin_required'"));
    expect(sql, contains("raise exception 'central_team_required'"));
    expect(sql, contains('team_has_epi_employees'));
    expect(sql, contains('id = (select auth.uid())'));
    expect(sql, contains('alter publication supabase_realtime add table'));
    expect(sql, contains('e.team_id = epi_requests.team_id'));
    expect(sql, isNot(contains('e.team_id = e.team_id')));
    expect(sql, contains('function public.request_epi_item'));
    expect(sql, contains('function public.update_equipment_admin'));
    expect(sql, contains('system_key'));
  });
}
