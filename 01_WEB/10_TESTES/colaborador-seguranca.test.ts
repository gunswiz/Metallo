// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { colaboradorEnvironment } from "@/09_CONFIGURACOES/colaborador-laboratorio";
import { personalProfile, portalFetch } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { pointRequest } from "@/05_ACESSO_A_DADOS/Ponto/ponto-lab";
import ColaboradorPage from "@/app/colaborador/[[...screen]]/page";
const route = vi.hoisted(() => ({ host: "127.0.0.1:3101" as string | null }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => route.host }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => { vi.unstubAllEnvs(); route.host = "127.0.0.1:3101"; });

const anon = `header.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`;
const env = { METALLO_LOCAL_PREVIEW: "1", METALLO_COLABORADOR_PREVIEW: "1", METALLO_COLABORADOR_LAB_URL: "http://127.0.0.1:54321", METALLO_COLABORADOR_LAB_ANON_KEY: anon };
function pageEnvironment() { for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value); vi.stubEnv("METALLO_COLABORADOR_VISUAL_PREVIEW", "0"); }
it.each([null, "localhost:3102", "192.168.0.3:3101", "exemplo.invalid:3101"])("Server Component recusa Host %s", async host => {
  pageEnvironment(); route.host = host;
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: ["perfil"] }) })).rejects.toThrow("NOT_FOUND");
});
it("Server Component permite localhost:3101 somente na prévia local explícita do 3F", async () => {
  pageEnvironment(); route.host = "localhost:3101";
  const element = await ColaboradorPage({ params: Promise.resolve({ screen: ["perfil"] }) });
  expect(element.props).toEqual({ screen: "perfil", demo: false, anonKey: anon });
  vi.stubEnv("METALLO_LOCAL_PREVIEW", "0");
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: ["perfil"] }) })).rejects.toThrow("Prévia exclusivamente local.");
});
it.each([["00000000-0000-0000-0000-000000000001"], ["perfil", "00000000-0000-0000-0000-000000000001"]])("Server Component recusa caminho de identidade %s", async (...path) => {
  pageEnvironment();
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: path }) })).rejects.toThrow("NOT_FOUND");
});
it("Server Component sem flags não disponibiliza o portal", async () => {
  vi.stubEnv("METALLO_COLABORADOR_PREVIEW", "0"); vi.stubEnv("METALLO_COLABORADOR_VISUAL_PREVIEW", "0");
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: ["perfil"] }) })).rejects.toThrow("NOT_FOUND");
});
it("Server Component local entrega somente configuração anon e tela autorizada", async () => {
  pageEnvironment();
  const element = await ColaboradorPage({ params: Promise.resolve({ screen: ["perfil"] }) });
  expect(element.props).toEqual({ screen: "perfil", demo: false, anonKey: anon });
});
it("Server Component aceita Comunicados somente na prévia local", async () => {
  pageEnvironment();
  const element = await ColaboradorPage({ params: Promise.resolve({ screen: ["comunicados"] }) });
  expect(element.props.screen).toBe("comunicados");
});
it("sem flags permanece indisponível", () => expect(colaboradorEnvironment({})).toBeNull());
it("aceita só a configuração local explícita", () => expect(colaboradorEnvironment(env)?.demo).toBe(false));
it.each([undefined, "https://projeto.supabase.co", "http://192.168.0.3:54321", "http://localhost:54321", "http://127.0.0.1:54321/"])("aborta URL não autorizada %s", url => {
  expect(() => colaboradorEnvironment({ ...env, METALLO_COLABORADOR_LAB_URL: url })).toThrow();
});
it("rejeita chave administrativa antes de enviá-la ao cliente", () => {
  const key = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  expect(() => colaboradorEnvironment({ ...env, METALLO_COLABORADOR_LAB_ANON_KEY: key })).toThrow();
});
it("não converte configuração inválida para visual", () => expect(() => colaboradorEnvironment({ ...env, METALLO_COLABORADOR_VISUAL_PREVIEW: "1" })).toThrow());
it("modo visual não exige chave nem Auth", () => expect(colaboradorEnvironment({ METALLO_LOCAL_PREVIEW: "1", METALLO_COLABORADOR_VISUAL_PREVIEW: "1" })).toEqual({ demo: true, anonKey: "visual-only" }));
it.each(["https://projeto.supabase.co/auth/v1/user", "http://127.0.0.1:54321/rest/v1/epi_employees", "http://127.0.0.1:54321/auth/v1/admin/users"])("bloqueia destino/superfície %s antes da rede", async url => {
  const fetch = vi.spyOn(globalThis, "fetch");
  try { await expect(portalFetch(url)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled(); } finally { fetch.mockRestore(); }
});
it("permite só as duas RPCs pessoais 3H no transporte local", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  try {
    await portalFetch("http://127.0.0.1:54321/rest/v1/rpc/my_communications_3h");
    await portalFetch("http://127.0.0.1:54321/rest/v1/rpc/open_communication_3h");
    await expect(portalFetch("http://127.0.0.1:54321/rest/v1/rpc/admin_communications_3h")).rejects.toThrow();
    await expect(portalFetch("http://127.0.0.1:54321/rest/v1/communications_3h")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { fetcher.mockRestore(); }
});
it("não aceita DTO ampliado nem múltiplos titulares", () => {
  const p = { employee_id: "sintético", full_name: "João", profession: null, team_name: null };
  expect(personalProfile([p])).toEqual(p);
  expect(personalProfile([{ ...p, cpf: "SINTETICO" }])).toBeNull();
  expect(personalProfile([p, p])).toBeNull();
});
it("Meu Ponto usa só o transporte local exato e recusa URL ou tabela alheia", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"events":[]}', { status: 200, headers: { "Content-Type": "application/json" } }));
  try {
    await pointRequest("/lab-point/v1/events", "jwt-sintetico");
    expect(fetcher).toHaveBeenCalledWith("/api/ponto-lab/events", expect.objectContaining({ cache: "no-store", redirect: "error" }));
    await expect(pointRequest("/lab-point/v1/workers", "jwt-sintetico")).rejects.toThrow();
    await expect(pointRequest("https://projeto.supabase.co", "jwt-sintetico")).rejects.toThrow();
    await expect(pointRequest("/lab-point/v1/events?employee_id=maria", "jwt-sintetico")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { fetcher.mockRestore(); }
});
