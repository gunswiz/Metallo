import { describe, expect, it } from "vitest";
import { AppError, classifyLoadFailure } from "@/03_FUNCOES_E_LOGICA/Erros/app-error";
import { siteSnapshotSchema } from "@/03_FUNCOES_E_LOGICA/operacoesObra";

it("o contrato aceita funcionário sem equipe sem descartar o restante da listagem", () => {
  const snapshot = siteSnapshotSchema.parse({ works: [], teams: [], materials: [], epi_items: [],
    batches: [], employees: [{ id: "joao", name: "João", team_id: null, home_team_id: null },
      { id: "maria", name: "Maria", team_id: "equipe", home_team_id: "equipe" }],
    assignments: [], assets: [], orders: [], rental_returns: [], rental_details: [], alerts: [] });
  expect(snapshot.employees).toHaveLength(2);
  expect(snapshot.employees[0].team_id).toBeNull();
  expect(snapshot.employees[1].team_id).toBe("equipe");
});

describe("mensagens de falha da listagem", () => {
  it.each([
    [{ status: 401, message: "JWT expired" }, "session", "Sessão expirada"],
    [{ code: "42501", message: "permission denied for table" }, "forbidden", "Acesso negado"],
    [{ status: 404, message: "resource missing" }, "not_found", "Serviço não encontrado"],
    [{ status: 409, message: "conflict" }, "conflict", "Conflito ao carregar"],
    [{ status: 422, message: "invalid query" }, "invalid", "Consulta inválida"],
    [new TypeError("fetch failed"), "connection", "Sem conexão"],
    [new Error("request timed out"), "timeout", "Tempo de espera excedido"],
    [new Error("ZodError: invalid team_id"), "internal", "Erro ao carregar"],
    [{ status: 500, message: "internal database failure" }, "internal", "Erro ao carregar"],
  ] as const)("classifica %j", (cause, kind, title) => {
    const result = classifyLoadFailure(new AppError("unexpected", "Falha na consulta", cause));
    expect(result.kind).toBe(kind);
    expect(result.title).toBe(title);
    expect(result.message).not.toMatch(/permission denied|database failure|zoderror/i);
  });
});
