import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PageResult, Tables } from "@metallo/types";

import { siteSnapshotSchema, type SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";

type Client = SupabaseClient<Database>;
type PageInput = { page: number; pageSize: number; q: string };
export type AnalyticsFilter = { from: string; to: string; teamId?: string; itemId?: string };

export type ItemWithInventory = Tables<"items"> & {
  inventory: Array<Tables<"inventory"> & { teams: Pick<Tables<"teams">, "id" | "name"> | null }>;
};
export type AssetWithRelations = Tables<"assets"> & {
  items: Pick<Tables<"items">, "id" | "name" | "code" | "category"> | null;
  teams: Pick<Tables<"teams">, "id" | "name"> | null;
};
export type MovementWithRelations = Tables<"movements"> & {
  items: Pick<Tables<"items">, "name" | "code" | "unit"> | null;
  origin: Pick<Tables<"teams">, "id" | "name"> | null;
  destination: Pick<Tables<"teams">, "id" | "name"> | null;
  profiles: Pick<Tables<"profiles">, "full_name"> | null;
};
export type AssetMovementWithRelations = Tables<"asset_movements"> & {
  assets: (Pick<Tables<"assets">, "asset_code"> & {
    items: Pick<Tables<"items">, "name" | "code"> | null;
  }) | null;
  origin: Pick<Tables<"teams">, "id" | "name"> | null;
  destination: Pick<Tables<"teams">, "id" | "name"> | null;
  profiles: Pick<Tables<"profiles">, "full_name"> | null;
};
export type EpiItemWithStock = Tables<"epi_items"> & {
  epi_stock_batches: Array<Pick<Tables<"epi_stock_batches">, "id" | "quantity" | "variant" | "ca_number" | "brand_model"> & { worksite_id: string | null }>;
  epi_item_variants: Array<Pick<Tables<"epi_item_variants">, "value" | "label" | "sort_order">>;
};
export type EmployeeWithTeam = Tables<"epi_employees"> & {
  working_team_id: string | null;
  working_team_name: string;
  teams: Pick<Tables<"teams">, "id" | "name"> | null;
};
export type ProfileWithTeam = Tables<"profiles"> & {
  teams: Pick<Tables<"teams">, "id" | "name"> | null;
};
export type ConsumptionRow = Pick<Tables<"movements">, "id" | "item_id" | "origin_team_id" | "quantity" | "created_at" | "note"> & {
  items: Pick<Tables<"items">, "id" | "name" | "code" | "unit" | "category"> | null;
  origin: Pick<Tables<"teams">, "id" | "name"> | null;
};
export type EpiDeliveryReportRow = Pick<Tables<"epi_deliveries">,
  | "id"
  | "quantity"
  | "delivered_at"
  | "delivered_by"
  | "closed_at"
  | "closed_by"
  | "current_status"
  | "delivery_reason"
  | "variant_snapshot"
  | "ca_snapshot"
  | "brand_model_snapshot"
  | "lot_snapshot"
  | "note"
> & {
  epi_items: Pick<Tables<"epi_items">, "name" | "code" | "item_kind" | "unit"> | null;
  epi_employees: Pick<Tables<"epi_employees">, "id" | "full_name" | "registration_code" | "profession"> | null;
  teams: Pick<Tables<"teams">, "id" | "name"> | null;
};
export type EpiReportFilter = { from: string; to: string; teamId?: string; employeeId?: string };
export type EpiReportData = {
  deliveries: EpiDeliveryReportRow[];
  actorNames: Record<string, string>;
  truncated: boolean;
};

function range({ page, pageSize }: PageInput) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function safeTerm(q: string) {
  return q.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("record_not_found");
  return data;
}

export class MetalloRepository {
  constructor(private readonly client: Client) {}
  private snapshotPromise?: Promise<SiteSnapshot>;
  siteSnapshot() {
    return this.snapshotPromise ??= (async () => {
      const { data, error } = await this.client.rpc("site_dashboard");
      if (error) throw new Error(error.message);
      return siteSnapshotSchema.parse(data);
    })();
  }
  private async workingEmployees(rows: EmployeeWithTeam[]) {
    const snapshot = await this.siteSnapshot();
    return rows.map(employee => {
      const teamId = snapshot.employees.find(person => person.id === employee.id)?.team_id ?? employee.team_id;
      return { ...employee, working_team_id: teamId, working_team_name: snapshot.teams.find(team => team.id === teamId)?.name ?? employee.teams?.name ?? "Sem equipe" };
    });
  }

  async dashboard(includeEpi: boolean) {
    const base = [
      this.client.from("inventory").select("quantity").gt("quantity", 0),
      this.client.from("assets").select("id,status").eq("active", true),
      this.client.from("teams").select("id", { count: "exact", head: true }).eq("active", true),
      this.client.from("movements").select("id,item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by,created_at,occurred_at,items(name,code,unit),origin:teams!movements_origin_team_id_fkey(id,name),destination:teams!movements_destination_team_id_fkey(id,name),profiles(full_name)").order("created_at", { ascending: false }).limit(6),
    ] as const;

    const [inventory, assets, teams, movements, employees, deliveries] = await Promise.all([
      ...base,
      includeEpi ? this.client.from("epi_employees").select("id", { count: "exact", head: true }).eq("active", true) : Promise.resolve({ count: null, error: null }),
      includeEpi ? this.client.from("epi_deliveries").select("id", { count: "exact", head: true }).eq("current_status", "active") : Promise.resolve({ count: null, error: null }),
    ]);

    for (const result of [inventory, assets, teams, movements, employees, deliveries]) {
      if (result.error) throw new Error(result.error.message);
    }
    const inventoryRows = inventory.data ?? [];
    const assetRows = assets.data ?? [];
    return {
      materialUnits: inventoryRows.reduce((sum, row) => sum + row.quantity, 0),
      assets: assetRows.length,
      assetsInUse: assetRows.filter((row) => row.status === "in_use").length,
      teams: teams.count ?? 0,
      employees: employees.count ?? 0,
      epiDeliveries: deliveries.count ?? 0,
      recentMovements: (movements.data ?? []) as unknown as MovementWithRelations[],
    };
  }

  async listMaterials(input: PageInput): Promise<PageResult<ItemWithInventory>> {
    const { from, to } = range(input);
    let query = this.client
      .from("items")
      .select("*,inventory(*,teams(id,name))", { count: "exact" })
      .eq("item_type", "material")
      .eq("active", true)
      .order("name")
      .range(from, to);
    const term = safeTerm(input.q);
    if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,category.ilike.%${term}%`);
    const { data, count, error } = await query;
    return { data: unwrap(data, error) as unknown as ItemWithInventory[], count: count ?? 0, ...input };
  }

  async getMaterial(id: string) {
    const [item, movements] = await Promise.all([
      this.client
        .from("items")
        .select("*,inventory(*,teams(id,name))")
        .eq("id", id)
        .eq("item_type", "material")
        .maybeSingle(),
      this.client
        .from("movements")
        .select("id,item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by,created_at,occurred_at,items(name,code,unit),origin:teams!movements_origin_team_id_fkey(id,name),destination:teams!movements_destination_team_id_fkey(id,name),profiles(full_name)")
        .eq("item_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      item: unwrap(item.data, item.error) as unknown as ItemWithInventory,
      movements: unwrap(movements.data, movements.error) as unknown as MovementWithRelations[],
    };
  }

  async listAssets(input: PageInput & { ownership?: string }): Promise<PageResult<AssetWithRelations>> {
    const { from, to } = range(input);
    let query = this.client
      .from("assets")
      .select("*,items!inner(id,name,code,category),teams(id,name)", { count: "exact" })
      .eq("active", true)
      .eq("items.item_type", "equipment")
      .order("created_at", { ascending: false })
      .range(from, to);
    if (input.ownership === "owned" || input.ownership === "rented") query = query.eq("ownership_type", input.ownership);
    const term = safeTerm(input.q);
    if (term) {
      const itemMatches = await this.client.from("items").select("id").eq("item_type", "equipment").eq("active", true).or(`name.ilike.%${term}%,code.ilike.%${term}%,category.ilike.%${term}%`).limit(100);
      if (itemMatches.error) throw new Error(itemMatches.error.message);
      const itemIds = (itemMatches.data ?? []).map((item) => item.id);
      const itemFilter = itemIds.length > 0 ? `,item_id.in.(${itemIds.join(",")})` : "";
      query = query.or(`asset_code.ilike.%${term}%,serial_number.ilike.%${term}%,rental_company.ilike.%${term}%${itemFilter}`);
    }
    const { data, count, error } = await query;
    return { data: unwrap(data, error) as unknown as AssetWithRelations[], count: count ?? 0, ...input };
  }

  async getAsset(id: string) {
    const asset = await this.client
      .from("assets")
      .select("*,items!inner(id,name,code,category,description),teams(id,name)")
      .eq("id", id)
      .maybeSingle();
    const movements = await this.client
      .from("asset_movements")
      .select("*,assets(asset_code,items(name,code)),origin:teams!asset_movements_origin_team_id_fkey(id,name),destination:teams!asset_movements_destination_team_id_fkey(id,name),profiles(full_name)")
      .eq("asset_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      asset: unwrap(asset.data, asset.error) as unknown as AssetWithRelations & { items: Tables<"items"> },
      movements: unwrap(movements.data, movements.error) as unknown as AssetMovementWithRelations[],
    };
  }

  async listEpiItems(input: PageInput, kind?: string): Promise<PageResult<EpiItemWithStock>> {
    const { from, to } = range(input);
    let query = this.client
      .from("epi_items")
      .select("*,epi_stock_batches(id,quantity,variant,ca_number,brand_model,worksite_id),epi_item_variants(value,label,sort_order)", { count: "exact" })
      .eq("active", true)
      .order("name")
      .range(from, to);
    if (kind) query = query.eq("item_kind", kind);
    const term = safeTerm(input.q);
    if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%,ca_number.ilike.%${term}%`);
    const { data, count, error } = await query;
    return { data: unwrap(data, error) as unknown as EpiItemWithStock[], count: count ?? 0, ...input };
  }

  async getEpiItem(id: string) {
    const [item, deliveries] = await Promise.all([
      this.client
        .from("epi_items")
        .select("*,epi_stock_batches(id,quantity,variant,ca_number,brand_model,lot_number,received_at,worksite_id),epi_item_variants(value,label,sort_order)")
        .eq("id", id)
        .maybeSingle(),
      this.client
        .from("epi_deliveries")
        .select("id,quantity,delivered_at,current_status,variant_snapshot,epi_employees(id,full_name),teams(id,name)")
        .eq("item_id", id)
        .order("delivered_at", { ascending: false })
        .limit(50),
    ]);
    return {
      item: unwrap(item.data, item.error) as unknown as Omit<EpiItemWithStock, "epi_stock_batches"> & {
        epi_stock_batches: Array<Pick<Tables<"epi_stock_batches">, "id" | "quantity" | "variant" | "ca_number" | "brand_model" | "lot_number" | "received_at"> & { worksite_id: string | null }>;
      },
      deliveries: unwrap(deliveries.data, deliveries.error),
    };
  }

  async listTeams() {
    const { data, error } = await this.client.from("teams").select("*").eq("active", true).order("location_type").order("name");
    return unwrap(data, error);
  }

  async listProfessions() {
    const { data, error } = await this.client.from("epi_professions").select("*").eq("active", true).order("sort_order").order("name");
    return unwrap(data, error);
  }

  async getTeam(id: string) {
    const snapshot = await this.siteSnapshot();
    const teamContext = snapshot.teams.find(team => team.id === id);
    const work = snapshot.works.find(work => work.id === teamContext?.worksite_id);
    const stockTeamId = work?.stock_team_id ?? id;
    const employeeIds = snapshot.employees.filter(person => person.team_id === id || person.home_team_id === id).map(person => person.id);
    const [team, inventory, assets, employees, movements] = await Promise.all([
      this.client.from("teams").select("*").eq("id", id).maybeSingle(),
      this.client.from("inventory").select("*,items(name,code,unit)").eq("team_id", stockTeamId).gt("quantity", 0).order("quantity", { ascending: false }),
      this.client.from("assets").select("*,items(name,code,category)").eq("team_id", id).eq("active", true),
      this.client.from("epi_employees").select("*,teams(id,name)").in("id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]).eq("active", true).order("full_name"),
      this.client.from("movements").select("id,item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by,created_at,occurred_at,items(name,code,unit),origin:teams!movements_origin_team_id_fkey(id,name),destination:teams!movements_destination_team_id_fkey(id,name),profiles(full_name)").or(`origin_team_id.eq.${id},destination_team_id.eq.${id}`).order("created_at", { ascending: false }).limit(12),
    ]);
    return {
      workName: work?.name ?? teamContext?.name ?? "Local",
      stockTeamId,
      team: unwrap(team.data, team.error),
      inventory: unwrap(inventory.data, inventory.error),
      assets: unwrap(assets.data, assets.error),
      employees: await this.workingEmployees(unwrap(employees.data, employees.error) as unknown as EmployeeWithTeam[]),
      movements: unwrap(movements.data, movements.error) as unknown as MovementWithRelations[],
    };
  }

  async listEmployees(input: PageInput): Promise<PageResult<EmployeeWithTeam>> {
    const { from, to } = range(input);
    let query = this.client.from("epi_employees").select("*,teams(id,name)", { count: "exact" }).eq("active", true).order("full_name").range(from, to);
    const term = safeTerm(input.q);
    if (term) query = query.or(`full_name.ilike.%${term}%,registration_code.ilike.%${term}%,profession.ilike.%${term}%`);
    const { data, count, error } = await query;
    return { data: await this.workingEmployees(unwrap(data, error) as unknown as EmployeeWithTeam[]), count: count ?? 0, ...input };
  }

  async getEmployee(id: string) {
    const [employee, deliveries, requests] = await Promise.all([
      this.client.from("epi_employees").select("*,teams(id,name)").eq("id", id).maybeSingle(),
      this.client.from("epi_deliveries").select("*,epi_items(name,code,item_kind,unit)").eq("employee_id", id).order("delivered_at", { ascending: false }).limit(100),
      this.client.from("epi_requests").select("*,epi_items(name,code,item_kind,unit)").eq("employee_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      employee: (await this.workingEmployees([unwrap(employee.data, employee.error) as unknown as EmployeeWithTeam]))[0],
      deliveries: unwrap(deliveries.data, deliveries.error),
      requests: unwrap(requests.data, requests.error),
    };
  }

  async listMovements(input: PageInput): Promise<PageResult<MovementWithRelations>> {
    const { from, to } = range(input);
    let query = this.client
      .from("movements")
      .select("id,item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by,created_at,occurred_at,items(name,code,unit),origin:teams!movements_origin_team_id_fkey(id,name),destination:teams!movements_destination_team_id_fkey(id,name),profiles(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    const term = safeTerm(input.q);
    if (term) query = query.ilike("note", `%${term}%`);
    const { data, count, error } = await query;
    return { data: unwrap(data, error) as unknown as MovementWithRelations[], count: count ?? 0, ...input };
  }

  async consumptionRows(filter: AnalyticsFilter): Promise<ConsumptionRow[]> {
    let query = this.client
      .from("movements")
      .select("id,item_id,origin_team_id,quantity,created_at:occurred_at,note,items!inner(id,name,code,unit,category),origin:teams!movements_origin_team_id_fkey(id,name)")
      .eq("movement_type", "consumption")
      .gte("occurred_at", filter.from)
      .lt("occurred_at", filter.to)
      .order("occurred_at", { ascending: true })
      .limit(5000);
    if (filter.teamId) query = query.eq("origin_team_id", filter.teamId);
    if (filter.itemId) query = query.eq("item_id", filter.itemId);
    const { data, error } = await query;
    return unwrap(data, error) as unknown as ConsumptionRow[];
  }

  async reportData(filter: AnalyticsFilter, includeEpi: boolean) {
    let materialQuery = this.client
      .from("movements")
      .select("id,item_id,origin_team_id,destination_team_id,quantity,movement_type,note,performed_by,created_at,occurred_at,items(name,code,unit),origin:teams!movements_origin_team_id_fkey(id,name),destination:teams!movements_destination_team_id_fkey(id,name),profiles(full_name)")
      .gte("created_at", filter.from).lt("created_at", filter.to)
      .order("created_at", { ascending: false }).limit(300);
    let assetQuery = this.client
      .from("asset_movements")
      .select("*,assets(asset_code,ownership_type,rental_company,items(name,code)),origin:teams!asset_movements_origin_team_id_fkey(id,name),destination:teams!asset_movements_destination_team_id_fkey(id,name),profiles(full_name)")
      .gte("created_at", filter.from).lt("created_at", filter.to)
      .order("created_at", { ascending: false }).limit(300);
    let deliveryQuery = this.client
      .from("epi_deliveries")
      .select("id,quantity,delivered_at,current_status,delivery_reason,variant_snapshot,epi_items(name,code,item_kind,unit),epi_employees(full_name),teams(id,name)")
      .gte("delivered_at", filter.from).lt("delivered_at", filter.to)
      .order("delivered_at", { ascending: false }).limit(300);
    let currentAssetsQuery = this.client
      .from("assets")
      .select("*,items!inner(id,name,code,category),teams(id,name)")
      .eq("active", true).eq("items.item_type", "equipment")
      .order("created_at", { ascending: false }).limit(1000);
    if (filter.teamId) {
      materialQuery = materialQuery.or(`origin_team_id.eq.${filter.teamId},destination_team_id.eq.${filter.teamId}`);
      assetQuery = assetQuery.or(`origin_team_id.eq.${filter.teamId},destination_team_id.eq.${filter.teamId}`);
      deliveryQuery = deliveryQuery.eq("team_id", filter.teamId);
      currentAssetsQuery = currentAssetsQuery.eq("team_id", filter.teamId);
    }
    const [materials, assetMovements, deliveries, assets] = await Promise.all([
      materialQuery,
      assetQuery,
      includeEpi ? deliveryQuery : Promise.resolve({ data: [], error: null }),
      currentAssetsQuery,
    ]);
    for (const result of [materials, assetMovements, deliveries, assets]) if (result.error) throw new Error(result.error.message);
    return {
      materialMovements: (materials.data ?? []) as unknown as MovementWithRelations[],
      assetMovements: (assetMovements.data ?? []) as unknown as Array<AssetMovementWithRelations & { assets: AssetMovementWithRelations["assets"] & { ownership_type: string; rental_company: string | null } }>,
      deliveries: (deliveries.data ?? []) as unknown as EpiDeliveryReportRow[],
      assets: (assets.data ?? []) as unknown as AssetWithRelations[],
    };
  }

  async epiReportData(filter: EpiReportFilter): Promise<EpiReportData> {
    const pageSize = 500;
    const maximumRows = 3000;
    const deliveries: EpiDeliveryReportRow[] = [];

    while (deliveries.length <= maximumRows) {
      let query = this.client
        .from("epi_deliveries")
        .select("id,quantity,delivered_at,delivered_by,closed_at,closed_by,current_status,delivery_reason,variant_snapshot,ca_snapshot,brand_model_snapshot,lot_snapshot,note,epi_items(name,code,item_kind,unit),epi_employees(id,full_name,registration_code,profession),teams(id,name)")
        .gte("delivered_at", filter.from)
        .lt("delivered_at", filter.to)
        .order("delivered_at", { ascending: false })
        .range(deliveries.length, deliveries.length + pageSize - 1);
      if (filter.teamId) query = query.eq("team_id", filter.teamId);
      if (filter.employeeId) query = query.eq("employee_id", filter.employeeId);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as unknown as EpiDeliveryReportRow[];
      deliveries.push(...batch);
      if (batch.length < pageSize) break;
    }

    const truncated = deliveries.length > maximumRows;
    const reportDeliveries = deliveries.slice(0, maximumRows);

    const actorIds = [...new Set(reportDeliveries.flatMap((row) => [row.delivered_by, row.closed_by]).filter((id): id is string => Boolean(id)))];
    const actorNames: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data, error } = await this.client.from("profiles").select("id,full_name").in("id", actorIds);
      if (error) throw new Error(error.message);
      for (const actor of data ?? []) actorNames[actor.id] = actor.full_name;
    }

    return { deliveries: reportDeliveries, actorNames, truncated };
  }

  async listProfiles(): Promise<ProfileWithTeam[]> {
    const { data, error } = await this.client.from("profiles").select("*,teams(id,name)").order("created_at");
    return unwrap(data, error) as unknown as ProfileWithTeam[];
  }
}
