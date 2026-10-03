import { z } from "zod";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { adminPersonalItem3g, type AdminPersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";

export function requirePersonalItemLab3g() {
  if (getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Marco 3G disponível somente no laboratório local.");
}
export async function readAdminPersonalItems3g(filters: {
  employeeId?: string | null; teamId?: string | null; workId?: string | null; status?: string | null;
} = {}): Promise<AdminPersonalItem3g[]> {
  requirePersonalItemLab3g();
  const client = await createClient();
  const result = await client.rpc("admin_personal_items_3g" as never, {
    p_employee_id: filters.employeeId || null, p_team_id: filters.teamId || null,
    p_work_id: filters.workId || null, p_status: filters.status || null,
  } as never);
  if (result.error) throw result.error;
  return z.array(adminPersonalItem3g).parse(result.data);
}
export async function readPersonalItemCatalog3g() {
  requirePersonalItemLab3g();
  const client = await createClient();
  const result = await client.from("epi_items").select("id,name,unit,code").eq("item_kind", "personal_tool")
    .eq("active", true).order("name");
  if (result.error) throw result.error;
  return z.array(z.object({ id: z.uuid(), name: z.string(), unit: z.string(), code: z.string() })).parse(result.data);
}

export async function readPersonalItemStock3g() {
  requirePersonalItemLab3g();
  const client = await createClient();
  const result = await client.from("epi_stock_batches").select("id,item_id,quantity,variant,lot_number,worksite_id")
    .gt("quantity", 0).order("received_at");
  if (result.error) throw result.error;
  return z.array(z.object({ id: z.uuid(), item_id: z.uuid(), quantity: z.number().int().nonnegative(),
    variant: z.string().nullable(), lot_number: z.string().nullable(), worksite_id: z.uuid().nullable() })).parse(result.data);
}
