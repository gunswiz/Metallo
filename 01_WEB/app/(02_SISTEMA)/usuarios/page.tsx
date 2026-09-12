import Link from "next/link";
import { EditUser } from "@/02_COMPONENTES_VISUAIS/editar-usuario";
import type { UserRole } from "@metallo/types";
import { roleLabels } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

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
          <EditUser profile={{ ...profile, role: profile.role as UserRole }} teams={teams} />
        </td></tr>)}
      </tbody></table></div></section>
    </>
  );
}
