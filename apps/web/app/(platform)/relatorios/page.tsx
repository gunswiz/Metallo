import { HardHat, PackageOpen, Users, Wrench } from "lucide-react";
import { can } from "@metallo/core";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth/session";
import { getMetalloService } from "@/lib/services/metallo-service";

export default async function ReportsPage() {
  const profile = await requireProfile();
  const includeEpi = can(profile.role, "epi:read");
  const service = await getMetalloService();
  const data = await service.dashboard(includeEpi);
  return (
    <>
      <PageHeader eyebrow="INDICADORES REAIS" title="Relatórios" description="Resumo operacional calculado somente com registros acessíveis ao seu perfil." />
      <section className="metric-grid">
        <MetricCard label="unidades de materiais" value={data.materialUnits} href="/materiais" icon={PackageOpen} />
        <MetricCard label="equipamentos cadastrados" value={data.assets} href="/equipamentos" icon={Wrench} />
        <MetricCard label="equipes" value={data.teams} href="/equipes" icon={Users} />
        {includeEpi && <MetricCard label="itens entregues em uso" value={data.epiDeliveries} href="/epis" icon={HardHat} />}
      </section>
      <section className="panel" style={{ marginTop: 16 }}><div className="panel-body"><p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Este primeiro relatório preserva a fidelidade dos dados. Exportações, comparações mensais e inventário avançado serão adicionados sobre consultas agregadas e auditáveis, sem carregar a base completa no navegador.</p></div></section>
    </>
  );
}
