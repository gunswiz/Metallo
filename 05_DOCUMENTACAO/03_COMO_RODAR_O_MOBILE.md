# Como rodar o Mobile

Abra a pasta `C:\Projetos\Metallo\02_MOBILE` no editor. Flutter e Android SDK precisam estar instalados.

```powershell
cd C:\Projetos\Metallo\02_MOBILE
flutter pub get
flutter analyze --no-fatal-infos
flutter test
flutter run
```

O último comando exige um celular ou emulador conectado. Para gerar um APK local de desenvolvimento:

```powershell
flutter build apk --debug
```

O arquivo fica em `02_MOBILE/build/app/outputs/flutter-apk/app-debug.apk`. O aplicativo de desenvolvimento já usa um identificador diferente do oficial. Esta reorganização não altera a assinatura nem o mecanismo de atualização do aplicativo oficial. As configurações de versão, dependências e imagens estão em `pubspec.yaml`; configurações do serviço ficam em `lib/10_CONFIGURACOES/config.dart`.
