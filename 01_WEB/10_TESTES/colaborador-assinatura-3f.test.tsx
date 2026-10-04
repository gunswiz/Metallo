// @vitest-environment-options {"url":"http://localhost:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canonicalDelivery3f } from "@/03_FUNCOES_E_LOGICA/Assinatura/epi-signature-3f";
import { ConfirmarRecebimento } from "@/app/colaborador/[[...screen]]/epi-assinatura-3f";
import { AssinaturaSeguranca3f } from "@/app/colaborador/[[...screen]]/assinatura-seguranca-3f";
import { EpiRecebimento } from "@/app/colaborador/[[...screen]]/epi-recebimento";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { biometricSupported, cancelRegistrationCeremony3f, confirmSignature3f, finishRegistration3f, prepareRegistration3f,
  prepareSignature3f, registerPasskey3f, signatureRequest3f } from "@/04_SERVICOS/assinatura-browser-3f";

vi.mock("@/04_SERVICOS/assinatura-browser-3f", async importOriginal => ({
  ...(await importOriginal<typeof import("@/04_SERVICOS/assinatura-browser-3f")>()),
  confirmSignature3f: vi.fn(), prepareSignature3f: vi.fn(), prepareRegistration3f: vi.fn(), finishRegistration3f: vi.fn(),
  biometricSupported: vi.fn(() => true),
  cancelRegistrationCeremony3f: vi.fn(), registerPasskey3f: vi.fn(), signatureRequest3f: vi.fn(),
}));

const employee = "90cddaad-afda-4995-8511-deb32e02e450";
const group = "72e6de19-388c-4c39-9f6c-39f0df8e1280";
const item1 = "a65b5104-e00c-4302-9073-f18b8747ee7f";
const item2 = "a65b5104-e00c-4302-9073-f18b8747ee80";
const transaction = "cd732b47-3b11-4828-a217-1ce064643300";
const snapshot = { employee_id: employee, group_id: group,
  delivered_at: "2026-09-29T13:30:00-03:00", items: [
    { delivery_id: item2, item_name: "Luva", item_code: "L-1", ca: "CA-45678",
      quantity: 2, unit: "par", size: "M", lot: "L2", brand: "Marca B" },
    { delivery_id: item1, item_name: "Capacete", item_code: "C-1", ca: "CA-12345",
      quantity: 1, unit: "un", size: null, lot: null, brand: null },
  ] };
const getToken = vi.fn(async () => "jwt-sintetico-do-teste");
const prepared = { challenge_id: "54b2d5a0-fede-4489-af7f-b7cb2c4630f3",
  options: { challenge: "abc" }, payload: canonicalDelivery3f(snapshot, transaction).payload,
  token: "jwt-sintetico-do-teste" };

beforeEach(() => { vi.clearAllMocks(); vi.mocked(biometricSupported).mockReturnValue(true); });
afterEach(cleanup);

it("canonicaliza UTC, ordem, null, UTF-8 e rejeita item duplicado", () => {
  const first = canonicalDelivery3f(snapshot, transaction);
  const reversed = canonicalDelivery3f({ ...snapshot, items: [...snapshot.items].reverse(),
    delivered_at: "2026-09-29T16:30:00Z" }, transaction);
  expect(first.canonical).toBe(reversed.canonical);
  expect(first.hash).toBe(reversed.hash);
  expect(first.payload.items.map(item => item.delivery_id)).toEqual([item1, item2]);
  expect(first.payload.delivered_at).toBe("2026-09-29T16:30:00.000Z");
  expect(first.canonical).toContain('"size":null');
  expect(first.canonical).toContain('"quantity":2');
  expect(() => canonicalDelivery3f({ ...snapshot, items: [snapshot.items[0], snapshot.items[0]] },
    transaction)).toThrow();
});

it("qualquer campo histórico assinado alterado muda o SHA-256", () => {
  const original = canonicalDelivery3f(snapshot, transaction).hash;
  const mutations = [
    { ...snapshot, employee_id: item1 }, { ...snapshot, group_id: item1 },
    { ...snapshot, delivered_at: "2026-09-29T13:31:00-03:00" },
    ...(["item_name", "item_code", "ca", "quantity", "unit", "size", "lot", "brand"] as const)
      .map(field => ({ ...snapshot, items: [{ ...snapshot.items[0], [field]: field === "quantity" ? 3 : "ALTERADO" },
        snapshot.items[1]] })),
  ];
  for (const changed of mutations) expect(canonicalDelivery3f(changed, transaction).hash).not.toBe(original);
  expect(canonicalDelivery3f(snapshot, item1).hash).not.toBe(original);
  expect(() => canonicalDelivery3f({ ...snapshot, items: [{ ...snapshot.items[0], quantity: -1 }] },
    transaction)).toThrow();
});

