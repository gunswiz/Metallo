// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ColaboradorApp from "@/app/colaborador/[[...screen]]/colaborador-app";
import { pointRequest } from "@/05_ACESSO_A_DADOS/Ponto/ponto-lab";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(), getUser: vi.fn(), getSession: vi.fn(), rpc: vi.fn(), teamRpc: vi.fn(), workRpc: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), pointRequest: vi.fn(),
}));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-lab", async importOriginal => {
  const actual = await importOriginal<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-lab")>();
  return { ...actual, pointRequest: mocks.pointRequest };
});
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: {
    getUser: mocks.getUser,
    getSession: mocks.getSession,
    signInWithPassword: mocks.signIn,
    signOut: mocks.signOut,
    stopAutoRefresh: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  rpc: (name: string) => name === "my_team_summary" ? mocks.teamRpc() : name === "my_current_work" ? mocks.workRpc() : mocks.rpc(name),
}) }));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "jwt-sintetico" } }, error: null });
  mocks.teamRpc.mockResolvedValue({ data: [], error: null });
  mocks.workRpc.mockResolvedValue({ data: [], error: null });
  mocks.pointRequest.mockResolvedValue({ status: 200, body: { status: "SESSAO_ENCERRADA" } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.signIn.mockResolvedValue({ data: { user: { id: "test" } }, error: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("agrupa a navegação no drawer sem duplicar barra inferior", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null }], error: null });
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir menu" }));
  const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
  expect(within(navigation).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual([
    "/colaborador/inicio", "/colaborador/ponto", "/colaborador/registros", "/colaborador/comprovantes",
    "/colaborador/epis", "/colaborador/itens", "/colaborador/epis#epi-troca-heading", "/colaborador/treinamentos",
    "/colaborador/equipe", "/colaborador/obra", "/colaborador/comunicados",
    "/colaborador/epis#epi-solicitacoes", "/colaborador/perfil", "/colaborador/perfil#perfil-seguranca",
  ]);
  expect(screen.getAllByRole("navigation", { name: "Navegação principal" })).toHaveLength(1);
  for (const group of ["Meu Ponto", "EPI e Itens", "Trabalho", "Solicitações", "Minha Conta"]) expect(within(navigation).getByRole("region", { name: group })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
  expect(screen.queryByRole("navigation", { name: "Navegação principal" })).not.toBeInTheDocument();
});

it("troca de sessão em outra aba limpa o titular anterior antes de revalidar", async () => {
  const joao = { employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null };
  const maria = { ...joao, employee_id: "maria", full_name: "Maria Sintética" };
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [joao], error: null });
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await screen.findByText("Olá, João");
  let release!: (value: unknown) => void;
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  mocks.rpc.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", oldValue: "sessao-joao", newValue: "sessao-maria" }));
  expect(screen.queryByText("Olá, João")).not.toBeInTheDocument();
  await waitFor(() => expect(release).toBeTypeOf("function"));
  release({ data: [maria], error: null });
  expect(await screen.findByText("Olá, Maria")).toBeInTheDocument();
  expect(screen.queryByText("João Sintético")).not.toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it("3G esconde itens pessoais de João antes de carregar Maria em outra aba", async () => {
  const joao = { employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null };
  const maria = { employee_id: "maria", full_name: "Maria Sintética", profession: null, team_name: null };
  const personal = (name: string) => [{ delivery_id: "11111111-1111-4111-8111-111111111111", item_name: name,
    quantity: 1, unit: "un", variant: null, delivered_at: "2026-09-29T12:00:00+00:00", confirmed_at: null,
    status: "AGUARDANDO_CONFIRMACAO", events: [] }];
  let actor: "joao" | "maria" = "joao";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "my_personal_items_3g"
    ? personal(actor === "joao" ? "Trena João" : "Trena Maria") : [actor === "joao" ? joao : maria], error: null }));
  render(<ColaboradorApp screen="itens" anonKey="anon-local" />);
  expect(await screen.findByText("Trena João")).toBeInTheDocument();
  actor = "maria";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "maria" }));
  expect(screen.queryByText("Trena João")).not.toBeInTheDocument();
  expect(await screen.findByText("Trena Maria")).toBeInTheDocument();
});

