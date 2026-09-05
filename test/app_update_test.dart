import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/core/app_update.dart';

void main() {
  String manifest(String url, {Object build = 44, Object version = '0.9.3'}) =>
      jsonEncode({'version': version, 'build': build, 'apk_url': url});
  const valid =
      'https://github.com/gunswiz/Metallo/releases/download/v0.9.3/Metallo.apk';

  test('accepts a newer official Metallo release only', () {
    expect(AppUpdateService.parseManifest(manifest(valid), 43)?.build, 44);
    expect(AppUpdateService.parseManifest(manifest(valid), 44), isNull);
    expect(AppUpdateService.parseManifest(manifest(valid), 45), isNull);
    expect(AppUpdateService.parseManifest(manifest(valid, build: '44'), 43),
        isNull);
    expect(
        AppUpdateService.parseManifest(
            manifest(valid, version: '<script>'), 43),
        isNull);
    expect(AppUpdateService.parseManifest('[]', 43), isNull);
  });
  test('rejects external, insecure and ambiguous update destinations', () {
    for (final url in [
      'http://github.com/gunswiz/Metallo/releases/download/v0.9.3/Metallo.apk',
      'intent://install',
      'file:///data/private',
      'https://github.com.evil.invalid/gunswiz/Metallo/releases/download/v0.9.3/Metallo.apk',
      'https://github.com/other/Metallo/releases/download/v0.9.3/Metallo.apk',
      'https://evil.invalid@gitHub.com/gunswiz/Metallo/releases/download/v0.9.3/Metallo.apk',
      '$valid?redirect=elsewhere',
      '$valid#fragment',
      'https://github.com:444/gunswiz/Metallo/releases/download/v0.9.3/Metallo.apk',
      'https://github.com/gunswiz/Metallo/releases/download/v0.9.3/Other.apk',
    ]) {
      expect(AppUpdateService.parseManifest(manifest(url), 43), isNull,
          reason: url);
    }
  });

  testWidgets('falha de rede não é informada como versão atualizada',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => AppUpdateService.showIfAvailable(
              context,
              showUpToDate: true,
              checker: () => Future<AppUpdateInfo?>.error(
                const SocketException('offline'),
              ),
            ),
            child: const Text('Verificar'),
          ),
        ),
      ),
    ));

    await tester.tap(find.text('Verificar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Não foi possível verificar'), findsOneWidget);
    expect(find.textContaining('versão mais recente'), findsNothing);
  });

  testWidgets('falha ao abrir download é exibida ao usuário', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => AppUpdateService.showIfAvailable(
              context,
              checker: () async => AppUpdateInfo(
                version: '0.9.3',
                build: 44,
                url: Uri.parse(valid),
              ),
              launcher: (_) async => false,
            ),
            child: const Text('Verificar'),
          ),
        ),
      ),
    ));

    await tester.tap(find.text('Verificar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Atualizar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Não foi possível abrir o download'),
        findsOneWidget);
  });
}
