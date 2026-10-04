// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PedidosTroca, PedirTroca } from "@/app/colaborador/[[...screen]]/epi-troca";
import { MeusEpis } from "@/app/colaborador/[[...screen]]/meus-epis";
import { exchangeableEpis, exchangeRequests, portalFetch, type ExchangeRequest, type PersonalEpi } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

// Marco 3J: pedir troca abre uma tela cheia no lugar, com motivos em botões grandes.
const deliveryId = "4a055742-1d17-4a0f-984b-a19b46d3438d";
const requestId = "6956b958-bf65-4ab3-8852-93bdcc0fce4b";
const item = { delivery_id: deliveryId, item_name: "Capacete sintético" };
const eligible = [{ delivery_id: deliveryId, item_name: "Capacete sintético", ca_number: "12345", variant: "M", recorded_at: "2026-09-28T12:00:00Z" }];
const request: ExchangeRequest = { request_id: requestId, source_delivery_id: deliveryId, item_name: "Capacete sintético", ca_number: "12345", reason: "DESGASTE", note: null,
  request_status: "SOLICITADA", requested_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z", public_decision: null,
  timeline: [{ status: "SOLICITADA", at: "2026-09-28T12:00:00Z", message: null }] };
const epis: PersonalEpi[] = [
  { item_name: "Capacete sintético", ca_number: "12345", quantity: 1, unit: "un", variant: "M", delivered_at: "2026-09-28T12:00:00.000Z", delivery_reason: "initial", current_status: "active", closed_at: null },
  { item_name: "Óculos sem par", ca_number: null, quantity: 1, unit: "un", variant: null, delivered_at: "2026-09-20T12:00:00Z", delivery_reason: "initial", current_status: "active", closed_at: null },
];
afterEach(cleanup);

it("motivo em botão grande; só mostra sucesso após retorno do servidor", async () => {
  let finish!: (value: { requestId: string; status: "SOLICITADA" }) => void;
  const create = vi.fn((...args: [string, string, string, string]) => {
    expect(args).toHaveLength(4);
    return new Promise<{ requestId: string; status: "SOLICITADA" }>(resolve => { finish = resolve; });
  });
  const onSent = vi.fn();
  render(<PedirTroca item={item} create={create} onSent={onSent} onClose={vi.fn()}/>);
  expect(screen.getByRole("dialog", { name: "Trocar Capacete sintético" })).toBeInTheDocument();
  const send = screen.getByRole("button", { name: "Enviar pedido" });
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Está gasto" }));
  fireEvent.click(send);
  expect(screen.queryByText("Pedido enviado!")).not.toBeInTheDocument();
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create.mock.calls[0].slice(0, 3)).toEqual([deliveryId, "DESGASTE", ""]);
  finish({ requestId, status: "SOLICITADA" });
  expect(await screen.findByText("Pedido enviado!")).toBeInTheDocument();
  expect(onSent).toHaveBeenCalledTimes(1);
});

it("Outro motivo exige explicação", async () => {
  const create = vi.fn(async () => ({ requestId, status: "SOLICITADA" as const }));
  render(<PedirTroca item={item} create={create} onSent={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "Outro motivo" }));
  const send = screen.getByRole("button", { name: "Enviar pedido" });
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Explique o motivo"), { target: { value: " Ajuste sintético " } });
  fireEvent.click(send);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect((create.mock.calls[0] as unknown[]).slice(0, 3)).toEqual([deliveryId, "OUTRO", "Ajuste sintético"]);
});

it("Voltar fecha sem enviar", () => {
  const create = vi.fn(), onClose = vi.fn();
  render(<PedirTroca item={item} create={create} onSent={vi.fn()} onClose={onClose}/>);
  fireEvent.click(screen.getByRole("button", { name: "Quebrou ou rasgou" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
});

it("pedido aberto aparece com estado simples; cancelar pede confirmação e só anuncia após o servidor", async () => {
  const cancel = vi.fn(async () => {});
  const onChanged = vi.fn();
  render(<PedidosTroca requests={[request]} cancel={cancel} onChanged={onChanged}/>);
  expect(screen.getByText(/Enviado · aguardando a Gestão/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sim, cancelar o pedido" }));
  await waitFor(() => expect(cancel).toHaveBeenCalledWith(requestId));
  expect(await screen.findByText("Pedido cancelado.")).toBeInTheDocument();
  expect(onChanged).toHaveBeenCalled();
});

it("lista completa mostra o histórico do pedido", () => {
  render(<PedidosTroca requests={[{ ...request, request_status: "RECUSADA", public_decision: "Item ainda em bom estado." }]} onChanged={vi.fn()} all/>);
  expect(screen.getByText(/Resposta da Gestão: Item ainda em bom estado./)).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Histórico do pedido" })).getByText(/Enviado/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
});

it("falha local não produz sucesso nem fila offline", async () => {
  const create = vi.fn(async () => { throw new Error("Failed to fetch"); });
  render(<PedirTroca item={item} create={create} onSent={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "Quebrou ou rasgou" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar o pedido agora.");
  expect(screen.queryByText("Pedido enviado!")).not.toBeInTheDocument();
});

it("replay de intenção cancelada informa o estado real sem anunciar novo envio", async () => {
  const create = vi.fn(async () => ({ requestId, status: "CANCELADA" as const }));
  render(<PedirTroca item={item} create={create} onSent={vi.fn()} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button", { name: "Está gasto" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
  expect(await screen.findByText("Este pedido já foi cancelado.")).toBeInTheDocument();
  expect(screen.queryByText("Pedido enviado!")).not.toBeInTheDocument();
  expect(create).toHaveBeenCalledTimes(1);
});

it("em Meus EPIs, o botão fica na própria linha do EPI e a tela de troca abre no lugar", async () => {
  const exchange = { readEligible: async () => eligible, readRequests: async () => [] as ExchangeRequest[],
    create: vi.fn(async () => ({ requestId, status: "SOLICITADA" as const })), cancel: async () => {} };
  render(<MeusEpis readEpis={async () => epis} exchange={exchange}/>);
  const button = await screen.findByRole("button", { name: "Pedir troca de Capacete sintético" });
  // EPI sem registro elegível não ganha botão.
  expect(screen.queryByRole("button", { name: "Pedir troca de Óculos sem par" })).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(screen.getByRole("dialog", { name: "Trocar Capacete sintético" })).toBeInTheDocument();
});

it("em Meus EPIs, EPI com troca em andamento mostra o aviso na linha e o pedido no topo", async () => {
  const exchange = { readEligible: async () => eligible, readRequests: async () => [request], create: vi.fn(), cancel: async () => {} };
  render(<MeusEpis readEpis={async () => epis} exchange={exchange}/>);
  expect(await screen.findByText("Troca pedida")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pedir troca de Capacete sintético" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Seus pedidos de troca" })).toBeInTheDocument();
});

it("parsers e allowlist recusam campos extras, tabela direta e remoto", async () => {
  expect(exchangeableEpis(eligible)).toHaveLength(1);
  expect(() => exchangeableEpis([{ ...eligible[0], employee_id: "maria" }])).toThrow();
  expect(exchangeRequests([request])).toHaveLength(1);
  expect(() => exchangeRequests([{ ...request, internal_note: "sigiloso" }])).toThrow();
  for (const url of ["http://127.0.0.1:54321/rest/v1/epi_exchange_requests", "https://example.supabase.co/rest/v1/rpc/create_epi_exchange_request", "http://127.0.0.1:54321/rest/v1/rpc/manage_epi_exchange_request"])
    await expect(portalFetch(url)).rejects.toThrow("Destino local não autorizado.");
});
