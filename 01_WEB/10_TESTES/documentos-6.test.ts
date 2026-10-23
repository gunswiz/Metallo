import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Marcos 6A (contracheque no app) e 6B (atestado pelo app).
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/oficial-4f", () => ({ oficialLiberado4f: () => true }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { decidirAtestado6b, removerContracheque6a } from "@/app/actions/arquivos-6";
import { atestadoApp6b, contrachequeApp6a, MENSAGEM_ENVIO_6 } from "@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6";

const form = (f: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(f)) d.set(k, v); return d; };
beforeEach(() => { vi.resetAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

describe("6B — Gestão responde atestado", () => {
  it("aceitar lança no ponto e mostra quantos dias", async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null });
    await expect(decidirAtestado6b(form({ id: "5", decisao: "aceitar" }))).rejects.toThrow("redirect:/pedidos?ok=atestado-aceito&dias=3#atestados");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_decidir_atestado_6b", { p_id: 5, p_aceitar: true, p_motivo: null });
    expect(mocks.capability).toHaveBeenCalledWith("admin:manage");
  });
  it("recusar exige motivo", async () => {
    await expect(decidirAtestado6b(form({ id: "5", decisao: "recusar", motivo: "x" }))).rejects.toThrow("erro=atestado-motivo");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("mês fechado vira mensagem clara", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "mes_fechado" } });
    await expect(decidirAtestado6b(form({ id: "5", decisao: "aceitar" }))).rejects.toThrow("erro=atestado-mes-fechado");
  });
  it("retirar contracheque do app", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(removerContracheque6a(form({ id: "9", competencia: "2026-09" }))).rejects.toThrow("redirect:/contracheques?competencia=2026-09&ok=removido");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_remover_contracheque_6a", { p_id: 9 });
  });
});

describe("6A/6B — contrato do app e segurança", () => {
  it("app valida o que vem do banco", () => {
    expect(contrachequeApp6a.safeParse({ id: 1, arquivo_id: "c0000000-0000-4000-8000-000000000003", competencia: "2026-09", tipo_folha: "mensal", publicado_em: "x", visto_em: null }).success).toBe(true);
    expect(atestadoApp6b.safeParse({ id: 1, arquivo_id: "c0000000-0000-4000-8000-000000000003", data_inicio: "2026-10-08", dias: 45, status: "enviado", enviado_em: "x", decidido_em: null, motivo_recusa: null }).success).toBe(false);
    expect(MENSAGEM_ENVIO_6.tipo_arquivo).toContain("foto");
  });
  it("função: confere o tipo real pelos bytes, balde privado, permissão pelo banco como a própria pessoa", () => {
    const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/arquivos-6/index.ts", "utf8");
    expect(fn).toContain("tipoReal(bytes)");
    expect(fn).toMatch(/comoPessoa\(token\)\.rpc\("iniciar_atestado_6b"/);
    expect(fn).toMatch(/comoPessoa\(token\)\.rpc\("abrir_arquivo_6"/);
    expect(fn).toContain("createSignedUrl(a.caminho, 120");
    expect(fn).not.toMatch(/console\.(log|error)\([^)]*token/);
    const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/6a-6b-contracheque-atestado.sql", "utf8");
    expect(sql).toMatch(/values \('documentos-6', 'documentos-6', false/);
    expect(sql).toMatch(/revoke all on function private\.concluir_envio_6[^;]*service_role/);
    expect(sql).toMatch(/not \(v_admin or a\.employee_id = v_emp\)/);
    expect(sql).not.toMatch(/^\s*(drop|delete|truncate)\b/im);
  });
  it("app: chamadas novas liberadas na lista do portalFetch e envio com tempo maior", () => {
    const local = readFileSync("05_ACESSO_A_DADOS/Supabase/colaborador-local.ts", "utf8");
    for (const p of ["my_contracheques_6a", "my_atestados_6b", "cancelar_atestado_6b"]) expect(local).toContain(`"/rest/v1/rpc/${p}"`);
    expect(local).toContain("\"/functions/v1/arquivos-6\"");
    expect(local).toMatch(/arquivos-6" \|\| url\.pathname === "\/functions\/v1\/fotos-frota-10b" \? 90000 : 6000/);
  });
  it("app: a foto pode ser reduzida no celular (imagem blob: liberada só para imagem)", () => {
    expect(readFileSync("proxy.ts", "utf8")).toContain("img-src 'self' data: blob:;");
  });
  it("Gestão: envio do PDF confere a origem (contra envio de outro site)", () => {
    const rota = readFileSync("app/(02_SISTEMA)/contracheques/enviar/route.ts", "utf8");
    expect(rota).toContain('request.headers.get("origin") !== request.nextUrl.origin');
    expect(rota).toContain('can(profile, "admin:manage")');
  });
});
