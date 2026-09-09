import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions/epi-completo", () => ({ deliverEpiBatch: vi.fn(), requestEpi: vi.fn(), saveEmployeeKit: vi.fn() }));
import { BatchDeliveryForm } from "@/02_COMPONENTES_VISUAIS/entrega-lote-form";
import { RequestEpiForm } from "@/02_COMPONENTES_VISUAIS/solicitar-epi-form";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
afterEach(cleanup);
describe("formulários de operação", () => {
  it("adiciona e remove lotes, impedindo estoque excessivo e duplicação", () => {
    const { container } = render(<BatchDeliveryForm employees={[{ id: "employee", full_name: "Pessoa" }]} batches={[{ id: "batch", item_id: "item", name: "Luva", quantity: 2, variant: "G", lot_number: "L1", unit: "par" }]} />);
    const select = screen.getByLabelText("Lote a adicionar");
    const amount = screen.getByLabelText("Quantidade a adicionar");
    const add = screen.getByRole("button", { name: "Adicionar à entrega" });
    fireEvent.change(select, { target: { value: "batch" } });
    fireEvent.change(amount, { target: { value: "3" } }); fireEvent.click(add);
    expect(screen.getByRole("alert")).toHaveTextContent("quantidade disponível");
    fireEvent.change(amount, { target: { value: "2" } }); fireEvent.click(add);
    expect(JSON.parse((container.querySelector('[name="lines"]') as HTMLInputElement).value)).toEqual([{ stock_batch_id: "batch", item_id: "item", quantity: 2 }]);
    fireEvent.change(select, { target: { value: "batch" } }); fireEvent.click(add);
    expect(screen.getByRole("alert")).toHaveTextContent("já está na lista");
    fireEvent.click(screen.getByRole("button", { name: "Remover Luva" }));
    expect((container.querySelector('[name="lines"]') as HTMLInputElement).value).toBe("[]");
  });
  it("oferece variantes obrigatórias mesmo sem catálogo auxiliar", () => {
    render(<RequestEpiForm items={[{ id: "boot", name: "Bota", system_key: "EPI-BOT", code: "RENOMEADO", epi_item_variants: [] }, { id: "glasses", name: "Óculos", system_key: "EPI-OCU", code: "OC", epi_item_variants: [] }]} employees={[{ id: "employee", full_name: "Pessoa", shoe_size: "42" }]} initialEmployee="employee" initialItem="boot" />);
    expect(screen.getByLabelText("Tamanho / variante")).toHaveValue("42");
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: "glasses" } });
    expect(screen.getByRole("option", { name: "Claro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tamanho / variante")).toBeRequired();
    expect(screen.getByLabelText("Quantidade")).toHaveAttribute("max", "100");
  });
  it("bloqueia reenvio durante a gravação e apresenta falha", async () => {
    let finish!: (state: { error: string }) => void;
    const action = vi.fn(() => new Promise<{ error: string }>((resolve) => { finish = resolve; }));
    const { container } = render(<OperationForm action={action} label="Salvar"><label>Nome<input name="name" defaultValue="Inicial" /></label></OperationForm>);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alterado" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByLabelText("Nome")).toBeDisabled());
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    await act(async () => finish({ error: "Estoque insuficiente" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Estoque insuficiente");
    expect(screen.getByLabelText("Nome")).toBeEnabled();
    expect(screen.getByLabelText("Nome")).toHaveValue("Alterado");
    expect(action).toHaveBeenCalledTimes(1);
  });
});
