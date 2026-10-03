// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
// Integração DOM + SDK/Auth/PostgREST reais. Não é o ensaio Edge-browser, registrado separadamente.
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ColaboradorApp from "@/app/colaborador/[[...screen]]/colaborador-app";
import { PORTAL_STORAGE_KEY } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const lab = resolve(process.cwd(), "../04_BANCO_E_SUPABASE/laboratorio-marco-1a");
// Importação exclusiva do executor de testes, nunca alcançada pelo bundle Next.
// Manter o executor Node fora da transformação de import.meta.url do DOM Vitest.
const fixtures = await import(/* @vite-ignore */ pathToFileURL(resolve(lab, "criar-contas-previa-1b.mjs")).href);
type Account = { id: string; email: string; password: string; name: string; employeeId: string; identityId: string; team: string };
let accounts: Record<string, Account>, adminAccessToken: string, team: string;
const network: { origin: string; path: string; status: number; cache: string | null; source: "portalFetch" | "harness" }[] = [];
const originalFetch = globalThis.fetch;
const clients: SupabaseClient[] = [];
let logoutPause: { entered: () => void; wait: Promise<void> } | null = null;
function client() { const c = createClient(fixtures.base, fixtures.anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); clients.push(c); return c; }
async function sessionFor(a: Account) {
  const c = client(); const r = await c.auth.signInWithPassword({ email: a.email, password: a.password });
  expect(r.error).toBeNull(); expect(r.data.session).toBeTruthy();
  return { c, session: r.data.session! };
}
async function show(a: Account, route = "perfil", session?: Session) {
  const s = session ?? (await sessionFor(a)).session;
  localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify(s));
  render(<ColaboradorApp screen={route} anonKey={fixtures.anon} />);
  return s;
}
beforeAll(async () => {
  ({ accounts, adminAccessToken, team } = await fixtures.createPreviewAccounts());
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const source = init?.cache === "no-store" ? "portalFetch" : "harness";
    if (url.origin !== "http://127.0.0.1:54321") throw new Error("Teste tentou destino não local");
    if (logoutPause && source === "portalFetch" && url.pathname === "/auth/v1/logout") {
      logoutPause.entered(); await logoutPause.wait;
    }
    try {
      const response = await originalFetch(input, init);
      network.push({ origin: url.origin, path: url.pathname, status: response.status, cache: init?.cache ?? null, source });
      return response;
    } catch (error) {
      network.push({ origin: url.origin, path: url.pathname, status: 0, cache: init?.cache ?? null, source });
      throw error;
    }
  };
}, 30000);
afterEach(() => { cleanup(); localStorage.clear(); navigation.replace.mockClear(); });
afterAll(async () => {
  for (const c of clients) await c.auth.dispose();
  globalThis.fetch = originalFetch;
  writeFileSync(resolve(lab, process.env.METALLO_EVIDENCE_REVISION === "1c" ? "marco-1c/rede-auth-real.json" : process.env.METALLO_EVIDENCE_REVISION === "r2" ? "saneamento-r2/rede-auth-real.json" : "auditoria-1b/rede-auth-real.json"), JSON.stringify({ at: new Date().toISOString(), note: "Somente metadados. Neste harness exclusivamente portalFetch define cache=no-store; fixtures e SDK direto não definem. Origem atribuída por essa marca observável, sem alterar headers ou transporte.", requests: network }, null, 2));
  const app = network.filter(r => r.source === "portalFetch");
  expect(app.length).toBeGreaterThan(0);
  expect(app.every(r => ["/auth/v1/token", "/auth/v1/user", "/auth/v1/logout", "/auth/v1/health", "/rest/v1/rpc/my_employee_profile", "/rest/v1/rpc/my_current_work"].includes(r.path))).toBe(true);
});

it.each(["joao", "maria"])("%s: login SDK, JWT, DTO mínimo próprio, refresh e logout reais", async key => {
  const a = accounts[key], other = accounts[key === "joao" ? "maria" : "joao"];
  const { c, session } = await sessionFor(a);
  const jwt = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  expect(jwt.sub).toBe(a.id); expect(jwt.role).toBe("authenticated"); expect(jwt.exp).toBeGreaterThan(Date.now() / 1000);
  const dto = await c.rpc("my_employee_profile");
  expect(dto.error).toBeNull(); expect(dto.data).toHaveLength(1);
  expect(Object.keys(dto.data[0]).sort()).toEqual(["employee_id", "full_name", "profession", "team_name"]);
  expect(dto.data[0].employee_id).toBe(a.employeeId); expect(dto.data[0].employee_id).not.toBe(other.employeeId);
  const cross = await c.rpc("my_employee_profile").eq("employee_id", other.employeeId);
  expect(cross.error).toBeNull(); expect(cross.data).toEqual([]);
  const refreshed = await c.auth.refreshSession(); expect(refreshed.error).toBeNull(); expect(refreshed.data.user?.id).toBe(a.id);
  const refreshToken = refreshed.data.session!.refresh_token;
  expect((await c.auth.signOut({ scope: "local" })).error).toBeNull();
  expect((await client().auth.refreshSession({ refresh_token: refreshToken })).error).not.toBeNull();
});

