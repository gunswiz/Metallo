"use client";

import { useRef, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import type { ExchangeCreateOutcome, ExchangeRequest } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { TelaCheia } from "./tela-cheia";
import styles from "./simples.module.css";

// Marco 3J: pedir troca abre uma tela cheia no lugar (antes, o formulário aparecia no fim da página).
const reasons = { DESGASTE: "Está gasto", DANO: "Quebrou ou rasgou", PERDA_EXTRAVIO: "Perdi", OUTRO: "Outro motivo" } as const;
type Reason = keyof typeof reasons;
export const exchangeStatus = { SOLICITADA: "Enviado · aguardando a Gestão", EM_ANALISE: "A Gestão está analisando",
  APROVADA: "Aprovado · aguarde a entrega", RECUSADA: "Recusado", CANCELADA: "Cancelado" } as const;
export const openExchange = (request: ExchangeRequest) => ["SOLICITADA", "EM_ANALISE", "APROVADA"].includes(request.request_status);
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
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
  if (value.includes("exchange_request_already_open")) return "Já existe um pedido de troca para este EPI.";
  if (value.includes("epi_not_available")) return "Este EPI já não está ativo.";
  if (value.includes("portal_access_denied") || value.includes("Sessão")) return "Seu acesso mudou. Entre de novo para continuar.";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sem internet. O pedido não foi enviado. Tente de novo.";
  return "Não foi possível enviar o pedido agora. Tente de novo.";
}

export function PedirTroca({ item, create, onSent, onClose }: {
  item: { delivery_id: string; item_name: string };
  create: (deliveryId: string, reason: string, note: string, key: string) => Promise<ExchangeCreateOutcome>;
  onSent: () => void; onClose: () => void;
}) {
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<ExchangeCreateOutcome["status"] | null>(null);
  const key = useRef(newIntentKey());
  const busyRef = useRef(false);
  const ready = Boolean(reason && (reason !== "OUTRO" || note.trim()) && note.length <= 240);
  async function send() {
    if (busyRef.current || !ready) return;
    busyRef.current = true; setBusy(true); setError("");
    try { const result = await create(item.delivery_id, reason, note.trim(), key.current); setOutcome(result.status); onSent(); }
    catch (failure) { setError(message(failure)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  if (outcome) return <TelaCheia title="Pedido de troca" onBack={onClose} backLabel="Fechar">
    <div className={styles.done} role="status"><CheckCircle2 aria-hidden="true" size={72}/>
      <h2>{outcome === "SOLICITADA" ? "Pedido enviado!" : { EM_ANALISE: "Este pedido já está em análise.", APROVADA: "Este pedido já foi aprovado e aguarda entrega.",
        RECUSADA: "Este pedido já foi recusado.", CANCELADA: "Este pedido já foi cancelado." }[outcome]}</h2>
      {outcome === "SOLICITADA" && <p>A Gestão vai analisar. Você acompanha aqui em Meus EPIs.</p>}</div>
    <button type="button" className={styles.bigGo} onClick={onClose}>OK</button>
  </TelaCheia>;
  return <TelaCheia title={`Trocar ${item.item_name}`} onBack={onClose} busy={busy}>
    <div role="group" aria-label="Por que trocar?"><p>Por que trocar?</p>
      <div className={styles.bigActions}>{(Object.entries(reasons) as [Reason, string][]).map(([value, label]) =>
        <button key={value} type="button" className={styles.big} aria-pressed={reason === value} onClick={() => setReason(value)}>{label}</button>)}</div></div>
    {reason && <label className={styles.field}>{reason === "OUTRO" ? "Explique o motivo" : "Quer explicar? (não é obrigatório)"}
      <textarea value={note} onChange={event => setNote(event.target.value)} maxLength={240} rows={3}/></label>}
    {error && <p className={styles.fail} role="alert">{error}</p>}
    <button type="button" className={styles.bigGo} onClick={() => void send()} disabled={!ready || busy}><RotateCcw aria-hidden="true" size={24}/>{busy ? "Enviando…" : "Enviar pedido"}</button>
    <p className={styles.small}>Perder ou estragar não gera cobrança nem punição automática. A Gestão decide e avisa aqui.</p>
  </TelaCheia>;
}

export function PedidosTroca({ requests, cancel, onChanged, all = false }: {
  requests: ExchangeRequest[]; cancel?: (requestId: string) => Promise<void>; onChanged: () => void; all?: boolean;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const shown = all ? requests : requests.filter(openExchange);
  if (shown.length === 0 && !notice && !error) return all ? <section className={styles.block} aria-labelledby="pedidos-todos"><h2 id="pedidos-todos">Todos os pedidos de troca</h2><p>Você ainda não fez pedidos de troca.</p></section> : null;
  async function cancelOwn(requestId: string) {
    if (!cancel || busy) return;
    setBusy(true); setError("");
    try { await cancel(requestId); setAsking(null); setNotice("Pedido cancelado."); onChanged(); }
    catch (failure) { setError(message(failure)); onChanged(); }
    finally { setBusy(false); }
  }
  const id = all ? "pedidos-todos" : "pedidos-abertos";
  return <section className={styles.block} aria-labelledby={id}>
    <h2 id={id}>{all ? "Todos os pedidos de troca" : "Seus pedidos de troca"}</h2>
    {notice && <p className={styles.ok} role="status">{notice}</p>}
    {error && <p className={styles.fail} role="alert">{error}</p>}
    <ul className={styles.rows}>{shown.map(request => <li key={request.request_id} className={styles.row}>
      <span className={styles.rowIcon}><RotateCcw aria-hidden="true" size={22}/></span>
      <div className={styles.rowText}><strong>{request.item_name}</strong>
        <small>{exchangeStatus[request.request_status]} · pedido em {day(request.requested_at)}</small>
        {request.public_decision && <small>Resposta da Gestão: {request.public_decision}</small>}
        {all && request.timeline.length > 0 && <ol aria-label="Histórico do pedido" className={styles.small}>{request.timeline.map((event, index) =>
          <li key={index}>{exchangeStatus[event.status as keyof typeof exchangeStatus] ?? event.status} · {day(event.at)}{event.message ? ` · ${event.message}` : ""}</li>)}</ol>}
        {asking === request.request_id && <div className={styles.bigActions}>
          <button type="button" className={styles.bigGo} disabled={busy} onClick={() => void cancelOwn(request.request_id)}>{busy ? "Cancelando…" : "Sim, cancelar o pedido"}</button>
          <button type="button" className={styles.bigSoft} disabled={busy} onClick={() => setAsking(null)}>Não</button></div>}
      </div>
      {cancel && request.request_status === "SOLICITADA" && asking !== request.request_id &&
        <button type="button" className={styles.rowButton} onClick={() => { setNotice(""); setError(""); setAsking(request.request_id); }}>Cancelar pedido</button>}
    </li>)}</ul>
  </section>;
}
