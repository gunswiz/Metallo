"use server";

import { accountCreateSchema, confirmedIdSchema, movementDeleteSchema, movementEditSchema, teamUpdateSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import type { Database } from "@metallo/types";
import { parseUserPermissions } from "@/03_FUNCOES_E_LOGICA/validarPermissoes";

const paths = ["/equipes", "/materiais", "/equipamentos", "/epis", "/ferramentas", "/movimentacoes", "/relatorios", "/consumo", "/dashboard"];
export async function editTeam(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: teamUpdateSchema, capability: "admin:manage", formData, paths,
    destination: (data) => `/equipes/${data.teamId}?updated=1`,
    operation: (client, data) => client.rpc("update_team_admin", { p_team_id: data.teamId, p_name: data.name, p_description: data.description }),
  });
}
export async function removeTeam(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: confirmedIdSchema, capability: "admin:manage", formData, paths,
    destination: "/equipes?removed=1",
    operation: (client, data) => client.rpc("delete_team_admin", { p_team_id: data.id }),
  });
}
export async function deactivateMaterial(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: confirmedIdSchema, capability: "admin:manage", formData, paths,
    destination: "/materiais?removed=1", operation: (client, data) => client.rpc("deactivate_item_admin", { p_item_id: data.id }),
  });
}
export async function deactivateEquipment(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: confirmedIdSchema, capability: "admin:manage", formData, paths,
    destination: "/equipamentos?removed=1", operation: (client, data) => client.rpc("deactivate_asset_admin", { p_asset_id: data.id }),
  });
}
export async function deactivateEpi(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: confirmedIdSchema, capability: "admin:manage", formData, paths,
    destination: "/epis?removed=1", operation: async (client, data) => {
      const result = await client.from("epi_items").update({ active: false }).eq("id", data.id).select("id").maybeSingle();
      return { error: result.error ?? (result.data ? null : { message: "item_not_found" }) };
    },
  });
}
export async function createUserAccount(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: accountCreateSchema, capability: "admin:manage", formData, paths: ["/usuarios"],
    destination: "/usuarios?created=1", operation: async (client, data) => {
      const access = parseUserPermissions(formData);
      if (!access.success) return { error: { message: "invalid_permissions" } };
      const result = await client.functions.invoke("create-employee", { body: {
        full_name: data.fullName, email: data.email, password: data.password, role: data.role, team_id: data.teamId,
        operation_permissions: access.data.operationPermissions, operation_team_ids: access.data.operationTeamIds,
      } });
      return { error: result.error ?? (result.data?.ok === true ? null : { message: "account_creation_failed" }) };
    },
  });
}
export async function editHistory(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: movementEditSchema, capability: "admin:manage", formData, paths,
    destination: (data) => `/movimentacoes?kind=${data.kind}&updated=1`,
    operation: (client, data) => data.kind === "equipment"
      ? client.rpc("admin_update_asset_movement", { p_movement_id: data.id, p_destination_team_id: data.destinationTeamId, p_new_status: data.status!, p_note: data.note })
      : client.rpc("admin_update_material_movement", {
        p_movement_id: data.id, p_quantity: data.quantity!, p_origin_team_id: data.originTeamId || null,
        p_destination_team_id: data.destinationTeamId || null, p_note: data.note,
        // Existing generated RPC types omit nullable team IDs; Mobile sends null for external entry/consumption.
      } as Database["public"]["Functions"]["admin_update_material_movement"]["Args"]),
  });
}
export async function removeHistory(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: movementDeleteSchema, capability: "admin:manage", formData, paths,
    destination: (data) => `/movimentacoes?kind=${data.kind}&removed=1`,
    operation: (client, data) => client.rpc(data.kind === "equipment" ? "admin_delete_asset_movement" : "admin_delete_material_movement", { p_movement_id: data.id }),
  });
}
