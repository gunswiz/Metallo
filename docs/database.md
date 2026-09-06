# Banco e Supabase

## Princípio

Flutter e Web usam o mesmo projeto Supabase. O portal respeita as tabelas,
funções transacionais, gatilhos e políticas RLS já utilizadas pelo aplicativo.

## Migrações

Novas alterações ficam em `supabase/migrations/` e devem ser incrementais. A
migração `20260906021925_web_platform_hardening.sql` adiciona apenas índices para
chaves estrangeiras e consultas paginadas; não remove colunas, políticas ou
dados.

O histórico local antigo não representa integralmente todas as migrações já
aplicadas no projeto remoto. Portanto, não use reset, diff destrutivo ou replay
cego no banco de produção. Crie sempre uma nova migração e revise o SQL antes de
aplicar.

## Tipos

`packages/types/src/database.ts` é gerado a partir do schema remoto. Regenere-o
após qualquer alteração de schema e execute `pnpm typecheck:web` para detectar
incompatibilidades entre banco, repositório e interface.

## Segurança

- tabelas expostas pela API permanecem com RLS habilitado;
- papéis vêm de `profiles.role`, nunca de metadados editáveis pelo usuário;
- RPCs sensíveis validam usuário ativo, papel e equipe no banco;
- o navegador recebe apenas a chave publicável;
- nenhuma credencial administrativa é versionada.
