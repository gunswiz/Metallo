# Metallo

Plataforma de gestão operacional da Metallo. O aplicativo Flutter de campo e o
portal Web administrativo usam o mesmo projeto Supabase, as mesmas regras de
negócio e o mesmo histórico auditável.

## Estrutura

```text
apps/web/              Portal Web em Next.js
packages/core/         RBAC e regras compartilháveis
packages/types/        Tipos gerados do banco Supabase
packages/validation/   Contratos de entrada com Zod
lib/, android/, test/  Aplicativo Flutter existente
supabase/migrations/   Migrações incrementais e não destrutivas
docs/                  Arquitetura e operação do portal
```

## Portal Web

Requisitos: Node.js 24 e pnpm 11.

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
pnpm dev:web
pnpm check:web
```

Preencha `.env.local` somente com a URL e a chave **publicável** do Supabase.
Nunca use `service_role` no frontend.

## Aplicativo Flutter

Requisitos: Flutter estável e Android SDK configurado.

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
```

O antigo `metallo_source.zip` não faz parte do desenvolvimento. O projeto
Flutter permanece na raiz para preservar os fluxos de build e atualização já
usados no aplicativo instalado.

## Assinatura Android

A chave de assinatura nunca deve ser adicionada ao Git. O GitHub Actions recria
`android/app/metallo-release.jks` somente no runner, usando:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Mais detalhes em [docs/architecture.md](docs/architecture.md),
[docs/web.md](docs/web.md), [docs/database.md](docs/database.md) e
[docs/web-mobile-parity.md](docs/web-mobile-parity.md). A publicação do portal
está documentada em [docs/cloudflare.md](docs/cloudflare.md). As decisões e os testes
de segurança ficam registrados em [docs/security.md](docs/security.md).
