# Marco 3M — Código de verificação na ficha de EPI (05/10/2026)

Só no teste online (dados fictícios). Produção intocada. **Sem valor oficial; não é assinatura ICP-Brasil.**

## O que é
Cada confirmação de recebimento de EPI guarda um **código de verificação**: o resumo SHA-256 do conteúdo confirmado
(formato `3F-v1`: versão, transação, funcionário, entrega, data e itens com nome, código, C.A., quantidade, unidade, tamanho, lote, marca).
Se alguém alterar a entrega depois, o código deixa de corresponder.

- **Digital:** o código já era gravado em `private.epi_signature_events_3f` (o celular assina esse conteúdo; a digital não sai do aparelho).
- **Senha:** a Edge Function `assinatura-epi-3f` **v4** passa a montar o mesmo conteúdo e gravar `payload_version`, `payload_canonical`
  e `payload_hash` em `private.epi_confirmacao_senha_3j` (tabela imutável). Confirmações por senha feitas antes disto ficam **sem código**
  — não se calcula depois, para não fingir que existia.

## Onde aparece
- Ficha de EPI em PDF (Gestão › Funcionário › EPI, e no app "Meus EPIs › relatórios"): em cada entrega confirmada,
  "Recebimento confirmado pelo funcionário com a digital / com a senha pessoal em …" e "Código de verificação: XXXX XXXX …"
  (64 caracteres em grupos de 4), mais uma explicação no rodapé "Registro eletrônico". Formato do PDF: `3E-LAB-v4`.
- Trilha técnica (histórico): eventos de confirmação mostram a forma e o código.

## Banco e servidor
- `04_BANCO_E_SUPABASE/teste-online/3m-codigo-verificacao-epi.sql`: colunas novas + `private.epi_report_payload_3e` com `method` e `code` em cada `feedback`.
- Ordem de reset: … → `3j-confirmacao-autenticada.sql` → **`3m-codigo-verificacao-epi.sql`** → contrato 5A → `semear-teste-online.mjs` → …
- Edge Function: `04_BANCO_E_SUPABASE/supabase/functions/assinatura-epi-3f/index.ts` (v4; respostas de confirmação devolvem `code`).

## Provas
- `teste-online/provas-3m-online.mjs`: **11/11** (código de 64 caracteres, igual no banco, refazível pelo SHA-256 do conteúdo, muda se a
  quantidade muda, imutável, Gestão e app recebem o mesmo código, Maria não lê ficha alheia, digital aparece como "digital",
  confirmação antiga continua sem código).
- `10_TESTES/epi-report-3e.test.ts`: 3 testes novos (forma e código no PDF, senha sem código, código inválido recusado).
- Exemplo para a demonstração: `teste-online/exemplo-3m-joao.mjs` (uma entrega fictícia de capacete ao João, confirmada com a senha).
