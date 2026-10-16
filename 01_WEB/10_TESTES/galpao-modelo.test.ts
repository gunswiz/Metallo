// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

type Part = { kind: string; bracingPlane?: string; delay: number; duration: number; faces: { pts: number[][] }[] };
type Model = { parts: Part[]; bays: number[]; duration: number; accesses: { id: string; height: number }[]; roofAccess: { ladder: { wall: string; lowerX: number }; anchors: unknown[] } };
const scope = { window: {} as { createMetalloStructure: () => Model } };
for (const file of ["steel-roof-access.js", "steel-structure.js"]) runInNewContext(readFileSync(resolve("02_COMPONENTES_VISUAIS/Galpao", file), "utf8"), scope);
const model = scope.window.createMetalloStructure();
it("preserva o modelo completo aprovado ao transferir para o aplicativo", () => {
  expect(model.bays).toHaveLength(13);
  expect(model.parts).toHaveLength(2563);
  expect(model.parts.filter(p => p.kind === "pilares")).toHaveLength(39);
  expect(model.parts.filter(p => p.bracingPlane === "center")).toHaveLength(12);
  for (const plane of ["front", "back"]) expect(model.parts.filter(p => p.bracingPlane === plane)).toHaveLength(8);
  for (const plane of ["west", "east", "roof-west", "roof-east"]) expect(model.parts.filter(p => p.bracingPlane === plane)).toHaveLength(8);
  expect(model.roofAccess.ladder).toMatchObject({ wall: "front", lowerX: 5.1 });
  expect(model.roofAccess.anchors).toHaveLength(39);
  expect(model.parts.filter(p => p.kind === "escada-descida-interna")).toHaveLength(1);
  expect(model.parts.every(p => p.delay + p.duration <= model.duration)).toBe(true);
  expect(model.parts.every(p => p.faces.every(f => f.pts.every(v => v.every(Number.isFinite))))).toBe(true);
});
