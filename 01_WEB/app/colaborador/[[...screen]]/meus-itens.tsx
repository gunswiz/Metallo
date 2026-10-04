"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Toolbox, WifiOff } from "lucide-react";
import type { PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";
import simple from "./simples.module.css";
import { TelaCheia } from "./tela-cheia";

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
const closedStatus = (item: PersonalItem3g) => item.status === "DEVOLVIDO" || item.status === "SUBSTITUIDO";
const line = (item: PersonalItem3g) => [`${item.quantity} ${item.unit}`, item.variant ?? ""].filter(Boolean).join(" · ");

// Marco 3J: pedir troca ou avisar problema numa tela cheia, com motivos em botões grandes.
function ItemSheet({ item, report, onSent, onClose }: { item: PersonalItem3g; report: NonNullable<Actions["report"]>; onSent: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<"PROBLEM" | "EXCHANGE_REQUESTED" | null>(null);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const key = useRef<string | null>(null);
  const options = mode === "EXCHANGE_REQUESTED" ? { WEAR: "Está gasto", DAMAGED: "Quebrou ou estragou", LOST: "Perdi", OTHER: "Outro motivo" } :
    { DAMAGED: "Quebrou ou estragou", LOST: "Perdi", OTHER: "Outro problema" };
  async function send() {
    if (!mode || !category || busy || (category === "OTHER" && !note.trim())) return;
    setBusy(true); setError("");
    try { await report(item.delivery_id, mode, category, note.trim(), key.current ??= crypto.randomUUID()); key.current = null; setSent(true); onSent(); }
    catch { setError("Não deu certo agora. Tente de novo."); }
    finally { setBusy(false); }
  }
  if (sent) return <TelaCheia title={mode === "EXCHANGE_REQUESTED" ? "Pedido enviado" : "Aviso enviado"} onBack={onClose} backLabel="Fechar">
    <div className={simple.done} role="status"><CheckCircle2 aria-hidden="true" size={72}/><h2>{mode === "EXCHANGE_REQUESTED" ? "Pedido enviado!" : "Aviso enviado!"}</h2>
      <p>A Gestão vai analisar. O item continua com você até a Gestão registrar a troca ou a devolução.</p></div>
    <button type="button" className={simple.bigGo} onClick={onClose}>OK</button>
  </TelaCheia>;
  return <TelaCheia title={item.item_name} onBack={onClose} busy={busy}>
    <div role="group" aria-label="O que você precisa?"><p>O que você precisa?</p><div className={simple.bigActions}>
      <button type="button" className={simple.big} aria-pressed={mode === "EXCHANGE_REQUESTED"} onClick={() => { setMode("EXCHANGE_REQUESTED"); setCategory(""); key.current = null; }}>Pedir troca</button>
      <button type="button" className={simple.big} aria-pressed={mode === "PROBLEM"} onClick={() => { setMode("PROBLEM"); setCategory(""); key.current = null; }}>Avisar um problema</button>
    </div></div>
    {mode && <div role="group" aria-label="Motivo"><p>Por quê?</p><div className={simple.bigActions}>{Object.entries(options).map(([value, label]) =>
      <button key={value} type="button" className={simple.big} aria-pressed={category === value} onClick={() => { setCategory(value); key.current = null; }}>{label}</button>)}</div></div>}
    {category && <label className={simple.field}>{category === "OTHER" ? "Explique" : "Quer explicar? (não é obrigatório)"}
      <textarea value={note} onChange={event => { setNote(event.target.value); key.current = null; }} maxLength={240} rows={3}/></label>}
    {error && <p className={simple.fail} role="alert">{error}</p>}
    <button type="button" className={simple.bigGo} onClick={() => void send()} disabled={busy || !mode || !category || (category === "OTHER" && !note.trim())}>{busy ? "Enviando…" : "Enviar"}</button>
  </TelaCheia>;
}

export function MeusItens({ read, actions = {} }: { read: () => Promise<PersonalItem3g[]>; actions?: Actions }) {
  const { state, refresh } = usePersonalDetail(read);
  const [sheet, setSheet] = useState<PersonalItem3g | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const confirmKeys = useRef<Record<string, string>>({});
  const lock = useRef(false);
  async function confirm(item: PersonalItem3g) {
    if (!actions.confirm || lock.current) return;
    lock.current = true; setBusy(item.delivery_id); setError("");
    // Repetir após falha usa a mesma chave até dar certo (sem duplicar no servidor).
    const key = confirmKeys.current[item.delivery_id] ??= crypto.randomUUID();
    try { await actions.confirm(item.delivery_id, key); delete confirmKeys.current[item.delivery_id]; refresh(); }
    catch { setError("Não foi possível confirmar. Tente de novo."); }
    finally { lock.current = false; setBusy(null); }
  }
  const sheetNode = sheet && actions.report ? <ItemSheet item={sheet} report={actions.report} onSent={refresh} onClose={() => { setSheet(null); refresh(); }}/> : null;
  if (state.status === "loading") return <><div className={simple.wait} role="status">Consultando seus itens pessoais…</div>{sheetNode}</>;
  if (state.status === "error") return <><div className={simple.block} role="alert"><WifiOff size={30} aria-hidden="true"/><h2>Itens indisponíveis</h2>
    <p>Não foi possível consultar agora.</p><div className={simple.bigActions}><button type="button" className={simple.bigSoft} onClick={refresh}>Tentar novamente</button></div></div>{sheetNode}</>;
  const pending = state.data.filter(item => item.status === "AGUARDANDO_CONFIRMACAO");
  const current = state.data.filter(item => !closedStatus(item) && item.status !== "AGUARDANDO_CONFIRMACAO");
  const history = state.data.filter(closedStatus);
  return <div className={simple.page}>
    {error && <p className={simple.fail} role="alert">{error}</p>}
    {pending.map(item => <section key={item.delivery_id} className={`${simple.block} ${simple.blockTodo}`} aria-labelledby={`item-${item.delivery_id}`}>
      <span className={simple.tag}>Para fazer agora</span>
      <h2 id={`item-${item.delivery_id}`}>Você recebeu este item?</h2>
      <ul className={simple.items}><li><Toolbox aria-hidden="true" size={26}/><span>{item.item_name}<small>{line(item)} · entregue em {day(item.delivered_at)}</small></span></li></ul>
      <div className={simple.bigActions}>
        {actions.confirm && <button type="button" className={simple.bigOk} onClick={() => void confirm(item)} disabled={busy !== null}>{busy === item.delivery_id ? "Confirmando…" : "Recebi"}</button>}
        {actions.report && <button type="button" className={simple.big} onClick={() => setSheet(item)} disabled={busy !== null}>Tem problema</button>}
      </div>
    </section>)}
    <section className={simple.block} aria-labelledby="itens-atuais">
      <h2 id="itens-atuais">Itens com você ({current.length})</h2>
      {current.length === 0 ? <p>Nenhum item pessoal com você no momento.</p> :
        <ul className={simple.rows}>{current.map(item => <li key={item.delivery_id} className={simple.row}>
          <span className={simple.rowIcon}><Toolbox aria-hidden="true" size={22}/></span>
          <div className={simple.rowText}><strong>{item.item_name}</strong><small>{line(item)} · desde {day(item.delivered_at)}</small>
            {item.status !== "EM_USO" && <small>{status[item.status]}</small>}</div>
          {actions.report && <button type="button" className={simple.rowButton} aria-label={`Trocar ou avisar problema: ${item.item_name}`} onClick={() => setSheet(item)}>Trocar / avisar</button>}
        </li>)}</ul>}
    </section>
    <div className={simple.more}>
      <button type="button" className={simple.moreToggle} aria-expanded={more} onClick={() => setMore(value => !value)}>
        Mais opções{more ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}</button>
      {more && <div className={simple.moreBody}>
        <section className={simple.block} aria-labelledby="itens-historico"><h2 id="itens-historico">Itens que já devolvi ou troquei</h2>
          {history.length === 0 ? <p>Nenhuma devolução ou substituição registrada.</p> :
            <ul className={simple.rows}>{history.map(item => <li key={item.delivery_id} className={simple.row}><div className={simple.rowText}>
              <strong>{item.item_name}</strong><small>{status[item.status]} · entregue em {day(item.delivered_at)}</small></div></li>)}</ul>}
        </section>
        <section className={simple.block} aria-labelledby="itens-eventos"><h2 id="itens-eventos">O que aconteceu com cada item</h2>
          {state.data.every(item => item.events.length === 0) ? <p>Nenhum evento registrado.</p> :
            state.data.filter(item => item.events.length > 0).map(item => <div key={item.delivery_id}><strong>{item.item_name}</strong>
              <ol className={simple.small}>{item.events.map((event, index) => <li key={`${event.occurred_at}-${index}`}>{day(event.occurred_at)} · {eventLabel[event.event_type] ?? event.event_type}
                {event.category ? ` · ${reasonLabel[event.category] ?? event.category}` : ""}{event.note ? ` · ${event.note}` : ""}</li>)}</ol></div>)}
        </section>
        <p className={simple.small}>SIMULAÇÃO SEM VALOR OFICIAL. Confirmação simples de recebimento, sem assinatura digital. Problemas e pedidos não encerram o item automaticamente.</p>
      </div>}
    </div>
    {sheetNode}
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
