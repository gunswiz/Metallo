"use client";

import { useEffect, useState } from "react";
import { HardHat, WifiOff } from "lucide-react";
import { friendlyPortalError, type PersonalWork } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import styles from "./colaborador.module.css";

type WorkState = { status: "loading" } | { status: "empty" } |
  { status: "ready"; work: PersonalWork } | { status: "error"; message: string };

export function MinhaObra({ demo, readWork }: { demo: boolean; readWork: () => Promise<PersonalWork | null> }) {
  const [state, setState] = useState<WorkState>(demo ? { status: "empty" } : { status: "loading" });
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let current = true;
    if (demo) return () => { current = false; };
    void readWork().then(work => {
      if (current) setState(work ? { status: "ready", work } : { status: "empty" });
    }).catch(error => {
      if (current) setState({ status: "error", message: friendlyPortalError(error) });
    });
    return () => { current = false; };
  }, [demo, readWork, request]);

  if (state.status === "loading") return <div role="status" className={styles.workStatus}>Consultando sua obra…</div>;
  if (state.status === "error") return <div role="alert" className={styles.workStatus}><WifiOff size={36}/><h2>Obra indisponível</h2><p>{state.message}</p><button className={styles.workRetry} onClick={() => { setState({ status: "loading" }); setRequest(value => value + 1); }}>Tentar novamente</button></div>;
  if (state.status === "empty") return <div className={styles.workStatus}><HardHat size={36}/><h2>Nenhuma obra atribuída no momento.</h2><p>Seu acesso pessoal continua disponível.</p></div>;
  return <div className={styles.workStatus}><HardHat size={36}/><span className={styles.workLabel}>OBRA ATUAL</span><h2>{state.work.work_name}</h2><p>Informação pessoal da sua conta.</p></div>;
}
