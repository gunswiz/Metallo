# Comece por aqui — Metallo

O Metallo é um almoxarifado online para controlar materiais, consumo, EPIs, equipamentos e máquinas alugadas. O aplicativo de celular começou primeiro e ainda tem recursos que o Web não possui.

## Onde está cada coisa?

```text
Metallo/
├── 01_WEB/
│   ├── app/                         Telas e páginas (nome do Next.js)
│   ├── 02_COMPONENTES_VISUAIS/
│   ├── 03_FUNCOES_E_LOGICA/
│   ├── 04_SERVICOS/
│   ├── 05_ACESSO_A_DADOS/
│   ├── 07_ESTILOS/
│   ├── public/                      Imagens e ícones
│   ├── 09_CONFIGURACOES/
│   └── 10_TESTES/
├── 02_MOBILE/
│   ├── lib/                         Código do aplicativo
│   │   ├── 01_TELAS/
│   │   ├── 02_COMPONENTES/
│   │   ├── 03_NAVEGACAO/
│   │   ├── 04_FUNCOES_E_LOGICA/
│   │   ├── 06_ACESSO_A_DADOS/
│   │   ├── 07_TIPOS_E_MODELOS/
│   │   ├── 08_ESTILOS/
│   │   └── 10_CONFIGURACOES/
│   ├── assets/                      Imagens e ícones
│   ├── android/                     Construção do aplicativo Android
│   └── test/                        Testes do aplicativo
├── 03_COMPARTILHADO/
│   ├── 01_TIPOS/
│   ├── 02_VALIDACOES/
│   └── 03_REGRAS_E_PERMISSOES/
├── 04_BANCO_E_SUPABASE/supabase/
│   ├── migrations/                  Histórico de alterações do banco
│   └── functions/                   Funções executadas no servidor
├── 05_DOCUMENTACAO/
├── 06_TESTES_E_QUALIDADE/
├── 07_CONFIGURACOES_DO_PROJETO/
└── LEIA-ME-PRIMEIRO.md
```

Para encontrar uma tela ou função, abra [o mapa do Metallo](05_DOCUMENTACAO/MAPA_DO_METALLO.md). Para entender as pastas, leia [a explicação da estrutura](05_DOCUMENTACAO/05_ESTRUTURA_DE_PASTAS.md).

## Por onde começar uma alteração?

1. Escolha Web (site) ou Mobile (celular).
2. Encontre a área no mapa: materiais, equipamentos, EPIs, equipes, funcionários, movimentações ou consumo.
3. Para aparência e botões, comece na tela e nos componentes. Para consultas e gravações, procure acesso a dados e serviços.
4. Confira os testes antes e depois. Veja [o guia de manutenção](05_DOCUMENTACAO/07_GUIA_PARA_MANUTENCAO.md).

## Por que alguns nomes continuam em inglês?

O Next.js usa `app` para páginas e `public` para imagens. Dentro de `app`, `page.tsx` é uma tela e `layout.tsx` é sua moldura. As pastas de páginas definem os endereços do site. Os grupos `(01_ACESSO)` e `(02_SISTEMA)` organizam as telas sem mudar os endereços.

O Flutter usa `lib` para código, `android` para construir o app, `test` para encontrar os testes e `pubspec.yaml` para suas configurações. `assets` continua sendo a pasta de imagens já declarada nessas configurações.

As configurações exigidas pelas ferramentas continuam junto da aplicação: `01_WEB/package.json`, `next.config.ts`, `tsconfig.json`, configurações de teste e lint; no Mobile, `02_MOBILE/pubspec.yaml` e `analysis_options.yaml`. A raiz mantém `package.json`, `pnpm-workspace.yaml` e o arquivo de versões `pnpm-lock.yaml`. A configuração geral de TypeScript fica em `07_CONFIGURACOES_DO_PROJETO`.

## O que significa compartilhado?

Hoje os pacotes de `03_COMPARTILHADO` são TypeScript usados pelo Web. O Mobile é Dart e mantém seus modelos e funções em `02_MOBILE/lib`. O banco é comum às duas aplicações. Esta organização não criou uma integração de linguagens nem duplicou código.

## Outras pastas

`node_modules`, `.next`, `.dart_tool` e `build` são geradas pelas ferramentas. Não são locais para editar telas; os caches antigos da raiz foram removidos na limpeza posterior à reorganização. `.git` guarda o histórico local; `.github` contém arquivos de automação, com caminhos ajustados apenas nesta cópia local. `.idea` guarda preferências do editor. `backups` e `outputs` são arquivos locais anteriores, preservados. `updates` mantém o registro de versão do aplicativo no caminho original.

## Segurança da reorganização

Backup anterior: `C:\Projetos\Metallo-backups\ANTES_DA_REORGANIZACAO_20260908`. Ele contém os arquivos locais, inclusive configurações privadas; mantenha-o no computador. Dependências e caches pesados foram excluídos. O histórico Git original continua na pasta do projeto. Consulte [como recuperar](05_DOCUMENTACAO/09_BACKUP_E_RECUPERACAO.md).

As alterações desta tarefa são locais. Não foram feitos commit, push, deploy nem alterações no Supabase remoto.
