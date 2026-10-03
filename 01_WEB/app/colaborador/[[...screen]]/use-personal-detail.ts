"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { friendlyPortalError } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

type DetailState<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

// Cada troca de aba, foco ou tentativa descarta o conteúdo anterior antes da leitura pessoal.
export function usePersonalDetail<T>(read: () => Promise<T>) {
  const [state, setState] = useState<DetailState<T>>({ status: "loading" });
  const request = useRef(0);
  const refresh = useCallback(() => {
    const ticket = ++request.current;
    setState({ status: "loading" });
    void read().then(data => {
      if (ticket === request.current) setState({ status: "ready", data });
    }).catch(error => {
      if (ticket === request.current) setState({ status: "error", message: friendlyPortalError(error) });
    });
  }, [read]);
  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      request.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return { state, refresh };
}
