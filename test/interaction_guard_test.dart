import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/epi_module.dart';
import 'package:metallo/shared/widgets/guided_practice_card.dart';
import 'package:metallo/main.dart';
import 'package:metallo/repository.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

ThemeData appTheme() => ThemeData.dark().copyWith(
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
      ),
    );

class _FakeRepository extends MetalloRepository {
  _FakeRepository()
      : super(SupabaseClient('https://example.invalid', 'test',
            authOptions: const AuthClientOptions(autoRefreshToken: false)));
  int stockLoads = 0;
  int deliveries = 0;
  int catalogLoads = 0;
  int transfers = 0;
  final stock = Completer<List<Map<String, dynamic>>>();
  final saved = Completer<void>();
  final catalog = Completer<List<Map<String, dynamic>>>();

  @override
  Future<List<Map<String, dynamic>>> fetchEpiEmployees() async => [
        {
          'id': 'person',
          'full_name': 'Funcionário de teste',
          'profession': 'Soldador',
          'active': true,
          'team_id': 'team'
        },
      ];

  @override
  Future<List<Map<String, dynamic>>> fetchEpiStock() {
    stockLoads++;
    return stock.future;
  }

  @override
  Future<List<Map<String, dynamic>>> fetchEpiItems() async => [];
  @override
  Future<List<Map<String, dynamic>>> fetchEpiDeliveries() async => [];
  @override
  Future<List<Map<String, dynamic>>> fetchEpiRequests() async => [];

  @override
  Future<void> registerEpiDeliveryBatch(
      {required String employeeId,
      required List<Map<String, dynamic>> lines,
      String reason = 'initial',
      String? note}) {
    deliveries++;
    return saved.future;
  }

  @override
  Future<List<Map<String, dynamic>>> fetchMaterialCatalog() {
    catalogLoads++;
    return catalog.future;
  }

  @override
  Future<void> transferEquipment(
      {required String assetId, required String toTeamId}) {
    transfers++;
    return saved.future;
  }
}

