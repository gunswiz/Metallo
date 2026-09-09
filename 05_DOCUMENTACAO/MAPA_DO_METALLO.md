# Mapa do Metallo

Escolha abaixo o que você quer encontrar. Todos os caminhos partem de `C:\Projetos\Metallo`.

## Quero encontrar Login

- Web: `01_WEB/app/(01_ACESSO)/login/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/01_LOGIN/login_page.dart`.

## Quero encontrar Início / Dashboard

- Web: `01_WEB/app/(02_SISTEMA)/dashboard/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/02_INICIO/dashboard_page.dart`.

## Quero encontrar Almoxarifado

- Web: `01_WEB/app/(02_SISTEMA)/almoxarifado/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO`.

## Quero encontrar Materiais

- Web: `01_WEB/app/(02_SISTEMA)/materiais/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO/Materiais/materials_page.dart`.

## Quero encontrar Equipamentos e máquinas alugadas

- Web: `01_WEB/app/(02_SISTEMA)/equipamentos/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/03_ALMOXARIFADO/Equipamentos/equipment_page.dart`.

## Quero encontrar Equipes

- Web: `01_WEB/app/(02_SISTEMA)/equipes/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/05_ADMINISTRACAO_E_EQUIPES/teams_page.dart`.

## Quero encontrar Funcionários

- Web: `01_WEB/app/(02_SISTEMA)/funcionarios/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/04_EPIS_E_FUNCIONARIOS/employees_page.dart`.

## Quero encontrar EPIs

- Web: `01_WEB/app/(02_SISTEMA)/epis/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/04_EPIS_E_FUNCIONARIOS/epi_shell.dart`.

## Quero encontrar Movimentações

- Web: `01_WEB/app/(02_SISTEMA)/movimentacoes/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/06_MOVIMENTACOES/history_page.dart`.

## Quero encontrar Consumo

- Web: `01_WEB/app/(02_SISTEMA)/consumo/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/07_CONSUMO/consumption_page.dart`.

## Quero encontrar Relatórios

- Web: `01_WEB/app/(02_SISTEMA)/relatorios/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/04_EPIS_E_FUNCIONARIOS/reports_page.dart`.

## Quero encontrar Usuários

- Web: `01_WEB/app/(02_SISTEMA)/usuarios/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/05_ADMINISTRACAO_E_EQUIPES/users_management_page.dart`.

## Quero encontrar Configurações

- Web: `01_WEB/app/(02_SISTEMA)/configuracoes/page.tsx`.
- Mobile: `02_MOBILE/lib/01_TELAS/08_CONFIGURACOES/account_settings_page.dart`.

## Quero encontrar funções, imagens ou configurações

| O que procurar | Onde encontrar |
|---|---|
| Componentes do Web | `01_WEB/02_COMPONENTES_VISUAIS` |
| Componentes do Mobile | `02_MOBILE/lib/02_COMPONENTES` |
| Navegação Mobile | `02_MOBILE/lib/03_NAVEGACAO/main_shell.dart` |
| Cálculo de consumo Web | `01_WEB/03_FUNCOES_E_LOGICA/calcularConsumo.ts` |
| Cálculo de consumo Mobile | `02_MOBILE/lib/01_TELAS/07_CONSUMO/calcular_consumo.dart` |
| Transferência no Web | `01_WEB/04_SERVICOS/metallo-service.ts` e `01_WEB/05_ACESSO_A_DADOS/Repositorios/metallo-repository.ts` |
| Transferência no Mobile | `02_MOBILE/lib/06_ACESSO_A_DADOS/movement_repository.dart` |
| Regras e permissões TypeScript | `03_COMPARTILHADO/03_REGRAS_E_PERMISSOES/src/index.ts` |
| Tipos do Web | `03_COMPARTILHADO/01_TIPOS/src` |
| Modelos do Mobile | `02_MOBILE/lib/07_TIPOS_E_MODELOS` |
| Arquivos locais do banco | `04_BANCO_E_SUPABASE/supabase` |
| Imagens Web / Mobile | `01_WEB/public` / `02_MOBILE/assets` |
| Estilos Web / Mobile | `01_WEB/07_ESTILOS/globals.css` / `02_MOBILE/lib/08_ESTILOS/theme.dart` |
| Configurações gerais | `07_CONFIGURACOES_DO_PROJETO` e arquivos de ferramentas na raiz |
| Configurações Web | `01_WEB/09_CONFIGURACOES`, `01_WEB/.env.local` e configurações na raiz do Web |
| Configurações Mobile | `02_MOBILE/lib/10_CONFIGURACOES` e `02_MOBILE/pubspec.yaml` |
| Testes Web / Mobile | `01_WEB/10_TESTES` / `02_MOBILE/test` |

As ferramentas têm página própria no Web em `01_WEB/app/(02_SISTEMA)/ferramentas/page.tsx`; no aplicativo, consulte a área de equipamentos. O módulo Mobile de EPIs reúne também funcionários, entregas, ASO e relatórios; não foi dividido artificialmente em telas duplicadas.