it("cadastro é opcional, revogação preserva registro histórico e não mostra dados técnicos", async () => {
  const method = { id: "credencial-sintetica", method: "Passkey", created_at: "2026-09-29T12:00:00Z",
    revoked_at: null };
  vi.mocked(signatureRequest3f).mockResolvedValueOnce({ methods: [], events: [] });
  vi.mocked(registerPasskey3f).mockResolvedValue({ saved: true });
  vi.mocked(signatureRequest3f).mockResolvedValueOnce({ methods: [method], events: [] });
  vi.mocked(signatureRequest3f).mockResolvedValueOnce({ revoked: true });
  vi.mocked(signatureRequest3f).mockResolvedValueOnce({ methods: [{ ...method,
    revoked_at: "2026-09-29T13:00:00Z" }], events: [{ signature_event_id: item1,
    group_id: group, verified_at: "2026-09-29T12:30:00Z" }] });
  const previousCredential = Object.getOwnPropertyDescriptor(window, "PublicKeyCredential");
  const previousSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: function () {} });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  try {
    render(<AssinaturaSeguranca3f getToken={getToken}/>);
    expect(await screen.findByText("Não configurada")).toBeInTheDocument();
    expect(screen.getByText(/Ativar é uma escolha sua/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar proteção" }));
    expect(await screen.findByText("Proteção ativada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revogar método" }));
    expect(await screen.findByText("Métodos revogados: 1. As confirmações anteriores permanecem registradas.")).toBeInTheDocument();
    expect(screen.getByText("Não configurada")).toBeInTheDocument();
    expect(screen.queryByText(/challenge|COSE|public.key/i)).not.toBeInTheDocument();
  } finally {
    confirm.mockRestore();
    if (previousCredential) Object.defineProperty(window, "PublicKeyCredential", previousCredential);
    else Reflect.deleteProperty(window, "PublicKeyCredential");
    if (previousSecure) Object.defineProperty(window, "isSecureContext", previousSecure);
    else Reflect.deleteProperty(window, "isSecureContext");
  }
});

