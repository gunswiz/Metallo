import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { EmptyState } from "@/02_COMPONENTES_VISUAIS/empty-state";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { Pagination } from "@/02_COMPONENTES_VISUAIS/pagination";
import { SearchToolbar } from "@/02_COMPONENTES_VISUAIS/search-toolbar";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { parsePage, type SearchParams } from "@/03_FUNCOES_E_LOGICA/lerFiltrosEPaginacao";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { can } from "@metallo/core";

export default async function MaterialsPage({ searchParams }: { searchParams: SearchParams }) {
  const input = await parsePage(searchParams);
  const profile = await requireProfile();
  const canOperate = can(profile.role, "operations:write");
  const service = await getMetalloService();
  const result = await service.listMaterials(input);
  return (
    <>
      <PageHeader eyebrow="ALMOXARIFADO" title="Materiais" description="Catálogo, estoque distribuído e níveis mínimos por equipe." actions={canOperate ? <><Link className="button secondary" href="/movimentacoes/nova"><ArrowLeftRight size={16} />Movimentar</Link><Link className="button primary" href="/materiais/novo"><Plus size={16} />Novo material</Link></> : undefined} />
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Nome, código ou categoria" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Material</th><th>Categoria</th><th>Estoque total</th><th>Locais</th><th>Mínimo</th><th>Situação</th></tr></thead>
          <tbody>{result.data.map((item) => {
            const total = item.inventory.reduce((sum, row) => sum + row.quantity, 0);
            const low = total <= item.minimum_stock;
            return <tr key={item.id}>
              <td><Link className="primary-cell" href={`/materiais/${item.id}`}>{item.name}</Link><span className="secondary-cell">{item.code}</span></td>
              <td>{item.category ?? "Sem categoria"}</td><td className="numeric">{total} {item.unit}</td>
              <td>{item.inventory.filter((row) => row.quantity > 0).map((row) => row.teams?.name).filter(Boolean).join(", ") || "Sem estoque"}</td>
              <td className="numeric">{item.minimum_stock} {item.unit}</td><td><StatusBadge value={low ? "maintenance" : "available"} label={low ? "Estoque baixo" : "Regular"} /></td>
            </tr>;
          })}</tbody>
        </table></div>}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
