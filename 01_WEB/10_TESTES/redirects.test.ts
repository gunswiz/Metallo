import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/03_FUNCOES_E_LOGICA/Autenticacao/redirects";

describe("redirecionamentos de autenticação", () => {
  it("aceita somente caminhos internos", () => {
    expect(safeRedirectPath("/atualizar-senha")).toBe("/atualizar-senha");
    expect(safeRedirectPath("/funcionarios?q=joao#resultados")).toBe("/funcionarios?q=joao#resultados");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/%5cevil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/seguro\nLocation: https://evil.example")).toBe("/dashboard");
  });
});
