import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/06_ACESSO_A_DADOS/dashboard_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/epi_repository.dart';
import 'package:metallo/01_TELAS/04_EPIS_E_FUNCIONARIOS/reports_page.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient _testClient() => SupabaseClient(
      'https://example.invalid',
      'test',
      authOptions: const AuthClientOptions(autoRefreshToken: false),
    );

class _FakeEpiRepository extends EpiRepository {
  _FakeEpiRepository(super.client, super.dashboardRepository);

  String? closedId;
  String? closedStatus;
  int? closedQuantity;

  @override
  Future<List<Map<String, dynamic>>> fetchEpiDeliveries() async => [
        {
          'id': 'delivery-1',
          'delivery_group_id': 'group-1',
          'quantity': 2,
          'current_status': 'active',
          'delivered_at': '2026-09-07T09:00:00Z',
          'epi_employees': {'full_name': 'Funcionário de teste'},
          'teams': {'name': 'Equipe de teste'},
          'epi_items': {
            'name': 'Conjunto de farda cinza',
            'item_kind': 'uniform',
            'unit': 'conjunto',
          },
        },
      ];

  @override
  Future<void> closeEpiDelivery(String id, String status,
      {int quantity = 1}) async {
    closedId = id;
    closedStatus = status;
    closedQuantity = quantity;
  }
}

void main() {
  testWidgets('relatório permite encerrar uma unidade de duas no mobile',
      (tester) async {
    final client = _testClient();
    final dashboard = DashboardRepository(client);
    addTearDown(dashboard.dispose);
    final repository = _FakeEpiRepository(client, dashboard);

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData.dark(),
      home: Scaffold(body: ReportsPage(repo: repository)),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Conjunto de farda cinza'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Conjunto de farda cinza').last);
    await tester.pumpAndSettle();

    expect(find.text('Quantidade a atualizar'), findsOneWidget);
    expect(find.text('1 de 2 conjunto'), findsOneWidget);

    await tester.tap(find.text('Danificado'));
    await tester.pumpAndSettle();

    expect(repository.closedId, 'delivery-1');
    expect(repository.closedStatus, 'damaged');
    expect(repository.closedQuantity, 1);
  });
}
