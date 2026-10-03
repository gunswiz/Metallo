"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ClipboardList, RotateCcw } from "lucide-react";
import type { ExchangeableEpi, ExchangeCreateOutcome, ExchangeRequest } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

const reasons = { DESGASTE: "Desgaste", DANO: "Danificado", PERDA_EXTRAVIO: "Perda ou extravio", OUTRO: "Outro motivo" } as const;
type Reason = keyof typeof reasons;
const status = { SOLICITADA: "Solicitada", EM_ANALISE: "Em análise", APROVADA: "Aguardando entrega", RECUSADA: "Recusada", CANCELADA: "Cancelada" } as const;
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
// A chave distingue retries da mesma intenção; não concede acesso nem serve como segredo.
function newIntentKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const value = () => Math.floor(Math.random() * 16).toString(16);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, match => {
    const digit = Number.parseInt(value(), 16);
    return (match === "x" ? digit : (digit & 3) | 8).toString(16);
  });
}
function message(error: unknown) {
  const value = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (value.includes("exchange_request_already_open")) return "Já existe uma solicitação de troca em andamento para este EPI.";
  if (value.includes("epi_not_available")) return "Este EPI já não está ativo. Atualize a lista.";
  if (value.includes("portal_access_denied") || value.includes("Sessão")) return "Seu acesso mudou. Entre novamente para continuar.";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Não foi possível enviar a solicitação agora. Verifique sua conexão.";
  return "Não foi possível enviar a solicitação agora. Tente novamente.";
}

type Props = {
  readEligible: () => Promise<ExchangeableEpi[]>;
  readRequests: () => Promise<ExchangeRequest[]>;
  create: (deliveryId: string, reason: string, note: string, key: string) => Promise<ExchangeCreateOutcome>;
  cancel: (requestId: string) => Promise<void>;
};

