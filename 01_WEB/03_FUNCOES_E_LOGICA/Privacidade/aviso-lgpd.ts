// Marco 3S — Aviso de privacidade (LGPD, Lei 13.709/2018) em linguagem simples.
// TEXTO-BASE DE TESTE: precisa ser revisado pelo jurídico e pelo encarregado (DPO) da empresa antes do uso real.
export const VERSAO_AVISO_LGPD = "1 — 09/10/2026 (teste)";

export type SecaoAviso = { titulo: string; itens: string[] };

export const AVISO_LGPD: SecaoAviso[] = [
  { titulo: "Quem cuida dos seus dados", itens: [
    "A empresa onde você trabalha é a responsável (controladora) pelos seus dados no Metallo.",
    "Encarregado de dados (DPO): a empresa vai informar o nome e o contato. Enquanto isso, fale com o escritório.",
  ] },
  { titulo: "Quais dados usamos", itens: [
    "Nome, matrícula, função, equipe e obra.",
    "CPF — exigido por lei no registro do ponto.",
    "Marcações de ponto: data e hora (do servidor, não do celular).",
    "Localização: só no momento de marcar o ponto e só se você permitir. Não rastreamos você durante o dia.",
    "EPIs, fardamento e itens entregues a você, e as suas confirmações.",
    "Treinamentos e exame (ASO): só datas e situação. O resultado médico não fica no Metallo.",
    "Ocorrências do ponto (atestado, férias, folga, falta): só o tipo do dia. Não registramos doença nem CID.",
    "Seu usuário e os registros de acesso ao sistema.",
  ] },
  { titulo: "A sua digital", itens: [
    "A digital nunca sai do seu celular. O Metallo não vê e não guarda a sua digital.",
    "O celular só avisa ao Metallo que foi você quem desbloqueou, para confirmar o recebimento do EPI.",
  ] },
  { titulo: "Para que usamos", itens: [
    "Cumprir a lei trabalhista e de segurança: controle de ponto (CLT e Portaria MTP 671/2021), entrega de EPI (NR-6), treinamentos e exames (NR-7, NR-35 e outras).",
    "Organizar o trabalho nas obras: equipes, materiais, equipamentos e avisos.",
    "Não usamos seus dados para propaganda e não vendemos seus dados.",
  ] },
  { titulo: "Por que podemos usar (base legal)", itens: [
    "Cumprimento de obrigação legal do empregador (LGPD, art. 7º, inciso II).",
    "Execução do contrato de trabalho (LGPD, art. 7º, inciso V).",
  ] },
  { titulo: "Com quem compartilhamos", itens: [
    "Departamento pessoal e contabilidade da empresa, quando necessário para a folha.",
    "Fiscalização do trabalho e Justiça, quando a lei mandar (ex.: arquivos AFD e AEJ do ponto).",
    "Os serviços de computação em nuvem que guardam o sistema, só para fazê-lo funcionar.",
  ] },
  { titulo: "Por quanto tempo guardamos", itens: [
    "Enquanto você trabalhar na empresa e, depois, pelo prazo que a lei trabalhista exige (em geral, 5 anos). O prazo exato será confirmado pelo DP e pelo jurídico.",
    "Registros de ponto não podem ser apagados nem mudados: a lei exige que fiquem guardados como foram feitos.",
  ] },
  { titulo: "Seus direitos", itens: [
    "Saber quais dados temos sobre você e pedir uma cópia.",
    "Pedir correção de dado errado.",
    "Tirar dúvidas sobre como seus dados são usados.",
    "Para isso, fale com o escritório ou com o encarregado. Alguns dados não podem ser apagados enquanto a lei exigir que sejam guardados.",
  ] },
  { titulo: "Como protegemos", itens: [
    "Cada pessoa entra com usuário e senha próprios e vê só o que precisa para a função.",
    "O CPF aparece em parte (***.456.789-**) nas telas da Gestão.",
    "Conexão protegida e registros que não podem ser alterados (o sistema acusa se alguém tentar).",
  ] },
];

/** Deveres de quem usa a Gestão (só aparece na Gestão). */
export const DEVERES_GESTAO: string[] = [
  "Acesse só os dados de que precisa para o seu trabalho.",
  "Não copie, fotografe nem envie CPF, ponto ou dados pessoais por WhatsApp ou e-mail pessoal.",
  "Em observações (ponto, EPI, pedidos), não escreva doença, CID, religião, política ou outros dados sensíveis.",
  "Não compartilhe sua senha. Ao sair do computador, saia da conta.",
  "Se perceber vazamento ou acesso estranho, avise o administrador e o encarregado na hora.",
];
