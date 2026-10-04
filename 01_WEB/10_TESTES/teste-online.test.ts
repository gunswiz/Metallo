// @vitest-environment-options {"url":"https://metallo-teste-colaborador.exemplo.workers.dev"}
import { afterEach, expect, it, vi } from "vitest";
import { colaboradorEnvironment } from "@/09_CONFIGURACOES/colaborador-laboratorio";
import { recursosNovosLiberados, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { portalClient, portalFetch } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import ColaboradorPage from "@/app/colaborador/[[...screen]]/page";
const route = vi.hoisted(() => ({ host: "metallo-teste-colaborador.exemplo.workers.dev" as string | null }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: () => route.host }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, useRouter: () => ({ replace: vi.fn() }) }));
afterEach(() => { vi.unstubAllEnvs(); route.host = "metallo-teste-colaborador.exemplo.workers.dev"; });

const key = "sb_publishable_SINTETICA_teste_123";
const online = { METALLO_COLABORADOR_TESTE_ONLINE: "1", METALLO_COLABORADOR_TESTE_KEY: key };

it("teste online usa o endereço fixo do projeto de teste", () => {
  expect(colaboradorEnvironment(online)).toEqual({ demo: false, anonKey: key, online: true, baseUrl: TESTE_ONLINE_SUPABASE_URL });
});
it.each(["", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x", "sb_secret_SINTETICA_123456789", "sb_publishable_"])("teste online recusa chave %s", value => {
  expect(() => colaboradorEnvironment({ ...online, METALLO_COLABORADOR_TESTE_KEY: value })).toThrow();
});
it("teste online não combina com prévia local nem outro modo", () => {
  expect(() => colaboradorEnvironment({ ...online, METALLO_LOCAL_PREVIEW: "1" })).toThrow();
  expect(() => colaboradorEnvironment({ ...online, METALLO_COLABORADOR_PREVIEW: "1" })).toThrow();
  expect(() => colaboradorEnvironment({ ...online, METALLO_COLABORADOR_VISUAL_PREVIEW: "1" })).toThrow();
});
it("recursos novos só no laboratório e no teste online (nunca em outro projeto)", () => {
  expect(recursosNovosLiberados("http://127.0.0.1:54321")).toBe(true);
  expect(recursosNovosLiberados(TESTE_ONLINE_SUPABASE_URL)).toBe(true);
  for (const url of [undefined, "", "https://szoywhoirhdpmxrlawps.supabase.co", "https://projeto.supabase.co", TESTE_ONLINE_SUPABASE_URL + "/"])
    expect(recursosNovosLiberados(url)).toBe(false);
});
it("transporte online aceita só RPCs pessoais do projeto de teste", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
  try {
    await portalFetch(`${TESTE_ONLINE_SUPABASE_URL}/rest/v1/rpc/my_employee_profile`);
    await expect(portalFetch(`${TESTE_ONLINE_SUPABASE_URL}/auth/v1/admin/users`)).rejects.toThrow();
    await expect(portalFetch(`${TESTE_ONLINE_SUPABASE_URL}/rest/v1/epi_employees`)).rejects.toThrow();
    await expect(portalFetch("https://szoywhoirhdpmxrlawps.supabase.co/rest/v1/rpc/my_employee_profile")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally { fetcher.mockRestore(); }
});
it("cliente do portal recusa qualquer destino fora do laboratório e do teste online", () => {
  expect(() => portalClient(key, "https://szoywhoirhdpmxrlawps.supabase.co")).toThrow();
  expect(() => portalClient(key, "http://127.0.0.1:54321")).toThrow("Prévia disponível apenas no próprio computador.");
});
it("página online entrega modo online e recusa caminhos fora da lista", async () => {
  for (const [k, v] of Object.entries(online)) vi.stubEnv(k, v);
  vi.stubEnv("METALLO_COLABORADOR_PREVIEW", "0"); vi.stubEnv("METALLO_COLABORADOR_VISUAL_PREVIEW", "0"); vi.stubEnv("METALLO_LOCAL_PREVIEW", "0");
  const element = await ColaboradorPage({ params: Promise.resolve({ screen: ["epis"] }) });
  expect(element.props).toEqual({ screen: "epis", demo: false, anonKey: key, online: true, baseUrl: TESTE_ONLINE_SUPABASE_URL });
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: ["admin"] }) })).rejects.toThrow("NOT_FOUND");
  route.host = null;
  await expect(ColaboradorPage({ params: Promise.resolve({ screen: ["epis"] }) })).rejects.toThrow("NOT_FOUND");
});
it("login rápido do teste: usuário sem @ vira o e-mail de teste", async () => {
  const { loginDeTeste } = await import("@/09_CONFIGURACOES/ambiente-teste-online");
  expect(loginDeTeste(" Joao ")).toBe("joao@teste.metallo");
  expect(loginDeTeste("alguem@empresa.com")).toBe("alguem@empresa.com");
});
