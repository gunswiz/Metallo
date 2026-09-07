# Segurança operacional

## Cadastro de usuários

O Metallo não oferece cadastro público. A tela Mobile contém somente entrada e
recuperação de senha. Novas contas são criadas por um administrador autenticado
pela Edge Function `create-employee`, implantada com verificação de JWT.

A função grava `app_metadata.metallo_provisioned = true`. Um gatilho anterior à
inserção em `auth.users` rejeita qualquer conta sem essa marca controlada pelo
servidor. `user_metadata` nunca é usado para conceder papel ou permissão.

Senhas novas e senhas temporárias exigem no mínimo 12 caracteres, com letra
maiúscula, minúscula, número e símbolo. Contas existentes continuam podendo
entrar; a regra é aplicada ao criar ou trocar a senha.

## RPCs `SECURITY DEFINER`

As RPCs operacionais precisam executar movimentações atômicas que abrangem mais
de uma tabela. Por isso algumas permanecem `SECURITY DEFINER` e o advisor do
Supabase continuará exibindo o alerta genérico 0029 para elas. Essa exposição é
intencional somente quando todos estes requisitos são atendidos:

- `EXECUTE` foi revogado de `PUBLIC` e `anon`;
- o acesso de `authenticated` é concedido explicitamente;
- a função valida `auth.uid()`, usuário ativo, papel e equipe antes de gravar;
- `search_path` é fixo e os objetos são qualificados;
- entradas possuem validação e a operação mantém histórico auditável.

`claim_initial_admin()` não é uma RPC de operação e não pode mais ser executada
por usuários autenticados. `is_active_admin()` passou a `SECURITY INVOKER`, pois
apenas consulta o perfil do usuário atual. Privilégios padrão também foram
revogados: toda RPC futura deve declarar seu `GRANT` de forma intencional.

## Verificação antes de publicar

1. Execute `flutter analyze` e `flutter test`.
2. Execute `pnpm check:web`.
3. Execute `deno check --config supabase/functions/create-employee/deno.json
   --no-lock supabase/functions/create-employee/index.ts`.
4. Confirme que cadastro público falha sem criar linha em `auth.users`.
5. Confira os advisors de segurança e desempenho do Supabase.

O aviso de proteção contra senhas vazadas depende de recurso do plano pago do
Supabase. Ele não substitui a política local de senha forte e deve ser ativado
se o projeto for promovido para um plano compatível.
