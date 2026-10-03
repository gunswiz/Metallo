"use server";

import { z } from "zod";
import { batchDeliverySchema, fulfillEpiSchema, kitSchema, requestEpiSchema, replacementSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";

const paths = ["/epis", "/funcionarios", "/ferramentas", "/relatorios", "/dashboard"];
const exchangeActionSchema = z.object({
  requestId: z.uuid(),
  action: z.enum(["EM_ANALISE", "APROVADA", "RECUSADA"]),
  publicMessage: z.string().trim().max(240).default(""),
  internalNote: z.string().trim().max(240).default(""),
}).refine(value => value.action !== "RECUSADA" || !!value.publicMessage, { message: "Informe o motivo público da recusa." });

const preparation3dSchema = z.object({
  employeeId: z.uuid(), lines: batchDeliverySchema.shape.lines,
  idempotencyKey: z.uuid(), exchangeRequestId: z.union([z.uuid(), z.literal("")]).default(""),
});
const register3dSchema = z.object({ preparationId: z.uuid(), idempotencyKey: z.uuid(), confirmation: z.literal("on") });
const feedback3dSchema = z.object({
  groupId: z.uuid(), action: z.enum(["EM_ANALISE", "RESOLVIDA", "RECUSA"]), idempotencyKey: z.uuid(),
  publicMessage: z.string().trim().max(240).default(""), internalNote: z.string().trim().max(240).default(""),
}).refine(value => value.action === "EM_ANALISE" || !!value.publicMessage, { message: "Informe a mensagem ao funcionário." });

export async function prepareEpiKit3d(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: preparation3dSchema, capability: "epi:write", formData,
    paths: ["/epis/entrega-em-lote"], destination: "/epis/entrega-em-lote?prepared=1",
    operation: (client, data) => {
      if (getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Somente laboratório local.");
      return client.rpc("prepare_epi_kit_3d" as never, { p_employee_id: data.employeeId,
        p_lines: data.lines, p_idempotency_key: data.idempotencyKey,
        p_exchange_request_id: data.exchangeRequestId || null } as never);
    },
  });
}
export async function registerEpiDelivery3d(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: register3dSchema, capability: "epi:write", formData,
    paths: ["/epis/entrega-em-lote", "/funcionarios", "/epis"], destination: "/epis/entrega-em-lote?delivered=1",
    operation: (client, data) => {
      if (getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Somente laboratório local.");
      return client.rpc("register_epi_delivery_3d" as never, {
        p_preparation_id: data.preparationId, p_idempotency_key: data.idempotencyKey } as never);
    },
  });
}
export async function manageEpiFeedback3d(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: feedback3dSchema, capability: "epi:write", formData,
    paths: ["/epis/entrega-em-lote"], destination: "/epis/entrega-em-lote?feedback=1",
    operation: (client, data) => {
      if (getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Somente laboratório local.");
      return client.rpc("manage_epi_delivery_feedback_3d" as never, { p_group_id: data.groupId,
        p_action: data.action, p_public_message: data.publicMessage || null,
        p_internal_note: data.internalNote || null, p_idempotency_key: data.idempotencyKey } as never);
    },
  });
}

export async function manageExchangeRequest(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: exchangeActionSchema, capability: "epi:write", formData,
    paths: ["/epis/solicitacoes"], destination: "/epis/solicitacoes?success=exchange",
    operation: async (client, data) => {
      if (getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Somente laboratório local.");
      return client.rpc("manage_epi_exchange_request" as never, {
        p_request_id: data.requestId, p_action: data.action,
        p_public_message: data.publicMessage || null, p_internal_note: data.internalNote || null,
      } as never);
    },
  });
}

export async function requestEpi(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: requestEpiSchema, capability: "epi:write", formData, paths,
    destination: "/epis/solicitacoes?success=requested",
    operation: (client, data) => client.rpc("request_epi_item", {
      p_employee_id: data.employeeId, p_item_id: data.itemId, p_quantity: data.quantity,
      p_requested_variant: data.requestedVariant || undefined,
    }),
  });
}
export async function fulfillEpi(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: fulfillEpiSchema, capability: "epi:write", formData, paths,
    destination: "/epis/solicitacoes?success=fulfilled",
    operation: (client, data) => client.rpc("fulfill_epi_request", { p_request_id: data.requestId, p_stock_batch_id: data.stockBatchId }),
  });
}
export async function saveEmployeeKit(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: kitSchema, capability: "admin:manage", formData, paths,
    destination: (data) => `/funcionarios/${data.employeeId}/kit?success=saved`,
    operation: (client, data) => client.rpc("set_epi_employee_items", { p_employee_id: data.employeeId, p_lines: data.lines }),
  });
}
export async function deliverEpiBatch(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: batchDeliverySchema, capability: "epi:write", formData, paths,
    destination: (data) => `/funcionarios/${data.employeeId}?delivered=1`,
    // A single existing RPC makes the complete delivery atomic, including stock checks.
    operation: (client, data) => client.rpc("register_epi_delivery_batch", {
      p_employee_id: data.employeeId, p_lines: data.lines, p_delivery_reason: data.reason, p_note: data.note || undefined,
    }),
  });
}
export async function updateReplacementDays(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: replacementSchema, capability: "admin:manage", formData, paths,
    destination: (data) => `/epis/${data.itemId}?updated=1`,
    operation: async (client, data) => {
      const result = await client.from("epi_items").update({ replacement_days: data.replacementDays }).eq("id", data.itemId).select("id").maybeSingle();
      return { error: result.error ?? (result.data ? null : { message: "item_not_found" }) };
    },
  });
}
