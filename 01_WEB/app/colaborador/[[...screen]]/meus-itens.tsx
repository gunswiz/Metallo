"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck, Toolbox, WifiOff } from "lucide-react";
import type { PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

const status: Record<PersonalItem3g["status"], string> = { AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
  EM_USO: "Em uso", DANIFICADO: "Problema: danificado", EXTRAVIADO: "Problema: extraviado",
  DEVOLVIDO: "Devolvido", SUBSTITUIDO: "Substituído" };
const eventLabel: Record<string, string> = { CONFIRMED: "Recebimento confirmado", PROBLEM: "Problema informado",
  EXCHANGE_REQUESTED: "Troca solicitada", EXCHANGE_APPROVED: "Troca aprovada; entrega pendente",
  EXCHANGE_REFUSED: "Troca recusada", RETURNED: "Devolução registrada", REPLACED: "Substituição registrada" };
const reasonLabel: Record<string, string> = { WEAR: "Desgaste", DAMAGED: "Danificado", LOST: "Perda ou extravio", OTHER: "Outro" };
function day(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit",
  month: "2-digit", year: "numeric" }).format(new Date(value)); }

type Actions = {
  confirm?: (deliveryId: string, key: string) => Promise<number>;
  report?: (deliveryId: string, action: "PROBLEM" | "EXCHANGE_REQUESTED", category: string,
    note: string, key: string) => Promise<number>;
};
function ItemCard({ item, actions, refresh }: { item: PersonalItem3g; actions: Actions; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"PROBLEM" | "EXCHANGE_REQUESTED" | null>(null);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const attempts = useRef<Record<string, string>>({});
  async function confirm() {
    if (!actions.confirm || busy) return;
    setBusy(true); setError("");
    const key = attempts.current.confirm ??= crypto.randomUUID();
    try { await actions.confirm(item.delivery_id, key); delete attempts.current.confirm; refresh(); }
    catch { setError("Não foi possível confirmar. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actions.report || !mode || !category || busy) return;
    setBusy(true); setError("");
    const key = attempts.current.report ??= crypto.randomUUID();
    try { await actions.report(item.delivery_id, mode, category, note.trim(), key);
      delete attempts.current.report; setMode(null); setCategory(""); setNote(""); refresh(); }
    catch { setError("Não foi possível registrar. Confira o item e tente novamente."); }
    finally { setBusy(false); }
  }
  const closed = item.status === "DEVOLVIDO" || item.status === "SUBSTITUIDO";
  return <article className={styles.personalCard}>
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>{status[item.status]}</p><h2>{item.item_name}</h2></div><PackageCheck size={25} aria-hidden="true"/></div>
    <dl className={styles.epiFacts}><div><dt>Quantidade</dt><dd>{item.quantity} {item.unit}</dd></div>
      {item.variant && <div><dt>Medida / variante</dt><dd>{item.variant}</dd></div>}
      <div><dt>Entrega</dt><dd>{day(item.delivered_at)}</dd></div>
      <div><dt>Recebimento</dt><dd>{item.confirmed_at ? `Confirmado em ${day(item.confirmed_at)}` : "Pendente"}</dd></div>
    </dl>
    {!closed && !item.confirmed_at && actions.confirm && <button className={styles.itemAction3g} type="button" onClick={() => void confirm()} disabled={busy}>Confirmar recebimento</button>}
    {!closed && actions.report && <div className={styles.itemActions3g}>
      <button type="button" onClick={() => { setMode("PROBLEM"); setCategory(""); }} disabled={busy}>Informar problema</button>
      <button type="button" onClick={() => { setMode("EXCHANGE_REQUESTED"); setCategory(""); }} disabled={busy}>Solicitar troca</button>
    </div>}
    {mode && <form className={styles.itemForm3g} onSubmit={event => void submit(event)}><h3>{mode === "PROBLEM" ? "Informar problema" : "Solicitar troca"}</h3>
      <label>Motivo<select value={category} onChange={event => { setCategory(event.target.value); delete attempts.current.report; }} required>
        <option value="">Selecione</option>{mode === "EXCHANGE_REQUESTED" && <option value="WEAR">Desgaste</option>}
        <option value="DAMAGED">Danificado</option><option value="LOST">Perdido ou extraviado</option><option value="OTHER">Outro</option>
      </select></label>
      <label>Observação opcional<textarea value={note} onChange={event => { setNote(event.target.value); delete attempts.current.report; }} maxLength={240} rows={2}/></label>
      <div><button type="submit" disabled={busy || !category}>{busy ? "Registrando…" : "Enviar"}</button>
        <button type="button" onClick={() => { setMode(null); delete attempts.current.report; }} disabled={busy}>Cancelar</button></div>
    </form>}
    {error && <p className={styles.exchangeError} role="alert">{error}</p>}
    {item.events.length > 0 && <details className={styles.itemHistory3g}><summary>Ver eventos deste item</summary><ol>{item.events.map((event, index) =>
      <li key={`${event.occurred_at}-${index}`}>{day(event.occurred_at)} · {eventLabel[event.event_type] ?? event.event_type}
        {event.category ? ` · ${reasonLabel[event.category] ?? event.category}` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}</ol></details>}
  </article>;
}

export function MeusItens({ read, actions = {} }: { read: () => Promise<PersonalItem3g[]>; actions?: Actions }) {
  const { state, refresh } = usePersonalDetail(read);
  if (state.status === "loading") return <div className={styles.personalStatus} role="status">Consultando seus itens pessoais…</div>;
  if (state.status === "error") return <div className={styles.personalStatus} role="alert"><WifiOff size={32}/><h2>Itens indisponíveis</h2>
    <p>Não foi possível consultar o laboratório agora.</p><button type="button" onClick={refresh}>Tentar novamente</button></div>;
  const current = state.data.filter(item => item.status !== "DEVOLVIDO" && item.status !== "SUBSTITUIDO");
  const history = state.data.filter(item => item.status === "DEVOLVIDO" || item.status === "SUBSTITUIDO");
  return <div className={styles.epiLayout}>
    <section aria-labelledby="itens-atuais"><div className={styles.epiSectionHead}><h2 id="itens-atuais">Atuais</h2><span className={styles.epiCount}>{current.length}</span></div>
      {current.length === 0 ? <p className={styles.personalCard}>Nenhum item pessoal atribuído no momento.</p> :
        <div className={styles.itemGrid3g}>{current.map(item => <ItemCard key={item.delivery_id} item={item} actions={actions} refresh={refresh}/>)}</div>}
    </section>
    <section aria-labelledby="itens-historico"><div className={styles.epiSectionHead}><h2 id="itens-historico">Histórico</h2><span className={styles.epiCount}>{history.length}</span></div>
      {history.length === 0 ? <p>Nenhuma devolução ou substituição registrada.</p> :
        <div className={styles.itemGrid3g}>{history.map(item => <ItemCard key={item.delivery_id} item={item} actions={{}} refresh={refresh}/>)}</div>}
    </section>
    <p className={styles.epiFootnote}>SIMULAÇÃO SEM VALOR OFICIAL. Confirmação simples de recebimento, sem assinatura digital. Problemas e solicitações não encerram o item automaticamente.</p>
  </div>;
}

export function MeusItensAtalho({ read, demo, onOpen }: {
  read: () => Promise<PersonalItem3g[]>;
  demo: boolean;
  onOpen: () => void;
}) {
  const { state } = usePersonalDetail(read);
  const current = state.status === "ready" ? state.data.filter(item =>
    item.status !== "DEVOLVIDO" && item.status !== "SUBSTITUIDO") : [];
  const pending = current.filter(item => item.status === "AGUARDANDO_CONFIRMACAO").length;
  return <Link href="/colaborador/itens" className={`${styles.card} ${styles.itemsQuickCard}`}
    onClick={demo ? event => { event.preventDefault(); onOpen(); } : undefined}>
    <div className={styles.cardIcon}><Toolbox size={25} aria-hidden="true"/></div>
    <h3>Meus Itens Pessoais</h3>
    <div className={styles.itemsQuickSummary} aria-live="polite">
      {state.status === "loading" ? <span>Consultando seus itens…</span> :
        state.status === "error" ? <span>Resumo indisponível no momento</span> :
        <><span>{current.length} {current.length === 1 ? "item atual" : "itens atuais"}</span>
          {pending > 0 && <span className={styles.itemsQuickPending}>{pending} {pending === 1 ? "entrega aguardando confirmação" : "entregas aguardando confirmação"}</span>}</>}
    </div>
    <span className={styles.itemsQuickLink}>Ver itens <ArrowRight size={17} aria-hidden="true"/></span>
  </Link>;
}
