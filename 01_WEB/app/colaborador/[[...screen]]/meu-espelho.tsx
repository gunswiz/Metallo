"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { recordsRequest } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { descreverJornada, horasMinutos, JORNADA_PADRAO, mesAnterior, mesAtual, mesSeguinte, montarEspelho, nomeDoMes, respostaEspelho, saldoTexto, TEXTO_SITUACAO, type Espelho, type Jornada } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import styles from "./colaborador.module.css";

// Marco 4E — "Meu espelho": as próprias marcações do mês, dia a dia, com as horas entre entrada e saída.
function mensagem(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return /SESSAO|REVOGAD|INATIVO|AUTORIZAD/.test(code) ? "Acesso encerrado. Entre novamente." : "Não foi possível abrir o espelho agora. Tente de novo quando estiver com internet.";
}

export function MeuEspelho({ getToken, readJornada }: { getToken: () => Promise<string>; readJornada?: () => Promise<Jornada> }) {
  const atual = mesAtual();
  const [mes, setMes] = useState(atual);
  const [espelho, setEspelho] = useState<Espelho | null>(null), [jornadaAtual, setJornadaAtual] = useState<Jornada>(JORNADA_PADRAO);
  const [status, setStatus] = useState(""), [loading, setLoading] = useState(true);
  const token = useRef(getToken), versao = useRef(0), jornadaRef = useRef(readJornada);
  useEffect(() => { token.current = getToken; jornadaRef.current = readJornada; }, [getToken, readJornada]);
  const carregar = useCallback(async (alvo: string, signal: AbortSignal) => {
    const id = ++versao.current;
    try {
      const response = await recordsRequest("/espelho", await token.current(), { method: "POST", body: JSON.stringify({ month: alvo }), signal });
      const dados = respostaEspelho.parse(await response.json());
      const jornada = await (jornadaRef.current?.() ?? Promise.resolve(JORNADA_PADRAO)).catch(() => JORNADA_PADRAO);
      if (id === versao.current) { setJornadaAtual(jornada); setEspelho(montarEspelho(dados.events, alvo, new Date(), jornada)); setStatus(""); setLoading(false); }
    } catch (error) { if (!signal.aborted && id === versao.current) { setEspelho(null); setStatus(mensagem(error)); setLoading(false); } }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => { setLoading(true); void carregar(mes, controller.signal); }, 0);
    return () => { controller.abort(); clearTimeout(t); versao.current += 1; };
  }, [mes, carregar]);
  const dias = espelho?.dias.filter(d => !d.futuro && (d.horarios.length || d.situacao === "sem_marcacao")) ?? [];
  return <section className={styles.records} aria-labelledby="meu-espelho-title">
    <div className={styles.recordsHeading}><CalendarDays size={25} aria-hidden/><div><h2 id="meu-espelho-title">Meu espelho de ponto</h2><p>Seus horários do mês, dia por dia.</p></div></div>
    <nav className={styles.espelhoMes} aria-label="Escolher mês">
      <button type="button" className={styles.recordsButton} onClick={() => setMes(mesAnterior(mes))} aria-label="Mês anterior"><ChevronLeft size={22} aria-hidden/></button>
      <strong>{nomeDoMes(mes)}</strong>
      <button type="button" className={styles.recordsButton} onClick={() => setMes(mesSeguinte(mes))} disabled={mes >= atual} aria-label="Próximo mês"><ChevronRight size={22} aria-hidden/></button>
    </nav>
    <p role="status" aria-live="polite" className={styles.pointState}>{loading ? "Abrindo o espelho…" : status}</p>
    {!loading && espelho && <>
      <div className={styles.espelhoTotais}>
        <div><span>Dias trabalhados</span><strong>{espelho.totais.diasComMarcacao}</strong></div>
        <div><span>Horas registradas</span><strong>{horasMinutos(espelho.totais.minutos)}</strong></div>
        <div className={styles.espelhoSaldo}><span>Saldo do mês (comparado ao horário da empresa)</span><strong>{saldoTexto(espelho.totais.saldo)}</strong></div>
      </div>
      {espelho.totais.diasImpares > 0 && <p className={styles.espelhoAlerta}>Em {espelho.totais.diasImpares} dia(s) falta uma marcação (por exemplo, a saída). Avise o escritório.</p>}
      {!dias.length ? <p>Nenhuma marcação neste mês.</p> : <ul className={styles.espelhoDias}>{dias.map(d => <li key={d.data} className={d.situacao === "falta_marcar" || d.situacao === "sem_marcacao" ? styles.espelhoDiaImpar : undefined}>
        <div><strong>{d.data.slice(8)}/{d.data.slice(5, 7)}</strong><small>{d.diaSemana}</small></div>
        <p>{d.horarios.length ? d.horarios.join("  ·  ") : "Sem marcação"}</p>
        <b>{d.saldo !== null ? saldoTexto(d.saldo) : d.minutos ? horasMinutos(d.minutos) : "—"}</b>
        {TEXTO_SITUACAO[d.situacao] && <small className={styles.espelhoFalta}>{d.situacao === "sem_marcacao" ? "Sem marcação neste dia. Se foi folga, atestado ou feriado, está tudo certo." : TEXTO_SITUACAO[d.situacao]}</small>}
      </li>)}</ul>}
      <p className={styles.signatureNote}>Horário da empresa: {descreverJornada(jornadaAtual)}. Diferença de até 5 minutos por marcação (10 no dia) não conta.</p>
    </>}
    <p className={styles.signatureNote}>Espelho de teste, sem valor oficial. O valor da hora extra e o banco de horas são calculados pelo escritório.</p>
  </section>;
}
