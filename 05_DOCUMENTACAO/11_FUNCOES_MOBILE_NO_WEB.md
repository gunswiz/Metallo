# Funções do Mobile incorporadas ao Web

Atualização local: 09/09/2026. Projeto: `C:\Projetos\Metallo`.

## Implementado

| Rotina | Onde acessar no Web | Comportamento |
| --- | --- | --- |
| Solicitar EPI, fardamento ou item pessoal | EPIs → Solicitações; perfil do funcionário | Escolha de funcionário, item, quantidade e variante; limite de 100 unidades por solicitação |
| Atender solicitação | EPIs → Solicitações | Seleção de lote do mesmo item, variante e quantidade suficiente; usa `fulfill_epi_request` |
| Entregar vários itens | EPIs → Entrega em lote; perfil do funcionário | Lista revisável, proteção contra lotes repetidos e envio completo em uma chamada a `register_epi_delivery_batch` |
| Kit individual | Funcionários → perfil → Kit e itens faltantes | Kit salvo ou recomendação da profissão; quantidades previstas, em uso e faltantes; links para pendências |
| Personalizar kit | Mesma tela, para administrador | Mantém a configuração explícita inclusive quando vazia; usa `set_epi_employee_items` |
| Prazo de reposição | Detalhe do EPI | Administrador define ou remove o prazo em dias |
| Editar/desativar equipe | Detalhe da equipe | Procedimentos administrativos existentes; desativação com confirmação e validações de vínculos no banco |
| Desativar catálogos | Detalhe do material, equipamento ou EPI | Confirmação explícita, autorização administrativa e preservação dos registros históricos |
| Criar acesso | Usuários → Novo usuário | Serviço existente `create-employee`, senha forte, papéis aceitos pelo serviço; cadastro de acesso separado do funcionário de EPI |
| Histórico de equipamentos | Movimentações → Equipamentos | Consulta paginada com pesquisa nas observações, equipe, patrimônio e responsável |
| Corrigir/excluir movimentação | Movimentações → Editar, para administrador | Chama os mesmos procedimentos administrativos usados pelo Mobile; exclusão exige confirmação |
| Substituir máquina locada | Detalhe do equipamento alugado | Mantém cadastro, equipe e dados da locação; registra patrimônios antigo e novo nas observações e marca disponível |
| Minha conta | Menu lateral | Consulta do e-mail, solicitação de alteração e acesso à troca de senha existente |
| Ajuda | Menu lateral → Guia de uso | Orientações e atalhos para as rotinas do sistema |

## Organização e manutenção

- `01_WEB/app/actions/epi-completo.ts`: solicitações, atendimento, kit, entrega em lote e prazo de reposição.
- `01_WEB/app/actions/administracao-completa.ts`: equipes, catálogos, criação de acesso e correção do histórico.
- `01_WEB/app/actions/substituir-locado.ts`: substituição com leitura dos dados atuais do equipamento.
- `01_WEB/app/actions/minha-conta.ts`: alteração do próprio e-mail.
- `01_WEB/03_FUNCOES_E_LOGICA/validarParidadeMobile.ts`: contratos de entrada e validações.
- `01_WEB/03_FUNCOES_E_LOGICA/executarOperacaoValidada.ts`: autorização, tratamento de falhas, atualização das telas e redirecionamento.
- `01_WEB/03_FUNCOES_E_LOGICA/kitDoFuncionario.ts`: recomendações por profissão e compatibilidade de lotes.
- `01_WEB/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository.ts`: consultas paginadas para escolhas e kit. O limite de 5.000 registros produz erro explícito, sem lista silenciosamente incompleta.
- `01_WEB/05_ACESSO_A_DADOS/Repositorios/historico-operacoes-repository.ts`: leitura do histórico de equipamentos e dos registros para edição.
- `01_WEB/02_COMPONENTES_VISUAIS/formulario-operacao.tsx`: bloqueia controles enquanto aguarda resposta e preserva campos quando a operação retorna erro.
- `01_WEB/10_TESTES/paridade-*`: testes de contratos, ações, consultas e interação com formulários.

Toda nova ação verifica a permissão no servidor. Os controles visuais complementam essa verificação. Nenhuma chave administrativa foi adicionada ao navegador. Não houve mudança de schema ou política do Supabase.

## Verificação realizada

- Web: lint e TypeScript aprovados; 49 testes em 14 arquivos aprovados; compilação Next aprovada.
- Compatibilidade: compilação local Vinext aprovada. Após Vinext, executar `pnpm --filter @metallo/web exec next typegen` antes de conferir os tipos do Next, devido ao conflito preexistente entre arquivos gerados pelos dois compiladores.
- Mobile: `flutter analyze` sem problemas; 37 testes aprovados.
- Navegador local, com sessão existente: leitura de solicitações, kit, entrega em lote, histórico de equipamentos, formulário de correção, criação de usuário e Minha conta. Nenhum formulário de gravação foi enviado.
- Testes de escrita usam serviços simulados. Cobrem falta de permissão, dados inválidos, estoque insuficiente, erro de rede, kit vazio, duplicação, preservação de formulário e dados da locação.

As validações locais não comprovam a execução transacional de todos os procedimentos no ambiente remoto. O próximo teste integrado deve usar um ambiente de homologação com dados descartáveis, incluindo atendimento concorrente, saldos após correção/exclusão, provisionamento e confirmação de e-mail.

## Diferenças e pendências explícitas

1. Exclusão definitiva de usuário: o Mobile chama `delete-employee`, mas a implementação dessa função não está no código local. Não foi criado um botão que depende de um serviço sem contrato verificável. A desativação de acesso já existente permanece disponível.
2. Correção do histórico e edição de equipes: os nomes/argumentos dos procedimentos são conhecidos pelo código Mobile e pelos tipos gerados, mas nem todas as definições SQL estão nas migrations locais. O código Web foi testado com respostas simuladas; a recuperação dessas definições e o teste de saldos em homologação continuam necessários.
3. Atualização de APK, telas de abertura e comportamento nativo de conectividade são específicos do aplicativo. Não foram transportados para o navegador.
4. O guia Web é uma adaptação com orientações e atalhos; não reproduz o tutorial interativo do Mobile.

Esta entrega amplia a cobertura funcional do Web, mas não constitui certificação de paridade integral entre as plataformas.

## Recuperação e publicação

Backup anterior à implementação: `C:\Projetos\Metallo-backups\ANTES_DA_PARIDADE_WEB_20260908`.

Alterações mantidas localmente, sem commit, push, deploy ou alteração de dados de produção. A reorganização anterior permanece preservada.