it.each(["joao", "maria"])("%s: UI usa Auth real e limpa memória/storage na saída", async key => {
  const a = accounts[key];
  render(<ColaboradorApp screen="login" anonKey={fixtures.anon} />);
  await screen.findByText("Entrar no Colaborador");
  await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: a.email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: a.password } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/colaborador/inicio"));
  fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
  expect(screen.getAllByText(a.name).length).toBeGreaterThan(0);
  const stored = localStorage.getItem(PORTAL_STORAGE_KEY)!;
  expect(stored).not.toContain(a.password); expect(stored).not.toMatch(/service_role|aso_exam_date|cpf/);
  expect(document.cookie).toBe(""); expect(sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
  expect(screen.queryByText(a.name)).not.toBeInTheDocument();
});

it.each(["errada", "inexistente", "revogada", "banida"])("login %s produz mensagem amigável e nenhum perfil", async kind => {
  const a = accounts[kind] ?? accounts.joao;
  render(<ColaboradorApp screen="login" anonKey={fixtures.anon} />);
  await screen.findByText("Entrar no Colaborador");
  await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: kind === "inexistente" ? "ausente-1b@example.invalid" : a.email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: kind === "errada" ? "incorreta-sintetica" : a.password } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/E-mail ou senha incorretos|não tem acesso ativo/);
  expect(screen.queryByText(/Olá,/)).not.toBeInTheDocument(); expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull();
  expect(screen.getByLabelText("Senha")).toHaveValue("");
});

it.each(["joao", "maria"])("%s: equipe ativa, inativa, ausente, removida e reatribuída preserva DTO", async key => {
  const a = accounts[key]; const { c, session } = await sessionFor(a);
  const read = async (expected: string | null) => {
    const r = await c.rpc("my_employee_profile"); expect(r.error).toBeNull(); expect(r.data).toHaveLength(1);
    expect(r.data[0].employee_id).toBe(a.employeeId); expect(r.data[0].team_name).toBe(expected);
  };
  const name = fixtures.sql(`select name from public.teams where id='${team}'`);
  await read(name);
  fixtures.sql(`update public.teams set active=false where id='${team}'`); await read(null);
  await show(a, "equipe", session); expect(await screen.findByText("Sem equipe atribuída no momento.")).toBeInTheDocument(); cleanup();
  fixtures.sql(`update public.teams set active=true where id='${team}'; update public.epi_employees set team_id=null where id='${a.employeeId}'`); await read(null);
  await show(a, "perfil", session); expect(await screen.findByText("Sem equipe atribuída")).toBeInTheDocument(); cleanup();
  const removable = fixtures.sql(`insert into public.teams(name,location_type) values('Equipe removível 1B ${a.id}','field') returning id`);
  // A FK auditada exige desvinculação explícita antes da remoção; não alterar CASCADE.
  fixtures.sql(`update public.epi_employees set team_id='${removable}' where id='${a.employeeId}'; update public.epi_employees set team_id=null where id='${a.employeeId}'; delete from public.teams where id='${removable}'`); await read(null);
  fixtures.sql(`update public.epi_employees set team_id='${team}' where id='${a.employeeId}'`); await read(name);
});

it.each(["joao", "maria"])("%s: sessão real substituída por outra aba não mistura os titulares", async key => {
  const a = accounts[key], b = accounts[key === "joao" ? "maria" : "joao"];
  const first = await sessionFor(a), second = await sessionFor(b);
  await show(a, "perfil", first.session);
  await screen.findByRole("heading", { name: "Meu Perfil" });
  expect(screen.getAllByText(a.name).length).toBeGreaterThan(0);
  const oldValue = localStorage.getItem(PORTAL_STORAGE_KEY);
  const newValue = JSON.stringify(second.session);
  localStorage.setItem(PORTAL_STORAGE_KEY, newValue);
  // Evento da outra aba simulado; as duas sessões e todas as validações são Auth reais.
  fireEvent(window, new StorageEvent("storage", { key: PORTAL_STORAGE_KEY, oldValue, newValue }));
  expect(screen.queryByText(a.name)).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText(b.name).length).toBeGreaterThan(0));
  expect(screen.queryByText(a.name)).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(PORTAL_STORAGE_KEY)!).user.id).toBe(b.id);
});

it("funcionário inativo autentica mas não recebe DTO nem tela pessoal", async () => {
  await show(accounts.inativo);
  expect(await screen.findByRole("alert")).toHaveTextContent("não tem acesso ativo");
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
});

