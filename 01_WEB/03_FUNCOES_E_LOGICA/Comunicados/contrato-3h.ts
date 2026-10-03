import { z } from "zod";
import { localEventTime } from "@/03_FUNCOES_E_LOGICA/operacoesObra";

const date = z.iso.datetime({ offset: true });
const uuid = z.uuid();
export type CommunicationSaveState3h = { error: string | null };

// Mesmo fuso operacional da Gestão; independe do fuso do browser/processo Node.
export function communicationExpiryLocal3h(value: string): string {
  const instant = new Date(value);
  const milliseconds = instant.getUTCMilliseconds();
  return `${localEventTime(instant)}:${String(instant.getUTCSeconds()).padStart(2, "0")}${milliseconds ? `.${String(milliseconds).padStart(3, "0")}` : ""}`;
}
export function communicationExpiryIso3h(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) throw new Error("Expiração inválida.");
  const zoned = `${value.length === 16 ? `${value}:00` : value}-03:00`;
  if (!date.safeParse(zoned).success) throw new Error("Expiração inválida.");
  return new Date(zoned).toISOString();
}
export const communicationAudience3h = z.enum(["ALL", "TEAM", "WORK"]);
export const communicationInput3h = z.object({
  id: uuid.nullable(),
  title: z.string().trim().min(1).max(120).refine(value => !/[\x00-\x1f<>]/.test(value)),
  message: z.string().trim().min(1).max(4000).refine(value => !/[<>]/.test(value) && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)),
  audience: communicationAudience3h,
  teamId: uuid.nullable(),
  workId: uuid.nullable(),
  pinned: z.boolean(),
  expiresAt: date.nullable(),
  idempotencyKey: uuid,
  expectedVersion: z.number().int().positive().nullable(),
}).refine(value =>
  (value.audience === "ALL" && !value.teamId && !value.workId) ||
  (value.audience === "TEAM" && !!value.teamId && !value.workId) ||
  (value.audience === "WORK" && !!value.workId && !value.teamId),
  { message: "Público inválido." });

export const communicationSummary3h = z.object({
  id: uuid, title: z.string(), audience: communicationAudience3h,
  audience_name: z.string().nullable(), pinned: z.boolean(),
  published_at: date, updated_at: date.nullable(), expires_at: date.nullable(),
  version: z.number().int().positive(), first_viewed_at: date.nullable(),
});
export type CommunicationSummary3h = z.infer<typeof communicationSummary3h>;
export const communicationDetail3h = communicationSummary3h.omit({ expires_at: true }).extend({ message: z.string() });
export type CommunicationDetail3h = z.infer<typeof communicationDetail3h>;
export const adminCommunication3h = communicationSummary3h.omit({ first_viewed_at: true }).extend({
  message: z.string(), team_id: uuid.nullable(), work_id: uuid.nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  created_at: date, published_at: date.nullable(),
  recipient_count: z.number().int().nonnegative(), viewed_count: z.number().int().nonnegative(),
});
export type AdminCommunication3h = z.infer<typeof adminCommunication3h>;
