"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Truck } from "lucide-react";
import { prepararFoto } from "@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6";
import { mensagemErroFrota10a, ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, type CaminhaoApp10a, type ItemChecklist10a, type RespostaChecklist10a, type ViagemApp10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import styles from "./colaborador.module.css";

type Acoes = {
  caminhoes: () => Promise<CaminhaoApp10a[]>; itens: () => Promise<ItemChecklist10a[]>; viagens: () => Promise<ViagemApp10a[]>;
  checklist: (veiculo: number, local: string, obs: string, respostas: RespostaChecklist10a[], chave: string) => Promise<"liberado" | "ressalvas" | "nao_liberado">;
  saida: (veiculo: number, destino: string, acompanhantes: string, km: number, obs: string, chave: string) => Promise<void>;
  foto: (veiculo: number, arquivo: Blob) => Promise<string>;
  chegada: (viagem: number, km: number, problema: string, obs: string, chave: string, foto?: string) => Promise<boolean>;
};
type Modo = { tipo: "lista" } | { tipo: "checklist" | "saida" | "chegada"; v: CaminhaoApp10a };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const lerKm = (t: string) => { const l = t.trim().replace(/\./g, ""); return /^\d{1,7}$/.test(l) ? Number(l) : null; };

// Marco 10A — "Caminhões": checklist do dia, saída e chegada do munck. Sem localização.
export function Frota({ acoes }: { acoes: Acoes }) {
  const [caminhoes, setCaminhoes] = useState<CaminhaoApp10a[]>([]), [itens, setItens] = useState<ItemChecklist10a[]>([]), [viagens, setViagens] = useState<ViagemApp10a[]>([]);
  const [modo, setModo] = useState<Modo>({ tipo: "lista" }), [status, setStatus] = useState("Carregando…"), [enviando, setEnviando] = useState(false);
  const [respostas, setRespostas] = useState<Record<number, { s: "C" | "N" | "NA" | ""; obs: string; foto?: string }>>({}), [fotoChegada, setFotoChegada] = useState<string | null>(null), [subindo, setSubindo] = useState(false), alvoFoto = useRef<number | "chegada" | null>(null), cameraFoto = useRef<HTMLInputElement>(null), [local, setLocal] = useState(""), [obs, setObs] = useState(""), [ciente, setCiente] = useState(false);
  const [destino, setDestino] = useState(""), [acomp, setAcomp] = useState(""), [km, setKm] = useState(""), [problema, setProblema] = useState("");
  const ref = useRef(acoes), chave = useRef<string | null>(null);
  useEffect(() => { ref.current = acoes; }, [acoes]);
  const carregar = useCallback(async () => {
    try { const [c, i, t] = await Promise.all([ref.current.caminhoes(), ref.current.itens(), ref.current.viagens()]); setCaminhoes(c); setItens(i); setViagens(t); setStatus(""); }
    catch { setStatus("Não foi possível carregar agora. Tente de novo."); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void carregar(), 0); return () => clearTimeout(t); }, [carregar]);

  function abrir(tipo: "checklist" | "saida" | "chegada", v: CaminhaoApp10a) {
    chave.current = null; setStatus(""); setKm(String(v.km_atual)); setDestino(""); setAcomp(""); setProblema(""); setObs(""); setLocal(""); setCiente(false); setFotoChegada(null);
    setRespostas(Object.fromEntries(itens.map(i => [i.codigo, { s: "" as const, obs: "", foto: undefined as string | undefined }]))); setModo({ tipo, v });
  }
  const voltar = () => { chave.current = null; setModo({ tipo: "lista" }); };
  async function rodar(fn: () => Promise<string>) {
    setEnviando(true); setStatus(""); chave.current ??= crypto.randomUUID();
    try { const msg = await fn(); chave.current = null; setModo({ tipo: "lista" }); await carregar(); setStatus(msg); }
    catch (e) { setStatus(mensagemErroFrota10a(e)); }
    finally { setEnviando(false); }
  }
  function pedirFoto(alvo: number | "chegada") { alvoFoto.current = alvo; cameraFoto.current?.click(); }
  async function fotoEscolhida(arquivo: File | undefined, v: CaminhaoApp10a) {
    const alvo = alvoFoto.current;
    if (!arquivo || alvo === null) return;
    setSubindo(true); setStatus("Enviando a foto…");
    try {
      const id = await acoes.foto(v.id, await prepararFoto(arquivo));
      if (alvo === "chegada") setFotoChegada(id); else setRespostas(a => ({ ...a, [alvo]: { s: a[alvo]?.s ?? "N", obs: a[alvo]?.obs ?? "", foto: id } }));
      setStatus("Foto anexada.");
    } catch (e) { setStatus(mensagemErroFrota10a(e)); }
    finally { setSubindo(false); if (cameraFoto.current) cameraFoto.current.value = ""; }
  }
  function enviarChecklist(v: CaminhaoApp10a) {
    const lista = itens.map(i => ({ codigo: i.codigo, situacao: respostas[i.codigo]?.s ?? "", obs: respostas[i.codigo]?.obs.trim() ?? "", ...(respostas[i.codigo]?.s === "N" && respostas[i.codigo]?.foto ? { foto: respostas[i.codigo]?.foto } : {}) }));
    if (lista.some(r => r.situacao === "")) { setStatus("Responda todos os itens: C (conforme), N (não conforme) ou NA."); return; }
    if (lista.some(r => r.situacao === "N" && r.obs.length < 3)) { setStatus("Nos itens com N, escreva o que está errado."); return; }
    if (!ciente) { setStatus("Marque que você está ciente."); return; }
    void rodar(async () => {
      const r = await ref.current.checklist(v.id, local.trim(), obs.trim(), lista as RespostaChecklist10a[], chave.current!);
      return r === "liberado" ? "Checklist feito. Caminhão liberado." : r === "ressalvas" ? "Checklist feito com ressalvas. O engenheiro foi avisado." : "ATENÇÃO: caminhão NÃO liberado. Avise o engenheiro.";
    });
  }
  function enviarSaida(v: CaminhaoApp10a) {
    const k = lerKm(km);
    if (destino.trim().length < 2) { setStatus("Informe o destino."); return; }
    if (k === null || k < v.km_atual) { setStatus(`O km deve ser ${v.km_atual.toLocaleString("pt-BR")} ou mais.`); return; }
    void rodar(async () => { await ref.current.saida(v.id, destino.trim(), acomp.trim(), k, obs.trim(), chave.current!); return "Saída registrada. Boa viagem!"; });
  }
  function enviarChegada(v: CaminhaoApp10a) {
    const k = lerKm(km);
    if (k === null || k < v.km_atual) { setStatus(`O km deve ser ${v.km_atual.toLocaleString("pt-BR")} ou mais.`); return; }
    if (problema.trim() && problema.trim().length < 3) { setStatus("Descreva o problema com pelo menos 3 letras."); return; }
    if (v.minha_viagem === null) return;
    const viagem = v.minha_viagem;
    void rodar(async () => { const fotoOk = await ref.current.chegada(viagem, k, problema.trim(), obs.trim(), chave.current!, problema.trim() && fotoChegada ? fotoChegada : undefined);
      return problema.trim() ? `Chegada registrada. O problema foi avisado e o caminhão ficou não liberado.${fotoOk ? "" : " A foto não foi anexada: avise o engenheiro."}` : "Chegada registrada."; });
  }

  const rotuloBotao = { C: "C", N: "N", NA: "NA" } as const;
  const veiculoAtual = modo.tipo === "lista" ? null : modo.v;
  return <section className={styles.records} aria-labelledby="frota-title">
    <input ref={cameraFoto} type="file" accept="image/*" capture="environment" hidden onChange={e => { if (veiculoAtual) void fotoEscolhida(e.target.files?.[0], veiculoAtual); }}/>
    <div className={styles.recordsHeading}><Truck size={25} aria-hidden/><div><h2 id="frota-title">Caminhões</h2><p>Checklist do dia, saída e chegada do munck.</p></div></div>
    <p role="status" aria-live="polite" className={styles.pointState}>{status}</p>

    {modo.tipo === "lista" && <>
      {caminhoes.length === 0 && !status && <p>Nenhum caminhão cadastrado.</p>}
      <ul className={styles.frotaLista}>{caminhoes.map(v => {
        const minha = v.minha_viagem !== null, pode = v.situacao === "disponivel";
        return <li key={v.id} className={v.situacao === "nao_liberado" || v.situacao === "manutencao" ? styles.frotaRuim : v.situacao === "em_uso" ? styles.frotaAtencao : undefined}>
          <div><strong>{v.nome}</strong><small>{v.placa} · {v.km_atual.toLocaleString("pt-BR")} km</small>
            <span className={styles.frotaSituacao}>{minha ? "Com você" : ROTULO_SITUACAO_FROTA_10A[v.situacao]}</span>
            {v.situacao === "em_uso" && !minha && <small>Com {v.motorista ?? "outra pessoa"} · foi para {v.destino}{v.saida_em ? ` · saiu ${quando(v.saida_em)}` : ""}</small>}
            {v.situacao === "nao_liberado" && <small>Não liberado. Fale com o engenheiro.</small>}
            {v.situacao === "manutencao" && <small>Está na oficina.</small>}
            {pode && <small>Checklist de hoje: {v.checklist_hoje ? ROTULO_RESULTADO_10A[v.checklist_hoje] : "ainda não feito"}</small>}</div>
          <div className={styles.frotaBotoes}>
            {minha && <button type="button" className={styles.recordsDownload} onClick={() => abrir("chegada", v)}>Registrar chegada</button>}
            {(pode || v.situacao === "nao_liberado") && <button type="button" className={styles.recordsButton} onClick={() => abrir("checklist", v)}>{v.checklist_hoje ? "Refazer checklist" : "Fazer checklist"}</button>}
            {pode && v.checklist_hoje && v.checklist_hoje !== "nao_liberado" && <button type="button" className={styles.recordsDownload} onClick={() => abrir("saida", v)}>Registrar saída</button>}
          </div></li>; })}</ul>
      <h3>Minhas últimas saídas</h3>
      {viagens.length === 0 ? <p>Nenhuma saída ainda.</p> : <ul className={styles.pedidosLista}>{viagens.map(t => <li key={t.id}><div><strong>{t.veiculo} · {t.destino}</strong>
        <small>Saiu {quando(t.saida_em)} ({t.km_saida.toLocaleString("pt-BR")} km){t.chegada_em ? ` · voltou ${quando(t.chegada_em)} (${t.km_chegada?.toLocaleString("pt-BR")} km)` : " · ainda na rua"}</small></div></li>)}</ul>}
    </>}

    {modo.tipo === "checklist" && <div className={styles.frotaForm}>
      <h3>Checklist · {modo.v.nome}</h3>
      <p>C = conforme · N = não conforme (escreva o problema) · NA = não se aplica</p>
      <ol className={styles.frotaItens}>{itens.map(i => { const r = respostas[i.codigo] ?? { s: "", obs: "" };
        return <li key={i.codigo} className={r.s === "N" ? styles.frotaRuim : undefined}>
          <span>{i.codigo}. {i.nome}{i.critico ? " ⚠" : ""}</span>
          <div className={styles.frotaCNA} role="group" aria-label={i.nome}>{(["C", "N", "NA"] as const).map(s =>
            <button key={s} type="button" aria-pressed={r.s === s} className={r.s === s ? `${styles.frotaCNAativo} ${s === "N" ? styles.frotaCNAruim : ""}` : undefined}
              onClick={() => setRespostas(a => ({ ...a, [i.codigo]: { s, obs: a[i.codigo]?.obs ?? "", foto: s === "N" ? a[i.codigo]?.foto : undefined } }))}>{rotuloBotao[s]}</button>)}</div>
          {r.s === "N" && <><input aria-label={`O que está errado: ${i.nome}`} placeholder="O que está errado?" maxLength={200} value={r.obs} onChange={e => setRespostas(a => ({ ...a, [i.codigo]: { s: "N", obs: e.target.value, foto: a[i.codigo]?.foto } }))}/>
            <button type="button" className={styles.recordsButton} disabled={subindo || enviando} onClick={() => pedirFoto(i.codigo)}><Camera size={20} aria-hidden/>{r.foto ? "Foto anexada ✓ (trocar)" : "Tirar foto do defeito"}</button></>}
        </li>; })}</ol>
      <label>Local (opcional)<input value={local} onChange={e => setLocal(e.target.value)} maxLength={80} placeholder="Ex.: pátio da empresa"/></label>
      <label>Observação geral (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={300}/></label>
      <label className={styles.frotaCiente}><input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)}/> Estou ciente de que o item marcado como crítico pode impedir a saída do caminhão.</label>
      <div className={styles.frotaBotoes}><button type="button" className={styles.recordsDownload} disabled={enviando || subindo} onClick={() => enviarChecklist(modo.v)}>{enviando ? "Enviando…" : "Enviar checklist"}</button>
        <button type="button" className={styles.recordsButton} disabled={enviando} onClick={voltar}>Voltar</button></div>
    </div>}

    {modo.tipo === "saida" && <div className={styles.pedidoForm}>
      <h3>Saída · {modo.v.nome}</h3>
      <label>Para onde vai?<input value={destino} onChange={e => setDestino(e.target.value)} maxLength={120} placeholder="Ex.: Obra do galpão, cidade"/></label>
      <label>Com quem? (opcional)<input value={acomp} onChange={e => setAcomp(e.target.value)} maxLength={120} placeholder="Nomes de quem vai junto"/></label>
      <label>Km do painel agora<input inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} maxLength={9}/></label>
      <label>Observação (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={200}/></label>
      <div className={styles.frotaBotoes}><button type="button" className={styles.recordsDownload} disabled={enviando} onClick={() => enviarSaida(modo.v)}>{enviando ? "Enviando…" : "Registrar saída"}</button>
        <button type="button" className={styles.recordsButton} disabled={enviando} onClick={voltar}>Voltar</button></div>
    </div>}

    {modo.tipo === "chegada" && <div className={styles.pedidoForm}>
      <h3>Chegada · {modo.v.nome}</h3>
      <label>Km do painel agora<input inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} maxLength={9}/></label>
      <label>O caminhão teve algum problema? (deixe vazio se não)<input value={problema} onChange={e => setProblema(e.target.value)} maxLength={250} placeholder="Ex.: freio fazendo barulho"/></label>
      {problema.trim().length >= 3 && <button type="button" className={styles.recordsButton} disabled={subindo || enviando} onClick={() => pedirFoto("chegada")}><Camera size={20} aria-hidden/>{fotoChegada ? "Foto anexada ✓ (trocar)" : "Tirar foto do problema"}</button>}
      <label>Observação (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={200}/></label>
      <div className={styles.frotaBotoes}><button type="button" className={styles.recordsDownload} disabled={enviando || subindo} onClick={() => enviarChegada(modo.v)}>{enviando ? "Enviando…" : "Registrar chegada"}</button>
        <button type="button" className={styles.recordsButton} disabled={enviando} onClick={voltar}>Voltar</button></div>
    </div>}
  </section>;
}
