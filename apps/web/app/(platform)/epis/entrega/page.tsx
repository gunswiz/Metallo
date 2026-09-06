import { registerEpiDelivery } from "@/app/actions/operations";
import { PageHeader } from "@/components/page-header";
import { EpiDeliveryForm } from "@/components/epi-delivery-form";
import { requireCapability } from "@/lib/auth/session";
import { getMetalloService } from "@/lib/services/metallo-service";

export default async function EpiDeliveryPage({ searchParams }: { searchParams: Promise<{ error?: string; employee?: string; item?: string }> }) {
  await requireCapability("epi:write");
  const query = await searchParams;
  const service = await getMetalloService();
  const [employees, items] = await Promise.all([
    service.listEmployees({ page: 1, pageSize: 100, q: "" }),
    service.listEpiItems({ page: 1, pageSize: 100, q: "" }),
  ]);
  const batches = items.data.flatMap((item) => item.epi_stock_batches.filter((batch) => batch.quantity > 0).map((batch) => ({ ...batch, item })));
  return <><PageHeader eyebrow="SAÍDA DA COSEM" title="Registrar entrega" description="A RPC confere o lote, baixa o estoque e grava o histórico em uma única operação." />
    <section className="panel"><div className="panel-body">{query.error && <div className="alert error">Não foi possível entregar. Confira funcionário, lote e quantidade disponível.</div>}<EpiDeliveryForm
      action={registerEpiDelivery}
      initialEmployee={query.employee}
      employees={employees.data.map((employee) => ({ id: employee.id, name: employee.full_name, team: employee.teams?.name ?? "Sem equipe" }))}
      batches={batches.map(({ item, ...batch }) => ({ id: batch.id, itemId: item.id, itemName: item.name, itemCode: item.code, variant: batch.variant, quantity: batch.quantity, unit: item.unit }))}
    /></div></section></>;
}
