# Marco 4L — Fechamento do mês e relatório de horas extras/faltas

Ambiente: TESTE ONLINE (Supabase `cvimwiqokkujfhwynhmt`, dados fictícios). Produção não foi tocada.

## Gestão — tela "Fechamento do mês" (`/ponto-laboratorio/fechamento`)
Uma tela só, com o relatório e o fechamento (para não espalhar função):
- Por pessoa: dias trabalhados, horas, **extra em dia de trabalho (50%)**, **sábado fora da jornada (50%)**, **domingo/feriado trabalhado (100%)**,
  atrasos e saídas antes, faltas, abonos (atestado/férias/folga), **dias para conferir** e aviso de **mais de 2h extras no dia** (CLT art. 59).
- **Baixar planilha** (CSV que abre no Excel) para o DP/contador.
- **Fechar o mês** (só depois que o mês termina). Quem tem dia para conferir só fecha marcando "Fechar mesmo assim".
  **Fechar todos sem pendência** fecha de uma vez quem está em dia.
- O fechamento guarda uma **foto** do espelho (dias e totais). A foto é montada no servidor da Gestão com as mesmas regras do espelho.
  O banco confere se o número de marcações da foto é o de agora (`resumo_desatualizado`).
- Depois de fechado: **atestado, falta e feriado daquele mês ficam travados** até **reabrir** (motivo obrigatório; fica no histórico).
- Se chegar marcação depois do fechamento (ex.: ponto sem internet atrasado), a tela avisa: "reabra e feche de novo".

## App do funcionário
- Início mostra "Confira seu espelho" quando há mês fechado esperando resposta. Aviso no celular (tipo `FECHAMENTO`) para quem ligou os avisos.
- Em **Meu espelho**, o mês fechado mostra os números e dois botões: **Está certo** / **Tem algo errado** (precisa escrever o quê).
  Responde uma vez. A Gestão vê a resposta e o comentário. Texto: "Confirmar não tira o seu direito de reclamar depois."

## Banco (`4l-fechamento-mes.sql`)
`private.fechamento_mes_4l` (um ativo por pessoa/mês), `admin_fechar_mes_4l`, `admin_reabrir_mes_4l`, `admin_fechamentos_4l`,
`my_fechamentos_4l`, `responder_fechamento_4l`; gatilho `trava_mes_fechado_4l` em ocorrências e feriados; novo tipo de aviso `FECHAMENTO`.

## Lei (regra geral, não é parecer)
Hora extra no mínimo 50% (CF art. 7º XVI); domingo/feriado trabalhado sem folga em dobro (Lei 605/49 art. 9º; TST Súmula 146);
limite de 2h extras por dia (CLT art. 59). Convenção coletiva pode mudar percentuais. Banco de horas ainda não entra.

## Provas
- `provas-4l-online.mjs`: **22/22**. Prova SQL desfeita (rollback): mês atual, desatualizado, duplicado, travas, aviso, reabrir.
- Testes web: 61 arquivos, 469 testes; typecheck e lint limpos.
