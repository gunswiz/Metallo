"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, HardHat, PackageCheck, WifiOff } from "lucide-react";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import { ConfirmarRecebimento, itemLine } from "./epi-assinatura-3f";
import { signatureRequest3f, type SignatureState3f } from "@/04_SERVICOS/assinatura-browser-3f";
import { TelaCheia } from "./tela-cheia";
import styles from "./simples.module.css";

type Respond = (groupId: string, action: "CONFIRMADO" | "DIVERGENCIA", deliveryId: string | null,
  category: string | null, details: string | null, key: string) => Promise<number>;
type Props = {
  read: () => Promise<PersonalDeliveryGroup3d[]>;
  // Usado somente para informar problema (DIVERGENCIA). Confirmar exige digital ou senha (Marco 3J).
  respond: Respond;
  confirmWithPassword?: (groupId: string, password: string, key: string) => Promise<void>;
  getAccessToken?: () => Promise<string>;
  // Aparelho do almoxarifado: sem digital do aparelho e saída automática após registrar.
  sharedDevice?: boolean;
  onConfirmed?: () => void;
  // "pendentes": o que a pessoa precisa fazer agora. "confirmadas": histórico (em Mais opções).
  view?: "pendentes" | "confirmadas";
};
const problems = { NAO_RECEBIDO: "Não recebi", TAMANHO: "Tamanho errado", QUANTIDADE: "Quantidade errada", OUTRO: "Outro problema" } as const;
type Problem = keyof typeof problems;
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
const isPending = (group: PersonalDeliveryGroup3d) => group.feedback_status === null || group.feedback_status === "RESOLVIDA" || group.feedback_status === "RECUSA";
const isWaiting = (group: PersonalDeliveryGroup3d) => group.feedback_status === "DIVERGENCIA" || group.feedback_status === "EM_ANALISE";

function InformarProblema({ group, respond, onSent, onClose }: { group: PersonalDeliveryGroup3d; respond: Respond; onSent: () => void; onClose: () => void }) {
  const [deliveryId, setDeliveryId] = useState(group.items.length === 1 ? group.items[0].delivery_id : "");
  const [problem, setProblem] = useState<Problem | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const key = useRef(crypto.randomUUID());
  const ready = Boolean(deliveryId && problem && (problem !== "OUTRO" || details.trim()));
  async function send() {
    if (!ready || busy) return;
    setBusy(true); setError("");
    try {
      // Sem texto, a própria escolha vira a descrição (ninguém precisa digitar).
      await respond(group.group_id, "DIVERGENCIA", deliveryId, problem, details.trim() || problems[problem as Problem], key.current);
      setSent(true); onSent();
    } catch {
      setError(typeof navigator !== "undefined" && !navigator.onLine ? "Sem internet. Nada foi enviado. Tente de novo." : "Não deu certo agora. Tente de novo em instantes.");
    } finally { setBusy(false); }
  }
  if (sent) return <TelaCheia title="Aviso enviado" onBack={onClose} backLabel="Fechar">
    <div className={styles.done} role="status"><CheckCircle2 aria-hidden="true" size={72}/><h2>Aviso enviado!</h2>
      <p>A Gestão vai verificar e responder. Nada foi cobrado de você.</p></div>
    <button type="button" className={styles.bigGo} onClick={onClose}>OK</button>
  </TelaCheia>;
  const item = group.items.find(row => row.delivery_id === deliveryId);
  return <TelaCheia title="Falta algo ou veio errado?" onBack={onClose} busy={busy}>
    {group.items.length > 1 && <div role="group" aria-label="Qual item?"><p className={styles.small}>1. Qual item?</p>
      <div className={styles.bigActions}>{group.items.map(row => <button key={row.delivery_id} type="button" className={styles.big}
        aria-pressed={deliveryId === row.delivery_id} onClick={() => setDeliveryId(row.delivery_id)}>{row.item_name}</button>)}</div></div>}
    {group.items.length === 1 && item && <ul className={styles.items}><li><HardHat aria-hidden="true" size={26}/><span>{item.item_name}<small>{itemLine(item)}</small></span></li></ul>}
    <div role="group" aria-label="O que aconteceu?"><p className={styles.small}>{group.items.length > 1 ? "2. " : ""}O que aconteceu?</p>
      <div className={styles.bigActions}>{(Object.entries(problems) as [Problem, string][]).map(([value, label]) =>
        <button key={value} type="button" className={styles.big} aria-pressed={problem === value} onClick={() => setProblem(value)}>{label}</button>)}</div></div>
    {problem && <label className={styles.field}>{problem === "OUTRO" ? "Explique o problema" : "Quer explicar? (não é obrigatório)"}
      <textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={240} rows={3}/></label>}
    {error && <p className={styles.fail} role="alert">{error}</p>}
    <button type="button" className={styles.bigGo} onClick={() => void send()} disabled={!ready || busy}>{busy ? "Enviando…" : "Enviar para a Gestão"}</button>
    <p className={styles.small}>A entrega original fica guardada. Avisar um problema não gera punição nem cobrança.</p>
  </TelaCheia>;
}

