// Indica se há uma marcação de ponto em andamento nesta aba.
// Usado pela sessão do Colaborador: ao voltar o foco da janela (ex.: diálogo de permissão
// de localização do Chrome) a revalidação não esconde a tela enquanto a marcação não termina.
// Aba oculta, troca de conta e logout continuam encerrando tudo normalmente.
let ativas = 0;

export function iniciarMarcacao(): () => void {
  ativas += 1;
  let encerrada = false;
  return () => { if (!encerrada) { encerrada = true; ativas = Math.max(0, ativas - 1); } };
}

export function marcacaoEmAndamento(): boolean {
  return ativas > 0;
}

// Marco 3J: o mesmo cuidado vale para as telas cheias do Colaborador (confirmar EPI com digital ou senha,
// pedir troca, informar problema). A janela da digital tira o foco da página; ao voltar, a tela não pode sumir.
export const manterTelaDuranteAcao = iniciarMarcacao;
