"use server";

import { batchDeliverySchema, fulfillEpiSchema, kitSchema, requestEpiSchema, replacementSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";

const paths = ["/epis", "/funcionarios", "/ferramentas", "/relatorios", "/dashboard"];

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
