"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, ReceiptText, Stethoscope, Upload } from "lucide-react";
import { MENSAGEM_ENVIO_6, NOME_FOLHA, prepararFoto, type AtestadoApp6b, type ContrachequeApp6a } from "@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6";
import { nomeDoMes } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import styles from "./colaborador.module.css";

// Marcos 6A (meus contracheques) e 6B (enviar atestado). Letras grandes, poucos botões.
export type Arquivos6 = {
  contracheques: () => Promise<ContrachequeApp6a[]>; atestados: () => Promise<AtestadoApp6b[]>;
  abrir: (arquivoId: string) => Promise<string>; cancelarAtestado: (id: number) => Promise<void>;
  enviarAtestado: (arquivo: Blob, nome: string, dataInicio: string, dias: number, observacao: string, chave: string) => Promise<void>;
};
const dataBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const diaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const hojeFortaleza = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

async function abrirLink(acoes: Arquivos6, arquivoId: string, setMsg: (m: string) => void) {
  setMsg("Abrindo…");
  try { window.location.assign(await acoes.abrir(arquivoId)); setMsg(""); }
  catch { setMsg("Não foi possível abrir agora. Tente de novo com internet."); }
}

export function MeusContracheques({ acoes }: { acoes: Arquivos6 }) {
  const [lista, setLista] = useState<ContrachequeApp6a[] | null>(null), [msg, setMsg] = useState("");
  useEffect(() => {
    let vivo = true;
    acoes.contracheques().then(l => { if (vivo) setLista(l); }, () => { if (vivo) { setLista([]); setMsg("Não foi possível carregar agora. Tente de novo com internet."); } });
    return () => { vivo = false; };
  }, [acoes]);
  return <section className={styles.records} aria-labelledby="contracheques-titulo">
    <div className={styles.recordsHeading}><ReceiptText size={25} aria-hidden/><div><h2 id="contracheques-titulo">Meus contracheques</h2><p>Toque para abrir o PDF.</p></div></div>
    {msg && <p className={styles.pointState} role="status">{msg}</p>}
    {lista === null ? <p className={styles.pointState}>Carregando…</p> : !lista.length ? <p>Nenhum contracheque ainda. Quando o escritório colocar, ele aparece aqui.</p> :
      <ul className={styles.documentosLista}>{lista.map(c => <li key={c.id}>
        <button type="button" className={styles.documentoBotao} onClick={() => void abrirLink(acoes, c.arquivo_id, setMsg)}>
          <FileText size={26} aria-hidden/><span><strong>{nomeDoMes(c.competencia)}</strong><small>{NOME_FOLHA[c.tipo_folha]}{c.visto_em ? "" : " · novo"}</small></span>
        </button></li>)}</ul>}
    <p className={styles.signatureNote}>Dúvida no contracheque? Fale com o escritório.</p>
  </section>;
}

const STATUS: Record<AtestadoApp6b["status"], string> = { enviado: "Enviado · esperando o escritório conferir", aceito: "Recebido e lançado no ponto",
  recusado: "Não foi aceito", cancelado: "Cancelado por você" };

