# 51 · Marco 4D — Meu Ponto online (Postgres próprio) no ambiente de teste

**Situação:** no ar no teste online desde 04/10/2026. Dados fictícios. **Sem valor oficial.** O laboratório (2B/4A/4B/4C) não mudou.

## O que mudou em relação ao laboratório

| | Laboratório (4A–4C) | Teste online (4D) |
|---|---|---|
| Onde fica o ponto | PGlite no PC + diário de integridade em arquivo | Schema `ponto` no Postgres do projeto `metallo-teste`, fora da API pública |
| Servidor | Node local (portas 3105/3106) | Edge Function `ponto-4d` (mesmo contrato HTTP) |
| Quem chama | Rotas `/api/ponto-*` do Colaborador local | As mesmas rotas, no Worker `metallo-teste-colaborador` (endereços fixos no código) |
| Número da marcação | `LAB-4A-n` (referência sintética) | **NSR** sequencial sem buracos (`TESTE-4D-n`) |
| Nome no comprovante | não preservado | nome e matrícula **gravados na hora da marcação** |

## Garantias (no próprio banco)

- **Hora oficial = hora do servidor** no início da marcação (intenção). A mesma chave sempre devolve a mesma hora; intenção com mais de 2 min sem confirmação vence.
- **Originais imutáveis:** gatilhos bloqueiam UPDATE, DELETE e TRUNCATE em intenções e marcações; o contador de NSR só avança de 1 em 1.
- **NSR sem buracos:** um contador único, travado na mesma transação da gravação (escritor único, como no 4C).
- **Cadeia de hash SHA-256:** cada marcação guarda o hash da anterior. `ponto.verificar()` refaz a cadeia inteira e acusa buraco, quebra ou adulteração.
- **Identidade a cada pedido:** sessão do Auth ativa (logout encerra na hora), vínculo pessoal ativo e funcionário ativo.
- **Localização:** opcional; negar não impede o registro. Hora de captura fora de [−10 min, +150 s] da intenção vira "não comprovada" (regra da revisão 4C).

## Provas (resultado-4d-online.json)

37/37: hora do servidor; origem externa, sem login e Gestão pela origem errada recusados; mesma chave = mesma hora;
outra pessoa não usa a intenção alheia; reenvio não duplica; reenvio diferente é conflito; intenção vencida; sessão encerrada;
funcionário inativo; **30 marcações simultâneas em menos de 1 s** com NSR contínuo; alterar/apagar/truncar/mexer no contador bloqueados;
adulteração direta (com gatilho desligado) detectada; schema fora da API; Gestão vê integridade; funcionário não vê a Gestão.
Ponta a ponta pelo site (`conferir-ponto-worker.mjs`): marcação, lista, comprovante PDF, ZIP 48 h e tela da Gestão.

## O que ainda falta para o ponto OFICIAL (Portaria MTP 671/2021, REP-P)

1. Dados reais do empregador (razão social, CNPJ, local) e **CPF** do trabalhador no registro.
2. **AFD** no leiaute oficial (com CRC/assinatura CAdES ICP-Brasil) e **AEJ** para a folha.
3. Comprovante com **assinatura eletrônica ICP-Brasil (PAdES)** e entrega ao trabalhador.
4. **Registro do programa no INPI**, atestado técnico e termo de responsabilidade assinados.
5. Hora legal brasileira comprovada (sincronismo com fonte oficial).
6. Marcação sem internet (fila no aparelho) e foto opcional — decisões de produto pendentes.
7. Revisão com DP/advogado antes de qualquer uso real.

## Arquivos

- Banco: `04_BANCO_E_SUPABASE/teste-online/ponto-4d.sql`
- Servidor: `04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts`
- Web: `05_ACESSO_A_DADOS/Ponto/destino-ponto.ts`, `03_FUNCOES_E_LOGICA/Relatorios/ponto-comprovante-4d.ts`, rotas `/api/ponto-online` e `/api/ponto-registros`, Gestão `/ponto-laboratorio` ("Ponto (teste)").
- Provas: `teste-online/provas-4d-online.mjs`, `teste-online/conferir-ponto-worker.mjs` (usam a conta "Robô de Provas", não as contas da demonstração).
