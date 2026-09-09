import Link from "next/link";
import { createTeam } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";

export default async function NewTeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("admin:manage");
  const { error } = await searchParams;
  return <><PageHeader eyebrow="ESTRUTURA" title="Nova equipe" description="A equipe passa a participar dos mesmos fluxos de estoque, equipamentos, EPI e histórico." />
    <section className="panel"><div className="panel-body">{error && <div className="alert error" role="alert">Não foi possível criar a equipe. Verifique o nome e as regras do ambiente.</div>}<form action={createTeam} className="form-grid">
      <label>Nome<input name="name" required maxLength={100} /></label><label>Tipo<select name="locationType" defaultValue="field"><option value="field">Equipe de campo</option><option value="central">Centro de distribuição</option></select></label><label className="full">Descrição<textarea name="description" maxLength={300} /></label><div className="form-actions"><Link className="button ghost" href="/equipes">Cancelar</Link><SubmitButton pendingLabel="Criando…">Criar equipe</SubmitButton></div>
    </form></div></section></>;
}