it("pendências 3G isolam as contagens de João e Maria e limpa tudo no logout", async () => {
  const profile = (id: string, name: string) => ({ employee_id: id, full_name: name, profession: null, team_name: null });
  const personal = (id: string, status: "AGUARDANDO_CONFIRMACAO" | "EM_USO") => ({
    delivery_id: id, item_name: "Ferramenta sintética", quantity: 1, unit: "un", variant: null,
    delivered_at: "2026-09-29T12:00:00+00:00", confirmed_at: status === "EM_USO" ? "2026-09-29T13:00:00+00:00" : null,
    status, events: [],
  });
  let actor: "joao" | "maria" = "joao";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "my_personal_items_3g"
    ? actor === "joao" ? [
      personal("11111111-1111-4111-8111-111111111111", "AGUARDANDO_CONFIRMACAO"),
      personal("22222222-2222-4222-8222-222222222222", "EM_USO"),
    ] : [personal("33333333-3333-4333-8333-333333333333", "EM_USO")]
    : [actor === "joao" ? profile("joao", "João Sintético") : profile("maria", "Maria Sintética")], error: null }));
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  expect(await screen.findByText("1 item pessoal aguardando confirmação")).toBeInTheDocument();
  actor = "maria";
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "maria" }));
  expect(screen.queryByText("1 item pessoal aguardando confirmação")).not.toBeInTheDocument();
  await screen.findByText("Olá, Maria");
  await waitFor(() => expect(screen.queryByText("Consultando suas pendências…")).not.toBeInTheDocument());
  expect(screen.queryByText("1 item pessoal aguardando confirmação")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  await waitFor(() => expect(screen.queryByRole("link", { name: /Meus Itens Pessoais/ })).not.toBeInTheDocument());
  expect(screen.queryByRole("region", { name: "Pendências" })).not.toBeInTheDocument();
});

it("resposta atrasada do titular anterior não reaparece após troca em outra aba", async () => {
  const dto = (id: string, name: string) => ({ data: [{ employee_id: id, full_name: name, profession: null, team_name: null }], error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue(dto("joao", "João Sintético"));
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await screen.findByText("Olá, João");
  let releaseOld!: (value: unknown) => void;
  mocks.rpc.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }));
  fireEvent.focus(window);
  await waitFor(() => expect(releaseOld).toBeTypeOf("function"));
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  mocks.rpc.mockResolvedValue(dto("maria", "Maria Sintética"));
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "nova-sessao" }));
  expect(await screen.findByText("Olá, Maria")).toBeInTheDocument();
  releaseOld(dto("joao", "João Sintético"));
  await waitFor(() => expect(screen.getByText("Olá, Maria")).toBeInTheDocument());
  expect(screen.queryByText("João Sintético")).not.toBeInTheDocument();
});

it("logout atrasado não apaga sessão nova recebida de outra aba", async () => {
  const dto = (id: string) => ({ data: [{ employee_id: id, full_name: id, profession: null, team_name: null }], error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "João" } }, error: null });
  mocks.rpc.mockResolvedValue(dto("João"));
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await screen.findByText("Olá, João");
  let finishLogout!: (value: unknown) => void;
  mocks.signOut.mockImplementationOnce(() => new Promise(resolve => { finishLogout = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  mocks.getUser.mockResolvedValue({ data: { user: { id: "Maria" } }, error: null });
  mocks.rpc.mockResolvedValue(dto("Maria"));
  localStorage.setItem("metallo-colaborador-laboratorio", "sessao-nova-sintetica");
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "sessao-nova-sintetica" }));
  await screen.findByText("Olá, Maria");
  finishLogout({ error: null });
  await waitFor(() => expect(screen.getByText("Olá, Maria")).toBeInTheDocument());
  expect(localStorage.getItem("metallo-colaborador-laboratorio")).toBe("sessao-nova-sintetica");
  expect(mocks.replace).not.toHaveBeenCalledWith("/colaborador/login");
});

it("foco durante logout pendente não recria cliente nem reapresenta o perfil", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null }], error: null });
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await screen.findByText("Olá, João");
  let finishLogout!: (value: unknown) => void;
  mocks.signOut.mockImplementationOnce(() => new Promise(resolve => { finishLogout = resolve; }));
  const calls = mocks.getUser.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  try {
    await act(async () => { fireEvent.focus(window); });
    expect(screen.queryByText("Olá, João")).not.toBeInTheDocument();
    expect(mocks.getUser).toHaveBeenCalledTimes(calls);
  } finally { await act(async () => { finishLogout({ error: null }); }); }
  expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login");
  expect(screen.queryByText("João Sintético")).not.toBeInTheDocument();
});

