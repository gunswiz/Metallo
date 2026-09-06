import Link from "next/link";
import { Building2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getMetalloService } from "@/lib/services/metallo-service";
import { requireProfile } from "@/lib/auth/session";
import { can } from "@metallo/core";
import { Plus } from "lucide-react";

export default async function TeamsPage() {
  const service = await getMetalloService();
  const profile = await requireProfile();
  const teams = await service.listTeams();
  return (
    <>
      <PageHeader eyebrow="ESTRUTURA OPERACIONAL" title="Equipes e locais" description="A COSEM permanece como centro; equipes representam as frentes de trabalho." actions={can(profile.role, "admin:manage") ? <Link className="button primary" href="/equipes/nova"><Plus size={16} />Nova equipe</Link> : undefined} />
      <section className="panel"><div className="panel-body list">
        {teams.map((team) => <Link className="list-row" href={`/equipes/${team.id}`} key={team.id}>
          <span className="list-row-icon">{team.location_type === "central" ? <Building2 size={17} /> : <Users size={17} />}</span>
          <span className="list-row-main"><strong>{team.name}</strong><span>{team.description ?? (team.location_type === "central" ? "Centro de estoque e distribuição" : "Equipe de campo")}</span></span>
          <StatusBadge value="active" label={team.location_type === "central" ? "Central" : "Ativa"} />
        </Link>)}
      </div></section>
    </>
  );
}
