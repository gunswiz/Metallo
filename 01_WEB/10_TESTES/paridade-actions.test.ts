import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), rpc: vi.fn(), invoke: vi.fn(), from: vi.fn(), revalidate: vi.fn(), redirect: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.authorize }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { deliverEpiBatch, fulfillEpi, requestEpi, saveEmployeeKit } from "@/app/actions/epi-completo";
import { createUserAccount, deactivateMaterial, editHistory } from "@/app/actions/administracao-completa";
import { replaceRentedEquipment } from "@/app/actions/substituir-locado";
const id = "731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4";
const line = { item_id: id, stock_batch_id: id, quantity: 2 };
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
const batch = () => form({ employeeId: id, lines: JSON.stringify([line]), reason: "initial" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ role: "admin" });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc, functions: { invoke: mocks.invoke }, from: mocks.from });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.redirect.mockImplementation(() => { throw new Error("REDIRECT"); });
});
describe("ações com serviços simulados, sem escrita remota", () => {
  it("bloqueia acesso antes de abrir cliente ou executar operação", async () => {
    mocks.authorize.mockRejectedValue(new Error("DENIED"));
    await expect(deliverEpiBatch({}, batch())).rejects.toThrow("DENIED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("não chama RPC quando quantidade excede contrato", async () => {
    expect(await requestEpi({}, form({ employeeId: id, itemId: id, quantity: "101" }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("envia entrega inteira em uma única operação e invalida perfil", async () => {
    await expect(deliverEpiBatch({}, batch())).rejects.toThrow("REDIRECT");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("register_epi_delivery_batch", { p_employee_id: id, p_lines: [line], p_delivery_reason: "initial", p_note: undefined });
    expect(mocks.authorize).toHaveBeenCalledWith("epi:write");
    expect(mocks.revalidate).toHaveBeenCalledWith("/funcionarios", "layout");
    expect(mocks.redirect).toHaveBeenCalledWith(`/funcionarios/${id}?delivered=1`);
  });
  it("estoque insuficiente mantém formulário sem sucesso falso", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "insufficient_stock" } });
    expect((await deliverEpiBatch({}, batch())).error).toContain("estoque");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("não repete automaticamente operação com resultado incerto", async () => {
    mocks.rpc.mockRejectedValue(new Error("network"));
    expect((await deliverEpiBatch({}, batch())).error).toContain("antes de tentar novamente");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("atendimento envia somente IDs validados ao procedimento existente", async () => {
    await expect(fulfillEpi({}, form({ requestId: id, stockBatchId: id }))).rejects.toThrow("REDIRECT");
    expect(mocks.rpc).toHaveBeenCalledWith("fulfill_epi_request", { p_request_id: id, p_stock_batch_id: id });
  });
  it("salva kit vazio explicitamente e exige administrador", async () => {
    await expect(saveEmployeeKit({}, form({ employeeId: id, lines: "[]" }))).rejects.toThrow("REDIRECT");
    expect(mocks.authorize).toHaveBeenCalledWith("admin:manage");
    expect(mocks.rpc).toHaveBeenCalledWith("set_epi_employee_items", { p_employee_id: id, p_lines: [] });
  });
  it("desativação precisa de confirmação enviada", async () => {
    expect(await deactivateMaterial({}, form({ id }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserva origem nula numa entrada externa", async () => {
    await expect(editHistory({}, form({ id, kind: "material", quantity: "3", destinationTeamId: id }))).rejects.toThrow("REDIRECT");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_update_material_movement", expect.objectContaining({ p_origin_team_id: null, p_destination_team_id: id, p_quantity: 3 }));
  });
  it("não trata resposta negativa do provisionamento como sucesso", async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: false }, error: null });
    const result = await createUserAccount({}, form({ fullName: "Pessoa Teste", email: "p@example.com", password: "SenhaSegura#2026", role: "leader", teamId: id }));
    expect(result).toHaveProperty("error"); expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("substituição preserva locação e registra patrimônios antigo e novo", async () => {
    const asset = { id, active: true, ownership_type: "rented", asset_code: "ANTIGO", team_id: id, user_notes: "Nota anterior", rental_company: "Locadora", rental_start_date: "2026-01-01", rental_end_date: null, items: { id, code: "TIPO", name: "Máquina" } };
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: asset, error: null }) };
    mocks.from.mockReturnValue(query);
    await expect(replaceRentedEquipment({}, form({ assetId: id, assetCode: "NOVO", note: "Troca por defeito" }))).rejects.toThrow("REDIRECT");
    expect(mocks.rpc).toHaveBeenCalledWith("update_equipment_admin_v2", expect.objectContaining({ p_asset_id: id, p_team_id: id, p_rental_company: "Locadora", p_rental_start_date: "2026-01-01", p_status: "available", p_user_notes: expect.stringContaining("ANTIGO → NOVO") }));
    asset.ownership_type = "owned"; mocks.rpc.mockClear();
    expect(await replaceRentedEquipment({}, form({ assetId: id, assetCode: "NOVO", note: "Troca por defeito" }))).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
