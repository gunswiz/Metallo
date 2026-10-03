// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { SHARED_AFTER_CONFIRM_MS, SHARED_DEVICE_KEY, SHARED_IDLE_MS, setSharedDevice, useAparelhoCompartilhado } from "@/03_FUNCOES_E_LOGICA/Autenticacao/aparelho-compartilhado";
import { EpiRecebimento } from "@/app/colaborador/[[...screen]]/epi-recebimento";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { signatureRequest3f } from "@/04_SERVICOS/assinatura-browser-3f";

vi.mock("@/04_SERVICOS/assinatura-browser-3f", () => ({ signatureRequest3f: vi.fn(), confirmSignature3f: vi.fn(), prepareSignature3f: vi.fn() }));
const group = "72e6de19-388c-4c39-9f6c-39f0df8e1280";
const groups: PersonalDeliveryGroup3d[] = [{ group_id: group, delivered_at: "2026-09-29T13:30:00Z", profession: "Soldador",
  feedback_status: null, feedback_at: null, public_message: null,
  items: [{ delivery_id: "a65b5104-e00c-4302-9073-f18b8747ee7f", item_name: "Luva", ca_number: "CA-1", quantity: 1, unit: "par", variant: null, current_status: "active" }] }];
beforeEach(() => { sessionStorage.clear(); vi.mocked(signatureRequest3f).mockResolvedValue({ methods: [{ id: "c", method: "Passkey", created_at: "2026-09-29T12:00:00Z", revoked_at: null }], events: [] }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("sem marcação de aparelho compartilhado, nada sai sozinho", async () => {
  vi.useFakeTimers(); const logout = vi.fn();
  const view = renderHook(() => useAparelhoCompartilhado(true, logout));
  await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_IDLE_MS + 1000); });
  expect(view.result.current.shared).toBe(false); expect(logout).not.toHaveBeenCalled();
});
it("aparelho compartilhado sai após 2 minutos sem uso e limpa a marcação", async () => {
  vi.useFakeTimers(); setSharedDevice(true); const logout = vi.fn();
  const view = renderHook(() => useAparelhoCompartilhado(true, logout));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(view.result.current.shared).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_IDLE_MS - 1000); });
  act(() => { fireEvent.pointerDown(window); }); // uso reinicia o prazo
  await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_IDLE_MS - 1000); });
  expect(logout).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(logout).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(SHARED_DEVICE_KEY)).toBeNull();
});
it("aparelho compartilhado sai alguns segundos depois de registrar o recebimento", async () => {
  vi.useFakeTimers(); setSharedDevice(true); const logout = vi.fn();
  const view = renderHook(() => useAparelhoCompartilhado(true, logout));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  act(() => view.result.current.afterConfirm());
  expect(view.result.current.leaving).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(SHARED_AFTER_CONFIRM_MS + 10); });
  expect(logout).toHaveBeenCalledTimes(1);
});
it("no aparelho compartilhado, não oferece biometria do aparelho e avisa após confirmar", async () => {
  const onConfirmed = vi.fn(), respond = vi.fn(async () => 1);
  render(<EpiRecebimento read={async () => groups} respond={respond} getAccessToken={async () => "jwt"} sharedDevice onConfirmed={onConfirmed}/>);
  const button = await screen.findByRole("button", { name: "Confirmar recebimento" });
  await waitFor(() => expect(signatureRequest3f).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "Confirmar com biometria" })).not.toBeInTheDocument();
  expect(screen.queryByText(/ative a biometria do celular/)).not.toBeInTheDocument();
  fireEvent.click(button); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  expect(respond).toHaveBeenCalledTimes(1);
});
