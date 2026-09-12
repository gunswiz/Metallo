import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { ConsumptionDashboard } from "@/02_COMPONENTES_VISUAIS/consumption-dashboard";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { analyzeConsumptionByUnit, consumptionCategory, resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
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
  const reports = analyzeConsumptionByUnit(rows, range, category);
  const categories = [...new Set(rows.map(consumptionCategory))].sort();

  return <>
    <PageHeader eyebrow="ANÁLISE VISUAL" title="Consumo" description="Acompanhe quanto cada material consumiu, com caixas, unidades e outras medidas separadas." actions={<Link className="button primary" href="/movimentacoes/nova?type=consumption"><ArrowLeftRight size={16} />Registrar consumo</Link>} />
    <section className="panel analytics-filter"><form className="panel-body toolbar">
      <select className="filter-select" name="period" defaultValue={query.period ?? "30"} aria-label="Período"><option value="today">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="month">Mês atual</option><option value="custom">Personalizado</option></select>
      <label className="compact-field">De<input name="from" type="date" lang="pt-BR" defaultValue={query.from ?? inputDate(range.currentStart)} /></label>
      <label className="compact-field">Até<input name="to" type="date" lang="pt-BR" defaultValue={query.to ?? inputDate(new Date(range.currentEnd.getTime() - 86_400_000))} /></label>
      <select className="filter-select" name="team" defaultValue={teamId ?? ""} aria-label="Equipe"><option value="">Todas as equipes</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select>
      <select className="filter-select" name="item" defaultValue={itemId ?? ""} aria-label="Material"><option value="">Todos os materiais</option>{materials.data.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <select className="filter-select" name="category" defaultValue={category ?? ""} aria-label="Categoria"><option value="">Todas as categorias</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
      <button className="button secondary" type="submit">Aplicar filtros</button>
    </form></section>
    <ConsumptionDashboard reports={reports} periodLabel={range.label} />
  </>;
}
