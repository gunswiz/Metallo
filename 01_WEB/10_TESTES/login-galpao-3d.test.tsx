import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { aparelhoFraco, decidirModoLogin, lerSinaisAparelho, type SinaisAparelho } from "@/03_FUNCOES_E_LOGICA/Galpao/decidir-3d";
import { LoginGalpao } from "@/02_COMPONENTES_VISUAIS/Galpao/login-galpao";

vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-roof-access.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-structure.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-renderer.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-camera.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-motion.js", () => ({}));

const bom: SinaisAparelho = { largura: 1280, reduzirMovimento: false, economiaDados: false, memoriaGb: 8, nucleos: 8, versaoChrome: 130 };
afterEach(() => { cleanup(); delete window.startMetalloSteel; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("computador bom mostra o 3D; celular só se a pessoa pedir; aparelho fraco nunca", () => {
  expect(decidirModoLogin(bom)).toBe("3d");
  expect(decidirModoLogin({ ...bom, largura: 390 })).toBe("opcional");
  expect(decidirModoLogin({ ...bom, largura: 899 })).toBe("opcional");
  expect(decidirModoLogin({ ...bom, largura: 900 })).toBe("3d");
});

it("cada sinal de aparelho fraco leva ao login simples, mesmo em tela grande", () => {
  for (const fraco of [{ reduzirMovimento: true }, { economiaDados: true }, { memoriaGb: 2 }, { memoriaGb: 1 }, { nucleos: 2 }, { versaoChrome: 89 }, { versaoChrome: 87 }]) {
    expect(aparelhoFraco({ ...bom, ...fraco })).toBe(true);
    expect(decidirModoLogin({ ...bom, ...fraco })).toBe("simples");
    expect(decidirModoLogin({ ...bom, ...fraco, largura: 360 })).toBe("simples");
  }
  expect(decidirModoLogin({ ...bom, memoriaGb: 4, nucleos: 4, versaoChrome: 90 })).toBe("3d");
  expect(decidirModoLogin({ largura: 1280, reduzirMovimento: false, economiaDados: false })).toBe("3d");
});

it("lê os sinais do aparelho sem quebrar em navegador antigo", () => {
  vi.stubGlobal("matchMedia", undefined);
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36 Chrome/87.0.4280.141 Mobile Safari/537.36", hardwareConcurrency: 4 });
  expect(lerSinaisAparelho()).toMatchObject({ reduzirMovimento: false, economiaDados: false, memoriaGb: undefined, nucleos: 4, versaoChrome: 87 });
  vi.stubGlobal("matchMedia", () => { throw new Error("sem suporte"); });
  expect(lerSinaisAparelho().reduzirMovimento).toBe(false);
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
  vi.stubGlobal("navigator", { userAgent: "x", connection: { saveData: true }, deviceMemory: 1 });
  expect(lerSinaisAparelho()).toMatchObject({ reduzirMovimento: true, economiaDados: true, memoriaGb: 1, versaoChrome: undefined });
});

function tela() { return render(<LoginGalpao area="colaborador" outroAcesso="/x"><form><label>Usuário<input name="email"/></label><button>Entrar</button></form></LoginGalpao>); }

it("celular: login simples com o formulário à mão, sem carregar o 3D, e o 3D só vem ao pedir", async () => {
  vi.stubGlobal("innerWidth", 390);
  const start = vi.fn(() => ({ destroy: vi.fn() })); window.startMetalloSteel = start;
  const { container } = tela();
  expect(container.querySelector(".steel-login")).toHaveClass("steel-simples");
  expect(container.querySelector("canvas")).toBeNull();
  expect(screen.getByRole("img", { name: "Estrutura metálica do galpão da obra Plastamp" })).toBeInTheDocument();
  expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
  await new Promise(r => setTimeout(r, 50)); expect(start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ver animação do galpão" }));
  await waitFor(() => expect(start).toHaveBeenCalledOnce());
  expect(container.querySelector(".steel-login")).not.toHaveClass("steel-simples");
});

it("aparelho fraco: login simples, sem botão de animação e sem carregar o 3D", async () => {
  vi.stubGlobal("innerWidth", 390); vi.stubGlobal("navigator", { userAgent: "Chrome/87.0", hardwareConcurrency: 4 });
  const start = vi.fn(() => ({ destroy: vi.fn() })); window.startMetalloSteel = start;
  tela();
  expect(screen.queryByRole("button", { name: "Ver animação do galpão" })).toBeNull();
  await new Promise(r => setTimeout(r, 50)); expect(start).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
});
