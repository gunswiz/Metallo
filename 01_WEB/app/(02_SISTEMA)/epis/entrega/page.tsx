import Link from "next/link";
import { registerEpiDelivery } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { EpiDeliveryForm } from "@/02_COMPONENTES_VISUAIS/epi-delivery-form";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function EpiDeliveryPage({ searchParams }: { searchParams: Promise<{ error?: string; employee?: string; item?: string; kind?: string }> }) {
  await requireCapability("epi:write");
  const query = await searchParams;
  const service = await getMetalloService();
  const requestedKind = query.kind === "epi" || query.kind === "uniform" || query.kind === "personal_tool" ? query.kind : undefined;
  const [employees, items] = await Promise.all([
    service.listEmployees({ page: 1, pageSize: 100, q: "" }),
    service.listEpiItems({ page: 1, pageSize: 100, q: "" }, requestedKind),
  ]);
  const batches = items.data.flatMap((item) => item.epi_stock_batches.filter((batch) => batch.quantity > 0).map((batch) => ({ ...batch, item })));
  return <><PageHeader eyebrow="SAÍDA DA COSEM" title="Registrar entrega" description="Selecione o funcionário e o lote para registrar a entrega e atualizar o estoque." actions={<Link className="button secondary" href="/epis/entrega-em-lote">Entregar vários itens</Link>} />
    <section className="panel"><div className="panel-body">{query.error && <div className="alert error" role="alert">Não foi possível entregar. Confira funcionário, lote e quantidade disponível.</div>}<EpiDeliveryForm
      action={registerEpiDelivery}
      initialEmployee={query.employee}
      initialItem={query.item}
      employees={employees.data.map((employee) => ({ id: employee.id, name: employee.full_name, team: employee.teams?.name ?? "Sem equipe" }))}
      batches={batches.map(({ item, ...batch }) => ({ id: batch.id, itemId: item.id, itemName: item.name, itemCode: item.code, variant: batch.variant, quantity: batch.quantity, unit: item.unit }))}
    /></div></section></>;
}
