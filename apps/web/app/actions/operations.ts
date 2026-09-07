"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database } from "@metallo/types";
import {
  assetMovementSchema,
  equipmentCreateSchema,
  materialCreateSchema,
  materialUpdateSchema,
  materialMovementSchema,
  equipmentUpdateSchema,
  epiItemCreateSchema,
  epiItemUpdateSchema,
  epiStockCreateSchema,
  profileUpdateSchema,
  teamCreateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  epiDeliverySchema,
  epiDeliveryCloseSchema,
} from "@metallo/validation";
import { requireCapability } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const optional = (data: FormData, name: string) => text(data, name) || undefined;
const nullable = (data: FormData, name: string) => text(data, name) || null;

function operationError(destination: string, error: { message: string } | null) {
  if (!error) return;
  const known = ["insufficient_stock", "forbidden_role", "forbidden_team", "same_team_transfer", "invalid_quantity", "delivery_not_active", "invalid_delivery_status"];
  const code = known.find((item) => error.message.includes(item)) ?? "falha";
  redirect(`${destination}?error=${code}`);
}

export async function createMaterial(formData: FormData) {
  await requireCapability("operations:write");
  const parsed = materialCreateSchema.safeParse({
    code: text(formData, "code"), name: text(formData, "name"), description: optional(formData, "description"),
    category: optional(formData, "category"), unit: text(formData, "unit"), minimumStock: text(formData, "minimumStock"),
    teamId: text(formData, "teamId"), quantity: text(formData, "quantity"),
  });
  if (!parsed.success) redirect("/materiais/novo?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_material_for_team", {
    p_code: parsed.data.code, p_name: parsed.data.name, p_description: parsed.data.description,
    p_category: parsed.data.category, p_unit: parsed.data.unit, p_minimum_stock: parsed.data.minimumStock,
    p_team_id: parsed.data.teamId, p_quantity: parsed.data.quantity,
  });
  operationError("/materiais/novo", error);
  revalidatePath("/materiais"); revalidatePath("/dashboard");
  redirect("/materiais?created=1");
}

export async function createEquipment(formData: FormData) {
  await requireCapability("operations:write");
  const parsed = equipmentCreateSchema.safeParse({
    code: text(formData, "code"), name: text(formData, "name"), assetCode: text(formData, "assetCode"),
    serialNumber: optional(formData, "serialNumber"), description: optional(formData, "description"),
    category: optional(formData, "category"), teamId: text(formData, "teamId"), notes: optional(formData, "notes"),
    ownershipType: text(formData, "ownershipType"), rentalCompany: optional(formData, "rentalCompany"),
    rentalStartDate: nullable(formData, "rentalStartDate"), rentalEndDate: nullable(formData, "rentalEndDate"),
  });
  if (!parsed.success) redirect("/equipamentos/novo?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_equipment_for_team_v2", {
    p_code: parsed.data.code, p_name: parsed.data.name, p_asset_code: parsed.data.assetCode,
    p_serial_number: parsed.data.serialNumber, p_description: parsed.data.description,
    p_category: parsed.data.category, p_team_id: parsed.data.teamId, p_user_notes: parsed.data.notes,
    p_ownership_type: parsed.data.ownershipType, p_rental_company: parsed.data.rentalCompany,
    p_rental_start_date: parsed.data.rentalStartDate ?? undefined, p_rental_end_date: parsed.data.rentalEndDate ?? undefined,
  });
  operationError("/equipamentos/novo", error);
  revalidatePath("/equipamentos"); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect("/equipamentos?created=1");
}

