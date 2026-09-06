import Link from "next/link";
import { Plus } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { requireProfile } from "@/lib/auth/session";
import { parsePage, type SearchParams } from "@/lib/query";
import { getMetalloService } from "@/lib/services/metallo-service";

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const input = await parsePage(searchParams);
  const profile = await requireProfile();
  const canOperate = can(profile.role, "operations:write");
  const service = await getMetalloService();
  const result = await service.listMovements(input);

  return (
    <>
      <PageHeader
        eyebrow="AUDITORIA OPERACIONAL"
        title="Movimentações"
        description="Histórico cronológico de entradas, saídas, consumo e transferências."
        actions={canOperate ? <Link className="button primary" href="/movimentacoes/nova"><Plus size={16} />Nova movimentação</Link> : undefined}
      />
      <section className="panel">
        <div className="panel-body"><SearchToolbar placeholder="Pesquisar nas observações" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Origem</th><th>Destino</th><th>Quantidade</th><th>Responsável</th></tr></thead>
              <tbody>{result.data.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDateTime(movement.created_at)}</td>
                  <td><span className="primary-cell">{movement.items?.name ?? "Item removido"}</span><span className="secondary-cell">{movement.items?.code}</span></td>
                  <td>{movementLabel(movement.movement_type)}</td>
                  <td>{movement.origin?.name ?? "Externo"}</td>
                  <td>{movement.destination?.name ?? "Baixa"}</td>
                  <td>{movement.quantity} {movement.items?.unit}</td>
                  <td>{movement.profiles?.full_name ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
