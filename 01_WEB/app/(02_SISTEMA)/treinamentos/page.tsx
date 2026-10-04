import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { nomeProfissao } from "@/03_FUNCOES_E_LOGICA/Cadastros/profissao";
import { dataBr5a, prazo5a, rotuloSituacao5a, type FichaGestao5a } from "@/03_FUNCOES_E_LOGICA/Treinamentos/contrato-5a";
import { lerCatalogoTreinamentos5a, lerVisaoTreinamentos5a } from "@/05_ACESSO_A_DADOS/Supabase/treinamentos-5a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { cancelarTreinamento5a, registrarTreinamento5a } from "@/app/actions/treinamentos-5a";

// Marco 5A — Treinamentos (NR) e ASO com vencimento.
const filtros = [["vencido", "Vencidos"], ["breve", "Vencem em 30 dias"], ["faltando", "Faltando"], ["emdia", "Em dia"], ["todos", "Todos"]] as const;
const doFiltro: Record<string, FichaGestao5a["situacao"] | null> = { vencido: "VENCIDO", breve: "VENCE_EM_BREVE", faltando: "FALTANDO", emdia: "EM_DIA", todos: null };
const tom = (situacao: string) => situacao === "VENCIDO" || situacao === "FALTANDO" || situacao === "NAO_INFORMADO" ? "bad"
  : situacao === "VENCE_EM_BREVE" ? "warn" : "good";