export function EpiTroca({ readEligible, readRequests, create, cancel }: Props) {
  const read = useCallback(async () => {
    const [eligible, requests] = await Promise.all([readEligible(), readRequests()]);
    return { eligible, requests };
  }, [readEligible, readRequests]);
  const { state, refresh } = usePersonalDetail(read);
  const [selected, setSelected] = useState<ExchangeableEpi | null>(null);
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function choose(item: ExchangeableEpi) {
    setSelected(item); setReason(""); setNote(""); setConfirm(false); setNotice(""); setError("");
    keyRef.current = newIntentKey();
  }
  function dismiss() { setSelected(null); setConfirm(false); setError(""); keyRef.current = null; }
  async function send() {
    if (busyRef.current || !selected || !reason || (reason === "OUTRO" && !note.trim()) || note.length > 240) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const outcome = await create(selected.delivery_id, reason, note.trim(), keyRef.current ??= newIntentKey());
      dismiss();
      setNotice({ SOLICITADA: "Solicitação enviada.", EM_ANALISE: "Esta solicitação já está em análise.",
        APROVADA: "Esta solicitação já foi aprovada e aguarda entrega.", RECUSADA: "Esta solicitação já foi recusada.",
        CANCELADA: "Esta solicitação já foi cancelada." }[outcome.status]);
      refresh();
    } catch (failure) {
      setError(message(failure)); setConfirm(false); refresh();
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function cancelOwn(requestId: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await cancel(requestId); setNotice("Solicitação cancelada."); refresh(); }
    catch (failure) { setError(message(failure)); refresh(); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <section className={styles.personalCard} aria-labelledby="epi-troca-heading">
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>SOLICITAÇÃO DE TESTE</p><h2 id="epi-troca-heading">Solicitar troca</h2></div><RotateCcw aria-hidden="true" size={25}/></div>
    <p>A solicitação será analisada pela Gestão. Enviar ou aprovar um pedido não registra entrega, não altera estoque e não encerra o EPI atual.</p>
    {notice && <p className={styles.exchangeSuccess} role="status">{notice}</p>}
    {error && <p className={styles.exchangeError} role="alert"><AlertCircle size={18} aria-hidden="true"/>{error}</p>}
    {state.status === "loading" ? <p role="status">Consultando itens e solicitações…</p> : state.status === "error" ?
      <div role="alert"><p>Solicitações temporariamente indisponíveis.</p><button type="button" onClick={refresh}>Tentar novamente</button></div> : <>
      <h3>EPIs disponíveis para solicitar troca</h3>
      {state.data.eligible.length === 0 ? <p>Não há EPI ativo para solicitar troca.</p> :
        <ul className={styles.exchangeList}>{state.data.eligible.map(item => {
          const open = state.data.requests.some(request => request.source_delivery_id === item.delivery_id &&
            ["SOLICITADA", "EM_ANALISE", "APROVADA"].includes(request.request_status));
          return <li key={item.delivery_id}><div><strong>{item.item_name}</strong><small>{item.ca_number ? `CA ${item.ca_number} · ` : ""}Registrado em {day(item.recorded_at)}</small></div>
            {open ? <span>Troca em andamento</span> : <button type="button" onClick={() => choose(item)} disabled={busy}>Solicitar troca</button>}</li>;
        })}</ul>}
      {selected && <div className={styles.exchangeForm}>
        <h3>Solicitar troca: {selected.item_name}</h3>
        {!confirm ? <form onSubmit={event => { event.preventDefault(); setConfirm(true); }}>
          <fieldset><legend>Motivo da solicitação</legend>{(Object.entries(reasons) as [Reason, string][]).map(([key, label]) =>
            <label key={key}><input type="radio" name="exchange-reason" value={key} checked={reason === key} onChange={() => setReason(key)} required/>{label}</label>)}</fieldset>
          <label htmlFor="exchange-note">Observação {reason === "OUTRO" ? "(obrigatória)" : "(opcional)"}</label>
          <textarea id="exchange-note" value={note} onChange={event => setNote(event.target.value)} maxLength={240} required={reason === "OUTRO"} rows={3} placeholder="Descreva brevemente, se necessário"/>
          <small>{note.length}/240 caracteres. Perda ou extravio é somente um motivo operacional; não gera cobrança ou punição automática.</small>
          <div className={styles.exchangeActions}><button type="button" onClick={dismiss}>Cancelar</button><button type="submit" disabled={!reason || (reason === "OUTRO" && !note.trim())}>Continuar <ArrowRight size={16}/></button></div>
        </form> : <div role="group" aria-label="Confirmar solicitação"><p>Confirma o envio da troca de <strong>{selected.item_name}</strong> por <strong>{reasons[reason as Reason]}</strong>?</p>
          <div className={styles.exchangeActions}><button type="button" onClick={() => setConfirm(false)} disabled={busy}>Voltar</button><button type="button" onClick={() => void send()} disabled={busy}>{busy ? "Enviando…" : "Enviar solicitação"}</button></div></div>}
      </div>}
      <div id="epi-solicitacoes" className={styles.exchangeHistory}><h3><ClipboardList size={22} aria-hidden="true"/> Minhas solicitações de EPI</h3>
        {state.data.requests.length === 0 ? <p>Você ainda não tem solicitações de troca.</p> :
          <ul className={styles.exchangeList}>{state.data.requests.map(request => <li key={request.request_id}><div><strong>{request.item_name}</strong><small>{reasons[request.reason]} · Solicitada em {day(request.requested_at)}</small>
            <span className={styles.exchangeStatus}>Status: {status[request.request_status]}</span>
            {request.public_decision && <p>Motivo da decisão: {request.public_decision}</p>}
            <ol aria-label="Histórico da solicitação">{request.timeline.map((event, index) => <li key={index}>{status[event.status as keyof typeof status] ?? event.status} · {day(event.at)}{event.message ? ` · ${event.message}` : ""}</li>)}</ol></div>
            {request.request_status === "SOLICITADA" && <button type="button" disabled={busy} onClick={() => void cancelOwn(request.request_id)}>Cancelar solicitação</button>}</li>)}</ul>}
      </div>
    </>}
  </section>;
}
