import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { requireCapability } from "@/lib/auth/session";
import { parsePage, type SearchParams } from "@/lib/query";
import { getMetalloService } from "@/lib/services/metallo-service";
import Link from "next/link";

export default async function ToolsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability("epi:read");
  const input = await parsePage(searchParams);
  const service = await getMetalloService();
  const result = await service.listEpiItems(input, "personal_tool");
  return (
    <>
      <PageHeader eyebrow="ITENS PESSOAIS" title="Ferramentas" description="Ferramentas manuais atribuídas a funcionários e controladas pela COSEM." />
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Nome ou código da ferramenta" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Ferramenta</th><th>Modelo</th><th>Estoque disponível</th><th>Política de retorno</th><th>Situação</th></tr></thead>
          <tbody>{result.data.map((item) => { const stock = item.epi_stock_batches.reduce((sum, batch) => sum + batch.quantity, 0); return <tr key={item.id}><td><Link className="primary-cell" href={`/epis/${item.id}`}>{item.name}</Link><span className="secondary-cell">{item.code}</span></td><td>{item.brand_model ?? "Não informado"}</td><td>{stock} {item.unit}</td><td>{item.return_policy === "returnable" ? "Devolução obrigatória" : item.return_policy}</td><td><StatusBadge value={stock <= item.minimum_stock ? "maintenance" : "available"} label={stock <= item.minimum_stock ? "Repor" : "Disponível"} /></td></tr>; })}</tbody>
        </table></div>}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
