// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ColaboradorApp from "@/app/colaborador/[[...screen]]/colaborador-app";
import { MeusEpis } from "@/app/colaborador/[[...screen]]/meus-epis";
import { personalEpis, portalFetch } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import ColaboradorPage from "@/app/colaborador/[[...screen]]/page";
import { iniciarMarcacao } from "@/03_FUNCOES_E_LOGICA/Ponto/marcacao-em-andamento";

const state = vi.hoisted(() => {
  const base = { acceptedAt: null as string | null, actor: "joao" as string | null, rows: [] as unknown[], failure: false, replace: vi.fn(), signOut: vi.fn(), pointRequest: vi.fn(), rpc: vi.fn() };
  // Roteador estável, como o do Next (o mock antigo criava um objeto novo a cada render).
  return Object.assign(base, { router: { replace: (...args: unknown[]) => base.replace(...args) } });
});
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "127.0.0.1:3101" }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => state.router }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-lab", async importOriginal => {
  const actual = await importOriginal<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-lab")>();
  return { ...actual, pointRequest: state.pointRequest };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: {
    getUser: async () => ({ data: { user: state.actor ? { id: state.actor } : null }, error: null }),
    getSession: async () => ({ data: { session: { access_token: "jwt-sintetico" } }, error: null }),
    signOut: state.signOut, dispose: async () => {},
  },
  rpc: (name: string, ...args: unknown[]) => {
    state.rpc(name, ...args);
    if (name === "my_employee_profile") return Promise.resolve({ data: [{ employee_id: state.actor, full_name: state.actor === "joao" ? "João Sintético" : "Maria Sintética", profession: null, team_name: null }], error: null });
    if (name === "my_personal_epi") return Promise.resolve(state.failure ? { data: null, error: new Error("Failed to fetch") } : { data: state.rows, error: null });
    if (name === "my_exchangeable_epi" || name === "my_epi_exchange_requests") return Promise.resolve({ data: [], error: null });
    if (name === "my_epi_awareness_3i") return Promise.resolve({ data: [{ term_version: "NR6-6.6.1-v1", term_text: "Termo sintético NR-6 6.6.1", term_sha256: "a".repeat(64), accepted_at: state.acceptedAt }], error: null });
    if (name === "accept_epi_awareness_3i") { state.acceptedAt = "2026-10-03T12:00:00Z"; return Promise.resolve({ data: state.acceptedAt, error: null }); }
    throw new Error(`RPC inesperada: ${name}`);
  },
}) }));

const entry = (item_name: string, current_status: "active" | "replaced" = "active") => ({
  item_name, ca_number: "12345", quantity: 1, unit: "un", variant: "M",
  delivered_at: "2026-08-12T12:00:00Z", delivery_reason: "initial",
  current_status, closed_at: current_status === "active" ? null : "2026-09-01T12:00:00Z",
});
beforeEach(() => {
  localStorage.clear(); state.acceptedAt = "2026-10-01T12:00:00Z"; state.actor = "joao"; state.rows = [entry("Capacete João"), entry("Luva anterior", "replaced")]; state.failure = false;
  state.replace.mockReset(); state.signOut.mockReset(); state.rpc.mockReset(); state.pointRequest.mockReset();
  state.signOut.mockResolvedValue({ error: null }); state.pointRequest.mockResolvedValue({ status: 200, body: { status: "SESSAO_ENCERRADA" } });
});
afterEach(cleanup);

