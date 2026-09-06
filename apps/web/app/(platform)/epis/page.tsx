import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { requireCapability } from "@/lib/auth/session";
import { parsePage, type SearchParams } from "@/lib/query";
import { getMetalloService } from "@/lib/services/metallo-service";
import { can } from "@metallo/core";
import { requireProfile } from "@/lib/auth/session";
import Link from "next/link";
import { PackageCheck } from "lucide-react";

export default async function EpisPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability("epi:read");
  const profile = await requireProfile();
  const raw = await searchParams;
  const input = await parsePage(searchParams);
  const service = await getMetalloService();
  const requestedKind = Array.isArray(raw.kind) ? raw.kind[0] : raw.kind;
  const kind = requestedKind === "uniform" ? "uniform" : "epi";
  const result = await service.listEpiItems(input, kind);
  return (
    <>
      <PageHeader eyebrow={kind === "uniform" ? "FARDAMENTO" : "PROTEÇÃO INDIVIDUAL"} title={kind === "uniform" ? "Fardamento" : "EPIs"} description={kind === "uniform" ? "Camisas e calças por cor e tamanho disponíveis na COSEM." : "Controle por condição, C.A., variante e estoque disponível na COSEM."} actions={can(profile.role, "epi:write") ? <Link className="button primary" href="/epis/entrega"><PackageCheck size={16} />Registrar entrega</Link> : undefined} />
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Nome, código ou C.A." q={input.q}>{kind === "uniform" && <input type="hidden" name="kind" value="uniform" />}</SearchToolbar></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>EPI</th><th>C.A.</th><th>Variantes</th><th>Estoque COSEM</th><th>Mínimo</th><th>Situação</th></tr></thead>
          <tbody>{result.data.map((item) => {
            const stock = item.epi_stock_batches.reduce((sum, batch) => sum + batch.quantity, 0);
            return <tr key={item.id}><td><Link className="primary-cell" href={`/epis/${item.id}`}>{item.name}</Link><span className="secondary-cell">{item.code}</span></td><td>{item.ca_number ?? "Não informado"}</td><td>{item.epi_item_variants.sort((a,b) => a.sort_order-b.sort_order).map((variant) => variant.label).join(", ") || "Única"}</td><td className="numeric">{stock} {item.unit}</td><td>{item.minimum_stock} {item.unit}</td><td><StatusBadge value={stock <= item.minimum_stock ? "maintenance" : "available"} label={stock <= item.minimum_stock ? "Repor" : "Regular"} /></td></tr>;
          })}</tbody>
        </table></div>}
        <Pagination {...result} q={input.q} extra={kind === "uniform" ? { kind: "uniform" } : undefined} />
      </section>
    </>
  );
}
