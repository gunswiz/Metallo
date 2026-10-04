"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { cancelamentoTreinamento5a, exigenciasFuncao5a, registroTreinamento5a, tipoTreinamento5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { requireTreinamentos5a } from "@/05_ACESSO_A_DADOS/Supabase/treinamentos-5a";

// Marco 5A — registrar e cancelar treinamentos; configurar tipos e exigências por função.
const paths = ["/treinamentos", "/funcionarios", "/dashboard"];

export async function registrarTreinamento5a(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: registroTreinamento5a, capability: "epi:write", formData, paths,
    destination: data => data.voltar === "funcionario" ? `/treinamentos?funcionario=${data.employeeId}&ok=1` : "/treinamentos?ok=1",
    operation: (client, data) => {
      requireTreinamentos5a();
      return client.rpc("register_training_5a" as never, { p_employee_id: data.employeeId, p_type_code: data.typeCode,
        p_completed_on: data.completedOn, p_expires_on: data.expiresOn || null, p_provider: data.provider || null,
        p_workload_hours: data.workloadHours === "" ? null : data.workloadHours, p_note: data.note || null,
        p_idempotency_key: data.idempotencyKey } as never);
    } });
}

export async function cancelarTreinamento5a(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: cancelamentoTreinamento5a, capability: "epi:write", formData, paths,
    destination: "/treinamentos?cancelado=1",
    operation: (client, data) => {
      requireTreinamentos5a();
      return client.rpc("cancel_training_5a" as never, { p_id: data.trainingId, p_reason: data.reason } as never);
    } });
}

export async function salvarTipoTreinamento5a(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: tipoTreinamento5a, capability: "admin:manage", formData, paths: ["/treinamentos"],
    destination: "/treinamentos/tipos?ok=1",
    operation: (client, data) => {
      requireTreinamentos5a();
      return client.rpc("save_training_type_5a" as never, { p_code: data.code, p_name: data.name, p_nr: data.nr || null,
        p_validity_months: data.validityMonths === "" ? null : data.validityMonths, p_active: data.active === "on" } as never);
    } });
}

// Caixas de seleção (vários valores com o mesmo nome) não cabem no executeValidated; mesma checagem feita aqui.
export async function salvarExigencias5a(_previous: OperationState, formData: FormData): Promise<OperationState> {
  await requireCapability("admin:manage");
  requireTreinamentos5a();
  const parsed = exigenciasFuncao5a.safeParse({ profession: formData.get("profession"), types: formData.getAll("types") });
  if (!parsed.success) return { error: "Confira a função e os treinamentos marcados." };
  try {
    const result = await (await createClient()).rpc("set_profession_trainings_5a" as never,
      { p_profession: parsed.data.profession, p_type_codes: parsed.data.types } as never);
    if (result.error) return { error: "Não foi possível salvar as exigências desta função." };
  } catch { return { error: "Não foi possível confirmar. Atualize a página antes de tentar novamente." }; }
  for (const path of paths) revalidatePath(path, "layout");
  redirect("/treinamentos/tipos?ok=1");
}
