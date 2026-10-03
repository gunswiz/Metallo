import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { communicationExpiryIso3h, communicationExpiryLocal3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import { saveCommunication3h } from "@/app/actions/comunicados-3h";
import { CommunicationForm3h } from "@/app/(02_SISTEMA)/comunicados/communication-form";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), guard: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/comunicados-3h", () => ({ requireCommunicationLab3h: mocks.guard }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
const intentKey = "11111111-1111-4111-8111-111111111111";
const savedId = "22222222-2222-4222-8222-222222222222";
const initial = { error: null };
function form() {
  const data = new FormData();
  Object.entries({ title: "Aviso", message: "Texto sintético", audience: "ALL", idempotencyKey: intentKey,
    expiresAt: "2035-09-30T18:00", intent: "publish" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); }); });
afterEach(cleanup);

it("F01: 18h Fortaleza persiste em UTC e reedição conserva segundos e milissegundos", () => {
  const utc = communicationExpiryIso3h("2035-09-30T18:00");
  expect(utc).toBe("2035-09-30T21:00:00.000Z");
  expect(communicationExpiryIso3h(communicationExpiryLocal3h(utc!))).toBe(utc);
  const exact = "2035-09-30T21:00:37.123Z";
  expect(communicationExpiryIso3h(communicationExpiryLocal3h(exact))).toBe(exact);
  expect(() => communicationExpiryIso3h("2035-02-30T18:00")).toThrow();
  expect(() => communicationExpiryIso3h("2035-09-30T18:00Z")).toThrow();
});

it("F03: save confirmado e publish falho retornam erro; retry usa mesma chave e mesmo ID", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: savedId, error: null }).mockResolvedValueOnce({ data: null, error: { message: "offline" } });
  const state = await saveCommunication3h(initial, form());
  expect(state.error).toMatch(/salvamento foi confirmado/i);
  expect(mocks.redirect).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: savedId, error: null }).mockResolvedValueOnce({ data: savedId, error: null });
  await expect(saveCommunication3h(state, form())).rejects.toThrow("redirect:/comunicados?ok=1");
  const saves = mocks.rpc.mock.calls.filter(call => call[0] === "save_communication_3h");
  expect(saves.map(call => call[1].p_idempotency_key)).toEqual([intentKey, intentKey]);
  expect(saves.map(call => call[1].p_expires_at)).toEqual(["2035-09-30T21:00:00.000Z", "2035-09-30T21:00:00.000Z"]);
  expect(mocks.rpc.mock.calls.filter(call => call[0] === "publish_communication_3h").map(call => call[1].p_id)).toEqual([savedId, savedId]);
  expect(mocks.capability).toHaveBeenCalledTimes(2);
});

it("F03: resposta de save perdida preserva erro sem redirect; falta da chave não cria intenção nova", async () => {
  mocks.rpc.mockRejectedValueOnce(new Error("connection lost"));
  expect((await saveCommunication3h(initial, form())).error).toMatch(/conexão interrompida/i);
  expect(mocks.redirect).not.toHaveBeenCalled();
  const noKey = form(); noKey.delete("idempotencyKey");
  expect((await saveCommunication3h(initial, noKey)).error).toMatch(/confira/i);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it("ação conserva exigência de permissão e de laboratório antes de chamar RPC", async () => {
  mocks.capability.mockRejectedValueOnce(new Error("forbidden"));
  await expect(saveCommunication3h(initial, form())).rejects.toThrow("forbidden");
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.guard.mockImplementationOnce(() => { throw new Error("not local"); });
  await expect(saveCommunication3h(initial, form())).rejects.toThrow("not local");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("F03/F04: formulário bloqueia duplo clique e conserva campos/chave após falha e re-render", async () => {
  let resolve!: (value: { data: null; error: { message: string } }) => void;
  mocks.rpc.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = render(<CommunicationForm3h teams={[]} works={[]} idempotencyKey={intentKey}/>);
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Aviso conservado" } });
  fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "Texto conservado" } });
  const publish = screen.getByRole("button", { name: "Publicar comunicado" });
  fireEvent.click(publish);
  await waitFor(() => expect(publish).toBeDisabled());
  fireEvent.click(publish);
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: null, error: { message: "offline" } }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível salvar/i);
  expect(screen.getByLabelText("Título")).toHaveValue("Aviso conservado");
  expect(screen.getByLabelText("Mensagem")).toHaveValue("Texto conservado");
  view.rerender(<CommunicationForm3h teams={[]} works={[]} idempotencyKey={savedId}/>);
  expect(document.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')?.value).toBe(intentKey);
  expect(screen.getByRole("button", { name: "Publicar comunicado" })).toBeEnabled();
});

it("F04: botão reutilizado em publicar/arquivar fica indisponível durante action", async () => {
  let resolve!: () => void;
  const action = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  render(<form action={action}><SubmitButton>Arquivar</SubmitButton></form>);
  fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Processando…" })).toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Processando…" }));
  expect(action).toHaveBeenCalledOnce();
  await act(async () => resolve());
  expect(screen.getByRole("button", { name: "Arquivar" })).toBeEnabled();
});
