import Link from "next/link";
import { ArrowLeftRight, Boxes, CalendarDays, TrendingUp, Users } from "lucide-react";
import { BarChart, formatNumber, LineChart } from "@/02_COMPONENTES_VISUAIS/analytics-charts";
import { MetricCard } from "@/02_COMPONENTES_VISUAIS/metric-card";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { analyzeConsumption, resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

type Query = { period?: string; from?: string; to?: string; team?: string; item?: string; category?: string };

function inputDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function ConsumptionPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireCapability("inventory:read");
  const query = await searchParams;
  const range = resolveConsumptionRange(query.period, query.from, query.to);
  const service = await getMetalloService();
  const [teams, materials] = await Promise.all([service.listTeams(), service.listMaterials({ page: 1, pageSize: 100, q: "" })]);
  const teamId = teams.some((team) => team.id === query.team) ? query.team : undefined;
  const itemId = materials.data.some((item) => item.id === query.item) ? query.item : undefined;
  const rows = await service.consumptionRows({ from: range.previousStart.toISOString(), to: range.currentEnd.toISOString(), teamId, itemId });
  const category = query.category?.slice(0, 80);
  const analysis = analyzeConsumption(rows, range, undefined, category);
  const change = analysis.percentChange === null ? "Sem base anterior" : `${analysis.percentChange >= 0 ? "+" : ""}${formatNumber(analysis.percentChange)}%`;

  return <>
    <PageHeader eyebrow="ANÁLISE VISUAL" title="Consumo" description="Gráficos calculados a partir das movimentações reais do tipo consumo, considerando todas as unidades." actions={<Link className="button primary" href="/movimentacoes/nova?type=consumption"><ArrowLeftRight size={16} />Registrar consumo</Link>} />
    <section className="panel analytics-filter"><form className="panel-body toolbar">
      <select className="filter-select" name="period" defaultValue={query.period ?? "30"} aria-label="Período"><option value="today">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="month">Mês atual</option><option value="custom">Personalizado</option></select>
      <label className="compact-field">De<input name="from" type="date" lang="pt-BR" defaultValue={query.from ?? inputDate(range.currentStart)} /></label>
      <label className="compact-field">Até<input name="to" type="date" lang="pt-BR" defaultValue={query.to ?? inputDate(new Date(range.currentEnd.getTime() - 86_400_000))} /></label>
      <select className="filter-select" name="team" defaultValue={teamId ?? ""} aria-label="Equipe"><option value="">Todas as equipes</option>{teams.filter((team) => team.location_type === "field").map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select>
      <select className="filter-select" name="item" defaultValue={itemId ?? ""} aria-label="Material"><option value="">Todos os materiais</option>{materials.data.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="filter-select" name="category" defaultValue={category ?? ""} aria-label="Categoria"><option value="">Todas as categorias</option>{analysis.categories.map((name) => <option key={name}>{name}</option>)}</select>
      <button className="button secondary" type="submit">Aplicar filtros</button>
    </form></section>
    <section className="metric-grid analytics-metrics">
      <MetricCard label={`${analysis.unit} consumidos · ${range.label}`} value={formatNumber(analysis.total)} icon={TrendingUp} />
      <MetricCard label="comparação com período anterior" value={change} icon={CalendarDays} />
      <MetricCard label="materiais com consumo" value={analysis.materials.length} icon={Boxes} />
      <MetricCard label="equipes com consumo" value={analysis.teams.length} icon={Users} />
    </section>
    <section className="analytics-grid">
      <article className="panel"><header className="panel-header"><div><h2>Consumo ao longo do tempo</h2><p>{range.label} · unidade {analysis.unit}</p></div></header><div className="panel-body"><LineChart points={analysis.trend} /></div></article>
      <article className="panel"><header className="panel-header"><div><h2>Por categoria</h2><p>Classificação cadastrada ou regra equivalente ao aplicativo móvel</p></div></header><div className="panel-body"><BarChart points={analysis.categoryTotals} suffix={analysis.unit} /></div></article>
      <article className="panel"><header className="panel-header"><div><h2>Materiais mais consumidos</h2><p>Ranking no período selecionado</p></div></header><div className="panel-body"><BarChart points={analysis.materials.slice(0, 10)} suffix={analysis.unit} /></div></article>
      <article className="panel"><header className="panel-header"><div><h2>Consumo por equipe</h2><p>Origem da baixa registrada</p></div></header><div className="panel-body"><BarChart points={analysis.teams} suffix={analysis.unit} /></div></article>
    </section>
    <section className="panel"><header className="panel-header"><div><h2>Movimentações que formam os gráficos</h2><p>Rastreabilidade dos valores exibidos acima</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Material</th><th>Equipe</th><th>Categoria</th><th>Quantidade</th></tr></thead><tbody>{analysis.rows.slice().reverse().slice(0, 100).map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</td><td><span className="primary-cell">{row.items?.name ?? "Material removido"}</span><span className="secondary-cell">{row.items?.code}</span></td><td>{row.origin?.name ?? "Sem equipe"}</td><td>{row.items?.category ?? "Classificação automática"}</td><td>{row.quantity} {row.items?.unit}</td></tr>)}</tbody></table></div></section>
  </>;
}
