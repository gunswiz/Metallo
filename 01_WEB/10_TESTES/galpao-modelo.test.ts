// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

type Part = { kind: string; wallId?: string; bracingPlane?: string; columnIndex?: number; columnX?: number; weldPass?: number; gutterSide?: number; delay: number; duration: number; faces: { pts: number[][]; style: string }[] };
type Model = { parts: Part[]; bays: number[]; duration: number; phases: { time: number; end: number; label: string }[]; gutter: { bottom: number; inlet: number; upstand: number; roofEdge: number }; views: Record<string, number[]>; accesses: { id: string; wall: string; center: number; height: number }[]; roofAccess: { ladder: { wall: string; lowerX: number; planeZ: number }; anchors: unknown[] } };
const scope = { window: {} as { createMetalloStructure: () => Model } };
for (const file of ["steel-roof-access.js", "steel-structure.js"]) runInNewContext(readFileSync(resolve("02_COMPONENTES_VISUAIS/Galpao", file), "utf8"), scope);
const model = scope.window.createMetalloStructure();
it("preserva o modelo completo aprovado ao transferir para o aplicativo", () => {
  expect(model.bays).toHaveLength(13);
  expect(model.parts).toHaveLength(2611);
  expect(model.parts.filter(p => p.kind === "pilares")).toHaveLength(39);
  expect(model.parts.filter(p => p.bracingPlane === "center")).toHaveLength(12);
  for (const plane of ["front", "back"]) expect(model.parts.filter(p => p.bracingPlane === plane)).toHaveLength(8);
  for (const plane of ["west", "east", "roof-west", "roof-east"]) expect(model.parts.filter(p => p.bracingPlane === plane)).toHaveLength(8);
  expect(model.roofAccess.ladder).toMatchObject({ wall: "back", lowerX: 5.1, planeZ: -12.16 });
  expect(model.roofAccess.anchors).toHaveLength(39);
  expect(model.parts.filter(p => p.kind === "escada-descida-interna")).toHaveLength(1);
  expect(model.parts.every(p => p.delay + p.duration <= model.duration)).toBe(true);
  expect(model.parts.every(p => p.faces.every(f => f.pts.every(v => v.every(Number.isFinite))))).toBe(true);
});
it("fecha toda a alvenaria dos fundos, sem janelas, preservando as outras faces", () => {
  const windows = model.parts.filter(p => p.kind === "janelas");
  expect(windows.filter(p => p.wallId === "back")).toHaveLength(0);
  expect(windows.filter(p => p.wallId === "front")).toHaveLength(5);
  for (const wall of ["west", "east"]) expect(windows.filter(p => p.wallId === wall)).toHaveLength(20);
  const masonry = model.parts.filter(p => p.kind === "alvenaria" && p.wallId === "back").flatMap(p => p.faces.filter(f => f.style === "wall"));
  expect(masonry).toHaveLength(9);
  masonry.forEach((face, i) => {
    expect(face.pts.every(v => v[2] === -12.035)).toBe(true);
    expect(Math.min(...face.pts.map(v => v[0]))).toBe(-6);
    expect(Math.max(...face.pts.map(v => v[0]))).toBe(6);
    expect(Math.min(...face.pts.map(v => v[1]))).toBeCloseTo(i * .09);
    expect(Math.max(...face.pts.map(v => v[1]))).toBeCloseTo(Math.min(.77, (i + 1) * .09));
  });
  expect(model.accesses.find(a => a.id === "p2")).toMatchObject({ wall: "front", center: -5.2, height: .84 });
});
it("login e seletor de vistas mostram a frente oposta à escada", () => {
  expect(Math.cos(model.views.perspective[0])).toBeLessThan(0);
  expect(model.views.end).toEqual([Math.PI, .16]);
  expect(model.views.back).toEqual([0, .16]);
});

