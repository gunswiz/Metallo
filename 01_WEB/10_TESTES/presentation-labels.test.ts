import { describe, expect, it } from "vitest";
import {
  itemKindLabel,
  movementLabel,
  returnPolicyLabel,
  statusLabel,
} from "@metallo/core";

describe("rótulos operacionais em português", () => {
  it("traduz valores internos usados nas telas e relatórios", () => {
    expect(movementLabel("rental_return")).toBe("Devolução de aluguel");
    expect(statusLabel("in_use")).toBe("Em uso");
    expect(itemKindLabel("personal_tool")).toBe("Item pessoal");
    expect(returnPolicyLabel("returnable")).toBe("Devolução obrigatória");
  });

  it("não expõe valores internos desconhecidos ao usuário", () => {
    expect(movementLabel("future_internal_operation")).toBe("Operação não identificada");
    expect(statusLabel("future_internal_status")).toBe("Situação não identificada");
    expect(itemKindLabel("future_internal_kind")).toBe("Tipo não identificado");
    expect(returnPolicyLabel("future_internal_policy")).toBe("Política não identificada");
  });
});
