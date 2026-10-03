# Varredura e limpeza do Metallo

Em 13/09/2026 foi feita uma revisão estática das alterações locais do Web, Mobile, tipos compartilhados e migration.

Os componentes novos `estoque-integrado`, `operacoes-integradas` e `revisar-pendente` estão importados por `obras-pedidos.tsx`. Os arquivos mobile `medidas_consumo`, `receber_itens` e `revisar_pendente` também têm imports ativos. As duas prévias locais são rotas de desenvolvimento e permanecem úteis para avaliação manual. A migration `20260912190000_unify_existing_operations.sql` permanece no histórico do banco.

Não foram encontrados arquivos órfãos com evidência suficiente para exclusão. Backups, caches, builds e artefatos em `outputs` não foram removidos porque podem ser necessários para recuperação ou publicação.

Foi corrigida a lista de pedidos para aceitar vários materiais e EPIs, com revisão e remoção de linhas; máquinas continuam no fluxo de locações. O Web passou no typecheck após a regeneração dos tipos do Next. A prévia local respondeu HTTP 200 em `/previa/correcoes-metallo`. A análise Dart direcionada foi interrompida após exceder o tempo disponível, sem executar testes.
