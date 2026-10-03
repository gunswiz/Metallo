"use client";

import { useRef, useState } from "react";
import { ScrollText } from "lucide-react";
import type { EpiAwareness3i } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

// Marco 3I: termo de ciência dos deveres do trabalhador quanto ao EPI (NR-6, item 6.6.1).
// Aceito uma única vez pelo próprio funcionário; o texto e o hash vêm do servidor.
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function TermoCienciaEpi({ read, accept }: {
  read: () => Promise<EpiAwareness3i>;
  accept: (termSha256: string, idempotencyKey: string) => Promise<string>;
}) {
  const { state, refresh } = usePersonalDetail(read);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acceptedNow, setAcceptedNow] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  async function send(term: EpiAwareness3i) {
    if (lock.current || !agreed) return;
    lock.current = true; setBusy(true); setError("");
    try { setAcceptedNow(await accept(term.term_sha256, key.current ??= crypto.randomUUID())); refresh(); }
    catch { setError(typeof navigator !== "undefined" && !navigator.onLine ?
      "Sem conexão. O termo não foi registrado." : "Não foi possível registrar agora. Atualize e tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.personalCard} aria-labelledby="epi-termo-heading" id="epi-termo">
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>NR-6 · ITEM 6.6.1</p><h2 id="epi-termo-heading">Termo de ciência sobre EPI</h2></div><ScrollText aria-hidden="true" size={25}/></div>
    {state.status === "loading" ? <p role="status">Consultando o termo…</p> :
      state.status === "error" ? <div role="alert"><p>Termo temporariamente indisponível.</p><button type="button" onClick={refresh}>Tentar novamente</button></div> :
      (acceptedNow ?? state.data.accepted_at) ? <p className={styles.exchangeSuccess} role="status">Termo aceito em {day((acceptedNow ?? state.data.accepted_at)!)}.</p> :
      <div className={styles.exchangeForm}>
        <p>{state.data.term_text}</p>
        {error && <p className={styles.exchangeError} role="alert">{error}</p>}
        <label><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)}/> Li e estou ciente dos meus deveres quanto ao EPI.</label>
        <div className={styles.exchangeActions}>
          <button type="button" onClick={() => void send(state.data)} disabled={busy || !agreed}>{busy ? "Registrando…" : "Aceitar termo"}</button>
        </div>
      </div>}
  </section>;
}
