export const POINT_TIMEZONE = "America/Fortaleza";
// Date.now do cliente não participa: relógio de servidor + tempo monotônico decorrido.
export function referenceTime(serverAt: string, receivedMonotonic: number, nowMonotonic: number) {
  const base = Date.parse(serverAt), elapsed = nowMonotonic - receivedMonotonic;
  if (!Number.isFinite(base) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 60000) return null;
  return new Date(base + elapsed);
}
export function pointTime(value: Date | string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: POINT_TIMEZONE, timeStyle: "medium" }).format(new Date(value)); }
export function pointDate(value: Date | string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: POINT_TIMEZONE, dateStyle: "short" }).format(new Date(value)); }
