import { expect, it } from "vitest";
import { analyzeConsumptionInReais, resolveConsumptionRange, UNIDADE_REAIS } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { lerPrecoBR, mostrarPrecoBR } from "@/03_FUNCOES_E_LOGICA/Precos/precos-3q";
import { consumptionQuantity } from "@/03_FUNCOES_E_LOGICA/unidadesConsumo";
import type { ConsumptionRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";

// Marco 3Q: preço do material e consumo em R$.
it("entende o preço digitado do jeito brasileiro", () => {
  expect(lerPrecoBR("12,50")).toBe(12.5);
  expect(lerPrecoBR("R$ 1.234,5")).toBe(1234.5);
  expect(lerPrecoBR("8")).toBe(8);
  expect(lerPrecoBR("1.234")).toBe(1234);
  expect(lerPrecoBR("9.90")).toBe(9.9);
  expect(lerPrecoBR("")).toBeNull();
  expect(lerPrecoBR("0")).toBeUndefined();
  expect(lerPrecoBR("-3")).toBeUndefined();
  expect(lerPrecoBR("abc")).toBeUndefined();
  expect(lerPrecoBR("1,234")).toBeUndefined();
  expect(mostrarPrecoBR(9.9)).toBe("9,90");
  expect(consumptionQuantity(1234.5, "R$")).toMatch(/^R\$\s1\.234,50$/);
});

const row = (id: string, item: string, unit: string, quantity: number, date: string, team = "Equipe A"): ConsumptionRow => ({
  id, item_id: item, origin_team_id: null, quantity, created_at: date, note: null,
  items: { id: item, name: `Material ${item}`, code: item.toUpperCase(), unit, category: "Solda" }, origin: { id: team, name: team },
} as ConsumptionRow);

it("soma caixas, kg e unidades em R$ e avisa quem está sem preço", () => {
  const range = resolveConsumptionRange("custom", "2026-10-01", "2026-10-07", new Date("2026-10-08T12:00:00Z"));
  const rows = [
    row("1", "a", "cx", 2, "2026-10-02T13:00:00Z"),
    row("2", "b", "kg", 3, "2026-10-03T13:00:00Z", "Equipe B"),
    row("3", "c", "un", 10, "2026-10-03T14:00:00Z"),
    row("4", "a", "cx", 1, "2026-09-26T13:00:00Z"), // período anterior
  ];
  const { report, semPreco, materiaisNoPeriodo } = analyzeConsumptionInReais(rows, range, [{ item_id: "a", unit_price: 89 }, { item_id: "b", unit_price: 24.5 }]);
  expect(report?.unit).toBe(UNIDADE_REAIS);
  expect(report?.total).toBeCloseTo(2 * 89 + 3 * 24.5);
  expect(report?.previousTotal).toBeCloseTo(89);
  expect(report?.teams.map(t => t.label)).toEqual(["Equipe A", "Equipe B"]);
  expect(semPreco.map(m => m.id)).toEqual(["c"]);
  expect(materiaisNoPeriodo).toBe(3);
});

it("sem nenhum preço, não há painel em R$", () => {
  const range = resolveConsumptionRange("7", undefined, undefined, new Date("2026-10-08T12:00:00Z"));
  expect(analyzeConsumptionInReais([], range, []).report).toBeNull();
});
