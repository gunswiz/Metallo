import { createEquipment } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { EquipmentForm } from "@/02_COMPONENTES_VISUAIS/equipment-form";

export default async function NewEquipmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("operations:write");
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const { error } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="PATRIMÔNIO" title="Novo equipamento" description="O patrimônio individual é ligado a um tipo de equipamento e uma equipe inicial." />
      <section className="panel"><div className="panel-body">
        {error && <div className="alert error" role="alert">Revise os dados. Patrimônio, código, nome e equipe são obrigatórios.</div>}
        <EquipmentForm action={createEquipment} teams={teams} mode="create" />
      </div></section>
    </>
  );
}
