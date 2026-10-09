# Marco 4E — Espelho de ponto (09/10/2026)

Teste online, dados fictícios. **Sem valor oficial.** Os registros originais não são alterados.

- **Gestão › Ponto (teste) › Espelho de ponto do mês** (`/ponto-laboratorio/espelho`, só administrador):
  lista de quem marcou no mês (dias com marcação, horas registradas, dias com "falta marcar") e, ao abrir uma pessoa,
  o espelho dia a dia (horários, horas do dia, observação), com total e botão **Imprimir ou salvar PDF**.
- **App › Meu Ponto › Meu espelho do mês**: a própria pessoa vê seus dias, horários e horas, mês a mês, com aviso quando falta uma marcação.
- Regra: horas = tempo entre pares de marcações (1ª–2ª, 3ª–4ª…), em minutos inteiros, no fuso de Fortaleza.
  Dia com número ímpar de marcações = "falta marcar" (hoje não conta, ainda está em andamento).
  **Não calcula** hora extra, adicional noturno, intervalo ou banco de horas — dependem da jornada e da convenção (DP).
  Jornada que passa da meia-noite aparece dividida entre os dois dias (limite conhecido).
- Servidor: Edge Function `ponto-4d` **v3** com duas rotas novas, só leitura:
  `POST /gestao/espelho` (admin ativo + sessão viva, origem da Gestão) e `POST /v4b/espelho` (só as marcações da própria pessoa, vínculo conferido no início e no fim).
  Sem localização e sem hash no espelho.
- Provas online `teste-online/provas-4e-online.mjs`: **14/14**. Testes web `10_TESTES/espelho-ponto-4e.test.ts`.
- Marcações não podem ser criadas com data passada (hora do servidor): o espelho de demonstração mostra só o que for marcado de verdade no teste.
