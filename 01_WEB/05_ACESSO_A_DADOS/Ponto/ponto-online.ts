import { z } from "zod";
import { TESTE_ONLINE_COLABORADOR_HOST } from "@/09_CONFIGURACOES/ambiente-teste-online";
export const pointReceipt = z.object({ event_id: z.uuid(), synthetic_reference: z.string().regex(/^(LAB-4A|TESTE-4D)-\d+$/), marking_at: z.iso.datetime(), recorded_at: z.iso.datetime(), timezone: z.literal("America/Fortaleza"), collector: z.literal("BROWSER"), online: z.literal(true), location_status: z.enum(["AVAILABLE","LOW_ACCURACY","DENIED","UNAVAILABLE","TIMEOUT","UNKNOWN"]), accuracy_meters: z.number().finite().nonnegative().nullable() }).strict();
export type PointReceipt = z.infer<typeof pointReceipt>;
export const locationLabel: Record<PointReceipt["location_status"], string> = { AVAILABLE: "Localização disponível", LOW_ACCURACY: "Localização com baixa precisão", DENIED: "Permissão de localização negada", UNAVAILABLE: "Localização indisponível", TIMEOUT: "Tempo de localização esgotado", UNKNOWN: "Localização não comprovada" };
export async function onlinePointRequest(path: string, token: string, init: RequestInit = {}) {
  if (typeof window !== "undefined" && window.location.hostname !== "127.0.0.1" && window.location.host !== TESTE_ONLINE_COLABORADOR_HOST) throw new Error("Prévia somente local.");
  if (!/^\/(clock|begin|events|intent\/[a-f0-9-]{36})$/i.test(path) || !token) throw new Error("PEDIDO_INVALIDO");
  const response = await fetch("/api/ponto-online" + path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(65000)]) : AbortSignal.timeout(65000) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? (response.status === 404 ? "NAO_CONFIRMADO" : "SERVIDOR_INDISPONIVEL"));
  return body;
}
