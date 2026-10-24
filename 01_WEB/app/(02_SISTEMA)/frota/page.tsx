import Link from "next/link";
import { PainelFrota } from "@/02_COMPONENTES_VISUAIS/Frota/painel-frota";
import { ListaPrioridades } from "@/02_COMPONENTES_VISUAIS/lista-prioridades";
import { notFound } from "next/navigation";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { lerAtencaoFrota10a, lerPainelFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { salvarCaminhao10a } from "@/app/actions/frota-10a";

// Marco 10A — Frota de caminhões munck: quem está com cada caminhão, checklist de hoje, manutenção e vencimentos. Sem GPS.
export default async function FrotaPage({ searchParams }: { searchParams: Promise<{ ok?: string; novo?: string }> }) {
  const profile = await requireCapability("equipment:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const [frota, atencao] = await Promise.all([lerPainelFrota10a(), lerAtencaoFrota10a()]);
  const podeCadastrar = can(profile, "epi:write");
  return <>
    <PageHeader eyebrow="FROTA" title="Frota de caminhões" description="Situação de cada veículo, viagens e cuidados em um só lugar."
      actions={podeCadastrar ? <Link className="button primary" href="/frota?novo=1#novo-caminhao">+ Cadastrar caminhão</Link> : undefined}/>
    <SubNav profile={profile} grupo="frota"/>
    {query.ok && <div className="alert success" role="status">Salvo.</div>}
    {atencao.length > 0 && <ListaPrioridades titulo="Atenção na frota" limite={2} itens={atencao.map((a, i) => ({ id: String(i), titulo: a.nome, descricao: a.texto, href: `/frota/${a.veiculo_id}?aba=${a.tipo === "documento" ? "documentos" : a.tipo === "plano" ? "planos" : "manutencao"}`, urgente: a.gravidade === "vencido" }))}/>}
    <PainelFrota frota={frota}/>
    <details className="panel fleet-disclosure" id="relatorio-mes"><summary>Relatório do mês<span>Planilha para Excel</span></summary>
      <div className="panel-body"><form method="get" action="/frota/relatorio" className="filter-row">
        <label>Mês<input name="mes" type="month" lang="pt-BR" required defaultValue={new Date().toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" }).slice(0, 7)}/></label>
        <button className="button primary" type="submit">Baixar planilha</button></form>
        <p className="muted">Saídas, km rodados, checklists, defeitos, dias parado e custo de manutenção de cada caminhão.</p></div></details>
    {podeCadastrar && <details className="panel fleet-disclosure" id="novo-caminhao" open={query.novo === "1"}><summary>Cadastrar caminhão<span>Novo veículo</span></summary>
      <div className="panel-body"><OperationForm action={salvarCaminhao10a} label="Cadastrar" pendingLabel="Salvando…">
        <label>Nome (ex.: Munck 06)<input name="nome" required minLength={2} maxLength={60}/></label>
        <label>Placa<input name="placa" required maxLength={8} placeholder="ABC1D23"/></label>
        <label>Modelo (opcional)<input name="modelo" maxLength={60}/></label>
        <label>Ano (opcional)<input name="ano" type="number" min={1980} max={2100}/></label>
        <label>Km atual do painel<input name="km" type="number" min={0} max={3000000} required/></label>
      </OperationForm></div></details>}
  </>;
}
