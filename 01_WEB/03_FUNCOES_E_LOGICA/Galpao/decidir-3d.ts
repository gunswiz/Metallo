// Login com galpão 3D: decide quando mostrar a animação e quando mostrar o login simples e leve.
// Regra de ouro: quem tem celular antigo ou fraco entra rápido, sem baixar nem desenhar o galpão.
// Função pura (sem tela), para poder provar com teste. A tela só lê os sinais do aparelho e chama esta função.

/** "3d" = mostra a animação. "opcional" = login simples, com o botão "Ver animação". "simples" = login simples, sem animação. */
export type ModoLogin = "3d" | "opcional" | "simples";

export type SinaisAparelho = {
  /** Largura da janela em pixels. */
  largura: number;
  /** "Reduzir movimento" ligado no aparelho. */
  reduzirMovimento: boolean;
  /** "Economia de dados" ligada no aparelho. */
  economiaDados: boolean;
  /** Memória aproximada em GB (navigator.deviceMemory). Ausente = não informada. */
  memoriaGb?: number;
  /** Núcleos do processador (navigator.hardwareConcurrency). Ausente = não informado. */
  nucleos?: number;
  /** Versão principal do Chrome, quando o navegador é Chrome. Ausente = outro navegador ou não informada. */
  versaoChrome?: number;
};

/** Abaixo desta largura (celular), a animação só aparece se a pessoa pedir. */
export const LARGURA_MINIMA_3D = 900;
/** Chrome mais antigo que isto entra sempre no login simples. */
export const CHROME_MINIMO_3D = 90;

export function aparelhoFraco(s: SinaisAparelho): boolean {
  return s.reduzirMovimento || s.economiaDados
    || (s.memoriaGb !== undefined && s.memoriaGb <= 2)
    || (s.nucleos !== undefined && s.nucleos <= 2)
    || (s.versaoChrome !== undefined && s.versaoChrome < CHROME_MINIMO_3D);
}

export function decidirModoLogin(s: SinaisAparelho): ModoLogin {
  if (aparelhoFraco(s)) return "simples";
  return s.largura < LARGURA_MINIMA_3D ? "opcional" : "3d";
}

/** Lê os sinais do aparelho de forma segura (navegador antigo pode não ter alguma destas funções). */
export function lerSinaisAparelho(): SinaisAparelho {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } });
  const chrome = /Chrome\/(\d+)/.exec(nav?.userAgent ?? "");
  const media = (consulta: string) => { try { return typeof window.matchMedia === "function" && window.matchMedia(consulta).matches; } catch { return false; } };
  return {
    largura: window.innerWidth,
    reduzirMovimento: media("(prefers-reduced-motion: reduce)"),
    economiaDados: nav?.connection?.saveData === true,
    memoriaGb: typeof nav?.deviceMemory === "number" ? nav.deviceMemory : undefined,
    nucleos: typeof nav?.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : undefined,
    versaoChrome: chrome ? Number(chrome[1]) : undefined,
  };
}
