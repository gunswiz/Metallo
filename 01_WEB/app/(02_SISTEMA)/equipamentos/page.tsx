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
import { OwnershipBadge } from "@/02_COMPONENTES_VISUAIS/ownership-badge";

export default async function EquipmentPage({ searchParams }: { searchParams: SearchParams }) {
  const input = await parsePage(searchParams);
  const raw = await searchParams;
  const requestedOwnership = Array.isArray(raw.ownership) ? raw.ownership[0] : raw.ownership;
  const ownership = requestedOwnership === "owned" || requestedOwnership === "rented" ? requestedOwnership : "all";
  const profile = await requireProfile();
  const canOperate = can(profile, "equipment:write");
  const service = await getMetalloService();
  const result = await service.listAssets({ ...input, ownership });
  return (
    <>
      <PageHeader eyebrow="PATRIMÔNIO" title="Equipamentos" description="Posse atual, condição e histórico individual de cada patrimônio." actions={canOperate ? <><Link className="button secondary" href="/movimentacoes/nova"><ArrowLeftRight size={16} />Transferir</Link><Link className="button primary" href="/equipamentos/novo"><Plus size={16} />Novo equipamento</Link></> : undefined} />
      {raw.returned && <div className="alert success" role="status">Equipamento devolvido à locadora e preservado no histórico.</div>}
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Patrimônio, série ou locadora" q={input.q}><select className="filter-select" name="ownership" defaultValue={ownership} aria-label="Tipo de propriedade"><option value="all">Todos</option><option value="owned">Próprios</option><option value="rented">Alugados</option></select></SearchToolbar></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Equipamento</th><th>Patrimônio</th><th>Propriedade</th><th>Categoria</th><th>Equipe atual</th><th>Situação</th><th></th></tr></thead>
          <tbody>{result.data.map((asset) => <tr key={asset.id}>
            <td><span className="primary-cell">{asset.items?.name ?? "Equipamento"}</span><span className="secondary-cell">{asset.items?.code ?? "—"}</span></td>
            <td className="numeric">{asset.asset_code}<span className="secondary-cell">{asset.serial_number ?? "Sem número de série"}</span></td>
            <td><OwnershipBadge type={asset.ownership_type} />{asset.ownership_type === "rented" && <span className="secondary-cell">{asset.rental_company ?? "Locadora não informada"}</span>}</td>
            <td>{asset.items?.category ?? "Sem categoria"}</td><td>{asset.teams?.name ?? "Sem equipe"}</td><td><StatusBadge value={asset.status} /></td>
            <td><Link className="text-link" href={`/equipamentos/${asset.id}`}>Detalhes</Link></td>
          </tr>)}</tbody>
        </table></div>}
        <Pagination {...result} q={input.q} extra={ownership !== "all" ? { ownership } : undefined} />
      </section>
    </>
  );
}
