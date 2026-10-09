import { createEquipment } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { EquipmentForm } from "@/02_COMPONENTES_VISUAIS/equipment-form";
import { aluguelLiberado3r } from "@/05_ACESSO_A_DADOS/Supabase/aluguel-3r";

export default async function NewEquipmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("equipment:write");
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const { error } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="PATRIMÔNIO" title="Novo equipamento" description="O patrimônio individual é ligado a um tipo de equipamento e uma equipe inicial." />
      <section className="panel"><div className="panel-body">
        {error && <div className="alert error" role="alert">Revise os dados. Patrimônio, código, nome e equipe são obrigatórios. No alugado, o valor do equipamento deve ser escrito como 15.000,00.</div>}
        <EquipmentForm action={createEquipment} teams={teams} mode="create" extrasAluguel={aluguelLiberado3r()} />
      </div></section>
    </>
  );
}
