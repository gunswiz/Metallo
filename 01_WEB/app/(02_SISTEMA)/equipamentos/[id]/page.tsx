import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { replaceRentedEquipment } from "@/app/actions/substituir-locado";
import { DeactivateRecord } from "@/02_COMPONENTES_VISUAIS/desativar-registro";
import { deactivateEquipment } from "@/app/actions/administracao-completa";
import Link from "next/link";
import { ArrowLeftRight, Undo2 } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { returnRentedEquipment, updateEquipment } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { OwnershipBadge } from "@/02_COMPONENTES_VISUAIS/ownership-badge";
import { EquipmentForm } from "@/02_COMPONENTES_VISUAIS/equipment-form";

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado";
}

export default async function EquipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  const service = await getMetalloService();
  const [{ asset, movements }, teams] = await Promise.all([service.getAsset(id), service.listTeams()]);
  return (
    <>
      <PageHeader eyebrow="DETALHES DO PATRIMÔNIO" title={asset.items?.name ?? "Equipamento"} description={`Código individual ${asset.asset_code}`} actions={can(profile, "equipment:write") ? <Link className="button primary" href={`/movimentacoes/nova?asset=${asset.id}`}><ArrowLeftRight size={16} />Movimentar</Link> : undefined} />
      {query.updated && <div className="alert success" role="status">Equipamento atualizado com sucesso.</div>}
      {query.error && <div className="alert error" role="alert">Não foi possível salvar. Revise os dados informados.</div>}
      <section className="detail-hero">
        <dl className="definition-grid">
          <div className="definition-item"><dt>Patrimônio</dt><dd>{asset.asset_code}</dd></div>
          <div className="definition-item"><dt>Equipe atual</dt><dd>{asset.teams?.name ?? "Sem equipe"}</dd></div>
          <div className="definition-item"><dt>Propriedade</dt><dd><OwnershipBadge type={asset.ownership_type} /></dd></div>
          <div className="definition-item"><dt>Situação</dt><dd><StatusBadge value={asset.status} /></dd></div>
          <div className="definition-item"><dt>Código do catálogo</dt><dd>{asset.items?.code}</dd></div>
          <div className="definition-item"><dt>Série</dt><dd>{asset.serial_number ?? "Não informado"}</dd></div>
          <div className="definition-item"><dt>Categoria</dt><dd>{asset.items?.category ?? "Sem categoria"}</dd></div>
          {asset.ownership_type === "rented" && <><div className="definition-item"><dt>Empresa/fornecedor</dt><dd>{asset.rental_company ?? "Não informado"}</dd></div><div className="definition-item"><dt>Início da locação</dt><dd>{dateLabel(asset.rental_start_date)}</dd></div><div className="definition-item"><dt>Fim previsto</dt><dd>{dateLabel(asset.rental_end_date)}</dd></div></>}
          <div className="definition-item"><dt>Observação</dt><dd>{asset.user_notes ?? "Sem observações"}</dd></div>
        </dl>
      </section>
      {asset.ownership_type === "rented" && can(profile, "admin:manage") && <section className="panel" style={{ marginBottom: 16 }}><header className="panel-header"><div><h2>Devolver à locadora</h2><p>Encerra somente este patrimônio e preserva o histórico</p></div></header><div className="panel-body"><form action={returnRentedEquipment} className="inline-action"><input type="hidden" name="assetId" value={asset.id} /><input name="note" maxLength={500} placeholder="Motivo ou protocolo (opcional)" /><SubmitButton pendingLabel="Devolvendo…"><Undo2 size={16} />Registrar devolução</SubmitButton></form></div></section>}
      {can(profile, "admin:manage") && <section className="panel">
        <header className="panel-header"><div><h2>Editar equipamento</h2><p>Tipo e patrimônio são atualizados na mesma transação</p></div></header>
        <div className="panel-body"><EquipmentForm action={updateEquipment} teams={teams} mode="edit" defaults={{ itemId: asset.items.id, assetId: asset.id, code: asset.items.code, name: asset.items.name, assetCode: asset.asset_code, serialNumber: asset.serial_number, teamId: asset.team_id, status: asset.status, notes: asset.user_notes, ownershipType: asset.ownership_type, rentalCompany: asset.rental_company, rentalStartDate: asset.rental_start_date, rentalEndDate: asset.rental_end_date }} /></div>
      </section>}
      <section className="panel">
        <header className="panel-header"><div><h2>Histórico rastreável</h2><p>Alterações preservadas sem substituir silenciosamente o estado anterior</p></div></header>
        <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Data</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Situação</th><th>Responsável</th></tr></thead>
          <tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td>{movementLabel(movement.movement_type)}</td><td>{movement.origin?.name ?? "—"}</td><td>{movement.destination?.name ?? "—"}</td><td><StatusBadge value={movement.new_status} /></td><td>{movement.profiles?.full_name ?? "—"}</td></tr>)}</tbody>
        </table></div>
      </section>
      {can(profile, "admin:manage") && asset.active && <DeactivateRecord id={asset.id} action={deactivateEquipment} name={asset.asset_code} />}
      {asset.active && asset.ownership_type === "rented" && can(profile, "admin:manage") && <section className="panel"><header className="panel-header"><div><h2>Substituir equipamento locado</h2><p>Registra o novo patrimônio mantendo a locação, a equipe e o histórico.</p></div></header><div className="panel-body"><OperationForm action={replaceRentedEquipment} label="Registrar substituição"><input type="hidden" name="assetId" value={asset.id} /><label>Novo patrimônio<input name="assetCode" required maxLength={80} /></label><label>Número de série<input name="serialNumber" maxLength={120} /></label><label className="full">Motivo da substituição<textarea name="note" required minLength={3} maxLength={300} /></label></OperationForm></div></section>}
    </>
  );
}
