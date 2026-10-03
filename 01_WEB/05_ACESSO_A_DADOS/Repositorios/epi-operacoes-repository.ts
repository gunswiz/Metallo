import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@metallo/types";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { epiReportPayloadSchema } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";

export type ExchangeManagementRow = { request_id: string; employee_name: string; item_name: string; ca_number: string | null; reason: string; note: string | null; request_status: string; requested_at: string; updated_at: string; public_decision: string | null; internal_note: string | null; timeline: { status: string; at: string }[] };
export type PreparedKit3d = { preparation_id: string; employee_id: string; employee_name: string; prepared_at: string; lines: { item_id: string; stock_batch_id: string; quantity: number; item_name: string; unit: string; variant: string | null; ca: string | null }[]; exchange_request_id: string | null; delivery_group_id: string | null };
export type ApprovedExchange3d = { request_id: string; employee_id: string; employee_name: string; item_id: string; item_name: string; source_delivery_id: string; delivery_group_id: string | null };
export type DeliveryFeedback3d = { group_id: string; employee_name: string; delivered_at: string; feedback_status: string | null; item_name: string | null; category: string | null; details: string | null; public_message: string | null; internal_note: string | null };

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
export type Awareness3i = { employee_id: string; employee_name: string; accepted_at: string | null };
export class EpiOperationsRepository {
  constructor(private client: SupabaseClient<Database>) {}
  async report3e(employeeId: string) {
    if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Relatórios 3E disponíveis somente no laboratório local.");
    const result = await this.client.rpc("admin_epi_report_3e" as never, { p_employee_id: employeeId } as never);
    if (result.error) throw new Error(result.error.message);
    return epiReportPayloadSchema.parse(result.data);
  }
  // Marco 3I: aceite do termo de ciência (NR-6, 6.6.1) no escopo da Gestão. Sem employeeId, lista todos do escopo.
  async awareness3i(employeeId: string | null = null): Promise<Awareness3i[]> {
    if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Termo de ciência disponível somente no laboratório local.");
    const result = await this.client.rpc("admin_epi_awareness_3i" as never, { p_employee_id: employeeId } as never);
    if (result.error || !Array.isArray(result.data)) throw new Error("Não foi possível consultar os termos de ciência.");
    return (result.data as Awareness3i[]).filter(row => typeof row.employee_id === "string" && typeof row.employee_name === "string" &&
      (row.accepted_at === null || Number.isFinite(Date.parse(row.accepted_at))));
  }
  async delivery3d() {
    if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Entregas 3D disponíveis somente no laboratório local.");
    const names = ["admin_epi_prepared_kits_3d", "admin_epi_approved_exchanges_3d", "admin_epi_delivery_feedback_3d"] as const;
    const [prepared, approved, feedback] = await Promise.all(names.map(name => this.client.rpc(name as never)));
    if (prepared.error || approved.error || feedback.error || !Array.isArray(prepared.data) || !Array.isArray(approved.data) || !Array.isArray(feedback.data))
      throw new Error("Não foi possível consultar o fluxo local de entrega.");
    return { prepared: prepared.data as PreparedKit3d[], approved: approved.data as ApprovedExchange3d[], feedback: feedback.data as DeliveryFeedback3d[] };
  }
  async kitSuggestion3d(employeeId: string) {
    if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Sugestão disponível somente no laboratório local.");
    const result = await this.client.rpc("admin_epi_kit_suggestion_3d" as never, { p_employee_id: employeeId } as never);
    if (result.error || !Array.isArray(result.data)) throw new Error("Não foi possível consultar a sugestão do kit.");
    return result.data as { item_id: string; item_name: string; unit: string; recommended_quantity: number }[];
  }
  async exchangeRequests(): Promise<ExchangeManagementRow[]> {
    if (!recursosNovosLiberados(getSupabaseEnv().url)) throw new Error("Trocas de EPI disponíveis somente no laboratório local.");
    const result = await this.client.rpc("admin_epi_exchange_requests" as never);
    if (result.error || !Array.isArray(result.data)) throw new Error("Não foi possível consultar as solicitações locais.");
    return result.data as ExchangeManagementRow[];
  }
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
