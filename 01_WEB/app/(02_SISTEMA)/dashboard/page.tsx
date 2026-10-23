import { HardHat, PackageOpen, Users, UserRound, Wrench } from "lucide-react";
import { can, formatDateTime, movementLabel } from "@metallo/core";
import Link from "next/link";
import { ListaPrioridades, type Prioridade } from "@/02_COMPONENTES_VISUAIS/lista-prioridades";
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

  const prioridades: Prioridade[] = [];
  const adicionar = (id: string, quantidade: number, titulo: string, descricao: string, href: string, urgente = false) => {
    if (quantidade > 0) prioridades.push({ id, quantidade, titulo, descricao, href, urgente });
  };
  adicionar("treinos-vencidos", vencidos, "ASO ou treinamento vencido", "Regularize antes de realizar a atividade.", "/treinamentos?filtro=vencido", true);
  adicionar("treinos-faltando", faltando, "Falta ASO ou treinamento obrigatório", "Confira os requisitos de cada função.", "/treinamentos?filtro=faltando", true);
  adicionar("ca-vencido", caVencido.length, "EPI com C.A. vencido", "Confira a validade antes de comprar ou entregar.", "/epis", true);
  adicionar("lotes", lotes.length, "Lotes de EPI para conferir", "Há lotes vencidos ou próximos do vencimento.", "/epis", true);
  adicionar("pedidos", pedidos ?? 0, "Pedidos dos funcionários", "Solicitações aguardando sua resposta.", "/pedidos");
  adicionar("consumo", semConsumo.length, "Consumo de hoje não lançado", semConsumo.slice(0, 2).map(e => e.team_name).join(", ") + (semConsumo.length > 2 ? " e outras equipes" : ""), "/lancar/consumo");
  adicionar("receber", aReceber, "Pedidos para receber", "Compras que ainda não chegaram por completo.", "/lancar/receber");
  adicionar("pedidos-adm", pedidosAbertos, "Pedidos à ADM em andamento", "Acompanhe a aprovação e a compra.", "/pedidos-adm");
  adicionar("treinos-breve", vencendo, "Exames e treinamentos a vencer", "Agende a renovação nos próximos 30 dias.", "/treinamentos?filtro=breve");
  adicionar("ca-breve", caVencendo.length, "C.A. de EPI a vencer", "Validade termina nos próximos 30 dias.", "/epis");
  for (const a of alertas) prioridades.push({ id: "obra-" + a.id, titulo: a.title, descricao: a.description, href: SECAO_ANTIGA[a.section] ?? "/obras" });

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
      <ListaPrioridades itens={prioridades}/>

      <section className="metric-grid dashboard-metrics" aria-label="Resumo da operação">
        <MetricCard label="unidades de materiais" value={data.materialUnits} href="/materiais" icon={PackageOpen} />
        <MetricCard label="equipamentos ativos" value={data.assets} href="/equipamentos" icon={Wrench} />
        <MetricCard label="equipes ativas" value={data.teams} href="/equipes" icon={Users} />
        {includeEpi && <MetricCard label="funcionários ativos" value={data.employees} href="/funcionarios" icon={UserRound} />}

      </section>
      <details className="panel dashboard-details" id="atividade"><summary>Atividade recente e outros indicadores<span>Consultar</span></summary>
      <section className="content-grid">
        <div className="panel">
          <header className="panel-header"><div><h2>Movimentações recentes</h2><p>Últimas alterações registradas no estoque</p></div></header>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Operação</th><th>Fluxo</th><th>Quantidade</th><th>Data</th></tr></thead>
              <tbody>
                {data.recentMovements.slice(0, 5).map((movement) => (
                  <tr key={movement.id}>
                    <td data-label="Item"><span className="primary-cell">{movement.items?.name ?? "Item removido"}</span><span className="secondary-cell">{movement.items?.code ?? "—"}</span></td>
                    <td data-label="Operação">{movementLabel(movement.movement_type)}</td>
                    <td data-label="Fluxo">{movement.origin?.name ?? "Externo"} → {movement.destination?.name ?? "Baixa"}</td>
                    <td data-label="Quantidade" className="numeric">{movement.quantity} {movement.items?.unit}</td>
                    <td data-label="Data">{formatDateTime(movement.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-body"><Link className="button ghost" href="/movimentacoes">Ver todas as movimentações</Link></div>
        </div>
        <div className="panel">
          <header className="panel-header"><div><h2>Outros indicadores</h2><p>Mais informações da operação</p></div></header>
          <div className="panel-body list">
            <div className="list-row"><span className="list-row-icon"><Wrench size={16} /></span><span className="list-row-main"><strong>Equipamentos em uso</strong></span><span className="list-row-value">{data.assetsInUse}</span></div>
            {includeEpi && <div className="list-row"><span className="list-row-icon"><HardHat size={16}/></span><span className="list-row-main"><strong>EPIs e itens em uso</strong></span><span className="list-row-value">{data.epiDeliveries}</span></div>}
          </div>
        </div>
      </section></details>
      {novos && <AvisosCelular compacto />}
    </>
  );
}
