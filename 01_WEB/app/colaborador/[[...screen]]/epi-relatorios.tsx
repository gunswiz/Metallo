"use client";

import { useEffect, useRef, useState } from "react";
import { buildEpiReport3ePdf, epiReportFilename } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf";
import { epiPrintedSupplies, projectEpiReport, reportDate, resolveEpiPeriod, type EpiReportPayload, type EpiReportType } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { usePersonalDetail } from "./use-personal-detail";
import styles from "./colaborador.module.css";

function PersonalReportContent({ read }: { read: () => Promise<EpiReportPayload> }) {
  const { state, refresh } = usePersonalDetail(read);
  const [type, setType] = useState<EpiReportType>("current");
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<"" | "Consultando registros…" | "Preparando PDF…">("");
  const [error, setError] = useState("");
  const blobUrl = useRef<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);
  if (state.status === "loading") return <p role="status">Consultando seus relatórios no laboratório…</p>;
  if (state.status === "error") return <div role="alert"><p>Não foi possível consultar seus relatórios agora.</p><button type="button" onClick={refresh}>Tentar novamente</button></div>;
  let report;
  try { report = projectEpiReport(state.data, type, resolveEpiPeriod({ preset, from, to }, new Date(state.data.generated_at))); }
  catch { report = null; }
  const supplies = report ? epiPrintedSupplies(report) : [];
  async function download() {
    setBusy("Consultando registros…"); setError("");
    try {
      // Nova leitura verifica a sessão e fornece report_id/horário de servidor próprios desta geração.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fresh = await Promise.race([read(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Consulta excedeu o tempo limite.")), 12000);
      })]).finally(() => { if (timer) clearTimeout(timer); });
      if (!active.current) return;
      setBusy("Preparando PDF…");
      const next = projectEpiReport(fresh, type, resolveEpiPeriod({ preset, from, to }, new Date(fresh.generated_at)));
      const logoResponse = await fetch("/metallo-logo.png", { credentials: "omit", redirect: "error", signal: AbortSignal.timeout(6000) });
      if (!logoResponse.ok) throw new Error("Logo indisponível.");
      const bytes = await buildEpiReport3ePdf(next, true, new Uint8Array(await logoResponse.arrayBuffer()));
      if (!active.current) return;
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      blobUrl.current = url;
      const link = document.createElement("a");
      link.href = url; link.download = epiReportFilename(next);
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => { URL.revokeObjectURL(url); if (blobUrl.current === url) blobUrl.current = null; }, 1000);
    } catch { if (active.current) setError("Não foi possível gerar o relatório agora. Verifique sua sessão e a conexão local."); }
    finally { if (active.current) setBusy(""); }
  }
  return <div>
    <p>Os documentos mostram somente seus registros. Entrega registrada e confirmação são fatos diferentes.</p>
    <p>O histórico impresso apresenta entregas e substituições. Solicitações, confirmações e divergências continuam nos registros do sistema.</p>
    <div className={styles.reportFilters}>
      <label>Documento<select value={type} onChange={event => setType(event.target.value as EpiReportType)}>
        <option value="current">Ficha atual</option><option value="history">Histórico</option></select></label>
      {type === "history" && <><label>Período<select value={preset} onChange={event => setPreset(event.target.value)}>
        <option value="all">Todo o histórico</option><option value="today">Hoje</option><option value="week">Esta semana</option>
        <option value="month">Este mês</option><option value="30days">Últimos 30 dias</option><option value="year">Este ano</option>
        <option value="custom">Datas informadas</option></select></label>
      {preset === "custom" && <><label>Data inicial<input type="date" lang="pt-BR" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>Data final<input type="date" lang="pt-BR" value={to} onChange={event => setTo(event.target.value)} /></label></>}</>}
    </div>
    {!report ? <p role="alert">Confira as datas informadas. A data inicial deve ser anterior ou igual à final.</p> : <>
      <p><strong>{type === "current" ? "EPIs ativos" : "Fornecimentos encontrados"}:</strong> {supplies.length}
        {type === "history" && <> · <strong>Período:</strong> {report.period.label}</>}</p>
      {supplies.length === 0 ? <p>{type === "current" ? "Nenhum EPI atribuído no momento." :
        "Nenhum evento de EPI encontrado no período selecionado."}</p> :
        <ol className={styles.epiHistory}>{supplies.map((row, index) => <li key={index}>
          <strong>{type === "current" ? row.item : row.title}</strong>
          <p>{reportDate(row.at)}{type === "history" && <> · {row.item}</>} · CA: {row.ca} · {row.quantity}</p>
          {row.variant && <p>Tamanho / variante: {row.variant}</p>}
          <p>Responsável pela entrega: {row.responsible}</p></li>)}</ol>}
      <button type="button" onClick={() => void download()} disabled={!!busy} aria-busy={!!busy} className={styles.primary}>
        {busy || (type === "current" ? "Baixar minha ficha em PDF" : "Baixar meu histórico em PDF")}
      </button>
    </>}
    {error && <p role="alert">{error}</p>}
    <p className={styles.epiFootnote}>SIMULAÇÃO SEM VALOR OFICIAL. O arquivo baixado fica sob sua guarda; não é assinatura digital.</p>
  </div>;
}
export function EpiRelatorios({ read }: { read: () => Promise<EpiReportPayload> }) {
  const [open, setOpen] = useState(false);
  return <section className={styles.personalCard} aria-labelledby="epi-relatorios-title">
    <div className={styles.epiSectionHead}><div><p className={styles.workLabel}>DOCUMENTOS PESSOAIS</p>
      <h2 id="epi-relatorios-title">Ficha e histórico em PDF</h2></div></div>
    {!open ? <button type="button" onClick={() => setOpen(true)} className={styles.primary}>Visualizar meus relatórios</button> :
      <PersonalReportContent read={read} />}
  </section>;
}