it("mostra lista curta dos EPIs em uso; histórico encerrado fica em Mais opções, sem campos administrativos", async () => {
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "EPIs com você (1)" })).toBeInTheDocument();
  expect(screen.getByText(/1 unidade · tamanho M · CA 12345 · desde 12\/08\/2026/)).toBeInTheDocument();
  // Lista enxuta: o histórico não ocupa a tela até a pessoa pedir.
  expect(screen.queryByText("Luva anterior")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
  expect(screen.getByText("Luva anterior")).toBeInTheDocument();
  expect(screen.getByText(/Substituído em 01\/09\/2026/)).toBeInTheDocument();
  expect(screen.getByText(/Termo de ciência sobre EPI \(NR-6\) aceito em/)).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "EPIs com você (1)" })).queryByText(/CPF|ASO|salário|estoque|fornecedor|hash/i)).not.toBeInTheDocument();
  expect(state.rpc.mock.calls.filter(call => call[0] === "my_personal_epi").every(call => call.length === 1)).toBe(true);
});
it("sem EPI mantém portal e mostra vazio amigável mesmo sem equipe ou obra", async () => {
  state.rows = [];
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Nenhum EPI com você no momento.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
  expect(screen.getByText("Nenhuma entrega encerrada no histórico.")).toBeInTheDocument();
  expect(state.signOut).not.toHaveBeenCalled();
});
it("troca de conta entre abas oculta EPIs anteriores antes da nova leitura", async () => {
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  state.actor = "maria"; state.rows = [entry("Capacete Maria")];
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "maria" }));
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  expect(await screen.findByText("Capacete Maria")).toBeInTheDocument();
});
it("atualização por foco substitui a lista sem manter o EPI anterior", async () => {
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  state.rows = [entry("Capacete atualizado")];
  fireEvent.focus(window);
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  expect(await screen.findByText("Capacete atualizado")).toBeInTheDocument();
});
it("sessão expirada esconde imediatamente os EPIs apresentados", async () => {
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  state.actor = null;
  fireEvent.focus(window);
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/colaborador/login"));
});
it("perda do laboratório remove EPIs antigos e oferece tentativa novamente", async () => {
  const readEpis = async () => { if (state.failure) throw new Error("Failed to fetch"); return personalEpis(state.rows); };
  render(<MeusEpis readEpis={readEpis} />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  state.failure = true; fireEvent.focus(window);
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Dados de EPIs temporariamente indisponíveis.");
  state.failure = false; state.rows = [entry("Novo EPI")];
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Novo EPI")).toBeInTheDocument();
});
it("logout elimina a lista antes de terminar a chamada ao servidor", async () => {
  let finish!: (value: unknown) => void;
  state.pointRequest.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  finish({ status: 200, body: { status: "SESSAO_ENCERRADA" } });
});
it("parser rejeita IDs, segredos e campos extras", () => {
  expect(personalEpis([entry("Capacete")])).toHaveLength(1);
  for (const extra of [{ employee_id: "maria" }, { delivery_id: "segredo" }, { cpf: "000" }, { stock_batch_id: "interno" }])
    expect(() => personalEpis([{ ...entry("Capacete"), ...extra }])).toThrow("Contrato pessoal de EPIs inválido.");
  expect(() => personalEpis([{ ...entry("Capacete"), quantity: 0 }])).toThrow();
});
it("cliente só permite RPC pessoal local, recusando tabelas, IDs e remoto", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  try {
    await portalFetch("http://127.0.0.1:54321/rest/v1/rpc/my_personal_epi", { method: "POST", body: "{}" });
    for (const url of ["http://127.0.0.1:54321/rest/v1/epi_deliveries", "http://127.0.0.1:54321/rest/v1/rpc/my_personal_epi/maria", "https://projeto.supabase.co/rest/v1/rpc/my_personal_epi"])
      await expect(portalFetch(url)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { fetcher.mockRestore(); }
});
it("rota de EPIs existe somente na prévia local autorizada", async () => {
  vi.stubEnv("METALLO_LOCAL_PREVIEW", "1"); vi.stubEnv("METALLO_COLABORADOR_VISUAL_PREVIEW", "1");
  const page = await ColaboradorPage({ params: Promise.resolve({ screen: ["epis"] }) });
  expect(page.props.screen).toBe("epis");
  vi.unstubAllEnvs();
});

it("foco da janela durante marcação de ponto revalida sem esconder o portal; sessão expirada ainda encerra", async () => {
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  // Sem marcação: regra aprovada mantida (esconde e mostra a verificação de acesso).
  fireEvent.focus(window);
  expect(screen.getByText("Verificando seu acesso…")).toBeInTheDocument();
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  const encerrar = iniciarMarcacao();
  try {
    const before = state.rpc.mock.calls.filter(([name]) => name === "my_employee_profile").length;
    fireEvent.focus(window);
    expect(screen.queryByText("Verificando seu acesso…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    await waitFor(() => expect(state.rpc.mock.calls.filter(([name]) => name === "my_employee_profile").length).toBe(before + 1));
    expect(await screen.findByText("Capacete João")).toBeInTheDocument();
    state.actor = null;
    fireEvent.focus(window);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/colaborador/login"));
    expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  } finally { encerrar(); }
});

it("termo de ciência NR-6 é a primeira tela: bloqueia a lista até aceitar e registra o aceite uma vez", async () => {
  state.acceptedAt = null;
  render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
  expect(await screen.findByText("Termo sintético NR-6 6.6.1")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Antes de ver seus EPIs, leia este termo" })).toBeInTheDocument();
  // Sem aceitar, nada de EPI aparece nem é consultado.
  expect(screen.queryByText("Capacete João")).not.toBeInTheDocument();
  expect(state.rpc.mock.calls.some(([name]) => name === "my_personal_epi")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Li e concordo" }));
  expect(await screen.findByText("Capacete João")).toBeInTheDocument();
  const accepts = state.rpc.mock.calls.filter(([name]) => name === "accept_epi_awareness_3i");
  expect(accepts).toHaveLength(1);
  expect(accepts[0][1]).toMatchObject({ p_term_sha256: "a".repeat(64) });
  expect(screen.queryByRole("button", { name: "Li e concordo" })).not.toBeInTheDocument();
});

it("termo longo só libera o botão depois de rolado até o fim", async () => {
  state.acceptedAt = null;
  const height = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  const client = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  try {
    render(<ColaboradorApp screen="epis" anonKey="anon-local" />);
    const text = await screen.findByLabelText("Texto do termo");
    const button = screen.getByRole("button", { name: "Li e concordo" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Arraste o texto até o fim para liberar o botão.")).toBeInTheDocument();
    text.scrollTop = 800; fireEvent.scroll(text);
    expect(button).toBeDisabled();
    text.scrollTop = 1600; fireEvent.scroll(text);
    expect(button).toBeEnabled();
    expect(state.rpc.mock.calls.some(([name]) => name === "accept_epi_awareness_3i")).toBe(false);
  } finally { height.mockRestore(); client.mockRestore(); }
});