export async function updateMaterial(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = materialUpdateSchema.safeParse({
    itemId: text(formData, "itemId"), code: text(formData, "code"), name: text(formData, "name"),
    description: optional(formData, "description"), category: optional(formData, "category"),
    unit: text(formData, "unit"), minimumStock: text(formData, "minimumStock"),
  });
  if (!parsed.success) redirect(`/materiais/${text(formData, "itemId")}?error=dados-invalidos`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_item_admin", {
    p_item_id: parsed.data.itemId, p_code: parsed.data.code, p_name: parsed.data.name,
    p_description: parsed.data.description ?? "", p_category: parsed.data.category ?? "",
    p_unit: parsed.data.unit, p_minimum_stock: parsed.data.minimumStock, p_active: true,
  });
  operationError(`/materiais/${parsed.data.itemId}`, error);
  revalidatePath("/materiais"); revalidatePath(`/materiais/${parsed.data.itemId}`); revalidatePath("/dashboard");
  redirect(`/materiais/${parsed.data.itemId}?updated=1`);
}

export async function updateEquipment(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = equipmentUpdateSchema.safeParse({
    itemId: text(formData, "itemId"), assetId: text(formData, "assetId"), code: text(formData, "code"),
    name: text(formData, "name"), assetCode: text(formData, "assetCode"), serialNumber: optional(formData, "serialNumber"),
    teamId: text(formData, "teamId"), status: text(formData, "status"), notes: optional(formData, "notes"),
    ownershipType: text(formData, "ownershipType"), rentalCompany: optional(formData, "rentalCompany"),
    rentalStartDate: nullable(formData, "rentalStartDate"), rentalEndDate: nullable(formData, "rentalEndDate"),
  });
  const fallbackId = text(formData, "assetId");
  if (!parsed.success) redirect(`/equipamentos/${fallbackId}?error=dados-invalidos`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_equipment_admin_v2", {
    p_item_id: parsed.data.itemId, p_item_code: parsed.data.code, p_item_name: parsed.data.name,
    p_asset_id: parsed.data.assetId, p_asset_code: parsed.data.assetCode,
    p_serial_number: parsed.data.serialNumber ?? "", p_team_id: parsed.data.teamId,
    p_status: parsed.data.status, p_user_notes: parsed.data.notes ?? "", p_active: true,
    p_ownership_type: parsed.data.ownershipType, p_rental_company: parsed.data.rentalCompany ?? "",
    p_rental_start_date: parsed.data.rentalStartDate ?? undefined, p_rental_end_date: parsed.data.rentalEndDate ?? undefined,
  });
  operationError(`/equipamentos/${parsed.data.assetId}`, error);
  revalidatePath("/equipamentos"); revalidatePath(`/equipamentos/${parsed.data.assetId}`); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/equipamentos/${parsed.data.assetId}?updated=1`);
}

export async function returnRentedEquipment(formData: FormData) {
  await requireCapability("admin:manage");
  const assetId = text(formData, "assetId");
  if (!assetId) redirect("/equipamentos?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_rented_equipment", {
    p_asset_id: assetId,
    p_note: optional(formData, "note"),
  });
  operationError(`/equipamentos/${assetId}`, error);
  revalidatePath("/equipamentos"); revalidatePath("/movimentacoes"); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect("/equipamentos?returned=1");
}

export async function createEpiItem(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = epiItemCreateSchema.safeParse({
    code: text(formData, "code"), name: text(formData, "name"), kind: text(formData, "kind"),
    unit: text(formData, "unit"), caNumber: optional(formData, "caNumber"),
    brandModel: optional(formData, "brandModel"), minimumStock: text(formData, "minimumStock"),
    initialQuantity: text(formData, "initialQuantity"), variant: optional(formData, "variant"),
    lotNumber: optional(formData, "lotNumber"),
  });
  const kind = text(formData, "kind");
  if (!parsed.success) redirect(`/epis/novo?kind=${kind || "epi"}&error=dados-invalidos`);
  const returnPolicy = parsed.data.kind === "personal_tool" ? "personal" : parsed.data.kind === "uniform" ? "uniform" : "returnable";
  const supabase = await createClient();
  const { data: itemId, error } = await supabase.rpc("create_epi_item_with_stock", {
    p_code: parsed.data.code, p_name: parsed.data.name, p_item_kind: parsed.data.kind,
    p_unit: parsed.data.unit, p_ca_number: parsed.data.caNumber, p_brand_model: parsed.data.brandModel,
    p_minimum_stock: parsed.data.minimumStock, p_return_policy: returnPolicy,
    p_initial_quantity: parsed.data.initialQuantity, p_variant: parsed.data.variant, p_lot_number: parsed.data.lotNumber,
  });
  operationError(`/epis/novo?kind=${parsed.data.kind}`, error);
  revalidatePath("/epis"); revalidatePath("/ferramentas"); revalidatePath("/almoxarifado"); revalidatePath("/dashboard");
  redirect(`/epis/${itemId}?created=1`);
}

export async function updateEpiItem(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = epiItemUpdateSchema.safeParse({
    itemId: text(formData, "itemId"), code: text(formData, "code"), name: text(formData, "name"),
    kind: text(formData, "kind"), unit: text(formData, "unit"), caNumber: optional(formData, "caNumber"),
    brandModel: optional(formData, "brandModel"), minimumStock: text(formData, "minimumStock"),
  });
  const fallbackId = text(formData, "itemId");
  if (!parsed.success) redirect(`/epis/${fallbackId}?error=dados-invalidos`);
  const supabase = await createClient();
  const { error } = await supabase.from("epi_items").update({
    code: parsed.data.code, name: parsed.data.name, item_kind: parsed.data.kind, unit: parsed.data.unit,
    ca_number: parsed.data.kind === "epi" ? parsed.data.caNumber ?? null : null,
    brand_model: parsed.data.brandModel ?? null, minimum_stock: parsed.data.minimumStock,
    return_policy: parsed.data.kind === "personal_tool" ? "personal" : parsed.data.kind === "uniform" ? "uniform" : "returnable",
  }).eq("id", parsed.data.itemId);
  operationError(`/epis/${parsed.data.itemId}`, error);
  revalidatePath("/epis"); revalidatePath("/ferramentas"); revalidatePath(`/epis/${parsed.data.itemId}`); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/epis/${parsed.data.itemId}?updated=1`);
}

