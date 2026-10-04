import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { epiPrintedSupplies, epiReportFailure, projectEpiReport, reportDate, resolveEpiPeriod, type EpiReportType } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { nomeProfissao } from "@/03_FUNCOES_E_LOGICA/Cadastros/profissao";

type Query = { type?: string; preset?: string; from?: string; to?: string };
const presets = [
  ["today", "Hoje"], ["week", "Esta semana"], ["month", "Este mês"],
  ["30days", "Últimos 30 dias"], ["year", "Este ano"], ["all", "Todo o histórico"],
] as const;

export default async function EmployeeEpiReportPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  await requireCapability("epi:write");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const type: EpiReportType = query.type === "history" ? "history" : "current";
  const periodQuery = { preset: query.preset ?? "all", from: query.from, to: query.to };
  let error: string | null = null;
  let period;
  try { period = resolveEpiPeriod(periodQuery); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Período inválido."; period = resolveEpiPeriod({ preset: "all" }); }
  const { raw, failure } = await (async () => (await getEpiOperations()).report3e(id))()
    .then(raw => ({ raw, failure: null }))
    .catch(cause => ({ raw: null, failure: epiReportFailure(cause) }));
  if (!raw && failure?.status === 404) notFound();
  if (!raw) return <><PageHeader eyebrow="LABORATÓRIO 3E" title="Ficha e histórico de EPI" description="Não foi possível consultar os registros locais agora." />
    <div className="alert error" role="alert">{failure?.message}</div></>;
  const report = projectEpiReport(raw, type, period);
  const supplies = epiPrintedSupplies(report);
  const base = `/funcionarios/${id}/epi`;
  const pdfQuery = new URLSearchParams({ type, preset: period.preset });
  if (period.from && period.to) { pdfQuery.set("from", period.from); pdfQuery.set("to", period.to); }
  return <>
    <PageHeader eyebrow="LABORATÓRIO 3E · SIMULAÇÃO SEM VALOR OFICIAL" title="Ficha e histórico de EPI"
      description={`Confira os registros de ${raw.employee.name} antes de imprimir ou baixar.`}
      actions={<Link className="button secondary" href={`/funcionarios/${id}`}>Voltar ao funcionário</Link>} />
    {error && <div className="alert error" role="alert">{error}</div>}
    <section className="panel"><div className="panel-body">
      <form action={base} method="get" className="form-grid">
        <label>Documento<select name="type" defaultValue={type}><option value="current">Ficha atual de EPI</option><option value="history">Histórico de EPI</option></select></label>
        <label>Período do histórico<select name="preset" defaultValue={period.preset}>
          <option value="all">Todo o histórico</option><option value="today">Hoje</option><option value="week">Esta semana</option>
          <option value="month">Este mês</option><option value="30days">Últimos 30 dias</option><option value="year">Este ano</option>
          <option value="custom">Datas informadas abaixo</option></select></label>
        <label>Data inicial<input name="from" type="date" lang="pt-BR" defaultValue={query.from ?? ""} /></label>
        <label>Data final<input name="to" type="date" lang="pt-BR" defaultValue={query.to ?? ""} /></label>
        <div className="form-actions"><button className="button primary" type="submit">Visualizar relatório</button></div>
      </form>
      <nav aria-label="Atalhos de período" className="module-tabs">{presets.map(([value, label]) =>
        <Link key={value} href={`${base}?type=history&preset=${value}`}>{label}</Link>)}</nav>
    </div></section>
    <section className="panel report-section"><header className="panel-header"><div>
      <h2>{type === "current" ? "Ficha atual" : "Histórico de EPI"}</h2>
      <p>{type === "current" ? `Situação em ${reportDate(raw.generated_at)}` :
        period.preset === "all" ? "Todo o histórico" : `Relatório filtrado por período: ${period.label}`}</p>
    </div></header><div className="panel-body">
      <p><strong>Funcionário:</strong> {raw.employee.name} · <strong>Função atual:</strong> {nomeProfissao(raw.employee.profession) || "Não registrada"}
        {raw.employee.registration && <> · <strong>Matrícula:</strong> {raw.employee.registration}</>}</p>
      <p><strong>Equipe atual:</strong> {raw.employee.team ?? "Sem equipe atribuída"}</p>
      <p><strong>{type === "current" ? "EPIs ativos" : "Fornecimentos no período"}:</strong> {supplies.length}</p>
      {report.legacyCount > 0 && <p className="alert warn" role="status">Há {report.legacyCount} entrega(s) legadas sem snapshot de nome/unidade. Esses campos vêm do catálogo atual e serão indicados no PDF.</p>}
      {supplies.length === 0 ? <p>{type === "current" ? "Nenhum EPI atribuído no momento. Consulte o histórico para ver entregas passadas." :
        "Nenhuma entrega ou substituição registrada no período selecionado."}</p> :
        <ol className="list">{supplies.map((row, index) => <li className="list-row" key={index}><span className="list-row-main">
          <strong>{type === "current" ? row.item : row.title}</strong><span>{reportDate(row.at)}{type === "history" && <> · {row.item}</>}
            {" · "}CA: {row.ca} · {row.quantity}</span>
          <span>Responsável pela entrega: {row.responsible}</span>
        </span></li>)}</ol>}
      <p className="muted">O histórico impresso apresenta entregas e substituições. Solicitações, confirmações e divergências continuam nos registros do sistema.</p>
      <p className="muted">Entrega registrada e confirmação são eventos distintos. O documento não contém assinatura digital.</p>
      {!error && <div className="form-actions"><a className="button primary" href={`${base}/pdf?${pdfQuery}`} target="_blank" rel="noreferrer">Abrir PDF para imprimir</a>
        <a className="button secondary" href={`${base}/pdf?${pdfQuery}&download=1`}>Baixar PDF</a></div>}
    </div></section>
  </>;
}
