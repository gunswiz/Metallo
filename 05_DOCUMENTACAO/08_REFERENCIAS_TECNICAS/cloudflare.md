# Cloudflare Workers

O Metallo Web usa Next.js 16 com App Router, Server Components, Server Actions e
autenticação Supabase por cookies. Por isso, o destino é Cloudflare Workers com
Vinext; uma exportação estática para Pages não atenderia os fluxos do sistema.

## Produção

- Worker: `metallo-web`
- URL: `https://metallo-web.metallo-gunswiz.workers.dev`
- Configuração versionada: `01_WEB/wrangler.jsonc`
- Artefatos gerados: `01_WEB/dist/` (ignorados pelo Git)

As únicas credenciais do Supabase usadas pelo portal são a URL do projeto e a
chave publicável. A chave `service_role` não deve existir no Worker, no bundle do
navegador ou no GitHub.

## Publicação manual

```powershell
pnpm --filter @metallo/web exec wrangler login
pnpm --filter @metallo/web build:vinext
pnpm --filter @metallo/web exec wrangler deploy --config dist/server/wrangler.json
```

Configure os valores do Worker sem gravá-los no repositório:

```powershell
pnpm --filter @metallo/web exec wrangler secret put NEXT_PUBLIC_SUPABASE_URL --config wrangler.jsonc
pnpm --filter @metallo/web exec wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY --config wrangler.jsonc
pnpm --filter @metallo/web exec wrangler secret put NEXT_SERVER_ACTIONS_ENCRYPTION_KEY --config wrangler.jsonc
```

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` deve ser uma chave Base64 de 32 bytes e
permanecer estável entre versões. Ela evita incompatibilidade entre instâncias
durante uma troca de versão.

## Supabase Auth

Adicione a URL pública em **Authentication > URL Configuration**:

- Site URL: `https://metallo-web.metallo-gunswiz.workers.dev`
- Redirect URL: `https://metallo-web.metallo-gunswiz.workers.dev/auth/callback`

O callback da redefinição de senha é derivado da origem HTTPS da requisição. O
domínio não fica congelado no build e continuará correto quando houver domínio
próprio.

## CI/CD pelo GitHub Actions

O workflow `.github/workflows/web.yml` valida pull requests. A publicação de um
push na `main` só é ativada depois que lint, tipos, testes e os dois builds
passam e quando a variável de repositório `CLOUDFLARE_DEPLOY_ENABLED` vale
`true`. Cadastre estes secrets no ambiente GitHub `production` antes de ativá-la:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

O token Cloudflare precisa somente de permissão para editar Workers Scripts na
conta escolhida. Não reutilize a chave administrativa do Supabase. O workflow
sincroniza os três segredos do Worker imediatamente antes de publicar a versão
que foi compilada com a mesma chave de Server Actions.

## Logs e diagnóstico

Os Workers Logs estão habilitados e os parâmetros de consulta são removidos do
registro para reduzir vazamento acidental de dados. Para acompanhar uma execução:

```powershell
pnpm --filter @metallo/web exec wrangler tail metallo-web
```

## Rollback

Liste as versões e restaure uma versão conhecida:

```powershell
pnpm --filter @metallo/web exec wrangler deployments list --name metallo-web
pnpm --filter @metallo/web exec wrangler rollback VERSION_ID --name metallo-web --yes
```

O rollback troca somente o código em execução. Os dados permanecem no Supabase e
não são apagados.
