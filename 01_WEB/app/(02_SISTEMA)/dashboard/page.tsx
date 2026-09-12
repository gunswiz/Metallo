import { Boxes, HardHat, PackageOpen, Users, UserRound, Wrench } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import { MetricCard } from "@/02_COMPONENTES_VISUAIS/metric-card";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const includeEpi = can(profile, "epi:read");
  const service = await getMetalloService();
  const data = await service.dashboard(includeEpi);

  return (
    <>
      <PageHeader
        eyebrow="VISÃO GERAL"
        title={`Olá, ${profile.fullName.split(" ")[0]}`}
        description="Dados operacionais do mesmo ambiente utilizado pelas equipes em campo."
      />
      <section className="metric-grid">
        <MetricCard label="unidades de materiais" value={data.materialUnits} href="/materiais" icon={PackageOpen} />
        <MetricCard label="equipamentos ativos" value={data.assets} href="/equipamentos" icon={Wrench} />
        <MetricCard label="equipamentos em uso" value={data.assetsInUse} href="/equipamentos" icon={Boxes} />
        <MetricCard label="equipes ativas" value={data.teams} href="/equipes" icon={Users} />
        {includeEpi && <MetricCard label="funcionários ativos" value={data.employees} href="/funcionarios" icon={UserRound} />}
        {includeEpi && <MetricCard label="EPIs e itens em uso" value={data.epiDeliveries} href="/epis" icon={HardHat} />}
      </section>
      <section className="content-grid">
        <div className="panel" id="atividade">
          <header className="panel-header"><div><h2>Movimentações recentes</h2><p>Últimas alterações registradas no estoque</p></div></header>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Operação</th><th>Fluxo</th><th>Quantidade</th><th>Data</th></tr></thead>
              <tbody>
                {data.recentMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td><span className="primary-cell">{movement.items?.name ?? "Item removido"}</span><span className="secondary-cell">{movement.items?.code ?? "—"}</span></td>
                    <td>{movementLabel(movement.movement_type)}</td>
                    <td>{movement.origin?.name ?? "Externo"} → {movement.destination?.name ?? "Baixa"}</td>
                    <td className="numeric">{movement.quantity} {movement.items?.unit}</td>
                    <td>{formatDateTime(movement.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <header className="panel-header"><div><h2>Leitura operacional</h2><p>Indicadores sem dados simulados</p></div></header>
          <div className="panel-body list">
            <div className="list-row"><span className="list-row-icon"><Wrench size={16} /></span><span className="list-row-main"><strong>Disponibilidade de equipamentos</strong><span>Patrimônios fora de manutenção</span></span><span className="list-row-value">{data.assets - data.assetsInUse}</span></div>
            <div className="list-row"><span className="list-row-icon"><Users size={16} /></span><span className="list-row-main"><strong>Estrutura ativa</strong><span>Equipes conectadas ao mesmo banco</span></span><span className="list-row-value">{data.teams}</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