export async function addEpiStock(formData: FormData) {
  await requireCapability("epi:write");
  const parsed = epiStockCreateSchema.safeParse({
    itemId: text(formData, "itemId"), quantity: text(formData, "quantity"), variant: optional(formData, "variant"),
    caNumber: optional(formData, "caNumber"), brandModel: optional(formData, "brandModel"), lotNumber: optional(formData, "lotNumber"),
  });
  const fallbackId = text(formData, "itemId");
  if (!parsed.success) redirect(`/epis/${fallbackId}?error=estoque-invalido`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_epi_stock_batch", {
    p_item_id: parsed.data.itemId, p_quantity: parsed.data.quantity,
    p_variant: parsed.data.variant, p_ca_number: parsed.data.caNumber,
    p_brand_model: parsed.data.brandModel, p_lot_number: parsed.data.lotNumber,
  });
  operationError(`/epis/${parsed.data.itemId}`, error);
  revalidatePath("/epis"); revalidatePath("/ferramentas"); revalidatePath(`/epis/${parsed.data.itemId}`); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/epis/${parsed.data.itemId}?stock=added`);
}

export async function registerMaterialMovement(formData: FormData) {
  await requireCapability("operations:write");
  const parsed = materialMovementSchema.safeParse({
    itemId: text(formData, "itemId"), originTeamId: nullable(formData, "originTeamId"),
    destinationTeamId: nullable(formData, "destinationTeamId"), quantity: text(formData, "quantity"),
    movementType: text(formData, "movementType"), note: optional(formData, "note"),
  });
  if (!parsed.success) redirect("/movimentacoes/nova?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_movement", {
    p_item_id: parsed.data.itemId, p_origin_team_id: parsed.data.originTeamId ?? undefined,
    p_destination_team_id: parsed.data.destinationTeamId ?? undefined, p_quantity: parsed.data.quantity,
    p_movement_type: parsed.data.movementType, p_note: parsed.data.note,
  });
  operationError("/movimentacoes/nova", error);
  revalidatePath("/movimentacoes"); revalidatePath("/materiais"); revalidatePath("/consumo"); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect("/movimentacoes?created=1");
}

export async function registerAssetMovement(formData: FormData) {
  await requireCapability("operations:write");
  const parsed = assetMovementSchema.safeParse({
    assetId: text(formData, "assetId"), destinationTeamId: nullable(formData, "destinationTeamId"),
    movementType: text(formData, "movementType"), newStatus: text(formData, "newStatus"), note: optional(formData, "note"),
  });
  if (!parsed.success) redirect("/movimentacoes/nova?error=dados-invalidos");
  const supabase = await createClient();
  const params: Database["public"]["Functions"]["register_asset_movement"]["Args"] = {
    p_asset_id: parsed.data.assetId, p_movement_type: parsed.data.movementType,
    p_new_status: parsed.data.newStatus, p_note: parsed.data.note,
  };
  if (parsed.data.destinationTeamId) params.p_destination_team_id = parsed.data.destinationTeamId;
  const { error } = await supabase.rpc("register_asset_movement", params);
  operationError("/movimentacoes/nova", error);
  revalidatePath("/movimentacoes"); revalidatePath("/equipamentos"); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/equipamentos/${parsed.data.assetId}?moved=1`);
}

