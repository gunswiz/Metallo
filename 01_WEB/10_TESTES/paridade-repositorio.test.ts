import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@metallo/types";
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: vi.fn() }));
import { EpiOperationsRepository } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
describe("consultas completas para seleção e kit", () => {
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
