"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { parseLabEvent, pointRequest, type LabTimeEvent } from "@/05_ACESSO_A_DADOS/Ponto/ponto-lab";
import styles from "./colaborador.module.css";

type State = "PRONTO" | "ENVIANDO..." | "REGISTRADO NO LABORATÓRIO" | "VERIFICANDO RESULTADO..." | "DUPLICADO — EVENTO JÁ REGISTRADO" | "SESSÃO EXPIRADA" | "SESSÃO ENCERRADA" | "ACESSO REVOGADO" | "CONTEXTO INATIVO" | "CONTEXTO INDISPONÍVEL PARA SIMULAÇÃO" | "LABORATÓRIO INDISPONÍVEL";
export function MeuPonto({ getToken }: { getToken: () => Promise<string> }) {
  const [state, setState] = useState<State>("PRONTO");
  const [events, setEvents] = useState<LabTimeEvent[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const alive = useRef(true);
  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await pointRequest("/lab-point/v1/events", token);
      if (response.status === 401) throw new Error(response.body.error === "SESSAO_ENCERRADA" ? "SESSAO_ENCERRADA" : "SESSAO_INVALIDA");
      if (response.status === 403) throw new Error(response.body.error === "ACESSO_REVOGADO" ? "ACESSO_REVOGADO" : "CONTEXTO_INATIVO");
      if (response.status === 409 && response.body.error === "CONTEXTO_INDISPONIVEL_PARA_SIMULACAO") throw new Error("CONTEXTO_INDISPONIVEL_PARA_SIMULACAO");
      if (response.status !== 200 || !Array.isArray(response.body.events)) throw new Error("INDISPONIVEL");
      if (alive.current) setEvents(response.body.events.map(parseLabEvent));
      return true;
    } catch (error) { if (alive.current) { setEvents([]); setPending(null); setState(messageFor(error)); } return false; }
  }, [getToken]);
  useEffect(() => { alive.current = true; const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); alive.current = false; }; }, [load]);
  const mark = async () => {
    const key = pending ?? crypto.randomUUID();
    setPending(key); setState("ENVIANDO...");
    try {
      const token = await getToken();
      const result = await pointRequest("/lab-point/v1/events", token, { method: "POST", body: JSON.stringify({ contract_version: 1, idempotency_key: key }) });
      if (result.status === 201 || result.status === 200) {
        parseLabEvent(result.body.event);
        if (await load() && alive.current) { setPending(null); setState(result.status === 200 ? "DUPLICADO — EVENTO JÁ REGISTRADO" : "REGISTRADO NO LABORATÓRIO"); }
        return;
      }
      setState(messageFor(new Error(result.body.error ?? "INDISPONIVEL")));
      if (result.status === 401 || result.status === 403) setEvents([]);
      if (result.status < 500) setPending(null);
    } catch {
      setState("VERIFICANDO RESULTADO...");
      try {
        const token = await getToken();
        const check = await pointRequest(`/lab-point/v1/intent/${key}`, token);
        if (check.status === 200) { parseLabEvent(check.body.event); if (await load() && alive.current) { setPending(null); setState("REGISTRADO NO LABORATÓRIO"); } }
        else if (check.status === 404) setState("LABORATÓRIO INDISPONÍVEL");
        else { setState(messageFor(new Error(check.body.error ?? "INDISPONIVEL"))); if (check.status === 401 || check.status === 403) setEvents([]); }
      } catch { setState("LABORATÓRIO INDISPONÍVEL"); }
    }
  };
  return <div className={styles.pointLab}>
    <Clock3 size={35} aria-hidden="true"/>
    <strong className={styles.pointWarning}>SIMULAÇÃO SEM VALOR OFICIAL</strong>
    <p>Somente dados fictícios. Este registro não é ponto oficial nem REP-P.</p>
    <button className={styles.primary} type="button" disabled={state === "ENVIANDO..." || state === "VERIFICANDO RESULTADO..." || state === "SESSÃO EXPIRADA" || state === "SESSÃO ENCERRADA" || state === "ACESSO REVOGADO" || state === "CONTEXTO INATIVO" || state === "CONTEXTO INDISPONÍVEL PARA SIMULAÇÃO"} onClick={() => void mark()}>BATER PONTO DE TESTE</button>
    <p className={styles.pointState} role="status">{state}</p>
    <h2>Hoje no laboratório</h2>
    {events.length === 0 ? <p>Nenhuma marcação de teste confirmada.</p> : <ul className={styles.pointHistory}>{events.map(event => <li key={event.event_id}><span>Marcação de teste</span><strong>{new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium", timeZone: "America/Fortaleza" }).format(new Date(event.server_received_at_utc))}</strong></li>)}</ul>}
    <small>Horários confirmados pelo servidor. Sem cálculo de jornada.</small>
  </div>;
}
function messageFor(error: unknown): State {
  const message = error instanceof Error ? error.message : "";
  return /SESSAO_ENCERRADA/.test(message) ? "SESSÃO ENCERRADA" : /SESSAO_INVALIDA|Sessão inválida/.test(message) ? "SESSÃO EXPIRADA" : /ACESSO_REVOGADO/.test(message) ? "ACESSO REVOGADO" : /CONTEXTO_INATIVO/.test(message) ? "CONTEXTO INATIVO" : /CONTEXTO_INDISPONIVEL_PARA_SIMULACAO/.test(message) ? "CONTEXTO INDISPONÍVEL PARA SIMULAÇÃO" : "LABORATÓRIO INDISPONÍVEL";
}
