import { DeactivateRecord } from "@/02_COMPONENTES_VISUAIS/desativar-registro";
import { deactivateMaterial } from "@/app/actions/administracao-completa";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { updateMaterial } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function MaterialDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  const service = await getMetalloService();
  const { item, movements } = await service.getMaterial(id);
  const total = item.inventory.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <>
      <PageHeader
        eyebrow="DETALHES DO MATERIAL"
        title={item.name}
        description={`Código ${item.code} · ${total} ${item.unit} no estoque distribuído`}
        actions={can(profile, "materials:write") ? <Link className="button primary" href={`/movimentacoes/nova?item=${item.id}`}><ArrowLeftRight size={16} />Movimentar</Link> : undefined}
      />
      {query.updated && <div className="alert success" role="status">Material atualizado com sucesso.</div>}
      {query.error && <div className="alert error" role="alert">Não foi possível salvar. Revise os dados e tente novamente.</div>}
      <section className="detail-hero">
        <dl className="definition-grid">
          <div className="definition-item"><dt>Categoria</dt><dd>{item.category ?? "Sem categoria"}</dd></div>
          <div className="definition-item"><dt>Unidade</dt><dd>{item.unit}</dd></div>
          <div className="definition-item"><dt>Estoque mínimo</dt><dd>{item.minimum_stock} {item.unit}</dd></div>
          {profile.role === "admin" && <div className="definition-item"><dt>Situação</dt><dd><StatusBadge value={total <= item.minimum_stock ? "maintenance" : "available"} label={total <= item.minimum_stock ? "Estoque baixo" : "Regular"} /></dd></div>}
          <div className="definition-item"><dt>Descrição</dt><dd>{item.description ?? "Não informada"}</dd></div>
        </dl>
      </section>
      <section className="content-grid">
        <div className="panel">
          <header className="panel-header"><div><h2>Distribuição</h2><p>Saldo por equipe ou localização</p></div></header>
          <div className="panel-body list">{item.inventory.length === 0 ? <p className="muted">Sem estoque registrado.</p> : item.inventory.map((row) => <div className="list-row" key={row.id}><span className="list-row-main"><strong>{row.teams?.name ?? "Local removido"}</strong><span><StatusBadge value={row.status} /></span></span><span className="list-row-value">{row.quantity} {item.unit}</span></div>)}</div>
        </div>
        {can(profile, "admin:manage") && <div className="panel">
          <header className="panel-header"><div><h2>Editar cadastro</h2><p>O histórico de movimentações não é alterado</p></div></header>
          <div className="panel-body"><form action={updateMaterial} className="form-grid">
            <input type="hidden" name="itemId" value={item.id} />
            <label>Código<input name="code" defaultValue={item.code} maxLength={40} required /></label>
            <label>Nome<input name="name" defaultValue={item.name} maxLength={120} required /></label>
            <label>Categoria<input name="category" defaultValue={item.category ?? ""} maxLength={80} /></label>
            <label>Unidade<input name="unit" defaultValue={item.unit} maxLength={20} required /></label>
            <label>Estoque mínimo<input name="minimumStock" type="number" min="0" defaultValue={item.minimum_stock} required /></label>
            <label className="full">Descrição<textarea name="description" defaultValue={item.description ?? ""} maxLength={500} /></label>
            <div className="form-actions"><SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton></div>
          </form></div>
        </div>}
      </section>
      <section className="panel">
        <header className="panel-header"><div><h2>Histórico</h2><p>Movimentações preservadas em ordem cronológica</p></div></header>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Operação</th><th>Origem</th><th>Destino</th><th>Quantidade</th><th>Responsável</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td>{movementLabel(movement.movement_type)}</td><td>{movement.origin?.name ?? "Externo"}</td><td>{movement.destination?.name ?? "Baixa"}</td><td>{movement.quantity} {item.unit}</td><td>{movement.profiles?.full_name ?? "—"}</td></tr>)}</tbody></table></div>
      </section>
      {can(profile, "admin:manage") && item.active && <DeactivateRecord id={item.id} action={deactivateMaterial} name={item.name} />}
    </>
  );
}
