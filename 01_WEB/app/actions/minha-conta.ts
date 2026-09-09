"use server";

import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { emailUpdateSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
export async function changeMyEmail(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: emailUpdateSchema, capability: "dashboard:read", formData,
    paths: ["/minha-conta"], destination: "/minha-conta?confirmation=sent",
    operation: (client, data) => client.auth.updateUser({ email: data.email }),
  });
}
