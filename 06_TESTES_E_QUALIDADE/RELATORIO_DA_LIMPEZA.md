# Limpeza segura do Metallo — 08/09/2026

Foram removidos apenas resíduos da estrutura antiga, sem alterações no código ou nas dependências.

- Caches Flutter antigos: C:\Projetos\Metallo\build e C:\Projetos\Metallo\.dart_tool.
- Metadados antigos: C:\Projetos\Metallo\.flutter-plugins-dependencies (cópia preservada).
- Pastas vazias: apps, tmp, tool, 01_WEB/lib, 02_MOBILE/lib/shared e 02_MOBILE/lib/data.
- Código, imagens, configurações, arquivos privados, dependências, backups anteriores e histórico Git preservados.

## Arquivos históricos protegidos

44 arquivos, incluindo APKs publicados, arquivos de distribuição, imagens e registros de verificações, foram copiados para:

C:\Projetos\Metallo-backups\HISTORICO_DA_LIMPEZA_20260908

As cópias foram conferidas individualmente por SHA-256 antes da remoção da pasta antiga. A lista está em MANIFESTO.json nessa pasta.

Removidos da estrutura antiga: 3.17 GB. Preservados no arquivo histórico: 0.71 GB. Espaço líquido liberado nessa limpeza: aproximadamente 2.46 GB (unidades decimais, antes de variações de caches dos testes).

## Testes após a limpeza

- Web: lint, typecheck, 25 testes em 10 arquivos e build Next.js aprovados.
- Mobile: análise sem problemas, 37 testes aprovados e APK de desenvolvimento compilado.
- Todos os 272 arquivos rastreados anteriores continuam presentes nos caminhos reorganizados.
- Comparação de 184 arquivos de código: nenhuma mudança de corpo de código em relação à organização anterior; apenas os caminhos já ajustados na reorganização.
- 36 arquivos protegidos selecionados, incluindo arquivos do banco, imagens e configurações, idênticos ao backup original.
- Arquivos privados e APK gerado continuam ignorados pelo Git. Verificação de espaços do Git sem erros.

Os caches atuais em 01_WEB e 02_MOBILE foram preservados e podem ser atualizados pelas ferramentas durante os testes. Não houve instalação do APK em celular nem teste manual completo de funcionalidades nesta limpeza.

Nenhum commit, push, deploy ou alteração no Supabase remoto foi realizado.
