# Marco 4I — AFD com cadastro da empresa (tipo 2) e dos funcionários (tipo 5) (09/10/2026)

Teste online, dados fictícios. **Sem valor oficial.**

- Toda alteração dos dados da empresa (CNPJ, razão social, local, CNO/CAEPF, responsável) gera um **registro tipo 2**;
  todo CPF incluído, alterado ou retirado gera um **registro tipo 5** (operação I/A/E, CPF, nome, CPF do responsável).
- Esses registros usam **a mesma numeração (NSR) das marcações**, pelo mesmo escritor único, e são **imutáveis** (gatilhos), com **CRC-16/KERMIT**.
- Novo campo na Gestão (Empresa): **CPF do responsável pelos cadastros** (aparece mascarado; em branco mantém o atual). Teste: CPF fictício.
- O AFD agora sai com tipos 1, 2, 5, 7, 9 e a linha da assinatura, em ordem de NSR; o trailer conta cada tipo.
- `ponto.verificar()` confere: NSR contínuo somando marcações e cadastros, sem repetição; as duas correntes das marcações; o CRC de cada cadastro.
- No teste foram gravados os registros iniciais (empresa + 6 funcionários com CPF) em 09/10.
- Banco: `teste-online/4i-afd-tipos-2-e-5.sql` (sem DROP: `admin_set_employer_4i` e `admin_employer_4i` substituem as versões 4f; a antiga não grava mais).
  Edge Function `ponto-4d` **v7**. Provas `teste-online/provas-4i-online.mjs`: **15/15** (e 4F 22/22 de novo). Testes `10_TESTES/afd-cadastros-4i.test.ts`.
- Continua faltando para ser oficial: registro no INPI, assinatura .p7s ICP-Brasil e revisão do DP/advogado.
