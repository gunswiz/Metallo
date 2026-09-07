import { describe, expect, it } from "vitest";
import { analyzeConsumption, consumptionCategory, resolveConsumptionRange } from "@/lib/consumption";
import type { ConsumptionRow } from "@/lib/repositories/metallo-repository";

const row = (created_at: string, quantity: number, name = "Disco de corte", unit = "un"): ConsumptionRow => ({
  id: crypto.randomUUID(), item_id: crypto.randomUUID(), origin_team_id: crypto.randomUUID(), created_at, quantity, note: null,
  items: { id: crypto.randomUUID(), name, code: "MAT", unit, category: null }, origin: { id: crypto.randomUUID(), name: "Equipe A" },
});

describe("consumption analytics", () => {
  it("uses the same fallback category rules as mobile", () => {
    expect(consumptionCategory(row("2026-09-05T12:00:00Z", 1))).toBe("Abrasivos");
    expect(consumptionCategory(row("2026-09-05T12:00:00Z", 1, "Eletrodo 6013"))).toBe("Consumíveis de soldagem");
  });

  it("compares equal bounded periods without mixing units", () => {
    const range = resolveConsumptionRange("7", undefined, undefined, new Date("2026-09-06T12:00:00-03:00"));
    const result = analyzeConsumption([
      row("2026-09-05T12:00:00-03:00", 4),
      row("2026-08-29T12:00:00-03:00", 2),
      row("2026-09-05T12:00:00-03:00", 99, "Tinta", "L"),
    ], range, "un");
    expect(result.total).toBe(4);
    expect(result.previousTotal).toBe(2);
    expect(result.percentChange).toBe(100);
  });

  it("includes every unit when no unit filter is selected", () => {
    const range = resolveConsumptionRange("7", undefined, undefined, new Date("2026-09-06T12:00:00-03:00"));
    const result = analyzeConsumption([
      row("2026-09-05T12:00:00-03:00", 4),
      row("2026-09-05T12:00:00-03:00", 2, "Eletrodo", "caixa"),
    ], range);

    expect(result.total).toBe(6);
    expect(result.unit).toBe("caixa/un");
    expect(result.rows).toHaveLength(2);
  });
});
