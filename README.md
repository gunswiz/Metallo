# Metallo

Aplicativo Flutter para gestão de materiais e equipamentos por equipes.

## Desenvolvimento local

Requisitos: Flutter estável e Android SDK configurado.

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
```

O código-fonte fica diretamente em `lib/`, `assets/`, `test/` e `android/`.
O antigo `metallo_source.zip` não faz mais parte do fluxo de desenvolvimento.

## Assinatura Android

A chave de assinatura nunca deve ser adicionada ao Git. O build de release no
GitHub Actions recria `android/app/metallo-release.jks` usando os secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

O workflow também confere o certificado permanente antes de publicar o APK.
