# Marco 4H — Feriados e ocorrências do ponto (09/10/2026)

Teste online, dados fictícios. **Sem valor oficial.** As marcações originais nunca são alteradas: ocorrências são o "tratamento".

## Feriados
- Os **10 feriados nacionais de 2026** já vêm cadastrados (Portaria MGI nº 11.460/2025): 01/01, 03/04 Paixão de Cristo, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11 Consciência Negra, 25/12.
  Pontos facultativos (Carnaval, Corpus Christi…) **não** entram: a empresa decide e cadastra como "da empresa" se liberar.
- Gestão › Ponto › Empresa, CPF e AFD › **4. Feriados**: incluir estaduais e municipais (dependem do local da obra; ex.: Data Magna do Ceará 25/03) ou retirar. Retirar = desativar (fica o histórico).
- No espelho, feriado não tem jornada prevista; trabalhar no feriado aparece como "Trabalhou no feriado" com as horas feitas.

## Ocorrências (Gestão › Espelho de ponto › pessoa › dia › "Lançar ocorrência")
- Tipos: **Atestado, Férias, Folga, Falta justificada** (abonam o dia: saldo 0), **Falta (não justificada)** (desconta a jornada do dia) e **Folga no lugar de feriado**.
- Observação opcional, com aviso para **não escrever doença nem CID** (LGPD). Trocar a ocorrência do dia cancela a anterior; "Desfazer" cancela. Nada é apagado: guarda quem e quando.
- A lista do espelho agora mostra **todos os funcionários ativos** (mesmo sem marcação) e a coluna "Conferir" (dias úteis sem marcação nem ocorrência + dias com batida faltando).
- App › Meu espelho: a pessoa vê feriados e as próprias ocorrências (sem a observação interna).

## AEJ
- Registro **07**: domingos do período como **DSR (1)**, **faltas não justificadas (2)** e **folgas no lugar de feriado (4)**. Banco de horas (3) ainda não.
- Edge Function `ponto-4d` **v6**.

## Arquivos e provas
- Banco `teste-online/4h-feriados-ocorrencias.sql` (tabelas privadas `feriados_4h` e `ocorrencias_ponto_4h`; RPCs `feriados_4h`, `admin_*_4h`, `my_ocorrencias_4h`).
- Provas `teste-online/provas-4h-online.mjs`: **12/12**. Testes web `10_TESTES/feriados-ocorrencias-4h.test.ts`.
