import { z } from "zod";
export const personalRecord = z.object({
  event_id: z.uuid(), reference: z.string().regex(/^(LAB-4A-\d+|LAB-LEGADO-[a-f0-9-]{36})$/i),
  marking_at: z.iso.datetime(), recorded_at: z.iso.datetime(), timezone: z.literal("America/Fortaleza"),
  historical_data: z.literal("LIMITED"), source: z.enum(["4A", "LEGACY"]),
}).strict();
export type PersonalRecord = z.infer<typeof personalRecord>;
export type RecordFilter = { period: "today" | "48h" | "7d" | "30d" | "60d" | "custom"; from?: string; to?: string; offset?: number };
export const recordPage = z.object({ events: z.array(personalRecord).max(20), has_more: z.boolean(), offset: z.number().int().nonnegative(), window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict() }).strict();
export const recordBatch = z.object({ events: z.array(personalRecord).min(1).max(500), window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict() }).strict();
export async function recordsRequest(path: string, token: string, init: RequestInit = {}) {
  if (window.location.hostname !== "127.0.0.1" || !/^\/(list|last48|receipt\/[a-f0-9-]{36})$/i.test(path)) throw new Error("PEDIDO_INVALIDO");
  const response = await fetch(`/api/ponto-registros${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(95000)]) : AbortSignal.timeout(95000) });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(/^[A-Z0-9_]+$/.test(error.error ?? "") ? error.error : "SERVIDOR_INDISPONIVEL"); }
  return response;
}
