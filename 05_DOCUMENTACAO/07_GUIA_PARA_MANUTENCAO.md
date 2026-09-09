# Guia para manutenção

1. Encontre a área no [mapa](MAPA_DO_METALLO.md).
2. Confira se a mudança é no site, no aplicativo ou em ambos. Uma alteração Dart não muda automaticamente o Web.
3. Preserve uma cópia local antes de grandes alterações.
4. Ao renomear arquivos, atualize imports, testes, configurações e documentação. No Web, não renomeie pastas de rotas sem considerar a mudança de URL.
5. Rode `pnpm check:web` na raiz e `flutter analyze --no-fatal-infos` / `flutter test` em `02_MOBILE`. Gere o APK local quando alterar o Mobile.
6. Confira visualmente as telas afetadas em ambiente local apropriado.

Não edite `node_modules`, `.next`, `.dart_tool` ou `build`: são arquivos gerados. Não mova configurações só pela aparência. Os arquivos `index.ts` dos pacotes e `page.tsx` das páginas são entradas técnicas e mantiveram esses nomes.

A função de transferência continua nos repositórios e serviços existentes, e nas migrações do banco. Ela não foi artificialmente transferida para uma nova pasta de regras.

Os arquivos locais de automação em `.github/workflows` receberam apenas ajustes de caminhos. As rotinas remotas não foram executadas. Uma eventual publicação futura é uma tarefa separada.