export function EnviarAtestado({ acoes }: { acoes: Arquivos6 }) {
  const [lista, setLista] = useState<AtestadoApp6b[] | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null), [inicio, setInicio] = useState(hojeFortaleza), [dias, setDias] = useState(1), [obs, setObs] = useState("");
  const [msg, setMsg] = useState(""), [ocupado, setOcupado] = useState(false);
  const chave = useRef<string | null>(null), camera = useRef<HTMLInputElement>(null), galeria = useRef<HTMLInputElement>(null);
  const recarregar = () => acoes.atestados().then(setLista, () => setLista([]));
  useEffect(() => {
    let vivo = true;
    acoes.atestados().then(l => { if (vivo) setLista(l); }, () => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [acoes]);
  function escolher(f: File | undefined) { if (f) { setArquivo(f); setMsg(""); } }
  async function enviar() {
    if (!arquivo) { setMsg(MENSAGEM_ENVIO_6.sem_arquivo); return; }
    setOcupado(true); setMsg("Enviando…");
    chave.current ??= crypto.randomUUID();
    try {
      const pronto = await prepararFoto(arquivo);
      await acoes.enviarAtestado(pronto, arquivo.type === "application/pdf" ? "atestado.pdf" : "atestado.jpg", inicio, dias, obs.trim(), chave.current);
      chave.current = null; setArquivo(null); setObs(""); setDias(1);
      setMsg("Atestado enviado! O escritório vai conferir. Guarde o papel original.");
      await recarregar();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMsg(MENSAGEM_ENVIO_6[code] ?? "Não foi possível enviar agora. Tente de novo com internet (não precisa tirar a foto de novo).");
    } finally { setOcupado(false); }
  }
  async function cancelar(id: number) {
    try { await acoes.cancelarAtestado(id); await recarregar(); } catch { setMsg("Não foi possível cancelar agora."); }
  }
  return <section className={styles.records} aria-labelledby="atestado-titulo">
    <div className={styles.recordsHeading}><Stethoscope size={25} aria-hidden/><div><h2 id="atestado-titulo">Enviar atestado</h2><p>Tire uma foto do atestado e mande para o escritório.</p></div></div>
    <div className={styles.avisosCard}>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => escolher(e.target.files?.[0])}/>
      <input ref={galeria} type="file" accept="image/*,application/pdf" hidden onChange={e => escolher(e.target.files?.[0])}/>
      <div className={styles.avisosBotoes}>
        <button type="button" className={styles.primary} onClick={() => camera.current?.click()} disabled={ocupado}><Camera size={22} aria-hidden/>Tirar foto do atestado</button>
        <button type="button" className={styles.queueButton} onClick={() => galeria.current?.click()} disabled={ocupado}>Escolher foto ou PDF do celular</button>
      </div>
      {arquivo && <p className={styles.avisosMsg}>Arquivo pronto: {arquivo.type === "application/pdf" ? "PDF" : "foto"} ✓</p>}
      <label className={styles.fechamentoLabel} htmlFor="atestado-inicio">Primeiro dia do atestado</label>
      <input id="atestado-inicio" className={styles.fechamentoTexto} type="date" value={inicio} max={hojeFortaleza()} onChange={e => setInicio(e.target.value)} style={{ minHeight: 56 }}/>
      <label className={styles.fechamentoLabel} htmlFor="atestado-dias">Quantos dias</label>
      <div className={styles.atestadoDias}>
        <button type="button" className={styles.queueButton} onClick={() => setDias(d => Math.max(1, d - 1))} aria-label="Menos um dia">−</button>
        <input id="atestado-dias" type="number" inputMode="numeric" min={1} max={30} value={dias} onChange={e => setDias(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}/>
        <button type="button" className={styles.queueButton} onClick={() => setDias(d => Math.min(30, d + 1))} aria-label="Mais um dia">+</button>
      </div>
      <label className={styles.fechamentoLabel} htmlFor="atestado-obs">Recado para o escritório (se quiser)</label>
      <textarea id="atestado-obs" className={styles.fechamentoTexto} rows={2} maxLength={200} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: fui ao posto de saúde"/>
      <p className={styles.signatureNote}>Não escreva a doença. O código da doença (CID) só vai no atestado se você quiser.</p>
      {msg && <p className={msg.startsWith("Atestado enviado") ? styles.avisosMsg : styles.espelhoAlerta} role="status">{msg}</p>}
      <button type="button" className={styles.primary} onClick={() => void enviar()} disabled={ocupado || !arquivo}><Upload size={22} aria-hidden/>{ocupado ? "Enviando…" : "Enviar atestado"}</button>
    </div>
    <h3 className={styles.documentosSubtitulo}>Atestados enviados</h3>
    {lista === null ? <p className={styles.pointState}>Carregando…</p> : !lista.length ? <p>Nenhum atestado enviado.</p> :
      <ul className={styles.documentosLista}>{lista.map(a => <li key={a.id} className={styles.documentoLinha}>
        <div><strong>{a.dias} dia(s) a partir de {diaBr(a.data_inicio)}</strong><small>{STATUS[a.status]} · enviado em {dataBr(a.enviado_em)}</small>
          {a.motivo_recusa && <small className={styles.espelhoFalta}>Motivo: {a.motivo_recusa}</small>}</div>
        <div className={styles.avisosBotoes}>
          {a.status !== "cancelado" && <button type="button" className={styles.queueButton} onClick={() => void abrirLink(acoes, a.arquivo_id, setMsg)}>Ver</button>}
          {a.status === "enviado" && <button type="button" className={styles.queueButton} onClick={() => void cancelar(a.id)}>Cancelar envio</button>}
        </div>
      </li>)}</ul>}
    <p className={styles.signatureNote}>Atestado é dado de saúde: só você e o escritório veem (LGPD). Entregue também o papel original, se o escritório pedir.</p>
  </section>;
}
