import Link from "next/link";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { BatchDeliveryForm } from "@/02_COMPONENTES_VISUAIS/entrega-lote-form";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
export default async function BatchDeliveryPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  await requireCapability("epi:write");
  const query = await searchParams;
  const choices = await (await getEpiOperations()).choices();
  const itemMap = new Map(choices.items.map((item) => [item.id, item]));
  const batches = choices.batches.flatMap((batch) => { const item = itemMap.get(batch.item_id); return item ? [{ ...batch, name: item.name, unit: item.unit }] : []; });
  return <><PageHeader eyebrow="SAÍDA DA COSEM" title="Entregar vários itens" description="Escolha os lotes e revise a lista. Todos os itens serão registrados juntos para o funcionário." actions={<Link className="button ghost" href="/epis/entrega">Entrega de um item</Link>} />
    <section className="panel"><div className="panel-body"><BatchDeliveryForm employees={choices.employees} batches={batches} initialEmployee={query.employee} /></div></section></>;
}