it("revogação servidor com tela aberta limpa DTO; token antigo, refresh e novo login são negados", async () => {
  const a = accounts.joao; const { c, session } = await sessionFor(a);
  await show(a, "perfil", session); await screen.findByRole("heading", { name: "Meu Perfil" });
  await fixtures.revokePreviewAccount(a.identityId, adminAccessToken);
  await waitFor(() => expect(screen.queryByText(a.name)).not.toBeInTheDocument(), { timeout: 13000 });
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
  expect(navigation.replace).toHaveBeenCalledWith("/colaborador/login");
  const old = await originalFetch(fixtures.base + "/rest/v1/rpc/my_employee_profile", { method: "POST", headers: { apikey: fixtures.anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: "{}" });
  expect(await old.json()).toEqual([]);
  expect((await c.auth.refreshSession()).error).not.toBeNull();
  expect((await client().auth.signInWithPassword({ email: a.email, password: a.password })).error).not.toBeNull();
}, 20000);

it("ban Auth durante sessão limpa tela e storage, bloqueia refresh e login", async () => {
  const a = accounts.maria; const { c, session } = await sessionFor(a);
  await show(a, "perfil", session); await screen.findByRole("heading", { name: "Meu Perfil" });
  await fixtures.banPreviewAccount(a.id);
  await waitFor(() => expect(screen.queryByText(a.name)).not.toBeInTheDocument(), { timeout: 13000 });
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
  expect((await c.auth.refreshSession()).error).not.toBeNull();
  expect((await client().auth.signInWithPassword({ email: a.email, password: a.password })).error).not.toBeNull();
}, 20000);

it("logout pendente real não relê Auth/RPC por foco nem reapresenta dados", async () => {
  const a = accounts.expira;
  await show(a, "perfil");
  await screen.findByRole("heading", { name: "Meu Perfil" });
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>(resolve => { entered = resolve; });
  logoutPause = { entered, wait: new Promise<void>(resolve => { release = resolve; }) };
  try {
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waiting;
    const start = network.length;
    fireEvent.focus(window);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(screen.queryByText(a.name)).not.toBeInTheDocument();
    expect(network.slice(start).filter(r => r.source === "portalFetch")).toHaveLength(0);
  } finally { logoutPause = null; release(); }
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
  expect(navigation.replace).toHaveBeenCalledWith("/colaborador/login");
  expect(screen.queryByText(a.name)).not.toBeInTheDocument();
});

it("JWT expira de verdade; refresh real mantém acesso; sessão encerrada não retorna pelo cache", async () => {
  const a = accounts.expira;
  const { c, session } = await sessionFor(a);
  const issued = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  expect(issued.exp - issued.iat).toBe(60); // Exige ensaio explícito com configuração local temporária.
  // PostgREST admite 30s de diferença de relógio: aguardar além da tolerância real.
  // https://postgrest.org/en/stable/references/auth.html#time-based-claims-validation
  await new Promise(resolve => setTimeout(resolve, Math.max(0, issued.exp * 1000 - Date.now() + 32000)));
  const old = await originalFetch(fixtures.base + "/rest/v1/rpc/my_employee_profile", { method: "POST", headers: { apikey: fixtures.anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: "{}" });
  expect(old.status).toBe(401);
  await show(a, "perfil", session);
  expect(await screen.findByRole("heading", { name: "Meu Perfil" })).toBeInTheDocument();
  const renewed = JSON.parse(localStorage.getItem(PORTAL_STORAGE_KEY)!);
  expect(renewed.expires_at).toBeGreaterThan(issued.exp);
  expect(renewed.user.id).toBe(a.id);
  const oldRefresh = renewed.refresh_token;
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
  expect((await c.auth.refreshSession({ refresh_token: oldRefresh })).error).not.toBeNull();
  cleanup();
  await show(a, "perfil", session);
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/colaborador/login"));
  expect(screen.queryByText(a.name)).not.toBeInTheDocument();
  await waitFor(() => expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull());
}, 110000);

it("laboratório realmente parado: login abre, erro amigável e nenhuma requisição remota", async () => {
  execFileSync(process.execPath, [resolve(lab, "../../node_modules/supabase/dist/supabase.js"), "stop", "--workdir", lab, "--project-id", "laboratorio-marco-1a"], { stdio: "pipe", timeout: 45000 });
  const start = network.length;
  render(<ColaboradorApp screen="login" anonKey={fixtures.anon} />);
  await screen.findByText("Entrar no Colaborador");
  await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: accounts.expira.email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: accounts.expira.password } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert", {}, { timeout: 15000 })).toHaveTextContent("Não foi possível conectar ao servidor");
  expect(screen.queryByText(/Olá,/)).not.toBeInTheDocument();
  expect(localStorage.getItem(PORTAL_STORAGE_KEY)).toBeNull();
  const attempts = network.slice(start);
  expect(attempts.length).toBeGreaterThan(0);
  expect(attempts.every(r => r.origin === "http://127.0.0.1:54321" && r.status === 0 && r.cache === "no-store")).toBe(true);
}, 60000);
