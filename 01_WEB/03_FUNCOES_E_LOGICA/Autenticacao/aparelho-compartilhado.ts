"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Marco 3I — aparelho do almoxarifado (compartilhado). Para quem não tem celular:
// o funcionário entra com a PRÓPRIA conta num tablet/PC da empresa, confirma e o portal sai sozinho.
// - Sai automaticamente alguns segundos depois de confirmar/informar divergência de EPI.
// - Sai automaticamente após 2 minutos sem uso.
// - Biometria do aparelho não é usada (o aparelho não é do funcionário).
export const SHARED_DEVICE_KEY = "metallo-aparelho-compartilhado";
export const SHARED_IDLE_MS = 120_000;
export const SHARED_AFTER_CONFIRM_MS = 6_000;

function readFlag() {
  try { return typeof window !== "undefined" && window.sessionStorage.getItem(SHARED_DEVICE_KEY) === "1"; }
  catch { return false; }
}
export function setSharedDevice(on: boolean) {
  try { if (on) window.sessionStorage.setItem(SHARED_DEVICE_KEY, "1"); else window.sessionStorage.removeItem(SHARED_DEVICE_KEY); }
  catch { /* sem armazenamento: modo comum */ }
}

export function useAparelhoCompartilhado(active: boolean, logout: () => Promise<void> | void) {
  const [shared, setShared] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const exit = useRef(logout);
  useEffect(() => { exit.current = logout; }, [logout]);
  useEffect(() => {
    // Lê o armazenamento da aba somente no navegador, após montar.
    const timer = window.setTimeout(() => setShared(active && readFlag()), 0);
    return () => window.clearTimeout(timer);
  }, [active]);
  const leave = useCallback(() => { setSharedDevice(false); setShared(false); setLeaving(false); void exit.current(); }, []);
  useEffect(() => {
    if (!shared) return;
    let idle = window.setTimeout(leave, SHARED_IDLE_MS);
    const reset = () => { window.clearTimeout(idle); idle = window.setTimeout(leave, SHARED_IDLE_MS); };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach(name => window.addEventListener(name, reset, { passive: true }));
    return () => { window.clearTimeout(idle); events.forEach(name => window.removeEventListener(name, reset)); };
  }, [shared, leave]);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(leave, SHARED_AFTER_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, leave]);
  const afterConfirm = useCallback(() => { if (shared) setLeaving(true); }, [shared]);
  return { shared, leaving, afterConfirm, leaveNow: leave };
}
