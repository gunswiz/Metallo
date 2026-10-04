"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, HardHat, WifiOff } from "lucide-react";
import type { EpiAwareness3i, ExchangeableEpi, ExchangeCreateOutcome, ExchangeRequest, PersonalDeliveryGroup3d, PersonalEpi } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import { EpiRecebimento } from "./epi-recebimento";
import { openExchange, PedidosTroca, PedirTroca } from "./epi-troca";
import { EpiRelatorios } from "./epi-relatorios";
import { termDay, TermoCienciaEpi } from "./termo-ciencia-epi";
import type { EpiReportPayload } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { usePersonalDetail } from "./use-personal-detail";
import { itemLine } from "./epi-assinatura-3f";
import styles from "./simples.module.css";

// Marco 3J — Meus EPIs simples (para quem tem pouca prática com celular):
// 1) termo obrigatório na primeira vez; 2) "Para fazer agora" no topo; 3) lista curta com "Pedir troca";
// 4) histórico, PDF e detalhes guardados em "Mais opções".
const outcome: Record<Exclude<PersonalEpi["current_status"], "active">, string> = {
  returned: "Devolvido", replaced: "Substituído", lost: "Registrado como perdido",
  damaged: "Registrado como danificado", consumed: "Encerrado como consumido",
};
const day = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

type ExchangeActions = {
  readEligible: () => Promise<ExchangeableEpi[]>;
  readRequests: () => Promise<ExchangeRequest[]>;
  create: (deliveryId: string, reason: string, note: string, key: string) => Promise<ExchangeCreateOutcome>;
  cancel: (requestId: string) => Promise<void>;
};
type Receiving = { read: () => Promise<PersonalDeliveryGroup3d[]>; getAccessToken?: () => Promise<string>; sharedDevice?: boolean; onConfirmed?: () => void;
  confirmWithPassword?: (groupId: string, password: string, key: string) => Promise<void>;
  respond: (groupId: string, action: "CONFIRMADO" | "DIVERGENCIA",
    deliveryId: string | null, category: string | null, details: string | null, key: string) => Promise<number> };

// Liga cada EPI ativo ao registro que permite pedir troca (mesmo nome, tamanho e horário de entrega).
function pairExchange(items: PersonalEpi[], eligible: ExchangeableEpi[]) {
  const free = [...eligible];
  return items.map(item => {
    const index = free.findIndex(row => row.item_name === item.item_name && (row.variant ?? null) === (item.variant ?? null) &&
      new Date(row.recorded_at).getTime() === new Date(item.delivered_at).getTime());
    return index < 0 ? null : free.splice(index, 1)[0];
  });
}