it("Sair de todos os dispositivos usa o escopo global e limpa o perfil", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null }], error: null });
  render(<ColaboradorApp screen="perfil" anonKey="anon-local" />);
  const button = await screen.findByRole("button", { name: "Sair de todos os dispositivos" });
  fireEvent.click(button);
  expect(screen.queryByText("João Sintético")).not.toBeInTheDocument();
  await waitFor(() => expect(pointRequest).toHaveBeenCalledWith("/lab-point/v1/session/global", "jwt-sintetico", expect.objectContaining({ method: "POST" })));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" }));
});

it("bloqueia rota pessoal direta sem sessão", async () => {
  render(<ColaboradorApp screen="perfil" anonKey="anon-local" />);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login"));
  expect(screen.queryByText("Meu Perfil")).not.toBeInTheDocument();
});

it.each([
  ["João Sintético", "João"],
  ["Maria Sintética", "Maria"],
])("mostra a Home mínima da conta %s sem dados de saúde ou de colegas", async (name, shortName) => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: shortName } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: shortName, full_name: name, profession: "Teste", team_name: "Equipe Teste" }], error: null });
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  expect(await screen.findByText(`Olá, ${shortName}`)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar ponto" })).toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Atalhos de ponto" })).getAllByRole("link")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  expect(screen.getByText(name)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Minha obra" })).toHaveAttribute("href", "/colaborador/obra");
  expect(screen.getByText("AMBIENTE DE TESTE")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Registrar ponto" })).toHaveAttribute("href", "/colaborador/ponto");
  expect(screen.getAllByText(/SIMULAÇÃO SEM VALOR OFICIAL/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/ASO|CPF|inventário/i)).not.toBeInTheDocument();
  expect(screen.queryByText(shortName === "João" ? /Maria Sintética/ : /João Sintético/)).not.toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenCalledWith("my_employee_profile");
});

it("retira acesso de conta revogada sem DTO", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "revogada" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
  expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login");
  expect(screen.getByRole("alert")).toHaveTextContent("não tem acesso ativo");
});

it.each([
  ["perfil", null], ["equipe", null], ["perfil", ""], ["equipe", "   "],
])("preserva %s e informa ausência de equipe (%s) sem encerrar sessão", async (route, teamName) => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: "maria", full_name: "Maria Sintética", profession: "Soldadora", team_name: teamName }], error: null });
  render(<ColaboradorApp screen={route} anonKey="anon-local" />);
  expect(await screen.findByText(route === "equipe" ? "Sem equipe atribuída no momento." : "Sem equipe atribuída")).toBeInTheDocument();
  if (route === "equipe") fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  expect(screen.getAllByText("Maria Sintética").length).toBeGreaterThan(0);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.queryByText(/ASO|CPF|João Sintético/i)).not.toBeInTheDocument();
});

it("informa sessão expirada na rota protegida", async () => {
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login"));
  expect(screen.getByRole("alert")).toHaveTextContent("sessão terminou");
});

it("informa perda de conexão sem exibir dados pessoais", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  mocks.getUser.mockRejectedValue(new Error("Failed to fetch"));
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
  expect(screen.queryByText(/Olá,/)).not.toBeInTheDocument();
});

it("login inválido apresenta erro amigável", async () => {
  mocks.signIn.mockResolvedValue({ data: {}, error: new Error("Invalid login credentials") });
  render(<ColaboradorApp screen="login" anonKey="anon-local" />);
  await screen.findByText("Entrar no app do Funcionário");
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "joao@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "errada" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha incorretos");
});

it("logout remove a sessão local e volta ao login", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: [{ employee_id: "joao", full_name: "João Sintético", profession: null, team_name: null }], error: null });
  localStorage.setItem("metallo-colaborador-laboratorio", "token-sintetico");
  render(<ColaboradorApp screen="inicio" anonKey="anon-local" />);
  await screen.findByText("Olá, João");
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login"));
  expect(localStorage.getItem("metallo-colaborador-laboratorio")).toBeNull();
});

it("prévia visual mostra somente João sintético sem consultar Auth ou RPC", async () => {
  render(<ColaboradorApp screen="inicio" anonKey="visual-only" demo />);
  expect(await screen.findByText("Olá, João")).toBeInTheDocument();
  expect(screen.getByText("AMBIENTE DE TESTE · PRÉVIA VISUAL")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("link", { name: "Meu perfil" }));
  expect(await screen.findByRole("heading", { name: "Meu Perfil", level: 1 })).toBeInTheDocument();
  expect(await screen.findByText("Sem equipe atribuída")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "Navegação principal" })).getByRole("link", { name: "Minha obra" }));
  expect(await screen.findByText("Nenhuma obra atribuída no momento.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(await screen.findByText("Prévia visual")).toBeInTheDocument();
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
