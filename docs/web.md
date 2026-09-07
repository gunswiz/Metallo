# Portal Web

## Configuração local

1. Instale Node.js 24 e pnpm 11.
2. Execute `pnpm install --frozen-lockfile` na raiz.
3. Copie `apps/web/.env.example` para `apps/web/.env.local`.
4. Informe `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Execute `pnpm dev:web` e abra `http://localhost:3000`.

`.env.local` é ignorado pelo Git. A chave publicável é adequada ao navegador;
segredos administrativos e `service_role` não são aceitos nessa aplicação.

## Verificações

```powershell
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

O workflow `web.yml` repete essas verificações quando arquivos do portal,
pacotes compartilhados ou migrações são alterados.

## Navegação e responsabilidades

O menu principal não repete os módulos internos do Almoxarifado. A área
`Consumo` oferece gráficos operacionais; `Relatórios` mantém consulta detalhada
e histórica. Cadastro de EPI, entrada de estoque e entrega são fluxos separados.
Consulte [web-mobile-parity.md](web-mobile-parity.md) para a matriz completa.

## Publicação

O portal é publicado como um Cloudflare Worker usando Vinext. Consulte
[cloudflare.md](cloudflare.md) para ambiente, deploy, CI/CD, logs e rollback.
