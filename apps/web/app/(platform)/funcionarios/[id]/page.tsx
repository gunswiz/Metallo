import { formatDateTime } from "@metallo/core";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireCapability } from "@/lib/auth/session";
import { getMetalloService } from "@/lib/services/metallo-service";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("epi:read");
  const { id } = await params;
  const service = await getMetalloService();
  const { employee, deliveries, requests } = await service.getEmployee(id);
  return (
    <>
      <PageHeader eyebrow="PERFIL DO FUNCIONÁRIO" title={employee.full_name} description={`${employee.profession} · ${employee.teams?.name ?? "Sem equipe"}`} />
      <section className="detail-hero"><dl className="definition-grid">
        <div className="definition-item"><dt>Matrícula</dt><dd>{employee.registration_code ?? "Não informada"}</dd></div><div className="definition-item"><dt>Fardamento</dt><dd>{employee.shirt_size ?? "—"}</dd></div><div className="definition-item"><dt>Bota</dt><dd>{employee.shoe_size ?? "—"}</dd></div><div className="definition-item"><dt>Data do exame</dt><dd>{employee.aso_exam_date ? new Date(`${employee.aso_exam_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</dd></div><div className="definition-item"><dt>Validade do ASO</dt><dd>{employee.aso_expiry_date ? new Date(`${employee.aso_expiry_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</dd></div><div className="definition-item"><dt>Status</dt><dd><StatusBadge value={employee.active ? "active" : "retired"} /></dd></div>
      </dl></section>
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><div><h2>Itens entregues</h2><p>EPIs, fardas e ferramentas pessoais</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Entrega</th><th>Quantidade</th><th>Variante / C.A.</th><th>Status</th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id}><td><span className="primary-cell">{delivery.epi_items?.name}</span><span className="secondary-cell">{delivery.epi_items?.item_kind}</span></td><td>{formatDateTime(delivery.delivered_at)}</td><td>{delivery.quantity} {delivery.epi_items?.unit}</td><td>{delivery.variant_snapshot ?? "—"} · {delivery.ca_snapshot ?? "sem C.A."}</td><td><StatusBadge value={delivery.current_status} /></td></tr>)}</tbody></table></div></div>
        <div className="panel"><header className="panel-header"><div><h2>Pendências</h2><p>Solicitações vinculadas à COSEM</p></div></header><div className="panel-body list">{requests.map((request) => <div className="list-row" key={request.id}><span className="list-row-main"><strong>{request.epi_items?.name}</strong><span>{request.requested_variant ?? "Sem variante"} · {formatDateTime(request.created_at)}</span></span><StatusBadge value={request.status} /></div>)}</div></div>
      </section>
    </>
  );
}
