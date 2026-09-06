import { describe, expect, it } from "vitest";
import { materialMovementSchema, paginationSchema, profileUpdateSchema } from "@metallo/validation";

describe("validação operacional", () => {
  it("impede transferência para a mesma equipe", () => {
    const team = "2f7c6ac4-e1f1-4b7c-9e62-1b816ac9857e";
    const result = materialMovementSchema.safeParse({
      itemId: "731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4",
      originTeamId: team,
      destinationTeamId: team,
      quantity: 1,
      movementType: "transfer",
    });
    expect(result.success).toBe(false);
  });

  it("normaliza paginação fora dos limites", () => {
    expect(paginationSchema.parse({ page: "0", pageSize: "999", q: "" })).toMatchObject({ page: 1, pageSize: 20 });
  });

  it("exige equipe para líder", () => {
    const result = profileUpdateSchema.safeParse({
      userId: "731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4",
      fullName: "Líder de teste",
      role: "leader",
      teamId: null,
      active: true,
    });
    expect(result.success).toBe(false);
  });
});
