import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

type Pose = { position: number[]; heading: number; pitch: number };
type Bounds = { x: number[]; y: number[]; z: number[] };
type Camera = {
  reset: (preset?: string) => void;
  snapshot: () => Pose;
  move: (forward: number, sideways?: number, vertical?: number) => void;
  pan: (sideways: number, vertical: number) => void;
  look: (horizontal: number, vertical: number) => void;
  frame: (bounds: Bounds, yaw: number, pitch: number, aspect?: number) => void;
  setPose: (pose: Pose) => void;
  project: (points: number[][], width: number, height: number) => number[][];
  matrix: (width: number, height: number) => Float32Array;
};
const model = {
  bounds: { x: 6, z: 12 }, bays: [-12, 0, 12], parts: [], duration: 31,
  views: { perspective: [Math.PI + .58, .34], end: [Math.PI, .16] },
  phases: [{ time: 0, end: 2, label: "Bases" }, { time: 16, end: 16.9, label: "Estrutura" }, { time: 30, end: 31, label: "Obra completa" }],
  details: { gutter: { label: "Calha", yaw: -1.25, pitch: .65, bounds: { x: [5.35, 6.1], y: [2.92, 3.43], z: [-3.5, -.5] } } },
  accesses: [],
};
const fullBounds = { x: [-6.3, 6.5], y: [-.15, 4.25], z: [-12.5, 12.3] };
const cameraScope = { window: {} as { createMetalloInteriorCamera: (model: unknown, options?: { free: boolean }) => Camera } };
const source = (file: string) => readFileSync(resolve("02_COMPONENTES_VISUAIS/Galpao", file), "utf8");
runInNewContext(source("steel-camera.js"), cameraScope);
const makeCamera = (free = true) => cameraScope.window.createMetalloInteriorCamera(model, { free });

it("permite cruzar paredes e subir acima da cobertura, preservando as restrições do passeio interno", () => {
  const free = makeCamera(), interior = makeCamera(false);
  const pose = { position: [3, 1, 11], heading: 0, pitch: .6 };
  free.setPose(pose); interior.setPose(pose);
  free.move(8); interior.move(8);
  expect(free.snapshot().position[2]).toBeGreaterThan(12);
  expect(free.snapshot().position[1]).toBeGreaterThan(4.25);
  expect(interior.snapshot().position[2]).toBeLessThan(12);
  expect(interior.snapshot().position[1]).toBe(1);
  free.move(10000, 10000, 10000);
  expect(free.snapshot().position.every(Number.isFinite)).toBe(true);
  expect(free.snapshot().position[1]).toBe(40);
  free.move(0, 0, -10000);
  expect(free.snapshot().position[1]).toBe(.025);
});

it("desloca no plano da tela sem girar e copia a vista interna sem compartilhar sua posição", () => {
  const interior = makeCamera(false), free = makeCamera();
  interior.reset("inside-bases");
  const pose = interior.snapshot(); free.setPose(pose);
  expect(free.matrix(1200, 800).every(Number.isFinite)).toBe(true);
  free.pan(.12, .08);
  expect(free.snapshot().heading).toBe(pose.heading);
  expect(free.snapshot().pitch).toBe(pose.pitch);
  expect(free.snapshot().position).not.toEqual(pose.position);
  expect(interior.snapshot()).toEqual(pose);
  free.setPose({ position: [1, 1, 1], heading: Math.PI / 2, pitch: 0 });
  free.pan(1, 2);
  expect(free.snapshot().position[0]).toBeCloseTo(1);
  expect(free.snapshot().position[1]).toBeCloseTo(3);
  expect(free.snapshot().position[2]).toBeCloseTo(0);
});

it("reenquadra todos os cantos no computador e celular e recorta superfícies junto à câmera", () => {
  const free = makeCamera();
  for (const [width, height] of [[1440, 700], [328, 300]]) {
    free.frame(fullBounds, Math.PI + .58, .34, width / height);
    for (const x of fullBounds.x) for (const y of fullBounds.y) for (const z of fullBounds.z) {
      const [[sx, sy, depth]] = free.project([[x, y, z]], width, height);
      expect(sx).toBeGreaterThan(0); expect(sx).toBeLessThan(width);
      expect(sy).toBeGreaterThan(0); expect(sy).toBeLessThan(height);
      expect(depth).toBeGreaterThan(0);
    }
  }
  free.setPose({ position: [0, 1, 0], heading: 0, pitch: 0 });
  const clipped = free.project([[-1, 1, -1], [1, 1, 1]], 800, 600);
  expect(clipped).toHaveLength(2);
  expect(clipped.flat().every(Number.isFinite)).toBe(true);
  expect(free.project([[-1, 1, -2], [1, 1, -1]], 800, 600)).toEqual([]);
});

let destroy: (() => void) | undefined;
afterEach(() => { destroy?.(); destroy = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); });

