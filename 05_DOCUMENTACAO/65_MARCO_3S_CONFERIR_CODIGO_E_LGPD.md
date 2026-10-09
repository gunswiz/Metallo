# Marco 3S — Conferir código de EPI e aviso de privacidade (LGPD) (09/10/2026)

Teste online, dados fictícios.

## Conferir código de EPI
- Gestão › **Conferir código de EPI** (`/conferir-codigo`, quem tem acesso a EPI): cola o "Código de verificação" do PDF (com ou sem espaços).
- Mostra: funcionário, matrícula, se confirmou com **digital** ou **senha pessoal**, quando, a entrega e os itens. Recalcula o SHA-256 do conteúdo guardado:
  "Código confere" (íntegro) ou "Atenção: conteúdo divergente".
- Banco: `teste-online/3s-conferir-codigo-epi.sql` (RPC `conferir_codigo_epi_3s`, só perfil ativo da Gestão; não devolve dados da digital).
- Provas `teste-online/provas-3s-online.mjs`: **5/5** (usa o capacete do João do Marco 3M).

## Aviso de privacidade (LGPD)
- Texto único em linguagem simples (`03_FUNCOES_E_LOGICA/Privacidade/aviso-lgpd.ts`): quem cuida dos dados, quais dados, a digital (nunca sai do celular),
  para quê, base legal (art. 7º II e V), com quem, por quanto tempo, direitos (art. 18) e como protegemos.
- **App** › Minha Conta › **Privacidade (seus dados)**. **Gestão** › **Privacidade (LGPD)**, com os **deveres de quem usa a Gestão**
  (não compartilhar CPF, não escrever doença/CID em observações, etc.).
- **Texto-base de teste**: precisa de revisão do jurídico e do encarregado (DPO); a empresa precisa indicar o encarregado e o prazo de guarda.
- Testes `10_TESTES/conferir-privacidade-3s.test.ts`.
