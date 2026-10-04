import { Boxes, HardHat, Inbox, PackageOpen, Users, UserRound, Wrench } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import Link from "next/link";
import { MetricCard } from "@/02_COMPONENTES_VISUAIS/metric-card";
import { ICONES } from "@/02_COMPONENTES_VISUAIS/icones-menu";
import { ACOES_LANCAR, SECAO_ANTIGA } from "@/09_CONFIGURACOES/navegacao-gestao";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { lerPedidosFuncionarios } from "@/05_ACESSO_A_DADOS/Repositorios/pedidos-funcionarios";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const includeEpi = can(profile, "epi:read");
  const service = await getMetalloService();
  const data = await service.dashboard(includeEpi);
  // Marco 3K: "Precisa de você" — o que espera uma ação, com o caminho certo para resolver.
  const obra = await service.siteSnapshot().catch(() => null);
  const finais = ["received", "rejected", "cancelled", "returned"];
  const pedidosAbertos = obra?.orders.filter(order => !finais.includes(order.status)).length ?? 0;
  const aReceber = obra?.orders.filter(order => ["ordered", "partial"].includes(order.status)).length ?? 0;
  const alertas = profile.role === "admin" ? obra?.alerts ?? [] : [];
  const atalhos = ACOES_LANCAR.filter(acao => acao.pode(profile)).slice(0, 4);
  // Marco 3J: quantos pedidos do app do Funcionário esperam resposta (só laboratório e teste online).
  const pedidos = can(profile, "epi:write") && recursosNovosLiberados(getSupabaseEnv().url) ?
    await lerPedidosFuncionarios().then(result => result.aguardando, () => null) : null;

  return (
    <>
      <PageHeader
        eyebrow="INÍCIO"
        title={`Olá, ${profile.fullName.split(" ")[0]}`}
        description="O que precisa de você hoje e os atalhos do dia a dia."
      />
      {atalhos.length > 0 && <nav className="quick-grid" aria-label="Atalhos">{atalhos.map(acao => {
        const Icon = ICONES[acao.icone] ?? ICONES.outros;
        return <Link key={acao.slug} className="quick-card" href={`/lancar/${acao.slug}`}><Icon size={30} aria-hidden/><span><strong>{acao.label}</strong><small>{acao.dica}</small></span></Link>;
      })}</nav>}
      <section className="panel" id="pendencias" aria-labelledby="pendencias-titulo">
        <header className="panel-header"><div><h2 id="pendencias-titulo">Precisa de você</h2><p>Toque para resolver.</p></div></header>
        <div className="panel-body todo-list">
          {pedidos !== null && pedidos > 0 && <Link className="todo-item" href="/pedidos"><span className="todo-count">{pedidos}</span><span className="todo-text"><strong>Pedidos dos funcionários</strong><small>Trocas e avisos feitos pelo app esperando resposta</small></span></Link>}
          {aReceber > 0 && <Link className="todo-item" href="/lancar/receber"><span className="todo-count">{aReceber}</span><span className="todo-text"><strong>Pedidos para receber</strong><small>Compras providenciadas que ainda não chegaram por completo</small></span></Link>}
          {pedidosAbertos > 0 && <Link className="todo-item" href="/pedidos-adm"><span className="todo-count">{pedidosAbertos}</span><span className="todo-text"><strong>Pedidos à ADM em andamento</strong><small>Acompanhe a aprovação e a compra</small></span></Link>}
          {alertas.map(alerta => <Link className="todo-item" key={alerta.id} href={SECAO_ANTIGA[alerta.section] ?? "/obras"}><span className="todo-count">!</span><span className="todo-text"><strong>{alerta.title}</strong><small>{alerta.description}</small></span></Link>)}
          {!(pedidos ?? 0) && !aReceber && !pedidosAbertos && alertas.length === 0 && <div className="todo-item ok"><span className="todo-text"><strong>Tudo em dia</strong><small>Nenhuma pendência no momento.</small></span></div>}
        </div>
      </section>
      <section className="metric-grid">
        {pedidos !== null && <MetricCard label="pedidos dos funcionários esperando resposta" value={pedidos} href="/pedidos" icon={Inbox} />}
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
