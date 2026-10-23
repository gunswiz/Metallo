import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { ROTULO_DOCUMENTO_10A, ROTULO_RESULTADO_10A, ROTULO_SITUACAO_FROTA_10A, ROTULO_STATUS_MANUTENCAO_10A } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";
import { lerChecklistFrota10a, lerFichaFrota10a, lerFotosChegadaFrota10b, lerItensFrota10a, lerMesFrota10a, lerRelatosFrota10c } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { abrirManutencao10a, cancelarManutencao10a, concluirManutencao10a, concluirPlano10a, enviarOficina10a, liberarCaminhao10a, salvarCaminhao10a, salvarDocumento10a, salvarPlano10a } from "@/app/actions/frota-10a";

// Marco 10A — ficha do caminhão: tudo de um caminhão em uma tela.
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dia = (d: string) => d.split("-").reverse().join("/");
const brl = (n: number | null) => n === null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeFortaleza = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/Fortaleza" }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function FichaFrotaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; checklist?: string; mes?: string; aba?: string }> }) {
  const profile = await requireCapability("equipment:write");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const id = Number((await params).id), query = await searchParams;
  if (!Number.isInteger(id) || id <= 0) notFound();
  const ficha = await lerFichaFrota10a(id).catch(() => null);
  if (!ficha) notFound();
  const v = ficha.veiculo, podeCadastrar = can(profile, "epi:write");
  const agora = hojeFortaleza(), mesBase = /^\d{4}-\d{2}$/.test(query.mes ?? "") ? new Date(`${query.mes}-15T12:00:00`) : agora;
  const mesIni = iso(new Date(mesBase.getFullYear(), mesBase.getMonth(), 1)), diasNoMes = new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 0).getDate();
  const anterior = iso(new Date(mesBase.getFullYear(), mesBase.getMonth() - 1, 15)).slice(0, 7), proximo = iso(new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 15)).slice(0, 7);
  const checklistId = Number(query.checklist);
  const [grade, itens, fotosChegada, relatosLista, detalhe] = await Promise.all([lerMesFrota10a(id, mesIni), lerItensFrota10a(), lerFotosChegadaFrota10b(id), lerRelatosFrota10c(id).catch(() => []),
    Number.isInteger(checklistId) && checklistId > 0 ? lerChecklistFrota10a(checklistId).catch(() => null) : Promise.resolve(null)]);
  const fotoViagem = new Map(fotosChegada.map(f => [f.viagem_id, f.foto_id]));
  const celula = new Map(grade.map(g => [`${g.dia}|${g.codigo}`, g.situacao]));
  const diasComChecklist = new Set(grade.map(g => g.dia));
  const abertas = ficha.manutencoes.filter(m => m.status === "aberta" || m.status === "na_oficina");
  const tom = v.situacao === "disponivel" ? "good" : v.situacao === "em_uso" ? "warn" : "bad";
  const hoje = iso(agora);
  const relatosDe = (id: number) => relatosLista.find(r => r.manutencao_id === id)?.relatos ?? [];
  const abas = [{ id: "manutencao", nome: "Manutenção" }, { id: "documentos", nome: "Documentos" }, { id: "planos", nome: "Preventivas" }, { id: "viagens", nome: "Viagens" }, { id: "checklists", nome: "Checklists" }, { id: "historico", nome: "Histórico" }, ...(podeCadastrar ? [{ id: "dados", nome: "Cadastro" }] : [])];
  const aba = query.checklist || query.mes ? "checklists" : abas.some(a => a.id === query.aba) ? query.aba : "manutencao";

  return <>
    <PageHeader eyebrow="FROTA" title={`${v.nome} · ${v.placa}`} description={`${v.modelo ?? "Caminhão munck"}${v.ano ? ` · ${v.ano}` : ""} · ${v.km_atual.toLocaleString("pt-BR")} km`}
      actions={<Link className="button ghost" href="/frota">← Todos os caminhões</Link>}/>
    <SubNav profile={profile} grupo="frota"/>
    {query.ok && <div className="alert success" role="status">Salvo.</div>}
    <div className="fleet-detail-status"><span className={`status-badge ${v.ativo ? tom : ""}`}>{v.ativo ? ROTULO_SITUACAO_FROTA_10A[v.situacao] : "Desativado"}</span><span>{abertas.length} manutenções abertas</span><span>{ficha.documentos.length} documentos cadastrados</span></div>
    <nav className="fleet-tabs" aria-label="Assuntos do caminhão">{abas.map(a => <Link key={a.id} href={`/frota/${v.id}?aba=${a.id}`} aria-current={aba === a.id ? "page" : undefined}>{a.nome}</Link>)}</nav>

    {v.situacao === "nao_liberado" && <section className="panel"><header className="panel-header"><div><h2>Caminhão não liberado</h2>
      <p>O motorista não consegue registrar a saída. Abra ou conclua o conserto na aba Manutenção{podeCadastrar ? " ou libere hoje, com um motivo, se o engenheiro decidir que pode sair." : ". Só administrador e engenheiro liberam."}</p></div></header>
      {podeCadastrar && <div className="panel-body"><OperationForm action={liberarCaminhao10a} label="Liberar para hoje" pendingLabel="Liberando…">
        <input type="hidden" name="veiculoId" value={v.id}/><label className="full">Motivo da liberação<input name="motivo" required minLength={5} maxLength={300} placeholder="Ex.: pneu conferido pelo engenheiro, está bom"/></label>
      </OperationForm></div>}</section>}

    {aba === "manutencao" && <section className="panel" id="manutencao"><header className="panel-header"><div><h2>Manutenção</h2><p>Defeito → oficina → concluído, com o custo.</p></div></header><div className="panel-body">
      {abertas.length === 0 && <p className="muted">Nenhuma manutenção em aberto.</p>}
      {abertas.map(m => <article className="stock-card" key={m.id}>
        <div className="training-head"><div><h3>{m.tipo === "preventiva" ? "Preventiva" : "Corretiva"}: {m.descricao}</h3><small>Aberta em {fmt(m.aberta_em)} · {ROTULO_STATUS_MANUTENCAO_10A[m.status]}{m.bloqueia ? " · bloqueia o caminhão" : ""}{m.oficina ? ` · ${m.oficina}` : ""}{m.previsao ? ` · previsão ${dia(m.previsao)}` : ""}</small></div></div>
        {relatosDe(m.id).map((r, i) => <div className="muted" key={i} style={{ marginTop: 8 }}>
          <strong>{r.tipo === "chegada" ? "Relato na chegada" : "Relato no checklist"}</strong> · {fmt(r.quando)}{r.por ? ` · ${r.por}` : ""}
          {r.problema && <p>{r.problema}{r.foto && <> · <a href={`/frota/foto/${r.foto}`} target="_blank" rel="noreferrer">Ver foto</a></>}</p>}
          {r.itens?.map((it, j) => <p key={j}>{it.item}{it.critico ? " (crítico)" : ""}{it.obs ? `: ${it.obs}` : ""}{it.foto && <> · <a href={`/frota/foto/${it.foto}`} target="_blank" rel="noreferrer">Ver foto</a></>}</p>)}
        </div>)}
        {m.status === "aberta" && <details className="mais-filtros"><summary>Enviar à oficina</summary><OperationForm action={enviarOficina10a} label="Enviar à oficina" pendingLabel="Salvando…">
          <input type="hidden" name="veiculoId" value={v.id}/><input type="hidden" name="manutencaoId" value={m.id}/>
          <label>Oficina<input name="oficina" required minLength={2} maxLength={80}/></label><label>Previsão de volta (opcional)<input name="previsao" type="date" lang="pt-BR"/></label>
        </OperationForm></details>}
        <details className="mais-filtros"><summary>Concluir manutenção</summary><OperationForm action={concluirManutencao10a} label="Concluir" pendingLabel="Salvando…">
          <input type="hidden" name="veiculoId" value={v.id}/><input type="hidden" name="manutencaoId" value={m.id}/>
          <label>Custo em R$ (opcional)<input name="custo" inputMode="decimal" maxLength={12} placeholder="350,00"/></label><label>Km na hora (opcional)<input name="km" type="number" min={0} max={3000000}/></label>
          <label className="full">O que foi feito (opcional)<input name="obs" maxLength={300}/></label>
        </OperationForm></details>
        <details className="mais-filtros"><summary>Cancelar esta manutenção</summary><OperationForm action={cancelarManutencao10a} label="Cancelar manutenção" pendingLabel="Salvando…">
          <input type="hidden" name="veiculoId" value={v.id}/><input type="hidden" name="manutencaoId" value={m.id}/><label className="full">Motivo<input name="motivo" required minLength={3} maxLength={300}/></label></OperationForm></details>
      </article>)}
      <details className="mais-filtros"><summary>Abrir uma manutenção nova</summary><OperationForm action={abrirManutencao10a} label="Abrir manutenção" pendingLabel="Salvando…">
        <input type="hidden" name="veiculoId" value={v.id}/>
        <label>Tipo<select name="tipo" defaultValue="corretiva"><option value="corretiva">Corretiva (defeito)</option><option value="preventiva">Preventiva (revisão)</option></select></label>
        <label className="full">O que precisa fazer<input name="descricao" required minLength={3} maxLength={300}/></label>
        <label><input type="checkbox" name="bloquear"/> Deixar o caminhão não liberado até resolver</label>
      </OperationForm></details>
      <details className="mais-filtros"><summary>Manutenções encerradas</summary>
      {ficha.manutencoes.filter(m => m.status === "concluida" || m.status === "cancelada").length === 0 ? <p className="muted">Ainda não há manutenção concluída.</p> :
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Quando</th><th>O que</th><th>Situação</th><th>Oficina</th><th>Km</th><th>Custo</th></tr></thead>
          <tbody>{ficha.manutencoes.filter(m => m.status === "concluida" || m.status === "cancelada").map(m => <tr key={m.id}><td data-label="Quando">{m.concluida_em ? fmt(m.concluida_em) : fmt(m.aberta_em)}</td>
            <td data-label="Serviço">{m.tipo === "preventiva" ? "Preventiva" : "Corretiva"}: {m.descricao}{m.obs ? <small> — {m.obs}</small> : null}</td><td data-label="Situação">{ROTULO_STATUS_MANUTENCAO_10A[m.status]}</td><td data-label="Oficina">{m.oficina ?? "—"}</td>
            <td data-label="Km">{m.km?.toLocaleString("pt-BR") ?? "—"}</td><td data-label="Custo">{brl(m.custo)}</td></tr>)}</tbody></table></div>}
      </details><p>Custo total registrado: <strong>{brl(ficha.manutencoes.filter(m => m.status === "concluida").reduce((s, m) => s + (m.custo ?? 0), 0))}</strong></p>
    </div></section>}

    {aba === "documentos" && <section className="panel" id="documentos"><header className="panel-header"><div><h2>Documentos e vencimentos</h2><p>CRLV, seguro e inspeção do guindaste. O Metallo avisa 30 dias antes.</p></div></header><div className="panel-body">
      <ul className="frota-atencao">{ficha.documentos.length === 0 ? <li className="muted">Nenhum documento cadastrado.</li> : ficha.documentos.map(d => {
        const dias = Math.round((new Date(`${d.vencimento}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000);
        return <li key={d.id} className={dias < 0 ? "bad" : dias <= 30 ? "warn" : "good"}><strong>{d.tipo === "outro" ? d.descricao : ROTULO_DOCUMENTO_10A[d.tipo]}</strong>
          <span>{dia(d.vencimento)} · {dias < 0 ? `vencido há ${-dias} dia(s)` : dias === 0 ? "vence hoje" : `faltam ${dias} dia(s)`}{d.numero ? ` · nº ${d.numero}` : ""}</span></li>; })}</ul>
      {podeCadastrar && <details className="mais-filtros"><summary>Atualizar ou incluir documento</summary><OperationForm action={salvarDocumento10a} label="Salvar documento" pendingLabel="Salvando…">
        <input type="hidden" name="veiculoId" value={v.id}/>
        <label>Documento<select name="tipo" defaultValue="crlv"><option value="crlv">CRLV</option><option value="seguro">Seguro</option><option value="inspecao_guindaste">Inspeção do guindaste</option><option value="outro">Outro</option></select></label>
        <label>Nome (só para “Outro”)<input name="descricao" maxLength={60}/></label><label>Número (opcional)<input name="numero" maxLength={60}/></label>
        <label>Vence em<input name="vencimento" type="date" lang="pt-BR" required/></label>
      </OperationForm></details>}
    </div></section>}

    {aba === "planos" && <section className="panel" id="planos"><header className="panel-header"><div><h2>Manutenção preventiva</h2><p>O que cada caminhão precisa e quando. Por km, por dias ou os dois.</p></div></header><div className="panel-body">
      <ul className="frota-atencao">{ficha.planos.length === 0 ? <li className="muted">Nenhum plano cadastrado.</li> : ficha.planos.map(p => <li key={p.id} className={!p.ativo ? "" : p.situacao === "vencido" ? "bad" : p.situacao === "breve" ? "warn" : "good"}>
        <strong>{p.descricao}{p.ativo ? "" : " (desligado)"}</strong>
        <span>{p.cada_km ? `a cada ${p.cada_km.toLocaleString("pt-BR")} km (última com ${p.ultimo_km?.toLocaleString("pt-BR")} km)` : ""}{p.cada_km && p.cada_dias ? " · " : ""}{p.cada_dias ? `a cada ${p.cada_dias} dias (última em ${p.ultima_data ? dia(p.ultima_data) : "—"})` : ""} · {p.situacao === "vencido" ? "VENCIDA" : p.situacao === "breve" ? "chegando" : "em dia"}</span>
        {p.ativo && <details className="mais-filtros"><summary>Marcar como feita</summary><OperationForm action={concluirPlano10a} label="Registrar" pendingLabel="Salvando…">
          <input type="hidden" name="veiculoId" value={v.id}/><input type="hidden" name="planoId" value={p.id}/>
          <label>Km na hora{p.cada_km ? "" : " (opcional)"}<input name="km" type="number" min={0} max={3000000} required={Boolean(p.cada_km)} defaultValue={v.km_atual}/></label>
          <label>Data (vazio = hoje)<input name="data" type="date" lang="pt-BR" max={hoje}/></label><label>Custo em R$ (opcional)<input name="custo" inputMode="decimal" maxLength={12}/></label>
          <label className="full">Observação (opcional)<input name="obs" maxLength={300}/></label></OperationForm></details>}
      </li>)}</ul>
      <details className="mais-filtros"><summary>Novo plano</summary><OperationForm action={salvarPlano10a} label="Salvar plano" pendingLabel="Salvando…">
        <input type="hidden" name="veiculoId" value={v.id}/><input type="hidden" name="ativo" value="on"/>
        <label className="full">O que fazer (ex.: troca de óleo)<input name="descricao" required minLength={2} maxLength={80}/></label>
        <label>A cada quantos km (opcional)<input name="cadaKm" type="number" min={1} max={1000000}/></label><label>Km da última vez<input name="ultimoKm" type="number" min={0} max={3000000} defaultValue={v.km_atual}/></label>
        <label>A cada quantos dias (opcional)<input name="cadaDias" type="number" min={1} max={3650}/></label><label>Data da última vez<input name="ultimaData" type="date" lang="pt-BR" max={hoje}/></label>
      </OperationForm></details>
    </div></section>}

    {aba === "viagens" && <section className="panel" id="viagens"><header className="panel-header"><div><h2>Saídas e chegadas</h2><p>Quem levou, para onde, com quem e o km. Sem localização por GPS.</p></div></header><div className="panel-body">
      {ficha.viagens.length === 0 ? <p className="muted">Nenhuma saída registrada.</p> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Motorista</th><th>Destino</th><th>Com quem</th><th>Saída</th><th>Chegada</th><th>Km rodados</th><th>Foto do problema</th></tr></thead>
        <tbody>{ficha.viagens.map(t => <tr key={t.id}><td data-label="Motorista">{t.motorista}</td><td data-label="Destino">{t.destino}</td><td data-label="Com quem">{t.acompanhantes ?? "—"}</td><td data-label="Saída">{fmt(t.saida_em)}<small> · {t.km_saida.toLocaleString("pt-BR")} km</small></td>
          <td data-label="Chegada">{t.chegada_em ? fmt(t.chegada_em) : <strong>na rua</strong>}{t.km_chegada !== null ? <small> · {t.km_chegada.toLocaleString("pt-BR")} km</small> : null}</td><td data-label="Km rodados">{t.km_chegada !== null ? (t.km_chegada - t.km_saida).toLocaleString("pt-BR") : "—"}</td>
          <td data-label="Foto do problema">{fotoViagem.get(t.id) ? <a href={`/frota/foto/${fotoViagem.get(t.id)}`} target="_blank" rel="noreferrer">Ver foto</a> : "—"}</td></tr>)}</tbody></table></div>}
    </div></section>}

    {aba === "checklists" && <section className="panel" id="checklists"><header className="panel-header"><div><h2>Checklists</h2><p>Abra uma conferência para ver os itens e as fotos.</p></div></header><div className="panel-body">
      {ficha.checklists.length === 0 ? <p className="muted">Nenhum checklist ainda.</p> : <ul className="frota-atencao">{ficha.checklists.map(c => <li key={c.id} className={c.resultado === "liberado" ? "good" : c.resultado === "ressalvas" ? "warn" : "bad"}>
        <Link href={`/frota/${v.id}?checklist=${c.id}#detalhe-checklist`}><strong>{dia(c.dia)} · {ROTULO_RESULTADO_10A[c.resultado]}</strong></Link><span>{c.por}{c.local ? ` · ${c.local}` : ""}{c.itens_nao_conformes ? ` · ${c.itens_nao_conformes} item(ns) com problema` : ""}</span></li>)}</ul>}
      {detalhe && <div id="detalhe-checklist"><h3>Checklist de {dia(detalhe.checklist.dia)} · {detalhe.checklist.por}</h3>
        <p>{ROTULO_RESULTADO_10A[detalhe.checklist.resultado]}{detalhe.checklist.local ? ` · ${detalhe.checklist.local}` : ""}{detalhe.checklist.observacoes ? ` · ${detalhe.checklist.observacoes}` : ""}</p>
        <ul className="frota-atencao">{detalhe.itens.map(i => <li key={i.codigo} className={i.situacao === "N" ? "bad" : ""}><strong>{i.codigo}. {i.nome}{i.critico ? " (crítico)" : ""}</strong><span>{i.situacao === "C" ? "Conforme" : i.situacao === "N" ? `Não conforme${i.obs ? ` — ${i.obs}` : ""}` : "Não se aplica"}{i.foto ? <> · <a href={`/frota/foto/${i.foto}`} target="_blank" rel="noreferrer">Ver foto</a></> : null}</span></li>)}</ul></div>}
    </div></section>}

    {aba === "checklists" && <details className="panel fleet-disclosure" id="grade" open={Boolean(query.mes)}><summary>Grade mensal do checklist<span>Ver planilha</span></summary><div className="panel-body">
      <p className="frota-mes"><Link className="button ghost" href={`/frota/${v.id}?mes=${anterior}#grade`}>← Mês anterior</Link> <strong>{String(mesBase.getMonth() + 1).padStart(2, "0")}/{mesBase.getFullYear()}</strong> <Link className="button ghost" href={`/frota/${v.id}?mes=${proximo}#grade`}>Próximo mês →</Link></p>
      <div className="data-table-wrap frota-grade-wrap" tabIndex={0} role="region" aria-label="Checklist por dia do mês; deslize para ver os demais dias"><table className="data-table frota-grade"><thead><tr><th>Item</th>{Array.from({ length: diasNoMes }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
        <tbody>{itens.filter(i => i.ativo || grade.some(g => g.codigo === i.codigo)).map(i => <tr key={i.codigo}><th scope="row">{i.codigo}. {i.nome}{i.critico ? " *" : ""}</th>
          {Array.from({ length: diasNoMes }, (_, d) => { const chave = `${mesIni.slice(0, 8)}${String(d + 1).padStart(2, "0")}`, s = celula.get(`${chave}|${i.codigo}`);
            return <td key={d} className={s === "N" ? "bad" : s === "C" ? "good" : ""}>{s ?? ""}</td>; })}</tr>)}
          <tr><th scope="row">Feito</th>{Array.from({ length: diasNoMes }, (_, d) => <td key={d}>{diasComChecklist.has(`${mesIni.slice(0, 8)}${String(d + 1).padStart(2, "0")}`) ? "✓" : ""}</td>)}</tr></tbody></table></div>
      <p className="muted">C = conforme · N = não conforme · NA = não se aplica. * item crítico.</p>
    </div></details>}

    {podeCadastrar && aba === "dados" && <section className="panel" id="dados"><header className="panel-header"><div><h2>Dados do caminhão</h2><p>Corrija o km se o painel mostrar outro valor. Desativar tira da lista do app.</p></div></header><div className="panel-body">
      <OperationForm action={salvarCaminhao10a} label="Salvar dados" pendingLabel="Salvando…">
        <input type="hidden" name="id" value={v.id}/>
        <label>Nome<input name="nome" defaultValue={v.nome} required minLength={2} maxLength={60}/></label><label>Placa<input name="placa" defaultValue={v.placa} required maxLength={8}/></label>
        <label>Modelo<input name="modelo" defaultValue={v.modelo ?? ""} maxLength={60}/></label><label>Ano<input name="ano" type="number" min={1980} max={2100} defaultValue={v.ano ?? ""}/></label>
        <label>Km atual<input name="km" type="number" min={0} max={3000000} defaultValue={v.km_atual} required/></label>
        <label><input type="checkbox" name="ativo" defaultChecked={v.ativo}/> Caminhão ativo</label>
      </OperationForm></div></section>}

    {aba === "historico" && <section className="panel" id="historico"><header className="panel-header"><div><h2>Histórico</h2></div></header><div className="panel-body">
      <ul className="frota-atencao">{ficha.eventos.map((e, i) => <li key={i}><strong>{fmt(e.em)}</strong><span>{e.texto}{e.pessoa ? ` (${e.pessoa})` : ""}</span></li>)}</ul></div></section>}
  </>;
}
