# Reorganização local do Metallo

Conferência realizada em 08/09/2026. O código foi reorganizado em blocos, com backup anterior e validação após as mudanças. Não houve alteração de funcionalidades.

## Antes e depois

Antes, o Mobile ocupava a raiz com lib, android, assets e test; o Web ficava em apps/web; pacotes reutilizáveis em packages; arquivos do banco em supabase e documentação em docs.

Agora:

```text
C:\Projetos\Metallo
├── 01_WEB
│   ├── app                       Telas: (01_ACESSO) e (02_SISTEMA)
│   ├── 02_COMPONENTES_VISUAIS
│   ├── 03_FUNCOES_E_LOGICA
│   ├── 04_SERVICOS
│   ├── 05_ACESSO_A_DADOS
│   ├── 07_ESTILOS
│   ├── public                    Imagens e ícones
│   ├── 09_CONFIGURACOES
│   └── 10_TESTES
├── 02_MOBILE
│   ├── lib
│   │   ├── 01_TELAS
│   │   ├── 02_COMPONENTES
│   │   ├── 03_NAVEGACAO
│   │   ├── 04_FUNCOES_E_LOGICA
│   │   ├── 06_ACESSO_A_DADOS
│   │   ├── 07_TIPOS_E_MODELOS
│   │   ├── 08_ESTILOS
│   │   └── 10_CONFIGURACOES
│   ├── assets                   Imagens
│   ├── android                  Construção Android
│   └── test                     Testes Flutter
├── 03_COMPARTILHADO
│   ├── 01_TIPOS
│   ├── 02_VALIDACOES
│   └── 03_REGRAS_E_PERMISSOES
├── 04_BANCO_E_SUPABASE
│   └── supabase
│       ├── migrations
│       └── functions
├── 05_DOCUMENTACAO
├── 06_TESTES_E_QUALIDADE
├── 07_CONFIGURACOES_DO_PROJETO
└── LEIA-ME-PRIMEIRO.md
```

Árvore simplificada: arquivos de ferramentas, dependências geradas, histórico Git e arquivos locais anteriores também permanecem no projeto.

## Principais movimentações e renomeações

| Antes | Agora |
|---|---|
| apps/web | 01_WEB |
| lib, android, assets, test e arquivos Flutter na raiz | 02_MOBILE |
| packages/types | 03_COMPARTILHADO/01_TIPOS |
| packages/validation | 03_COMPARTILHADO/02_VALIDACOES |
| packages/core | 03_COMPARTILHADO/03_REGRAS_E_PERMISSOES |
| supabase | 04_BANCO_E_SUPABASE/supabase |
| docs | 05_DOCUMENTACAO/08_REFERENCIAS_TECNICAS |
| tsconfig.base.json | 07_CONFIGURACOES_DO_PROJETO/tsconfig.base.json |
| Web: components, lib/services, lib/repositories | 02_COMPONENTES_VISUAIS, 04_SERVICOS, 05_ACESSO_A_DADOS/Repositorios |
| Mobile: features, shared/widgets, data/repositories, data/models | lib/01_TELAS, lib/02_COMPONENTES, lib/06_ACESSO_A_DADOS, lib/07_TIPOS_E_MODELOS |

Arquivos genéricos revisados e renomeados:

- Web: query.ts → lerFiltrosEPaginacao.ts; consumption.ts → calcularConsumo.ts; env.ts → ambienteSupabase.ts.
- Mobile: helpers.dart do histórico → apresentacao_movimentacoes.dart; repository_utils.dart → normalizar_texto_opcional.dart; grouping.dart → agrupar_equipamentos.dart.
- Os dialogs.dart passaram a indicar o assunto: dialogos_materiais.dart, dialogos_equipamentos.dart, dialogos_administracao.dart e dialogos_movimentacoes.dart.
- No consumo: calculations.dart → calcular_consumo.dart, charts.dart → graficos_consumo.dart, widgets.dart → componentes_consumo.dart.
- Nos EPIs: forms.dart → formularios_epi.dart e delivery.dart → entrega_epi.dart.

Os nomes técnicos page.tsx, layout.tsx, index.ts, app, public, lib, android, assets, test, migrations e functions foram mantidos conforme as ferramentas e referências existentes. Não foram criadas telas duplicadas nem pastas artificiais sem conteúdo.

## Onde encontrar cada parte

- Web: C:\Projetos\Metallo\01_WEB.
- Mobile: C:\Projetos\Metallo\02_MOBILE.
- Telas Web: 01_WEB/app/(01_ACESSO) e 01_WEB/app/(02_SISTEMA), com as áreas em português e URLs preservadas.
- Telas Mobile: 02_MOBILE/lib/01_TELAS, separadas em Login, Início, Almoxarifado, EPIs e Funcionários, Administração e Equipes, Movimentações, Consumo e Configurações.
- Funções Web: 01_WEB/03_FUNCOES_E_LOGICA; serviços em 04_SERVICOS; consultas em 05_ACESSO_A_DADOS; ações de formulários em app/actions.
- Funções Mobile: 02_MOBILE/lib/04_FUNCOES_E_LOGICA e arquivos específicos das áreas; consultas em lib/06_ACESSO_A_DADOS.
- Configurações: 07_CONFIGURACOES_DO_PROJETO, raízes de cada aplicação e pastas de configurações internas. package.json e pnpm-workspace.yaml permanecem na raiz geral.
- Imagens: 01_WEB/public e 02_MOBILE/assets.

