import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@metallo/types";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";

export type EpiChoice = Tables<"epi_items"> & { epi_item_variants: Array<{ value: string; label: string; sort_order: number }> };
export type EmployeeChoice = Tables<"epi_employees"> & { teams: { name: string } | null };
export type RequestRow = Tables<"epi_requests"> & {
  epi_items: { name: string; unit: string; item_kind: string } | null;
  epi_employees: { full_name: string } | null; teams: { name: string } | null;
};
async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; from <= 5000; from += 200) {
    const result = await fetchPage(from, from + 199);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
    if (rows.length > 5000) throw new Error("Muitos registros para este formulário. Solicite uma consulta mais específica.");
    if ((result.data?.length ?? 0) < 200) return rows;
  }
  return rows;
}
export class EpiOperationsRepository {
  constructor(private client: SupabaseClient<Database>) {}
  async choices() {
    const [items, employees, batches] = await Promise.all([
      readAll((from, to) => this.client.from("epi_items").select("*,epi_item_variants(value,label,sort_order)").eq("active", true).order("name").order("id").range(from, to)),
      readAll((from, to) => this.client.from("epi_employees").select("*,teams(name)").eq("active", true).order("full_name").order("id").range(from, to)),
      readAll((from, to) => this.client.from("epi_stock_batches").select("*").gt("quantity", 0).order("received_at").order("id").range(from, to)),
    ]);
    return { items: items as EpiChoice[], employees: employees as EmployeeChoice[], batches };
  }
  async requests(page: number, status: string, employeeId?: string) {
    let query = this.client.from("epi_requests").select("*,epi_items(name,unit,item_kind),epi_employees(full_name),teams(name)", { count: "exact" })
      .order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
    if (["pending", "fulfilled", "cancelled"].includes(status)) query = query.eq("status", status);
    if (employeeId) query = query.eq("employee_id", employeeId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return { data: result.data as RequestRow[], count: result.count ?? 0, page, pageSize: 20 };
  }
  async employeeKit(id: string) {
    const [set, lines, deliveries, pending] = await Promise.all([
      this.client.from("epi_employee_item_sets").select("employee_id").eq("employee_id", id).maybeSingle(),
      readAll((from, to) => this.client.from("epi_employee_items").select("item_id,required_quantity,epi_items(*,epi_item_variants(value,label,sort_order))").eq("employee_id", id).order("item_id").range(from, to)),
      readAll((from, to) => this.client.from("epi_deliveries").select("item_id,quantity").eq("employee_id", id).eq("current_status", "active").order("id").range(from, to)),
      readAll((from, to) => this.client.from("epi_requests").select("item_id,quantity").eq("employee_id", id).eq("status", "pending").order("id").range(from, to)),
    ]);
    if (set.error) throw new Error(set.error.message);
    return { configured: Boolean(set.data), lines, deliveries, pending };
  }
}
export async function getEpiOperations() {
  await requireCapability("epi:read");
  return new EpiOperationsRepository(await createClient());
}
