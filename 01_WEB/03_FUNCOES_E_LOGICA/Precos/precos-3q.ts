// Marco 3Q: preço por unidade digitado do jeito brasileiro ("12,50", "1.234,5", "R$ 8").
/** Vazio → null (sem preço). Inválido, zero ou negativo → undefined. */
export function lerPrecoBR(texto: string | null | undefined): number | null | undefined {
  const limpo = (texto ?? "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (!limpo) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+\.\d{1,2}$/.test(limpo)) return undefined;
  const numero = /,/.test(limpo) || /^\d{1,3}(\.\d{3})+$/.test(limpo) ? Number(limpo.replace(/\./g, "").replace(",", ".")) : Number(limpo);
  if (!Number.isFinite(numero) || numero <= 0 || numero >= 10_000_000) return undefined;
  return Math.round(numero * 100) / 100;
}

export function mostrarPrecoBR(valor: number | null | undefined) {
  return valor == null ? "" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

export const MENSAGENS_PRECOS_3Q: Record<string, string> = {
  invalido: "Algum preço está escrito de um jeito que o sistema não entende. Use, por exemplo, 12,50.",
  falhou: "Não foi possível salvar agora. Nada foi alterado. Tente de novo.",
  nada: "Nenhum preço foi alterado.",
};