export async function updateProfile(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = profileUpdateSchema.safeParse({
    userId: text(formData, "userId"), fullName: text(formData, "fullName"), role: text(formData, "role"),
    teamId: nullable(formData, "teamId"), active: formData.get("active") === "on",
  });
  if (!parsed.success) redirect("/usuarios?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_user_id: parsed.data.userId, p_full_name: parsed.data.fullName, p_role: parsed.data.role,
    p_team_id: parsed.data.teamId as string, p_active: parsed.data.active,
  });
  operationError("/usuarios", error);
  revalidatePath("/usuarios");
  redirect("/usuarios?updated=1");
}

export async function createTeam(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = teamCreateSchema.safeParse({
    name: text(formData, "name"), description: optional(formData, "description"), locationType: text(formData, "locationType"),
  });
  if (!parsed.success) redirect("/equipes/nova?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_team_admin", {
    p_name: parsed.data.name, p_description: parsed.data.description, p_location_type: parsed.data.locationType,
  });
  operationError("/equipes/nova", error);
  revalidatePath("/equipes"); revalidatePath("/dashboard");
  redirect("/equipes?created=1");
}

export async function createEmployee(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = employeeCreateSchema.safeParse({
    fullName: text(formData, "fullName"), registrationCode: optional(formData, "registrationCode"),
    profession: text(formData, "profession"), teamId: text(formData, "teamId"),
    shirtSize: nullable(formData, "shirtSize"), pantsSize: nullable(formData, "pantsSize"), shoeSize: nullable(formData, "shoeSize"),
    asoExamDate: nullable(formData, "asoExamDate"), asoExpiryDate: nullable(formData, "asoExpiryDate"),
  });
  if (!parsed.success) redirect("/funcionarios/novo?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.from("epi_employees").insert({
    full_name: parsed.data.fullName, registration_code: parsed.data.registrationCode, profession: parsed.data.profession,
    team_id: parsed.data.teamId, shirt_size: parsed.data.shirtSize, pants_size: parsed.data.pantsSize,
    shoe_size: parsed.data.shoeSize, aso_exam_date: parsed.data.asoExamDate, aso_expiry_date: parsed.data.asoExpiryDate,
  });
  operationError("/funcionarios/novo", error);
  revalidatePath("/funcionarios"); revalidatePath("/dashboard");
  redirect("/funcionarios?created=1");
}

