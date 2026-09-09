import { z } from "zod";
import { strongPasswordSchema } from "@metallo/validation";

const uuid = z.uuid("Selecione um registro válido.");
const quantity = z.coerce.number().int().min(1).max(1000);
const note = z.string().trim().max(500).default("");
const jsonLines = z.string().max(50_000).transform((value, ctx): unknown => {
  try { return JSON.parse(value); } catch {
    ctx.addIssue({ code: "custom", message: "Confira os itens selecionados." });
    return z.NEVER;
  }
});

export const requestEpiSchema = z.object({
  employeeId: uuid, itemId: uuid, quantity: z.coerce.number().int().min(1).max(100),
  requestedVariant: z.string().trim().max(80).default(""),
});
export const fulfillEpiSchema = z.object({ requestId: uuid, stockBatchId: uuid });
export const kitLineSchema = z.object({ item_id: uuid, quantity });
export const kitSchema = z.object({
  employeeId: uuid,
  lines: jsonLines.pipe(z.array(kitLineSchema).max(100).refine(
    (lines) => new Set(lines.map((line) => line.item_id)).size === lines.length,
    "Não repita o mesmo item no kit.",
  )),
});
export const batchLineSchema = kitLineSchema.extend({ stock_batch_id: uuid });
export const batchDeliverySchema = z.object({
  employeeId: uuid,
  lines: jsonLines.pipe(z.array(batchLineSchema).min(1, "Adicione pelo menos um item.").max(100).refine(
    (lines) => new Set(lines.map((line) => line.stock_batch_id)).size === lines.length,
    "Junte as quantidades do mesmo lote em uma única linha.",
  )),
  reason: z.enum(["initial", "replacement", "additional"]), note,
});
export const teamUpdateSchema = z.object({
  teamId: uuid, name: z.string().trim().min(2).max(100), description: z.string().trim().max(300).default(""),
});
export const confirmedIdSchema = z.object({ id: uuid, confirmation: z.literal("on", "Confirme a operação para continuar.") });
export const accountCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(140), email: z.email(), password: strongPasswordSchema,
  role: z.enum(["engineer", "leader", "collaborator"]), teamId: uuid,
});
export const emailUpdateSchema = z.object({ email: z.email(), confirmation: z.email() }).refine(
  (value) => value.email === value.confirmation, { message: "Os e-mails não coincidem.", path: ["confirmation"] },
);
export const replacementSchema = z.object({
  itemId: uuid,
  replacementDays: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]).transform((value) => value === "" ? null : value),
});
export const movementEditSchema = z.object({
  id: uuid, kind: z.enum(["material", "equipment"]), note,
  quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
  originTeamId: z.union([uuid, z.literal("")]).default(""),
  destinationTeamId: z.union([uuid, z.literal("")]).default(""),
  status: z.enum(["available", "in_use", "maintenance", "damaged", "lost", "retired"]).optional(),
}).superRefine((value, ctx) => {
  if (value.kind === "material" && (!value.quantity || (!value.originTeamId && !value.destinationTeamId) || (value.originTeamId && value.originTeamId === value.destinationTeamId))) {
    ctx.addIssue({ code: "custom", message: "Informe quantidade positiva e origem/destino diferentes." });
  }
  if (value.kind === "equipment" && (!value.destinationTeamId || !value.status)) {
    ctx.addIssue({ code: "custom", message: "Informe o destino e a situação do equipamento." });
  }
});
export const movementDeleteSchema = confirmedIdSchema.extend({ kind: z.enum(["material", "equipment"]) });
export const rentalSwapSchema = z.object({
  assetId: uuid, assetCode: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().max(120).default(""),
  note: z.string().trim().min(3).max(300),
});
