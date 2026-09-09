import Link from "next/link";
import { roleLabels } from "@metallo/core";
import { updateProfile } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string; created?: string }> }) {
  await requireCapability("admin:manage");
  const query = await searchParams;
  const service = await getMetalloService();
  const [profiles, teams] = await Promise.all([service.listProfiles(), service.listTeams()]);
  return (
    <>
      <PageHeader eyebrow="CONTROLE DE ACESSO" title="Usuários" actions={<Link className="button primary" href="/usuarios/novo">Novo usuário</Link>} description="Ativação, papel e equipe dos perfis que usam as mesmas credenciais no site e no aplicativo móvel." />
      {query.created && <div className="alert success" role="status">Usuário cadastrado.</div>}
      {query.updated && <div className="alert success" role="status">Perfil atualizado com sucesso.</div>}
      {query.error && <div className="alert error" role="alert">Não foi possível atualizar. Verifique papel, equipe e a proteção do último administrador.</div>}
      <section className="panel"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Usuário</th><th>Papel atual</th><th>Equipe</th><th>Situação</th><th>Gerenciar</th></tr></thead><tbody>
        {profiles.map((profile) => <tr key={profile.id}><td><span className="primary-cell">{profile.full_name}</span><span className="secondary-cell">{profile.id.slice(0, 8)}…</span></td><td>{roleLabels[profile.role as keyof typeof roleLabels] ?? profile.role}</td><td>{profile.teams?.name ?? "Acesso geral"}</td><td><StatusBadge value={profile.active ? "active" : "retired"} label={profile.active ? "Ativo" : "Inativo"} /></td><td>
          <details><summary className="text-link" style={{ cursor: "pointer", margin: 0 }}>Editar</summary><form action={updateProfile} className="form-grid user-edit-form">
            <input name="userId" type="hidden" value={profile.id} /><label className="full">Nome<input name="fullName" defaultValue={profile.full_name} required /></label>
            <label>Papel<select name="role" defaultValue={profile.role}><option value="admin">Administrador</option><option value="engineer">Engenheiro</option><option value="leader">Líder</option><option value="collaborator">Colaborador</option></select></label>
            <label>Equipe<select name="teamId" defaultValue={profile.team_id ?? ""}><option value="">Acesso geral</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="full" style={{ display: "flex", gridTemplateColumns: "auto 1fr", alignItems: "center" }}><input name="active" type="checkbox" defaultChecked={profile.active} style={{ minHeight: 20, width: 20 }} /> Perfil ativo</label>
            <div className="form-actions"><SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton></div>
          </form></details>
        </td></tr>)}
      </tbody></table></div></section>
    </>
  );
}
