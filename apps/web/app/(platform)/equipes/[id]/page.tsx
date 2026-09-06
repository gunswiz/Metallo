import Link from "next/link";
import { formatDateTime } from "@metallo/core";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getMetalloService } from "@/lib/services/metallo-service";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getMetalloService();
  const data = await service.getTeam(id);
  return (
    <>
      <PageHeader eyebrow={data.team.location_type === "central" ? "CENTRO DE DISTRIBUIÇÃO" : "EQUIPE DE CAMPO"} title={data.team.name} description={data.team.description ?? "Visão consolidada de pessoas, estoque e patrimônios."} />
      <section className="metric-grid">
        <div className="metric-card"><strong>{data.inventory.reduce((sum, row) => sum + row.quantity, 0)}</strong><span>unidades de materiais</span></div>
        <div className="metric-card"><strong>{data.assets.length}</strong><span>equipamentos</span></div>
        <div className="metric-card"><strong>{data.employees.length}</strong><span>funcionários</span></div>
        <div className="metric-card"><strong>{data.movements.length}</strong><span>movimentações recentes</span></div>
      </section>
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><h2>Estoque e equipamentos</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Tipo</th><th>Quantidade / patrimônio</th><th>Status</th></tr></thead><tbody>
          {data.inventory.map((row) => <tr key={row.id}><td><span className="primary-cell">{row.items?.name}</span><span className="secondary-cell">{row.items?.code}</span></td><td>Material</td><td>{row.quantity} {row.items?.unit}</td><td><StatusBadge value={row.status} /></td></tr>)}
          {data.assets.map((asset) => <tr key={asset.id}><td><Link className="primary-cell" href={`/equipamentos/${asset.id}`}>{asset.items?.name}</Link><span className="secondary-cell">{asset.items?.code}</span></td><td>Equipamento</td><td>{asset.asset_code}</td><td><StatusBadge value={asset.status} /></td></tr>)}
        </tbody></table></div></div>
        <div className="panel"><header className="panel-header"><h2>Funcionários</h2></header><div className="panel-body list">{data.employees.map((employee) => <Link className="list-row" href={`/funcionarios/${employee.id}`} key={employee.id}><span className="list-row-main"><strong>{employee.full_name}</strong><span>{employee.profession}</span></span></Link>)}</div></div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}><header className="panel-header"><h2>Atividade recente</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Item</th><th>Operação</th><th>Fluxo</th></tr></thead><tbody>{data.movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td>{movement.items?.name}</td><td>{movement.movement_type}</td><td>{movement.origin?.name ?? "Externo"} → {movement.destination?.name ?? "Baixa"}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
