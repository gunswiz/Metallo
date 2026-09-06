import Link from "next/link";
import { createEquipment } from "@/app/actions/operations";
import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/auth/session";
import { getMetalloService } from "@/lib/services/metallo-service";
import { SubmitButton } from "@/components/submit-button";

export default async function NewEquipmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("operations:write");
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const { error } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="PATRIMÔNIO" title="Novo equipamento" description="O patrimônio individual é ligado a um tipo de equipamento e uma equipe inicial." />
      <section className="panel"><div className="panel-body">
        {error && <div className="alert error">Revise os dados. Patrimônio, código, nome e equipe são obrigatórios.</div>}
        <form action={createEquipment} className="form-grid">
          <label>Código do tipo<input name="code" maxLength={40} placeholder="EQ-SOLDA-MIG" required /></label><label>Nome do tipo<input name="name" maxLength={120} placeholder="Máquina de solda MIG" required /></label>
          <label>Patrimônio<input name="assetCode" maxLength={80} required /></label><label>Número de série<input name="serialNumber" maxLength={120} /></label>
          <label>Categoria<input name="category" maxLength={80} /></label><label>Equipe/local<select name="teamId" required defaultValue=""><option value="" disabled>Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label className="full">Descrição do tipo<textarea name="description" maxLength={500} /></label><label className="full">Observação do patrimônio<textarea name="notes" maxLength={500} /></label>
          <div className="form-actions"><Link className="button ghost" href="/equipamentos">Cancelar</Link><SubmitButton pendingLabel="Cadastrando…">Cadastrar patrimônio</SubmitButton></div>
        </form>
      </div></section>
    </>
  );
}
