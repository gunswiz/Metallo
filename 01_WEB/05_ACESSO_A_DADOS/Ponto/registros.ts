import { z } from "zod";
import { TESTE_ONLINE_COLABORADOR_HOST } from "@/09_CONFIGURACOES/ambiente-teste-online";
export const personalRecord = z.object({
  event_id: z.uuid(), reference: z.string().regex(/^(LAB-4A-\d+|LAB-LEGADO-[a-f0-9-]{36})$/i),
  marking_at: z.iso.datetime(), recorded_at: z.iso.datetime(), timezone: z.literal("America/Fortaleza"),
  historical_data: z.literal("LIMITED"), source: z.enum(["4A", "LEGACY"]),
}).strict();
export type PersonalRecord = z.infer<typeof personalRecord>;
// Marco 4D (teste online): o próprio banco do ponto grava NSR, hash da cadeia e nome/matrícula NA HORA da marcação.
// Schema separado: o registro de laboratório continua sem nome retroativo.
export const onlineRecord4d = z.object({
  event_id: z.uuid(), reference: z.string().regex(/^TESTE-4D-\d+$/), marking_at: z.iso.datetime(), recorded_at: z.iso.datetime(),
  timezone: z.literal("America/Fortaleza"), historical_data: z.literal("LIMITED"), source: z.literal("4D"),
  nsr: z.number().int().positive(), payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  employee_name: z.string().min(3).max(140), employee_code: z.string().max(60).nullable(),
}).strict().refine(value => value.reference === `TESTE-4D-${value.nsr}`, "Referência e NSR divergentes.");
export type OnlineRecord4d = z.infer<typeof onlineRecord4d>;
export const anyRecord = z.union([personalRecord, onlineRecord4d]);
export type AnyRecord = PersonalRecord | OnlineRecord4d;
export type RecordFilter = { period: "today" | "48h" | "7d" | "30d" | "60d" | "custom"; from?: string; to?: string; offset?: number };
export const recordPage = z.object({ events: z.array(anyRecord).max(20), has_more: z.boolean(), offset: z.number().int().nonnegative(), window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict() }).strict();
export const recordBatch = z.object({ events: z.array(anyRecord).min(1).max(500), window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict() }).strict();
export async function recordsRequest(path: string, token: string, init: RequestInit = {}) {
  if ((window.location.hostname !== "127.0.0.1" && window.location.host !== TESTE_ONLINE_COLABORADOR_HOST) || !/^\/(list|last48|receipt\/[a-f0-9-]{36})$/i.test(path)) throw new Error("PEDIDO_INVALIDO");
  const response = await fetch(`/api/ponto-registros${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(95000)]) : AbortSignal.timeout(95000) });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(/^[A-Z0-9_]+$/.test(error.error ?? "") ? error.error : "SERVIDOR_INDISPONIVEL"); }
  return response;
}
