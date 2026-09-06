import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { parsePage, type SearchParams } from "@/lib/query";
import { getMetalloService } from "@/lib/services/metallo-service";
import { requireProfile } from "@/lib/auth/session";
import { can } from "@metallo/core";

export default async function EquipmentPage({ searchParams }: { searchParams: SearchParams }) {
  const input = await parsePage(searchParams);
  const profile = await requireProfile();
  const canOperate = can(profile.role, "operations:write");
  const service = await getMetalloService();
  const result = await service.listAssets(input);
  return (
    <>
      <PageHeader eyebrow="PATRIMÔNIO" title="Equipamentos" description="Posse atual, condição e histórico individual de cada patrimônio." actions={canOperate ? <><Link className="button secondary" href="/movimentacoes/nova"><ArrowLeftRight size={16} />Transferir</Link><Link className="button primary" href="/equipamentos/novo"><Plus size={16} />Novo equipamento</Link></> : undefined} />
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Patrimônio ou número de série" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table">
          <thead><tr><th>Equipamento</th><th>Patrimônio</th><th>Categoria</th><th>Equipe atual</th><th>Status</th><th></th></tr></thead>
          <tbody>{result.data.map((asset) => <tr key={asset.id}>
            <td><span className="primary-cell">{asset.items?.name ?? "Equipamento"}</span><span className="secondary-cell">{asset.items?.code ?? "—"}</span></td>
            <td className="numeric">{asset.asset_code}<span className="secondary-cell">{asset.serial_number ?? "Sem número de série"}</span></td>
            <td>{asset.items?.category ?? "Sem categoria"}</td><td>{asset.teams?.name ?? "Sem equipe"}</td><td><StatusBadge value={asset.status} /></td>
            <td><Link className="text-link" href={`/equipamentos/${asset.id}`}>Detalhes</Link></td>
          </tr>)}</tbody>
        </table></div>}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
