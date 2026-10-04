# Marco 3J — Colaborador simples (EPIs) e confirmação com digital ou senha

Data: 04/10/2026 · Ambiente: **teste online** (dados fictícios) e laboratório local · Branch `laboratorio-colaborador`.

## Por quê
Na obra há muitos funcionários com pouca prática com celular. A aba "Meus EPIs" era uma lista longa de cartões,
o termo era "mais um cartão", o formulário de troca aparecia no fim da página e a digital não era pedida na aba
de EPIs (só no Perfil). Além disso, era possível confirmar o recebimento sem digital nem senha.

## O que mudou para o funcionário
1. **Termo obrigatório na primeira vez**: ao abrir Meus EPIs, a primeira tela é o termo (NR-6, item 6.6.1).
   O botão "Li e concordo" só libera depois de rolar o texto até o fim. Sem aceitar, a lista nem é consultada.
2. **"Para fazer agora" no topo**: cada entrega pendente aparece com os itens e dois botões grandes:
   **Recebi tudo** e **Falta algo ou veio errado**.
3. **Confirmar exige digital OU senha** (tela cheia, no lugar):
   - já tem digital → um toque em "Confirmar com a digital";
   - não tem → "Usar minha digital" cadastra ali mesmo e, em seguida, um toque confirma (não precisa ir ao Perfil);
   - sempre há "Usar minha senha";
   - aparelho do almoxarifado → **somente senha** (a digital do aparelho não é da pessoa).
4. **Falta algo**: escolhe o item (se houver mais de um) e o problema em botões grandes; escrever é opcional
   (obrigatório só em "Outro problema").
5. **Lista curta** dos EPIs com o botão **Pedir troca** na própria linha → tela cheia com motivos em botões grandes.
   Pedidos em andamento aparecem no topo; cancelar pede confirmação.
6. **Mais opções** guarda histórico, entregas já confirmadas, todos os pedidos, PDF e a data do termo.

## Correção do "a digital não aparece na aba EPIs"
Causa provável: ao voltar o foco para a página (janela da digital), o portal escondia a tela para revalidar a
sessão e o fluxo se perdia. Agora:
- as telas cheias usam o mesmo cuidado já usado no ponto (`manterTelaDuranteAcao`): a revalidação acontece
  sem esconder a tela enquanto a tarefa está aberta;
- o desafio da digital é preparado quando a tela abre, e o toque chama a digital imediatamente
  (celulares exigem que a janela da digital nasça do toque).

## Garantia no servidor (teste online)
- `3j-confirmacao-autenticada.sql` (aplicado no projeto de teste): `respond_epi_delivery_3d` com
  `CONFIRMADO` só funciona quando chamado pela Edge Function (marca `metallo.confirmacao_3j`).
  Divergência continua sem senha.
- Edge Function `assinatura-epi-3f` (v3) ganhou `password_confirm`: confere a senha no Auth, encerra na hora a
  sessão criada para conferir, registra em `private.epi_confirmacao_senha_3j` (imutável, método
  `senha-reautenticacao`) e limita a **5 senhas erradas em 15 minutos** (`private.epi_tentativa_senha_3j`).
- A confirmação pela digital continua sendo a do 3F (WebAuthn, conteúdo assinado com SHA-256).
- Laboratório local (sem a Edge Function): a senha é conferida no Auth local antes de registrar.

## Provas
- Testes automáticos do Web: componentes novos e regras (termo bloqueia, senha obrigatória, aparelho compartilhado
  só senha, digital preparada antes do toque, cadastro no lugar, troca no lugar, falhas sem falso sucesso).
- `provas-3j-online.mjs` (robô de provas, dados fictícios) → `resultado-3j-online.json`.
- `semear-teste-online.mjs` agora confirma a entrega do João pelo mesmo caminho do celular (senha via Edge Function).

## Resultado (04/10/2026)
- Testes do Web: 42 arquivos, 331+ testes, tipos e lint OK; publicação de teste (GitHub Actions) OK.
- `provas-3j-online.mjs`: **20/20 OK** · `provas-3f-online.mjs` (digital): **27/27 OK** após a nova versão da função.
- Conferência visual no navegador (tamanho de celular, conta Maria): termo já aceito, "Para fazer agora",
  tela "Confirmar recebimento" com "Confirmar com a digital" pronto e "Usar minha senha", tela de troca.

## Reset do teste online (ordem)
`limpar-dados-teste-online.sql` → `ponto-4d.sql` → `3j-confirmacao-autenticada.sql` → `semear-teste-online.mjs`.

## Revisão (04/10/2026, tarde)
- **Gestão › Pedidos dos funcionários** (`/pedidos`, item no menu e contador no painel; só laboratório e teste online):
  trocas de EPI, problemas avisados na entrega, itens pessoais (trocas e problemas) e entregas ainda não confirmadas,
  com resposta direta na própria tela. Antes isso ficava espalhado (fim de EPIs › Solicitações, fim de Entrega de EPI,
  ficha de cada funcionário). As ações existentes ganharam o campo opcional `voltar=pedidos`.
- Função do funcionário aparece pelo nome em português (lista de Funcionários, Equipes, ficha EPI e PDF).
- O app passa a se chamar **Funcionário** nas telas (endereço e nomes internos continuam `colaborador` para não
  quebrar links e senhas salvas). Público geral dos comunicados: "Todos os funcionários".
- O nível de acesso "Colaborador" da Gestão (somente leitura) é outra coisa e não foi renomeado.
