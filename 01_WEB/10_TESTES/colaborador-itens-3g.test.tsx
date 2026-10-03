// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeusItens, MeusItensAtalho } from "@/app/colaborador/[[...screen]]/meus-itens";
import { personalItem3g, type PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";

const id = "11111111-1111-4111-8111-111111111111";
const item = (status: PersonalItem3g["status"] = "AGUARDANDO_CONFIRMACAO"): PersonalItem3g => ({
  delivery_id: id, item_name: "Trena sintética 5 m", quantity: 1, unit: "un", variant: "5 m",
  delivered_at: "2026-09-29T12:00:00+00:00", confirmed_at: status === "AGUARDANDO_CONFIRMACAO" ? null : "2026-09-29T13:00:00+00:00",
  status, events: [],
});
afterEach(cleanup);

it("atalho do Início resume só itens atuais, destaca pendência e abre Meus Itens", async () => {
  const read = vi.fn().mockResolvedValue([
    item(),
    { ...item("EM_USO"), delivery_id: "22222222-2222-4222-8222-222222222222" },
    { ...item("DEVOLVIDO"), delivery_id: "33333333-3333-4333-8333-333333333333" },
  ]);
  render(<MeusItensAtalho read={read} demo={false} onOpen={vi.fn()}/>);
  const link = screen.getByRole("link", { name: /Meus Itens Pessoais/ });
  expect(link).toHaveAttribute("href", "/colaborador/itens");
  expect(await screen.findByText("2 itens atuais")).toBeInTheDocument();
  expect(screen.getByText("1 entrega aguardando confirmação")).toBeInTheDocument();
  expect(screen.getByText("Ver itens")).toBeInTheDocument();
});

it("atalho remove a pendência após confirmação e oculta contagem antiga durante nova leitura", async () => {
  let confirmed = false;
  const read = vi.fn(async () => [item(confirmed ? "EM_USO" : "AGUARDANDO_CONFIRMACAO")]);
  render(<MeusItensAtalho read={read} demo={false} onOpen={vi.fn()}/>);
  expect(await screen.findByText("1 entrega aguardando confirmação")).toBeInTheDocument();
  confirmed = true;
  fireEvent.focus(window);
  expect(screen.queryByText("1 entrega aguardando confirmação")).not.toBeInTheDocument();
  expect(await screen.findByText("1 item atual")).toBeInTheDocument();
  expect(screen.queryByText(/entrega aguardando confirmação/)).not.toBeInTheDocument();
});

it("atalho de prévia mantém navegação interna sem depender de URL externa", async () => {
  const onOpen = vi.fn();
  render(<MeusItensAtalho read={async () => []} demo onOpen={onOpen}/>);
  fireEvent.click(await screen.findByRole("link", { name: /Meus Itens Pessoais/ }));
  expect(onOpen).toHaveBeenCalledOnce();
});

it("contrato aceita offset do PostgreSQL e rejeita dado administrativo extra", () => {
  expect(personalItem3g.parse(item()).item_name).toContain("Trena");
  expect(personalItem3g.strict().safeParse({ ...item(), employee_id: "maria" }).success).toBe(false);
  expect(personalItem3g.safeParse({ ...item(), status: "EPI" }).success).toBe(false);
});
it("separa entrega pendente, confirmação e histórico", async () => {
  const read = vi.fn().mockResolvedValue([item(), { ...item("DEVOLVIDO"), delivery_id: "22222222-2222-4222-8222-222222222222" }]);
  render(<MeusItens read={read} actions={{ confirm: vi.fn().mockResolvedValue(1) }} />);
  expect(await screen.findByRole("heading", { name: "Atuais" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Histórico" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirmar recebimento" })).toBeInTheDocument();
  expect(screen.getByText("SIMULAÇÃO SEM VALOR OFICIAL.", { exact: false })).toBeInTheDocument();
});
it("duplo clique na confirmação envia uma operação; repetir usa a mesma chave até sucesso", async () => {
  let finish!: (value: number) => void;
  const confirm = vi.fn().mockImplementation(() => new Promise<number>(resolve => { finish = resolve; }));
  render(<MeusItens read={async () => [item()]} actions={{ confirm }} />);
  const button = await screen.findByRole("button", { name: "Confirmar recebimento" });
  fireEvent.click(button); fireEvent.click(button);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toBe(id);
  finish(1);
  await waitFor(() => expect(button).not.toBeDisabled());
});
it("problema e troca são solicitações, sem remover item da lista", async () => {
  const report = vi.fn().mockResolvedValue(3);
  render(<MeusItens read={async () => [item("EM_USO")]} actions={{ report }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Informar problema" }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "DAMAGED" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(report).toHaveBeenCalledWith(id, "PROBLEM", "DAMAGED", "", expect.any(String)));
  expect(screen.getByRole("heading", { name: "Trena sintética 5 m" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar troca" }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "WEAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(report).toHaveBeenCalledWith(id, "EXCHANGE_REQUESTED", "WEAR", "", expect.any(String)));
});
it("sem conexão esconde itens anteriores e oferece nova tentativa", async () => {
  let fail = false;
  const read = vi.fn(async () => { if (fail) throw new Error("Failed to fetch"); return [item()]; });
  render(<MeusItens read={read} />);
  expect(await screen.findByText("Trena sintética 5 m")).toBeInTheDocument();
  fail = true; fireEvent.focus(window);
  expect(screen.queryByText("Trena sintética 5 m")).not.toBeInTheDocument();
  expect(await screen.findByText("Não foi possível consultar agora.")).toBeInTheDocument();
});
