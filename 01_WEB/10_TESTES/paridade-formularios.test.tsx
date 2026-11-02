import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), useRouter: () => navigation }));
vi.mock("@/app/actions/epi-completo", () => ({ deliverEpiBatch: vi.fn(), requestEpi: vi.fn(), saveEmployeeKit: vi.fn(), prepareEpiKit3d: vi.fn(async () => ({ error: "Resposta não confirmada" })) }));
import { BatchDeliveryForm } from "@/02_COMPONENTES_VISUAIS/entrega-lote-form";
import { RequestEpiForm } from "@/02_COMPONENTES_VISUAIS/solicitar-epi-form";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { EpiPreparacao3d } from "@/02_COMPONENTES_VISUAIS/epi-preparacao-3d";
import { prepareEpiKit3d } from "@/app/actions/epi-completo";
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const firstKey = "11111111-1111-4111-8111-111111111111";
const secondKey = "22222222-2222-4222-8222-222222222222";
describe("formulários de operação", () => {
  it("tratamento confirmado atualiza a lista preservando o funcionário", async () => {
    const destination = "/epis/entrega-em-lote?feedback=1&employee=funcionario#confirmacoes";
    const action = vi.fn().mockResolvedValueOnce({ error: "Sem confirmação" }).mockResolvedValue({ completedKey: firstKey });
    const view = render(<OperationForm action={action} label="Tratar" operationKeyScope="feedback" initialOperationKey={firstKey} refreshOnComplete completionHref={destination}><span/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(navigation.refresh).not.toHaveBeenCalled();
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(destination));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("feedback")).toBeNull();
  });
  it("exceção de transporte mantém formulário, dados e chave para conferência", async () => {
    const action = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const view = render(<OperationForm action={action} label="Preparar" operationKeyScope="kit" initialOperationKey={firstKey}><input aria-label="Nota" name="note" defaultValue="Conferir tamanho"/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("A tentativa foi preservada");
    expect(screen.getByLabelText("Nota")).toHaveValue("Conferir tamanho");
    expect(localStorage.getItem("kit")).toBe(firstKey);
  });
  it("chave recuperada permanece após erro e novo render do formulário", async () => {
    localStorage.setItem("kit", firstKey);
    const action = vi.fn(async () => ({ error: "Sem confirmação" }));
    const view = render(<OperationForm action={action} label="Preparar" operationKeyScope="kit" initialOperationKey={secondKey}><span/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(view.container.querySelector<HTMLInputElement>('[name="idempotencyKey"]')!.value).toBe(firstKey);
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
  });
  it("sucesso confirmado encerra a tentativa; kit seguinte recebe chave diferente", async () => {
    const action = vi.fn(async (_previous: { error?: string }, data: FormData) => ({ completedKey: String(data.get("idempotencyKey")), destination: "/epis/entrega-em-lote?prepared=1" }));
    let view = render(<OperationForm action={action} label="Preparar" operationKeyScope="kit" initialOperationKey={firstKey}><input name="lines" defaultValue="mesmo kit"/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("link", { name: "Ver registros atualizados" });
    expect(localStorage.getItem("kit")).toBeNull();
    expect(view.container.querySelector("form")).toBeNull();
    view.unmount();
    view = render(<OperationForm action={action} label="Preparar" operationKeyScope="kit" initialOperationKey={secondKey}><input name="lines" defaultValue="mesmo kit"/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("link", { name: "Ver registros atualizados" });
    expect(action.mock.calls.map(call => call[1].get("idempotencyKey"))).toEqual([firstKey, secondKey]);
  });
  it("confirmação antiga não remove uma nova tentativa de outra aba", async () => {
    let finish!: (state: { completedKey: string; destination: string }) => void;
    const action = vi.fn(() => new Promise<{ completedKey: string; destination: string }>(resolve => { finish = resolve; }));
    const view = render(<OperationForm action={action} label="Preparar" operationKeyScope="kit" initialOperationKey={firstKey}><span/></OperationForm>);
    fireEvent.submit(view.container.querySelector("form")!);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    localStorage.setItem("kit", secondKey);
    await act(async () => finish({ completedKey: firstKey, destination: "/epis" }));
    expect(localStorage.getItem("kit")).toBe(secondKey);
  });
  it("kit reutiliza tentativa após remontar e separa gestor e funcionário", async () => {
    const props = { actorId: "gestor-a", employeeId: "pessoa-a", employeeName: "Pessoa sintética", batches: [], suggestion: [], approved: [] };
    let view = render(<EpiPreparacao3d {...props} keyId={firstKey}/>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(vi.mocked(prepareEpiKit3d).mock.calls[0][1].get("idempotencyKey")).toBe(firstKey);
    view.unmount();
    view = render(<EpiPreparacao3d {...props} keyId={secondKey}/>);
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("alert");
    expect(vi.mocked(prepareEpiKit3d).mock.calls[1][1].get("idempotencyKey")).toBe(firstKey);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar outro kit" }));
    const newKey = view.container.querySelector<HTMLInputElement>('[name="idempotencyKey"]')!.value;
    expect(newKey).not.toBe(firstKey);
    view.unmount();
    view = render(<EpiPreparacao3d {...props} actorId="gestor-b" keyId={secondKey}/>);
    expect(view.container.querySelector<HTMLInputElement>('[name="idempotencyKey"]')!.value).toBe(secondKey);
    view.unmount();
    view = render(<EpiPreparacao3d {...props} employeeId="pessoa-b" keyId={secondKey}/>);
    expect(view.container.querySelector<HTMLInputElement>('[name="idempotencyKey"]')!.value).toBe(secondKey);
  });
  it("aba antiga não envia com chave abandonada por outra aba", async () => {
    const action = vi.fn(async () => ({}));
    const { container } = render(<OperationForm action={action} label="Tratar" operationKeyScope="tratamento" initialOperationKey={firstKey}><span/></OperationForm>);
    localStorage.setItem("tratamento", secondKey);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Outra aba");
    expect(action).not.toHaveBeenCalled();
    expect(localStorage.getItem("tratamento")).toBe(secondKey);
  });
  it("sem armazenamento não envia nem anuncia nova operação", () => {
    const action = vi.fn(async () => ({}));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    const { container } = render(<OperationForm action={action} label="Tratar" operationKeyScope="tratamento" initialOperationKey={firstKey}><span/></OperationForm>);
    fireEvent.submit(container.querySelector("form")!);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("armazenamento local");
  });
  it("falha ao criar nova chave mantém a tentativa anterior", () => {
    const { container } = render(<OperationForm action={async () => ({})} label="Tratar" operationKeyScope="tratamento" initialOperationKey={firstKey}><span/></OperationForm>);
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("indisponível"); });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar outra entrega" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível guardar");
    expect(container.querySelector<HTMLInputElement>('[name="idempotencyKey"]')!.value).toBe(firstKey);
  });
  it("não permite envio antes de hidratar a tentativa persistida", () => {
    const html = renderToString(<OperationForm action={async () => ({})} label="Tratar" operationKeyScope="tratamento" initialOperationKey={firstKey} newOperationLabel={null}><span/></OperationForm>);
    expect(html).toMatch(/<fieldset[^>]*disabled/);
    expect(html).not.toContain("Iniciar outra entrega");
  });
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
