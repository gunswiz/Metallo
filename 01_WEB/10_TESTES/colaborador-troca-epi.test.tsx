// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EpiTroca } from "@/app/colaborador/[[...screen]]/epi-troca";
import { exchangeableEpis, exchangeRequests, portalFetch, type ExchangeRequest } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

const deliveryId = "4a055742-1d17-4a0f-984b-a19b46d3438d";
const requestId = "6956b958-bf65-4ab3-8852-93bdcc0fce4b";
const eligible = [{ delivery_id: deliveryId, item_name: "Capacete sintético", ca_number: "12345", variant: "M", recorded_at: "2026-09-28T12:00:00Z" }];
const request: ExchangeRequest = { request_id: requestId, source_delivery_id: deliveryId, item_name: "Capacete sintético", ca_number: "12345", reason: "DESGASTE", note: null,
  request_status: "SOLICITADA", requested_at: "2026-09-28T12:00:00Z", updated_at: "2026-09-28T12:00:00Z", public_decision: null,
  timeline: [{ status: "SOLICITADA", at: "2026-09-28T12:00:00Z", message: null }] };
afterEach(cleanup);

it("confirma antes de enviar e só mostra sucesso após retorno do servidor", async () => {
  let finish!: (value: { requestId: string; status: "SOLICITADA" }) => void;
  const create = vi.fn((...args: [string, string, string, string]) => {
    expect(args).toHaveLength(4);
    return new Promise<{ requestId: string; status: "SOLICITADA" }>(resolve => { finish = resolve; });
  });
  render(<EpiTroca readEligible={async () => eligible} readRequests={async () => []} create={create} cancel={async () => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Solicitar troca" }));
  fireEvent.click(screen.getByLabelText("Desgaste"));
  fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
  expect(screen.queryByText("Solicitação enviada.")).not.toBeInTheDocument();
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create.mock.calls[0][0]).toBe(deliveryId);
  expect(create.mock.calls[0][1]).toBe("DESGASTE");
  finish({ requestId, status: "SOLICITADA" });
  expect(await screen.findByText("Solicitação enviada.")).toBeInTheDocument();
});

it("exige observação em Outro e não envia sem confirmação", async () => {
  const create = vi.fn(async () => ({ requestId, status: "SOLICITADA" as const }));
  render(<EpiTroca readEligible={async () => eligible} readRequests={async () => []} create={create} cancel={async () => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Solicitar troca" }));
  fireEvent.click(screen.getByLabelText("Outro motivo"));
  expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Observação/), { target: { value: " Ajuste sintético " } });
  fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(create).not.toHaveBeenCalled();
});

it("pedido aberto bloqueia novo botão e cancelamento é confirmado pelo servidor", async () => {
  const cancel = vi.fn(async () => {});
  render(<EpiTroca readEligible={async () => eligible} readRequests={async () => [request]} create={async () => ({ requestId, status: "SOLICITADA" })} cancel={cancel}/>);
  expect(await screen.findByText("Troca em andamento")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar troca" })).not.toBeInTheDocument();
  expect(screen.getByText("Status: Solicitada")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Histórico da solicitação" })).getByText(/Solicitada/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));
  await waitFor(() => expect(cancel).toHaveBeenCalledWith(requestId));
  expect(await screen.findByText("Solicitação cancelada.")).toBeInTheDocument();
});

it("falha local não produz sucesso nem fila offline", async () => {
  const create = vi.fn(async () => { throw new Error("Failed to fetch"); });
  render(<EpiTroca readEligible={async () => eligible} readRequests={async () => []} create={create} cancel={async () => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Solicitar troca" }));
  fireEvent.click(screen.getByLabelText("Danificado"));
  fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar a solicitação agora.");
  expect(screen.queryByText("Solicitação enviada.")).not.toBeInTheDocument();
});

it("replay de intenção cancelada informa o estado real sem anunciar novo envio", async () => {
  const create = vi.fn(async () => ({ requestId, status: "CANCELADA" as const }));
  render(<EpiTroca readEligible={async () => eligible} readRequests={async () => []} create={create} cancel={async () => {}}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Solicitar troca" }));
  fireEvent.click(screen.getByLabelText("Desgaste"));
  fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));
  expect(await screen.findByText("Esta solicitação já foi cancelada.")).toBeInTheDocument();
  expect(screen.queryByText("Solicitação enviada.")).not.toBeInTheDocument();
  expect(create).toHaveBeenCalledTimes(1);
});

it("parsers e allowlist recusam campos extras, tabela direta e remoto", async () => {
  expect(exchangeableEpis(eligible)).toHaveLength(1);
  expect(() => exchangeableEpis([{ ...eligible[0], employee_id: "maria" }])).toThrow();
  expect(exchangeRequests([request])).toHaveLength(1);
  expect(() => exchangeRequests([{ ...request, internal_note: "sigiloso" }])).toThrow();
  for (const url of ["http://127.0.0.1:54321/rest/v1/epi_exchange_requests", "https://example.supabase.co/rest/v1/rpc/create_epi_exchange_request", "http://127.0.0.1:54321/rest/v1/rpc/manage_epi_exchange_request"])
    await expect(portalFetch(url)).rejects.toThrow("Destino local não autorizado.");
});
