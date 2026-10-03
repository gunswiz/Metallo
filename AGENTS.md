# Preferências do projeto

- Para toda nova função ou alteração de interface, preparar e disponibilizar uma prévia local antes de publicar. Informar o endereço local e o caminho da tela para o usuário analisar o resultado; iniciar o ambiente local quando necessário.
- "Local teste" significa ambiente de prévia para avaliação manual do usuário. Testes automatizados fazem parte do ciclo de desenvolvimento e podem ser executados separadamente.
- Publicar somente após o usuário aprovar a prévia e autorizar a publicação daquela alteração. Autorizações de publicações anteriores não substituem essa etapa nas próximas mudanças.
- Após a avaliação e aprovação manual de uma prévia de marco ou funcionalidade, preparar um pacote de auditoria sem segredos nem dados reais, enviar ao Grok para revisão independente somente leitura e confrontar os achados com as provas locais. A inspeção passiva de arquivos e ZIPs no ambiente do auditor, inclusive extração e cálculo de hashes por comandos locais de leitura, é permitida. Continuam proibidos execução do projeto, SQL, testes, Auth, chamadas à rede do laboratório e qualquer alteração local ou remota. O responsável autorizou esse envio como etapa recorrente do fluxo; não é autorização para publicar, alterar o Supabase remoto ou congelar uma nova baseline.
- Executar testes automatizados proporcionais à alteração, incluindo testes de segurança relevantes, após desenvolver e após corrigir. A bateria completa pode ser executada no ciclo de validação quando pertinente; não requer a palavra "teste".
- Não iniciar pipelines de publicação ou produção sem aprovação específica. Não remover nem enfraquecer testes existentes para obter resultado positivo.

## Organização e governança permanentes

- Respeitar as responsabilidades de `01_WEB`, `02_MOBILE`, `03_COMPARTILHADO`, `04_BANCO_E_SUPABASE`, `05_DOCUMENTACAO`, `06_TESTES_E_QUALIDADE` e `07_CONFIGURACOES_DO_PROJETO`. Não renomear, mover, fundir ou reorganizar essas pastas em massa sem autorização expressa do responsável.
- Priorizar leitura manual simples, localização rápida dos arquivos e clareza da responsabilidade de cada parte para o responsável leigo.
- Antes de criar um arquivo, procurar responsabilidade equivalente, documento atual e componente, serviço ou helper reutilizável. Preferir **ATUALIZAR > REUTILIZAR > COMPONENTIZAR > CRIAR NOVO**.
- Criar arquivo somente para responsabilidade nova e clara. Não duplicar informação, resumos ou relatórios; não criar arquivo apenas para texto temporário nem para contornar a arquitetura.
- Manter responsabilidade única. Evitar arquivos gigantes que misturem autenticação, sessão, API, DTO, telas e componentes. Localizar a camada correta e conferir convenções antes de adicionar módulos; exemplos de organização não autorizam criar pastas automaticamente.
- Não criar arquitetura paralela. SQL e migrations pertencem a `04_BANCO_E_SUPABASE`; documentos a `05_DOCUMENTACAO`; testes às camadas existentes; evidências do laboratório permanecem junto do laboratório e pacotes de entrega em `outputs`, sem duplicar relatórios vigentes.

## Regra aprovada do portal

- Funcionário ativo com identidade/vínculo pessoal ativo continua acessando o portal sem equipe atribuída, inclusive quando a equipe estiver inativa, removida ou ausente. A apresentação deve indicar **Sem equipe atribuída**.
- O estado da equipe não revoga identidade, não bloqueia login e não esconde o perfil inteiro. A autorização pessoal depende do vínculo/identidade e do funcionário, com revogação/desligamento tratado pelo fluxo próprio; novas regras empresariais exigem decisão do responsável.
- Implementar e testar a regra no laboratório antes de avançar a interface. Isso não autoriza alteração remota, publicação, Auth real do produto ou ponto oficial.
- Na Gestão, equipe nula não amplia permissões. Até decisão empresarial diferente, funcionário sem equipe é acessível apenas ao administrador global pelas permissões existentes; o portal conserva seu DTO próprio. Não alterar o significado global de `can_operate(permission, NULL)` para corrigir uma superfície específica.
