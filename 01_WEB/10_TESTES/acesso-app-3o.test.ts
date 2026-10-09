import { beforeEach, expect, it, vi } from "vitest";
import { sugerirSenha3o, sugerirUsuario3o, listaAcesso3o } from "@/03_FUNCOES_E_LOGICA/Acesso/acesso-app-3o";

// Marco 3O: tela "Acesso ao app" — sugestões e ação segura (sempre pela função com o login do administrador).
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), capability: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ functions: { invoke: mocks.invoke } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { alterarAcessoApp } from "@/app/actions/acesso-app";

const emp = "c0000000-0000-4000-8000-000000000003";
const form = (fields: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(fields)) d.set(k, v); return d; };
beforeEach(() => { vi.resetAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

it("sugere usuário simples a partir do nome, sem acento nem 'da/de'", () => {
  expect(sugerirUsuario3o("João Teste da Silva")).toBe("joao.silva");
  expect(sugerirUsuario3o("Conceição")).toBe("conceicao");
  expect(sugerirUsuario3o("  ")).toBe("");
});

it("senha sugerida tem 8 números e não repete o mesmo dígito 3 vezes seguidas", () => {
  let n = 0; const sempre7 = () => (n++ < 5 ? 7 : n % 10);
  const senha = sugerirSenha3o(sempre7);
  expect(senha).toMatch(/^\d{8}$/);
  expect(senha).not.toMatch(/(\d)\1\1/);
});

it("criar acesso exige administrador e chama a função segura com os dados do formulário", async () => {
  mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  await expect(alterarAcessoApp(form({ acao: "criar", employee_id: emp, usuario: "Ana.Rocha", senha: "48151623" }))).rejects.toThrow(`redirect:/acesso-app?ok=criar&f=${emp}`);
  expect(mocks.capability).toHaveBeenCalledWith("admin:manage");
  expect(mocks.invoke).toHaveBeenCalledWith("acesso-funcionario", { body: { acao: "criar", employee_id: emp, usuario: "ana.rocha", senha: "48151623" } });
});

it("erro da função volta com o código para mostrar a mensagem certa", async () => {
  const context = new Response(JSON.stringify({ ok: false, error: "usuario_em_uso" }), { status: 400 });
  mocks.invoke.mockResolvedValue({ data: null, error: { message: "x", context } });
  await expect(alterarAcessoApp(form({ acao: "criar", employee_id: emp, usuario: "joao", senha: "48151623" }))).rejects.toThrow(`redirect:/acesso-app?erro=usuario_em_uso&f=${emp}`);
});

it("bloquear só aceita motivos conhecidos", async () => {
  await expect(alterarAcessoApp(form({ acao: "bloquear", employee_id: emp, motivo: "porque sim" }))).rejects.toThrow("redirect:/acesso-app?erro=falha");
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("lista da função é validada antes de mostrar", () => {
  expect(listaAcesso3o.safeParse({ ok: true, funcionarios: [{ employee_id: emp, nome: "Ana", matricula: "T-1", equipe: null, situacao: "ativo", usuario: "ana", criado_em: null, ultimo_acesso: null }] }).success).toBe(true);
  expect(listaAcesso3o.safeParse({ ok: true, funcionarios: [{ employee_id: "x", nome: "Ana" }] }).success).toBe(false);
});
