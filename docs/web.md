# Portal Web

## Configuração local

1. Instale Node.js 24 e pnpm 11.
2. Execute `pnpm install --frozen-lockfile` na raiz.
3. Copie `apps/web/.env.example` para `apps/web/.env.local`.
4. Informe `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_APP_URL`.
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

## Preparação para deploy

O portal está preparado para uma hospedagem Next.js como a Vercel. Configure o
projeto a partir da raiz do repositório, use `pnpm build:web` como comando de
build e cadastre as três variáveis públicas acima. No Supabase, inclua o domínio
final na lista de URLs permitidas de autenticação antes de liberar o acesso.

O deploy não é automático: deve ser habilitado somente após revisão do ambiente,
domínio e políticas de acesso.