function Content({ readEpis, exchange, receiving, readReport, awareness, acceptedAt }: Parameters<typeof MeusEpis>[0] & { acceptedAt: string | null }) {
  const { state, refresh } = usePersonalDetail(readEpis);
  const readEligible = exchange?.readEligible, readRequests = exchange?.readRequests;
  const readExchange = useCallback(async () => {
    if (!readEligible || !readRequests) return null;
    const [eligible, requests] = await Promise.all([readEligible(), readRequests()]);
    return { eligible, requests };
  }, [readEligible, readRequests]);
  const trade = usePersonalDetail(readExchange);
  const [trading, setTrading] = useState<ExchangeableEpi | null>(null);
  const [more, setMore] = useState(false);
  const exchangeData = trade.state.status === "ready" ? trade.state.data : null;
  const current = state.status === "ready" ? state.data.filter(item => item.current_status === "active") : [];
  const history = state.status === "ready" ? state.data.filter(item => item.current_status !== "active") : [];
  const pairs = exchangeData ? pairExchange(current, exchangeData.eligible) : current.map(() => null);
  const afterChange = () => { trade.refresh(); };
  let list: ReactNode;
  if (state.status === "loading") list = <p className={styles.wait} role="status">Consultando seus EPIs…</p>;
  else if (state.status === "error") list = <div role="alert"><p><WifiOff aria-hidden="true" size={20}/> Dados de EPIs temporariamente indisponíveis.</p>
    <div className={styles.bigActions}><button type="button" className={styles.bigSoft} onClick={refresh}>Tentar novamente</button></div></div>;
  else if (current.length === 0) list = <p>Nenhum EPI com você no momento.</p>;
  else list = <ul className={styles.rows}>{current.map((item, index) => {
    const pair = pairs[index];
    const open = pair && exchangeData?.requests.some(request => request.source_delivery_id === pair.delivery_id && openExchange(request));
    return <li key={index} className={styles.row}>
      <span className={styles.rowIcon}><HardHat aria-hidden="true" size={24}/></span>
      <div className={styles.rowText}><strong>{item.item_name}</strong><small>{itemLine(item)} · desde {day(item.delivered_at)}</small></div>
      {pair && exchange && (open ? <span className={styles.rowChip}>Troca pedida</span> :
        <button type="button" className={styles.rowButton} aria-label={`Pedir troca de ${item.item_name}`} onClick={() => setTrading(pair)}>Pedir troca</button>)}
    </li>;
  })}</ul>;
  return <div className={styles.page}>
    {receiving && <EpiRecebimento {...receiving}/>}
    {exchange && exchangeData && <PedidosTroca requests={exchangeData.requests} cancel={exchange.cancel} onChanged={afterChange}/>}
    <section className={styles.block} aria-labelledby="epis-atuais">
      <h2 id="epis-atuais">EPIs com você{state.status === "ready" ? ` (${current.length})` : ""}</h2>
      {list}
      {exchange && trade.state.status === "error" && <p className={styles.small} role="status">Pedidos de troca indisponíveis agora. <button type="button" className={styles.rowButton} onClick={trade.refresh}>Tentar novamente</button></p>}
    </section>
    <div className={styles.more}>
      <button type="button" className={styles.moreToggle} aria-expanded={more} onClick={() => setMore(value => !value)}>
        Mais opções{more ? <ChevronUp aria-hidden="true"/> : <ChevronDown aria-hidden="true"/>}</button>
      {more && <div className={styles.moreBody}>
        <section className={styles.block} aria-labelledby="epis-historico"><h2 id="epis-historico">EPIs que já devolvi ou troquei</h2>
          {state.status !== "ready" ? <p>Consultando…</p> : history.length === 0 ? <p>Nenhuma entrega encerrada no histórico.</p> :
            <ul className={styles.rows}>{history.map((item, index) => <li key={index} className={styles.row}>
              <div className={styles.rowText}><strong>{item.item_name}</strong>
                <small>{outcome[item.current_status as Exclude<PersonalEpi["current_status"], "active">]}{item.closed_at ? ` em ${day(item.closed_at)}` : ""} · recebido em {day(item.delivered_at)}</small></div></li>)}</ul>}
        </section>
        {receiving && <EpiRecebimento {...receiving} view="confirmadas"/>}
        {exchange && exchangeData && <PedidosTroca requests={exchangeData.requests} onChanged={afterChange} all/>}
        {readReport && <EpiRelatorios read={readReport} readAwareness={awareness?.read}/>}
        {acceptedAt && <p className={styles.small}>Termo de ciência sobre EPI (NR-6) aceito em {termDay(acceptedAt)}.</p>}
      </div>}
    </div>
    {trading && exchange && <PedirTroca item={trading} create={exchange.create} onSent={afterChange} onClose={() => { setTrading(null); afterChange(); }}/>}
  </div>;
}

export function MeusEpis(props: { readEpis: () => Promise<PersonalEpi[]>; exchange?: ExchangeActions;
  awareness?: { read: () => Promise<EpiAwareness3i>; accept: (termSha256: string, idempotencyKey: string) => Promise<string> };
  readReport?: () => Promise<EpiReportPayload>;
  receiving?: Receiving }) {
  if (!props.awareness) return <Content {...props} acceptedAt={null}/>;
  return <TermoCienciaEpi read={props.awareness.read} accept={props.awareness.accept}>{acceptedAt => <Content {...props} acceptedAt={acceptedAt}/>}</TermoCienciaEpi>;
}
