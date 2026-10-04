"use client";

import { startAuthentication, startRegistration, WebAuthnAbortService } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

import { TESTE_ONLINE_ASSINATURA_3F, TESTE_ONLINE_COLABORADOR_ORIGIN } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Laboratório: rota local. Teste online: Edge Function do projeto de teste. Nenhum outro endereço.
function endpoint3f(origin: string) {
  if (origin === "http://localhost:3101") return "/api/laboratorio/assinatura-epi";
  if (origin === TESTE_ONLINE_COLABORADOR_ORIGIN) return TESTE_ONLINE_ASSINATURA_3F;
  return null;
}
export type SignatureMethod3f = { id: string; method: "Passkey"; created_at: string; revoked_at: string | null };
export type SignatureEvent3f = { signature_event_id: string; group_id: string; verified_at: string };
export type SignatureState3f = { methods: SignatureMethod3f[]; events: SignatureEvent3f[] };
export type SignedPayload3f = { version: "3F-v1"; transaction_id: string; employee_id: string;
  group_id: string; delivered_at: string; items: { delivery_id: string; item_name: string;
    item_code: string | null; ca: string | null; quantity: number; unit: string;
    size: string | null; lot: string | null; brand: string | null }[] };
export type PreparedSignature3f = { challenge_id: string; options: PublicKeyCredentialRequestOptionsJSON;
  payload: SignedPayload3f; token: string };

export async function signatureRequest3f<T>(token: string, body: object, signal?: AbortSignal): Promise<T> {
  const endpoint = endpoint3f(window.location.origin);
  if (!endpoint) throw new Error("Abra a prévia em http://localhost:3101 para usar sua credencial neste computador.");
  const response = await fetch(endpoint, { method: "POST", cache: "no-store", credentials: "omit",
    redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) :
      AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(navigator.onLine ?
    "Não foi possível validar. Atualize seus dados e tente novamente." :
    "Sem conexão. Nenhuma assinatura foi registrada.");
  return response.json() as Promise<T>;
}

export type RegistrationCeremony3f = {
  onStart: () => void;
  onEnd: () => void;
  isCancelled: () => boolean;
  signal?: AbortSignal;
};

export function cancelRegistrationCeremony3f() {
  WebAuthnAbortService.cancelCeremony();
}

export async function registerPasskey3f(getToken: () => Promise<string>, ceremony?: RegistrationCeremony3f) {
  ceremony?.onStart();
  let cancelable = true;
  const endCancelableStage = () => {
    if (cancelable) { cancelable = false; ceremony?.onEnd(); }
  };
  try {
    if (ceremony?.isCancelled()) throw new Error("Tentativa cancelada.");
    const token = await getToken();
    if (ceremony?.isCancelled()) throw new Error("Tentativa cancelada.");
    const start = await signatureRequest3f<{ challenge_id: string; options: PublicKeyCredentialCreationOptionsJSON }>(token,
      { action: "register_start" }, ceremony?.signal);
    if (ceremony?.isCancelled()) throw new Error("Tentativa cancelada.");
    const response = await startRegistration({ optionsJSON: start.options });
    if (ceremony?.isCancelled()) throw new Error("Tentativa cancelada.");
    endCancelableStage();
    return await signatureRequest3f<{ saved: true }>(token,
      { action: "register_finish", challenge_id: start.challenge_id, response });
  } finally { endCancelableStage(); }
}

export async function prepareSignature3f(getToken: () => Promise<string>, groupId: string) {
  const token = await getToken();
  const start = await signatureRequest3f<Omit<PreparedSignature3f, "token">>(token,
    { action: "sign_start", group_id: groupId });
  return { ...start, token };
}

export async function confirmSignature3f(start: PreparedSignature3f) {
  const response = await startAuthentication({ optionsJSON: start.options });
  return signatureRequest3f<{ signature_event_id: string; feedback_id: string }>(start.token,
    { action: "sign_finish", challenge_id: start.challenge_id, response });
}
