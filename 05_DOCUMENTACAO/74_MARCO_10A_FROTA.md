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
- Sem foto do defeito (só texto).
- Checklist e saída não funcionam sem internet (sem fila offline).
- Itens críticos são sugestão a confirmar com o engenheiro.
- Não testado em celular real; visual simples para ajuste depois.
