// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PersonalItemDeliveryFields3g } from "@/02_COMPONENTES_VISUAIS/entrega-item-pessoal-3g";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import EmployeePersonalItemsPage from "@/app/(02_SISTEMA)/funcionarios/[id]/itens/page";

vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({
  requireCapability: async () => undefined, requireProfile: async () => ({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role: "admin" }),
}));
vi.mock("@/04_SERVICOS/metallo-service", () => ({ getMetalloService: async () => ({
  getEmployee: async () => ({ employee: { full_name: "João Sintético" } }),
}) }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g", () => ({
  readAdminPersonalItems3g: async () => [{
    delivery_id: "11111111-1111-4111-8111-111111111111", item_id: "22222222-2222-4222-8222-222222222222",
    item_name: "Trena 5 m", quantity: 1, unit: "un", variant: null,
    delivered_at: "2026-09-30T12:00:00+00:00", confirmed_at: null, status: "AGUARDANDO_CONFIRMACAO",
    stock_origin: "WITHOUT_STOCK", exception_reason: "UNTRACKED_LEGACY_STOCK",
    exception_acknowledged_at: "2026-09-30T12:00:00+00:00", internal_note: "Teste sintético", requests: [],
    return_destination: null,
  }],
  readPersonalItemCatalog3g: async () => [], readPersonalItemStock3g: async () => [],
}));
vi.mock("@/app/actions/itens-pessoais-3g", () => ({
  deliverPersonalItem3g: async () => ({}), decidePersonalItem3g: async () => ({}),
  closePersonalItem3g: async () => ({}),
}));
vi.mock("@metallo/core", async importOriginal => ({ ...await importOriginal<typeof import("@metallo/core")>(),
  can: () => false }));

const catalog = [{ id: "11111111-1111-4111-8111-111111111111", name: "Trena 5 m", code: "LAB-TR", unit: "un" }];
const batches = [{ id: "22222222-2222-4222-8222-222222222222", item_id: catalog[0].id,
  quantity: 10, variant: null, lot_number: "SINTETICO", worksite_id: null }];
afterEach(cleanup);

it("reenvio preserva a chave entre montagens e outra entrega recebe chave nova", () => {
  localStorage.clear();
  const key = "metallo:3g:delivery:gestor:funcionario";
  const first = render(<OperationForm action={async () => ({})} label="Registrar entrega"
    operationKeyScope={key} initialOperationKey="11111111-1111-4111-8111-111111111111"><span/></OperationForm>);
  expect(localStorage.getItem(key)).toBe("11111111-1111-4111-8111-111111111111");
  first.unmount();
  const reopened = render(<OperationForm action={async () => ({})} label="Registrar entrega"
    operationKeyScope={key} initialOperationKey="22222222-2222-4222-8222-222222222222"><span/></OperationForm>);
  const otherTab = render(<OperationForm action={async () => ({})} label="Registrar entrega"
    operationKeyScope={key} initialOperationKey="33333333-3333-4333-8333-333333333333"><span/></OperationForm>);
  expect(reopened.container.querySelector<HTMLInputElement>("[name=idempotencyKey]")?.value)
    .toBe("11111111-1111-4111-8111-111111111111");
  expect(otherTab.container.querySelector<HTMLInputElement>("[name=idempotencyKey]")?.value)
    .toBe("11111111-1111-4111-8111-111111111111");
  fireEvent.click(within(reopened.container).getByRole("button", { name: "Iniciar outra entrega" }));
  expect(localStorage.getItem(key)).not.toBe("11111111-1111-4111-8111-111111111111");
  expect(otherTab.container.querySelector<HTMLInputElement>("[name=idempotencyKey]")?.value)
    .toBe("11111111-1111-4111-8111-111111111111");
  expect(within(reopened.container).getByRole("button", { name: "Registrar entrega" })).toBeInTheDocument();
});

it("Gestão escolhe lote existente, vê saldo e informa a mesma quantidade da saída", () => {
  const { container } = render(<form><PersonalItemDeliveryFields3g catalog={catalog} batches={batches}/></form>);
  fireEvent.change(screen.getByLabelText("Item do catálogo"), { target: { value: catalog[0].id } });
  expect(screen.getByText("Escolha o lote de onde o item realmente sairá.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Lote disponível"), { target: { value: batches[0].id } });
  expect(screen.getByText("Disponível neste lote: 10 un. A saída será registrada junto com a entrega.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
  const data = new FormData(container.querySelector("form")!);
  expect(data.get("stockOrigin")).toBe("STOCK_BATCH");
  expect(data.get("stockBatchId")).toBe(batches[0].id);
  expect(data.get("quantity")).toBe("2");
  expect(screen.getByLabelText("Quantidade")).toHaveAttribute("max", "10");
});

it("a exceção sem lote só aparece ao administrador e exige motivo e confirmação", () => {
  const { container } = render(<form><PersonalItemDeliveryFields3g catalog={catalog} batches={batches} allowExceptional/></form>);
  fireEvent.change(screen.getByLabelText("Item do catálogo"), { target: { value: catalog[0].id } });
  fireEvent.change(screen.getByLabelText("Origem da entrega"), { target: { value: "WITHOUT_STOCK" } });
  expect(screen.getByText("Esta entrega não realizará baixa de lote de estoque.")).toBeInTheDocument();
  expect(screen.getByLabelText("Motivo da exceção")).toBeRequired();
  expect(screen.getByLabelText("Confirmo que esta entrega excepcional não realizará baixa de lote de estoque.")).toBeRequired();
  fireEvent.change(screen.getByLabelText("Motivo da exceção"), { target: { value: "OTHER" } });
  expect(screen.getByLabelText("Observação (obrigatória para Outro motivo)")).toBeRequired();
  const data = new FormData(container.querySelector("form")!);
  expect(data.get("stockOrigin")).toBe("WITHOUT_STOCK");
  expect(data.get("stockBatchId")).toBe("");
});

it("gestor sem privilégio excepcional só pode escolher entrega com lote", () => {
  render(<form><PersonalItemDeliveryFields3g catalog={catalog} batches={batches}/></form>);
  expect(screen.getByLabelText("Origem da entrega")).toHaveValue("STOCK_BATCH");
  expect(screen.queryByRole("option", { name: "Entrega excepcional sem vínculo com estoque" })).not.toBeInTheDocument();
});

it("card atual preserva dados e oferece encerramento em ordem de leitura", async () => {
  const view = await EmployeePersonalItemsPage({
    params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    searchParams: Promise.resolve({}),
  });
  const { container } = render(view);
  const card = container.querySelector<HTMLElement>(".personal-item-entry");
  expect(card).not.toBeNull();
  expect(card?.querySelector(".personal-item-details")).toHaveTextContent("Trena 5 m");
  expect(card?.querySelector(".personal-item-details")).toHaveTextContent("Aguardando confirmação");
  expect(card?.querySelector(".personal-item-details")).toHaveTextContent("Entrega sem vínculo com estoque");
  const form = card?.querySelector(".personal-item-close form");
  expect(form).not.toBeNull();
  expect([...form!.querySelectorAll("label")].map(label => label.firstChild?.textContent?.trim())).toEqual([
    "Ação", "Nova entrega correspondente", "Destino se devolução", "Nota opcional",
  ]);
  const button = form!.querySelector("button");
  expect(button).toHaveTextContent("Registrar encerramento");
  expect([...form!.querySelectorAll("label")].every(label =>
    Boolean(label.compareDocumentPosition(button!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
});
