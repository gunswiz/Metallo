import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { MENSAGENS_PRECOS_3Q, mostrarPrecoBR } from "@/03_FUNCOES_E_LOGICA/Precos/precos-3q";
import { consumptionUnitLabel, consumptionUnit } from "@/03_FUNCOES_E_LOGICA/unidadesConsumo";
import { lerMateriaisParaPreco3q, lerPrecos3q, precosLiberados3q } from "@/05_ACESSO_A_DADOS/Supabase/precos-3q";
import { salvarPrecos } from "@/app/actions/precos";

// Marco 3Q: o administrador digita quanto custa cada unidade do material. Com isso, a tela Consumo mostra o gasto em R$.
export default async function PrecosPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; erro?: string; filtro?: string }> }) {
  await requireCapability("admin:manage");
  if (!precosLiberados3q()) redirect("/materiais");
  const query = await searchParams;
  const [materiais, precos] = await Promise.all([lerMateriaisParaPreco3q(), lerPrecos3q()]);
  const preco = new Map(precos.map(p => [p.item_id, p]));
  const busca = (query.q ?? "").trim().toLocaleLowerCase("pt-BR").slice(0, 80);
  const semPreco = query.filtro === "sem-preco";
  const lista = materiais.filter(m => (!busca || `${m.name} ${m.code} ${m.category ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca)) && (!semPreco || !preco.has(m.id)));
  const faltam = materiais.filter(m => !preco.has(m.id)).length;
  return <>
    <PageHeader eyebrow="ALMOXARIFADO" title="Preço dos materiais"
      description="Quanto custa cada unidade (caixa, kg, litro…). Serve para a tela Consumo mostrar o gasto em R$. Só o administrador altera; engenheiros podem ver o valor no Consumo."
      actions={<Link className="button ghost" href="/consumo">Ver consumo</Link>} />
    {query.ok && <div className="alert success" role="status">{Number(query.ok) === 1 ? "1 preço salvo." : `${Number(query.ok) || 0} preços salvos.`}</div>}
    {query.erro && <div className="alert error" role="alert">{MENSAGENS_PRECOS_3Q[query.erro] ?? MENSAGENS_PRECOS_3Q.falhou}</div>}
    <section className="panel"><div className="panel-body">
      <form className="toolbar" method="get" role="search">
        <label>Procurar material<input name="q" defaultValue={query.q ?? ""} placeholder="Nome, código ou categoria" /></label>
        {semPreco && <input type="hidden" name="filtro" value="sem-preco" />}
        <button className="button secondary" type="submit">Procurar</button>
      </form>
      <nav className="chip-row" aria-label="Mostrar">
        <Link className={!semPreco ? "chip active" : "chip"} href="/materiais/precos">Todos ({materiais.length})</Link>
        <Link className={semPreco ? "chip active" : "chip"} href="/materiais/precos?filtro=sem-preco">Sem preço ({faltam})</Link>
      </nav>
    </div></section>
    <form action={salvarPrecos} className="panel">
      <header className="panel-header"><div><h2>{lista.length} material(is)</h2><p>Deixe em branco para tirar o preço. Use vírgula para os centavos: 12,50.</p></div></header>
      {lista.length === 0 ? <div className="panel-body"><p className="muted">Nenhum material encontrado.</p></div> :
      <div className="data-table-wrap"><table className="data-table precos-tabela">
        <thead><tr><th style={{ width: "44%" }}>Material</th><th style={{ width: "22%" }}>Categoria</th><th style={{ width: "34%" }}>Preço por unidade (R$)</th></tr></thead>
        <tbody>{lista.map(m => {
          const atual = mostrarPrecoBR(preco.get(m.id)?.unit_price);
          const unidade = consumptionUnitLabel(consumptionUnit(m.unit), 1);
          return <tr key={m.id}>
            <td><span className="primary-cell">{m.name}</span><span className="secondary-cell">{m.code}</span></td>
            <td>{m.category ?? "—"}</td>
            <td><input aria-label={`Preço de 1 ${unidade} de ${m.name}, em reais`} name={`preco:${m.id}`} defaultValue={atual} inputMode="decimal" autoComplete="off" placeholder="0,00" maxLength={14} />
              <input type="hidden" name={`antes:${m.id}`} value={atual} />
              <span className="secondary-cell">por {unidade}</span></td>
          </tr>;
        })}</tbody>
      </table></div>}
      {lista.length > 0 && <div className="precos-acoes"><span className="muted">Só os preços alterados são gravados.</span><button className="button primary" type="submit">Salvar preços</button></div>}
    </form>
  </>;
}
