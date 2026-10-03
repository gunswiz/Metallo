"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import type { PersonalDeliveryGroup3d } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import type { PersonalItem3g } from "@/03_FUNCOES_E_LOGICA/ItensPessoais/contrato-3g";
import type { CommunicationSummary3h } from "@/03_FUNCOES_E_LOGICA/Comunicados/contrato-3h";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

type Sources = {
  items: () => Promise<PersonalItem3g[]>;
  deliveries?: () => Promise<PersonalDeliveryGroup3d[]>;
  communications: (unread: boolean, offset: number) => Promise<CommunicationSummary3h[]>;
};
// Somente resumos de consultas pessoais existentes; nenhum estado é criado ou alterado.
export function PendenciasColaborador({ items, deliveries, communications }: Sources) {
  const sources = useRef({ items, deliveries, communications });
  useEffect(() => { sources.current = { items, deliveries, communications }; }, [items, deliveries, communications]);
  const read = useCallback(async () => {
    const results = await Promise.allSettled([sources.current.items(), sources.current.deliveries?.() ?? Promise.resolve([]), sources.current.communications(true, 0)]);
    const pending: { href: string; label: string }[] = [];
    const personalItems = results[0], epiGroups = results[1], notices = results[2];
    if (personalItems.status === "fulfilled") {
      const count = personalItems.value.filter(item => item.status === "AGUARDANDO_CONFIRMACAO").length;
      if (count) pending.push({ href: "/colaborador/itens", label: `${count} ${count === 1 ? "item pessoal aguardando confirmação" : "itens pessoais aguardando confirmação"}` });
    }
    if (epiGroups.status === "fulfilled") {
      const count = epiGroups.value.filter(group => group.feedback_status === null).length;
      if (count) pending.push({ href: "/colaborador/epis#epi-recebimento-heading", label: `${count} ${count === 1 ? "entrega de EPI aguardando confirmação" : "entregas de EPI aguardando confirmação"}` });
    }
    if (notices.status === "fulfilled" && notices.value.length) {
      const count = notices.value.length;
      pending.push({ href: "/colaborador/comunicados", label: `${count}${count === 20 ? "+" : ""} ${count === 1 ? "comunicado não lido" : "comunicados não lidos"}` });
    }
    return { pending, incomplete: results.some(result => result.status === "rejected") };
  }, []);
  const { state, refresh } = usePersonalDetail(read);
  return <section className={styles.pendingSummary} aria-labelledby="pendencias-title"><h2 id="pendencias-title"><Bell size={19} aria-hidden="true"/>Pendências</h2>
    {state.status === "loading" ? <p role="status">Consultando suas pendências…</p> : state.status === "error" ? <p>Não foi possível consultar as pendências. <button type="button" onClick={refresh}>Tentar novamente</button></p> : <>
      {state.data.pending.length > 0 ? <ul>{state.data.pending.map(item => <li key={item.href}><Link href={item.href}><span>{item.label}</span><ArrowRight size={18} aria-hidden="true"/></Link></li>)}</ul> : !state.data.incomplete && <p>Nenhuma pendência no momento.</p>}
      {state.data.incomplete && <p>Algumas pendências não puderam ser consultadas. <button type="button" onClick={refresh}>Tentar novamente</button></p>}
    </>}
  </section>;
}
