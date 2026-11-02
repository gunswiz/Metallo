import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@metallo/types";
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: vi.fn() }));
vi.mock("@/09_CONFIGURACOES/ambienteSupabase", () => ({ getSupabaseEnv: () => ({ url: "http://127.0.0.1:54321" }) }));
import { EpiOperationsRepository } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
describe("consultas completas para seleção e kit", () => {
  it("rejeita kit sem linhas válidas antes de chegar à tela", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "admin_epi_prepared_kits_3d" ? [{ preparation_id: "kit", lines: null }] : [], error: null }));
    const repo = new EpiOperationsRepository({ rpc } as unknown as SupabaseClient<Database>);
    await expect(repo.delivery3d()).rejects.toThrow();
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(repo.delivery3d()).resolves.toEqual({ prepared: [], approved: [], feedback: [] });
  });
  it("busca todas as páginas sem truncar escolhas em 100 ou 200 registros", async () => {
    const rows = Array.from({ length: 401 }, (_, id) => ({ id: String(id) }));
    const ranges: number[][] = [];
    const from = vi.fn(() => {
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn((start: number, end: number) => { ranges.push([start, end]); return Promise.resolve({ data: rows.slice(start, end + 1), error: null }); }) };
      return query;
    });
    const repo = new EpiOperationsRepository({ from } as unknown as SupabaseClient<Database>);
    const result = await repo.choices();
    expect(result.items).toHaveLength(401); expect(result.employees).toHaveLength(401); expect(result.batches).toHaveLength(401);
    expect(ranges.filter(([start]) => start === 400)).toHaveLength(3);
  });
  it("não apresenta lista parcial como completa se uma página falhar", async () => {
    const from = vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn((start: number) => Promise.resolve(start === 0 ? { data: Array.from({ length: 200 }, (_, id) => ({ id })), error: null } : { data: null, error: { message: "consulta indisponível" } })) }));
    await expect(new EpiOperationsRepository({ from } as unknown as SupabaseClient<Database>).choices()).rejects.toThrow("consulta indisponível");
  });
});
