import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { updateEquipment } from "@/app/actions/operations";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { getMetalloService } from "@/lib/services/metallo-service";
import { requireProfile } from "@/lib/auth/session";

export default async function EquipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  const service = await getMetalloService();
  const [{ asset, movements }, teams] = await Promise.all([service.getAsset(id), service.listTeams()]);
  return (
    <>
      <PageHeader eyebrow="DETALHES DO PATRIMÔNIO" title={asset.items?.name ?? "Equipamento"} description={`Código individual ${asset.asset_code}`} actions={can(profile.role, "operations:write") ? <Link className="button primary" href={`/movimentacoes/nova?asset=${asset.id}`}><ArrowLeftRight size={16} />Movimentar</Link> : undefined} />
      {query.updated && <div className="alert success">Equipamento atualizado com sucesso.</div>}
      {query.error && <div className="alert error">Não foi possível salvar. Revise os dados informados.</div>}
      <section className="detail-hero">
        <dl className="definition-grid">
          <div className="definition-item"><dt>Patrimônio</dt><dd>{asset.asset_code}</dd></div>
          <div className="definition-item"><dt>Equipe atual</dt><dd>{asset.teams?.name ?? "Sem equipe"}</dd></div>
          <div className="definition-item"><dt>Status</dt><dd><StatusBadge value={asset.status} /></dd></div>
          <div className="definition-item"><dt>Código do catálogo</dt><dd>{asset.items?.code}</dd></div>
          <div className="definition-item"><dt>Série</dt><dd>{asset.serial_number ?? "Não informado"}</dd></div>
          <div className="definition-item"><dt>Categoria</dt><dd>{asset.items?.category ?? "Sem categoria"}</dd></div>
        </dl>
      </section>
      {can(profile.role, "admin:manage") && <section className="panel">
        <header className="panel-header"><div><h2>Editar equipamento</h2><p>Tipo e patrimônio são atualizados na mesma transação</p></div></header>
        <div className="panel-body"><form action={updateEquipment} className="form-grid">
          <input type="hidden" name="itemId" value={asset.items.id} /><input type="hidden" name="assetId" value={asset.id} />
          <label>Código do tipo<input name="code" defaultValue={asset.items.code} maxLength={40} required /></label>
          <label>Nome<input name="name" defaultValue={asset.items.name} maxLength={120} required /></label>
          <label>Patrimônio<input name="assetCode" defaultValue={asset.asset_code} maxLength={80} required /></label>
          <label>Número de série<input name="serialNumber" defaultValue={asset.serial_number ?? ""} maxLength={120} /></label>
          <label>Equipe<select name="teamId" defaultValue={asset.team_id ?? ""} required><option value="" disabled>Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={asset.status}><option value="available">Disponível</option><option value="in_use">Em uso</option><option value="maintenance">Manutenção</option><option value="damaged">Danificado</option><option value="lost">Perdido</option><option value="retired">Baixado</option></select></label>
          <label className="full">Observações<textarea name="notes" defaultValue={asset.notes ?? ""} maxLength={500} /></label>
          <div className="form-actions"><SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton></div>
        </form></div>
      </section>}
      <section className="panel">
        <header className="panel-header"><div><h2>Histórico rastreável</h2><p>Alterações preservadas sem substituir silenciosamente o estado anterior</p></div></header>
        <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Data</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Status</th><th>Responsável</th></tr></thead>
          <tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td>{movementLabel(movement.movement_type)}</td><td>{movement.origin?.name ?? "—"}</td><td>{movement.destination?.name ?? "—"}</td><td><StatusBadge value={movement.new_status} /></td><td>{movement.profiles?.full_name ?? "—"}</td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
