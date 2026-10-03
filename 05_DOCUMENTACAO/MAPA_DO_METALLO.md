# Mapa do Metallo

## Marco 4C — disponibilidade e desempenho local

- Documento vigente: `05_DOCUMENTACAO/49_MARCO_4C_DISPONIBILIDADE_DESEMPENHO_LOCAL.md`.
- Segunda rodada: evidências em `04_BANCO_E_SUPABASE/laboratorio-marco-4c/rodada-2/`; p95 global 42,224 s, misto 28,232 s. Meta de disponibilidade permanece aberta; regressões aprovadas, sem Grok/baseline/4D/remoto. Ver seção 15 do documento vigente.
- Terceira rodada: `04_BANCO_E_SUPABASE/laboratorio-marco-4c/rodada-3/`; fila de fluxos 4A retirada, operação pessoal protegida no mesmo núcleo. Cenário comparável p95 13,615 s; Home real 13,028 s; clique completo 18,040 s. Meta primária atingida neste ensaio, marco ainda ABERTO para avaliação. Regressões aprovadas; falhas iniciais do ambiente de testes preservadas. Sem Grok/baseline/4D/remoto. Ver seção 16.
- Quarta rodada: `04_BANCO_E_SUPABASE/laboratorio-marco-4c/rodada-4/`; comparável p95 **13,647 s**, 50 marcações contínuas p95 **18,286 s**. Gate duplo NÃO atingido, Marco 4C **ABERTO**. Admissão compartilhada/custo integral crescente comprovados; candidata reprovada por disponibilidade e revertida, preservando R3. Sem Grok/baseline/4D/remoto. Ver seção 17 do documento vigente.
- Quinta rodada: `04_BANCO_E_SUPABASE/laboratorio-marco-4c/rodada-5/`; candidata opt-in com admissão de leitura independente e journal v2. Comparável p95 **8,448 s**, 50 contínuas **5,231 s**, misto **13,668 s**, zero 503 finais. **ABERTO / candidata NÃO adotada**: backup v1 rejeita v2 (ANCORA_DIVERGENTE) e causa detalhada dos resets novos permanece parcial. Ver seção 18; default integral preservado, sem Grok/baseline/4D/remoto.
- Ensaios/evidências: `04_BANCO_E_SUPABASE/laboratorio-marco-4c/`.
- Origem imutável: `METALLO-4B-LAB-20261001-R1`. Primeira rodada, sem baseline nova ou Grok; risco médio de disponibilidade aberto.

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

## Quero encontrar Comunicados do laboratório 3H

- Gestão: `01_WEB/app/(02_SISTEMA)/comunicados/page.tsx`.
- Colaborador: `01_WEB/app/colaborador/[[...screen]]/meus-comunicados.tsx`.
- Contrato do banco local: `04_BANCO_E_SUPABASE/laboratorio-marco-3h/contrato-comunicados.sql`.
- Decisões e roteiro: `05_DOCUMENTACAO/46_MARCO_3H_COMUNICADOS.md`.
- Baseline aprovada somente em laboratório: `outputs/Metallo-Marco3H-BaselineAprovada-20261001-R1.zip`; hash/scan nos recibos externos ao lado do ZIP.

## Quero encontrar Meu Ponto online do laboratório 4A

- Colaborador: `01_WEB/app/colaborador/[[...screen]]/meu-ponto-online.tsx`.
- Gestão: `01_WEB/app/(02_SISTEMA)/ponto-laboratorio/page.tsx`.
- Extensão do núcleo local e provas: `04_BANCO_E_SUPABASE/laboratorio-marco-4a`.
- Decisões, fontes oficiais, riscos e roteiro: `05_DOCUMENTACAO/47_MARCO_4A_MEU_PONTO_ONLINE_GEOLOCALIZACAO.md`.
- Meus Registros, Comprovantes e Shell 4B **funcional em laboratório**: `05_DOCUMENTACAO/48_MARCO_4B_MEUS_REGISTROS_E_COMPROVANTES.md` — histórico pessoal de 60 dias no filtro rápido, PDF de laboratório e extração de 48h. Avaliação manual aprovada, um ciclo Grok confrontado e carga com 50 identidades concluída; risco médio de latência/disponibilidade preservado, sem alegação de capacidade de produção. Baseline `METALLO-4B-LAB-20261001-R1`, ZIP `outputs/Metallo-Marco4B-BaselineAprovada-20261001-R1.zip`; SHA/scan e contagens nos recibos externos. Sem 4C, publicação ou remoto.
- Estado: fechamento técnico em laboratório concluído, avaliação manual aprovada e dois ciclos de auditoria confrontados; zero crítico/alto confirmado aberto. Baseline `METALLO-4A-LAB-20261001-R1` criada: 382 arquivos/383 entradas, scan direto com zero segredos confirmados. SHA e recibos em `outputs`/documento 47. Sem uso oficial, publicação ou próximo marco.

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

Rodada 6 do Marco 4C: seção 19 do documento 49; backup/restore v2 15/15 e cinco repetições de A/B/C/D/50, zero 503; candidata elegível à decisão em laboratório, sem adoção automática, Grok, baseline, 4D ou remoto. Prévia mantém full/v1.


**Marco 4C — adoção controlada (2026-10-02):** montagem normal seleciona incremental/v2, sem flag de rodada. Bateria nova (3 execuções A/B/C/D/50), backup/restore v2 e regressões passaram, porém a prévia existente falhou: checkpoint de recibos anteriores ausente no primeiro frame v2, incidente RECIBO_ATUAL_DIVERGENTE. Serviço de ponto parado, avaliação manual pendente, adoção NÃO concluída e Marco 4C ABERTO. Documento vigente: `49_MARCO_4C_DISPONIBILIDADE_DESEMPENHO_LOCAL.md`, seção 20. Sem Grok, baseline, 4D, publicação ou remoto nesta etapa.

**Atualização da correção da adoção (2026-10-02):** seção 21 do documento 49. Bootstrap v1→v2 validado sem alterar os 10 originais/10 recibos da prévia; journal falho e incidente preservados em arquivo, checkpoint correto, backup v2/restore 10/10 e mais uma marcação apenas no restore. Prévia normal confirmou cinco novas marcações sintéticas e auditoria final 15/15. Teste específico 22/22, 17 regressões verdes, smoke 30/5 s + 30/1 s + 50/1 s, rede 8/8 e scan 1.168 arquivos sem achados. `http://127.0.0.1:3101/colaborador/ponto` está pronta para avaliação manual. **Marco 4C ABERTO; avaliação manual pendente.** Sem Grok, baseline, 4D, publicação ou Supabase remoto.
