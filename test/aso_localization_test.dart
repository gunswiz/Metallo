import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/features/epi/aso_date_picker.dart';

void main() {
  testWidgets('calendário do ASO usa textos em português do Brasil',
      (tester) async {
    final initialDate = DateTime(2026, 9, 5);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('pt', 'BR'),
        supportedLocales: const [Locale('pt', 'BR')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => showAsoDatePicker(
              context,
              helpText: 'Data do exame ASO',
              initialDate: initialDate,
              firstDate: DateTime(2000),
              lastDate: initialDate,
            ),
            child: const Text('Abrir calendário'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Abrir calendário'));
    await tester.pumpAndSettle();

    expect(find.text('Data do exame ASO'), findsOneWidget);
    expect(find.text('setembro de 2026'), findsOneWidget);
    expect(find.text('Cancelar'), findsOneWidget);
    expect(find.text('OK'), findsOneWidget);
  });
}
