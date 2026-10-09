import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { BotaoImprimir } from "@/02_COMPONENTES_VISUAIS/botao-imprimir";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { descreverJornada, espelhosPorFuncionario, horasMinutos, mesAnterior, mesAtual, mesSeguinte, mesValido, nomeDoMes, saldoTexto, TEXTO_SITUACAO } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { lerJornada4g } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { readPointMirror } from "@/05_ACESSO_A_DADOS/Ponto/ponto-gestao";

// Marco 4E — Espelho de ponto (teste online): marcações originais organizadas por dia. Nada é alterado aqui.
export default async function EspelhoPontoPage({ searchParams }: { searchParams: Promise<{ mes?: string; funcionario?: string }> }) {
  await requireCapability("admin:manage");
  const query = await searchParams;
  const atual = mesAtual();
  const mes = mesValido(query.mes) && query.mes! <= atual ? query.mes! : atual;
  const leitura = await readPointMirror(mes).then(eventos => ({ eventos, erro: false }), () => ({ eventos: [], erro: true }));
  const { eventos, erro } = leitura;
  const jornada = await lerJornada4g();
  const pessoas = espelhosPorFuncionario(eventos, mes, new Date(), jornada);
  const escolhido = pessoas.find(p => p.employee_id === query.funcionario);
  const link = (m: string, f?: string) => `/ponto-laboratorio/espelho?mes=${m}${f ? `&funcionario=${f}` : ""}`;
  return <>
    <PageHeader eyebrow="PONTO · TESTE SEM VALOR OFICIAL" title="Espelho de ponto"
      description="As marcações de cada pessoa organizadas por dia, com as horas entre entrada e saída. Os registros originais não são alterados."
      actions={<><Link className="button ghost nao-imprimir" href="/ponto-laboratorio">Ver marcações</Link>{escolhido && <BotaoImprimir />}</>} />
    <nav className="espelho-mes nao-imprimir" aria-label="Escolher mês">
      <Link className="button ghost" href={link(mesAnterior(mes), escolhido?.employee_id)} aria-label="Mês anterior"><ChevronLeft size={18} aria-hidden />Anterior</Link>
      <strong>{nomeDoMes(mes)}</strong>
      {mes < atual ? <Link className="button ghost" href={link(mesSeguinte(mes), escolhido?.employee_id)} aria-label="Próximo mês">Próximo<ChevronRight size={18} aria-hidden /></Link> : <span />}
    </nav>
    {erro && <div className="alert error" role="alert">Não foi possível ler o ponto agora. Tente de novo em instantes.</div>}

    {!escolhido ? <section className="panel">
      <header className="panel-header"><div><h2>{pessoas.length} pessoa(s) com marcação em {nomeDoMes(mes).toLocaleLowerCase("pt-BR")}</h2>
        <p>Horário da empresa: {descreverJornada(jornada)}. &quot;Saldo&quot; compara com esse horário (tolerância da CLT aplicada). &quot;Falta marcar&quot; = entrada sem saída.</p></div></header>
      {pessoas.length === 0 ? <div className="panel-body"><p className="muted">Nenhuma marcação neste mês.</p></div> :
      <div className="data-table-wrap"><table className="data-table espelho-resumo">
        <thead><tr><th>Funcionário</th><th>Dias com marcação</th><th>Horas registradas</th><th>Saldo</th><th>Falta marcar</th><th></th></tr></thead>
        <tbody>{pessoas.map(p => <tr key={p.employee_id}>
          <td><span className="primary-cell">{p.nome}</span><span className="secondary-cell">{p.matricula ? `Matrícula ${p.matricula}` : "Sem matrícula"}</span></td>
          <td className="numeric">{p.espelho.totais.diasComMarcacao}</td>
          <td className="numeric">{horasMinutos(p.espelho.totais.minutos)}</td>
          <td className="numeric">{saldoTexto(p.espelho.totais.saldo)}</td>
          <td>{p.espelho.totais.diasImpares ? <span className="status-badge warn">{p.espelho.totais.diasImpares} dia(s)</span> : "—"}</td>
          <td><Link className="button secondary" href={link(mes, p.employee_id)}>Ver espelho</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </section> : <section className="panel espelho-folha">
      <header className="panel-header"><div><h2>{escolhido.nome}</h2>
        <p>{escolhido.matricula ? `Matrícula ${escolhido.matricula} · ` : ""}{nomeDoMes(mes)} · horário de Fortaleza (UTC−03:00), hora do servidor</p></div>
        <Link className="button ghost nao-imprimir" href={link(mes)}>Voltar para a lista</Link></header>
      <div className="panel-body">
        <dl className="espelho-totais">
          <div><dt>Dias com marcação</dt><dd>{escolhido.espelho.totais.diasComMarcacao}</dd></div>
          <div><dt>Horas registradas</dt><dd>{horasMinutos(escolhido.espelho.totais.minutos)}</dd></div>
          <div><dt>Passou do horário</dt><dd>{saldoTexto(escolhido.espelho.totais.extras)}</dd></div>
          <div><dt>Faltou tempo</dt><dd>{saldoTexto(escolhido.espelho.totais.atrasos)}</dd></div>
          <div><dt>Saldo do mês</dt><dd>{saldoTexto(escolhido.espelho.totais.saldo)}</dd></div>
          <div><dt>Dias com falta de marcação</dt><dd>{escolhido.espelho.totais.diasImpares}</dd></div>
          <div><dt>Dias úteis sem marcação</dt><dd>{escolhido.espelho.totais.diasSemMarcacao}</dd></div>
        </dl>
      </div>
      <div className="data-table-wrap"><table className="data-table espelho-dias">
        <thead><tr><th>Dia</th><th>Previsto</th><th>Marcações</th><th>Horas</th><th>Saldo</th><th>Observação</th></tr></thead>
        <tbody>{escolhido.espelho.dias.filter(d => !d.futuro).map(d => <tr key={d.data} className={d.domingo ? "espelho-domingo" : undefined}>
          <td><strong>{d.data.slice(8)}/{d.data.slice(5, 7)}</strong> <span className="secondary-cell">{d.diaSemana}</span></td>
          <td className="secondary-cell">{d.previsto ? horasMinutos(d.previsto) : "Folga"}</td>
          <td>{d.horarios.length ? d.horarios.join(" · ") : "—"}</td>
          <td className="numeric">{d.minutos ? horasMinutos(d.minutos) : "—"}</td>
          <td className="numeric">{d.saldo !== null ? saldoTexto(d.saldo) : "—"}</td>
          <td>{TEXTO_SITUACAO[d.situacao]}</td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total</th><td>{horasMinutos(escolhido.espelho.totais.previsto)}</td><td>{escolhido.espelho.totais.marcacoes} marcações</td><td className="numeric">{horasMinutos(escolhido.espelho.totais.minutos)}</td><td className="numeric">{saldoTexto(escolhido.espelho.totais.saldo)}</td><td></td></tr></tfoot>
      </table></div>
      <div className="panel-body"><p className="muted espelho-aviso">Espelho de teste, sem valor oficial. Saldo = horas feitas menos o horário da empresa ({descreverJornada(jornada)}),
        com a tolerância da CLT (até 5 min por marcação, 10 no dia). O valor da hora extra (adicional), banco de horas, feriados e atestados ficam com o DP.
        Não substitui o controle de ponto que a empresa usa hoje.</p></div>
    </section>}
  </>;
}