it("recusa do Windows libera uma nova tentativa sem recarregar a página", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue({ methods: [], events: [] });
  vi.mocked(registerPasskey3f).mockRejectedValueOnce(new DOMException("Recusado", "NotAllowedError"))
    .mockResolvedValueOnce({ saved: true });
  const previousCredential = Object.getOwnPropertyDescriptor(window, "PublicKeyCredential");
  const previousSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: function () {} });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  try {
    render(<AssinaturaSeguranca3f getToken={getToken}/>);
    expect(await screen.findByText("Não configurada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar proteção" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("você pode tentar novamente");
    expect(screen.getByRole("button", { name: "Tentar ativar novamente" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar ativar novamente" }));
    await waitFor(() => expect(registerPasskey3f).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent("Proteção ativada");
  } finally {
    if (previousCredential) Object.defineProperty(window, "PublicKeyCredential", previousCredential);
    else Reflect.deleteProperty(window, "PublicKeyCredential");
    if (previousSecure) Object.defineProperty(window, "isSecureContext", previousSecure);
    else Reflect.deleteProperty(window, "isSecureContext");
  }
});

it("tentativa pendente pode ser cancelada desde o início e o botão volta", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue({ methods: [], events: [] });
  vi.mocked(registerPasskey3f).mockImplementationOnce(async (_token, ceremony) => {
    ceremony?.onStart();
    await new Promise<never>(() => {});
    throw new Error("não alcançado");
  });
  const previousCredential = Object.getOwnPropertyDescriptor(window, "PublicKeyCredential");
  const previousSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: function () {} });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  try {
    render(<AssinaturaSeguranca3f getToken={getToken}/>);
    expect(await screen.findByText("Não configurada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar proteção" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar tentativa" }));
    expect(cancelRegistrationCeremony3f).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Tentar ativar novamente" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Tentativa cancelada");
  } finally {
    if (previousCredential) Object.defineProperty(window, "PublicKeyCredential", previousCredential);
    else Reflect.deleteProperty(window, "PublicKeyCredential");
    if (previousSecure) Object.defineProperty(window, "isSecureContext", previousSecure);
    else Reflect.deleteProperty(window, "isSecureContext");
  }
});

it("cancelamento enquanto obtém a sessão não envia desafio ao servidor", async () => {
  const actual = await vi.importActual<typeof import("@/04_SERVICOS/assinatura-browser-3f")>(
    "@/04_SERVICOS/assinatura-browser-3f");
  let resolveToken!: (token: string) => void;
  let cancelled = false;
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const pending = actual.registerPasskey3f(() => new Promise(resolve => { resolveToken = resolve; }), {
    onStart: vi.fn(), onEnd: vi.fn(), isCancelled: () => cancelled,
  });
  cancelled = true;
  resolveToken("jwt-sintetico-do-teste");
  try {
    await expect(pending).rejects.toThrow("Tentativa cancelada");
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally { fetchSpy.mockRestore(); }
});

it("falha ao consultar métodos não informa falsamente que não há credencial", async () => {
  vi.mocked(signatureRequest3f).mockRejectedValueOnce(new Error("Rede local indisponível"))
    .mockResolvedValueOnce({ methods: [], events: [] });
  render(<AssinaturaSeguranca3f getToken={getToken}/>);
  expect(await screen.findByText("Métodos indisponíveis")).toBeInTheDocument();
  expect(screen.queryByText("Não configurada")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ativar proteção" })).toBeDisabled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar métodos" }));
  expect(await screen.findByText("Não configurada")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ativar proteção" })).toBeEnabled();
});

// Marco 3J: confirmação de recebimento na tela cheia (digital ou senha, sem passar pelo Perfil).
const pendingGroup: PersonalDeliveryGroup3d = { group_id: group,
  delivered_at: "2026-09-29T13:30:00Z", profession: "Soldador", feedback_status: null,
  feedback_at: null, public_message: null,
  items: [{ delivery_id: item1, item_name: "Capacete", ca_number: "CA-12345",
    quantity: 1, unit: "un", variant: null, current_status: "active" }] };
const active = { methods: [{ id: "credencial-sintetica", method: "Passkey" as const, created_at: "2026-09-29T12:00:00Z", revoked_at: null }], events: [] };
const registration = { challenge_id: "64b2d5a0-fede-4489-af7f-b7cb2c4630f3", options: { challenge: "reg" }, token: "jwt-sintetico-do-teste" };

it("com digital ativa, o desafio é preparado ao abrir e o toque chama a digital na hora; sucesso só após o servidor", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue(active);
  vi.mocked(prepareSignature3f).mockResolvedValue(prepared as never);
  let finish!: (value: { signature_event_id: string; feedback_id: string }) => void;
  vi.mocked(confirmSignature3f).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const onDone = vi.fn();
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} confirmWithPassword={vi.fn()} onDone={onDone} onClose={vi.fn()}/>);
  const button = await screen.findByRole("button", { name: "Confirmar com a digital" });
  await waitFor(() => expect(button).toBeEnabled());
  expect(prepareSignature3f).toHaveBeenCalledWith(getToken, group);
  expect(confirmSignature3f).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(confirmSignature3f).toHaveBeenCalledTimes(1);
  expect(confirmSignature3f).toHaveBeenCalledWith(prepared);
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.queryByText("Pronto!")).not.toBeInTheDocument();
  finish({ signature_event_id: item1, feedback_id: "1" });
  expect(await screen.findByText("Pronto!")).toBeInTheDocument();
  expect(screen.getByText("Recebimento confirmado com a sua digital.")).toBeInTheDocument();
  expect(onDone).toHaveBeenCalledWith("digital");
});

