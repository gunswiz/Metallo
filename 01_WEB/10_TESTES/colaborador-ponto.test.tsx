// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeuPonto } from "@/app/colaborador/[[...screen]]/meu-ponto";
import { parseLabEvent, pointRequest } from "@/05_ACESSO_A_DADOS/Ponto/ponto-lab";

vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-lab", async importOriginal => {
  const actual = await importOriginal<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-lab")>();
  return { ...actual, pointRequest: vi.fn() };
});
const request = vi.mocked(pointRequest);
const getToken = vi.fn(async () => "jwt-sintetico");
const event = { event_id: "00000000-0000-4000-8000-000000000001", server_received_at_utc: "2026-09-27T10:02:14.000Z", payload_hash: "a".repeat(64) };

beforeEach(() => { request.mockReset(); getToken.mockReset(); getToken.mockResolvedValue("jwt-sintetico"); });
afterEach(() => cleanup());

it("mantém aviso de simulação e só confirma após resposta do servidor", async () => {
  let confirm!: (value: { status: number; body: unknown }) => void;
  request.mockImplementation(async (path, _token, init) => path === "/lab-point/v1/events" && init?.method === "POST"
    ? new Promise(resolve => { confirm = resolve; })
    : { status: 200, body: { events: [] } });
  render(<MeuPonto getToken={getToken} />);
  expect(screen.getByText("SIMULAÇÃO SEM VALOR OFICIAL")).toBeInTheDocument();
  expect(screen.getByText(/Sem cálculo de jornada/)).toBeInTheDocument();
  const button = screen.getByRole("button", { name: "BATER PONTO DE TESTE" });
  fireEvent.click(button);
  expect(screen.getByRole("status")).toHaveTextContent("ENVIANDO...");
  expect(button).toBeDisabled();
  expect(screen.queryByText("Marcação de teste")).not.toBeInTheDocument();
  await waitFor(() => expect(confirm).toBeTypeOf("function"));
  confirm({ status: 201, body: { event } });
  expect(await screen.findByText("REGISTRADO NO LABORATÓRIO")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/lab-point/v1/events", "jwt-sintetico", expect.objectContaining({ method: "POST" }));
});

it("recupera resposta perdida pela mesma chave sem criar segunda intenção", async () => {
  request.mockImplementation(async (path, _token, init) => path.startsWith("/lab-point/v1/intent/")
    ? { status: 200, body: { event } }
    : init?.method === "POST" ? Promise.reject(new Error("resposta perdida")) : { status: 200, body: { events: [event] } });
  render(<MeuPonto getToken={getToken} />);
  fireEvent.click(screen.getByRole("button", { name: "BATER PONTO DE TESTE" }));
  expect(await screen.findByText("REGISTRADO NO LABORATÓRIO")).toBeInTheDocument();
  const post = request.mock.calls.find(([, , init]) => init?.method === "POST");
  const key = JSON.parse(String(post?.[2]?.body)).idempotency_key;
  expect(request.mock.calls.some(([path]) => path === `/lab-point/v1/intent/${key}`)).toBe(true);
  expect(request.mock.calls.filter(([, , init]) => init?.method === "POST")).toHaveLength(1);
  expect(screen.getByText("Marcação de teste")).toBeInTheDocument();
});

it("falha offline sem confirmar e reutiliza a chave ao tentar novamente", async () => {
  request.mockImplementation(async (_path, _token, init) => init?.method === "POST" ? Promise.reject(new Error("offline")) :
    _path.includes("/intent/") ? Promise.reject(new Error("offline")) : { status: 200, body: { events: [] } });
  render(<MeuPonto getToken={getToken} />);
  const button = screen.getByRole("button", { name: "BATER PONTO DE TESTE" });
  fireEvent.click(button);
  expect(await screen.findByText("LABORATÓRIO INDISPONÍVEL")).toBeInTheDocument();
  expect(screen.queryByText("Marcação de teste")).not.toBeInTheDocument();
  fireEvent.click(button);
  await waitFor(() => expect(request.mock.calls.filter(([, , init]) => init?.method === "POST")).toHaveLength(2));
  const posts = request.mock.calls.filter(([, , init]) => init?.method === "POST");
  expect(JSON.parse(String(posts[0][2]?.body)).idempotency_key).toBe(JSON.parse(String(posts[1][2]?.body)).idempotency_key);
});

it("sessão expirada bloqueia nova marcação", async () => {
  request.mockResolvedValue({ status: 401, body: { error: "SESSAO_INVALIDA" } });
  render(<MeuPonto getToken={getToken} />);
  expect(await screen.findByText("SESSÃO EXPIRADA")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "BATER PONTO DE TESTE" })).toBeDisabled();
  expect(request.mock.calls.filter(([, , init]) => init?.method === "POST")).toHaveLength(0);
});

it("sessão encerrada limpa histórico e não reapresenta sucesso de resposta antiga", async () => {
  let finish!: (value: { status: number; body: unknown }) => void;
  let reads = 0;
  request.mockImplementation(async (_path, _token, init) => {
    if (init?.method === "POST") return new Promise(resolve => { finish = resolve; });
    reads += 1;
    return reads === 1 ? { status: 200, body: { events: [event] } } : { status: 401, body: { error: "SESSAO_ENCERRADA" } };
  });
  render(<MeuPonto getToken={getToken} />);
  expect(await screen.findByText("Marcação de teste")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "BATER PONTO DE TESTE" }));
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  finish({ status: 201, body: { event } });
  expect(await screen.findByText("SESSÃO ENCERRADA")).toBeInTheDocument();
  expect(screen.queryByText("Marcação de teste")).not.toBeInTheDocument();
  expect(screen.queryByText("REGISTRADO NO LABORATÓRIO")).not.toBeInTheDocument();
});

it("acesso revogado remove o histórico pessoal visível", async () => {
  let reads = 0;
  request.mockImplementation(async () => {
    reads += 1;
    return reads === 1 ? { status: 200, body: { events: [event] } } : { status: 403, body: { error: "ACESSO_REVOGADO" } };
  });
  render(<MeuPonto getToken={getToken} />);
  expect(await screen.findByText("Marcação de teste")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "BATER PONTO DE TESTE" }));
  expect(await screen.findByText("ACESSO REVOGADO")).toBeInTheDocument();
  expect(screen.queryByText("Marcação de teste")).not.toBeInTheDocument();
});

it("aceita apenas DTO mínimo do evento; rejeita dados operacionais extras", () => {
  expect(parseLabEvent(event)).toEqual(event);
  expect(() => parseLabEvent({ ...event, employee_id: "outro" })).toThrow();
  expect(() => parseLabEvent({ ...event, server_received_at_utc: "amanhã" })).toThrow();
});
