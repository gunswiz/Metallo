import Link from "next/link";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { lerAprovacoesModelo10i,lerAtivacaoModelo10j } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { aprovarModeloFrota10i,ativarModeloFrota10j } from "@/app/actions/frota-10a";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { EditorModeloFrota } from "@/02_COMPONENTES_VISUAIS/Frota/editor-modelo";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { categoriaModelo10g, ETAPAS_MODELO_10G } from "@/03_FUNCOES_E_LOGICA/Frota/modelos-10g";
import { lerModelosFrota10g, requireFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { salvarModeloFrota10g } from "@/app/actions/frota-10a";

export default async function ModelosFrotaPage({ searchParams }: { searchParams: Promise<{ categoria?: string; revisao?: string; nova?: string; conferir?:string }> }) {
  const profile = await requireCapability("equipment:write");
  requireFrota10a();
  const query = await searchParams;
  const codigo = categoriaModelo10g.safeParse(query.categoria ?? "munck");
  if (!codigo.success || (query.revisao && !/^[1-9]\d{0,8}$/.test(query.revisao))) notFound();
  const data = await lerModelosFrota10g(codigo.data, query.revisao ? Number(query.revisao) : undefined);
  const edita = profile.role === "admin" || profile.role === "engineer";
  const nova = query.nova === "1" && edita;
  const m = data.modelo;
  const aprovacoes=await lerAprovacoesModelo10i(m.categoria);
  const aprovada=aprovacoes.find(a=>a.revisao===m.revisao);
  const ativacao=await lerAtivacaoModelo10j(m.categoria);
  const conferir=query.conferir==="1";
  return <>
    <PageHeader eyebrow="FROTA · CONFIGURAÇÃO" title="Modelos por categoria" description="Prepare as perguntas de cada tipo de veículo e acompanhe as revisões técnicas."/>
    <SubNav profile={profile} grupo="frota"/>
    <p className="alert" role="note"><strong>Preparação, revisão técnica e ativação.</strong> Salvar ou aprovar não ativa o modelo. A ativação é uma ação separada do engenheiro e exige nova inspeção na versão atual antes da próxima saída. O histórico anterior é preservado.</p>
    <nav className="filter-row" aria-label="Categorias de veículos">{data.categorias.map(c => <Link key={c.codigo} href={`/frota/modelos?categoria=${c.codigo}`} className="button secondary" aria-current={!nova && c.codigo === m.categoria ? "page" : undefined}>{c.nome}</Link>)}{edita && <Link className="button secondary" href="/frota/modelos?nova=1">Nova categoria</Link>}</nav>
    {nova ? <section className="panel"><header className="panel-header"><h2>Nova categoria em rascunho</h2></header><div className="panel-body"><EditorModeloFrota categoria="" nome="" revisao={0} actorId={profile.id} keyId={randomUUID()} action={salvarModeloFrota10g} itens={[{ codigo: 1, nome: "", etapa: "Segurança", critico: true, permite_na: false, exige_foto: false }]}/></div></section> : <>
      <section className="panel"><header className="panel-header"><div><h2>{m.nome} · revisão {m.revisao}</h2><p>{m.autor} · {new Date(m.em).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p></div></header><div className="panel-body">
        <p>{m.motivo}</p><p className="muted">Bloqueio, “Não se aplica” e foto obrigatória são propostas a revisar. Uma resposta no checklist não substitui CNH, capacitação ou autorização para dirigir.</p>
        <p role="status"><strong>{ativacao.atual?.revisao===m.revisao ? "Ativa no portal para esta categoria" : aprovada ? (aprovacoes[0].revisao===m.revisao ? "Aprovada tecnicamente — ainda não ativa no portal" : "Aprovação substituída por revisão posterior") : "Rascunho — sem aprovação técnica"}</strong></p>
        <p>{ativacao.veiculos} veículos ativos nesta categoria. {ativacao.atual ? `Modelo em uso: revisão ${ativacao.atual.revisao}, ativada por ${ativacao.atual.autor}.` : "Sem ativação: os veículos continuam no checklist anterior."}</p>
        {ativacao.atual && <p>{new Date(ativacao.atual.em).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})} · {ativacao.atual.motivo}</p>}
        {aprovada && <p>{aprovada.autor} · {new Date(aprovada.em).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}<br/>{aprovada.parecer}</p>}
        {!conferir && <p><Link className="button secondary" href={`/frota/modelos?categoria=${m.categoria}&revisao=${m.revisao}&conferir=1`}>Conferir revisão completa</Link></p>}
        {edita && m.revisao === data.atual && !conferir ? <EditorModeloFrota key={`${m.categoria}:${m.revisao}`} categoria={m.categoria} nome={m.nome} revisao={m.revisao} itens={m.itens} actorId={profile.id} keyId={randomUUID()} action={salvarModeloFrota10g}/> : <>
          {m.revisao !== data.atual && <p className="alert">Revisão histórica, somente leitura. <Link href={`/frota/modelos?categoria=${m.categoria}`}>Abrir revisão atual</Link></p>}
          {ETAPAS_MODELO_10G.filter(etapa => m.itens.some(i => i.etapa === etapa)).map(etapa => <section key={etapa}><h3>{etapa}</h3><ul>{m.itens.filter(i => i.etapa === etapa).map(i => <li key={i.codigo}>{i.nome} · {i.critico ? "bloqueio proposto" : "sem bloqueio proposto"}{i.permite_na ? " · aceita Não se aplica" : " · exige resposta"}{i.exige_foto ? " · foto obrigatória se não conforme" : ""}</li>)}</ul></section>)}
        </>}
        {conferir && !aprovada && m.revisao===data.atual && (profile.role==="engineer" ? <OperationForm action={aprovarModeloFrota10i} label="Registrar aprovação técnica" pendingLabel="Registrando aprovação…" explicitConfirmation refreshOnComplete>
          <input type="hidden" name="categoria" value={m.categoria}/><input type="hidden" name="revisao" value={m.revisao}/>
          <label className="full">Parecer técnico<textarea name="parecer" required minLength={10} maxLength={600} rows={3}/></label>
          <label className="full"><input name="ciente" type="checkbox" required/> Revisei as perguntas, a criticidade, a aplicabilidade e as exigências de foto desta revisão. Esta aprovação não ativa o modelo no portal.</label>
        </OperationForm> : <p>A aprovação técnica deve ser registrada por um perfil ativo de engenheiro.</p>)}
        {conferir && edita && m.revisao===data.atual && <p><Link href={`/frota/modelos?categoria=${m.categoria}`}>Preparar nova revisão</Link></p>}
        {conferir && aprovada && aprovacoes[0].revisao===m.revisao && ativacao.atual?.revisao!==m.revisao && profile.role==="engineer" && <OperationForm action={ativarModeloFrota10j} label="Ativar modelo para esta categoria" pendingLabel="Ativando…" explicitConfirmation refreshOnComplete>
          <input type="hidden" name="categoria" value={m.categoria}/><input type="hidden" name="revisao" value={m.revisao}/><input type="hidden" name="anterior" value={ativacao.atual?.id??0}/>
          <label className="full">Motivo da ativação<textarea name="motivo" required minLength={10} maxLength={600} rows={3}/></label>
          <label className="full"><input type="checkbox" name="ciente" required/> Confirmo a aplicação desta revisão aos veículos desta categoria. Antes da próxima saída será exigido checklist desta versão; ativar não libera bloqueios mecânicos.</label>
        </OperationForm>}
      </div></section>
      <section className="panel"><header className="panel-header"><h2>Histórico de revisões</h2></header><div className="panel-body"><ul className="frota-atencao">{data.historico.map(h => <li key={h.revisao}><Link href={`/frota/modelos?categoria=${m.categoria}&revisao=${h.revisao}`}>Revisão {h.revisao}</Link><span>{h.motivo}</span></li>)}</ul></div></section>
    </>}
  </>;
}
