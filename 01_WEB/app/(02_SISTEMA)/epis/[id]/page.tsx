import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { updateReplacementDays } from "@/app/actions/epi-completo";
import { DeactivateRecord } from "@/02_COMPONENTES_VISUAIS/desativar-registro";
import { deactivateEpi } from "@/app/actions/administracao-completa";
import { can, formatDateTime, itemKindLabel } from "@metallo/core";
import { addEpiStock, updateEpiItem } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability, requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function EpiItemDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string; stock?: string; created?: string }>;
}) {
  await requireCapability("epi:read");
  const { id } = await params;
  const query = await searchParams;
  const profile = await requireProfile();
  const service = await getMetalloService();
  const { item, deliveries } = await service.getEpiItem(id);
  const stock = item.epi_stock_batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const variants = [...item.epi_item_variants].sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label, "pt-BR"));

  return (
    <>
      <PageHeader eyebrow={itemKindLabel(item.item_kind).toUpperCase()} title={item.name} description={`Código ${item.code} · ${stock} ${item.unit} disponíveis`} />
      {(query.updated || query.stock || query.created) && <div className="alert success" role="status">{query.stock ? "Entrada adicionada ao estoque." : query.created ? "Item cadastrado. Agora você pode fazer novas entradas ou registrar uma entrega." : "Cadastro atualizado com sucesso."}</div>}
      {query.error && <div className="alert error" role="alert">Não foi possível concluir. Revise os dados e a variante informada.</div>}
      <section className="detail-hero"><dl className="definition-grid">
        <div className="definition-item"><dt>Tipo</dt><dd>{itemKindLabel(item.item_kind)}</dd></div>
        <div className="definition-item"><dt>C.A.</dt><dd>{item.ca_number ?? "Não informado"}</dd></div>
        <div className="definition-item"><dt>Marca / modelo</dt><dd>{item.brand_model ?? "Não informado"}</dd></div>
        <div className="definition-item"><dt>Mínimo</dt><dd>{item.minimum_stock} {item.unit}</dd></div>
        <div className="definition-item"><dt>Situação</dt><dd><StatusBadge value={stock <= item.minimum_stock ? "maintenance" : "available"} label={stock <= item.minimum_stock ? "Repor" : "Regular"} /></dd></div>
      </dl></section>
      <section className="content-grid">
        <div className="panel"><header className="panel-header"><div><h2>Estoque por variante</h2><p>Lotes disponíveis na COSEM</p></div></header><div className="panel-body list">{item.epi_stock_batches.length === 0 ? <p className="muted">Sem estoque disponível.</p> : item.epi_stock_batches.map((batch) => <div className="list-row" key={batch.id}><span className="list-row-main"><strong>{batch.variant ?? "Sem variante"}</strong><span>{batch.brand_model ?? item.brand_model ?? "Sem marca"} · lote {batch.lot_number ?? "não informado"}</span></span><span className="list-row-value">{batch.quantity} {item.unit}</span></div>)}</div></div>
        {can(profile, "epi:write") && <div className="panel"><header className="panel-header"><div><h2>Entrada de estoque</h2><p>Cria um lote rastreável sem alterar entregas anteriores</p></div></header><div className="panel-body"><form action={addEpiStock} className="form-grid">
          <input type="hidden" name="itemId" value={item.id} />
          <label>Quantidade<input name="quantity" type="number" min="1" required /></label>
          <label>Variante{variants.length > 0
            ? <select name="variant" required defaultValue=""><option value="" disabled>Selecione</option>{variants.map((variant) => <option key={variant.value} value={variant.value}>{variant.label}</option>)}</select>
            : <input name="variant" placeholder="Ex.: tamanho ou modelo" maxLength={80} />}
          </label>
          <label>C.A.<input name="caNumber" defaultValue={item.ca_number ?? ""} maxLength={60} /></label>
          <label>Marca / modelo<input name="brandModel" defaultValue={item.brand_model ?? ""} maxLength={140} /></label>
          <label className="full">Lote<input name="lotNumber" maxLength={100} /></label>
          <div className="form-actions"><SubmitButton pendingLabel="Adicionando…">Adicionar ao estoque</SubmitButton></div>
        </form></div></div>}
      </section>
      {can(profile, "admin:manage") && <section className="panel"><header className="panel-header"><div><h2>Editar item</h2><p>Altera o catálogo sem reescrever o histórico entregue</p></div></header><div className="panel-body"><form action={updateEpiItem} className="form-grid">
        <input type="hidden" name="itemId" value={item.id} />
        <label>Código<input name="code" defaultValue={item.code} maxLength={50} required /></label>
        <label>Nome<input name="name" defaultValue={item.name} maxLength={140} required /></label>
        <label>Tipo<select name="kind" defaultValue={item.item_kind}><option value="epi">EPI</option><option value="uniform">Fardamento</option><option value="personal_tool">Item pessoal</option></select></label>
        <label>Unidade<input name="unit" defaultValue={item.unit} maxLength={20} required /></label>
        <label>C.A.<input name="caNumber" defaultValue={item.ca_number ?? ""} maxLength={60} /></label>
        <label>Marca / modelo<input name="brandModel" defaultValue={item.brand_model ?? ""} maxLength={140} /></label>
        <label>Estoque mínimo<input name="minimumStock" type="number" min="0" defaultValue={item.minimum_stock} required /></label>
        <div className="form-actions"><SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton></div>
      </form></div></section>}
      <section className="panel"><header className="panel-header"><div><h2>Entregas recentes</h2><p>Responsável, equipe e condição atual</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Equipe</th><th>Data</th><th>Variante</th><th>Quantidade</th><th>Situação</th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.epi_employees?.full_name ?? "Funcionário removido"}</td><td>{delivery.teams?.name ?? "—"}</td><td>{formatDateTime(delivery.delivered_at)}</td><td>{delivery.variant_snapshot ?? "—"}</td><td>{delivery.quantity} {item.unit}</td><td><StatusBadge value={delivery.current_status} /></td></tr>)}</tbody></table></div></section>
      {can(profile, "admin:manage") && item.active && <DeactivateRecord id={item.id} action={deactivateEpi} name={item.name} />}
      {can(profile, "admin:manage") && <section className="panel"><header className="panel-header"><h2>Prazo de reposição</h2></header><div className="panel-body"><OperationForm action={updateReplacementDays} label="Salvar prazo"><input type="hidden" name="itemId" value={item.id} /><label>Dias para reposição<input name="replacementDays" type="number" min={1} max={3650} defaultValue={item.replacement_days ?? ""} /></label><p className="full muted">Deixe vazio quando não houver prazo definido.</p></OperationForm></div></section>}
    </>
  );
}
