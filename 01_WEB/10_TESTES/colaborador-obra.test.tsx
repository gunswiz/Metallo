// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ColaboradorApp from "@/app/colaborador/[[...screen]]/colaborador-app";
import { personalWork, portalFetch, PORTAL_STORAGE_KEY } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => {
  const router = { replace: mocks.replace };
  return { useRouter: () => router };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: { getUser: mocks.getUser, signOut: mocks.signOut, dispose: () => Promise.resolve(),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  rpc: mocks.rpc,
}) }));

const joaoProfile = { employee_id: "00000000-0000-4000-8000-000000000001", full_name: "João Sintético", profession: null, team_name: null };
const mariaProfile = { ...joaoProfile, employee_id: "00000000-0000-4000-8000-000000000002", full_name: "Maria Sintética" };
const joaoWork = { work_id: "10000000-0000-4000-8000-000000000001", work_name: "Obra Sintética 1C João" };
const mariaWork = { work_id: "10000000-0000-4000-8000-000000000002", work_name: "Obra Sintética 1C Maria" };

beforeEach(() => {
  localStorage.clear(); mocks.replace.mockReset(); mocks.getUser.mockReset(); mocks.rpc.mockReset(); mocks.signOut.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "joao" } }, error: null });
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === "my_employee_profile" ? [joaoProfile] : [joaoWork], error: null }));
  mocks.signOut.mockResolvedValue({ error: null });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
afterEach(() => { cleanup(); localStorage.clear(); });

it("aceita somente zero ou uma obra com work_id e work_name", () => {
  expect(personalWork([])).toBeNull();
  expect(personalWork([joaoWork])).toEqual(joaoWork);
  expect(() => personalWork([joaoWork, mariaWork])).toThrow();
  expect(() => personalWork([{ ...joaoWork, aso_expiry_date: "2030-01-01" }])).toThrow();
  expect(() => personalWork([{ ...joaoWork, cpf: "SINTETICO" }])).toThrow();
  expect(() => personalWork([{ ...joaoWork, work_id: "id-estranho" }])).toThrow();
});

it("allowlist aceita somente a RPC pessoal local sem parâmetros de identidade", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  try {
    await portalFetch("http://127.0.0.1:54321/rest/v1/rpc/my_current_work", { method: "POST", body: "{}" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(portalFetch("http://127.0.0.1:54321/rest/v1/worksites")).rejects.toThrow();
    await expect(portalFetch("https://projeto.supabase.co/rest/v1/rpc/my_current_work")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { fetcher.mockRestore(); }
});

it("mostra somente a obra do titular após perfil pessoal, sem APIs de Gestão", async () => {
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Obras" })).toBeInTheDocument();
  expect(screen.getByText("OBRA ATUAL")).toBeInTheDocument();
  expect(screen.getByText("AMBIENTE DE TESTE")).toBeInTheDocument();
  expect(screen.queryByText(mariaWork.work_name)).not.toBeInTheDocument();
  expect(screen.queryByText(/ASO|CPF|CNPJ|estoque/i)).not.toBeInTheDocument();
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toContain("my_current_work");
  expect(mocks.rpc.mock.calls.every(([name, args]) => ["my_employee_profile", "my_current_work"].includes(name) && args === undefined)).toBe(true);
});

it("mantém loading sem obra antiga e informa ausência sem encerrar sessão", async () => {
  let finish!: (value: unknown) => void;
  mocks.rpc.mockImplementation((name: string) => name === "my_employee_profile"
    ? Promise.resolve({ data: [joaoProfile], error: null })
    : new Promise(resolve => { finish = resolve; }));
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText("Consultando sua obra no laboratório…")).toBeInTheDocument();
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  await act(async () => { finish({ data: [], error: null }); });
  expect(await screen.findByText("Nenhuma obra atribuída no momento.")).toBeInTheDocument();
  expect(screen.getByText("Seu acesso pessoal continua disponível.")).toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it("erro de laboratório não usa resultado anterior e permite tentar novamente", async () => {
  let failed=false;
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "my_employee_profile") return Promise.resolve({ data: [joaoProfile], error: null });
    if (!failed) { failed=true; return Promise.resolve({ data: null, error: new Error("Failed to fetch") }); }
    return Promise.resolve({ data: [joaoWork], error: null });
  });
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao laboratório");
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
});

it("troca de conta entre abas remove a obra de João antes da resposta de Maria", async () => {
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  const pending: Array<(value: unknown) => void> = [];
  mocks.getUser.mockResolvedValue({ data: { user: { id: "maria" } }, error: null });
  mocks.rpc.mockImplementation((name: string) => name === "my_employee_profile"
    ? Promise.resolve({ data: [mariaProfile], error: null })
    : new Promise(resolve => { pending.push(resolve); }));
  fireEvent(window, new StorageEvent("storage", { key: PORTAL_STORAGE_KEY, oldValue: "joao", newValue: "maria" }));
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
  await waitFor(() => expect(pending.length).toBeGreaterThan(0));
  await act(async () => { for (const finish of pending) finish({ data: [mariaWork], error: null }); });
  expect(await screen.findByText(mariaWork.work_name)).toBeInTheDocument();
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
});

it("logout pendente remove a obra e foco não reabre consulta", async () => {
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  let finish!: (value: unknown) => void;
  mocks.signOut.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const prior=mocks.rpc.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
  fireEvent.focus(window);
  expect(mocks.rpc).toHaveBeenCalledTimes(prior);
  await act(async () => { finish({ error: null }); });
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login"));
});

it("perfil revogado ou funcionário inativo tira obra junto da sessão", async () => {
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  fireEvent.focus(window);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/colaborador/login"));
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
});

it("nova montagem exige nova leitura pessoal antes de exibir obra", async () => {
  const first=render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  first.unmount();
  mocks.rpc.mockClear();
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByText(joaoWork.work_name)).toBeInTheDocument();
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toContain("my_current_work");
  expect(mocks.rpc.mock.calls.every(([name]) => ["my_employee_profile", "my_current_work"].includes(name))).toBe(true);
});

it("laboratório offline mantém tela de login acessível e não exibe obra antiga", async () => {
  mocks.getUser.mockRejectedValue(new Error("Failed to fetch"));
  render(<ColaboradorApp screen="obra" anonKey="anon-local" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao laboratório");
  expect(screen.getByText("Entrar no Colaborador")).toBeInTheDocument();
  expect(mocks.replace).not.toHaveBeenCalledWith("/colaborador/login");
  expect(screen.queryByText(joaoWork.work_name)).not.toBeInTheDocument();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("Login sem sessão avisa imediatamente quando o laboratório local está desligado", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Failed to fetch"));
  try {
    render(<ColaboradorApp screen="login" anonKey="anon-local" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao laboratório");
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:54321/auth/v1/health", expect.objectContaining({ cache: "no-store", redirect: "error" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  } finally { fetcher.mockRestore(); }
});
