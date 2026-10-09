# Marco 3P — Lembrete do consumo do dia no celular (08/10/2026)

Teste online, dados fictícios. Produção intocada. Pedido da ADM: o consumo será lançado **todo dia**; o aviso no celular ajuda a não esquecer.

- **Início › Precisa de você**: a partir das 14h (Fortaleza), de segunda a sábado, aparece "Consumo de hoje ainda não lançado" com as
  equipes que faltam — só as que a pessoa pode lançar. Toque leva para **Lançar › Consumo**.
- **Avisos no celular** (Minha conta e, enquanto não estiver ligado, um cartão no Início): botão **Ligar avisos**, **Enviar teste** e **Desligar**.
  Vale por aparelho. Android: Chrome. iPhone (iOS 16.4+): precisa "Adicionar à Tela de Início" e abrir pelo ícone — a tela explica.
- **Lembrete automático**: segunda a sábado, **16h30**, só para quem tem equipe sem consumo lançado no dia.
  Texto: "Consumo de hoje — Ainda falta lançar o consumo de hoje: <equipes>". Tocar abre o lançamento.
- Banco (`teste-online/3p-avisos-celular.sql`): tabela privada `push_subscriptions_3p` (RLS, sem acesso direto), RPCs
  `save_push_subscription_3p` / `delete_push_subscription_3p` / `my_push_count_3p` / `my_teams_without_consumption_today_3p`, `pg_cron`
  (`metallo-lembrete-consumo`, 19h30 UTC) chamando a Edge Function `lembrete-consumo` com segredo lido do Vault.
- Edge Function `lembrete-consumo` (Web Push com VAPID). Chaves privada e segredo do agendamento **só no Vault** (nunca no repositório).
  Assinaturas vencidas (404/410) são apagadas sozinhas.
- `public/sw.js`: só mostra o aviso e abre endereços do próprio Metallo.
- Provas online `teste-online/provas-3p-online.mjs`: **12/12** (agendamento real testado: 200, 1 enviado). Testes web `10_TESTES/avisos-celular-3p.test.tsx` (9).
- Produção: gerar novo par VAPID e novo segredo no Vault do projeto de produção; ajustar a URL do agendamento.
- Fica para depois (ADM): número do contrato e valor real do equipamento alugado.
