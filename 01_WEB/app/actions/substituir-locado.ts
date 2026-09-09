"use server";

import { rentalSwapSchema } from "@/03_FUNCOES_E_LOGICA/validarParidadeMobile";
import { executeValidated, type OperationState } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";

export async function replaceRentedEquipment(_previous: OperationState, formData: FormData) {
  return executeValidated({ schema: rentalSwapSchema, capability: "admin:manage", formData,
    paths: ["/equipamentos", "/equipes", "/dashboard", "/relatorios", "/movimentacoes"],
    destination: (data) => `/equipamentos/${data.assetId}?updated=1`,
    operation: async (client, data) => {
      const result = await client.from("assets").select("*,items(id,code,name)").eq("id", data.assetId).maybeSingle();
      if (result.error) return { error: result.error };
      const asset = result.data;
      if (!asset?.active || !asset.items || !asset.team_id) return { error: { message: "asset_not_found" } };
      if (asset.ownership_type !== "rented" || asset.asset_code === data.assetCode) return { error: { message: "invalid_replacement" } };
      const stamp = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
      const notes = [asset.user_notes, `Substituição em ${stamp}: patrimônio ${asset.asset_code} → ${data.assetCode} • ${data.note}`].filter(Boolean).join("\n");
      // Same Mobile operation: retain the rental record and its history.
      return client.rpc("update_equipment_admin_v2", {
        p_item_id: asset.items.id, p_item_code: asset.items.code, p_item_name: asset.items.name,
        p_asset_id: asset.id, p_asset_code: data.assetCode, p_serial_number: data.serialNumber,
        p_team_id: asset.team_id, p_status: "available", p_active: true, p_user_notes: notes,
        p_ownership_type: "rented", p_rental_company: asset.rental_company ?? "",
        p_rental_start_date: asset.rental_start_date ?? undefined, p_rental_end_date: asset.rental_end_date ?? undefined,
      });
    },
  });
}