export function EpiRecebimento({ read, respond, confirmWithPassword, getAccessToken, sharedDevice = false, onConfirmed, view = "pendentes" }: Props) {
  const { state, refresh } = usePersonalDetail(read);
  const [confirming, setConfirming] = useState<PersonalDeliveryGroup3d | null>(null);
  const [reporting, setReporting] = useState<PersonalDeliveryGroup3d | null>(null);
  const [signed, setSigned] = useState<Set<string> | null | "erro">(null);
  useEffect(() => {
    if (view !== "confirmadas" || !getAccessToken) return;
    let active = true;
    void (async () => {
      try { const result = await signatureRequest3f<SignatureState3f>(await getAccessToken(), { action: "state" });
        if (active) setSigned(new Set(result.events.map(event => event.group_id))); }
      catch { if (active) setSigned("erro"); }
    })();
    return () => { active = false; };
  }, [view, getAccessToken]);
  const sheets = <>
    {confirming && <ConfirmarRecebimento group={confirming} getAccessToken={getAccessToken} sharedDevice={sharedDevice}
      confirmWithPassword={confirmWithPassword} onDone={() => { refresh(); onConfirmed?.(); }} onClose={() => { setConfirming(null); refresh(); }}/>}
    {reporting && <InformarProblema group={reporting} respond={respond} onSent={() => { refresh(); onConfirmed?.(); }} onClose={() => { setReporting(null); refresh(); }}/>}
  </>;
  if (state.status === "loading") return <>{view === "pendentes" && <p className={styles.wait} role="status">Procurando entregas…</p>}{sheets}</>;
  if (state.status === "error") return <><div className={styles.block} role="alert"><p><WifiOff aria-hidden="true" size={20}/> Não foi possível ver suas entregas agora.</p>
    <div className={styles.bigActions}><button type="button" className={styles.bigSoft} onClick={refresh}>Tentar de novo</button></div></div>{sheets}</>;
  if (view === "confirmadas") {
    const done = state.data.filter(group => group.feedback_status === "CONFIRMADO");
    return <section className={styles.block} aria-labelledby="entregas-confirmadas">
      <h2 id="entregas-confirmadas">Entregas já confirmadas</h2>
      {done.length === 0 ? <p>Nenhuma entrega confirmada ainda.</p> :
        <ul className={styles.rows}>{done.map(group => <li key={group.group_id} className={styles.row}>
          <span className={styles.rowIcon}><PackageCheck aria-hidden="true" size={24}/></span>
          <div className={styles.rowText}><strong>Entrega de {day(group.delivered_at)}</strong>
            <small>{group.items.map(item => item.item_name).join(", ")}</small></div>
          <span className={styles.rowChip}>{signed instanceof Set && signed.has(group.group_id) ? "Confirmado com a digital" :
            signed === "erro" ? "Confirmado · forma indisponível" : "Confirmado"}</span></li>)}</ul>}
    </section>;
  }
  const pending = state.data.filter(isPending);
  const waiting = state.data.filter(isWaiting);
  return <>
    {pending.length === 0 && waiting.length === 0 ? <p className={styles.ok} role="status"><CheckCircle2 aria-hidden="true" size={22}/> Nenhuma entrega para conferir.</p> : null}
    {pending.map(group => <section key={group.group_id} className={`${styles.block} ${styles.blockTodo}`} aria-labelledby={`entrega-${group.group_id}`}>
      <span className={styles.tag}>Para fazer agora</span>
      <h2 id={`entrega-${group.group_id}`}>Você recebeu estes EPIs?</h2>
      <p>Entrega de {day(group.delivered_at)}</p>
      {group.public_message && <p className={styles.wait}>Recado da Gestão: {group.public_message}</p>}
      <ul className={styles.items} aria-label="Itens desta entrega">{group.items.map(item => <li key={item.delivery_id}>
        <HardHat aria-hidden="true" size={26}/><span>{item.item_name}<small>{itemLine(item)}</small></span></li>)}</ul>
      <div className={styles.bigActions}>
        <button type="button" className={styles.bigOk} onClick={() => setConfirming(group)}>Recebi tudo</button>
        <button type="button" className={styles.big} onClick={() => setReporting(group)}>Falta algo ou veio errado</button>
      </div>
    </section>)}
    {waiting.map(group => <section key={group.group_id} className={styles.block} aria-labelledby={`aguardando-${group.group_id}`}>
      <span className={`${styles.tag} ${styles.tagInfo}`}>Aguardando a Gestão</span>
      <h2 id={`aguardando-${group.group_id}`}>Você avisou um problema</h2>
      <p>Entrega de {day(group.delivered_at)}: {group.items.map(item => item.item_name).join(", ")}. A Gestão vai responder aqui.</p>
    </section>)}
    {sheets}
  </>;
}
