const aliases: Record<string, string> = {
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un",
  cx: "caixa", cxs: "caixa", caixa: "caixa", caixas: "caixa",
  kg: "kg", quilo: "kg", quilos: "kg", quilograma: "kg", quilogramas: "kg",
  l: "l", litro: "l", litros: "l",
  m: "m", metro: "m", metros: "m",
  pct: "pacote", pacote: "pacote", pacotes: "pacote",
};

const labels: Record<string, [string, string]> = {
  un: ["unidade", "unidades"],
  caixa: ["caixa", "caixas"],
  kg: ["kg", "kg"],
  l: ["litro", "litros"],
  m: ["metro", "metros"],
  pacote: ["pacote", "pacotes"],
};

// Normalize spelling only. A box is never converted into individual pieces.
export function consumptionUnit(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return "sem unidade";
  return aliases[value.toLocaleLowerCase("pt-BR").replace(/\.$/, "")] ?? value;
}

export function consumptionUnitLabel(unit: string, quantity?: number) {
  const forms = labels[unit];
  return forms ? forms[quantity === 1 ? 0 : 1] : unit;
}

export function consumptionQuantity(quantity: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(quantity)} ${consumptionUnitLabel(unit, quantity)}`;
}
