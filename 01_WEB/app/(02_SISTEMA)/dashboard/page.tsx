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
import { lerVisaoTreinamentos5a } from "@/05_ACESSO_A_DADOS/Supabase/treinamentos-5a";
import { domingoEmFortaleza, horaFortaleza, lerEquipesSemConsumoHoje3p } from "@/05_ACESSO_A_DADOS/Supabase/avisos-3p";
import { AvisosCelular } from "@/02_COMPONENTES_VISUAIS/avisos-celular";
import { lerVencimentosEpi5d } from "@/05_ACESSO_A_DADOS/Supabase/alertas-5c";
import { situacaoCa5d } from "@/03_FUNCOES_E_LOGICA/Equipamentos/validade-ca-5d";

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
  // Marco 5A: ASO e treinamentos vencidos/vencendo (só laboratório e teste online).
  const treinos = can(profile, "epi:write") && recursosNovosLiberados(getSupabaseEnv().url) ?
    await lerVisaoTreinamentos5a().catch(() => null) : null;
  const vencidos = treinos?.filter(ficha => ficha.situacao === "VENCIDO").length ?? 0;
  const faltando = treinos?.filter(ficha => ficha.situacao === "FALTANDO").length ?? 0;
  const vencendo = treinos?.filter(ficha => ficha.situacao === "VENCE_EM_BREVE").length ?? 0;
  // Marco 5D: CA de EPI e lote de EPI vencidos ou vencendo em 30 dias.
  const vencEpi = can(profile, "epi:write") ? await lerVencimentosEpi5d().catch(() => null) ?? [] : [];
  const caVencido = vencEpi.filter(v => v.grupo === "CA" && situacaoCa5d(v.vence_em) === "vencido"), caVencendo = vencEpi.filter(v => v.grupo === "CA" && situacaoCa5d(v.vence_em) !== "vencido");
  const lotes = vencEpi.filter(v => v.grupo === "LOTE");
  const atalhos = ACOES_LANCAR.filter(acao => acao.pode(profile)).slice(0, 4);
  // Marco 3J: quantos pedidos do app do Funcionário esperam resposta (só laboratório e teste online).
  const pedidos = can(profile, "epi:write") && recursosNovosLiberados(getSupabaseEnv().url) ?
    await lerPedidosFuncionarios().then(result => result.aguardando, () => null) : null;
  // Marco 3P: consumo de hoje ainda não lançado (a partir das 14h; segunda a sábado).
  const novos = recursosNovosLiberados(getSupabaseEnv().url);
  const semConsumo = novos && horaFortaleza() >= 14 && !domingoEmFortaleza() ?
    (await lerEquipesSemConsumoHoje3p().catch(() => null)) ?? [] : [];

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
          {semConsumo.length > 0 && <Link className="todo-item" href="/lancar/consumo"><span className="todo-count">{semConsumo.length}</span><span className="todo-text"><strong>Consumo de hoje ainda não lançado</strong><small>{semConsumo.map(equipe => equipe.team_name).join(", ")}</small></span></Link>}
          {pedidos !== null && pedidos > 0 && <Link className="todo-item" href="/pedidos"><span className="todo-count">{pedidos}</span><span className="todo-text"><strong>Pedidos dos funcionários</strong><small>Trocas e avisos feitos pelo app esperando resposta</small></span></Link>}
          {vencidos > 0 && <Link className="todo-item" href="/treinamentos?filtro=vencido"><span className="todo-count">{vencidos}</span><span className="todo-text"><strong>ASO ou treinamento vencido</strong><small>Não deve fazer a atividade até regularizar</small></span></Link>}
          {faltando > 0 && <Link className="todo-item" href="/treinamentos?filtro=faltando"><span className="todo-count">{faltando}</span><span className="todo-text"><strong>Falta ASO ou treinamento obrigatório</strong><small>Cadastre o que falta para a função</small></span></Link>}
          {vencendo > 0 && <Link className="todo-item" href="/treinamentos?filtro=breve"><span className="todo-count">{vencendo}</span><span className="todo-text"><strong>Vencem em até 30 dias</strong><small>Agende a reciclagem ou o exame</small></span></Link>}
          {caVencido.length > 0 && <Link className="todo-item" href="/epis"><span className="todo-count">{caVencido.length}</span><span className="todo-text"><strong>EPI com C.A. vencido</strong><small>{caVencido.slice(0, 3).map(v => v.texto).join(", ")}{caVencido.length > 3 ? " e outros" : ""} · não comprar nem entregar até regularizar</small></span></Link>}
          {caVencendo.length > 0 && <Link className="todo-item" href="/epis"><span className="todo-count">{caVencendo.length}</span><span className="todo-text"><strong>C.A. de EPI vence em até 30 dias</strong><small>{caVencendo.slice(0, 3).map(v => v.texto).join(", ")}{caVencendo.length > 3 ? " e outros" : ""}</small></span></Link>}
          {lotes.length > 0 && <Link className="todo-item" href="/epis"><span className="todo-count">{lotes.length}</span><span className="todo-text"><strong>Lote de EPI vencido ou vencendo</strong><small>{lotes.slice(0, 3).map(v => v.texto).join(", ")}{lotes.length > 3 ? " e outros" : ""}</small></span></Link>}
          {aReceber > 0 && <Link className="todo-item" href="/lancar/receber"><span className="todo-count">{aReceber}</span><span className="todo-text"><strong>Pedidos para receber</strong><small>Compras providenciadas que ainda não chegaram por completo</small></span></Link>}
          {pedidosAbertos > 0 && <Link className="todo-item" href="/pedidos-adm"><span className="todo-count">{pedidosAbertos}</span><span className="todo-text"><strong>Pedidos à ADM em andamento</strong><small>Acompanhe a aprovação e a compra</small></span></Link>}
          {alertas.map(alerta => <Link className="todo-item" key={alerta.id} href={SECAO_ANTIGA[alerta.section] ?? "/obras"}><span className="todo-count">!</span><span className="todo-text"><strong>{alerta.title}</strong><small>{alerta.description}</small></span></Link>)}
          {!semConsumo.length && !(pedidos ?? 0) && !vencidos && !faltando && !vencendo && !vencEpi.length && !aReceber && !pedidosAbertos && alertas.length === 0 && <div className="todo-item ok"><span className="todo-text"><strong>Tudo em dia</strong><small>Nenhuma pendência no momento.</small></span></div>}
        </div>
      </section>
      {novos && <AvisosCelular compacto />}
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
