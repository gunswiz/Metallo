import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/main.dart';

void main() {
  test('sanity', () => expect(true, isTrue));

  testWidgets('guia prático mantém o treinamento dentro do aplicativo',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: HelpGuidePage(role: 'admin'),
    ));
    await tester.tap(find.text('Primeiros passos'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -260));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Praticar com demonstração').first);
    await tester.pumpAndSettle();

    expect(find.text('Treinamento interativo'), findsOneWidget);
    expect(find.text('Etapa 1 de 3'), findsOneWidget);
    expect(find.text('Área de prática'), findsOneWidget);

    await tester.tap(find.text('Executar ação'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa 2 de 3'), findsOneWidget);
    expect(find.text('Rever etapa anterior'), findsOneWidget);
  });
}
