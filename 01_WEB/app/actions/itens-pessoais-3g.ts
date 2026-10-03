"use server";

import { z } from "zod";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { requirePersonalItemLab3g } from "@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g";

const delivery = z.object({ employeeId: z.uuid(), itemId: z.uuid(), quantity: z.coerce.number().int().min(1).max(1000),
  variant: z.string().trim().max(80).default(""), note: z.string().trim().max(240).default(""), idempotencyKey: z.uuid(),
  stockOrigin: z.enum(["STOCK_BATCH", "WITHOUT_STOCK"]),
  stockBatchId: z.union([z.uuid(), z.literal("")]).default(""),
  exceptionReason: z.enum(["EXTERNAL_SUPPLY", "UNTRACKED_LEGACY_STOCK",
    "AUTHORIZED_OPERATIONAL_ADJUSTMENT", "OTHER", ""]).default(""),
  exceptionConfirmed: z.enum(["yes", ""]).default("") }).superRefine((value, context) => {
    if (value.stockOrigin === "STOCK_BATCH" && !value.stockBatchId)
      context.addIssue({ code: "custom", path: ["stockBatchId"], message: "Selecione o lote de estoque." });
    if (value.stockOrigin === "STOCK_BATCH" && (value.exceptionReason || value.exceptionConfirmed))
      context.addIssue({ code: "custom", path: ["exceptionReason"], message: "A entrega com lote não usa exceção." });
    if (value.stockOrigin === "WITHOUT_STOCK" && value.stockBatchId)
      context.addIssue({ code: "custom", path: ["stockBatchId"], message: "Uma entrega excepcional não pode indicar lote." });
    if (value.stockOrigin === "WITHOUT_STOCK" && !value.exceptionReason)
      context.addIssue({ code: "custom", path: ["exceptionReason"], message: "Selecione o motivo da exceção." });
    if (value.stockOrigin === "WITHOUT_STOCK" && value.exceptionConfirmed !== "yes")
      context.addIssue({ code: "custom", path: ["exceptionConfirmed"], message: "Confirme a ausência de baixa do estoque." });
    if (value.stockOrigin === "WITHOUT_STOCK" && value.exceptionReason === "OTHER" && !value.note)
      context.addIssue({ code: "custom", path: ["note"], message: "Descreva o outro motivo." });
  });
const decision = z.object({ requestId: z.coerce.number().int().positive(), action: z.enum(["EXCHANGE_APPROVED", "EXCHANGE_REFUSED"]),
  note: z.string().trim().max(240).default(""), idempotencyKey: z.uuid(), employeeId: z.uuid() });
const closure = z.object({ deliveryId: z.uuid(), employeeId: z.uuid(), action: z.enum(["RETURNED", "REPLACED"]),
  relatedDeliveryId: z.union([z.uuid(), z.literal("")]).default(""), note: z.string().trim().max(240).default(""),
  returnDestination: z.enum(["STOCK_REUSABLE", "EVALUATION", "DAMAGED", "DISCARDED", "OTHER", ""]).default(""),
  idempotencyKey: z.uuid() }).superRefine((value, context) => {
    if ((value.action === "REPLACED") !== !!value.relatedDeliveryId)
      context.addIssue({ code: "custom", path: ["relatedDeliveryId"], message: "Para substituir, selecione a nova entrega correspondente." });
    if (value.action === "RETURNED" ? !value.returnDestination : !!value.returnDestination)
      context.addIssue({ code: "custom", path: ["returnDestination"], message: "Selecione o destino da devolução." });
  });

export async function deliverPersonalItem3g(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: delivery, capability: "epi:write", formData,
    paths: ["/ferramentas", "/funcionarios"], destination: data => `/funcionarios/${data.employeeId}/itens?delivered=1`,
    operation: (client, data) => {
      requirePersonalItemLab3g();
      return client.rpc("deliver_personal_item_3g" as never, { p_employee_id: data.employeeId,
        p_item_id: data.itemId, p_quantity: data.quantity, p_variant: data.variant || null,
        p_note: data.note || null, p_idempotency_key: data.idempotencyKey,
        p_stock_origin: data.stockOrigin, p_stock_batch_id: data.stockBatchId || null,
        p_exception_reason: data.exceptionReason || null,
        p_exception_confirmed: data.exceptionConfirmed === "yes" } as never);
    },
  });
}
export async function decidePersonalItem3g(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: decision, capability: "epi:write", formData,
    paths: ["/ferramentas", "/funcionarios"], destination: data => `/funcionarios/${data.employeeId}/itens?decided=1`,
    operation: (client, data) => {
      requirePersonalItemLab3g();
      return client.rpc("decide_personal_item_3g" as never, { p_request_id: data.requestId,
        p_action: data.action, p_note: data.note || null, p_idempotency_key: data.idempotencyKey } as never);
    },
  });
}
export async function closePersonalItem3g(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: closure, capability: "epi:write", formData,
    paths: ["/ferramentas", "/funcionarios"], destination: data => `/funcionarios/${data.employeeId}/itens?closed=1`,
    operation: (client, data) => {
      requirePersonalItemLab3g();
      return client.rpc("close_personal_item_3g" as never, { p_delivery_id: data.deliveryId,
        p_action: data.action, p_related_delivery_id: data.relatedDeliveryId || null,
        p_note: data.note || null, p_idempotency_key: data.idempotencyKey,
        p_return_destination: data.returnDestination || null } as never);
    },
  });
}
