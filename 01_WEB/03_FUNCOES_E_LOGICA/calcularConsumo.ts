import type { ConsumptionRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";
import { consumptionUnit } from "./unidadesConsumo";

export type ConsumptionRange = {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  label: string;
  days: number;
};

const dayMs = 86_400_000;
const atLocalStart = (value: string) => new Date(`${value}T00:00:00-03:00`);
const validDate = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(atLocalStart(value).getTime()));

export function resolveConsumptionRange(period: string | undefined, from: string | undefined, to: string | undefined, now = new Date()): ConsumptionRange {
  let currentStart: Date;
  let currentEnd: Date;
  let label: string;
  if (period === "custom" && validDate(from) && validDate(to)) {
    currentStart = atLocalStart(from!);
    currentEnd = new Date(atLocalStart(to!).getTime() + dayMs);
    if (currentEnd <= currentStart || currentEnd.getTime() - currentStart.getTime() > 366 * dayMs) {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    label = "Período personalizado";
  } else if (period === "today") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    currentEnd = new Date(currentStart.getTime() + dayMs);
    label = "Hoje";
  } else if (period === "month") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    label = "Mês atual";
  } else {
    const days = period === "7" ? 7 : 30;
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    currentStart = new Date(currentEnd.getTime() - days * dayMs);
    label = `${days} dias`;
  }
  const days = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / dayMs));
  return { currentStart, currentEnd, previousStart: new Date(currentStart.getTime() - days * dayMs), label, days };
}

export function consumptionCategory(row: ConsumptionRow) {
  const configured = row.items?.category?.trim();
  if (configured) return configured;
  const name = row.items?.name.toLocaleLowerCase("pt-BR") ?? "";
  if (name.includes("disco") || name.includes("lixa") || name.includes("abrasiv")) return "Abrasivos";
  if (name.includes("eletrodo") || name.includes("arame") || name.includes("solda")) return "Consumíveis de soldagem";
  if (name.includes("gás") || name.includes("gas") || name.includes("oxigênio") || name.includes("argon")) return "Gases";
  return "Outros";
}

function sum(rows: ConsumptionRow[]) {
  return rows.reduce((total, row) => total + Number(row.quantity || 0), 0);
}

function group(rows: ConsumptionRow[], key: (row: ConsumptionRow) => string) {
  const values = new Map<string, number>();
  for (const row of rows) values.set(key(row), (values.get(key(row)) ?? 0) + Number(row.quantity || 0));
  return [...values.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function trend(rows: ConsumptionRow[], range: ConsumptionRange) {
  const bucketDays = range.days <= 7 ? 1 : range.days <= 30 ? 5 : range.days <= 90 ? 15 : 30;
  const points: Array<{ label: string; value: number }> = [];
  for (let cursor = new Date(range.currentStart); cursor < range.currentEnd; cursor = new Date(cursor.getTime() + bucketDays * dayMs)) {
    const bucketEnd = new Date(Math.min(range.currentEnd.getTime(), cursor.getTime() + bucketDays * dayMs));
    const value = sum(rows.filter((row) => {
      const date = new Date(row.created_at);
      return date >= cursor && date < bucketEnd;
    }));
    points.push({ label: cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), value });
  }
  return points;
}

export function analyzeConsumption(rows: ConsumptionRow[], range: ConsumptionRange, selectedUnit?: string, selectedCategory?: string) {
  const units = [...new Set(rows.map((row) => consumptionUnit(row.items?.unit)))].sort();
  const normalizedSelection = selectedUnit ? consumptionUnit(selectedUnit) : undefined;
  const hasSelectedUnit = units.includes(normalizedSelection ?? "");
  const unit = hasSelectedUnit ? normalizedSelection! : units.join("/") || "un";
  const categories = [...new Set(rows.map(consumptionCategory))].sort();
  const scoped = rows.filter((row) => (!hasSelectedUnit || consumptionUnit(row.items?.unit) === unit) && (!selectedCategory || consumptionCategory(row) === selectedCategory));
  const current = scoped.filter((row) => { const date = new Date(row.created_at); return date >= range.currentStart && date < range.currentEnd; });
  const previous = scoped.filter((row) => { const date = new Date(row.created_at); return date >= range.previousStart && date < range.currentStart; });
  const total = sum(current);
  const previousTotal = sum(previous);
  return {
    units,
    unit,
    categories,
    total,
    previousTotal,
    percentChange: previousTotal === 0 ? null : ((total - previousTotal) / previousTotal) * 100,
    trend: trend(current, range),
    materials: group(current, (row) => row.items?.name ?? "Material removido"),
    teams: group(current, (row) => row.origin?.name ?? "Sem equipe"),
    categoryTotals: group(current, consumptionCategory),
    rows: current,
  };
}

export function analyzeConsumptionByUnit(rows: ConsumptionRow[], range: ConsumptionRange, selectedCategory?: string) {
  const scoped = rows.filter((row) => {
    const date = new Date(row.created_at);
    return date >= range.previousStart && date < range.currentEnd &&
      (!selectedCategory || consumptionCategory(row) === selectedCategory);
  });
  const units = [...new Set(scoped.map((row) => consumptionUnit(row.items?.unit)))].sort();
  return units.map((unit) => {
    const analysis = analyzeConsumption(scoped, range, unit);
    const materials = new Map<string, { id: string; label: string; code: string; value: number }>();
    for (const row of analysis.rows) {
      const material = materials.get(row.item_id) ?? {
        id: row.item_id,
        label: row.items?.name ?? "Material removido",
        code: row.items?.code ?? "",
        value: 0,
      };
      material.value += Number(row.quantity || 0);
      materials.set(row.item_id, material);
    }
    return { ...analysis, materials: [...materials.values()].sort((a, b) => b.value - a.value) };
  });
}

export type ConsumptionUnitReport = ReturnType<typeof analyzeConsumptionByUnit>[number];
