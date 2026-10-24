"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardCheck, Search, Truck } from "lucide-react";
import { prepararFoto } from "@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6";
import { mensagemErroFrota10a, ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, type CaminhaoApp10a, type ItemChecklist10a, type RespostaChecklist10a, type ViagemApp10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import styles from "./colaborador.module.css";

type Acoes = {
  caminhoes: () => Promise<CaminhaoApp10a[]>; itens: () => Promise<ItemChecklist10a[]>; viagens: () => Promise<ViagemApp10a[]>;
  checklist: (veiculo: number, local: string, obs: string, respostas: RespostaChecklist10a[], chave: string) => Promise<"liberado" | "ressalvas" | "nao_liberado">;
  saida: (veiculo: number, destino: string, acompanhantes: string, km: number, obs: string, chave: string) => Promise<void>;
  foto: (veiculo: number, arquivo: Blob) => Promise<string>;
  chegada: (viagem: number, km: number, problema: string, obs: string, chave: string, foto?: string, veiculo?: number) => Promise<boolean>;
};
type Modo = { tipo: "lista" } | { tipo: "checklist" | "saida" | "chegada"; v: CaminhaoApp10a };

const RASCUNHO = "metallo-frota-rascunho";
type Rascunho = { em: number; tipo: "checklist" | "saida" | "chegada"; veiculo: number; etapa: number; respostas: Record<number, { s: "C" | "N" | "NA" | ""; obs: string; foto?: string }>; local: string; obs: string; ciente: boolean; destino: string; acomp: string; km: string; problema: string; fotoChegada: string | null; chave: string | null; fotoPendente: boolean };
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const lerKm = (t: string) => { const l = t.trim().replace(/\./g, ""); return /^\d{1,7}$/.test(l) ? Number(l) : null; };

// Marco 10A — "Caminhões": checklist do dia, saída e chegada do munck. Sem localização.
export function Frota({ acoes }: { acoes: Acoes }) {
  const [caminhoes, setCaminhoes] = useState<CaminhaoApp10a[]>([]), [itens, setItens] = useState<ItemChecklist10a[]>([]), [viagens, setViagens] = useState<ViagemApp10a[]>([]);
  const [modo, setModo] = useState<Modo>({ tipo: "lista" }), [status, setStatus] = useState("Carregando…"), [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState(""), [filtro, setFiltro] = useState("todos"), [etapa, setEtapa] = useState(0), [historicoCompleto, setHistoricoCompleto] = useState(false);
  const [carregando, setCarregando] = useState(true), [erroCarga, setErroCarga] = useState(false);
  const tituloForm = useRef<HTMLHeadingElement>(null), envioAtivo = useRef(false);
  const [respostas, setRespostas] = useState<Record<number, { s: "C" | "N" | "NA" | ""; obs: string; foto?: string }>>({}), [fotoChegada, setFotoChegada] = useState<string | null>(null), [subindo, setSubindo] = useState(false), alvoFoto = useRef<number | "chegada" | null>(null), cameraFoto = useRef<HTMLInputElement>(null), [local, setLocal] = useState(""), [obs, setObs] = useState(""), [ciente, setCiente] = useState(false);
  const [destino, setDestino] = useState(""), [acomp, setAcomp] = useState(""), [km, setKm] = useState(""), [problema, setProblema] = useState("");
  const ref = useRef(acoes), chave = useRef<string | null>(null);
  useEffect(() => { ref.current = acoes; }, [acoes]);
  const restaurado = useRef(false);
  function restaurar(lista: CaminhaoApp10a[], itensCarregados: ItemChecklist10a[]) {
    if (restaurado.current || !lista.length || !itensCarregados.length) return;
    restaurado.current = true;
    try {
      const bruto = sessionStorage.getItem(RASCUNHO); if (!bruto) return;
      const d = JSON.parse(bruto) as Rascunho;
      const v = lista.find(c => c.id === d.veiculo);
      if (!v || Date.now() - d.em > 2 * 3600 * 1000 || !["checklist", "saida", "chegada"].includes(d.tipo)) { sessionStorage.removeItem(RASCUNHO); return; }
      chave.current = d.chave; setEtapa(d.etapa); setRespostas(d.respostas); setLocal(d.local); setObs(d.obs); setCiente(d.ciente); setDestino(d.destino); setAcomp(d.acomp); setKm(d.km); setProblema(d.problema); setFotoChegada(d.fotoChegada);
      setModo({ tipo: d.tipo, v });
      return d.fotoPendente ? "A foto não chegou. Toque em Tirar foto de novo; o resto do checklist foi mantido." : "Continue de onde parou.";
    } catch { /* sem rascunho */ }
  }
  const carregar = useCallback(async () => {
    setCarregando(true); setErroCarga(false);
    try { const [c, i, t] = await Promise.all([ref.current.caminhoes(), ref.current.itens(), ref.current.viagens()]); setCaminhoes(c); setItens(i); setViagens(t); setStatus(restaurar(c, i) ?? ""); }
    catch { setErroCarga(true); setStatus("Não foi possível atualizar os caminhões. Tente de novo."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void carregar(), 0); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => { if (modo.tipo !== "lista") tituloForm.current?.focus(); }, [modo.tipo, etapa]);

  // Ao abrir a câmera, o celular pode recarregar a página e apagar o que já foi marcado. O rascunho fica só nesta aba, sem dados pessoais, e é apagado ao enviar ou voltar.
  useEffect(() => {
    if (modo.tipo === "lista") return;
    try { sessionStorage.setItem(RASCUNHO, JSON.stringify({ em: Date.now(), tipo: modo.tipo, veiculo: modo.v.id, etapa, respostas, local, obs, ciente, destino, acomp, km, problema, fotoChegada, chave: chave.current, fotoPendente: alvoFoto.current !== null && subindo } satisfies Rascunho)); } catch { /* sem armazenamento */ }
  }, [modo, etapa, respostas, local, obs, ciente, destino, acomp, km, problema, fotoChegada, subindo]);
  const limparRascunho = () => { try { sessionStorage.removeItem(RASCUNHO); } catch { /* ok */ } };

  function abrir(tipo: "checklist" | "saida" | "chegada", v: CaminhaoApp10a) {
    chave.current = null; setEtapa(0); setStatus(""); setKm(String(v.km_atual)); setDestino(""); setAcomp(""); setProblema(""); setObs(""); setLocal(""); setCiente(false); setFotoChegada(null);
    setRespostas(Object.fromEntries(itens.map(i => [i.codigo, { s: "" as const, obs: "", foto: undefined as string | undefined }]))); setModo({ tipo, v });
  }
  const voltar = () => { if (enviando || subindo) return; limparRascunho(); chave.current = null; setStatus(""); setModo({ tipo: "lista" }); };
  async function rodar(fn: () => Promise<string>) {
    if (envioAtivo.current || subindo) return;
    envioAtivo.current = true;
    setEnviando(true); setStatus(""); chave.current ??= crypto.randomUUID();
    try { const msg = await fn(); limparRascunho(); chave.current = null; setModo({ tipo: "lista" }); await carregar(); setStatus(msg); }
    catch (e) { setStatus(mensagemErroFrota10a(e)); }
    finally { setEnviando(false); envioAtivo.current = false; }
  }
  function pedirFoto(alvo: number | "chegada") { alvoFoto.current = alvo; try { const b = sessionStorage.getItem(RASCUNHO); if (b) sessionStorage.setItem(RASCUNHO, JSON.stringify({ ...JSON.parse(b), fotoPendente: true })); } catch { /* ok */ } cameraFoto.current?.click(); }
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
    if (!itens.length) { setStatus("Os itens do checklist não estão disponíveis. Volte e atualize a lista."); return; }
    const lista = itens.map(i => ({ codigo: i.codigo, situacao: respostas[i.codigo]?.s ?? "", obs: respostas[i.codigo]?.obs.trim() ?? "", ...(respostas[i.codigo]?.s === "N" && respostas[i.codigo]?.foto ? { foto: respostas[i.codigo]?.foto } : {}) }));
    if (lista.some(r => r.situacao === "")) { setStatus("Responda todos os itens: Conforme, Problema ou Não se aplica."); return; }
    if (lista.some(r => r.situacao === "N" && r.obs.length < 3)) { setStatus("Nos itens com problema, escreva o que está errado."); return; }
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
    void rodar(async () => { const fotoOk = await ref.current.chegada(viagem, k, problema.trim(), obs.trim(), chave.current!, problema.trim() && fotoChegada ? fotoChegada : undefined, v.id);
      return problema.trim() ? `Chegada registrada. O problema foi avisado e o caminhão ficou não liberado.${fotoOk ? "" : " A foto não foi anexada: avise o engenheiro."}` : "Chegada registrada."; });
  }

  const rotuloBotao = { C: "Conforme", N: "Problema", NA: "Não se aplica" } as const;
  const veiculoAtual = modo.tipo === "lista" ? null : modo.v;
  const passos = Math.max(1, Math.ceil(itens.length / 5)), ultimoPasso = etapa === passos - 1;
  const itensDaEtapa = itens.slice(etapa * 5, etapa * 5 + 5);
  const respondidos = itens.filter(i => respostas[i.codigo]?.s).length;
  function proximaEtapa() {
    const pendente = itensDaEtapa.find(i => !respostas[i.codigo]?.s || (respostas[i.codigo].s === "N" && respostas[i.codigo].obs.trim().length < 3));
    if (pendente) { setStatus(`Confira o item ${pendente.codigo}: ${pendente.nome}. Escolha uma resposta e descreva o problema, se houver.`); return; }
    setStatus(""); setEtapa(e => Math.min(passos - 1, e + 1));
  }
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filtrados = caminhoes.filter(v => normalizar(`${v.nome} ${v.placa}`).includes(normalizar(busca)) && (filtro === "todos" || (filtro === "comigo" ? v.minha_viagem !== null : v.situacao === "disponivel"))).sort((a, b) => Number(b.minha_viagem !== null) - Number(a.minha_viagem !== null));
  return <section className={`${styles.records} ${styles.frotaPainel}`} aria-labelledby="frota-title" aria-busy={carregando || enviando}>
    <input ref={cameraFoto} type="file" accept="image/*" capture="environment" hidden onChange={e => { if (veiculoAtual) void fotoEscolhida(e.target.files?.[0], veiculoAtual); }}/>
    <div className={styles.recordsHeading}><Truck size={25} aria-hidden/><div><h2 id="frota-title">Caminhões</h2><p>{veiculoAtual ? `${veiculoAtual.nome} · ${veiculoAtual.placa}` : "Confira, registre a saída e boa viagem."}</p></div></div>
    {status && <p role="status" aria-live="polite" className={styles.pointState}>{status}</p>}
    {erroCarga && <button type="button" className={styles.recordsButton} disabled={carregando} onClick={() => void carregar()}>Tentar novamente</button>}

    {modo.tipo === "lista" && <>
      {!carregando && !erroCarga && caminhoes.length === 0 && <div className={styles.frotaVazio}><Truck size={32} aria-hidden/><h3>Nenhum caminhão disponível na lista</h3><p>Os veículos cadastrados pela Gestão aparecerão aqui.</p></div>}
      {caminhoes.length > 0 && <><div className={styles.frotaFiltros} role="group" aria-label="Filtrar caminhões">{[{ id: "todos", nome: "Todos" }, { id: "disponivel", nome: "Disponíveis" }, { id: "comigo", nome: "Com você" }].map(f => <button type="button" key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.nome}</button>)}</div>
      <label className={styles.frotaBusca}><Search size={18} aria-hidden/><input type="search" aria-label="Buscar caminhão ou placa" placeholder="Buscar nome ou placa" value={busca} onChange={e => setBusca(e.target.value)}/></label></>}
      {caminhoes.length > 0 && filtrados.length === 0 && <p className={styles.frotaVazio}>Nenhum caminhão neste filtro. <button type="button" className={styles.recordsButton} onClick={() => { setBusca(""); setFiltro("todos"); }}>Limpar filtros</button></p>}
      <ul className={styles.frotaLista}>{filtrados.map(v => {
        const minha = v.minha_viagem !== null, pode = v.situacao === "disponivel";
        return <li key={v.id} className={v.situacao === "nao_liberado" || v.situacao === "manutencao" ? styles.frotaRuim : v.situacao === "em_uso" ? styles.frotaAtencao : undefined}>
          <div><div className={styles.frotaCabecalho}><span className={styles.frotaIcone}><Truck size={25} aria-hidden/></span><span className={styles.frotaPlaca}>{v.placa}</span></div><strong>{v.nome}</strong><small>{v.km_atual.toLocaleString("pt-BR")} km no painel</small>
            <span className={styles.frotaSituacao}>{minha ? "Com você" : ROTULO_SITUACAO_FROTA_10A[v.situacao]}</span>
            {v.situacao === "em_uso" && !minha && <small>Com {v.motorista ?? "outra pessoa"} · foi para {v.destino}{v.saida_em ? ` · saiu ${quando(v.saida_em)}` : ""}</small>}
            {v.situacao === "nao_liberado" && <small>Não liberado. Fale com o engenheiro.</small>}
            {v.situacao === "manutencao" && <small>Está na oficina.</small>}
            {pode && <small>Checklist de hoje: {v.checklist_hoje ? ROTULO_RESULTADO_10A[v.checklist_hoje] : "ainda não feito"}</small>}</div>
          <div className={styles.frotaBotoes}>
            {minha && <button type="button" disabled={enviando || carregando} className={styles.recordsDownload} onClick={() => abrir("chegada", v)}>Registrar chegada</button>}
            {(pode || v.situacao === "nao_liberado") && <button type="button" disabled={enviando || carregando} className={v.checklist_hoje ? styles.recordsButton : styles.recordsDownload} onClick={() => abrir("checklist", v)}><ClipboardCheck size={18} aria-hidden/>{v.checklist_hoje ? "Refazer checklist" : "Fazer checklist"}</button>}
            {pode && v.checklist_hoje && v.checklist_hoje !== "nao_liberado" && <button type="button" disabled={enviando || carregando} className={styles.recordsDownload} onClick={() => abrir("saida", v)}>Registrar saída</button>}
          </div></li>; })}</ul>
      <details className={styles.frotaHistorico}><summary>Minhas últimas saídas <span>{viagens.length} registros</span></summary>
      {viagens.length === 0 ? <p>Nenhuma saída ainda.</p> : <ul className={styles.pedidosLista}>{(historicoCompleto ? viagens : viagens.slice(0, 5)).map(t => <li key={t.id}><div><strong>{t.veiculo} · {t.destino}</strong>
        <small>Saiu {quando(t.saida_em)} ({t.km_saida.toLocaleString("pt-BR")} km){t.chegada_em ? ` · voltou ${quando(t.chegada_em)} (${t.km_chegada?.toLocaleString("pt-BR")} km)` : " · ainda na rua"}</small></div></li>)}</ul>}
      {viagens.length > 5 && <button type="button" className={styles.recordsButton} aria-expanded={historicoCompleto} onClick={() => setHistoricoCompleto(!historicoCompleto)}>{historicoCompleto ? "Mostrar menos" : "Ver todas as saídas"}</button>}</details>
    </>}

    {modo.tipo === "checklist" && <div className={styles.frotaForm}>
      <h3 ref={tituloForm} tabIndex={-1}>Checklist · etapa {etapa + 1} de {passos}</h3>
      <div className={styles.frotaProgresso}><span>{respondidos} de {itens.length} itens respondidos</span><progress aria-label="Progresso do checklist" value={respondidos} max={itens.length || 1}/></div>
      <p>Confira cada item. Se houver problema, descreva o que encontrou.</p>
      {!itens.length && <p role="status">Os itens do checklist não estão disponíveis. Volte aos caminhões e atualize a página.</p>}
      <ol className={styles.frotaItens} start={etapa * 5 + 1}>{itensDaEtapa.map(i => { const r = respostas[i.codigo] ?? { s: "", obs: "" };
        return <li key={i.codigo} className={r.s === "N" ? styles.frotaRuim : undefined}>
          <span>{i.codigo}. {i.nome}{i.critico && <small className={styles.frotaCritico}>Crítico · problema impede a saída</small>}</span>
          <div className={styles.frotaCNA} role="group" aria-label={i.nome}>{(["C", "N", "NA"] as const).map(s =>
            <button key={s} type="button" disabled={subindo || enviando} aria-pressed={r.s === s} className={r.s === s ? `${styles.frotaCNAativo} ${s === "N" ? styles.frotaCNAruim : ""}` : undefined}
              onClick={() => setRespostas(a => ({ ...a, [i.codigo]: { s, obs: a[i.codigo]?.obs ?? "", foto: s === "N" ? a[i.codigo]?.foto : undefined } }))}>{r.s === s && <Check size={16} aria-hidden/>}{rotuloBotao[s]}</button>)}</div>
          {r.s === "N" && <><input aria-label={`O que está errado: ${i.nome}`} placeholder="O que está errado?" maxLength={200} value={r.obs} onChange={e => setRespostas(a => ({ ...a, [i.codigo]: { s: "N", obs: e.target.value, foto: a[i.codigo]?.foto } }))}/>
            <button type="button" className={styles.recordsButton} disabled={subindo || enviando} onClick={() => pedirFoto(i.codigo)}><Camera size={20} aria-hidden/>{r.foto ? "Foto anexada ✓ (trocar)" : "Tirar foto do defeito"}</button></>}
        </li>; })}</ol>
      {ultimoPasso && <><label>Local (opcional)<input value={local} onChange={e => setLocal(e.target.value)} maxLength={80} placeholder="Ex.: pátio da empresa"/></label>
      <label>Observação geral (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={300}/></label>
      <label className={styles.frotaCiente}><input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)}/> Estou ciente de que o item marcado como crítico pode impedir a saída do caminhão.</label></>}
      <div className={styles.frotaPassos}>{etapa > 0 && <button type="button" className={styles.recordsButton} disabled={enviando || subindo} onClick={() => { setStatus(""); setEtapa(e => e - 1); }}><ArrowLeft size={17} aria-hidden/>Anterior</button>}
        {ultimoPasso ? <button type="button" className={styles.recordsDownload} disabled={enviando || subindo || !itens.length} onClick={() => enviarChecklist(modo.v)}>{enviando ? "Enviando…" : "Enviar checklist"}</button> : <button type="button" className={styles.recordsDownload} disabled={enviando || subindo} onClick={proximaEtapa}>Continuar<ArrowRight size={17} aria-hidden/></button>}</div>
      <button type="button" className={styles.recordsButton} disabled={enviando || subindo} onClick={voltar}>Voltar aos caminhões</button>
    </div>}

    {modo.tipo === "saida" && <div className={styles.pedidoForm}>
      <h3 ref={tituloForm} tabIndex={-1}>Registrar saída</h3><p className={styles.frotaContexto}>{modo.v.nome} · {modo.v.placa}<br/>Última leitura: {modo.v.km_atual.toLocaleString("pt-BR")} km</p>
      <label>Para onde vai?<input value={destino} onChange={e => setDestino(e.target.value)} maxLength={120} placeholder="Ex.: Obra do galpão, cidade"/></label>
      <label>Com quem? (opcional)<input value={acomp} onChange={e => setAcomp(e.target.value)} maxLength={120} placeholder="Nomes de quem vai junto"/></label>
      <label>Km do painel agora<input inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} maxLength={9}/></label>
      <label>Observação (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={200}/></label>
      <div className={styles.frotaBotoes}><button type="button" className={styles.recordsDownload} disabled={enviando} onClick={() => enviarSaida(modo.v)}>{enviando ? "Enviando…" : "Registrar saída"}</button>
        <button type="button" className={styles.recordsButton} disabled={enviando} onClick={voltar}>Voltar</button></div>
    </div>}

    {modo.tipo === "chegada" && <div className={styles.pedidoForm}>
      <h3 ref={tituloForm} tabIndex={-1}>Registrar chegada</h3><p className={styles.frotaContexto}>{modo.v.nome} · {modo.v.placa}<br/>Última leitura: {modo.v.km_atual.toLocaleString("pt-BR")} km</p>
      <label>Km do painel agora<input inputMode="numeric" value={km} onChange={e => setKm(e.target.value)} maxLength={9}/></label>
      <label>O caminhão teve algum problema? (deixe vazio se não)<input value={problema} onChange={e => setProblema(e.target.value)} maxLength={250} placeholder="Ex.: freio fazendo barulho"/></label>
      {problema.trim().length >= 3 && <button type="button" className={styles.recordsButton} disabled={subindo || enviando} onClick={() => pedirFoto("chegada")}><Camera size={20} aria-hidden/>{fotoChegada ? "Foto anexada ✓ (trocar)" : "Tirar foto do problema"}</button>}
      <label>Observação (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={200}/></label>
      <div className={styles.frotaBotoes}><button type="button" className={styles.recordsDownload} disabled={enviando || subindo} onClick={() => enviarChegada(modo.v)}>{enviando ? "Enviando…" : "Registrar chegada"}</button>
        <button type="button" className={styles.recordsButton} disabled={enviando || subindo} onClick={voltar}>Voltar</button></div>
    </div>}
  </section>;
}
