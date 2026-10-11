"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, BellRing, CheckCircle2, ChevronRight, CircleHelp, Clock3, Megaphone, Menu, MoreVertical, Square, Volume2, WifiOff } from "lucide-react";
import { GUIA_FUNCIONARIO, partesDestaque, textoParaOuvir, type Figura, type TopicoGuia } from "@/03_FUNCOES_E_LOGICA/Guia/guia-funcionario";
import styles from "./colaborador.module.css";

// Marco 8A (Bloco 5) — "Como usar o app": passo a passo com o desenho do botão que a pessoa vai ver e leitura em voz alta.
const ICONE: Record<string, typeof Clock3> = { ponto: Clock3, "sem-internet": WifiOff, avisos: BellRing, "tela-inicio": MoreVertical };

function Texto({ texto }: { texto: string }) {
  return <>{partesDestaque(texto).map((p, i) => p.destaque ? <strong key={i} className={styles.guiaDestaque}>{p.texto}</strong> : <span key={i}>{p.texto}</span>)}</>;
}

/** Cópia visual do que aparece na tela (não faz nada ao tocar). */
export function FiguraGuia({ figura }: { figura: Figura }) {
  const caixa = (conteudo: React.ReactNode) => <div className={styles.guiaFigura} aria-hidden>{conteudo}</div>;
  switch (figura) {
    case "entrar": return caixa(<div className={styles.guiaCampos}><span>Usuário<i>seu usuário</i></span><span>Senha<i>••••••••</i></span><b className={styles.guiaBotaoAzul}>Entrar</b></div>);
    case "botao-ponto": return caixa(<b className={styles.guiaBotaoAzul}>Registrar ponto</b>);
    case "permitir": return caixa(<div className={styles.guiaDialogo}><p>Permitir que o site saiba a sua localização?</p><div><span>Não permitir</span><b>Permitir</b></div></div>);
    case "ponto-registrado": return caixa(<div className={styles.guiaRecibo}><CheckCircle2 size={22}/><strong>Ponto registrado</strong><span>07:00</span></div>);
    case "guardado": return caixa(<p className={styles.guiaGuardado}><WifiOff size={18}/> Sem internet. Seu ponto das 07:00 ficou guardado neste celular e será enviado sozinho quando a internet voltar.</p>);
    case "menu": return caixa(<div className={styles.guiaMenu}><span className={styles.guiaAlvo}><Menu size={26}/></span><span>Metallo</span></div>);
    case "comunicado": return caixa(<div className={styles.guiaLinha}><Megaphone size={22}/><strong>Comunicados</strong><ChevronRight size={20}/></div>);
    case "ligar-avisos": return caixa(<div className={styles.guiaCampos}><span className={styles.guiaLinha}><BellRing size={20}/><strong>Avisos no celular</strong></span><b className={styles.guiaBotaoAzul}>Ligar avisos</b></div>);
    case "instalar": return caixa(<div className={styles.guiaMenu}><span>metallo…</span><span className={styles.guiaAlvo}><MoreVertical size={24}/></span></div>);
  }
}

function useVoz() {
  const [disponivel, setDisponivel] = useState(false), [falando, setFalando] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDisponivel(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window), 0);
    return () => { clearTimeout(t); try { window.speechSynthesis?.cancel(); } catch { /* sem voz */ } };
  }, []);
  function ouvir(id: string, texto: string) {
    try {
      window.speechSynthesis.cancel();
      if (falando === id) { setFalando(null); return; }
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = "pt-BR"; fala.rate = 0.9;
      const voz = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith("pt"));
      if (voz) fala.voice = voz;
      fala.onend = () => setFalando(null); fala.onerror = () => setFalando(null);
      setFalando(id); window.speechSynthesis.speak(fala);
    } catch { setFalando(null); }
  }
  return { disponivel, falando, ouvir };
}

function Topico({ t, voltar }: { t: TopicoGuia; voltar: () => void }) {
  const voz = useVoz();
  return <section className={styles.records} aria-labelledby={`guia-${t.id}`}>
    <button type="button" className={styles.guiaVoltar} onClick={voltar}><ArrowLeft size={20} aria-hidden/> Voltar para a lista</button>
    <h2 id={`guia-${t.id}`} className={styles.guiaTitulo}>{t.titulo}</h2>
    <p className={styles.guiaResumo}>{t.resumo}</p>
    {voz.disponivel && <button type="button" className={styles.queueButton} onClick={() => voz.ouvir(t.id, textoParaOuvir(t))}>
      {voz.falando === t.id ? <><Square size={18} aria-hidden/> Parar</> : <><Volume2 size={20} aria-hidden/> Ouvir a explicação</>}</button>}
    <ol className={styles.guiaPassos}>{t.passos.map((p, i) => <li key={i}>
      <span className={styles.guiaNumero} aria-hidden>{i + 1}</span>
      <div><p><Texto texto={p.texto}/></p>{p.figura && <FiguraGuia figura={p.figura}/>}</div>
    </li>)}</ol>
    {t.dicas?.length ? <div className={styles.guiaDicas}><strong>Bom saber</strong><ul>{t.dicas.map(d => <li key={d}>{d}</li>)}</ul></div> : null}
    <button type="button" className={styles.primary} onClick={voltar}>Entendi</button>
  </section>;
}

export function ComoUsar() {
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    // Atalho: /colaborador/ajuda#ponto abre direto o assunto.
    const t = setTimeout(() => { const h = window.location.hash.slice(1); if (GUIA_FUNCIONARIO.some(g => g.id === h)) setAberto(h); }, 0);
    return () => clearTimeout(t);
  }, []);
  const topico = GUIA_FUNCIONARIO.find(g => g.id === aberto);
  if (topico) return <Topico t={topico} voltar={() => { setAberto(null); window.scrollTo(0, 0); }}/>;
  return <section className={styles.records} aria-labelledby="como-usar-titulo">
    <div className={styles.recordsHeading}><CircleHelp size={25} aria-hidden/><div><h2 id="como-usar-titulo">Como usar o app</h2><p>Escolha o que você quer aprender. É rápido.</p></div></div>
    <ul className={styles.documentosLista}>{GUIA_FUNCIONARIO.map(g => { const Icone = ICONE[g.id] ?? CircleHelp; return <li key={g.id}>
      <button type="button" className={styles.documentoBotao} onClick={() => { setAberto(g.id); window.scrollTo(0, 0); }}>
        <Icone size={26} aria-hidden/><span><strong>{g.titulo}</strong>{" "}<small>{g.resumo}</small></span></button></li>; })}</ul>
    <p className={styles.signatureNote}>Ainda com dúvida? Fale com o escritório. Ninguém do escritório pede a sua senha.</p>
  </section>;
}
