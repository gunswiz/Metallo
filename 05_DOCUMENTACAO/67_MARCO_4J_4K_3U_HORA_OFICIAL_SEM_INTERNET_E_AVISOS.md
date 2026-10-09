# Marcos 4J, 4K e 3U — hora oficial, ponto sem internet e avisos do funcionário

Tudo no **teste online** (Supabase `cvimwiqokkujfhwynhmt`, dados fictícios). Nada em produção.

## 4J — Hora oficial comprovada

- **Regra:** Portaria 671/2021, Anexo IX, item 2 — o REP-P precisa manter sincronismo com a Hora Legal Brasileira (Observatório Nacional), com no máximo **30 segundos** de diferença.
- **Como funciona:** a cada 10 minutos (pg_cron) a Edge Function `hora-oficial` compara o relógio do banco — que carimba cada marcação — com o **NTP.br** (NIC.br, que distribui a HLB a partir dos relógios atômicos do Observatório Nacional).
- O ambiente das Edge Functions não permite NTP (UDP). Por isso a conferência usa o cabeçalho `Date` do site `https://ntp.br/` por HTTPS, com a técnica da "virada do segundo" (htpdate). O resultado medido ficou em poucos milésimos (ex.: −1 ms ± 14 ms).
- **Registro:** cada conferência é gravada em `ponto.conferencia_hora`, que não pode ser alterada (trigger) e é encadeada por hash.
  - Situações: OK (até 2 s), ATENÇÃO (até 30 s), FORA DO LIMITE, SEM RESPOSTA.
  - Reserva: se o NTP.br não responder, a função tenta o Registro.br (também NIC.br).
- **Na tela:**
  - O app mostra "Hora conferida com a hora oficial do Brasil às HH:MM".
  - A Gestão mostra a situação no painel do ponto e o histórico em *Dados do ponto oficial › 5. Hora oficial*.
- **Para a produção:** recomenda-se uma conferência extra por NTP de verdade (UDP), por exemplo um agendamento do GitHub Actions. Isso fica a confirmar com o jurídico ou o validador.

## 4K — Ponto sem internet

- **Regra:** Portaria 671, Anexo IX, itens 4 e 5.
  - Excepcionalmente, o coletor pode ficar off-line.
  - A marcação deve ser enviada assim que a conexão voltar.
  - No AFD (registro 7, posição 73) ela sai com **"1" = off-line**.
- **App:**
  - O app abre mesmo sem internet. O service worker `sw.js?app=funcionario` guarda as telas e arquivos do app, mas nunca respostas de `/api`.
  - A sessão salva não é derrubada por falta de rede (só o ponto funciona nesse modo).
  - A marcação fica guardada no celular e é enviada sozinha quando a internet volta: no evento "online", a cada 30 s e ao abrir o app.
  - Limite de 20 marcações guardadas por pessoa.
- **Hora da marcação:** nunca é só a do celular.
  - **Relógio contínuo:** hora do servidor mais o tempo decorrido, com a página aberta. Não depende do relógio do celular.
  - **Relógio do celular corrigido:** celular mais o ajuste medido na última conferência, quando a página foi reaberta sem internet.
  - **Sem conferência:** o celular nunca conferiu a hora. A marcação vai para a Gestão conferir.
- **Servidor (`ponto.registrar_offline`):**
  - Recusa:
    - hora no futuro (mais de 5 min);
    - mais de 7 dias sem internet;
    - outra pessoa;
    - repetida em menos de 1 minuto;
    - mais de 12 marcações sem internet no dia.
  - Se a marcação começou com internet e caiu no meio, vale a hora do servidor (mesma chave, sem duplicar).
  - A prova da hora fica em `ponto.marcacao_offline`, que também não pode ser alterada.
  - Se algo não bater, a marcação é aceita **sem mudar a hora**, mas fica marcada "conferir" com o motivo. Exemplos: relógio do celular mudado, conferência antiga, hora incoerente.
- **Gestão:** coluna "Internet" (com/sem) e aviso "N marcações sem internet para conferir", com o motivo em português simples.

## 3U — Avisos no celular do funcionário

- **Ligar:** o próprio funcionário liga em Início (cartão) ou em Meu Perfil, escolhe o que quer receber e pode enviar um aviso de teste.
- **Lembrete do ponto:**
  - Chega na hora de cada marcação da jornada (entrada, almoço, volta, saída), até 5 min depois.
  - Só se a marcação ainda não foi feita.
  - Nunca em feriado, fim de semana ou dia com ocorrência no espelho (férias, atestado, folga…).
- **Outros avisos:**
  - comunicado novo;
  - troca de EPI aprovada ou recusada;
  - pedido de material atendido ou recusado;
  - EPI ou item entregue para confirmar.
  - **Direito à desconexão:** esses só saem dentro do horário de trabalho do dia (de 30 min antes da entrada até a saída). O que chegar fora espera o próximo dia de trabalho e vence em 7 dias.
- **Envio:** a Edge Function `avisos-funcionario` é chamada pelo pg_cron a cada 5 min, com o segredo `metallo_cron_ponto` do Vault. As chaves VAPID ficam só no Vault.
- O app do funcionário ganhou manifesto próprio (`manifest-funcionario.webmanifest`), que abre no Início do funcionário. No iPhone, é preciso instalar na tela de início para receber avisos.

## Provas

- `provas-4k-online.mjs`: **33/33** (hora oficial, sem internet com AFD posição 73, Gestão "conferir", integridade, avisos).
- **SQL, em transação desfeita no fim:**
  - Lembrete às 07:03 de quinta: 1 aviso "entrada (07:00)", e não repete.
  - Não manda lembrete fora da janela nem em feriado (12/10).
  - Horário de trabalho: quinta 10h sim; 19h, domingo e feriado não.
  - Coleta de avisos: 14 (3 comunicados, 10 entregas, 1 pedido). Nenhum sairia às 20h, e não repete.
- **Testes web:** `ponto-sem-internet-4k.test.tsx` mais o ajuste em `ponto-online.test.tsx`.
