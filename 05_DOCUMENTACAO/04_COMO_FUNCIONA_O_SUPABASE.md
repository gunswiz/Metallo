# Onde estão os arquivos do Supabase

Abra `04_BANCO_E_SUPABASE/supabase`.

- `migrations`: arquivos que registram alterações do banco. Seus nomes e conteúdos foram preservados, inclusive a ordem das datas.
- `functions/create-employee`: função do servidor para criação de funcionário/usuário, preservada sem mudança de comportamento.

As políticas de acesso e funções SQL estão dentro das migrações existentes. Elas não foram separadas em novos arquivos: isso alteraria o histórico de execução. Não foram inventadas pastas de dados iniciais ou configurações que não existiam.

O nome interno `supabase` e as pastas `migrations` e `functions` foram mantidos para compatibilidade com suas ferramentas. A pasta de trabalho dessas ferramentas agora é `04_BANCO_E_SUPABASE`. Nenhum comando de migração ou publicação foi executado nesta tarefa.

O Web acessa o serviço em `01_WEB/05_ACESSO_A_DADOS/Supabase` e `Repositorios`. O Mobile usa `02_MOBILE/lib/06_ACESSO_A_DADOS`. Consulte também [a referência do banco](08_REFERENCIAS_TECNICAS/database.md).
