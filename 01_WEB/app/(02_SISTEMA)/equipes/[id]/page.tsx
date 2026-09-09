import { can } from "@metallo/core";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { DeactivateRecord } from "@/02_COMPONENTES_VISUAIS/desativar-registro";
import { editTeam, removeTeam } from "@/app/actions/administracao-completa";
import Link from "next/link";
import { formatDateTime, movementLabel } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { OwnershipBadge } from "@/02_COMPONENTES_VISUAIS/ownership-badge";

export default async function TeamDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string }> }) {
  const query = await searchParams;
  const profile = await requireProfile();
  const { id } = await params;
  const service = await getMetalloService();
  const data = await service.getTeam(id);
  return (
    <>
      <PageHeader eyebrow={data.team.location_type === "central" ? "CENTRO DE DISTRIBUIÇÃO" : "EQUIPE DE CAMPO"} title={data.team.name} description={data.team.description ?? "Visão consolidada de pessoas, estoque e patrimônios."} />
      {query.updated && <div className="alert success" role="status">Equipe atualizada.</div>}
      <section className="metric-grid">
        <div className="metric-card"><strong>{data.inventory.reduce((sum, row) => sum + row.quantity, 0)}</strong><span>unidades de materiais</span></div>
        <div className="metric-card"><strong>{data.assets.length}</strong><span>equipamentos</span></div>
        <div className="metric-card"><strong>{data.employees.length}</strong><span>funcionários</span></div>
        <div className="metric-card"><strong>{data.movements.length}</strong><span>movimentações recentes</span></div>
      </section>
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><h2>Estoque e equipamentos</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Tipo</th><th>Quantidade / patrimônio</th><th>Propriedade</th><th>Situação</th></tr></thead><tbody>
          {data.inventory.map((row) => <tr key={row.id}><td><span className="primary-cell">{row.items?.name}</span><span className="secondary-cell">{row.items?.code}</span></td><td>Material</td><td>{row.quantity} {row.items?.unit}</td><td>—</td><td><StatusBadge value={row.status} /></td></tr>)}
          {data.assets.map((asset) => <tr key={asset.id}><td><Link className="primary-cell" href={`/equipamentos/${asset.id}`}>{asset.items?.name}</Link><span className="secondary-cell">{asset.items?.code}</span></td><td>Equipamento</td><td>{asset.asset_code}</td><td><OwnershipBadge type={asset.ownership_type} /></td><td><StatusBadge value={asset.status} /></td></tr>)}
        </tbody></table></div></div>
        <div className="panel"><header className="panel-header"><h2>Funcionários</h2></header><div className="panel-body list">{data.employees.map((employee) => <Link className="list-row" href={`/funcionarios/${employee.id}`} key={employee.id}><span className="list-row-main"><strong>{employee.full_name}</strong><span>{employee.profession}</span></span></Link>)}</div></div>
      </section>
      <section className="panel" style={{ marginTop: 16 }}><header className="panel-header"><h2>Atividade recente</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Item</th><th>Operação</th><th>Fluxo</th></tr></thead><tbody>{data.movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td>{movement.items?.name}</td><td>{movementLabel(movement.movement_type)}</td><td>{movement.origin?.name ?? "Externo"} → {movement.destination?.name ?? "Baixa"}</td></tr>)}</tbody></table></div></section>
      {can(profile.role, "admin:manage") && <section className="panel"><header className="panel-header"><h2>Editar equipe</h2></header><div className="panel-body"><OperationForm action={editTeam} label="Salvar equipe"><input type="hidden" name="teamId" value={data.team.id} /><label>Nome<input name="name" required minLength={2} maxLength={100} defaultValue={data.team.name} /></label><label>Descrição<textarea name="description" maxLength={300} defaultValue={data.team.description ?? ""} /></label></OperationForm></div></section>}
      {can(profile.role, "admin:manage") && data.team.active && data.team.location_type !== "central" && <DeactivateRecord id={data.team.id} name={data.team.name} action={removeTeam} />}
    </>
  );
}
