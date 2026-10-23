import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/01_TELAS/02_INICIO/team_overview_section.dart';
import 'package:metallo/07_TIPOS_E_MODELOS/team.dart';
import 'package:metallo/08_ESTILOS/theme.dart';

void main() {
  final teams = [
    for (var i = 1; i <= 8; i++) Team(id: '$i', name: 'Equipe $i'),
    const Team(id: 'central', name: 'Almoxarifado', locationType: 'central'),
    const Team(
        id: 'minha', name: 'Equipe São José', worksiteName: 'Galpão Plastamp'),
  ];
  Widget app({List<Team>? lista}) => MaterialApp(
      theme: metalloTheme(),
      home: Scaffold(
          body: SingleChildScrollView(
              child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: TeamOverviewSection(
                      teams: lista ?? teams,
                      userTeamId: 'minha',
                      itemBuilder: (team) => ListTile(
                          key: ValueKey(team.id),
                          title: Text(team.name),
                          onTap: () {}))))));

  testWidgets(
      'início mostra três equipes, prioriza a própria e permite ver as demais',
      (tester) async {
    await tester.pumpWidget(app());
    expect(find.byType(ListTile), findsNWidgets(3));
    final tiles = tester.widgetList<ListTile>(find.byType(ListTile)).toList();
    expect(tiles[0].key, const ValueKey('minha'));
    expect(tiles[1].key, const ValueKey('central'));
    await tester.tap(find.text('Ver mais equipes (7)'));
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsNWidgets(9));
    await tester.ensureVisible(find.text('Ver mais equipes (1)'));
    await tester.tap(find.text('Ver mais equipes (1)'));
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsNWidgets(10));
    await tester.ensureVisible(find.text('Mostrar menos'));
    await tester.tap(find.text('Mostrar menos'));
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsNWidgets(3));
    expect(teams.first.id, '1');
  });

  testWidgets(
      'busca encontra equipe fora do resumo, sem acento ou pelo nome da obra',
      (tester) async {
    await tester.pumpWidget(app());
    await tester.enterText(find.byType(TextField), 'Equipe 8');
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsOneWidget);
    expect(find.descendant(of: find.byType(ListTile), matching: find.text('Equipe 8')), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'sao jose');
    await tester.pumpAndSettle();
    expect(find.text('Equipe São José'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'plastamp');
    await tester.pumpAndSettle();
    expect(find.text('Equipe São José'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'não existe');
    await tester.pumpAndSettle();
    expect(find.text('Nenhuma equipe encontrada. Tente outro nome.'),
        findsOneWidget);
    await tester.tap(find.byTooltip('Limpar busca'));
    await tester.pumpAndSettle();
    expect(find.byType(ListTile), findsNWidgets(3));
  });

  testWidgets('resumo continua utilizável em 320px com texto ampliado',
      (tester) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.5;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(app());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(ListTile), findsNWidgets(3));
  });

  testWidgets('não mostra busca nem expansão sem equipes', (tester) async {
    await tester.pumpWidget(app(lista: []));
    expect(find.text('Nenhuma equipe cadastrada.'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(find.byType(OutlinedButton), findsNothing);
  });
}
