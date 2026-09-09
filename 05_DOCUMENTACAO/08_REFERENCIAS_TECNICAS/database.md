# Banco e Supabase

## Princípio

Flutter e Web usam o mesmo projeto Supabase. O portal respeita as tabelas,
funções transacionais, gatilhos e políticas RLS já utilizadas pelo aplicativo.

## Migrações

Novas alterações ficam em `04_BANCO_E_SUPABASE/supabase/migrations/` e devem ser incrementais. A
migração `20260906021925_web_platform_hardening.sql` adiciona apenas índices para
chaves estrangeiras e consultas paginadas; não remove colunas, políticas ou
dados.

A migration `20260906075309_web_mobile_parity.sql` normaliza propriedade e
locação de equipamentos, preserva observações humanas em `assets.user_notes`,
mantém compatibilidade temporária com clientes Mobile antigos e adiciona RPCs
autorizadas para cadastro atômico de equipamento e item da COSEM. Nenhuma
tabela ou linha histórica é removida.

A migration `20260906082523_allow_epi_stock_entries_for_operators.sql` mantém o
catálogo restrito ao administrador, mas permite que administrador e engenheiro
registrem entradas de estoque pela RPC `add_epi_stock_batch`. A função valida
papel ativo, item, quantidade e variantes configuradas antes de criar o lote.

O histórico local antigo não representa integralmente todas as migrações já
aplicadas no projeto remoto. Portanto, não use reset, diff destrutivo ou replay
cego no banco de produção. Crie sempre uma nova migração e revise o SQL antes de
aplicar.

## Tipos

`03_COMPARTILHADO/01_TIPOS/src/database.ts` é gerado a partir do schema remoto. Regenere-o
após qualquer alteração de schema e execute `pnpm typecheck:web` para detectar
incompatibilidades entre banco, repositório e interface.

## Segurança

- tabelas expostas pela API permanecem com RLS habilitado;
- papéis vêm de `profiles.role`, nunca de metadados editáveis pelo usuário;
- RPCs sensíveis validam usuário ativo, papel e equipe no banco;
- o navegador recebe apenas a chave publicável;
- nenhuma credencial administrativa é versionada.
