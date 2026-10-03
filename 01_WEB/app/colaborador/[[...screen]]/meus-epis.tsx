"use client";

import { HardHat, PackageCheck, WifiOff } from "lucide-react";
import type { ExchangeableEpi, ExchangeCreateOutcome, ExchangeRequest, PersonalDeliveryGroup3d, PersonalEpi } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { EpiRecebimento } from "./epi-recebimento";
import { EpiTroca } from "./epi-troca";
import { EpiRelatorios } from "./epi-relatorios";
import type { EpiReportPayload } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

const reason: Record<PersonalEpi["delivery_reason"], string> = {
  initial: "Entrega inicial", replacement: "Reposição", additional: "Entrega adicional",
};
const outcome: Record<Exclude<PersonalEpi["current_status"], "active">, string> = {
  returned: "Devolvido", replaced: "Substituído", lost: "Registrado como perdido",
  damaged: "Registrado como danificado", consumed: "Encerrado como consumido",
};
function day(value: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
function quantity(value: number, unit: string) {
  if (unit === "par") return `${value} ${value === 1 ? "par" : "pares"}`;
  if (unit === "un") return `${value} ${value === 1 ? "unidade" : "unidades"}`;
  return `${value} ${unit}`;
}

function EpiFacts({ item, historical }: { item: PersonalEpi; historical: boolean }) {
  return <dl className={styles.epiFacts}>
    <div><dt>Quantidade</dt><dd>{quantity(item.quantity, item.unit)}</dd></div>
    {item.ca_number?.trim() && <div><dt>CA registrado</dt><dd>{item.ca_number}</dd></div>}
    {item.variant?.trim() && <div><dt>Tamanho / variante</dt><dd>{item.variant}</dd></div>}
    <div><dt>Registrado em</dt><dd>{day(item.delivered_at)}</dd></div>
    {historical && item.closed_at && <div><dt>Encerrado em</dt><dd>{day(item.closed_at)}</dd></div>}
  </dl>;
}

type ExchangeActions = {
  readEligible: () => Promise<ExchangeableEpi[]>;
  readRequests: () => Promise<ExchangeRequest[]>;
  create: (deliveryId: string, reason: string, note: string, key: string) => Promise<ExchangeCreateOutcome>;
  cancel: (requestId: string) => Promise<void>;
};
export function MeusEpis({ readEpis, exchange, receiving, readReport }: { readEpis: () => Promise<PersonalEpi[]>; exchange?: ExchangeActions;
  readReport?: () => Promise<EpiReportPayload>;
  receiving?: { read: () => Promise<PersonalDeliveryGroup3d[]>; getAccessToken?: () => Promise<string>;
    respond: (groupId: string, action: "CONFIRMADO" | "DIVERGENCIA",
    deliveryId: string | null, category: string | null, details: string | null, key: string) => Promise<number> } }) {
  const { state, refresh } = usePersonalDetail(readEpis);
  if (state.status === "loading") return <div className={styles.personalStatus} role="status">Consultando seus EPIs no laboratório…</div>;
  if (state.status === "error") return <div className={styles.personalStatus} role="alert"><WifiOff size={32}/><h2>EPIs indisponíveis</h2><p>Dados de EPIs temporariamente indisponíveis.</p><button type="button" onClick={refresh}>Tentar novamente</button></div>;
  const current = state.data.filter(item => item.current_status === "active");
  const history = state.data.filter(item => item.current_status !== "active");
  return <div className={styles.epiLayout}>
    <section className={styles.personalCard} aria-labelledby="epis-atuais">
      <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>CONSULTA PESSOAL</p><h2 id="epis-atuais">Registros ativos</h2></div><span className={styles.epiCount}>{current.length}</span></div>
      {current.length === 0 ? <div className={styles.epiEmpty}><HardHat size={32}/><p>Nenhuma entrega ativa registrada no momento.</p></div> :
        <ul className={styles.epiGrid}>{current.map((item, index) => <li className={styles.epiItem} key={index}><span className={styles.epiItemIcon}><HardHat size={24}/></span><div><span className={styles.epiState}>Ativo no registro</span><h3>{item.item_name}</h3><EpiFacts item={item} historical={false}/></div></li>)}</ul>}
    </section>
    {receiving && <EpiRecebimento {...receiving}/>}
    {exchange && <EpiTroca {...exchange}/>}
    {readReport && <EpiRelatorios read={readReport}/>}
    <section className={styles.personalCard} aria-labelledby="epis-historico"><div className={styles.epiSectionHead}><div><p className={styles.workLabel}>ENTREGAS ANTERIORES</p><h2 id="epis-historico">Histórico</h2></div><PackageCheck aria-hidden="true" size={25}/></div>
      {history.length === 0 ? <p>Nenhuma entrega encerrada no histórico.</p> :
        <ul className={styles.epiHistory}>{history.map((item, index) => <li key={index}><div className={styles.epiHistoryHeading}><h3>{item.item_name}</h3><span>{outcome[item.current_status as Exclude<PersonalEpi["current_status"], "active">]}</span></div><p>{reason[item.delivery_reason]}</p><EpiFacts item={item} historical/></li>)}</ul>}
    </section>
    <p className={styles.epiFootnote}>Consulta de teste. Registros ativos indicam entrega lançada, mesmo quando a confirmação ainda está pendente; o estado de recebimento aparece acima. Entregas anteriores ao 3D ainda podem refletir o catálogo atual. Nenhum lançamento representa operação real da empresa.</p>
  </div>;
}
