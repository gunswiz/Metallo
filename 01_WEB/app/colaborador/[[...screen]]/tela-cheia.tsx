"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { manterTelaDuranteAcao } from "@/03_FUNCOES_E_LOGICA/Ponto/marcacao-em-andamento";
import styles from "./simples.module.css";

// Marco 3J: uma tarefa por vez, ocupando a tela inteira (pensado para quem tem pouca prática com celular).
// Enquanto está aberta, a volta do foco (ex.: janela da digital) não esconde a página.
export function TelaCheia({ title, onBack, backLabel = "Voltar", children, busy = false }: {
  title: string; onBack: () => void; backLabel?: string; children: ReactNode; busy?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const back = useRef(onBack);
  useEffect(() => { back.current = onBack; });
  useEffect(() => {
    const end = manterTelaDuranteAcao();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    return () => { end(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    if (busy) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") back.current(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy]);
  return <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="tela-cheia-titulo">
    <div className={styles.sheetHead}>
      <button type="button" className={styles.back} onClick={onBack} disabled={busy}><ArrowLeft aria-hidden="true" size={24}/>{backLabel}</button>
    </div>
    <div className={styles.sheetBody}>
      <h2 id="tela-cheia-titulo" ref={heading} tabIndex={-1}>{title}</h2>
      {children}
    </div>
  </div>;
}
