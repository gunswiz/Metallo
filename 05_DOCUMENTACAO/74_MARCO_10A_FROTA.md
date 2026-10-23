# Marco 10A — Frota de caminhões munck (ambiente de teste)

Pedido do engenheiro: controlar os 5 caminhões munck. Só ambiente de teste (Supabase de teste, dados fictícios). Nada em produção.

## O que existe
- **App do funcionário → Caminhões**: lista dos 5 caminhões com situação; checklist do dia (26 itens da planilha METALLO-ENG-01, botões C / N / NA, descrição obrigatória no N, ciência); registrar saída (destino, com quem, km, observação); registrar chegada (km, problema, observação); últimas saídas da pessoa.
- **Gestão → Frota → Caminhões**: painel (disponível, na rua, não liberado, na oficina, sem checklist hoje), pontos de atenção, ficha de cada caminhão (manutenção, documentos e vencimentos, planos preventivos, saídas e chegadas, checklists com detalhe, grade do mês como a planilha, histórico, dados do caminhão).
- **Gestão → Frota → Itens do checklist**: editar nome, ativar/desativar e marcar o que é crítico.

## Regras
- Sem GPS e sem localização (o rastreamento continua no sistema do caminhão).
- Saída exige checklist do dia liberado (ou liberado/ressalvas) ou liberação do engenheiro no dia; um caminhão por pessoa e uma pessoa por caminhão; km nunca menor que o atual.
- Item crítico "N" → caminhão **não liberado**, abre manutenção corretiva sozinha. Item comum "N" → "liberado com ressalvas" e manutenção aberta sem bloquear. Problema informado na chegada também bloqueia.
- Os itens críticos iniciais são **sugestão** (freios, pneus, comandos, mangueiras, moitão e trava, alavancas, cintos, habilitação). O engenheiro ajusta na tela de itens.
- Liberar caminhão e cadastrar/alterar caminhão, documentos e itens: administrador e engenheiro (conferido no banco). Manutenção e planos: quem opera equipamentos (inclui líder).
- Manutenção: aberta → na oficina (oficina e previsão) → concluída (custo e km) ou cancelada (motivo). Planos preventivos por km e/ou dias, com vencida / chegando / em dia.

## Banco
`04_BANCO_E_SUPABASE/teste-online/10a-frota.sql` (tabelas no schema `private`, fechadas; funções `*_10a`). Prova online: `provas-10a-online.mjs` (35 verificações).

## Limites conhecidos
- Foto do defeito: ver Marco 10B abaixo.
- Checklist e saída não funcionam sem internet (sem fila offline).
- Itens críticos são sugestão a confirmar com o engenheiro.
- Não testado em celular real; revisão de interface descrita abaixo.

## Interface simplificada — 23/10/2026

- Gestão web: o início mostra até três assuntos prioritários, com urgentes primeiro e botão para consultar todos. Histórico e indicadores secundários ficam recolhidos.
- Frota da Gestão: busca por nome, placa e motorista; filtros com contagem; situação e ação principal por caminhão. Cadastro recolhido. Alertas levam diretamente ao assunto da ficha.
- Ficha: Manutenção, Documentos, Preventivas, Viagens, Checklists, Histórico e Cadastro (conforme permissão). Salvar mantém a aba correspondente. Grade mensal recolhida, com rolagem horizontal no celular e coluna de itens fixa.
- Funcionário web: caminhão com a pessoa aparece primeiro; filtros Todos, Disponíveis e Com você. Checklist em etapas de até cinco itens, progresso, respostas por extenso, preservação de respostas/fotos ao voltar e validação antes de avançar. Saída, chegada e fotos mantêm as regras existentes. Histórico recolhido.
- Android nativo: início com três equipes, priorizando a própria e o almoxarifado; busca por equipe/obra, expansão de seis em seis e resumo recolhido. Cabeçalho reúne as opções secundárias em “Mais opções”. O módulo novo de frota permanece no portal web; não foi criado um segundo módulo nativo.

Validação local: suíte web completa com 549 testes passando em 71 arquivos (incluindo 17 testes novos das telas), TypeScript e ESLint dos arquivos alterados sem erros; sete testes Android passaram, incluindo busca, expansão e largura de 320 px com texto ampliado. Análise estática dos quatro arquivos Android alterados sem problemas. A suíte adicional `functional_regressions_test.dart` revelou uma expectativa antiga de consumo (`caixa/un` versus `caixas · unidades`) em arquivos não alterados nesta revisão.

A inspeção visual automatizada no navegador foi bloqueada pela política da ferramenta; não foi contornada. Não houve validação em aparelho físico nem nova distribuição do APK nesta etapa. Prévias locais: Gestão em `http://127.0.0.1:3102/frota` e Funcionário em `http://127.0.0.1:3101/colaborador/frota`.

## Marco 10B — foto do defeito (23/10)
- No app: em cada item do checklist com **N** e na **chegada com problema** aparece "Tirar foto do defeito". A foto é reduzida no celular (1600 px, JPEG) e enviada na hora; uma foto por item e uma por chegada.
- Na Gestão: a ficha do caminhão mostra "Ver foto" no detalhe do checklist (item certo) e na tabela de saídas/chegadas. O link abre a foto por 2 minutos.
- Segurança: balde privado `frota-10b`; arquivo só pela função `fotos-frota-10b` (tipo real JPEG/PNG pelos primeiros bytes, máx. 6 MB, 30 fotos por dia por pessoa); o banco confere quem pode enviar e quem pode abrir (Gestão ou a própria pessoa). Foto só vale para o caminhão, a pessoa e um único uso. Banco: `10b-frota-fotos.sql`. Prova online: `provas-10b-online.mjs` (18 verificações).
- Limites: foto da chegada só até 30 minutos depois de registrar a chegada; se o envio da foto falhar na chegada, a chegada fica registrada e o app avisa para falar com o engenheiro; fotos soltas (enviadas e não usadas) ficam guardadas.

## Marco 10C — defeito vira relato, alerta e aviso (23/10)

- O que o funcionário informa (item "N" com observação e foto no checklist, ou problema e foto na chegada) agora aparece **dentro do cartão da manutenção aberta**: quem, quando, o que foi e "Ver foto". Fica registrado no sistema mesmo sem enviar à oficina.
- A Gestão vê o alerta "Defeito em caminhão" no início (Precisa de você), no painel da Frota e na aba Manutenção do caminhão.
- O celular da Gestão recebe aviso (mesma inscrição dos outros avisos) pela função `fotos-frota-10b`, ação `avisar`: só dispara se a própria pessoa acabou de informar defeito (até 15 min) e sem repetir. Se o aviso falhar, o defeito continua salvo e aparece no painel.
- Banco: `10c-frota-defeitos.sql`. Provas online: `provas-10c-online.mjs` (13/13).
