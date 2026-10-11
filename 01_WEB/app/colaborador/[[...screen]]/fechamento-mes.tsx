"use client";
import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { horasMinutos, nomeDoMes, saldoTexto } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import type { FechamentoApp4l } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";
import styles from "./colaborador.module.css";

// Marco 4L: o escritório fechou o mês. O funcionário confere e responde "Está certo" ou "Tem algo errado".
export type Fechamentos4l = { ler: () => Promise<FechamentoApp4l[]>; responder: (id: number, resposta: "confirmado" | "contestado", comentario: string) => Promise<string> };
const data = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export function FechamentoCard({ f, acoes, onRespondido }: { f: FechamentoApp4l; acoes: Fechamentos4l; onRespondido: (novo: FechamentoApp4l) => void }) {
  const [errado, setErrado] = useState(false), [texto, setTexto] = useState(""), [ocupado, setOcupado] = useState(false), [msg, setMsg] = useState("");
  const r = f.resumo, extras = r.extra50 + r.sabado + r.domingoFeriado;
  async function responder(resposta: "confirmado" | "contestado") {
    if (resposta === "contestado" && texto.trim().length < 5) { setMsg("Escreva o que está errado (por exemplo: dia 12 eu trabalhei até 18h)."); return; }
    setOcupado(true); setMsg("");
    try {
      const em = await acoes.responder(f.id, resposta, resposta === "contestado" ? texto.trim() : "");
      onRespondido({ ...f, resposta, respondido_em: em, comentario: resposta === "contestado" ? texto.trim() : null });
    } catch { setMsg("Não foi possível enviar agora. Tente de novo com internet."); }
    finally { setOcupado(false); }
  }
  return <section className={styles.avisosCard} aria-label={`Fechamento de ${nomeDoMes(f.mes)}`}>
    <div className={styles.avisosTopo}><ClipboardCheck size={24} aria-hidden/><div>
      <h2>Mês fechado pelo escritório</h2>
      <p>{nomeDoMes(f.mes)} · fechado em {data(f.fechado_em)}</p></div></div>
    <ul className={styles.fechamentoNumeros}>
      <li><span>Dias trabalhados</span><strong>{r.diasTrabalhados}</strong></li>
      <li><span>Horas registradas</span><strong>{horasMinutos(r.minutos)}</strong></li>
      <li><span>Horas a mais</span><strong>{extras ? saldoTexto(extras) : "—"}</strong></li>
      <li><span>Atrasos e saídas antes</span><strong>{r.atrasos ? saldoTexto(r.atrasos) : "—"}</strong></li>
      <li><span>Faltas</span><strong>{r.faltas || "—"}</strong></li>
      <li><span>Atestado, férias, folga</span><strong>{r.abonos || "—"}</strong></li>
    </ul>
    {f.resposta === "confirmado" && <p className={styles.avisosMsg}>Você confirmou em {data(f.respondido_em!)}. Obrigado!</p>}
    {f.resposta === "contestado" && <p className={styles.espelhoAlerta}>Você avisou que tem algo errado: “{f.comentario}”. O escritório vai conferir.</p>}
    {!f.resposta && <>
      <p className={styles.avisosMsg}>Confira os dias abaixo. Está tudo certo?</p>
      {msg && <p className={styles.espelhoAlerta} role="alert">{msg}</p>}
      {errado ? <div className={styles.avisosBotoes}>
        <label htmlFor={`errado-${f.id}`} className={styles.fechamentoLabel}>O que está errado?</label>
        <textarea id={`errado-${f.id}`} className={styles.fechamentoTexto} maxLength={500} rows={3} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: dia 12 eu saí às 18h, não às 17h"/>
        <button type="button" className={styles.primary} onClick={() => void responder("contestado")} disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar para o escritório"}</button>
        <button type="button" className={styles.queueButton} onClick={() => { setErrado(false); setMsg(""); }} disabled={ocupado}>Voltar</button>
      </div> : <div className={styles.avisosBotoes}>
        <button type="button" className={styles.primary} onClick={() => void responder("confirmado")} disabled={ocupado}>{ocupado ? "Enviando…" : "Está certo"}</button>
        <button type="button" className={styles.queueButton} onClick={() => setErrado(true)} disabled={ocupado}>Tem algo errado</button>
      </div>}
    </>}
    <p className={styles.signatureNote}>Confirmar não tira o seu direito de reclamar depois.</p>
  </section>;
}

/** Início: lembra que tem mês fechado esperando a conferência. */
export function FechamentoPendente({ acoes, abrir }: { acoes: Fechamentos4l; abrir: () => void }) {
  const [pendente, setPendente] = useState<FechamentoApp4l | null>(null);
  useEffect(() => {
    let vivo = true;
    acoes.ler().then(lista => { if (vivo) setPendente(lista.find(f => !f.resposta) ?? null); }, () => undefined);
    return () => { vivo = false; };
  }, [acoes]);
  if (!pendente) return null;
  return <section className={styles.avisosCard} aria-label="Espelho para conferir">
    <div className={styles.avisosTopo}><ClipboardCheck size={24} aria-hidden/><div><h2>Confira seu espelho</h2>
      <p>O escritório fechou {nomeDoMes(pendente.mes).toLocaleLowerCase("pt-BR")}. Veja suas horas e diga se está certo.</p></div></div>
    <div className={styles.avisosBotoes}><button type="button" className={styles.primary} onClick={abrir}>Conferir agora</button></div>
  </section>;
}
