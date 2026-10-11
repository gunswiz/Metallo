// Marco 8A (Bloco 5) — Guia simples do app do funcionário. Começa pelo básico: bater o ponto e ver os avisos.
// O mesmo texto aparece no app (com "Ouvir") e na folha para imprimir da Gestão. Frases curtas, sem palavra difícil.
// **palavra** = destaque (o nome do botão que a pessoa vai ver na tela).

/** Desenho do que a pessoa vai ver na tela (cópia do botão real, sem função). */
export type Figura = "entrar" | "botao-ponto" | "permitir" | "ponto-registrado" | "guardado" | "menu" | "ligar-avisos" | "comunicado" | "instalar";
export type PassoGuia = { texto: string; figura?: Figura };
export type TopicoGuia = { id: string; titulo: string; resumo: string; passos: PassoGuia[]; dicas?: string[] };

export const GUIA_FUNCIONARIO: TopicoGuia[] = [
  { id: "ponto", titulo: "Bater o ponto", resumo: "Leva menos de 1 minuto. Faça na chegada, na saída para o almoço, na volta do almoço e na saída.",
    passos: [
      { texto: "Abra o app Metallo e entre com o seu **usuário** e a sua **senha**. Depois toque em **Entrar**.", figura: "entrar" },
      { texto: "Na tela de início, toque no botão azul **Registrar ponto**. Toque uma vez só.", figura: "botao-ponto" },
      { texto: "Na primeira vez, o celular pergunta se pode usar a localização. Toque em **Permitir**.", figura: "permitir" },
      { texto: "Espere aparecer **Ponto registrado** com a hora. Pronto! A hora fica guardada.", figura: "ponto-registrado" },
    ],
    dicas: ["Esqueceu de bater ou bateu errado? Avise o escritório. Ninguém consegue apagar uma marcação.",
      "Para ver todas as suas batidas, toque em Meus registros, logo abaixo do botão."] },
  { id: "sem-internet", titulo: "Bater o ponto sem internet", resumo: "Pode bater mesmo sem internet. O app guarda e envia sozinho depois.",
    passos: [
      { texto: "Toque em **Registrar ponto** normalmente.", figura: "botao-ponto" },
      { texto: "Vai aparecer que o ponto **ficou guardado neste celular**. A hora que vale é a hora em que você tocou.", figura: "guardado" },
      { texto: "Quando a internet voltar, abra o app. O ponto é enviado sozinho." },
    ],
    dicas: ["Não apague o app nem limpe os dados do navegador enquanto tiver ponto guardado.", "Ficou mais de uma semana sem internet? Avise o escritório."] },
  { id: "avisos", titulo: "Ver os avisos", resumo: "O escritório manda comunicados pelo app. O celular também pode avisar na hora do ponto.",
    passos: [
      { texto: "Para ler os comunicados, toque no **menu** (as três linhas, em cima, do lado esquerdo).", figura: "menu" },
      { texto: "Depois toque em **Comunicados**. Aparecem os que você ainda não leu. Para ver os antigos, toque em **Todos**.", figura: "comunicado" },
      { texto: "Para o celular avisar sozinho, na tela de início toque em **Ligar avisos** e depois em **Permitir**.", figura: "ligar-avisos" },
    ],
    dicas: ["O celular lembra na hora de bater o ponto (só se você ainda não bateu).", "Fora do horário de trabalho, só chega o lembrete do ponto."] },
  { id: "tela-inicio", titulo: "Deixar o app na tela do celular", resumo: "Assim você abre o Metallo como qualquer outro aplicativo.",
    passos: [
      { texto: "Abra o Metallo no **Chrome**. Toque nos **três pontinhos**, no canto de cima, do lado direito.", figura: "instalar" },
      { texto: "Toque em **Adicionar à tela inicial** (ou **Instalar app**) e confirme." },
      { texto: "Pronto: o ícone do Metallo fica junto dos outros aplicativos." },
    ] },
];

/** Texto corrido para o celular ler em voz alta (sem os asteriscos). */
export function textoParaOuvir(t: TopicoGuia) {
  const limpar = (s: string) => s.replace(/\*\*/g, "");
  return [t.titulo + ".", limpar(t.resumo), ...t.passos.map((p, i) => `Passo ${i + 1}. ${limpar(p.texto)}`), ...(t.dicas ?? []).map(limpar)].join(" ");
}

/** Divide "Toque em **Entrar**" em partes normais e em destaque. */
export function partesDestaque(texto: string): { texto: string; destaque: boolean }[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p => p.startsWith("**") ? { texto: p.slice(2, -2), destaque: true } : { texto: p, destaque: false });
}