it("digital cancelada ou recusada: mensagem clara, nada confirmado e a senha continua disponível", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue(active);
  vi.mocked(prepareSignature3f).mockResolvedValue(prepared as never);
  vi.mocked(confirmSignature3f).mockRejectedValue(new Error("NotAllowedError"));
  const onDone = vi.fn();
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} confirmWithPassword={vi.fn()} onDone={onDone} onClose={vi.fn()}/>);
  const button = await screen.findByRole("button", { name: "Confirmar com a digital" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("A digital não foi confirmada. Toque de novo ou use sua senha.");
  expect(onDone).not.toHaveBeenCalled();
  await waitFor(() => expect(prepareSignature3f).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Usar minha senha" }));
  expect(screen.getByLabelText("Digite sua senha para confirmar")).toBeInTheDocument();
});

it("sem digital cadastrada: cadastra ali mesmo (sem ir ao Perfil) e depois um toque confirma", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue({ methods: [], events: [] });
  vi.mocked(prepareRegistration3f).mockResolvedValue(registration as never);
  vi.mocked(finishRegistration3f).mockResolvedValue({ saved: true });
  vi.mocked(prepareSignature3f).mockResolvedValue(prepared as never);
  vi.mocked(confirmSignature3f).mockResolvedValue({ signature_event_id: item1, feedback_id: "1" });
  const onDone = vi.fn();
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} confirmWithPassword={vi.fn()} onDone={onDone} onClose={vi.fn()}/>);
  const register = await screen.findByRole("button", { name: "Usar minha digital" });
  await waitFor(() => expect(register).toBeEnabled());
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  fireEvent.click(register);
  expect(finishRegistration3f).toHaveBeenCalledWith(registration);
  expect(await screen.findByText("Digital cadastrada! Agora toque mais uma vez para confirmar.")).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();
  const confirm = screen.getByRole("button", { name: "Confirmar com a digital" });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
  await waitFor(() => expect(onDone).toHaveBeenCalledWith("digital"));
});

it("aparelho do almoxarifado: somente senha, nunca chama a digital do aparelho", async () => {
  const confirmWithPassword = vi.fn(async () => {});
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} sharedDevice confirmWithPassword={confirmWithPassword} onDone={vi.fn()} onClose={vi.fn()}/>);
  expect(screen.getByLabelText("Digite sua senha para confirmar")).toHaveAttribute("autocomplete", "off");
  expect(screen.queryByRole("button", { name: /digital/ })).not.toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(signatureRequest3f).not.toHaveBeenCalled();
  expect(prepareSignature3f).not.toHaveBeenCalled();
});

it("navegador sem digital ou falha ao preparar: vai direto para a senha", async () => {
  vi.mocked(signatureRequest3f).mockRejectedValue(new Error("Consulta indisponível"));
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} confirmWithPassword={vi.fn()} onDone={vi.fn()} onClose={vi.fn()}/>);
  expect(await screen.findByLabelText("Digite sua senha para confirmar")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível preparar a digital agora. Use sua senha.");
  cleanup();
  vi.mocked(biometricSupported).mockReturnValue(false);
  render(<ConfirmarRecebimento group={pendingGroup} getAccessToken={getToken} confirmWithPassword={vi.fn()} onDone={vi.fn()} onClose={vi.fn()}/>);
  expect(screen.getByLabelText("Digite sua senha para confirmar")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Usar a digital" })).not.toBeInTheDocument();
});

const confirmedGroup: PersonalDeliveryGroup3d[] = [{ ...pendingGroup, feedback_status: "CONFIRMADO", feedback_at: "2026-09-29T13:40:00Z" }];
it("entregas confirmadas: não declara a forma quando a consulta 3F falha", async () => {
  vi.mocked(signatureRequest3f).mockRejectedValue(new Error("Consulta indisponível"));
  render(<EpiRecebimento read={async () => confirmedGroup} respond={async () => 1} getAccessToken={getToken} view="confirmadas"/>);
  expect(await screen.findByText("Confirmado · forma indisponível")).toBeInTheDocument();
  expect(screen.queryByText("Confirmado com a digital")).not.toBeInTheDocument();
});

it("entregas confirmadas: mostra o selo da digital quando o próprio evento 3F existe", async () => {
  vi.mocked(signatureRequest3f).mockResolvedValue({ methods: [], events: [{ signature_event_id: item2,
    group_id: group, verified_at: "2026-09-29T13:40:00Z" }] });
  render(<EpiRecebimento read={async () => confirmedGroup} respond={async () => 1} getAccessToken={getToken} view="confirmadas"/>);
  expect(await screen.findByText("Confirmado com a digital")).toBeInTheDocument();
});
