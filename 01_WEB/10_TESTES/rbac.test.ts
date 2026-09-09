import { describe, expect, it } from "vitest";
import { can, isUserRole } from "@metallo/core";

describe("controle de acesso", () => {
  it("reserva administração ao perfil admin", () => {
    expect(can("admin", "admin:manage")).toBe(true);
    expect(can("engineer", "admin:manage")).toBe(false);
    expect(can("leader", "admin:manage")).toBe(false);
  });

  it("limita módulos de EPI a admin e engenheiro", () => {
    expect(can("admin", "epi:read")).toBe(true);
    expect(can("engineer", "epi:read")).toBe(true);
    expect(can("leader", "epi:read")).toBe(false);
    expect(can("collaborator", "epi:read")).toBe(false);
  });

  it("rejeita papéis desconhecidos", () => {
    expect(isUserRole("owner")).toBe(false);
    expect(isUserRole("admin")).toBe(true);
  });
});