Os pacotes em 03_COMPARTILHADO são TypeScript atualmente usados pelo Web. O Mobile usa Dart e conserva seus próprios modelos e funções. O banco continua comum às duas aplicações; não foi inventado compartilhamento direto entre linguagens.

## Documentação criada

Comece em C:\Projetos\Metallo\LEIA-ME-PRIMEIRO.md.

Dentro de 05_DOCUMENTACAO estão: explicação do sistema, como rodar Web e Mobile, como encontrar os arquivos do Supabase, estrutura de pastas, fluxo de dados, guia de manutenção, MAPA_DO_METALLO.md, instruções de recuperação e 10_ARQUIVOS_MOVIDOS_E_RENOMEADOS.md com a lista completa de caminhos.

## Verificações

| Verificação | Resultado |
|---|---|
| Web: lint | Passou, sem avisos |
| Web: typecheck | Passou |
| Web: testes | 25 passaram, em 10 arquivos |
| Web: build Next.js | Passou; páginas compiladas |
| Web: build alternativo vinext | Passou localmente; sem deploy |
| Mobile: flutter analyze --no-pub --no-fatal-infos | Sem problemas |
| Mobile: flutter test --no-pub | 37 passaram |
| Mobile: flutter build apk --debug --no-pub | Passou |
| Conferência dos arquivos anteriores | Todos os 272 arquivos rastreados encontrados nos destinos |
| Comparação do código | 184 arquivos conferidos; alterações restritas a textos de caminhos/imports |
| Banco, imagens, versões Flutter e configuração de publicação | 36 arquivos rastreados selecionados comparados e idênticos ao backup |
| Arquivos privados e APK gerado | Continuam ignorados pelo Git |
| git diff --check | Sem erros de espaços; avisos de conversão LF/CRLF do Windows |

No navegador local, uma sessão já existente permitiu conferir Dashboard, Almoxarifado, Equipes, Funcionários, Movimentações, Consumo e Relatórios. Todas carregaram suas páginas. O login foi conferido também por requisição local sem sessão: HTTP 200 e campos de e-mail e senha. As sete páginas internas redirecionaram corretamente visitantes sem sessão para /login.

Nenhum formulário de alteração foi enviado durante essa conferência. Os testes de navegação/interação do Mobile passaram, incluindo abertura de telas, guias e bloqueio de ações repetidas. O APK foi compilado; não foi instalado nem validado manualmente em um celular nesta tarefa. Não foi gerada versão de distribuição assinada.

APK local: C:\Projetos\Metallo\02_MOBILE\build\app\outputs\flutter-apk\app-debug.apk.

## Observações registradas, sem refatoração funcional

Antes das mudanças, o Web já apresentava conflito nos tipos de rotas gerados. O build vinext escreve tipos diferentes no mesmo diretório usado pelo Next.js. Depois de validar vinext, os tipos do Next foram regenerados com next typegen e o typecheck passou novamente. Os guias explicam esse procedimento; as dependências não foram atualizadas para tentar corrigir esse comportamento preexistente.

O build Android apresenta aviso de compatibilidade futura do plugin package_info_plus com Kotlin; a compilação atual passou. O build vinext apresenta aviso sobre classificação estática de rotas. Esses avisos ficaram registrados, sem mudanças nas funcionalidades ou dependências.

A limpeza posterior, solicitada pelo proprietário, removeu os caches antigos da raiz e seis pastas vazias. APKs e registros históricos foram preservados em C:\Projetos\Metallo-backups\HISTORICO_DA_LIMPEZA_20260908, com conferência de integridade. Consulte RELATORIO_DA_LIMPEZA.md para os resultados atuais.

## Backup e limites respeitados

Backup: C:\Projetos\Metallo-backups\ANTES_DA_REORGANIZACAO_20260908. A cópia terminou com 439 arquivos copiados e nenhuma falha; excluiu dependências e caches pesados. O histórico Git original continua no projeto.

Os imports, caminhos dos testes, configuração de pacotes, referências do editor e arquivos locais de automação foram ajustados. A lista de versões das dependências permaneceu a mesma; a instalação offline apenas restabeleceu os vínculos dos pacotes locais.

Não foi feito commit, push, merge, rebase ou tag. Nenhuma alteração foi enviada ao GitHub. Nenhum deploy, preview ou alteração de infraestrutura foi feito no Cloudflare. Nenhuma migração, alteração de RLS, usuário, autenticação, Storage ou dados foi executada no Supabase remoto. A conferência das páginas autenticadas fez apenas leituras pelo aplicativo local. Nenhuma alteração de código saiu do computador.
