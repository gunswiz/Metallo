# Como os dados passam pelo Metallo

No Web: página → serviço → repositório (consulta/gravação) → Supabase → resposta para a página. Os arquivos ficam, respectivamente, em `01_WEB/app`, `04_SERVICOS` e `05_ACESSO_A_DADOS`. As ações de formulários continuam em `01_WEB/app/actions`.

No Mobile: tela → repositório → Supabase → informação exibida na tela. As telas ficam em `02_MOBILE/lib/01_TELAS` e os repositórios em `06_ACESSO_A_DADOS`. A navegação fica em `03_NAVEGACAO`.

Cada aplicação verifica entradas e permissões em seu código; o banco também aplica suas próprias regras de acesso. Esta organização apenas atualizou os caminhos dos arquivos, sem mudar essas regras.
