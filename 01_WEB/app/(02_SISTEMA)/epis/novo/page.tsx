import { createEpiItem } from "@/app/actions/operations";
import { EpiItemForm } from "@/02_COMPONENTES_VISUAIS/epi-item-form";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";

const titles = { epi: "Novo EPI", uniform: "Novo fardamento", personal_tool: "Novo item pessoal" } as const;

export default async function NewEpiItemPage({ searchParams }: { searchParams: Promise<{ kind?: string; error?: string }> }) {
  await requireCapability("admin:manage");
  const query = await searchParams;
  const kind = query.kind === "uniform" || query.kind === "personal_tool" ? query.kind : "epi";
  return <>
    <PageHeader eyebrow="CATÁLOGO DA COSEM" title={titles[kind]} description="Primeiro cadastre o tipo. Entradas futuras e entregas continuam como operações separadas e rastreáveis." />
    {query.error && <div className="alert error" role="alert">Não foi possível cadastrar. Confira o código, os campos obrigatórios e os valores de estoque.</div>}
    <section className="panel"><div className="panel-body"><EpiItemForm action={createEpiItem} initialKind={kind} /></div></section>
  </>;
}
