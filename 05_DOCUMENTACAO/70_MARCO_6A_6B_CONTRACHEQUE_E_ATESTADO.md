# Marcos 6A e 6B — Contracheque no app e atestado pelo app

Ambiente: TESTE ONLINE (Supabase `cvimwiqokkujfhwynhmt`, dados fictícios). Produção não foi tocada.

## Como os arquivos ficam guardados (segurança)
- "Balde" **privado** do Storage `documentos-6` (PDF, JPEG, PNG; até 6 MB). Ninguém acessa direto — nem funcionário, nem Gestão.
- Tudo passa pela Edge Function **`arquivos-6`**:
  1. a permissão é conferida no banco **como a própria pessoa** (RPC com o token dela);
  2. o tipo do arquivo é conferido pelos **primeiros bytes** (o tipo que o celular informa é ignorado) e o tamanho;
  3. o arquivo é gravado com a chave do servidor e o registro é concluído com um **bilhete de uso único** (15 min);
  4. para abrir, o banco confere de quem é e a função devolve um **link que vale 2 minutos**.
- Atestado é dado de saúde (LGPD art. 11): só a própria pessoa e o administrador ativo abrem; não pedimos doença nem CID
  (CID só com autorização do paciente — Res. CFM 1.658/2002).

## 6A — Contracheque
- Gestão: **Pessoas › Contracheques** (`/contracheques`): escolhe o mês, envia o PDF de cada funcionário (Mensal, Adiantamento, Férias, 13º).
  Mandar de novo o mesmo mês/tipo **substitui** (o anterior fica no histórico). Mostra **quando o funcionário abriu**. "Retirar do app" (fica no histórico).
- App: menu **Documentos › Meus contracheques** — toca e abre o PDF. Aviso no celular quando chega um novo.
- Recibo assinado ou comprovante de depósito continuam valendo como prova de pagamento (CLT art. 464).

## 6B — Atestado
- App: **Documentos › Enviar atestado** — "Tirar foto do atestado" (abre a câmera) ou escolher foto/PDF; primeiro dia e quantos dias (botões − e +);
  recado opcional. A foto é **reduzida no celular** (máx. 1600 px) para funcionar com internet fraca e celular antigo. Se a internet cair e reenviar,
  não duplica (chave de envio). Lista dos enviados com a situação; pode cancelar enquanto não foi conferido.
- Gestão: **Pedidos dos funcionários › Atestados** (`/pedidos#atestados`) + aviso no celular da Gestão ("Atestado recebido").
  **Aceitar e lançar no ponto**: cada dia de trabalho do período vira ocorrência "Atestado" no espelho (folga e feriado não contam; mês fechado trava).
  **Recusar** exige motivo; o funcionário vê no app.

## Percentual da hora extra (complemento do 4L)
A empresa paga **60%** — guardado no banco e mostrado na tela de Fechamento e na planilha (dá para mudar lá).

## Banco
`6a-6b-contracheque-atestado.sql`: `private.envios_6`, `private.arquivos_6`, `private.contracheques_6a`, `private.atestados_6b`;
`iniciar_contracheque_6a`, `iniciar_atestado_6b`, `private.concluir_envio_6` (só a função), `abrir_arquivo_6`, `admin_contracheques_6a`,
`admin_remover_contracheque_6a`, `admin_atestados_6b`, `admin_decidir_atestado_6b`, `my_contracheques_6a`, `my_atestados_6b`, `cancelar_atestado_6b`.
Avisos novos: `CONTRACHEQUE`, `ATESTADO`. `4l-percentuais.sql`: `percentuais_dp_4l`, `admin_set_percentuais_dp_4l`.

## Provas
- `provas-6-online.mjs`: **32/32** (envio, duplicado, arquivo falso, data antiga, outra pessoa não abre, Gestão abre, recusar/aceitar, cancelar,
  substituir contracheque, "abriu em", retirar, balde sem acesso direto, conclusão não chamável de fora).
- Prova SQL desfeita: atestado de 5 dias (08 a 12/10) lançou só 08 e 09 (10–11 fim de semana, 12 feriado).
