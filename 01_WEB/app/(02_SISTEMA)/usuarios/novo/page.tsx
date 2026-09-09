import Link from "next/link";
import { createUserAccount } from "@/app/actions/administracao-completa";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
export default async function NewUserPage() {
  await requireCapability("admin:manage");
  const teams = await (await getMetalloService()).listTeams();
  return <><PageHeader eyebrow="CONTROLE DE ACESSO" title="Criar acesso ao Metallo" description="Crie as credenciais usadas no Web e no aplicativo. O cadastro de funcionário para EPI é separado." actions={<Link className="button ghost" href="/usuarios">Voltar</Link>} />
    <section className="panel"><div className="panel-body"><OperationForm action={createUserAccount} label="Criar acesso" pendingLabel="Criando acesso…">
      <label>Nome completo<input name="fullName" required minLength={2} maxLength={140} autoComplete="name" /></label>
      <label>E-mail<input name="email" type="email" required autoComplete="off" /></label>
      <label className="full">Senha inicial<input name="password" type="password" autoComplete="new-password" required minLength={12} aria-describedby="password-help" /><span id="password-help">Use 12 caracteres ou mais, com maiúscula, minúscula, número e símbolo.</span></label>
      <label>Papel<select name="role" defaultValue="collaborator"><option value="collaborator">Colaborador</option><option value="leader">Líder</option><option value="engineer">Engenheiro</option></select></label>
      <label>Equipe<select name="teamId" required defaultValue=""><option value="">Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
    </OperationForm></div></section></>;
}