export async function updateEmployee(formData: FormData) {
  await requireCapability("admin:manage");
  const parsed = employeeUpdateSchema.safeParse({
    employeeId: text(formData, "employeeId"), fullName: text(formData, "fullName"),
    registrationCode: optional(formData, "registrationCode"), profession: text(formData, "profession"),
    teamId: text(formData, "teamId"), shirtSize: nullable(formData, "shirtSize"), pantsSize: nullable(formData, "pantsSize"),
    shoeSize: nullable(formData, "shoeSize"), asoExamDate: nullable(formData, "asoExamDate"),
    asoExpiryDate: nullable(formData, "asoExpiryDate"), active: formData.get("active") === "on",
  });
  const fallbackId = text(formData, "employeeId");
  if (!parsed.success) redirect(`/funcionarios/${fallbackId}?error=dados-invalidos`);
  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("epi_employees").update({
    full_name: parsed.data.fullName, registration_code: parsed.data.registrationCode ?? null,
    profession: parsed.data.profession, team_id: parsed.data.teamId, shirt_size: parsed.data.shirtSize,
    pants_size: parsed.data.pantsSize, shoe_size: parsed.data.shoeSize,
    aso_exam_date: parsed.data.asoExamDate, aso_expiry_date: parsed.data.asoExpiryDate,
    active: parsed.data.active,
  }).eq("id", parsed.data.employeeId).select("id").maybeSingle();
  operationError(`/funcionarios/${parsed.data.employeeId}`, error);
  if (!updated) redirect(`/funcionarios/${parsed.data.employeeId}?error=nao-encontrado`);
  revalidatePath("/funcionarios"); revalidatePath(`/funcionarios/${parsed.data.employeeId}`); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/funcionarios/${parsed.data.employeeId}?updated=1`);
}

export async function registerEpiDelivery(formData: FormData) {
  await requireCapability("epi:write");
  const parsed = epiDeliverySchema.safeParse({
    employeeId: text(formData, "employeeId"), itemId: text(formData, "itemId"), stockBatchId: text(formData, "stockBatchId"),
    quantity: text(formData, "quantity"), reason: text(formData, "reason"), note: optional(formData, "note"),
  });
  if (!parsed.success) redirect("/epis/entrega?error=dados-invalidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_epi_delivery", {
    p_employee_id: parsed.data.employeeId, p_item_id: parsed.data.itemId, p_stock_batch_id: parsed.data.stockBatchId,
    p_quantity: parsed.data.quantity, p_delivery_reason: parsed.data.reason, p_note: parsed.data.note,
  });
  operationError("/epis/entrega", error);
  revalidatePath("/epis"); revalidatePath("/ferramentas"); revalidatePath("/funcionarios"); revalidatePath("/relatorios"); revalidatePath("/dashboard");
  redirect(`/funcionarios/${parsed.data.employeeId}?delivered=1`);
}

export async function closeEpiDelivery(formData: FormData) {
  await requireCapability("epi:write");
  const parsed = epiDeliveryCloseSchema.safeParse({
    deliveryId: text(formData, "deliveryId"), employeeId: text(formData, "employeeId"),
    quantity: text(formData, "quantity"), status: text(formData, "status"),
  });
  const fallbackEmployee = text(formData, "employeeId");
  if (!parsed.success) redirect(`/funcionarios/${fallbackEmployee}?error=dados-invalidos`);
  const supabase = await createClient();
  const { data: closed, error } = await supabase.rpc("close_epi_delivery_quantity", {
    p_delivery_id: parsed.data.deliveryId,
    p_quantity: parsed.data.quantity,
    p_status: parsed.data.status,
  });
  operationError(`/funcionarios/${parsed.data.employeeId}`, error);
  if (!closed) redirect(`/funcionarios/${parsed.data.employeeId}?error=entrega-ja-encerrada`);
  revalidatePath("/epis"); revalidatePath("/ferramentas"); revalidatePath("/relatorios"); revalidatePath(`/funcionarios/${parsed.data.employeeId}`);
  redirect(`/funcionarios/${parsed.data.employeeId}?closed=1`);
}
