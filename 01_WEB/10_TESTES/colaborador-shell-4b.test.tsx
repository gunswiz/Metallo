// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DrawerColaborador } from "@/app/colaborador/[[...screen]]/drawer-colaborador";
import { PendenciasColaborador } from "@/app/colaborador/[[...screen]]/pendencias-colaborador";
import { MeuPontoOnline } from "@/app/colaborador/[[...screen]]/meu-ponto-online";
import { MeusRegistros } from "@/app/colaborador/[[...screen]]/meus-registros";
import { recordsRequest } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { onlinePointRequest } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import type { PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";

vi.mock("@/05_ACESSO_A_DADOS/Ponto/registros", async original => ({ ...await original<typeof import("@/05_ACESSO_A_DADOS/Ponto/registros")>(), recordsRequest: vi.fn() }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-online", async original => ({ ...await original<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-online")>(), onlinePointRequest: vi.fn() }));
const request = vi.mocked(recordsRequest), point = vi.mocked(onlinePointRequest), getToken = vi.fn(async () => "JWT-SINTETICO");
const logout = vi.fn(async () => {}), go = vi.fn();
const name = "João Sintético de Almeida Montagens Industriais Nome Muito Longo para Conferência";
const profile = { employee_id: "ID-INTERNO-NAO-EXIBIR", full_name: name, profession: null, team_name: null };
const record = { event_id: "00000000-0000-4000-8000-000000000001", reference: "LAB-4A-1", marking_at: "2026-10-01T12:00:00.000Z", recorded_at: "2026-10-01T12:00:08.000Z", timezone: "America/Fortaleza", historical_data: "LIMITED", source: "4A" };
const page = (events = [record], has_more = false) => new Response(JSON.stringify({ events, has_more, offset: 0, window: { start: "2026-10-01T03:00:00.000Z", end: "2026-10-01T15:00:00.000Z" } }));
function ShellHarness() {
  const trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false);
  return <><button ref={trigger} onClick={() => setOpen(true)} aria-expanded={open}>Abrir menu</button><button>Conteúdo de fundo</button><DrawerColaborador open={open} onClose={() => setOpen(false)} trigger={trigger} profile={profile} current="inicio" busy={false} logout={logout} demo={false} go={go}/></>;
}
const item = (status: PersonalItem3g["status"]): PersonalItem3g => ({ delivery_id: record.event_id, item_name: "Trena", quantity: 1, unit: "un", variant: null, delivered_at: record.marking_at, confirmed_at: status === "EM_USO" ? record.recorded_at : null, status, events: [] });
beforeEach(() => {
  vi.resetAllMocks(); getToken.mockResolvedValue("JWT-SINTETICO"); logout.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_name, _options, run) => run({ name: "lock" })) } });
  request.mockImplementation(async () => page());
  point.mockImplementation(async path => path === "/events" ? { events: [] } : { server_at: record.marking_at });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("drawer abre com foco, nome completo longo e sem equipe; sem IDs técnicos", () => {
  render(<ShellHarness/>); fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  const menu = screen.getByRole("dialog", { name: "Menu do Metallo Colaborador" });
  expect(within(menu).getByText(name)).toBeVisible(); expect(within(menu).getByText("Sem equipe atribuída")).toBeVisible();
  expect(menu.textContent).not.toContain(profile.employee_id); expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
});
it("Escape fecha e devolve foco; restaura scroll original", () => {
  document.body.style.overflow = "auto"; render(<ShellHarness/>);
  const trigger = screen.getByRole("button", { name: "Abrir menu" }); fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("button", { name: "Fechar menu" }), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus(); expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow = "";
});
it("Tab e Shift+Tab permanecem no menu; botão fechar disponível", () => {
  render(<ShellHarness/>); fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  const close = screen.getByRole("button", { name: "Fechar menu" }), exit = screen.getByRole("button", { name: "Sair" });
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); expect(exit).toHaveFocus();
  fireEvent.keyDown(exit, { key: "Tab" }); expect(close).toHaveFocus(); fireEvent.click(close); expect(screen.queryByRole("dialog")).toBeNull();
});
it("menu agrupado usa rotas pessoais, solicitações 3C e segurança 3F existentes", () => {
  render(<ShellHarness/>); fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  const nav = screen.getByRole("navigation", { name: "Navegação principal" });
  for (const label of ["Meu Ponto", "EPI e Itens", "Trabalho", "Solicitações", "Minha Conta"]) expect(within(nav).getByRole("region", { name: label })).toBeInTheDocument();
  expect(within(nav).getByRole("link", { name: "Minhas solicitações Solicitações de EPI" })).toHaveAttribute("href", "/colaborador/epis#epi-solicitacoes");
  expect(within(nav).getByRole("link", { name: "Segurança" })).toHaveAttribute("href", "/colaborador/perfil#perfil-seguranca");
  expect(nav.textContent).not.toMatch(/Contracheque|Meus documentos|Minha jornada|Assinar ponto|Quiosque|ASO/i);
  fireEvent.click(within(nav).getByRole("link", { name: "Meus registros" })); expect(screen.queryByRole("dialog")).toBeNull();
});
it("Sair usa o fluxo recebido sem improvisar troca de conta", () => {
  render(<ShellHarness/>); fireEvent.click(screen.getByRole("button", { name: "Abrir menu" })); fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(logout).toHaveBeenCalledExactlyOnceWith(); expect(screen.queryByRole("dialog")).toBeNull(); expect(go).not.toHaveBeenCalled();
});
it("fragmento aguarda a seção pessoal carregada e posiciona foco sem duplicar tela", async () => {
  const scroll = vi.fn(); Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
  history.replaceState(null, "", "/colaborador/epis#epi-solicitacoes");
  try {
    const view = render(<ShellHarness/>);
    const section = document.createElement("div"); section.id = "epi-solicitacoes"; section.textContent = "Histórico existente"; document.body.appendChild(section);
    await waitFor(() => expect(section).toHaveFocus()); expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(document.querySelectorAll("#epi-solicitacoes")).toHaveLength(1); view.unmount(); section.remove();
  } finally { history.replaceState(null, "", "/colaborador/inicio"); }
});
it("pendência real é retirada após confirmação e não inventa futuros recursos", async () => {
  let status: PersonalItem3g["status"] = "AGUARDANDO_CONFIRMACAO";
  const read = vi.fn(async () => [item(status)]);
  render(<PendenciasColaborador items={read} communications={async () => []}/>);
  expect(await screen.findByRole("link", { name: "1 item pessoal aguardando confirmação" })).toHaveAttribute("href", "/colaborador/itens");
  status = "EM_USO"; fireEvent.focus(window); expect(screen.queryByText("1 item pessoal aguardando confirmação")).toBeNull();
  await screen.findByText("Nenhuma pendência no momento."); expect(document.body.textContent).not.toMatch(/Contracheque|Treinamento|documento novo/i);
});
it("consulta parcial falha claramente, sem declarar zero pendências", async () => {
  render(<PendenciasColaborador items={async () => { throw new Error("offline"); }} communications={async () => []}/>);
  await screen.findByText(/Algumas pendências não puderam/); expect(screen.queryByText("Nenhuma pendência no momento.")).toBeNull();
});
it("troca João/Maria ignora leitura tardia e logout desmonta pendências", async () => {
  let finish!: (items: PersonalItem3g[]) => void;
  const view = render(<PendenciasColaborador key="joao" items={() => new Promise(resolve => { finish = resolve; })} communications={async () => []}/>);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  view.rerender(<PendenciasColaborador key="maria" items={async () => []} communications={async () => []}/>); finish([item("AGUARDANDO_CONFIRMACAO")]);
  await screen.findByText("Nenhuma pendência no momento."); expect(screen.queryByText("1 item pessoal aguardando confirmação")).toBeNull();
  view.unmount(); expect(screen.queryByRole("region", { name: "Pendências" })).toBeNull();
});
it("Home mostra data do servidor, horários brutos e dois atalhos, sem adquirir GPS", async () => {
  const gps = vi.fn(); Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
  render(<MeuPontoOnline getToken={getToken} employeeId="joao" name={name} presentation="home"/>);
  await screen.findByRole("heading", { name: "Marcações de hoje" });
  expect(screen.getByText("quinta-feira, 1 de outubro de 2026")).toBeInTheDocument();
  expect(within(await screen.findByRole("list", { name: "Horários registrados hoje" })).getByText("09:00:00")).toBeInTheDocument();
  const shortcuts = within(screen.getByRole("navigation", { name: "Atalhos de ponto" })).getAllByRole("link");
  expect(shortcuts.map(link => link.getAttribute("href"))).toEqual(["/colaborador/registros", "/colaborador/comprovantes"]);
  expect(document.body.textContent).not.toMatch(/Entrada|Saída|MINHA JORNADA|banco de horas|Horas extras/);
  expect(gps).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledWith("/list", "JWT-SINTETICO", expect.objectContaining({ body: JSON.stringify({ period: "today", offset: 0 }) }));
  expect(point.mock.calls.filter(([path, , init]) => path === "/events" && init?.method !== "POST")).toHaveLength(0);
});
it("Registrar ponto na Home reutiliza a intenção, GPS e commit 4A", async () => {
  const event = { event_id: record.event_id, synthetic_reference: record.reference, marking_at: record.marking_at, recorded_at: record.recorded_at, timezone: "America/Fortaleza", collector: "BROWSER", online: true, location_status: "DENIED", accuracy_meters: null };
  const gps = vi.fn((_ok, fail) => fail({ code: 1 })); Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: gps } });
  point.mockImplementation(async (path, _token, init) => path === "/events" ? init?.method === "POST" ? { event } : { events: [] } : { server_at: record.marking_at });
  render(<MeuPontoOnline getToken={getToken} employeeId="joao" name={name} presentation="home"/>);
  const button = screen.getByRole("button", { name: "Registrar ponto" }); fireEvent.click(button); fireEvent.click(button);
  await screen.findByRole("heading", { name: "Ponto registrado" }); expect(gps).toHaveBeenCalledTimes(1);
  const operations = point.mock.calls.filter(([, , init]) => init?.method === "POST"); expect(operations.map(call => call[0])).toEqual(["/begin", "/events"]);
  expect(JSON.parse(String(operations[0][2]?.body)).idempotency_key).toBe(JSON.parse(String(operations[1][2]?.body)).idempotency_key);
  expect(point.mock.calls.filter(([path, , init]) => path === "/events" && init?.method !== "POST")).toHaveLength(0);
});
it("Home não chama registros anteriores de hoje e informa limite visual", async () => {
  request.mockResolvedValue(page([record], true)); render(<MeusRegistros getToken={getToken} presentation="today"/>);
  await screen.findByText(/Exibindo as 20 marcações mais recentes/); expect(screen.queryByRole("button", { name: /download|Baixar|Ver recibo/i })).toBeNull();
  expect(JSON.parse(String(request.mock.calls[0][2]?.body))).toEqual({ period: "today", offset: 0 });
});
it("registros mantém 60 dias e 20 por página; recibos reutilizam a consulta 48h", async () => {
  const view = render(<MeusRegistros key="history" getToken={getToken} presentation="history"/>);
  await screen.findByText("Registro realizado"); fireEvent.change(screen.getByLabelText("Período"), { target: { value: "60d" } });
  await waitFor(() => expect(JSON.parse(String(request.mock.calls.at(-1)?.[2]?.body))).toEqual({ period: "60d", offset: 0 }));
  expect(screen.queryByRole("button", { name: /Baixar comprovantes/ })).toBeNull();
  view.rerender(<MeusRegistros key="receipts" getToken={getToken} presentation="receipts"/>);
  await screen.findByText("Registro realizado"); expect(screen.getByLabelText("Período")).toHaveValue("48h");
  expect(screen.getByRole("button", { name: /Baixar comprovantes das últimas 48 horas/ })).toBeInTheDocument();
});
