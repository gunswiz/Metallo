# Backup e recuperação local

O estado anterior está em `C:\Projetos\Metallo-backups\ANTES_DA_REORGANIZACAO_20260908`. A cópia terminou sem falhas. Ela preserva código, configurações locais, imagens, documentação e arquivos anteriores. Dependências e caches como `node_modules`, `.next`, `.dart_tool`, `build`, `.gradle`, `dist`, `coverage` e `tmp` ficaram fora; `.git` continua no projeto original.

Para consultar ou testar o estado antigo com segurança, copie o backup para uma nova pasta, por exemplo `C:\Projetos\Metallo-recuperado`, e reinstale as dependências ali. Na estrutura antiga, os comandos Flutter eram executados na raiz. Não copie o backup por cima da nova organização: isso misturaria os caminhos antigos e novos.

Para desfazer integralmente a reorganização, primeiro preserve também uma cópia do estado organizado; depois restaure a cópia anterior em uma pasta separada e confira os testes. O histórico local Git está intacto na pasta original e pode ser preservado separadamente. Nenhum commit, reset ou comando remoto foi necessário.

O backup contém configurações locais privadas: não publique essa pasta.
