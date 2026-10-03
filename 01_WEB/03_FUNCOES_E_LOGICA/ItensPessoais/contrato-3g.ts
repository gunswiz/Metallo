import { z } from "zod";

export const personalItem3g = z.object({
  delivery_id: z.uuid(), item_name: z.string().min(1), quantity: z.number().int().positive(), unit: z.string().min(1),
  variant: z.string().nullable(), delivered_at: z.iso.datetime({ offset: true }), confirmed_at: z.iso.datetime({ offset: true }).nullable(),
  status: z.enum(["AGUARDANDO_CONFIRMACAO", "EM_USO", "DANIFICADO", "EXTRAVIADO", "DEVOLVIDO", "SUBSTITUIDO"]),
  events: z.array(z.object({ event_type: z.string(), category: z.string().nullable(),
    note: z.string().nullable(), occurred_at: z.iso.datetime({ offset: true }) })),
});
export type PersonalItem3g = z.infer<typeof personalItem3g>;
export const adminPersonalItem3g = personalItem3g.omit({ events: true }).extend({
  employee_id: z.uuid(), employee_name: z.string().min(1), team_id: z.uuid().nullable(),
  team_name: z.string().nullable(), work_id: z.uuid().nullable(), work_name: z.string().nullable(),
  item_id: z.uuid(), internal_note: z.string().nullable(), delivered_by: z.uuid(),
  stock_origin: z.enum(["LEGACY_PRE_INTEGRATION", "STOCK_BATCH", "WITHOUT_STOCK"]),
  stock_batch_id: z.uuid().nullable(),
  exception_reason: z.enum(["EXTERNAL_SUPPLY", "UNTRACKED_LEGACY_STOCK",
    "AUTHORIZED_OPERATIONAL_ADJUSTMENT", "OTHER"]).nullable(),
  exception_acknowledged_at: z.iso.datetime({ offset: true }).nullable(),
  return_destination: z.enum(["STOCK_REUSABLE", "EVALUATION", "DAMAGED", "DISCARDED", "OTHER"]).nullable(),
  requests: z.array(z.object({
    request_id: z.number().int().positive(), action: z.string(), reason: z.string(), note: z.string().nullable(),
    requested_at: z.iso.datetime({ offset: true }), decision: z.string().nullable(), decision_at: z.iso.datetime({ offset: true }).nullable(),
  })),
});
export type AdminPersonalItem3g = z.infer<typeof adminPersonalItem3g>;
