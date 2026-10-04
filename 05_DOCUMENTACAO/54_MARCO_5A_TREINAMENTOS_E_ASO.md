# Marco 5A — Treinamentos (NR) e ASO com vencimento

Data: 04/10/2026 · Branch `laboratorio-colaborador` · aplicado no **teste online** (dados fictícios). Produção intocada.

## Por quê
Na montagem industrial, trabalhador com ASO vencido (NR-07) ou treinamento obrigatório vencido/ausente
(NR-35 altura, NR-33 espaço confinado, NR-10, NR-12, NR-18, NR-11…) não deve executar a atividade. A Gestão só
guardava a data do ASO; não havia controle de treinamentos nem aviso de vencimento.

## O que faz
- **Gestão › Pessoas › Treinamentos e ASO** (`/treinamentos`): cartões por funcionário com ASO e cada treinamento
  (verde em dia, amarelo vence em 30 dias, vermelho vencido/faltando), filtros Vencidos / Vencem em 30 dias /
  Faltando / Em dia, busca por nome, registrar treinamento (validade calculada pelo tipo se ficar em branco),
  cancelar registro feito por engano (com motivo; histórico preservado).
- **Tipos e exigências** (`/treinamentos/tipos`, administrador): prazo de reciclagem de cada tipo e quais
  treinamentos cada função precisa ter. Sugestões: NR-35 24 meses, NR-33 12 meses, NR-10 24 meses; demais sem
  prazo fixo. **Conferir com o SESMT antes do uso real.**
- **Início da Gestão**: "Precisa de você" mostra vencidos, faltando e vencendo em 30 dias.
- **Ficha do funcionário**: aba "Treinamentos e ASO".
- **App do Funcionário**: tela "Treinamentos e exames" (resumo em linguagem simples + lista) e pendência na tela
  inicial sem detalhe de saúde ("Exame ou treinamento vencido…").

## Banco (`04_BANCO_E_SUPABASE/laboratorio-marco-5a/contrato-treinamentos-5a.sql`)
- Tabelas em `private` (fora da API): tipos, exigências por função, treinamentos realizados.
- Histórico imutável (gatilho): não apaga, não altera dados; novo registro do mesmo tipo substitui o anterior.
- Funções: `admin_trainings_overview_5a` (só conta ativa da Gestão, escopo de EPI por equipe),
  `admin_training_catalog_5a`, `save_training_type_5a` e `set_profession_trainings_5a` (administrador),
  `register_training_5a` (idempotente) e `cancel_training_5a` (Gestão com EPI na equipe), `my_trainings_5a`
  (próprio funcionário, sem ids internos).
- Dados fictícios: `teste-online/semear-treinamentos-5a.sql`.

## Provas
- `teste-online/provas-5a-online.mjs` → **18/18 OK** (`resultado-5a-online.json`).
- Testes do Web: `10_TESTES/treinamentos-5a.test.tsx` + suíte completa (352).

## Reset do teste online (ordem)
`limpar-dados-teste-online.sql` → `ponto-4d.sql` → `3j-confirmacao-autenticada.sql` →
`laboratorio-marco-5a/contrato-treinamentos-5a.sql` → `semear-teste-online.mjs` → `semear-treinamentos-5a.sql`.

## Também nesta entrega
- Consumo (Gestão): período em botões de um toque, demais filtros em "Mais filtros", resumo do filtro ativo e
  "Registrar consumo" leva a Lançar.
