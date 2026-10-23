import { notFound } from "next/navigation";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { lerItensFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { salvarItem10a } from "@/app/actions/frota-10a";

// Marco 10A — itens do checklist do caminhão (os 26 da planilha METALLO-ENG-01). "Crítico" bloqueia o caminhão quando reprovado.
export default async function ItensFrotaPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const profile = await requireCapability("equipment:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const itens = await lerItensFrota10a();
  const edita = can(profile, "epi:write");
  return <>
    <PageHeader eyebrow="FROTA" title="Itens do checklist" description="Os itens que o motorista confere todo dia. Item crítico reprovado deixa o caminhão não liberado até o engenheiro liberar ou consertar."/>
    <SubNav profile={profile} grupo="frota"/>
    {query.ok && <div className="alert success" role="status">Item salvo.</div>}
    <p className="alert" role="note">Os itens marcados como críticos aqui são uma sugestão inicial (freios, pneus, comandos, mangueiras, moitão e outros que afetam a segurança). O engenheiro ajusta como achar melhor{edita ? "" : " (só administrador e engenheiro alteram)"}. A mudança vale para os próximos checklists.</p>
    <section className="fleet-checklist-config" aria-label="Itens">
      {itens.map(item => <article className="stock-card" key={item.codigo}>
        {edita ? <details className="fleet-item-editor"><summary><span><strong>{item.codigo}. {item.nome}</strong><small>{item.critico ? "Crítico · bloqueia se reprovado" : "Item de conferência"}{item.ativo ? "" : " · desativado"}</small></span><span>Editar</span></summary><OperationForm action={salvarItem10a} label="Salvar" pendingLabel="Salvando…">
          <input type="hidden" name="codigo" value={item.codigo}/>
          <label>{item.codigo}. Nome<input name="nome" defaultValue={item.nome} required minLength={2} maxLength={80}/></label>
          <label><input type="checkbox" name="critico" defaultChecked={item.critico}/> Crítico (bloqueia o caminhão)</label>
          <label><input type="checkbox" name="ativo" defaultChecked={item.ativo}/> Usar no checklist</label>
        </OperationForm></details> : <p><strong>{item.codigo}. {item.nome}</strong><br/>{item.critico ? "Crítico" : "Comum"}{item.ativo ? "" : " · fora do checklist"}</p>}
      </article>)}
    </section>
    {edita && <section className="panel" style={{ marginTop: 20 }}><header className="panel-header"><div><h2>Novo item</h2></div></header><div className="panel-body">
      <OperationForm action={salvarItem10a} label="Adicionar item" pendingLabel="Salvando…">
        <input type="hidden" name="codigo" value=""/>
        <label>Nome<input name="nome" required minLength={2} maxLength={80}/></label>
        <label><input type="checkbox" name="critico"/> Crítico (bloqueia o caminhão)</label>
      </OperationForm></div></section>}
  </>;
}
