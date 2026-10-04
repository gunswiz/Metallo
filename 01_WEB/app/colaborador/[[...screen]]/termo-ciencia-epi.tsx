"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ScrollText, WifiOff } from "lucide-react";
import type { EpiAwareness3i } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./simples.module.css";

// Marco 3I/3J: termo de ciência dos deveres do trabalhador quanto ao EPI (NR-6, item 6.6.1).
// Marco 3J: deixou de ser um cartão. É a primeira tela de Meus EPIs e precisa ser lida até o fim e aceita
// para continuar. Aceito uma única vez pelo próprio funcionário; o texto e o hash vêm do servidor.
export const termDay = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function TermoCienciaEpi({ read, accept, children }: {
  read: () => Promise<EpiAwareness3i>;
  accept: (termSha256: string, idempotencyKey: string) => Promise<string>;
  children: (acceptedAt: string) => ReactNode;
}) {
  const { state, refresh } = usePersonalDetail(read);
  // Depois de aceito, a tela não volta a bloquear quando a lista é atualizada (foco, digital etc.).
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef<string | null>(null);
  const lock = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const known = state.status === "ready" ? state.data.accepted_at : null;
  const passed = acceptedAt ?? known;
  const check = useCallback(() => {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReachedEnd(true);
  }, []);
  // Texto curto (cabe sem rolar) já libera o botão antes de a tela aparecer.
  useLayoutEffect(() => { if (state.status === "ready" && !passed) check(); }, [state, passed, check]);
  if (passed) return <>{children(passed)}</>;
  async function send(term: EpiAwareness3i) {
    if (lock.current || !reachedEnd) return;
    lock.current = true; setBusy(true); setError("");
    try { setAcceptedAt(await accept(term.term_sha256, key.current ??= crypto.randomUUID())); }
    catch { setError(typeof navigator !== "undefined" && !navigator.onLine ?
      "Sem internet. O termo não foi registrado. Tente de novo." : "Não deu certo agora. Tente de novo em instantes."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (state.status === "loading") return <div className={styles.wait} role="status">Abrindo seus EPIs…</div>;
  if (state.status === "error") return <div className={styles.block} role="alert"><WifiOff aria-hidden="true" size={30}/>
    <h2>Não foi possível abrir agora</h2><p>Confira a internet e tente de novo.</p>
    <div className={styles.bigActions}><button type="button" className={styles.bigGo} onClick={refresh}>Tentar de novo</button></div></div>;
  return <section className={styles.term} aria-labelledby="epi-termo-heading" id="epi-termo">
    <span className={`${styles.tag} ${styles.tagInfo}`}><ScrollText aria-hidden="true" size={16}/> NR-6 · item 6.6.1</span>
    <h2 id="epi-termo-heading">Antes de ver seus EPIs, leia este termo</h2>
    <div className={styles.termText} ref={box} onScroll={check} tabIndex={0} aria-label="Texto do termo">{state.data.term_text}</div>
    {error && <p className={styles.fail} role="alert">{error}</p>}
    <button type="button" className={styles.bigOk} onClick={() => void send(state.data)} disabled={busy || !reachedEnd}>
      {busy ? "Registrando…" : "Li e concordo"}</button>
    {!reachedEnd && <p className={styles.hint}>Arraste o texto até o fim para liberar o botão.</p>}
  </section>;
}
