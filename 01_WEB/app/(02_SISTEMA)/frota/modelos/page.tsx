import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { EditorModeloFrota } from "@/02_COMPONENTES_VISUAIS/Frota/editor-modelo";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { categoriaModelo10g, ETAPAS_MODELO_10G } from "@/03_FUNCOES_E_LOGICA/Frota/modelos-10g";
import { lerModelosFrota10g, requireFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { salvarModeloFrota10g } from "@/app/actions/frota-10a";

export default async function ModelosFrotaPage({ searchParams }: { searchParams: Promise<{ categoria?: string; revisao?: string; nova?: string }> }) {
  const profile = await requireCapability("equipment:write");
  requireFrota10a();
  const query = await searchParams;
  const codigo = categoriaModelo10g.safeParse(query.categoria ?? "munck");
  if (!codigo.success || (query.revisao && !/^[1-9]\d{0,8}$/.test(query.revisao))) notFound();
  const data = await lerModelosFrota10g(codigo.data, query.revisao ? Number(query.revisao) : undefined);
  const edita = profile.role === "admin" || profile.role === "engineer";
  const nova = query.nova === "1" && edita;
  const m = data.modelo;
  return <>
    <PageHeader eyebrow="FROTA · CONFIGURAÇÃO" title="Modelos por categoria" description="Prepare as perguntas de cada tipo de veículo e acompanhe as revisões técnicas."/>
    <SubNav profile={profile} grupo="frota"/>
    <p className="alert" role="note"><strong>Rascunhos — aguardam validação do engenheiro.</strong> Nenhum destes modelos está ativo no portal. Salvar conserva a revisão anterior e não altera inspeções, veículos ou autorizações de condutores.</p>
    <nav className="filter-row" aria-label="Categorias de veículos">{data.categorias.map(c => <Link key={c.codigo} href={`/frota/modelos?categoria=${c.codigo}`} className="button secondary" aria-current={!nova && c.codigo === m.categoria ? "page" : undefined}>{c.nome}</Link>)}{edita && <Link className="button secondary" href="/frota/modelos?nova=1">Nova categoria</Link>}</nav>
    {nova ? <section className="panel"><header className="panel-header"><h2>Nova categoria em rascunho</h2></header><div className="panel-body"><EditorModeloFrota categoria="" nome="" revisao={0} actorId={profile.id} keyId={randomUUID()} action={salvarModeloFrota10g} itens={[{ codigo: 1, nome: "", etapa: "Segurança", critico: true, permite_na: false, exige_foto: false }]}/></div></section> : <>
      <section className="panel"><header className="panel-header"><div><h2>{m.nome} · revisão {m.revisao}</h2><p>{m.autor} · {new Date(m.em).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p></div></header><div className="panel-body">
        <p>{m.motivo}</p><p className="muted">Bloqueio, “Não se aplica” e foto obrigatória são propostas a revisar. Uma resposta no checklist não substitui CNH, capacitação ou autorização para dirigir.</p>
        {edita && m.revisao === data.atual ? <EditorModeloFrota key={`${m.categoria}:${m.revisao}`} categoria={m.categoria} nome={m.nome} revisao={m.revisao} itens={m.itens} actorId={profile.id} keyId={randomUUID()} action={salvarModeloFrota10g}/> : <>
          {m.revisao !== data.atual && <p className="alert">Revisão histórica, somente leitura. <Link href={`/frota/modelos?categoria=${m.categoria}`}>Abrir revisão atual</Link></p>}
          {ETAPAS_MODELO_10G.filter(etapa => m.itens.some(i => i.etapa === etapa)).map(etapa => <section key={etapa}><h3>{etapa}</h3><ul>{m.itens.filter(i => i.etapa === etapa).map(i => <li key={i.codigo}>{i.nome} · {i.critico ? "bloqueio proposto" : "sem bloqueio proposto"}{i.permite_na ? " · aceita Não se aplica" : " · exige resposta"}{i.exige_foto ? " · foto obrigatória se não conforme" : ""}</li>)}</ul></section>)}
        </>}
      </div></section>
      <section className="panel"><header className="panel-header"><h2>Histórico de revisões</h2></header><div className="panel-body"><ul className="frota-atencao">{data.historico.map(h => <li key={h.revisao}><Link href={`/frota/modelos?categoria=${m.categoria}&revisao=${h.revisao}`}>Revisão {h.revisao}</Link><span>{h.motivo}</span></li>)}</ul></div></section>
    </>}
  </>;
}
