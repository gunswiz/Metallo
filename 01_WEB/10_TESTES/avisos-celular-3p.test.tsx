import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

// Marco 3P: avisos no celular (lembrete do consumo do dia).
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/client", () => ({ createClient: () => ({ rpc: mocks.rpc, functions: { invoke: mocks.invoke } }) }));
import { AvisosCelular, chaveVapid } from "@/02_COMPONENTES_VISUAIS/avisos-celular";
import { domingoEmFortaleza, horaFortaleza } from "@/05_ACESSO_A_DADOS/Supabase/avisos-3p";
import { TESTE_ONLINE_VAPID_PUBLICA } from "@/09_CONFIGURACOES/ambiente-teste-online";

const original = { sw: Object.getOwnPropertyDescriptor(navigator, "serviceWorker") };
function simularAparelho(opcoes: { inscrito?: boolean; permissao?: NotificationPermission } = {}) {
  const sub = { endpoint: "https://push.exemplo.test/abc", unsubscribe: vi.fn(async () => true), toJSON: () => ({ endpoint: "https://push.exemplo.test/abc", keys: { p256dh: "p", auth: "a" } }) };
  const reg = { pushManager: { getSubscription: vi.fn(async () => (opcoes.inscrito ? sub : null)), subscribe: vi.fn(async () => sub) } };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => reg), register: vi.fn(async () => reg), ready: Promise.resolve(reg) } });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", { permission: opcoes.permissao ?? "default", requestPermission: vi.fn(async () => "granted") });
  return { reg, sub };
}
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (original.sw) Object.defineProperty(navigator, "serviceWorker", original.sw); else delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

it("converte a chave pública VAPID (65 bytes, começa com 0x04)", () => {
  const bytes = chaveVapid(TESTE_ONLINE_VAPID_PUBLICA);
  expect(bytes).toHaveLength(65);
  expect(bytes[0]).toBe(4);
});

it("hora e dia são os de Fortaleza, não os do servidor", () => {
  expect(horaFortaleza(new Date("2026-10-07T19:30:00Z"))).toBe(16);
  expect(horaFortaleza(new Date("2026-10-08T02:00:00Z"))).toBe(23);
  expect(domingoEmFortaleza(new Date("2026-10-11T15:00:00Z"))).toBe(true);
  expect(domingoEmFortaleza(new Date("2026-10-12T01:00:00Z"))).toBe(true); // ainda domingo 22h em Fortaleza
  expect(domingoEmFortaleza(new Date("2026-10-12T12:00:00Z"))).toBe(false);
});

it("sem suporte no navegador: explica com palavras simples e não mostra botão", async () => {
  render(<AvisosCelular />);
  expect(await screen.findByText(/Este navegador não recebe avisos/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("no Início (compacto) some quando o aparelho não suporta", async () => {
  const { container } = render(<AvisosCelular compacto />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});

it("liga os avisos: pede permissão, inscreve com a chave pública e salva no banco", async () => {
  const { reg } = simularAparelho();
  mocks.rpc.mockResolvedValue({ error: null });
  render(<AvisosCelular />);
  fireEvent.click(await screen.findByRole("button", { name: "Ligar avisos" }));
  expect(await screen.findByText("Avisos ligados neste aparelho.")).toBeInTheDocument();
  expect(reg.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  expect(mocks.rpc).toHaveBeenCalledWith("save_push_subscription_3p", { p_endpoint: "https://push.exemplo.test/abc", p_p256dh: "p", p_auth: "a" });
});

it("se o banco recusar, desfaz a inscrição e avisa", async () => {
  const { sub } = simularAparelho();
  mocks.rpc.mockResolvedValue({ error: { message: "x" } });
  render(<AvisosCelular />);
  fireEvent.click(await screen.findByRole("button", { name: "Ligar avisos" }));
  expect(await screen.findByText(/Não foi possível ligar os avisos/)).toBeInTheDocument();
  expect(sub.unsubscribe).toHaveBeenCalled();
});

it("ligado: envia teste e desliga removendo do banco", async () => {
  const { sub } = simularAparelho({ inscrito: true });
  mocks.invoke.mockResolvedValue({ data: { ok: true, enviados: 1 }, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  render(<AvisosCelular />);
  fireEvent.click(await screen.findByRole("button", { name: "Enviar teste" }));
  expect(await screen.findByText(/Aviso de teste enviado/)).toBeInTheDocument();
  expect(mocks.invoke).toHaveBeenCalledWith("lembrete-consumo", { body: { acao: "teste" } });
  fireEvent.click(screen.getByRole("button", { name: "Desligar" }));
  expect(await screen.findByText("Avisos desligados neste aparelho.")).toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenCalledWith("delete_push_subscription_3p", { p_endpoint: "https://push.exemplo.test/abc" });
  expect(sub.unsubscribe).toHaveBeenCalled();
});

it("bloqueado no navegador: ensina onde liberar", async () => {
  simularAparelho({ permissao: "denied" });
  render(<AvisosCelular />);
  expect(await screen.findByText(/bloqueados nas configurações/)).toBeInTheDocument();
});

it("service worker só abre endereços do próprio Metallo e não expõe segredos", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  expect(sw).toContain(`data.url.startsWith("/") && !data.url.startsWith("//")`);
  expect(sw).toContain("showNotification");
  expect(sw).not.toMatch(/vapid|privad|secret/i);
});