export default async function TreinamentosPage({ searchParams }: { searchParams: Promise<{ filtro?: string; funcionario?: string; q?: string; ok?: string; cancelado?: string }> }) {
  const profile = await requireCapability("epi:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const [fichas, catalogo] = await Promise.all([lerVisaoTreinamentos5a(), lerCatalogoTreinamentos5a()]);
  const pessoa = z.uuid().safeParse(query.funcionario).success ? fichas.find(ficha => ficha.employee_id === query.funcionario) : undefined;
  const contagem = (situacao: FichaGestao5a["situacao"]) => fichas.filter(ficha => ficha.situacao === situacao).length;
  const filtro = query.filtro && query.filtro in doFiltro ? query.filtro : (contagem("VENCIDO") ? "vencido" : "todos");
  const termo = (query.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const lista = pessoa ? [pessoa] : fichas.filter(ficha => (!doFiltro[filtro] || ficha.situacao === doFiltro[filtro])
    && (!termo || ficha.name.toLocaleLowerCase("pt-BR").includes(termo)));
  const tipos = catalogo.types.filter(tipo => tipo.active);
  return <>
    <PageHeader eyebrow="PESSOAS E SEGURANÇA" title="Treinamentos e ASO" description="Quem está em dia para trabalhar: ASO e treinamentos de NR com data de vencimento."
      actions={<>{<a className="button primary" href="#registrar">Registrar treinamento</a>}{can(profile, "admin:manage") && <Link className="button secondary" href="/treinamentos/tipos">Tipos e exigências</Link>}</>}/>
    <SubNav profile={profile} grupo="pessoas"/>
    {query.ok && <div className="alert success" role="status">Treinamento registrado. O funcionário já vê no app.</div>}
    {query.cancelado && <div className="alert success" role="status">Registro cancelado. O histórico continua guardado.</div>}
    <p className="alert" role="note">Funcionário com ASO vencido ou treinamento obrigatório vencido ou faltando <strong>não deve fazer a atividade</strong> até regularizar (NR-07 e NRs da atividade). Os prazos de reciclagem vêm de “Tipos e exigências”; confira com o SESMT.</p>
    {!pessoa && <section className="panel consumo-filtros"><div className="panel-body">
      <nav className="chip-row" aria-label="Situação">{filtros.map(([id, label]) =>
        <Link key={id} className={filtro === id ? "chip active" : "chip"} aria-current={filtro === id ? "true" : undefined}
          href={`/treinamentos?filtro=${id}${termo ? `&q=${encodeURIComponent(termo)}` : ""}`}>{label} ({id === "todos" ? fichas.length : contagem(doFiltro[id]!)})</Link>)}</nav>
      <form method="get" className="filter-row" style={{ marginTop: 12 }}><input type="hidden" name="filtro" value={filtro}/>
        <label>Procurar funcionário<input type="search" name="q" defaultValue={query.q ?? ""} placeholder="Nome"/></label>
        <button className="button secondary" type="submit">Procurar</button></form>
    </div></section>}
    {pessoa && <p><Link className="button ghost" href="/treinamentos">← Ver todos</Link></p>}
    <section className="stock-cards" aria-label="Funcionários">
      {lista.length === 0 && <p className="muted">Ninguém nesta situação.</p>}
      {lista.map(ficha => <article className="stock-card training-card" key={ficha.employee_id}>
        <div className="training-head"><div><h3>{ficha.name}</h3><small>{nomeProfissao(ficha.profession)} · {ficha.team_name ?? "Sem equipe"}</small></div>
          <span className={`status-badge ${tom(ficha.situacao)}`}>{rotuloSituacao5a[ficha.situacao]}</span></div>
        <ul>
          <li className={tom(ficha.aso.situacao)}><span>ASO{ficha.aso.aso_expiry_date ? ` · ${prazo5a(ficha.aso.aso_expiry_date)}` : ""}</span>
            <span>{ficha.aso.aso_expiry_date ? dataBr5a(ficha.aso.aso_expiry_date) : "não informado"}</span></li>
          {ficha.trainings.map(item => <li key={item.id} className={tom(item.situacao)}>
            <span>{item.nr ? `${item.nr} · ` : ""}{item.name}{item.required ? "" : " (extra)"}<small>{prazo5a(item.expires_on)} · feito em {dataBr5a(item.completed_on)}</small></span>
            <span>{item.expires_on ? dataBr5a(item.expires_on) : "—"}</span></li>)}
          {ficha.missing.map(item => <li key={item.type_code} className="bad"><span>{item.nr ? `${item.nr} · ` : ""}{item.name}<small>obrigatório para a função</small></span><span>falta</span></li>)}
        </ul>
        <div className="training-actions">
          <Link className="button secondary" href={`/treinamentos?funcionario=${ficha.employee_id}#registrar`}>Registrar treinamento</Link>
          {!pessoa && <Link className="button ghost" href={`/treinamentos?funcionario=${ficha.employee_id}`}>Detalhes</Link>}
          <Link className="button ghost" href={`/funcionarios/${ficha.employee_id}`}>Ficha do funcionário</Link>
        </div>
        {pessoa && ficha.trainings.length > 0 && <details className="mais-filtros"><summary>Cancelar um registro feito por engano</summary>
          {ficha.trainings.map(item => <OperationForm key={item.id} action={cancelarTreinamento5a} label={`Cancelar ${item.nr ?? item.name}`} pendingLabel="Cancelando…">
            <input type="hidden" name="trainingId" value={item.id}/>
            <label className="full">Motivo ({item.name}, feito em {dataBr5a(item.completed_on)})<input name="reason" minLength={3} maxLength={240} required/></label>
          </OperationForm>)}</details>}
      </article>)}
    </section>
    <section className="panel" id="registrar" style={{ marginTop: 20 }}><header className="panel-header"><div><h2>Registrar treinamento</h2>
      <p>Se a validade ficar em branco, o Metallo calcula pelo prazo do tipo. Um registro novo do mesmo tipo substitui o anterior (o anterior fica no histórico).</p></div></header>
      <div className="panel-body">
        <OperationForm action={registrarTreinamento5a} label="Registrar" pendingLabel="Registrando…">
          <input type="hidden" name="idempotencyKey" value={randomUUID()}/>
          {pessoa && <input type="hidden" name="voltar" value="funcionario"/>}
          <label>Funcionário<select name="employeeId" required defaultValue={pessoa?.employee_id ?? ""}><option value="" disabled>Selecione</option>
            {fichas.map(ficha => <option key={ficha.employee_id} value={ficha.employee_id}>{ficha.name}</option>)}</select></label>
          <label>Treinamento<select name="typeCode" required defaultValue={pessoa?.missing[0]?.type_code ?? ""}><option value="" disabled>Selecione</option>
            {tipos.map(tipo => <option key={tipo.code} value={tipo.code}>{tipo.nr ? `${tipo.nr} · ` : ""}{tipo.name}{tipo.validity_months ? ` (vale ${tipo.validity_months} meses)` : " (sem vencimento)"}</option>)}</select></label>
          <label>Data do treinamento<input name="completedOn" type="date" lang="pt-BR" required/></label>
          <label>Validade (opcional)<input name="expiresOn" type="date" lang="pt-BR"/></label>
          <label>Instituição ou instrutor (opcional)<input name="provider" maxLength={120}/></label>
          <label>Carga horária em horas (opcional)<input name="workloadHours" type="number" min={0.5} max={400} step={0.5}/></label>
          <label className="full">Observação (opcional)<input name="note" maxLength={240}/></label>
        </OperationForm>
      </div></section>
  </>;
}