function scene() {
  const pending = new Map<number, FrameRequestCallback>(); let nextId = 0;
  const requestFrame = (fn: FrameRequestCallback) => { pending.set(++nextId, fn); return nextId; };
  const draw = vi.fn(), dispose = vi.fn();
  const root = document.createElement("div");
  root.innerHTML = '<div class="steel-visual"><div class="steel-stage"><canvas></canvas></div></div><button class="motion-toggle"></button><section class="steel-form-section"><input aria-label="Usuário"></section>';
  document.body.append(root);
  const stage = root.querySelector(".steel-stage")!;
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ width: 1200, height: 650 } as DOMRect);
  const canvas = root.querySelector("canvas")!;
  canvas.setPointerCapture = vi.fn();
  const runtime = Object.assign(new EventTarget(), {
    createMetalloStructure: () => model,
    createMetalloInteriorCamera: cameraScope.window.createMetalloInteriorCamera,
    createMetalloRenderer: () => ({ draw, resize: vi.fn(), destroy: dispose }),
    metalloMotionPaused: true,
    startMetalloSteel: undefined as unknown as (root: HTMLElement) => { destroy: () => void },
  });
  runInNewContext(source("steel-motion.js"), {
    window: runtime, document, devicePixelRatio: 1,
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    requestAnimationFrame: requestFrame, cancelAnimationFrame: (id: number) => pending.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  const app = runtime.startMetalloSteel(root); destroy = app.destroy;
  const click = (action: string) => (root.querySelector(`[data-steel="${action}"]`) as HTMLButtonElement).click();
  const select = (name: string, value: string) => {
    const input = root.querySelector(`[aria-label="${name}"]`) as HTMLSelectElement;
    input.value = value; input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const matrix = () => Array.from(draw.mock.lastCall![0].interiorMatrix as Float32Array);
  const key = (value: string, type = "keydown") => {
    (type === "keyup" ? runtime : canvas).dispatchEvent(new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true }));
  };
  const advance = (time: number) => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(time)); };
  return { root, canvas, click, select, draw, matrix, key, advance, pending, runtime, app, dispose };
}

it("mantém a câmera livre ao trocar estrutura, obra completa e etapa; volta ao login sem bloquear o formulário", () => {
  const s = scene(); s.click("structure"); s.click("free");
  expect(s.canvas.dataset.view).toBe("free");
  expect(s.canvas.dataset.assembly).toBe("16.90");
  const pose = s.matrix(); s.click("complete");
  expect(s.canvas.dataset.assembly).toBe("31.00"); expect(s.matrix()).toEqual(pose);
  s.click("structure"); expect(s.matrix()).toEqual(pose);
  s.select("Selecionar etapa", "0"); expect(s.matrix()).toEqual(pose);
  expect(s.canvas.dataset.view).toBe("free");
  s.key("Escape"); expect(s.canvas.dataset.view).toBe("exterior");
  s.key("Escape"); expect(s.root.classList.contains("steel-expanded")).toBe(false);
  expect((s.root.querySelector(".steel-form-section") as HTMLElement).inert).toBe(false);
});

it("parte do detalhe selecionado, preserva a vista interior e pode reenquadrar a obra", () => {
  const s = scene(); s.click("expand"); s.select("Selecionar vista", "gutter"); s.click("free");
  const detail = s.matrix(); s.click("frame"); expect(s.matrix()).not.toEqual(detail);
  s.select("Selecionar vista", "inside-bases"); const interior = s.matrix();
  expect(s.draw.mock.lastCall![0].interiorLighting).toBe(true);
  s.click("free");
  // Near/far planes differ; camera orientation and position in the other matrix rows stay the same.
  const free = s.matrix();
  for (const i of [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15]) expect(free[i]).toBeCloseTo(interior[i]);
  expect(s.draw.mock.lastCall![0].interiorLighting).toBe(false);
  s.click("replay"); expect(s.canvas.dataset.view).toBe("exterior"); expect(s.canvas.dataset.assembly).toBe("0.00");
});

it("move continuamente apenas com o teclado focado, para ao soltar/perder foco e limpa tudo ao desmontar", () => {
  const s = scene(); s.click("free"); const initial = s.matrix();
  s.key("w"); s.advance(100); s.advance(150);
  expect(s.matrix()).not.toEqual(initial); s.key("w", "keyup"); expect(s.pending.size).toBe(0);
  s.key("e"); s.canvas.dispatchEvent(new Event("blur")); expect(s.pending.size).toBe(0);
  s.key("d"); s.runtime.dispatchEvent(new Event("blur")); expect(s.pending.size).toBe(0);
  const afterBlur = s.matrix(); s.advance(200); expect(s.matrix()).toEqual(afterBlur);
  s.key("q"); s.app.destroy(); destroy = undefined;
  expect(s.pending.size).toBe(0); expect(s.dispose).toHaveBeenCalledOnce();
  const calls = s.draw.mock.calls.length; s.key("w"); s.advance(250);
  expect(s.draw.mock.calls).toHaveLength(calls); expect(s.root.querySelector(".steel-controls")).toBeNull();
});

it("roda move a posição, precisão reduz o passo e arrastar com Shift desloca sem mudar o zoom", () => {
  const s = scene(); s.click("free"); const original = s.matrix();
  s.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
  const normal = s.matrix(); expect(normal).not.toEqual(original); expect(s.canvas.dataset.zoom).toBe("1.000");
  s.click("frame"); s.select("Velocidade da câmera", ".24");
  s.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
  const precise = s.matrix();
  const distance = (m: number[]) => Math.hypot(...m.slice(12).map((v, i) => v - original[i + 12]));
  expect(distance(precise)).toBeLessThan(distance(normal));
  s.canvas.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 100, clientY: 100, shiftKey: true }));
  s.canvas.dispatchEvent(new MouseEvent("pointermove", { clientX: 140, clientY: 120, shiftKey: true }));
  const panned = s.matrix(); expect(panned.slice(0, 12)).toEqual(precise.slice(0, 12)); expect(panned.slice(12)).not.toEqual(precise.slice(12));
  s.canvas.dispatchEvent(new Event("pointerup"));
});