it("assenta os 39 pilares diretamente nas chapas, sem chumbadores, com três passes de solda", () => {
  const bases = model.parts.filter(p => p.kind === "bases");
  expect(bases).toHaveLength(39);
  for (const base of bases) {
    const atBase = (p: Part) => p.columnIndex === base.columnIndex && p.columnX === base.columnX;
    const vertices = base.faces.flatMap(f => f.pts), top = Math.max(...vertices.map(v => v[1]));
    expect(base.faces).toHaveLength(6); // Chapa maciça; nenhum volume de porca ou chumbador sobre ela.
    const pillar = model.parts.find(p => p.kind === "pilares" && atBase(p))!;
    expect(Math.min(...pillar.faces.flatMap(f => f.pts.map(v => v[1])))).toBeCloseTo(top);
    const contact = pillar.faces.filter(f => f.pts.every(v => Math.abs(v[1] - top) < 1e-8));
    expect(contact).toHaveLength(3); // Duas mesas e alma; sem triângulos preenchendo os vazios do perfil I.
    expect(contact.every(f => f.pts.length === 4)).toBe(true);
    const rebar = model.parts.find(p => p.kind === "armadura-base" && atBase(p))!;
    expect(Math.max(...rebar.faces.flatMap(f => f.pts.map(v => v[1])))).toBeCloseTo(-.02);
    const welds = model.parts.filter(p => p.kind === "solda-base" && atBase(p));
    expect(welds.map(p => p.weldPass)).toEqual([1, 2, 3]);
    for (const weld of welds) {
      expect(weld.delay).toBeGreaterThanOrEqual(pillar.delay + pillar.duration - 1e-8);
      expect(weld.delay + weld.duration).toBeLessThanOrEqual(model.phases[1].end);
      expect(weld.faces.flatMap(f => f.pts).every(v => v[1] >= top - .001 && v[1] <= top + .012)).toBe(true);
    }
  }
  expect(model.phases.some(p => /chumbador/i.test(p.label))).toBe(false);
});

// Cast a vertical ray against the actual faces, rather than trusting part labels/bounds.
function heightsAt(f: Part["faces"][number], x: number, z: number): number[] {
  const heights = [];
  for (let i = 1; i < f.pts.length - 1; i++) {
    const [a, b, c] = [f.pts[0], f.pts[i], f.pts[i + 1]];
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) heights.push(u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return heights;
}

it("mantém a calha aberta e contínua acima da estrutura após o fechamento interno", () => {
  const frame = model.parts.filter(p => ["pilares", "vigas", "tercas", "passadores", "ligacoes-passadores"].includes(p.kind));
  for (const side of [-1, 1]) {
    const floors = model.parts.filter(p => p.gutterSide === side).flatMap(p => p.faces.filter(f => f.style === "gutter-floor"));
    expect(floors).toHaveLength(12);
    floors.forEach((f, i) => {
      expect(Math.min(...f.pts.map(v => v[2]))).toBe(model.bays[i]);
      expect(Math.max(...f.pts.map(v => v[2]))).toBe(model.bays[i + 1]);
    });
    for (const z of model.bays.slice(1, -1).flatMap(z => [z - .03, z, z + .03, z + .8])) {
      const x = side * 5.82, floor = Math.max(...floors.flatMap(f => heightsAt(f, x, z)));
      expect(floor).toBeCloseTo(model.gutter.bottom);
      const structure = frame.flatMap(p => p.faces.flatMap(f => heightsAt(f, x, z)));
      expect(Math.max(...structure)).toBeLessThan(floor - .005);
    }
    const liner = model.parts.filter(p => p.kind === "fechamento-interno" && p.wallId === (side < 0 ? "west" : "east"));
    const low = Math.min(...liner.flatMap(p => p.faces.flatMap(f => f.pts.map(v => v[1]))));
    expect(low).toBeGreaterThan(model.gutter.bottom);
    expect(low).toBeLessThan(model.gutter.upstand); // Sobreposição vertical fecha a vista para a estrutura.
    expect(liner.flatMap(p => p.faces.flatMap(f => f.pts)).every(v => Math.abs(v[0]) > model.gutter.roofEdge)).toBe(true);
  }
});
