import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PORTAL_STORAGE_KEY = "metallo-colaborador-laboratorio";
export const LAB_URL = "http://127.0.0.1:54321";
export type PersonalProfile = { employee_id: string; full_name: string; profession: string | null; team_name: string | null };
export type PersonalWork = { work_id: string; work_name: string };
export type PersonalTeam = { team_name: string; work_name: string | null; member_count: number; members: { name: string; profession: string }[] };
export type PersonalEpi = { item_name: string; ca_number: string | null; quantity: number; unit: string; variant: string | null; delivered_at: string; delivery_reason: "initial" | "replacement" | "additional"; current_status: "active" | "returned" | "replaced" | "lost" | "damaged" | "consumed"; closed_at: string | null };
export type ExchangeableEpi = { delivery_id: string; item_name: string; ca_number: string | null; variant: string | null; recorded_at: string };
export type ExchangeRequest = { request_id: string; source_delivery_id: string; item_name: string; ca_number: string | null; reason: "DESGASTE" | "DANO" | "PERDA_EXTRAVIO" | "OUTRO"; note: string | null; request_status: "SOLICITADA" | "EM_ANALISE" | "APROVADA" | "RECUSADA" | "CANCELADA"; requested_at: string; updated_at: string; public_decision: string | null; timeline: { status: string; at: string; message: string | null }[] };
export type ExchangeCreateOutcome = { requestId: string; status: ExchangeRequest["request_status"] };
export type PersonalDeliveryGroup3d = {
  group_id: string; delivered_at: string; profession: string;
  feedback_status: "CONFIRMADO" | "DIVERGENCIA" | "EM_ANALISE" | "RESOLVIDA" | null;
  feedback_at: string | null; public_message: string | null;
  items: { delivery_id: string; item_name: string; ca_number: string | null; quantity: number;
    unit: string; variant: string | null; current_status: string }[];
};

// Defesa também no ponto de saída: redirecionamentos, hosts e superfícies amplas são recusados.
export async function portalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const allowed = ["/auth/v1/token", "/auth/v1/user", "/auth/v1/logout", "/auth/v1/health", "/rest/v1/rpc/my_employee_profile", "/rest/v1/rpc/my_current_work", "/rest/v1/rpc/my_team_summary", "/rest/v1/rpc/my_personal_epi", "/rest/v1/rpc/my_exchangeable_epi", "/rest/v1/rpc/my_epi_exchange_requests", "/rest/v1/rpc/create_epi_exchange_request", "/rest/v1/rpc/cancel_epi_exchange_request", "/rest/v1/rpc/my_epi_delivery_groups_3d", "/rest/v1/rpc/respond_epi_delivery_3d", "/rest/v1/rpc/my_epi_report_3e", "/rest/v1/rpc/my_personal_items_3g", "/rest/v1/rpc/confirm_personal_item_3g", "/rest/v1/rpc/report_personal_item_3g", "/rest/v1/rpc/my_communications_3h", "/rest/v1/rpc/open_communication_3h"];
  if (url.origin !== LAB_URL || !allowed.includes(url.pathname)) throw new Error("Destino local não autorizado.");
  return fetch(input, { ...init, cache: "no-store", redirect: "error",
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000) });
}

export function personalProfile(data: unknown): PersonalProfile | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const p = data[0];
  if (!p || Object.keys(p).sort().join() !== "employee_id,full_name,profession,team_name" ||
    typeof p.employee_id !== "string" || typeof p.full_name !== "string" || !p.full_name.trim() ||
    !(p.profession === null || typeof p.profession === "string") || !(p.team_name === null || typeof p.team_name === "string")) return null;
  return { employee_id: p.employee_id, full_name: p.full_name, profession: p.profession, team_name: p.team_name };
}

export function personalWork(data: unknown): PersonalWork | null {
  if (!Array.isArray(data) || data.length > 1) throw new Error("Contrato pessoal de obra inválido.");
  if (data.length === 0) return null;
  const work = data[0];
  if (!work || Object.keys(work).sort().join() !== "work_id,work_name" ||
    typeof work.work_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(work.work_id) ||
    typeof work.work_name !== "string" || !work.work_name.trim()) throw new Error("Contrato pessoal de obra inválido.");
  return { work_id: work.work_id, work_name: work.work_name };
}

