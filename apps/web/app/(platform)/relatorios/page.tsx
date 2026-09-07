import { ClipboardList, HardHat, PackageOpen, Wrench } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { MetricCard } from "@/components/metric-card";
import { OwnershipBadge } from "@/components/ownership-badge";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireProfile } from "@/lib/auth/session";
import { resolveConsumptionRange } from "@/lib/consumption";
import { getMetalloService } from "@/lib/services/metallo-service";

type Query = { from?: string; to?: string; team?: string };

function inputDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const profile = await requireProfile();
  const includeEpi = can(profile.role, "epi:read");
  const query = await searchParams;
  const range = resolveConsumptionRange(query.from && query.to ? "custom" : "30", query.from, query.to);
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const teamId = teams.some((team) => team.id === query.team) ? query.team : undefined;
  const data = await service.reportData({ from: range.currentStart.toISOString(), to: range.currentEnd.toISOString(), teamId }, includeEpi);
  const materialEntries = data.materialMovements.filter((row) => ["entry", "replenishment", "return"].includes(row.movement_type)).reduce((sum, row) => sum + row.quantity, 0);
  const materialOutputs = data.materialMovements.filter((row) => ["exit", "consumption"].includes(row.movement_type)).reduce((sum, row) => sum + row.quantity, 0);
  const rented = data.assets.filter((asset) => asset.ownership_type === "rented").length;
  const epiUnits = data.deliveries.reduce((sum, row) => sum + row.quantity, 0);

  return <>
    <PageHeader eyebrow="HISTÓRICO E INVESTIGAÇÃO" title="Relatórios" description="Consulta detalhada por período, equipe e operação; os indicadores não repetem o Dashboard." />
    <section className="panel analytics-filter"><form className="panel-body toolbar"><label className="compact-field">De<input name="from" type="date" lang="pt-BR" defaultValue={query.from ?? inputDate(range.currentStart)} /></label><label className="compact-field">Até<input name="to" type="date" lang="pt-BR" defaultValue={query.to ?? inputDate(new Date(range.currentEnd.getTime() - 86_400_000))} /></label><select className="filter-select" name="team" defaultValue={teamId ?? ""}><option value="">Todas as equipes</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select><button className="button secondary" type="submit">Gerar relatório</button></form></section>
    <section className="metric-grid analytics-metrics">
      <MetricCard label="unidades em entradas/reposições" value={materialEntries} icon={PackageOpen} />
      <MetricCard label="unidades em saídas/consumo" value={materialOutputs} icon={ClipboardList} />
      <MetricCard label="alugados / equipamentos ativos" value={`${rented}/${data.assets.length}`} icon={Wrench} />
      {includeEpi && <MetricCard label="unidades de EPI/farda/item entregues" value={epiUnits} icon={HardHat} />}
    </section>

    <section className="panel report-section"><header className="panel-header"><div><h2>Relatório de movimentações de materiais</h2><p>Entradas, saídas, transferências, reposições e consumo no período</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Item</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Quantidade</th><th>Responsável</th></tr></thead><tbody>{data.materialMovements.map((row) => <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td><span className="primary-cell">{row.items?.name ?? "Item removido"}</span><span className="secondary-cell">{row.items?.code}</span></td><td>{movementLabel(row.movement_type)}</td><td>{row.origin?.name ?? "Externo"}</td><td>{row.destination?.name ?? "Baixa"}</td><td>{row.quantity} {row.items?.unit}</td><td>{row.profiles?.full_name ?? "—"}</td></tr>)}</tbody></table></div></section>

    <section className="panel report-section"><header className="panel-header"><div><h2>Relatório de equipamentos</h2><p>Posição atual e movimentações individuais no período</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Equipamento</th><th>Patrimônio</th><th>Propriedade</th><th>Equipe</th><th>Status</th></tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.id}><td>{asset.items?.name}</td><td>{asset.asset_code}</td><td><OwnershipBadge type={asset.ownership_type} />{asset.ownership_type === "rented" && <span className="secondary-cell">{asset.rental_company}</span>}</td><td>{asset.teams?.name ?? "Sem equipe"}</td><td><StatusBadge value={asset.status} /></td></tr>)}</tbody></table></div>
      <div className="data-table-wrap report-subtable"><table className="data-table"><thead><tr><th>Data</th><th>Equipamento</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Status</th><th>Responsável</th></tr></thead><tbody>{data.assetMovements.map((row) => <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td><span className="primary-cell">{row.assets?.items?.name ?? "Equipamento removido"}</span><span className="secondary-cell">{row.assets?.asset_code}</span></td><td>{movementLabel(row.movement_type)}</td><td>{row.origin?.name ?? "—"}</td><td>{row.destination?.name ?? "—"}</td><td><StatusBadge value={row.new_status} /></td><td>{row.profiles?.full_name ?? "—"}</td></tr>)}</tbody></table></div>
    </section>

    {includeEpi && <section className="panel report-section"><header className="panel-header"><div><h2>Relatório de EPIs e itens pessoais</h2><p>Entregas por funcionário, equipe, motivo e situação atual</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Funcionário</th><th>Equipe</th><th>Tipo</th><th>Item</th><th>Variante</th><th>Quantidade</th><th>Status</th></tr></thead><tbody>{data.deliveries.map((row) => <tr key={row.id}><td>{formatDateTime(row.delivered_at)}</td><td>{row.epi_employees?.full_name ?? "Funcionário removido"}</td><td>{row.teams?.name ?? "—"}</td><td>{row.epi_items?.item_kind ?? "—"}</td><td>{row.epi_items?.name ?? "Item removido"}</td><td>{row.variant_snapshot ?? "—"}</td><td>{row.quantity} {row.epi_items?.unit}</td><td><StatusBadge value={row.current_status} /></td></tr>)}</tbody></table></div></section>}
    <p className="report-limit-note">Cada seção mostra até 300 registros do período selecionado. Use um intervalo menor para uma auditoria mais específica.</p>
  </>;
}
