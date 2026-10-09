# Marco 4G — Jornada da empresa, saldo no espelho e AEJ (09/10/2026)

Teste online, dados fictícios. **Sem valor oficial.**

## Jornada (informada pelo responsável em 09/10)
- Igual para todas as funções: **segunda a quinta 07:00–12:00 e 13:00–17:00 (9 h); sexta 07:00–12:00 e 13:00–16:00 (8 h) = 44 h/semana**. Sábado e domingo sem jornada.
- Todos têm o mesmo horário — por isso a prova de 30 pessoas marcando no mesmo segundo (Marco 4D).
- Gestão › Ponto › Empresa, CPF e AFD › **3. Jornada**: o administrador pode alterar (validado no banco: pares em ordem, 7 dias).

## Espelho com saldo
- Cada dia mostra **previsto**, marcações, horas feitas e **saldo** (+ passou do horário / − faltou tempo).
- **Tolerância da CLT (art. 58 §1º):** até 5 minutos por marcação, no máximo 10 no dia, não contam. **Passou disso, conta a diferença inteira (TST, Súmula 366).**
- Dia útil passado sem marcação aparece como "Sem marcação — falta, folga, atestado ou feriado? Conferir" (não vira falta automática: o sistema ainda não sabe de férias, atestados e feriados).
- Trabalho em sábado/domingo aparece como "Trabalhou em dia sem jornada" (saldo = horas feitas).
- O valor da hora extra (adicional), banco de horas, feriados e atestados ficam com o DP / convenção coletiva.
- App › Meu espelho: mostra o saldo do mês e de cada dia, com o horário da empresa escrito por extenso.

## AEJ (leiaute v002) — prévia
- Gestão › Ponto › Empresa, CPF e AFD › **Baixar AEJ**: registros 01 (empresa), 02 (REP-P), 03 (vínculos com CPF), 04 (horários HC1 seg–qui 540 min e HC2 sexta 480 min),
  05 (marcações: E/S, par, fonte "O", código do horário na 1ª entrada), 08 (programa), 99 (totais) e a linha da assinatura .p7s. Campos separados por "|", ISO-8859-1, CRLF.
- Ainda falta: registro 07 (DSR, faltas, banco de horas) — depende do tratamento pelo DP; INPI e assinatura ICP-Brasil (como no AFD).

## Arquivos e provas
- Banco `teste-online/4g-jornada-aej.sql` (tabela `private.jornada_4g`, RPCs `jornada_padrao_4g` e `admin_set_jornada_4g`, e-mail do desenvolvedor).
- Edge Function `ponto-4d` **v5** (rota `/gestao/aej`).
- Provas `teste-online/provas-4g-online.mjs`: **17/17**. Testes web `10_TESTES/jornada-saldo-4g.test.ts`.
