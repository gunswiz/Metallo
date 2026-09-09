# Como rodar o Web

Use Node.js 24 ou superior e pnpm 11. As versões do projeto continuam as mesmas.

Abra um terminal em `C:\Projetos\Metallo`:

```powershell
pnpm install --frozen-lockfile
pnpm dev:web
```

Abra http://localhost:3000 no navegador. A configuração local existente está em `01_WEB/.env.local`. Em uma cópia nova, use `01_WEB/.env.example` como referência, sem sobrescrever a configuração que já existe. Não coloque chaves privadas na interface.

Para conferir:

```powershell
pnpm check:web
```

Esse comando confere escrita do código, tipos, testes e build local. Se os tipos gerados do Next estiverem desatualizados, execute `pnpm --filter @metallo/web exec next typegen` antes da checagem. Isso regenera apenas arquivos locais.

Para servir o build pronto: `pnpm --filter @metallo/web start`. As páginas internas exigem login. Testar alterações de dados exige um ambiente de testes apropriado; os testes automatizados existentes usam dados de teste.
