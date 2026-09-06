import Link from "next/link";
import { createMaterial } from "@/app/actions/operations";
import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/auth/session";
import { getMetalloService } from "@/lib/services/metallo-service";
import { SubmitButton } from "@/components/submit-button";

export default async function NewMaterialPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("operations:write");
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const { error } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="CADASTRO" title="Novo material" description="Cria ou reutiliza o catálogo e registra a entrada de estoque com histórico." />
      <section className="panel"><div className="panel-body">
        {error && <div className="alert error">Revise os campos. Código, nome, equipe e quantidade são obrigatórios.</div>}
        <form action={createMaterial} className="form-grid">
          <label>Código<input name="code" maxLength={40} required /></label><label>Nome<input name="name" maxLength={120} required /></label>
          <label>Categoria<input name="category" maxLength={80} /></label><label>Unidade<input name="unit" defaultValue="un" maxLength={20} required /></label>
          <label>Estoque mínimo<input name="minimumStock" type="number" min="0" defaultValue="0" required /></label>
          <label>Equipe/local<select name="teamId" required defaultValue=""><option value="" disabled>Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Quantidade inicial<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
          <label className="full">Descrição<textarea name="description" maxLength={500} /></label>
          <div className="form-actions"><Link className="button ghost" href="/materiais">Cancelar</Link><SubmitButton pendingLabel="Cadastrando…">Cadastrar e registrar entrada</SubmitButton></div>
        </form>
      </div></section>
    </>
  );
}
