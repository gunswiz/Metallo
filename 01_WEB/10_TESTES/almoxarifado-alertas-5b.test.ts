import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// Marcos 5B (pedido atendido baixa o estoque), 5C (estoque baixo) e 5D (vencimentos) — bloco 1 do almoxarifado.
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { decidirPedidoMaterial3t } from "@/app/actions/pedido-material";
import { salvarValidadeCa5d } from "@/app/actions/alertas-5c";

const form = (f: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(f)) d.set(k, v); return d; };
beforeEach(() => { vi.resetAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });

describe("5B — atender pedido dando baixa no estoque", () => {
  it("atendido com baixa chama a função nova com p_baixar e confirma a baixa", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(decidirPedidoMaterial3t(form({ pedidoId: "7", status: "atendido", resposta: "", baixar: "1" }))).rejects.toThrow("redirect:/pedidos?ok=baixa#pedidos-material");
    expect(mocks.rpc).toHaveBeenCalledWith("decide_pedido_material_5b", { p_id: 7, p_status: "atendido", p_resposta: "", p_baixar: true });
    expect(mocks.capability).toHaveBeenCalledWith("epi:write");
  });
  it("recusar nunca baixa estoque, mesmo com a caixa marcada", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(decidirPedidoMaterial3t(form({ pedidoId: "7", status: "recusado", resposta: "Sem uso", baixar: "1" }))).rejects.toThrow("redirect:/pedidos?ok=1#pedidos-material");
    expect(mocks.rpc).toHaveBeenCalledWith("decide_pedido_material_5b", expect.objectContaining({ p_baixar: false }));
  });
  it.each([["insufficient_stock", "material-sem-saldo"], ["funcionario_sem_equipe", "material-sem-equipe"], ["forbidden_team", "material-sem-permissao"],
    ["quantidade_fracionada", "material-fracao"], ["outra coisa", "material"]])("erro %s vira mensagem simples (%s)", async (erro, codigo) => {
    mocks.rpc.mockResolvedValue({ error: { message: erro } });
    await expect(decidirPedidoMaterial3t(form({ pedidoId: "7", status: "atendido", resposta: "", baixar: "1" }))).rejects.toThrow(`redirect:/pedidos?erro=${codigo}#pedidos-material`);
  });
  it("SQL: baixa pela mesma regra do consumo e tudo-ou-nada", () => {
    const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/5b-pedido-baixa-estoque.sql", "utf8");
    expect(sql).toContain("perform public.consume_material(v.item_id, v_team, v.quantidade");
    expect(sql).toMatch(/consume_material[\s\S]{0,400}perform public\.decide_pedido_material_3t/);
    expect(sql).toContain("for update");
  });
});

describe("5C/5D — alertas da Gestão", () => {
  it("validade do CA: data válida salva; data estranha é recusada antes do banco", async () => {
    const id = "c0000000-0000-4000-8000-000000000003";
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(salvarValidadeCa5d(form({ itemId: id, validade: "2027-03-31" }))).rejects.toThrow(`redirect:/epis/${id}?updated=ca`);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_ca_validade_5d", { p_item_id: id, p_validade: "2027-03-31" });
    mocks.rpc.mockClear();
    await expect(salvarValidadeCa5d(form({ itemId: id, validade: "31/03/2027" }))).rejects.toThrow(`redirect:/epis/${id}?error=ca`);
  });
  it("SQL: só avisa o que é novo, resumo na segunda, só administrador e engenheiro", () => {
    const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/5c-alertas-gestao.sql", "utf8");
    expect(sql).toContain("interval '7 days'");
    expect(sql).toContain("p.role in ('admin', 'engineer')");
    expect(sql).toContain("'5 10 * * 1-5'");
    for (const g of ["'REPOR'", "'ASO'", "'TREINAMENTO'", "'CA'", "'LOTE'"]) expect(sql).toContain(g);
    const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/lembrete-consumo/index.ts", "utf8");
    expect(fn).toContain(`body.acao === "alertas"`); expect(fn).toContain(`weekday: "short"`); expect(fn).toContain("destinos_alertas_5c");
  });
});
