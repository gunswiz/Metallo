import { listEquipmentHistory } from "@/05_ACESSO_A_DADOS/Repositorios/historico-operacoes-repository";
import Link from "next/link";
import { Plus } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { EmptyState } from "@/02_COMPONENTES_VISUAIS/empty-state";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { Pagination } from "@/02_COMPONENTES_VISUAIS/pagination";
import { SearchToolbar } from "@/02_COMPONENTES_VISUAIS/search-toolbar";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { parsePage, type SearchParams } from "@/03_FUNCOES_E_LOGICA/lerFiltrosEPaginacao";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const input = await parsePage(searchParams);
  const profile = await requireProfile();
  const canOperate = can(profile, "operations:write");
  const service = await getMetalloService();
  const raw = await searchParams;
  const kind = raw.kind === "equipment" ? "equipment" : "material";
  const canAdmin = can(profile, "admin:manage");
  const result = kind === "equipment" ? await listEquipmentHistory(input) : await service.listMovements(input);
  const rows = result.data.map((movement) => ({ ...movement,
    displayItem: "assets" in movement ? movement.assets?.items : movement.items,
    amount: "quantity" in movement ? String(movement.quantity) + " " + (movement.items?.unit ?? "") : movement.assets?.asset_code ?? "—",
  }));

  return (
    <>
      <PageHeader
        eyebrow="AUDITORIA OPERACIONAL"
        title="Movimentações"
        description="Histórico cronológico de entradas, saídas, consumo e transferências."
        actions={canOperate ? <Link className="button primary" href="/movimentacoes/nova"><Plus size={16} />Nova movimentação</Link> : undefined}
      />
      {(raw.updated || raw.removed) && <div className="alert success" role="status">Histórico atualizado.</div>}
      <section className="panel">
        <div className="panel-body"><div className="module-tabs"><Link href="/movimentacoes" className={kind === "material" ? "active" : undefined}>Materiais</Link><Link href="/movimentacoes?kind=equipment" className={kind === "equipment" ? "active" : undefined}>Equipamentos</Link></div><SearchToolbar placeholder="Pesquisar nas observações" q={input.q}><input type="hidden" name="kind" value={kind} /></SearchToolbar></div>
        {result.data.length === 0 ? <EmptyState /> : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Data</th><th>Item</th><th>Tipo</th><th>Origem</th><th>Destino</th><th>{kind === "equipment" ? "Patrimônio" : "Quantidade"}</th><th>Responsável</th>{canAdmin && <th>Gerenciar</th>}</tr></thead>
              <tbody>{rows.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDateTime(movement.occurred_at ?? movement.created_at)}<span className="secondary-cell">Registrado: {formatDateTime(movement.created_at)}</span></td>
                  <td><span className="primary-cell">{movement.displayItem?.name ?? "Item removido"}</span><span className="secondary-cell">{movement.displayItem?.code}</span></td>
                  <td>{movementLabel(movement.movement_type)}</td>
                  <td>{movement.origin?.name ?? "Externo"}</td>
                  <td>{movement.destination?.name ?? "Baixa"}</td>
                  <td>{movement.amount}</td>
                  <td>{movement.profiles?.full_name ?? "—"}</td>{canAdmin && <td><Link href={`/movimentacoes/${movement.id}/editar?kind=${kind}`}>Editar</Link></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pagination {...result} q={input.q} extra={{ kind }} />
      </section>
    </>
  );
}
