// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ComunicadosAtalho, MeusComunicados } from "@/app/colaborador/[[...screen]]/meus-comunicados";
import { communicationInput3h, type CommunicationSummary3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";

const base: CommunicationSummary3h = { id: "11111111-1111-4111-8111-111111111111", title: "Aviso sintético",
  audience: "ALL", audience_name: "Todos os colaboradores", pinned: false,
  published_at: "2026-09-30T12:00:00+00:00", updated_at: null, expires_at: null,
  version: 2, first_viewed_at: null };
const input = { id: null, title: "Aviso", message: "Texto", audience: "ALL", teamId: null,
  workId: null, pinned: false, expiresAt: null, idempotencyKey: base.id, expectedVersion: null };
afterEach(cleanup);

it("valida título, mensagem, público e HTML antes do servidor", () => {
  expect(communicationInput3h.safeParse(input).success).toBe(true);
  expect(communicationInput3h.safeParse({ ...input, title: "   " }).success).toBe(false);
  expect(communicationInput3h.safeParse({ ...input, message: "<script>" }).success).toBe(false);
  expect(communicationInput3h.safeParse({ ...input, audience: "TEAM", teamId: null }).success).toBe(false);
  expect(communicationInput3h.safeParse({ ...input, message: "A".repeat(4001) }).success).toBe(false);
});

it("lista não registra abertura; abrir registra uma vez e humaniza sem executar HTML", async () => {
  const read = vi.fn().mockResolvedValue([base]);
  const open = vi.fn().mockResolvedValue({ ...base, message: "<script>alert(1)</script>\nLinha 2",
    first_viewed_at: "2026-09-30T13:00:00+00:00" });
  render(<MeusComunicados read={read} open={open} demo={false}/>);
  const button = await screen.findByRole("button", { name: /Aviso sintético/ });
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(await screen.findByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/não é assinatura nem aceite/i)).toBeInTheDocument();
});

it("troca de conta desmonta estado de João antes de renderizar Maria", async () => {
  const joao = { ...base, audience: "TEAM" as const, audience_name: "Equipe João" };
  const maria = { ...base, id: "22222222-2222-4222-8222-222222222222", title: "Aviso Maria", audience_name: "Equipe Maria" };
  const readJoao = vi.fn().mockResolvedValue([joao]);
  const readMaria = vi.fn().mockResolvedValue([maria]);
  const open = vi.fn();
  const view = render(<MeusComunicados key="joao" read={readJoao} open={open} demo={false}/>);
  expect(await screen.findByText("Aviso sintético")).toBeInTheDocument();
  view.rerender(<MeusComunicados key="maria" read={readMaria} open={open} demo={false}/>);
  expect(screen.queryByText("Aviso sintético")).not.toBeInTheDocument();
  expect(await screen.findByText("Aviso Maria")).toBeInTheDocument();
});

it("falha de leitura descarta cartões anteriores, sem fallback offline", async () => {
  let failing = false;
  const read = vi.fn(async () => { if (failing) throw new Error("offline"); return [base]; });
  render(<MeusComunicados read={read} open={vi.fn()} demo={false}/>);
  expect(await screen.findByText("Aviso sintético")).toBeInTheDocument();
  failing = true; fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByText("Aviso sintético")).not.toBeInTheDocument());
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
});

it("atalho mostra quantidade aproximada e abre sem mudar a barra inferior", async () => {
  const onOpen = vi.fn();
  render(<ComunicadosAtalho read={async () => [base]} demo={false} onOpen={onOpen}/>);
  expect(await screen.findByText("1 não lido")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Abrir Comunicados/ }));
  expect(onOpen).toHaveBeenCalledOnce();
});
