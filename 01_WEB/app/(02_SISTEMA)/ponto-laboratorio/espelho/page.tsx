import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { BotaoImprimir } from "@/02_COMPONENTES_VISUAIS/botao-imprimir";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { descreverJornada, horasMinutos, intervaloDoMes, mesAnterior, mesAtual, mesSeguinte, mesValido, montarEspelho, nomeDoMes, NOME_OCORRENCIA,
  saldoTexto, textoDoDia, TIPOS_OCORRENCIA, type MarcacaoEspelho, type TipoOcorrencia } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { readPointMirror } from "@/05_ACESSO_A_DADOS/Ponto/ponto-gestao";
import { lerCpfs4f, lerFeriados4h, lerJornada4g, lerOcorrencias4h } from "@/05_ACESSO_A_DADOS/Ponto/oficial-4f";
import { cancelarOcorrencia4h, salvarOcorrencia4h } from "@/app/actions/ponto-oficial";

// Marco 4E/4G/4H — Espelho de ponto (teste online): marcações originais por dia, saldo com a jornada da empresa,
// feriados e ocorrências lançadas pela Gestão. As marcações originais nunca são alteradas aqui.
export default async function EspelhoPontoPage({ searchParams }: { searchParams: Promise<{ mes?: string; funcionario?: string; ok?: string; erro?: string }> }) {
  await requireCapability("admin:manage");
  const query = await searchParams;
  const atual = mesAtual();
  const mes = mesValido(query.mes) && query.mes! <= atual ? query.mes! : atual;
  const { de, ate } = intervaloDoMes(mes);
  const leitura = await readPointMirror(mes).then(eventos => ({ eventos, erro: false }), () => ({ eventos: [] as MarcacaoEspelho[], erro: true }));
  const [jornada, feriadosLista, ocorrenciasLista, pessoasAtivas] = await Promise.all([lerJornada4g(), lerFeriados4h(de, ate),
    lerOcorrencias4h(de, ate).catch(() => []), lerCpfs4f().catch(() => [])]);
  const feriados = Object.fromEntries(feriadosLista.map(f => [f.data, f.nome]));
  const ocorrencias: Record<string, Record<string, { tipo: TipoOcorrencia; id: number }>> = {};
  for (const o of ocorrenciasLista) (ocorrencias[o.employee_id] ??= {})[o.data] = { tipo: o.tipo, id: o.id };
  // Todos os funcionários ativos aparecem (mesmo sem marcação), e quem marcou mas saiu da lista também.
  const nomes = new Map<string, { nome: string; matricula: string | null }>(pessoasAtivas.map(p => [p.employee_id, { nome: p.full_name, matricula: p.registration_code }]));
  for (const e of leitura.eventos) if (!nomes.has(e.employee_id)) nomes.set(e.employee_id, { nome: e.employee_name, matricula: e.employee_code });
  const pessoas = [...nomes.entries()].map(([id, p]) => ({ employee_id: id, ...p,
    espelho: montarEspelho(leitura.eventos.filter(e => e.employee_id === id), mes, new Date(), jornada, { feriados, ocorrencias: ocorrencias[id] ?? {} }) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const escolhido = pessoas.find(p => p.employee_id === query.funcionario);
  const link = (m: string, f?: string) => `/ponto-laboratorio/espelho?mes=${m}${f ? `&funcionario=${f}` : ""}`;
  return <>
    <PageHeader eyebrow="PONTO · TESTE SEM VALOR OFICIAL" title="Espelho de ponto"
      description="As marcações de cada pessoa organizadas por dia, com o saldo em relação ao horário da empresa. Os registros originais não são alterados."
      actions={<><Link className="button ghost nao-imprimir" href="/ponto-laboratorio">Ver marcações</Link>{escolhido && <BotaoImprimir />}</>} />
    <nav className="espelho-mes nao-imprimir" aria-label="Escolher mês">
      <Link className="button ghost" href={link(mesAnterior(mes), escolhido?.employee_id)} aria-label="Mês anterior"><ChevronLeft size={18} aria-hidden />Anterior</Link>
      <strong>{nomeDoMes(mes)}</strong>
      {mes < atual ? <Link className="button ghost" href={link(mesSeguinte(mes), escolhido?.employee_id)} aria-label="Próximo mês">Próximo<ChevronRight size={18} aria-hidden /></Link> : <span />}
    </nav>
    {leitura.erro && <div className="alert error" role="alert">Não foi possível ler o ponto agora. Tente de novo em instantes.</div>}
    {query.ok && <div className="alert success" role="status">{query.ok === "ocorrencia-cancelada" ? "Ocorrência cancelada (fica no histórico)." : "Ocorrência registrada."}</div>}
    {query.erro && <div className="alert error" role="alert">Não foi possível salvar a ocorrência. Confira e tente de novo.</div>}
    {feriadosLista.length > 0 && <p className="muted nao-imprimir">Feriados no mês: {feriadosLista.map(f => `${f.data.slice(8)}/${f.data.slice(5, 7)} ${f.nome}`).join(" · ")}.{" "}
      <Link href="/ponto-laboratorio/oficial#feriados">Cadastrar feriado estadual ou municipal</Link></p>}

    {!escolhido ? <section className="panel">
      <header className="panel-header"><div><h2>{pessoas.length} funcionário(s) em {nomeDoMes(mes).toLocaleLowerCase("pt-BR")}</h2>
        <p>Horário da empresa: {descreverJornada(jornada)}. &quot;Conferir&quot; = dias úteis sem marcação e sem ocorrência lançada (falta? atestado? férias?).</p></div></header>
      {pessoas.length === 0 ? <div className="panel-body"><p className="muted">Nenhum funcionário.</p></div> :
      <div className="data-table-wrap"><table className="data-table espelho-resumo">
        <thead><tr><th>Funcionário</th><th>Dias com marcação</th><th>Horas feitas</th><th>Saldo</th><th>Conferir</th><th></th></tr></thead>
        <tbody>{pessoas.map(p => { const t = p.espelho.totais; const conferir = t.diasSemMarcacao + t.diasImpares; return <tr key={p.employee_id}>
          <td><span className="primary-cell">{p.nome}</span><span className="secondary-cell">{p.matricula ? `Matrícula ${p.matricula}` : "Sem matrícula"}</span></td>
          <td className="numeric">{t.diasComMarcacao}</td>
          <td className="numeric">{horasMinutos(t.minutos)}</td>
          <td className="numeric">{saldoTexto(t.saldo)}</td>
          <td>{conferir ? <span className="status-badge warn">{conferir} dia(s)</span> : "—"}</td>
          <td><Link className="button secondary" href={link(mes, p.employee_id)}>Ver espelho</Link></td>
        </tr>; })}</tbody>
      </table></div>}
    </section> : <section className="panel espelho-folha">
      <header className="panel-header"><div><h2>{escolhido.nome}</h2>
        <p>{escolhido.matricula ? `Matrícula ${escolhido.matricula} · ` : ""}{nomeDoMes(mes)} · horário de Fortaleza (UTC−03:00), hora do servidor</p></div>
        <Link className="button ghost nao-imprimir" href={link(mes)}>Voltar para a lista</Link></header>
      <div className="panel-body">
        <dl className="espelho-totais">
          <div><dt>Dias com marcação</dt><dd>{escolhido.espelho.totais.diasComMarcacao}</dd></div>
          <div><dt>Horas feitas</dt><dd>{horasMinutos(escolhido.espelho.totais.minutos)}</dd></div>
          <div><dt>Passou do horário</dt><dd>{saldoTexto(escolhido.espelho.totais.extras)}</dd></div>
          <div><dt>Faltou tempo</dt><dd>{saldoTexto(escolhido.espelho.totais.atrasos)}</dd></div>
          <div><dt>Saldo do mês</dt><dd>{saldoTexto(escolhido.espelho.totais.saldo)}</dd></div>
          <div><dt>Faltas</dt><dd>{escolhido.espelho.totais.faltas}</dd></div>
          <div><dt>Abonos (atestado, férias, folga)</dt><dd>{escolhido.espelho.totais.abonos}</dd></div>
          <div><dt>Dias para conferir</dt><dd>{escolhido.espelho.totais.diasSemMarcacao + escolhido.espelho.totais.diasImpares}</dd></div>
        </dl>
      </div>
      <div className="data-table-wrap"><table className="data-table espelho-dias">
        <thead><tr><th>Dia</th><th>Previsto</th><th>Marcações</th><th>Horas</th><th>Saldo</th><th>Observação</th></tr></thead>
        <tbody>{escolhido.espelho.dias.filter(d => !d.futuro).map(d => <tr key={d.data} className={d.domingo || d.feriado ? "espelho-domingo" : undefined}>
          <td><strong>{d.data.slice(8)}/{d.data.slice(5, 7)}</strong> <span className="secondary-cell">{d.diaSemana}</span></td>
          <td className="secondary-cell">{d.previsto ? horasMinutos(d.previsto) : d.feriado ? "Feriado" : "Folga"}</td>
          <td>{d.horarios.length ? d.horarios.join(" · ") : "—"}</td>
          <td className="numeric">{d.minutos ? horasMinutos(d.minutos) : "—"}</td>
          <td className="numeric">{d.saldo !== null ? saldoTexto(d.saldo) : "—"}</td>
          <td>
            <span className={d.situacao === "sem_marcacao" || d.situacao === "falta_marcar" || d.situacao === "falta" ? "espelho-alerta" : undefined}>{textoDoDia(d)}</span>
            {d.ocorrencia?.id ? <form action={cancelarOcorrencia4h} className="nao-imprimir espelho-acao"><input type="hidden" name="ocorrenciaId" value={d.ocorrencia.id} />
              <input type="hidden" name="employeeId" value={escolhido.employee_id} /><input type="hidden" name="mes" value={mes} />
              <button className="button ghost" type="submit">Desfazer</button></form>
            : d.situacao !== "folga" && d.situacao !== "feriado" && d.situacao !== "em_andamento" && <details className="nao-imprimir espelho-acao"><summary>Lançar ocorrência</summary>
              <form action={salvarOcorrencia4h} className="inline-action"><input type="hidden" name="employeeId" value={escolhido.employee_id} /><input type="hidden" name="data" value={d.data} />
                <select name="tipo" aria-label={`Ocorrência do dia ${d.data.slice(8)}/${d.data.slice(5, 7)}`} defaultValue="atestado">
                  {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{NOME_OCORRENCIA[t]}</option>)}</select>
                <input name="observacao" maxLength={200} placeholder="Observação (não escreva doença nem CID)" aria-label="Observação" />
                <button className="button secondary" type="submit">Salvar</button></form></details>}
          </td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total</th><td>{horasMinutos(escolhido.espelho.totais.previsto)}</td><td>{escolhido.espelho.totais.marcacoes} marcações</td><td className="numeric">{horasMinutos(escolhido.espelho.totais.minutos)}</td><td className="numeric">{saldoTexto(escolhido.espelho.totais.saldo)}</td><td></td></tr></tfoot>
      </table></div>
      <div className="panel-body"><p className="muted espelho-aviso">Espelho de teste, sem valor oficial. Saldo = horas feitas menos o horário da empresa ({descreverJornada(jornada)}),
        com a tolerância da CLT (até 5 min por marcação, 10 no dia). Atestado, férias e folga abonam o dia; falta não justificada desconta o dia.
        O valor da hora extra (adicional) e banco de horas ficam com o DP. Não substitui o controle de ponto que a empresa usa hoje.</p></div>
    </section>}
  </>;
}
