import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { horasMinutos, mesAnterior, mesAtual, mesSeguinte, mesValido, nomeDoMes, saldoTexto } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { resumoHoras4l, situacaoFechamento4l, TEXTO_SITUACAO_4L } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";
import { carregarMes4l, lerFechamentos4l } from "@/05_ACESSO_A_DADOS/Ponto/mes-4l";
import { fecharMes4l, fecharTodos4l, reabrirMes4l } from "@/app/actions/fechamento-4l";

// Marco 4L — Fechamento do mês + relatório de horas extras e faltas (teste online). Uma tela só, para não espalhar função.
const OK: Record<string, string> = { fechado: "Mês fechado. O funcionário recebe aviso no celular (se ligou os avisos) para conferir no app.",
  reaberto: "Mês reaberto. Corrija no espelho e feche de novo.", todos: "Fechamento feito." };
const ERRO: Record<string, string> = {
  conferir: "Essa pessoa tem dias para conferir (sem marcação ou faltando saída). Resolva no espelho ou marque “Fechar mesmo assim”.",
  "nao-terminou": "Esse mês ainda não terminou. Dá para ver o relatório, mas fechar só a partir do dia 1º do mês seguinte.",
  "ja-fechado": "Esse mês já estava fechado para essa pessoa.", desatualizado: "Chegou marcação nova enquanto a tela estava aberta. Confira e tente de novo.",
  motivo: "Escreva o motivo da reabertura (pelo menos 5 letras).", leitura: "Não foi possível ler o ponto agora. Tente de novo em instantes.",
  falhou: "Não foi possível salvar. Tente de novo.",
};
const dataHora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const h = (min: number) => (min ? horasMinutos(Math.abs(min)) : "—");