void main() {
  WidgetController.hitTestWarningShouldBeFatal = true;
  for (final scale in [1.0, 1.5, 2.0]) {
    testWidgets('guia mantém Avançar/Anterior e conclusão com fonte $scale',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(320, 720));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      var closed = false;
      await tester.pumpWidget(MaterialApp(
        theme: appTheme(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: Scaffold(
            body: Align(
          alignment: Alignment.topCenter,
          child: SizedBox(
            width: 296,
            height: 432,
            child: GuidedPracticeCard(
              initialStep: 1,
              steps: const [
                'Abra Início.',
                'Toque na equipe desejada.',
                'Consulte os itens distribuídos.'
              ],
              onClose: () => closed = true,
            ),
          ),
        )),
      ));
      expect(tester.takeException(), isNull);
      expect(find.text('Anterior').hitTestable(), findsOneWidget);
      expect(find.text('Avançar').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Avançar'));
      await tester.pump();
      expect(find.text('Concluir guia').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Anterior'));
      await tester.pump();
      expect(find.text('Avançar').hitTestable(), findsOneWidget);
      await tester.tap(find.byTooltip('Recolher orientação'));
      await tester.pump();
      expect(find.text('Avançar'), findsNothing);
      await tester.tap(find.byTooltip('Mostrar orientação'));
      await tester.pump();
      expect(find.text('Avançar').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Avançar'));
      await tester.pump();
      await tester.tap(find.text('Concluir guia'));
      expect(closed, isTrue);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('lock bloqueia antes do await e libera após erro/cancelamento',
      (tester) async {
    late BuildContext context;
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) {
      context = c;
      return const SizedBox();
    })));
    final first = UiActionLock.acquire(context, 'operation')!;
    expect(UiActionLock.acquire(context, 'operation'), isNull);
    final other = UiActionLock.acquire(context, 'other')!;
    other.release();
    first.release();
    final second = UiActionLock.acquire(context, 'operation')!;
    first.release(); // An old release must not unlock a newer operation.
    expect(UiActionLock.acquire(context, 'operation'), isNull);
    second.release();
    final last = UiActionLock.acquire(context, 'operation')!;
    try {
      throw StateError('failure');
    } catch (_) {
      last.release();
    }
    UiActionLock.acquire(context, 'operation')!.release();
  });

  testWidgets('Entrega não empilha telas nem envia duas vezes com rede lenta',
      (tester) async {
    final repo = _FakeRepository();
    addTearDown(repo.dispose);
    await tester.pumpWidget(MaterialApp(
        theme: appTheme(),
        home: EpiManagementShell(repo: repo, teams: const [], role: 'admin')));
    await tester.pumpAndSettle();
    for (var i = 0; i < 10; i++) {
      await tester.tap(find.text('Entrega'));
    }
    await tester.pump();
    expect(repo.stockLoads, 1);
    repo.stock.complete([
      {
        'id': 'batch',
        'item_id': 'item',
        'quantity': 5,
        'epi_items': {
          'name': 'Capacete',
          'code': 'EPI-CAP',
          'item_kind': 'epi',
          'unit': 'un'
        },
      }
    ]);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Nova entrega'), findsOneWidget);
    await tester.ensureVisible(find.byIcon(Icons.add).last);
    await tester.pump();
    await tester.tap(find.byIcon(Icons.add).last);
    await tester.pump();
    await tester.ensureVisible(find.text('Confirmar entrega'));
    await tester.pump();
    await tester.tap(find.text('Confirmar entrega'));
    await tester.tap(find.text('Confirmar entrega'));
    await tester.pump();
    expect(repo.deliveries, 1);
    expect(find.text('Registrando...'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Nova entrega'), findsOneWidget);
    repo.saved.complete();
    await tester.pumpAndSettle();
    expect(find.text('Nova entrega'), findsNothing);
    await tester.tap(find.text('Entrega'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Nova entrega'), findsOneWidget);
    await tester.ensureVisible(find.text('Cancelar'));
    await tester.pump();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('equipamento ignora seleção e confirmação repetidas',
      (tester) async {
    final repo = _FakeRepository();
    addTearDown(repo.dispose);
    const equipment = EquipmentAsset(
        id: 'asset',
        itemId: 'item',
        teamId: 'team',
        code: 'TEST',
        name: 'Equipamento de teste',
        assetCode: 'TEST-001',
        status: 'available');
    await tester.pumpWidget(MaterialApp(
      theme: appTheme(),
      home: Builder(
          builder: (context) => Scaffold(
                  body: TextButton(
                onPressed: () => showEquipmentActionsSheet(
                    context,
                    repo,
                    const [
                      Team(id: 'team', name: 'Origem', locationType: 'team'),
                      Team(id: 'other', name: 'Destino', locationType: 'team'),
                    ],
                    equipment,
                    role: 'admin',
                    userTeamId: null),
                child: const Text('Abrir equipamento'),
              ))),
    ));
    final open = tester
        .widget<TextButton>(
            find.widgetWithText(TextButton, 'Abrir equipamento'))
        .onPressed!;
    for (var i = 0; i < 10; i++) {
      open(); // Simulate callbacks already queued when the screen freezes.
    }
    await tester.pumpAndSettle();
    expect(find.text('Transferir equipamento'), findsOneWidget);
    final action = tester
        .widget<ListTile>(
            find.widgetWithText(ListTile, 'Transferir equipamento'))
        .onTap!;
    action();
    action(); // Two already-queued callbacks must not pop the parent route.
    await tester.pumpAndSettle();
    expect(find.text('Transferir Equipamento de teste'), findsOneWidget);
    await tester.tap(find.text('Transferir'));
    await tester.tap(find.text('Transferir'));
    await tester.pump();
    expect(repo.transfers, 1);
    repo.saved.complete();
    await tester.pumpAndSettle();
    expect(find.text('Abrir equipamento').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('entrada de material faz uma busca e abre um único diálogo',
      (tester) async {
    final repo = _FakeRepository();
    addTearDown(repo.dispose);
    await tester.pumpWidget(MaterialApp(
        theme: appTheme(),
        home: Builder(
            builder: (context) => Scaffold(
                    body: TextButton(
                  onPressed: () => showMaterialDialog(
                      context,
                      repo,
                      const [
                        Team(id: 'team', name: 'COSEM', locationType: 'central')
                      ],
                      'team'),
                  child: const Text('Abrir material'),
                )))));
    for (var i = 0; i < 10; i++) {
      await tester.tap(find.text('Abrir material'));
    }
    expect(repo.catalogLoads, 1);
    repo.catalog.complete([]);
    await tester.pumpAndSettle();
    expect(find.text('Entrada de material'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abrir material'));
    await tester.pumpAndSettle();
    expect(repo.catalogLoads, 2);
    expect(find.text('Entrada de material'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
