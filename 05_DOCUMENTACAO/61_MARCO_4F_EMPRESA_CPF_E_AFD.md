# Marco 4F — Empresa, CPF do funcionário e arquivo AFD (09/10/2026)

Teste online, dados fictícios (empresa "METALLO TESTE LTDA (EMPRESA FICTICIA)", CNPJ de exemplo, CPFs gerados só para teste). **Sem valor oficial.**

## O que mudou
- **Gestão › Ponto (teste) › Empresa, CPF e AFD** (`/ponto-laboratorio/oficial`, só administrador):
  1. **Empresa**: CNPJ/CPF, razão social, local, CNO/CAEPF, registro no INPI, CNPJ do desenvolvedor.
  2. **CPF dos funcionários**: a tela mostra só parte do CPF (`***.456.789-**`). Toda troca fica registrada (só os 2 últimos números).
  3. **AFD (prévia)**: escolhe o período e baixa o arquivo no leiaute oficial **v004** (REP-P), em ISO-8859-1 com CRLF.
- **Sem CPF cadastrado a pessoa não marca o ponto** (o AFD exige CPF). No app aparece: "Seu CPF ainda não está cadastrado. Peça ao escritório…".
- Cada marcação nova grava **o CPF na hora** e o **código (hash SHA-256) do AFD**, em corrente própria
  (campos 1 a 7 do registro tipo 7, como saem no arquivo, + hash do registro anterior). `ponto.verificar()` confere as duas correntes.

## AFD gerado
- Tipo 1 (302 posições, CRC-16/KERMIT), tipos 7 (137 posições: NSR, data/hora com segundos 00 e fuso -0300, CPF com 12 posições,
  gravação, coletor 02 = navegador, 0 = on-line, hash), trailer tipo 9 e a linha `ASSINATURA_DIGITAL_EM_ARQUIVO_P7S`.
- Nome: `AFD` + INPI (17) + CNPJ (14) + `REP_P.txt`.

## Ainda falta para ser oficial
- Registro do programa no **INPI** (hoje sai com zeros) e **assinatura .p7s** com certificado ICP-Brasil.
- Registros **tipo 2** (empresa) e **tipo 5** (inclusão/alteração de funcionário) na mesma numeração (NSR) das marcações.
- A forma exata de concatenar os campos no hash não está escrita no leiaute; usamos os campos como aparecem no arquivo — **confirmar com o fornecedor do validador/MTE**.
- AEJ (arquivo da jornada para a folha): depende do **horário contratual** de cada pessoa (DP).
- Marcações antigas (antes do CPF) ficam fora do arquivo. Revisão do DP e de advogado antes de qualquer uso real.

## Arquivos e provas
- Banco: `teste-online/4f-cpf-empregador-afd.sql`; dados fictícios `teste-online/semear-cpf-empregador-4f.sql`.
- Edge Function `ponto-4d` **v4** (rota `POST /gestao/afd`, só admin com sessão viva, origem da Gestão).
- Provas `teste-online/provas-4f-online.mjs`: **22/22** (AFD conferido linha a linha, CRC, hash encadeado, trailer, assinatura).
  Testes web `10_TESTES/ponto-oficial-4f.test.ts`.
