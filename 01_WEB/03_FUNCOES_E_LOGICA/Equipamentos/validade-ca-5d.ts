// Marco 5D: situação da validade do C.A. do EPI (data AAAA-MM-DD, fuso de Fortaleza).
const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(d);
export function situacaoCa5d(validade: string | null | undefined, agora = new Date()): "vencido" | "vencendo" | "ok" | null {
  if (!validade) return null;
  const hoje = dia(agora), em30 = dia(new Date(agora.getTime() + 30 * 86400000));
  return validade < hoje ? "vencido" : validade <= em30 ? "vencendo" : "ok";
}