export function personalTeam(data: unknown): PersonalTeam | null {
  if (!Array.isArray(data) || data.length > 1) throw new Error("Contrato pessoal de equipe inválido.");
  if (data.length === 0) return null;
  const team = data[0];
  if (!team || Object.keys(team).sort().join() !== "member_count,members,team_name,work_name" ||
    typeof team.team_name !== "string" || !team.team_name.trim() ||
    !(team.work_name === null || (typeof team.work_name === "string" && team.work_name.trim())) ||
    !Number.isSafeInteger(team.member_count) || team.member_count < 1 ||
    !Array.isArray(team.members) || team.members.length !== team.member_count ||
    !team.members.every((member: unknown) => member && typeof member === "object" &&
      Object.keys(member).sort().join() === "name,profession" &&
      typeof (member as {name: unknown}).name === "string" && !!(member as {name: string}).name.trim() &&
      typeof (member as {profession: unknown}).profession === "string" && !!(member as {profession: string}).profession.trim()))
    throw new Error("Contrato pessoal de equipe inválido.");
  return { team_name: team.team_name, work_name: team.work_name, member_count: team.member_count, members: team.members };
}

export function personalEpis(data: unknown): PersonalEpi[] {
  if (!Array.isArray(data)) throw new Error("Contrato pessoal de EPIs inválido.");
  return data.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Contrato pessoal de EPIs inválido.");
    const epi = row as Record<string, unknown>;
    if (Object.keys(epi).sort().join() !== "ca_number,closed_at,current_status,delivered_at,delivery_reason,item_name,quantity,unit,variant" ||
      typeof epi.item_name !== "string" || !epi.item_name.trim() ||
      !(epi.ca_number === null || typeof epi.ca_number === "string") ||
      !Number.isSafeInteger(epi.quantity) || (epi.quantity as number) <= 0 ||
      typeof epi.unit !== "string" || !epi.unit.trim() ||
      !(epi.variant === null || typeof epi.variant === "string") ||
      typeof epi.delivered_at !== "string" || !Number.isFinite(Date.parse(epi.delivered_at)) ||
      !["initial", "replacement", "additional"].includes(String(epi.delivery_reason)) ||
      !["active", "returned", "replaced", "lost", "damaged", "consumed"].includes(String(epi.current_status)) ||
      !(epi.closed_at === null || (typeof epi.closed_at === "string" && Number.isFinite(Date.parse(epi.closed_at)))))
      throw new Error("Contrato pessoal de EPIs inválido.");
    return epi as PersonalEpi;
  });
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";

export function exchangeableEpis(data: unknown): ExchangeableEpi[] {
  if (!Array.isArray(data)) throw new Error("Contrato de troca de EPI inválido.");
  return data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Contrato de troca de EPI inválido.");
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "ca_number,delivery_id,item_name,recorded_at,variant" ||
      typeof row.delivery_id !== "string" || !uuid.test(row.delivery_id) ||
      typeof row.item_name !== "string" || !row.item_name.trim() ||
      !nullableText(row.ca_number) || !nullableText(row.variant) || !date(row.recorded_at))
      throw new Error("Contrato de troca de EPI inválido.");
    return row as ExchangeableEpi;
  });
}

