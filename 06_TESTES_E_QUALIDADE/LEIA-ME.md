# Testes e qualidade

Os testes do site estão em `01_WEB/10_TESTES`. Os testes do aplicativo estão em `02_MOBILE/test`, onde o Flutter os encontra automaticamente.

- Na raiz: `pnpm check:web`.
- Em `02_MOBILE`: `flutter analyze --no-fatal-infos`, `flutter test` e `flutter build apk --debug`.

O relatório de validação desta organização fica em `RELATORIO_DA_REORGANIZACAO.md`. As configurações de lint e testes ficam nas raízes das aplicações para preservar a descoberta pelas ferramentas.
