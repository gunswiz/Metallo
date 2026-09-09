# Arquitetura da plataforma Metallo

## Visão geral

```text
Flutter (campo) ─┐
                 ├─ Supabase Auth + Postgres + Realtime
Next.js (gestão) ┘
```

O portal Web é uma nova interface sobre o backend existente. Não há segundo
banco, sincronização paralela ou cópia de regras de negócio.

## Camadas do portal

- `app/`: rotas, layouts, estados de carregamento/erro e Server Actions.
- `components/`: componentes visuais e formulários interativos.
- `01_WEB/04_SERVICOS/`: fronteira de casos de uso e tradução de erros.
- `01_WEB/05_ACESSO_A_DADOS/Repositorios/`: consultas paginadas e acesso tipado ao Supabase.
- `01_WEB/03_FUNCOES_E_LOGICA/Autenticacao/`: sessão validada no servidor e autorização por capacidade.
- `03_COMPARTILHADO/03_REGRAS_E_PERMISSOES`: matriz RBAC e formatação independente da interface.
- `03_COMPARTILHADO/02_VALIDACOES`: validação Zod das entradas do servidor.
- `03_COMPARTILHADO/01_TIPOS`: tipos do schema, gerados pelo Supabase.

Toda mutação é validada novamente no servidor. Operações de estoque e
equipamentos usam as funções transacionais existentes no banco; as políticas de
RLS continuam sendo a última barreira de autorização.

## Perfis e capacidades

| Perfil | Consulta | Operação | EPI | Administração |
| --- | --- | --- | --- | --- |
| Administrador | Sim | Sim | Sim | Sim |
| Engenheiro | Sim | Sim | Sim | Não |
| Líder | Sim | Equipe permitida | Não | Não |
| Colaborador | Sim | Não | Não | Não |

A interface oculta ações indisponíveis, mas isso não substitui a checagem nas
Server Actions, nos RPCs nem no RLS.

## Atualização em tempo real

Somente tabelas operacionais relevantes disparam atualização da página. Os
eventos são agrupados por 300 ms para evitar recarregamentos em cascata. O
recarregamento busca novamente DTOs no servidor, respeitando sessão e RLS.
