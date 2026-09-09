# Configurações do projeto

`tsconfig.base.json` guarda as regras gerais de checagem do código TypeScript. O Web aponta para esse arquivo.

Outras configurações ficam onde as ferramentas esperam encontrá-las:

- Raiz: `package.json` (comandos), `pnpm-workspace.yaml` (aplicações e pacotes), `pnpm-lock.yaml` (versões).
- `01_WEB`: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `vite.config.ts`, `wrangler.jsonc` e arquivos locais de ambiente.
- `02_MOBILE`: `pubspec.yaml`, `pubspec.lock`, `analysis_options.yaml` e arquivos Android.
- `.github/workflows`: arquivos de automação com caminhos ajustados localmente. Nenhuma automação foi disparada.

Os arquivos de publicação e configuração de serviços mantiveram seu conteúdo funcional. Esta tarefa não publica nada.
