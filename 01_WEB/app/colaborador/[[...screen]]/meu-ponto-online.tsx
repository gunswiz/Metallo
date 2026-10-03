"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, MapPin, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { acquireEventLocation, type LocationInput } from "@/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento";
import { referenceTime, pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
import { onlinePointRequest, pointReceipt, locationLabel, type PointReceipt } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import styles from "./colaborador.module.css";
import { MeusRegistros } from "./meus-registros";
type Pending = { key: string; location?: LocationInput };
function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return /SESSAO_INVALIDA/.test(code) ? "Sessão expirada. Entre novamente." : /SESSAO_ENCERRADA/.test(code) ? "Sessão encerrada. Entre novamente." : /REVOGAD|INATIVO|AUTORIZAD/.test(code) ? "Acesso negado. Seu vínculo pessoal precisa estar ativo." : /INTENCAO_EXPIRADA/.test(code) ? "A intenção expirou sem confirmação. Inicie uma nova marcação." : /CONFLITANTE|PEDIDO_INVALIDO/.test(code) ? "Pedido inválido. A marcação não foi confirmada." : "Servidor indisponível ou conexão interrompida. Resultado ainda não confirmado.";
}
export function MeuPontoOnline({ getToken, employeeId, name, presentation = "full" }: { getToken: () => Promise<string>; employeeId: string; name: string; presentation?: "full" | "home" }) {
  const [events, setEvents] = useState<PointReceipt[]>([]), [receipt, setReceipt] = useState<PointReceipt | null>(null);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const alive = useRef(false), working = useRef(false), pending = useRef<Pending | null>(null), controller = useRef<AbortController | null>(null);
  const historyVersion = useRef(0);
  const load = useCallback(async () => {
    const version = historyVersion.current;
    const body = await onlinePointRequest("/events", await getToken());
    const parsed = body.events.map((value: unknown) => pointReceipt.parse(value)) as PointReceipt[];
    if (alive.current && version === historyVersion.current) setEvents(parsed);
  }, [getToken]);
  useEffect(() => {
    alive.current = true; let reference: { at: string; monotonic: number } | null = null;
    const synchronize = async () => { try { const result = await onlinePointRequest("/clock", await getToken()); if (alive.current) reference = { at: result.server_at, monotonic: performance.now() }; } catch { reference = null; } };
    const first = setTimeout(() => { if (presentation === "full") void load().catch(error => { if (alive.current) setMessage(errorMessage(error)); }); void synchronize(); }, 0);
    const refresh = setInterval(() => void synchronize(), 30000);
    const tick = setInterval(() => { if (alive.current) setClock(reference ? referenceTime(reference.at, reference.monotonic, performance.now()) : null); }, 250);
    return () => { alive.current = false; controller.current?.abort(); clearTimeout(first); clearInterval(refresh); clearInterval(tick); pending.current = null; };
  }, [getToken, load, presentation]);
  async function perform() {
    controller.current = new AbortController(); const signal = controller.current.signal;
    const operation = pending.current ?? { key: crypto.randomUUID() }; pending.current = operation;
    const confirmed = async (value: unknown) => {
      const event = pointReceipt.parse(value); if (!alive.current) return;
      setReceipt(event); setEvents(old => [event, ...old.filter(e => e.event_id !== event.event_id)]); setMessage("Ponto registrado no laboratório."); pending.current = null; setRetry(false);
      setRecordsRevision(old => old + 1);
      try { if (presentation === "full") await load(); } catch { /* Recibo confirmado permanece; falha de leitura não inventa outra marcação. */ }
    };
    try {
      if (!navigator.onLine) throw new Error("SEM_CONEXAO");
      setMessage(retry ? "Verificando a mesma intenção…" : "Iniciando marcação online…");
      await onlinePointRequest("/begin", await getToken(), { method: "POST", body: JSON.stringify({ idempotency_key: operation.key }), signal });
      if (!alive.current) return;
      if (!operation.location) { setMessage("Obtendo localização uma única vez…"); operation.location = await acquireEventLocation(navigator.geolocation, signal); }
      if (!alive.current) return;
      setMessage("Enviando marcação…");
      const result = await onlinePointRequest("/events", await getToken(), { method: "POST", body: JSON.stringify({ idempotency_key: operation.key, location: operation.location }), signal });
      await confirmed(result.event);
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Error && /INTENCAO_EXPIRADA|PEDIDO_INVALIDO|CONFLITANTE/.test(error.message)) { pending.current = null; setRetry(false); setMessage(errorMessage(error)); return; }
      if (error instanceof Error && /SESSAO|REVOGAD|INATIVO|AUTORIZAD/.test(error.message)) { setEvents([]); setReceipt(null); pending.current = null; setRetry(false); setMessage(errorMessage(error)); return; }
      try { const recovered = await onlinePointRequest(`/intent/${operation.key}`, await getToken(), { signal }); await confirmed(recovered.event); }
      catch { if (alive.current) { setRetry(true); setMessage(navigator.onLine ? errorMessage(error) : "Sem conexão. Nenhuma confirmação recebida; não existe fila offline."); } }
    }
  }
  async function mark() {
    if (working.current) return; working.current = true; historyVersion.current += 1; setBusy(true); setReceipt(null);
    try {
      if (navigator.locks) await navigator.locks.request(`metallo-point-${employeeId}`, { ifAvailable: true }, async lock => { if (lock) await perform(); else if (alive.current) setMessage("Uma marcação está em andamento em outra aba. Aguarde e consulte o histórico."); });
      else { if (alive.current) setMessage("Este navegador não oferece o controle entre abas necessário ao laboratório. Use o Edge atualizado."); }
    } finally { working.current = false; if (alive.current) setBusy(false); }
  }
  return <div className={styles.pointOnline}>
    {presentation === "full" && <strong className={styles.pointWarning}>SIMULAÇÃO SEM VALOR OFICIAL</strong>}
    <div className={presentation === "home" ? styles.homePointClock : styles.pointHero}><Clock3 size={presentation === "home" ? 20 : 28} aria-hidden/>{presentation === "full" ? <p>Olá, {name.trim().split(/\s+/)[0]}.</p> : <p>{clock ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Fortaleza" }).format(clock) : "Aguardando a data do servidor…"}</p>}<span>Hora de referência do laboratório</span><strong className={styles.pointClock}>{clock ? pointTime(clock) : "--:--:--"}</strong><small>Fortaleza · UTC−03:00 · horário do servidor local</small></div>
    {presentation === "home" && <><p className={styles.homePointLabel}>MEU PONTO</p>{clock ? <MeusRegistros key={pointDate(clock)} getToken={getToken} revision={recordsRevision} presentation="today"/> : <p className={styles.signatureNote}>Marcações de hoje disponíveis após confirmar a referência do laboratório.</p>}</>}
    {presentation === "full" && <div className={styles.pointLocation}><MapPin size={21} aria-hidden/><p>A localização será coletada somente no momento do registro de ponto para compor o contexto da marcação. O aplicativo não realiza rastreamento contínuo.<br/><small>Negar a permissão ou ter baixa precisão não impede o registro. Use somente o laboratório sintético.</small></p></div>}
    <button type="button" className={styles.primary} onClick={() => void mark()} disabled={busy} aria-busy={busy}>{busy ? "Registrando…" : retry ? "Verificar / reenviar a mesma intenção" : "Registrar ponto"}</button>
    <p role="status" aria-live="polite" className={styles.pointState}>{message || "Pronto para uma marcação online."}</p>
    {receipt && <section className={styles.pointReceipt} aria-label="Recibo técnico da marcação"><CheckCircle2 size={22} aria-hidden/><h2>Ponto registrado</h2><p>{pointDate(receipt.marking_at)} · <strong>{pointTime(receipt.marking_at)}</strong></p><p>Online · {locationLabel[receipt.location_status]}</p><small>Referência sintética: {receipt.synthetic_reference}<br/>Recibo técnico de teste. Não é comprovante REP-P oficial.</small></section>}
    {presentation === "home" ? <><nav className={styles.homeShortcuts} aria-label="Atalhos de ponto"><Link href="/colaborador/registros">Meus registros</Link><Link href="/colaborador/comprovantes">Comprovantes</Link></nav><details className={styles.homeLocationNote}><summary>Sobre a localização nesta marcação</summary><p>A localização é solicitada uma única vez ao registrar. Não há rastreamento contínuo. Negar a permissão ou ter baixa precisão não impede o registro.</p></details></> : <>
      <MeusRegistros key={employeeId} getToken={getToken} revision={recordsRevision}/>
      <details><summary>Resumo recente da marcação online</summary><p className={styles.signatureNote}>Últimas 50 marcações pessoais do fluxo 4A.</p>{!events.length ? <p>Nenhuma marcação confirmada nesta conta.</p> : <ul className={styles.pointHistory}>{events.map(event => <li key={event.event_id}><div><strong>{pointDate(event.marking_at)} · {pointTime(event.marking_at)}</strong><p>Online · {locationLabel[event.location_status]}</p></div><span>Registrada</span></li>)}</ul>}</details>
      <small>Não é produção, conformidade REP-P ou autorização de ponto oficial. Não liberado para funcionários reais. Não implantado no Supabase remoto. Não autoriza publicação.</small>
    </>}
  </div>;
}
