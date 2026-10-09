"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock3, MapPin, CheckCircle2, CloudOff, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { acquireEventLocation, type LocationInput } from "@/03_FUNCOES_E_LOGICA/Ponto/geolocalizacao-evento";
import { referenceTime, pointDate, pointTime } from "@/03_FUNCOES_E_LOGICA/Ponto/relogio-referencia";
import { iniciarMarcacao } from "@/03_FUNCOES_E_LOGICA/Ponto/marcacao-em-andamento";
import { anotarRecusa, ehFalhaDeConexao, gravarSincronia, guardarNaFila, horaParaMarcar, lerFila, lerRecusadas, lerSincronia, limparRecusadas,
  RECUSA_DEFINITIVA, textoRecusa, tirarDaFila, type ItemFila, type Recusada, type Sincronia } from "@/03_FUNCOES_E_LOGICA/Ponto/fila-offline-4k";
import { onlinePointRequest, pointReceipt, locationLabel, horaOficial, type HoraOficial, type PointReceipt } from "@/05_ACESSO_A_DADOS/Ponto/ponto-online";
import styles from "./colaborador.module.css";
import { MeusRegistros } from "./meus-registros";
type Momento = ReturnType<typeof horaParaMarcar> & { celular: number };
type Pending = { key: string; location?: LocationInput; momento: Momento };
function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return /CPF_NAO_CADASTRADO/.test(code) ? "Seu CPF ainda não está cadastrado. Peça ao escritório para cadastrar e tente de novo. A marcação não foi feita." : /SESSAO_INVALIDA/.test(code) ? "Sessão expirada. Entre novamente." : /SESSAO_ENCERRADA/.test(code) ? "Sessão encerrada. Entre novamente." : /REVOGAD|INATIVO|AUTORIZAD/.test(code) ? "Acesso negado. Seu vínculo pessoal precisa estar ativo." : /INTENCAO_EXPIRADA/.test(code) ? "A intenção expirou sem confirmação. Inicie uma nova marcação." : /CONFLITANTE|PEDIDO_INVALIDO/.test(code) ? "Pedido inválido. A marcação não foi confirmada." : "Servidor indisponível ou conexão interrompida. Resultado ainda não confirmado.";
}
const horaCurta = (v: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
export function MeuPontoOnline({ getToken, employeeId, name, presentation = "full" }: { getToken: () => Promise<string>; employeeId: string; name: string; presentation?: "full" | "home" }) {
  const [events, setEvents] = useState<PointReceipt[]>([]), [receipt, setReceipt] = useState<PointReceipt | null>(null);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [recordsRevision, setRecordsRevision] = useState(0);
  // Marco 4K: sem internet o ponto fica guardado neste celular e é enviado sozinho quando a conexão volta.
  const [semConexao, setSemConexao] = useState(false), [fila, setFila] = useState<ItemFila[]>([]), [recusadas, setRecusadas] = useState<Recusada[]>([]);
  // Marco 4J: a hora do servidor é conferida com a hora oficial do Brasil.
  const [hora, setHora] = useState<HoraOficial | null>(null);
  const alive = useRef(false), working = useRef(false), sending = useRef(false), pending = useRef<Pending | null>(null), controller = useRef<AbortController | null>(null);
  const historyVersion = useRef(0), sincronia = useRef<Sincronia | null>(null);
  const semConexaoRef = useRef(false);
  useEffect(() => { semConexaoRef.current = semConexao; }, [semConexao]);
  // F-4C-ANDROID-01: a sessão é revalidada a cada 5 s e pode entregar uma nova referência de getToken.
  // A marcação em andamento não pode ser cancelada por isso; só sair da tela, trocar de conta ou logout a encerram.
  const tokenSource = useRef(getToken);
  useLayoutEffect(() => { tokenSource.current = getToken; }, [getToken]);
  const token = useCallback(() => tokenSource.current(), []);
  const load = useCallback(async () => {
    const version = historyVersion.current;
    const body = await onlinePointRequest("/events", await token());
    const parsed = body.events.map((value: unknown) => pointReceipt.parse(value)) as PointReceipt[];
    if (alive.current && version === historyVersion.current) setEvents(parsed);
  }, [token]);
  const momentoAgora = useCallback((): Momento => {
    const celular = Date.now();
    return { ...horaParaMarcar(sincronia.current ?? lerSincronia(), celular, performance.now()), celular };
  }, []);
  const enviarFila = useCallback(async () => {
    if (sending.current || !alive.current) return;
    const itens = lerFila(employeeId);
    if (!itens.length) return;
    sending.current = true;
    let enviados = 0;
    try {
      for (const item of itens) {
        try {
          const body = { idempotency_key: item.key, marking_at: item.marking_at, location: item.location, proof: { ...item.proof, aparelho_agora: new Date().toISOString() } };
          await onlinePointRequest("/offline", await token(), { method: "POST", body: JSON.stringify(body) });
          tirarDaFila(employeeId, item.key); enviados++;
        } catch (error) {
          const code = error instanceof Error ? error.message : "";
          if (/MARCACAO_REPETIDA/.test(code)) { tirarDaFila(employeeId, item.key); continue; }
          if (RECUSA_DEFINITIVA.test(code)) { anotarRecusa(employeeId, item, textoRecusa(code)); continue; }
          if (ehFalhaDeConexao(error) && alive.current) setSemConexao(true);
          break; // sem internet ou sessão para renovar: tenta de novo mais tarde, na mesma ordem
        }
      }
    } finally {
      sending.current = false;
      if (alive.current) {
        setFila(lerFila(employeeId)); setRecusadas(lerRecusadas(employeeId));
        if (enviados) { setSemConexao(false); setMessage(enviados === 1 ? "O ponto guardado no celular foi enviado e registrado." : `${enviados} pontos guardados no celular foram enviados e registrados.`);
          setRecordsRevision(old => old + 1); if (presentation === "full") void load().catch(() => undefined); }
      }
    }
  }, [employeeId, token, load, presentation]);
  useEffect(() => {
    alive.current = true; let reference: { at: string; monotonic: number } | null = null;
    const first = setTimeout(() => { setFila(lerFila(employeeId)); setRecusadas(lerRecusadas(employeeId)); }, 0);
    const synchronize = async () => {
      try {
        const t0 = Date.now(); const result = await onlinePointRequest("/clock", await token()); const t1 = Date.now(); const monotonic = performance.now();
        if (!alive.current) return;
        reference = { at: result.server_at, monotonic };
        sincronia.current = gravarSincronia(result.server_at, t0, t1, monotonic) ?? sincronia.current;
        const h = horaOficial.safeParse(result.hlb); setHora(h.success ? { ...h.data, verified: result.hlb_verified === true } : null);
        setSemConexao(false); void enviarFila();
      } catch (error) { if (alive.current && (ehFalhaDeConexao(error) || !navigator.onLine)) setSemConexao(true); }
    };
    const start = setTimeout(() => { if (presentation === "full") void load().catch(error => { if (alive.current && !ehFalhaDeConexao(error)) setMessage(errorMessage(error)); }); void synchronize(); }, 0);
    const refresh = setInterval(() => void synchronize(), 30000);
    const tick = setInterval(() => {
      if (!alive.current) return;
      const pelaReferencia = reference ? referenceTime(reference.at, reference.monotonic, performance.now()) : null;
      setClock(pelaReferencia ?? (semConexaoRef.current ? horaParaMarcar(sincronia.current ?? lerSincronia(), Date.now(), performance.now()).hora : null));
    }, 250);
    const voltou = () => void synchronize();
    window.addEventListener("online", voltou);
    return () => { alive.current = false; controller.current?.abort(); clearTimeout(first); clearTimeout(start); clearInterval(refresh); clearInterval(tick); window.removeEventListener("online", voltou); pending.current = null; };
  }, [token, load, presentation, employeeId, enviarFila]);

  async function guardarSemInternet(operation: Pending, signal: AbortSignal) {
    if (!operation.location) { setMessage("Sem internet. Obtendo localização uma única vez…"); operation.location = await acquireEventLocation(navigator.geolocation, signal); }
    if (!alive.current) return;
    const m = operation.momento;
    const ok = guardarNaFila({ key: operation.key, employee_id: employeeId, marking_at: m.hora.toISOString(), location: operation.location ?? null,
      proof: { employee_id: employeeId, metodo: m.metodo, hora_aparelho: new Date(m.celular).toISOString(), ajuste_ms: m.ajuste_ms, sincronizado_em: m.sincronizado_em } });
    pending.current = null; setSemConexao(true); setFila(lerFila(employeeId));
    setMessage(ok ? `Sem internet. Seu ponto das ${pointTime(m.hora)} ficou guardado neste celular e será enviado sozinho quando a internet voltar.`
      : "Não foi possível guardar o ponto neste celular (memória cheia ou muitas marcações sem internet). Procure o escritório.");
  }
  async function perform() {
    controller.current = new AbortController(); const signal = controller.current.signal;
    const operation = pending.current ?? { key: crypto.randomUUID(), momento: momentoAgora() }; pending.current = operation;
    const confirmed = async (value: unknown) => {
      const event = pointReceipt.parse(value); if (!alive.current) return;
      setReceipt(event); setEvents(old => [event, ...old.filter(e => e.event_id !== event.event_id)]); setMessage("Ponto registrado."); pending.current = null;
      setRecordsRevision(old => old + 1);
      try { if (presentation === "full") await load(); } catch { /* Recibo confirmado permanece; falha de leitura não inventa outra marcação. */ }
    };
    try {
      if (!navigator.onLine) throw new Error("SEM_CONEXAO");
      setMessage("Iniciando marcação online…");
      await onlinePointRequest("/begin", await token(), { method: "POST", body: JSON.stringify({ idempotency_key: operation.key }), signal });
      if (!alive.current) return;
      if (!operation.location) { setMessage("Obtendo localização uma única vez…"); operation.location = await acquireEventLocation(navigator.geolocation, signal); }
      if (!alive.current) return;
      setMessage("Enviando marcação…");
      const result = await onlinePointRequest("/events", await token(), { method: "POST", body: JSON.stringify({ idempotency_key: operation.key, location: operation.location }), signal });
      await confirmed(result.event);
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Error && /INTENCAO_EXPIRADA|PEDIDO_INVALIDO|CONFLITANTE|CPF_NAO_CADASTRADO/.test(error.message)) { pending.current = null; setMessage(errorMessage(error)); return; }
      if (error instanceof Error && /SESSAO|REVOGAD|INATIVO|AUTORIZAD/.test(error.message)) { setEvents([]); setReceipt(null); pending.current = null; setMessage(errorMessage(error)); return; }
      if (navigator.onLine && !(error instanceof Error && error.message === "SEM_CONEXAO")) {
        try { const recovered = await onlinePointRequest(`/intent/${operation.key}`, await token(), { signal }); await confirmed(recovered.event); return; }
        catch { /* sem confirmação: guarda no celular com a MESMA chave (o servidor não duplica) */ }
      }
      if (alive.current) await guardarSemInternet(operation, signal);
    }
  }
  async function mark() {
    if (working.current) return; working.current = true; historyVersion.current += 1; setBusy(true); setReceipt(null);
    const encerrarMarcacao = iniciarMarcacao();
    try {
      if (navigator.locks) await navigator.locks.request(`metallo-point-${employeeId}`, { ifAvailable: true }, async lock => { if (lock) await perform(); else if (alive.current) setMessage("Uma marcação está em andamento em outra aba. Aguarde e consulte o histórico."); });
      else { if (alive.current) setMessage("Este navegador não oferece o controle entre abas necessário ao registro. Use o Chrome ou o Edge atualizado."); }
    } finally { encerrarMarcacao(); working.current = false; if (alive.current) setBusy(false); }
  }
  const origemRelogio = semConexao ? (lerSincronia() ? "hora do celular corrigida pela última conferência" : "hora do celular (ainda não conferida)") : "horário do servidor";
  return <div className={styles.pointOnline}>
    {presentation === "full" && <strong className={styles.pointWarning}>SIMULAÇÃO SEM VALOR OFICIAL</strong>}
    <div className={presentation === "home" ? styles.homePointClock : styles.pointHero}><Clock3 size={presentation === "home" ? 20 : 28} aria-hidden/>{presentation === "full" ? <p>Olá, {name.trim().split(/\s+/)[0]}.</p> : <p>{clock ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Fortaleza" }).format(clock) : "Aguardando a data do servidor…"}</p>}<span>{semConexao ? "Hora para o ponto (sem internet)" : "Hora de referência do servidor"}</span><strong className={styles.pointClock}>{clock ? pointTime(clock) : "--:--:--"}</strong><small>Fortaleza · UTC−03:00 · {origemRelogio}</small></div>
    {!semConexao && hora?.verified && hora.checked_at && <p className={styles.pointOfficial}><ShieldCheck size={16} aria-hidden/> Hora conferida com a hora oficial do Brasil às {horaCurta(hora.checked_at)}{hora.difference_ms !== null ? ` (diferença de ${Math.abs(hora.difference_ms) < 1000 ? "menos de 1 segundo" : `${Math.round(Math.abs(hora.difference_ms) / 1000)} s`})` : ""}.</p>}
    {semConexao && <p className={styles.pointOffline} role="status"><CloudOff size={18} aria-hidden/> Sem internet agora. Pode bater o ponto normalmente: ele fica guardado neste celular e é enviado sozinho quando a internet voltar.</p>}
    {presentation === "home" && <><p className={styles.homePointLabel}>MEU PONTO</p>{clock && !semConexao ? <MeusRegistros key={pointDate(clock)} getToken={getToken} revision={recordsRevision} presentation="today"/> : !semConexao ? <p className={styles.signatureNote}>Marcações de hoje disponíveis após confirmar a hora do servidor.</p> : null}</>}
    {presentation === "full" && <div className={styles.pointLocation}><MapPin size={21} aria-hidden/><p>A localização será coletada somente no momento do registro de ponto para compor o contexto da marcação. O aplicativo não realiza rastreamento contínuo.<br/><small>Negar a permissão ou ter baixa precisão não impede o registro. Use somente contas de teste.</small></p></div>}
    <button type="button" className={styles.primary} onClick={() => void mark()} disabled={busy} aria-busy={busy}>{busy ? "Registrando…" : "Registrar ponto"}</button>
    <p role="status" aria-live="polite" className={styles.pointState}>{message || (semConexao ? "Pronto para marcar sem internet." : "Pronto para uma marcação online.")}</p>
    {fila.length > 0 && <section className={styles.pointQueue} aria-label="Pontos guardados no celular"><h2>Guardados no celular ({fila.length})</h2><p>Esperando internet para enviar. Não apague os dados do navegador.</p>
      <ul>{fila.map(item => <li key={item.key}><strong>{pointDate(item.marking_at)} · {pointTime(item.marking_at)}</strong><span>Aguardando envio</span></li>)}</ul></section>}
    {recusadas.length > 0 && <section className={styles.pointQueue} role="alert" aria-label="Pontos não aceitos"><h2>Ponto não aceito</h2>
      <ul>{recusadas.map(r => <li key={r.key}><strong>{pointDate(r.marking_at)} · {pointTime(r.marking_at)}</strong><span>Motivo: {r.motivo}.</span></li>)}</ul>
      <p>Procure o escritório para acertar esse horário.</p><button type="button" className={styles.queueButton} onClick={() => { limparRecusadas(employeeId); setRecusadas([]); }}>Entendi</button></section>}
    {receipt && <section className={styles.pointReceipt} aria-label="Recibo técnico da marcação"><CheckCircle2 size={22} aria-hidden/><h2>Ponto registrado</h2><p>{pointDate(receipt.marking_at)} · <strong>{pointTime(receipt.marking_at)}</strong></p><p>{receipt.online ? "Online" : "Sem internet (enviado depois)"} · {locationLabel[receipt.location_status]}</p><small>Referência sintética: {receipt.synthetic_reference}<br/>Recibo técnico de teste. Não é comprovante REP-P oficial.</small></section>}
    {presentation === "home" ? <><nav className={styles.homeShortcuts} aria-label="Atalhos de ponto"><Link href="/colaborador/registros">Meus registros</Link><Link href="/colaborador/comprovantes">Comprovantes</Link></nav><details className={styles.homeLocationNote}><summary>Sobre a localização nesta marcação</summary><p>A localização é solicitada uma única vez ao registrar. Não há rastreamento contínuo. Negar a permissão ou ter baixa precisão não impede o registro.</p></details></> : <>
      {!semConexao && <MeusRegistros key={employeeId} getToken={getToken} revision={recordsRevision}/>}
      <details><summary>Resumo recente das marcações</summary><p className={styles.signatureNote}>Últimas 50 marcações pessoais.</p>{!events.length ? <p>Nenhuma marcação confirmada nesta conta.</p> : <ul className={styles.pointHistory}>{events.map(event => <li key={event.event_id}><div><strong>{pointDate(event.marking_at)} · {pointTime(event.marking_at)}</strong><p>{event.online ? "Online" : "Sem internet (enviado depois)"} · {locationLabel[event.location_status]}</p></div><span>Registrada</span></li>)}</ul>}</details>
      <small>Não é produção, conformidade REP-P ou autorização de ponto oficial. Não liberado para funcionários reais.</small>
    </>}
  </div>;
}
