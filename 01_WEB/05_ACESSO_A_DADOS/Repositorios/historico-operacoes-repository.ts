import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import type { AssetMovementWithRelations } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";
export async function listEquipmentHistory(input: { page: number; pageSize: number; q: string }) {
  await requireCapability("inventory:read");
  let query = (await createClient()).from("asset_movements")
    .select("*,assets(asset_code,items(name,code)),origin:teams!asset_movements_origin_team_id_fkey(id,name),destination:teams!asset_movements_destination_team_id_fkey(id,name),profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
  if (input.q) query = query.ilike("note", `%${input.q.replace(/[%_]/g, " ")}%`);
  const result = await query;
  if (result.error) throw new Error("Não foi possível carregar o histórico de equipamentos.");
  return { data: result.data as unknown as AssetMovementWithRelations[], count: result.count ?? 0, ...input };
}
export async function getMovementForEdit(id: string, kind: "material" | "equipment") {
  await requireCapability("admin:manage");
  const client = await createClient();
  if (kind === "material") {
    const result = await client.from("movements").select("*,items(name)").eq("id", id).maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar a movimentação.");
    if (!result.data) return null;
    const row = result.data;
    return { id: row.id, name: row.items?.name ?? "Material", quantity: row.quantity, originTeamId: row.origin_team_id, destinationTeamId: row.destination_team_id, status: "available", note: row.note, movementType: row.movement_type };
  }
  const result = await client.from("asset_movements").select("*,assets(asset_code)").eq("id", id).maybeSingle();
  if (result.error) throw new Error("Não foi possível carregar a movimentação.");
  if (!result.data) return null;
  const row = result.data;
  return { id: row.id, name: row.assets?.asset_code ?? "Equipamento", quantity: 1, originTeamId: row.origin_team_id, destinationTeamId: row.destination_team_id, status: row.new_status, note: row.note, movementType: row.movement_type };
}