export function exchangeRequests(data: unknown): ExchangeRequest[] {
  if (!Array.isArray(data)) throw new Error("Contrato de solicitações inválido.");
  return data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Contrato de solicitações inválido.");
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "ca_number,item_name,note,public_decision,reason,request_id,request_status,requested_at,source_delivery_id,timeline,updated_at" ||
      typeof row.request_id !== "string" || !uuid.test(row.request_id) ||
      typeof row.source_delivery_id !== "string" || !uuid.test(row.source_delivery_id) ||
      typeof row.item_name !== "string" || !row.item_name.trim() ||
      !nullableText(row.ca_number) || !nullableText(row.note) || !nullableText(row.public_decision) ||
      !["DESGASTE", "DANO", "PERDA_EXTRAVIO", "OUTRO"].includes(String(row.reason)) ||
      !["SOLICITADA", "EM_ANALISE", "APROVADA", "RECUSADA", "CANCELADA"].includes(String(row.request_status)) ||
      !date(row.requested_at) || !date(row.updated_at) || !Array.isArray(row.timeline) ||
      !row.timeline.every((event: unknown) => event && typeof event === "object" &&
        Object.keys(event).sort().join() === "at,message,status" &&
        date((event as Record<string, unknown>).at) && typeof (event as Record<string, unknown>).status === "string" &&
        nullableText((event as Record<string, unknown>).message)))
      throw new Error("Contrato de solicitações inválido.");
    return row as ExchangeRequest;
  });
}

export function personalDeliveryGroups3d(data: unknown): PersonalDeliveryGroup3d[] {
  if (!Array.isArray(data)) throw new Error("Contrato pessoal de entregas inválido.");
  return data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("Contrato pessoal de entregas inválido.");
    const row = value as Record<string, unknown>;
    if (Object.keys(row).sort().join() !== "delivered_at,feedback_at,feedback_status,group_id,items,profession,public_message" ||
      typeof row.group_id !== "string" || !uuid.test(row.group_id) || !date(row.delivered_at) ||
      typeof row.profession !== "string" || !Array.isArray(row.items) || row.items.length < 1 ||
      !(row.feedback_status === null || ["CONFIRMADO", "DIVERGENCIA", "EM_ANALISE", "RESOLVIDA"].includes(String(row.feedback_status))) ||
      !(row.feedback_at === null || date(row.feedback_at)) || !nullableText(row.public_message) ||
      (row.feedback_status === null && (row.feedback_at !== null || row.public_message !== null)) ||
      (row.feedback_status !== null && row.feedback_at === null) ||
      !row.items.every((item: unknown) => {
        if (!item || typeof item !== "object") return false;
        const d = item as Record<string, unknown>;
        return Object.keys(d).sort().join() === "ca_number,current_status,delivery_id,item_name,quantity,unit,variant" &&
          typeof d.delivery_id === "string" && uuid.test(d.delivery_id) &&
          typeof d.item_name === "string" && !!d.item_name.trim() &&
          nullableText(d.ca_number) && nullableText(d.variant) &&
          Number.isSafeInteger(d.quantity) && (d.quantity as number) > 0 &&
          typeof d.unit === "string" && !!d.unit.trim() && typeof d.current_status === "string";
      })) throw new Error("Contrato pessoal de entregas inválido.");
    return row as PersonalDeliveryGroup3d;
  });
}

const disposers = new WeakMap<object, () => void>();
export function disposePortalClient(client: SupabaseClient) {
  disposers.get(client)?.();
  void client.auth.dispose();
}

export function portalClient(anonKey: string) {
  if (typeof window !== "undefined" && !(window.location.hostname === "127.0.0.1" ||
    (window.location.hostname === "localhost" && window.location.port === "3101")))
    throw new Error("Prévia disponível apenas no próprio computador.");
  let active = true;
  const client = createClient(LAB_URL, anonKey, {
    global: { fetch: portalFetch },
    auth: { storageKey: PORTAL_STORAGE_KEY, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false,
      storage: {
        getItem: key => active ? window.localStorage.getItem(key) : null,
        setItem: (key, value) => { if (active) window.localStorage.setItem(key, value); },
        removeItem: key => { if (active) window.localStorage.removeItem(key); },
      },
    },
  });
  disposers.set(client, () => { active = false; });
  return client;
}

export function friendlyPortalError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem conexão. Verifique sua rede e tente novamente.";
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  if (/invalid login credentials|invalid credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/banned|revoked|user not found/i.test(message)) return "Esta conta não tem acesso ativo. Procure a administração.";
  if (/email not confirmed/i.test(message)) return "Esta conta ainda não foi liberada.";
  if (/fetch|network|timeout|abort/i.test(message)) return "Não foi possível conectar ao laboratório. Tente novamente.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
