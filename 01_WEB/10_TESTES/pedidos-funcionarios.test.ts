import { beforeEach, expect, it, vi } from "vitest";

// Marco 3J: a caixa "Pedidos dos funcionários" junta trocas de EPI, problemas na entrega e itens pessoais.
const repo = vi.hoisted(() => ({ exchangeRequests: vi.fn(), delivery3d: vi.fn() }));
const items = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository", () => ({ getEpiOperations: async () => repo }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g", () => ({ readAdminPersonalItems3g: items.read }));
import { lerPedidosFuncionarios } from "@/05_ACESSO_A_DADOS/Repositorios/pedidos-funcionarios";

const troca = (id: string, request_status: string) => ({ request_id: id, employee_name: "João", item_name: "Capacete", ca_number: null, reason: "DESGASTE",
  note: null, request_status, requested_at: "2026-10-04T10:00:00Z", updated_at: "2026-10-04T10:00:00Z", public_decision: null, internal_note: null, timeline: [] });
const entrega = (group_id: string, feedback_status: string | null) => ({ group_id, employee_name: "Maria", delivered_at: "2026-10-04T10:00:00Z", feedback_status,
  item_name: null, category: null, details: null, public_message: null, internal_note: null });
beforeEach(() => {
  repo.exchangeRequests.mockResolvedValue([troca("a", "SOLICITADA"), troca("b", "EM_ANALISE"), troca("c", "APROVADA"), troca("d", "RECUSADA"), troca("e", "CANCELADA")]);
  repo.delivery3d.mockResolvedValue({ prepared: [], approved: [{ request_id: "c", employee_id: "emp", employee_name: "João", item_id: "i", item_name: "Capacete", source_delivery_id: "s", delivery_group_id: null }],
    feedback: [entrega("g1", "DIVERGENCIA"), entrega("g2", "EM_ANALISE"), entrega("g3", "CONFIRMADO"), entrega("g4", null), entrega("g5", "RECUSA")] });
  items.read.mockResolvedValue([{ employee_id: "emp", employee_name: "Pedro", item_name: "Trena", requests: [
    { request_id: 1, action: "EXCHANGE_REQUESTED", reason: "WEAR", note: null, requested_at: "2026-10-04T10:00:00Z", decision: null, decision_at: null },
    { request_id: 2, action: "PROBLEM", reason: "DAMAGED", note: null, requested_at: "2026-10-04T10:00:00Z", decision: "EXCHANGE_REFUSED", decision_at: "2026-10-04T11:00:00Z" }] }]);
});

it("mostra só o que está em aberto e conta o que espera resposta da Gestão", async () => {
  const result = await lerPedidosFuncionarios();
  expect(result.trocas.map(row => row.request_id)).toEqual(["a", "b", "c"]);
  expect(result.aprovadas.get("c")?.employee_id).toBe("emp");
  expect(result.problemas.map(row => row.group_id)).toEqual(["g1", "g2"]);
  expect(result.semConfirmar.map(row => row.group_id)).toEqual(["g4", "g5"]);
  expect(result.itens?.map(entry => entry.request.request_id)).toEqual([1]);
  // a, b (troca sem decisão) + g1, g2 (problemas) + 1 item pessoal. A troca aprovada espera a entrega, não a decisão.
  expect(result.aguardando).toBe(5);
});

it("falha na consulta de itens pessoais não esconde trocas e problemas de EPI", async () => {
  items.read.mockRejectedValue(new Error("indisponível"));
  const result = await lerPedidosFuncionarios();
  expect(result.itens).toBeNull();
  expect(result.trocas).toHaveLength(3);
  expect(result.aguardando).toBe(4);
});
