import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EpiPainelOperacional } from "@/02_COMPONENTES_VISUAIS/epi-painel-operacional";
import { EpiPreparacao3d } from "@/02_COMPONENTES_VISUAIS/epi-preparacao-3d";
import type { ApprovedExchange3d } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";

vi.mock("@/app/actions/epi-completo", () => ({ prepareEpiKit3d: vi.fn() }));
vi.mock("@/02_COMPONENTES_VISUAIS/formulario-operacao", () => ({ OperationForm: ({ children }: { children: ReactNode }) => <form>{children}</form> }));
afterEach(cleanup);
const troca: ApprovedExchange3d = { request_id: "troca-1", employee_id: "pessoa-1", employee_name: "Pessoa sintética", item_id: "bota", item_name: "Bota", source_delivery_id: "entrega-1", delivery_group_id: null };
const batches = [{ id: "lote-bota", item_id: "bota", name: "Bota", unit: "par", quantity: 5, variant: "42", ca_number: "EXEMPLO" }, { id: "lote-luva", item_id: "luva", name: "Luva", unit: "par", quantity: 5, variant: "M", ca_number: "EXEMPLO" }];
it("abre a preparação com funcionário e troca e separa divergência de confirmação", () => {
  render(<EpiPainelOperacional fluxo={{ approved: [troca], prepared: [], feedback: [{ group_id: "grupo", employee_name: "Pessoa", delivered_at: "2026-10-30", feedback_status: "DIVERGENCIA", item_name: "Bota", category: "FALTA", details: null, public_message: null, internal_note: null }] }}/>);
  expect(screen.getByRole("link", { name: "Separar EPI" })).toHaveAttribute("href", "/epis/entrega-em-lote?employee=pessoa-1&exchange=troca-1");
  expect(screen.getByText("1 entrega precisa de conferência")).toBeInTheDocument();
  expect(screen.getByText("0 aguardando funcionário")).toBeInTheDocument();
});
it("não oferece preparar novamente troca com kit pendente ou entrega registrada", () => {
  render(<EpiPainelOperacional fluxo={{ approved: [troca, { ...troca, request_id: "finalizada", delivery_group_id: "grupo" }], feedback: [], prepared: [{ preparation_id: "kit", employee_id: troca.employee_id, employee_name: troca.employee_name, prepared_at: "2026-10-30", lines: [], exchange_request_id: troca.request_id, delivery_group_id: null }] }}/>);
  expect(screen.queryByRole("link", { name: "Separar EPI" })).not.toBeInTheDocument();
  expect(screen.getByText("1 kit separado")).toBeInTheDocument();
});
it("aceita pré-seleção apenas para troca aprovada do escopo fornecido", () => {
  const props = { employeeId: "pessoa-1", employeeName: "Pessoa", batches, suggestion: [], approved: [troca], keyId: "chave" };
  const first = render(<EpiPreparacao3d {...props} initialExchangeId="troca-fora-do-escopo"/>);
  expect(screen.getByLabelText(/Solicitação de troca aprovada/)).toHaveValue("");
  first.unmount();
  render(<EpiPreparacao3d {...props} initialExchangeId="troca-1"/>);
  expect(screen.getByLabelText(/Solicitação de troca aprovada/)).toHaveValue("troca-1");
  expect(screen.queryByRole("option", { name: /Luva/ })).not.toBeInTheDocument();
});
it("trocar solicitação limpa lote anterior e impede incluir EPI incompatível", () => {
  render(<EpiPreparacao3d employeeId="pessoa-1" employeeName="Pessoa" batches={batches} suggestion={[]} approved={[troca]} keyId="chave"/>);
  fireEvent.change(screen.getByLabelText("Lote para preparar"), { target: { value: "lote-luva" } });
  fireEvent.change(screen.getByLabelText(/Solicitação de troca aprovada/), { target: { value: "troca-1" } });
  expect(screen.getByLabelText("Lote para preparar")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
  expect(screen.getByText("Nenhum item adicionado.")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Confira o lote");
});