export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ mes?: string; ok?: string; erro?: string; feitos?: string; pulados?: string }> }) {
  await requireCapability("admin:manage");
  const query = await searchParams, atual = mesAtual();
  const mes = mesValido(query.mes) && query.mes! <= atual ? query.mes! : mesAnterior(atual);
  const terminou = mes < atual;
  const [{ pessoas, erro }, fechamentos] = await Promise.all([carregarMes4l(mes), lerFechamentos4l(mes).catch(() => null)]);
  const porPessoa = new Map((fechamentos ?? []).map(f => [f.employee_id, f]));
  const linhas = pessoas.map(p => ({ ...p, resumo: resumoHoras4l(p.espelho), fechamento: porPessoa.get(p.employee_id) }));
  const abertos = linhas.filter(l => !l.fechamento), prontos = abertos.filter(l => l.resumo.conferir === 0);
  const link = (m: string) => `/ponto-laboratorio/fechamento?mes=${m}`;
  const okTexto = query.ok === "todos" ? `Fechados agora: ${Number(query.feitos) || 0}. Ficaram abertos (têm dia para conferir): ${Number(query.pulados) || 0}.` : query.ok ? OK[query.ok] : null;
  return <>
    <PageHeader eyebrow="PONTO · TESTE SEM VALOR OFICIAL" title="Fechamento do mês"
      description="Horas extras, atrasos e faltas de cada pessoa no mês. Depois de conferir, feche o mês: o funcionário confere no app e diz se está certo."
      actions={<><Link className="button ghost" href={`/ponto-laboratorio/espelho?mes=${mes}`}>Espelho</Link>
        <a className="button secondary" href={`/ponto-laboratorio/fechamento/planilha?mes=${mes}`}><Download size={16} aria-hidden />Baixar planilha</a></>} />
    <nav className="espelho-mes" aria-label="Escolher mês">
      <Link className="button ghost" href={link(mesAnterior(mes))} aria-label="Mês anterior"><ChevronLeft size={18} aria-hidden />Anterior</Link>
      <strong>{nomeDoMes(mes)}</strong>
      {mes < atual ? <Link className="button ghost" href={link(mesSeguinte(mes))} aria-label="Próximo mês">Próximo<ChevronRight size={18} aria-hidden /></Link> : <span />}
    </nav>
    {erro && <div className="alert error" role="alert">{ERRO.leitura}</div>}
    {fechamentos === null && <div className="alert error" role="alert">Não foi possível ler os fechamentos agora.</div>}
    {okTexto && <div className="alert success" role="status">{okTexto}</div>}
    {query.erro && <div className="alert error" role="alert">{ERRO[query.erro] ?? ERRO.falhou}</div>}
    {!terminou && <p className="alert warn" role="status">{nomeDoMes(mes)} ainda não terminou: os números são até hoje. O fechamento fica liberado no dia 1º do mês seguinte.</p>}

    <section className="panel">
      <header className="panel-header"><div><h2>{linhas.length} funcionário(s)</h2>
        <p>{linhas.length - abertos.length} fechado(s) · {abertos.length} aberto(s){abertos.length > prontos.length ? ` · ${abertos.length - prontos.length} com dia para conferir` : ""}</p></div>
        {terminou && prontos.length > 0 && <form action={fecharTodos4l}><input type="hidden" name="mes" value={mes} />
          <button className="button primary" type="submit">Fechar todos sem pendência ({prontos.length})</button></form>}
      </header>
      {!linhas.length ? <div className="panel-body"><p className="muted">Nenhum funcionário.</p></div> :
      <div className="data-table-wrap"><table className="data-table fechamento-tabela">
        <thead><tr><th>Funcionário</th><th>Dias</th><th>Horas</th><th>Extra (50%)</th><th>Sábado (50%)</th><th>Domingo/feriado (100%)</th>
          <th>Atrasos</th><th>Faltas</th><th>Abonos</th><th>Conferir</th><th>Fechamento</th></tr></thead>
        <tbody>{linhas.map(l => { const r = l.resumo, f = l.fechamento, sit = situacaoFechamento4l(f); return <tr key={l.employee_id}>
          <td><span className="primary-cell">{l.nome}</span><span className="secondary-cell">{l.matricula ? `Matrícula ${l.matricula}` : "Sem matrícula"}</span>
            <Link className="secondary-cell" href={`/ponto-laboratorio/espelho?mes=${mes}&funcionario=${l.employee_id}`}>Ver espelho</Link></td>
          <td className="numeric">{r.diasTrabalhados}</td>
          <td className="numeric">{horasMinutos(r.minutos)}</td>
          <td className="numeric">{h(r.extra50)}{r.diasAcima2h > 0 && <span className="secondary-cell texto-alerta">{r.diasAcima2h} dia(s) com mais de 2h</span>}</td>
          <td className="numeric">{h(r.sabado)}</td>
          <td className="numeric">{h(r.domingoFeriado)}</td>
          <td className="numeric">{r.atrasos ? saldoTexto(r.atrasos) : "—"}</td>
          <td className="numeric">{r.faltas || "—"}</td>
          <td className="numeric">{r.abonos || "—"}</td>
          <td>{r.conferir ? <span className="status-badge warn">{r.conferir} dia(s)</span> : "—"}</td>
          <td className="fechamento-acao">
            <span className={sit === "contestado" || sit === "mudou" ? "status-badge warn" : sit === "confirmado" ? "status-badge good" : sit === "esperando" ? "status-badge" : undefined}>{TEXTO_SITUACAO_4L[sit]}</span>
            {f && <span className="secondary-cell">Fechado em {dataHora(f.fechado_em)}{f.respondido_em ? ` · respondeu em ${dataHora(f.respondido_em)}` : ""}{f.reaberturas ? ` · reaberto ${f.reaberturas}x antes` : ""}</span>}
            {f?.comentario && <span className="secondary-cell">O funcionário escreveu: {f.comentario}</span>}
            {!f && terminou && <form action={fecharMes4l} className="inline-action"><input type="hidden" name="mes" value={mes} /><input type="hidden" name="employeeId" value={l.employee_id} />
              {r.conferir > 0 && <label className="check-inline"><input type="checkbox" name="mesmoAssim" value="1" /> Fechar mesmo assim</label>}
              <button className="button secondary" type="submit">Fechar o mês</button></form>}
            {f && <details className="espelho-acao"><summary>Reabrir</summary>
              <form action={reabrirMes4l} className="inline-action"><input type="hidden" name="mes" value={mes} /><input type="hidden" name="fechamentoId" value={f.id} />
                <input name="motivo" required minLength={5} maxLength={300} placeholder="Motivo (ex.: faltou lançar atestado)" aria-label={`Motivo para reabrir o mês de ${l.nome}`} />
                <button className="button ghost" type="submit">Reabrir</button></form></details>}
          </td>
        </tr>; })}</tbody>
      </table></div>}
      <div className="panel-body"><p className="muted espelho-aviso">Teste sem valor oficial. As horas vêm do espelho (horário da empresa e tolerância da CLT de 5 min por marcação, 10 no dia).
        Percentuais são a regra geral da lei: hora extra em dia de trabalho e sábado fora da jornada, no mínimo 50%; domingo ou feriado trabalhado sem folga, em dobro.
        A convenção coletiva pode mudar — o DP confere. Mais de 2h extras no dia passa do limite da CLT (art. 59). Banco de horas ainda não entra aqui.
        Depois de fechado, atestado, falta e feriado daquele mês ficam travados até reabrir (fica registrado quem reabriu e o motivo).
        A confirmação do funcionário não tira o direito dele de reclamar depois.</p></div>
    </section>
  </>;
}
