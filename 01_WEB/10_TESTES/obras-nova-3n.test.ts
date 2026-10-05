import { beforeEach, expect, it, vi } from "vitest";

// Marco 3N: "Nova obra" cria a equipe junto quando pedido e só depois cadastra a obra.
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { criarObra } from "@/app/actions/obras";

const admin = "a0000000-0000-4000-8000-000000000001";
const equipe = "b0000000-0000-4000-8000-000000000002";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.capability.mockResolvedValue({ id: admin, role: "admin" });
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
});

it("exige acesso de administrador", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: equipe, error: null }).mockResolvedValueOnce({ data: { ok: true }, error: null });
  await expect(criarObra(form({ estoque: "nova", nome: "Galpão Norte" }))).rejects.toThrow("redirect:/obras?criada=");
  expect(mocks.capability).toHaveBeenCalledWith("admin:manage");
});

it("com equipe nova: cria a equipe (nome padrão) e cadastra a obra com ela, pelo próprio usuário", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: equipe, error: null }).mockResolvedValueOnce({ data: { ok: true }, error: null });
  await expect(criarObra(form({ estoque: "nova", nome: "Galpão Norte", equipe: "" }))).rejects.toThrow(`redirect:/obras?criada=${encodeURIComponent("Galpão Norte")}`);
  expect(mocks.rpc).toHaveBeenNthCalledWith(1, "create_team_admin", expect.objectContaining({ p_name: "Equipe Galpão Norte", p_location_type: "field" }));
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "run_site_operation", expect.objectContaining({ p_command: "create_worksite",
    p_data: { name: "Galpão Norte", team_id: equipe, actor_id: admin } }));
});

it("com equipe existente: não cria equipe e usa a escolhida", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
  await expect(criarObra(form({ estoque: "existente", nome: "Ponte Leste", equipeId: equipe }))).rejects.toThrow("redirect:/obras?criada=");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).toHaveBeenCalledWith("run_site_operation", expect.objectContaining({ p_data: { name: "Ponte Leste", team_id: equipe, actor_id: admin } }));
});

it("sem nome, ou equipe existente sem escolher, volta com aviso claro e não grava nada", async () => {
  await expect(criarObra(form({ estoque: "nova", nome: " " }))).rejects.toThrow("redirect:/obras/nova?erro=dados");
  await expect(criarObra(form({ estoque: "existente", nome: "Obra X" }))).rejects.toThrow("redirect:/obras/nova?erro=escolha-equipe");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("se a obra falhar depois de criar a equipe, avisa que a equipe ficou livre para usar", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: equipe, error: null }).mockResolvedValueOnce({ data: null, error: { message: "invalid_team" } });
  await expect(criarObra(form({ estoque: "nova", nome: "Obra Y" }))).rejects.toThrow("redirect:/obras/nova?erro=obra-equipe-criada");
});
