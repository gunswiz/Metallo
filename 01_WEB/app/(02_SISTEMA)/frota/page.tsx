import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, type PainelGestao10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { lerAtencaoFrota10a, lerPainelFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { salvarCaminhao10a } from "@/app/actions/frota-10a";

// Marco 10A — Frota de caminhões munck: quem está com cada caminhão, checklist de hoje, manutenção e vencimentos. Sem GPS.
const tomSituacao = (s: PainelGestao10a["situacao"]) => s === "disponivel" ? "good" : s === "em_uso" ? "warn" : "bad";
const tomChecklist = (r: PainelGestao10a["checklist_hoje"]) => r === "liberado" ? "good" : r === "ressalvas" ? "warn" : "bad";
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function FrotaPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const profile = await requireCapability("equipment:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const [frota, atencao] = await Promise.all([lerPainelFrota10a(), lerAtencaoFrota10a()]);
  const ativos = frota.filter(v => v.ativo);
  const contar = (s: PainelGestao10a["situacao"]) => ativos.filter(v => v.situacao === s).length;
  const semChecklist = ativos.filter(v => v.situacao !== "em_uso" && v.situacao !== "manutencao" && !v.checklist_hoje).length;
  const podeCadastrar = can(profile, "epi:write");
  return <>
    <PageHeader eyebrow="FROTA" title="Caminhões munck" description="Quem está com cada caminhão, o checklist de hoje, a manutenção e os vencimentos. Sem rastreamento: o GPS continua no sistema do caminhão."
      actions={podeCadastrar ? <a className="button primary" href="#novo-caminhao">Cadastrar caminhão</a> : undefined}/>
    <SubNav profile={profile} grupo="frota"/>
    {query.ok && <div className="alert success" role="status">Salvo.</div>}
    <section className="stock-cards" aria-label="Resumo da frota">
      <article className="stock-card"><h3>{contar("disponivel")}</h3><small>Disponíveis</small></article>
      <article className="stock-card"><h3>{contar("em_uso")}</h3><small>Na rua</small></article>
      <article className="stock-card"><h3>{contar("nao_liberado")}</h3><small>Não liberados</small></article>
      <article className="stock-card"><h3>{contar("manutencao")}</h3><small>Na oficina</small></article>
      <article className="stock-card"><h3>{semChecklist}</h3><small>Sem checklist hoje</small></article>
    </section>
    {atencao.length > 0 && <section className="panel" aria-label="Precisa de atenção"><header className="panel-header"><div><h2>Precisa de atenção</h2><p>Documentos, manutenção preventiva e caminhões parados.</p></div></header>
      <div className="panel-body"><ul className="frota-atencao">{atencao.map((a, i) => <li key={i} className={a.gravidade === "vencido" ? "bad" : "warn"}>
        <Link href={`/frota/${a.veiculo_id}`}><strong>{a.nome}</strong></Link><span>{a.texto}</span></li>)}</ul></div></section>}
    <section className="stock-cards frota-lista" aria-label="Caminhões">
      {frota.length === 0 && <p className="muted">Nenhum caminhão cadastrado.</p>}
      {frota.map(v => <article className="stock-card" key={v.id}>
        <div className="training-head"><div><h3><Link href={`/frota/${v.id}`}>{v.nome}</Link></h3><small>{v.placa}{v.modelo ? ` · ${v.modelo}` : ""}{v.ano ? ` · ${v.ano}` : ""}</small></div>
          <span className={`status-badge ${v.ativo ? tomSituacao(v.situacao) : ""}`}>{v.ativo ? ROTULO_SITUACAO_FROTA_10A[v.situacao] : "Desativado"}</span></div>
        <ul>
          <li><span>Km atual</span><span>{v.km_atual.toLocaleString("pt-BR")} km</span></li>
          {v.situacao === "em_uso" && <li className="warn"><span>Com {v.motorista ?? "—"}{v.acompanhantes ? ` (com ${v.acompanhantes})` : ""}<small>Foi para {v.destino}{v.saida_em ? ` · saiu ${hora(v.saida_em)}` : ""}</small></span><span>na rua</span></li>}
          <li className={v.checklist_hoje ? tomChecklist(v.checklist_hoje) : "warn"}><span>Checklist de hoje{v.checklist_hoje_por ? <small>por {v.checklist_hoje_por}{v.checklist_hoje_em ? ` · ${hora(v.checklist_hoje_em)}` : ""}</small> : null}</span>
            <span>{v.checklist_hoje ? ROTULO_RESULTADO_10A[v.checklist_hoje] : "não feito"}</span></li>
          {v.manutencoes_abertas > 0 && <li className="bad"><span>Manutenção em aberto</span><span>{v.manutencoes_abertas}</span></li>}
          {v.docs_vencidos > 0 && <li className="bad"><span>Documento vencido</span><span>{v.docs_vencidos}</span></li>}
          {v.docs_breve > 0 && <li className="warn"><span>Documento vence em 30 dias</span><span>{v.docs_breve}</span></li>}
          {v.planos_vencidos > 0 && <li className="bad"><span>Manutenção preventiva vencida</span><span>{v.planos_vencidos}</span></li>}
          {v.planos_breve > 0 && <li className="warn"><span>Preventiva chegando</span><span>{v.planos_breve}</span></li>}
        </ul>
        <div className="training-actions"><Link className="button secondary" href={`/frota/${v.id}`}>Abrir ficha</Link></div>
      </article>)}
    </section>
    {podeCadastrar && <section className="panel" id="novo-caminhao" style={{ marginTop: 20 }}><header className="panel-header"><div><h2>Cadastrar caminhão</h2><p>Só administrador e engenheiro cadastram. Depois, coloque os vencimentos e os planos de manutenção na ficha.</p></div></header>
      <div className="panel-body"><OperationForm action={salvarCaminhao10a} label="Cadastrar" pendingLabel="Salvando…">
        <label>Nome (ex.: Munck 06)<input name="nome" required minLength={2} maxLength={60}/></label>
        <label>Placa<input name="placa" required maxLength={8} placeholder="ABC1D23"/></label>
        <label>Modelo (opcional)<input name="modelo" maxLength={60}/></label>
        <label>Ano (opcional)<input name="ano" type="number" min={1980} max={2100}/></label>
        <label>Km atual do painel<input name="km" type="number" min={0} max={3000000} required/></label>
      </OperationForm></div></section>}
  </>;
}
