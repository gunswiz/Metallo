"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { recordsRequest, recordPage, type AnyRecord as PersonalRecord, type RecordFilter } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
import styles from "./colaborador.module.css";
function message(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return /SEM_REGISTROS_48H/.test(code) ? "Nenhuma marcação nas últimas 48 horas. Não foi gerado arquivo." : /PERIODO_INVALIDO/.test(code) ? "Escolha um período válido, de até 366 dias." : /SESSAO|REVOGAD|INATIVO|AUTORIZAD/.test(code) ? "Acesso encerrado. Entre novamente com uma conta ativa." : /EXTRACAO_MUITO_EXTENSA/.test(code) ? "A extração excede o limite de 500 recibos. Nenhum pacote parcial foi gerado." : "Não foi possível consultar os registros. Tente novamente quando estiver online.";
}
export function MeusRegistros({ getToken, revision = 0, presentation = "legacy" }: { getToken: () => Promise<string>; revision?: number; presentation?: "legacy" | "history" | "receipts" | "today" }) {
  const [filter, setFilter] = useState<RecordFilter>({ period: presentation === "receipts" ? "48h" : "today" }), [offset, setOffset] = useState(0);
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [events, setEvents] = useState<PersonalRecord[]>([]), [more, setMore] = useState(false), [selected, setSelected] = useState<PersonalRecord | null>(null);
  const [status, setStatus] = useState(""), [loading, setLoading] = useState(true), [downloading, setDownloading] = useState(false);
  const alive = useRef(false), version = useRef(0), downloadLock = useRef(false), downloadController = useRef<AbortController | null>(null);
  const tokenProvider = useRef(getToken);
  useEffect(() => { tokenProvider.current = getToken; }, [getToken]);
  const receiptHeading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { if (selected) receiptHeading.current?.focus(); }, [selected]);
  const invalidateReads = useCallback(() => { version.current += 1; }, []);
  const load = useCallback(async (signal: AbortSignal) => {
    const id = ++version.current;
    try {
      const response = await recordsRequest("/list", await tokenProvider.current(), { method: "POST", body: JSON.stringify({ ...filter, offset }), signal });
      const page = recordPage.parse(await response.json());
      if (alive.current && id === version.current) { setEvents(page.events); setMore(page.has_more); setStatus(""); setLoading(false); }
    } catch (error) { if (alive.current && !signal.aborted && id === version.current) { setEvents([]); setSelected(null); setMore(false); setStatus(message(error)); setLoading(false); } }
  }, [filter, offset]);
  useEffect(() => {
    alive.current = true; const controller = new AbortController();
    const first = setTimeout(() => { setLoading(true); setSelected(null); void load(controller.signal); }, 0);
    return () => { alive.current = false; invalidateReads(); controller.abort(); downloadController.current?.abort(); clearTimeout(first); };
  }, [load, revision, invalidateReads]);
  async function download(event?: PersonalRecord) {
    if (downloadLock.current) return;
    downloadLock.current = true; setDownloading(true); setStatus("");
    const controller = new AbortController(); downloadController.current = controller;
    try {
      const response = await recordsRequest(event ? `/receipt/${event.event_id}` : "/last48", await tokenProvider.current(), { signal: controller.signal });
      const expected = event ? "application/pdf" : "application/zip";
      if (response.headers.get("content-type") !== expected) throw new Error("RESPOSTA_INVALIDA");
      const blob = await response.blob();
      if (!alive.current || controller.signal.aborted) return;
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = event ? (event.source === "4D" ? `comprovante-teste-nsr-${event.nsr}.pdf` : `recibo-laboratorio-${event.event_id}.pdf`) : "recibos-laboratorio-ultimas-48h.zip";
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setStatus(event ? "Recibo de laboratório baixado." : "Pacote de recibos das últimas 48 horas baixado.");
    } catch (error) { if (alive.current && !controller.signal.aborted) { setStatus(message(error)); if (/SESSAO|REVOGAD|INATIVO|AUTORIZAD/.test(error instanceof Error ? error.message : "")) { setEvents([]); setSelected(null); setMore(false); } } }
    finally { downloadLock.current = false; if (alive.current) setDownloading(false); }
  }
  if (presentation === "today") return <section className={styles.todayMarks} aria-labelledby="marcacoes-hoje-title">
    <h2 id="marcacoes-hoje-title">Marcações de hoje</h2>
    {loading ? <p role="status">Consultando marcações de hoje…</p> : status ? <p role="status">{status}</p> : !events.length ? <p>Nenhuma marcação hoje.</p> : <>
      <ul aria-label="Horários registrados hoje">{[...events].reverse().map(event => <li key={event.event_id}><time dateTime={event.marking_at}>{pointTime(event.marking_at)}</time></li>)}</ul>
      <p className={styles.lastMark}>Última marcação de hoje <strong>{pointTime(events[0].marking_at)}</strong></p>
      {more && <p>Exibindo as 20 marcações mais recentes. Consulte todas em Meus registros.</p>}
    </>}
  </section>;
  return <section id="meus-registros" className={styles.records} aria-labelledby="meus-registros-title">
    <div className={styles.recordsHeading}><FileText size={25} aria-hidden/><div><h2 id="meus-registros-title">{presentation === "receipts" ? "Recibos por marcação" : presentation === "history" ? "Marcações realizadas" : "Meus registros"}</h2><p>Suas marcações e recibos de laboratório.</p></div></div>
    <p className={styles.signatureNote}>Cada horário é um registro realizado. Este histórico não calcula entrada, saída ou jornada.</p>
    {presentation !== "history" && <><button id="comprovantes" type="button" className={styles.recordsDownload} disabled={downloading} onClick={() => void download()}><Download size={20} aria-hidden/>{downloading ? "Preparando download…" : "Baixar comprovantes das últimas 48 horas"}</button>
    <small className={styles.signatureNote}>ZIP com um PDF por marcação. Todos são recibos de simulação, sem valor oficial.</small></>}
    <div className={styles.reportFilters}><label>Período<select value={filter.period} onChange={e => { setOffset(0); setFilter({ period: e.target.value as RecordFilter["period"], ...(e.target.value === "custom" ? { from, to } : {}) }); }}><option value="today">Hoje</option><option value="48h">Últimas 48 horas</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="60d">Últimos 60 dias</option><option value="custom">Escolher período</option></select></label>
      {filter.period === "custom" && <><label>Data inicial<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Data final<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label><button type="button" className={styles.recordsButton} onClick={() => { setOffset(0); setFilter({ period: "custom", from, to }); }}>Consultar período</button></>}
    </div>
    <p role="status" aria-live="polite" className={styles.pointState}>{loading ? "Consultando seus registros…" : status}</p>
    {!loading && !events.length && !status && <p>Nenhuma marcação neste período.</p>}
    <ul className={styles.pointHistory}>{events.map(event => <li key={event.event_id}><div><strong>{pointDate(event.marking_at)} · {pointTime(event.marking_at)}</strong><p>Registro realizado</p></div><button type="button" className={styles.recordsButton} aria-label={`Ver recibo de ${pointDate(event.marking_at)} às ${pointTime(event.marking_at)}`} onClick={() => setSelected(event)}>Ver recibo</button></li>)}</ul>
    {(offset > 0 || more) && <div className={styles.recordsPaging}><button type="button" className={styles.recordsButton} disabled={loading || offset === 0} onClick={() => setOffset(old => Math.max(0, old - 20))}><ChevronLeft size={18} aria-hidden/>Anteriores</button><span>Página {Math.floor(offset / 20) + 1}</span><button type="button" className={styles.recordsButton} disabled={loading || !more} onClick={() => setOffset(old => old + 20)}>Próximos<ChevronRight size={18} aria-hidden/></button></div>}
    {selected && <section className={styles.pointReceipt} aria-label="Recibo de laboratório selecionado"><h3 ref={receiptHeading} tabIndex={-1}>Recibo de marcação — laboratório</h3><p><strong>{pointDate(selected.marking_at)} · {pointTime(selected.marking_at)}</strong></p><p>Registro concluído em {pointDate(selected.recorded_at)} às {pointTime(selected.recorded_at)}.</p><small>Fortaleza · UTC−03:00 · horário do servidor<br/>{selected.source === "4D" ? `NSR ${selected.nsr} · ${selected.employee_name}` : "Dados históricos limitados: nome e identificação legal não preservados nesta marcação."}</small><strong>SIMULAÇÃO SEM VALOR OFICIAL</strong><small>Não é comprovante REP-P oficial. Não possui assinatura PAdES/ICP-Brasil.</small><button type="button" className={styles.recordsDownload} disabled={downloading} onClick={() => void download(selected)}><Download size={20} aria-hidden/>Baixar recibo em PDF</button><button type="button" className={styles.recordsButton} onClick={() => setSelected(null)}>Fechar recibo</button></section>}
  </section>;
}
