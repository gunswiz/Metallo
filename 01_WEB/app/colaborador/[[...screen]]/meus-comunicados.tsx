"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Megaphone, Pin } from "lucide-react";
import { nomePublico3h, type CommunicationDetail3h, type CommunicationSummary3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import styles from "./comunicados.module.css";
import portal from "./colaborador.module.css";

type Read = (unreadOnly: boolean, offset: number) => Promise<CommunicationSummary3h[]>;
type Open = (id: string) => Promise<CommunicationDetail3h>;
const demoDate = "2026-09-30T12:00:00+00:00";
const demoItems: CommunicationSummary3h[] = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Reunião de segurança da semana", audience: "ALL", audience_name: "Todos os funcionários", pinned: true, published_at: demoDate, updated_at: null, expires_at: null, version: 2, first_viewed_at: null },
  { id: "22222222-2222-4222-8222-222222222222", title: "Orientações para a equipe", audience: "TEAM", audience_name: "Equipe de teste", pinned: false, published_at: demoDate, updated_at: null, expires_at: null, version: 2, first_viewed_at: null },
];
function date(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)); }

export function ComunicadosAtalho({ read, demo, onOpen }: { read: Read; demo: boolean; onOpen: () => void }) {
  const [count, setCount] = useState<number | null>(demo ? 2 : null);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void read(true, 0).then(rows => { if (active) setCount(rows.length); }).catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, [read, demo]);
  return <button type="button" className={portal.card} onClick={onOpen} aria-label={`Abrir Comunicados${count ? `, ${count}${count === 20 ? " ou mais" : ""} não lidos` : ""}`}>
    <div className={portal.cardIcon}><Megaphone size={25}/></div><h3>Comunicados</h3>
    <p>{count === null ? "Avisos para você" : count === 0 ? "Tudo em dia" : `${count}${count === 20 ? "+" : ""} não lido${count === 1 ? "" : "s"}`}</p>
    <ArrowRight className={portal.cardArrow} size={21}/>
  </button>;
}

export function MeusComunicados({ read, open, demo }: { read: Read; open: Open; demo: boolean }) {
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [rows, setRows] = useState<CommunicationSummary3h[]>([]);
  const [selected, setSelected] = useState<CommunicationDetail3h | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async (nextFilter: "unread" | "all", offset = 0) => {
    const ticket = ++request.current;
    if (offset === 0) setRows([]);
    setBusy(true); setError("");
    try {
      const result = demo ? demoItems.filter(item => nextFilter === "all" || !item.first_viewed_at).slice(offset, offset + 20)
        : await read(nextFilter === "unread", offset);
      if (ticket !== request.current) return;
      setRows(previous => offset === 0 ? result : [...previous, ...result]);
      setHasMore(result.length === 20);
    } catch {
      if (ticket === request.current) setError("Não foi possível carregar os comunicados. Tente novamente.");
    } finally { if (ticket === request.current) setBusy(false); }
  }, [read, demo]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(filter); }, 0);
    return () => window.clearTimeout(timer);
  }, [filter, load]);
  useEffect(() => {
    const refresh = () => { setSelected(null); void load(filter); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [filter, load]);
  async function show(item: CommunicationSummary3h) {
    const ticket = ++request.current; setBusy(true); setError("");
    try {
      const detail = demo ? { ...item, message: "Mensagem de demonstração para avaliação visual, sem dados reais.", first_viewed_at: demoDate } : await open(item.id);
      if (ticket !== request.current) return;
      setSelected(detail);
      setRows(previous => previous.map(row => row.id === item.id ? { ...row, first_viewed_at: detail.first_viewed_at } : row));
      window.setTimeout(() => heading.current?.focus(), 0);
    } catch { if (ticket === request.current) setError("Este comunicado não está disponível para sua conta neste momento."); }
    finally { if (ticket === request.current) setBusy(false); }
  }
  return <section className={styles.layout} aria-label="Meus comunicados">
    <p className={styles.disclaimer}>Abrir um comunicado registra apenas visualização. Não representa assinatura, concordância ou ciência trabalhista formal.</p>
    {error && <div role="alert" className={portal.error}>{error}</div>}
    {selected ? <article className={styles.detail}>
      <button type="button" className={styles.back} onClick={() => { setSelected(null); void load(filter); }}><ArrowLeft size={18}/> Voltar aos comunicados</button>
      <div className={styles.badges}>{selected.pinned && <span><Pin size={15}/> Fixado</span>}</div>
      <h2 ref={heading} tabIndex={-1}>{selected.title}</h2>
      <p className={styles.meta}>{nomePublico3h(selected.audience, selected.audience_name)} · Publicado em {date(selected.published_at)}</p>
      {selected.updated_at && <p className={styles.meta}>Atualizado em {date(selected.updated_at)} · versão {selected.version}</p>}
      <div className={styles.message}>{selected.message}</div>
      <p className={styles.footnote}>Visualizado em {date(selected.first_viewed_at!)}. Este registro não é assinatura nem aceite.</p>
    </article> : <>
      <div className={styles.tabs} role="tablist" aria-label="Filtrar comunicados">
        <button type="button" role="tab" aria-selected={filter === "unread"} onClick={() => { setRows([]); setFilter("unread"); }}>Não lidos</button>
        <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => { setRows([]); setFilter("all"); }}>Todos</button>
      </div>
      {busy && !rows.length && <p role="status">Carregando comunicados…</p>}
      {!busy && !rows.length && !error && <div className={styles.empty}><Megaphone size={28}/><h2>{filter === "unread" ? "Nenhum comunicado novo" : "Nenhum comunicado disponível"}</h2><p>Os avisos destinados a você aparecerão aqui.</p></div>}
      <ul className={styles.list}>{rows.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void show(item)}>
        <span className={styles.badges}>{item.pinned && <span><Pin size={14}/> Fixado</span>}{!item.first_viewed_at && <span>Novo</span>}</span>
        <strong>{item.title}</strong><small>{nomePublico3h(item.audience, item.audience_name)} · {date(item.published_at)}</small>
        {item.updated_at && <small>Atualizado em {date(item.updated_at)}</small>}
        <ArrowRight className={styles.arrow} size={20}/>
      </button></li>)}</ul>
      {hasMore && <button type="button" className={styles.more} disabled={busy} onClick={() => void load(filter, rows.length)}>{busy ? "Carregando…" : "Mostrar mais"}</button>}
    </>}
  </section>;
}
