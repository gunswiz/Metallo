# Paridade Web e Mobile

Esta matriz registra as regras compartilhadas e a adaptação de interface. O
Web é administrativo e aproveita espaço de desktop; o Mobile continua focado
na operação em campo. Ambos usam o mesmo Supabase e o mesmo histórico.

| Funcionalidade | Mobile | Web | Regra compartilhada |
| --- | --- | --- | --- |
| Almoxarifado | Abas de materiais e equipamentos; módulo COSEM para EPI | Entrada única para Materiais, Equipamentos, Ferramentas e EPIs | Mesmas tabelas `items`, `inventory`, `assets` e tabelas `epi_*` |
| EPI | Catálogo, estoque por variante, entrega e pendências | Cadastro de tipo, entrada de lote e entrega em ações separadas | Entrada usa `add_epi_stock_batch`; entrega usa `register_epi_delivery` e baixa estoque atomicamente |
| Funcionários | Cadastro, kits, itens e ASO | Perfil, edição de dados/ASO, itens ativos e histórico | `epi_employees`, `epi_deliveries` e `epi_requests` |
| Itens pessoais | `epi_items.item_kind = personal_tool` | Cadastro no catálogo e atribuição a partir do funcionário | Não existe entidade duplicada de ferramenta pessoal |
| ASO | Seletor em português e alertas | Data ISO no formulário, exibição `DD/MM/AAAA` e alertas | `aso_exam_date` e `aso_expiry_date`, ambos opcionais |
| Consumo | Resumo, ranking, categoria, evolução e comparação por equipe | Gráficos responsivos, filtros e linhas de origem | Somente `movements.movement_type = consumption`; unidades não são somadas entre si |
| Equipamentos alugados | Próprio/alugado, locadora, fim e devolução | Cadastro/edição, filtro, badges, período e devolução | Colunas normalizadas em `assets`; metadado legado mantido apenas para compatibilidade temporária |
| Movimentações | Materiais e patrimônios | Operação e relatórios históricos separados | RPCs transacionais e histórico imutável/auditável |

## Navegação Web

```text
Dashboard
Almoxarifado
Equipes
Funcionários
Movimentações
Consumo
Relatórios
Usuários
Configurações
```

Materiais, Equipamentos, Ferramentas e EPIs permanecem acessíveis dentro de
Almoxarifado e não são repetidos na navegação principal.

## Equipamento próprio ou alugado

`assets.ownership_type` é a fonte de verdade. Para alugados, o sistema usa
`rental_company`, `rental_start_date` e `rental_end_date`; a observação humana
fica em `user_notes`. O campo antigo `notes` ainda recebe uma representação de
compatibilidade para aplicativos já instalados, mas nunca é exibido como
observação no Web. Depois que versões antigas forem desativadas, essa ponte
poderá ser removida por outra migration.

## Consumo e relatórios

- Consumo é uma leitura visual rápida, com tendência, ranking, categoria e
  comparação de equipes.
- Relatórios são consultas históricas detalhadas de movimentações, posição de
  equipamentos e entregas de EPI.
- As consultas são limitadas por período e quantidade máxima de registros; a
  base completa não é carregada no navegador.
