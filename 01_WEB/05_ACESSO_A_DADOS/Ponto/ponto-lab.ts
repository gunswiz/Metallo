// Contrato exclusivo do ensaio 2B. Nenhuma rota remota ou tabela de Gestão é permitida.
// O navegador usa a origem da prévia; a rota local encaminha só ao núcleo em loopback.
export const PONTO_LAB_URL = "/api/ponto-lab";
export type LabTimeEvent = { event_id: string; server_received_at_utc: string; payload_hash: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function pointRequest(path: string, token: string, init: RequestInit = {}) {
  if (typeof window !== "undefined" && window.location.hostname !== "127.0.0.1") throw new Error("Prévia somente local.");
  if (!/^\/lab-point\/v1\/(events|intent\/[0-9a-f-]{36}|session\/(current|global))$/i.test(path) || path.includes("?") || !token) throw new Error("Contrato do laboratório inválido.");
  const endpoint = path.replace(/^\/lab-point\/v1/, "");
  const response = await fetch(PONTO_LAB_URL + endpoint, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000),
  });
  const body = await response.json();
  return { status: response.status, body };
}
export function parseLabEvent(value: unknown): LabTimeEvent {
  if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== "event_id,payload_hash,server_received_at_utc") throw new Error("Evento de laboratório inválido.");
  const event = value as Record<string, unknown>;
  if (typeof event.event_id !== "string" || !uuid.test(event.event_id) || typeof event.payload_hash !== "string" || !/^[0-9a-f]{64}$/.test(event.payload_hash) || typeof event.server_received_at_utc !== "string" || !Number.isFinite(Date.parse(event.server_received_at_utc))) throw new Error("Evento de laboratório inválido.");
  return { event_id: event.event_id, payload_hash: event.payload_hash, server_received_at_utc: event.server_received_at_utc };
}
