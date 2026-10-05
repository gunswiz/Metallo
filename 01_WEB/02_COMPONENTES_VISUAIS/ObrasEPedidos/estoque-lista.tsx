"use client";
import { useState } from "react";
import { can } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { siteFields } from "./campos";

type Linha = { nome: string; saldo: string; zero: boolean };
type Grupo = { nome: string; linhas: Linha[] };
type LinhaMatriz = { id: string; nome: string; detalhe: string; unit: string; saldos: Map<string, number> };

// Marco 3K/3L: "Estoque das obras" só para consultar (os lançamentos ficam em Lançar).
// Computador: tabela formal (material × local, com total). Celular: um cartão por local.
export function EstoqueLista({ data, profile }: { data: SiteSnapshot; profile: SessionProfile }) {
  const { teamName, workName } = siteFields(data, profile);
  const [local, setLocal] = useState("");
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const confere = (texto: string) => !termo || texto.toLocaleLowerCase("pt-BR").includes(termo);
  const nomeLocal = (teamId: string) => data.works.find(work => work.stock_team_id === teamId)?.name ?? teamName(teamId);

  const porLocal = new Map<string, Grupo>();
  const materiais: LinhaMatriz[] = [];
  for (const item of data.materials) {
    if (!confere(`${item.name} ${item.code}`)) continue;
    materiais.push({ id: item.id, nome: item.name, detalhe: item.code, unit: item.unit, saldos: new Map(item.stock.map(stock => [stock.team_id, stock.quantity])) });
    for (const stock of item.stock) {
      const grupo = porLocal.get(stock.team_id) ?? { nome: nomeLocal(stock.team_id), linhas: [] };
      grupo.linhas.push({ nome: item.name, saldo: `${stock.quantity} ${item.unit}`, zero: stock.quantity <= 0 });
      porLocal.set(stock.team_id, grupo);
    }
  }
  const locais = [...porLocal.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
  const visiveis = locais.filter(([id]) => !local || id === local);
  const colunas = visiveis.map(([id, grupo]) => ({ id, nome: grupo.nome }));
  const linhasMateriais = materiais.filter(linha => colunas.some(coluna => linha.saldos.has(coluna.id)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const epi = can(profile, "epi:read");
  const obraEscolhida = data.works.find(work => work.stock_team_id === local)?.id;
  const lotes = new Map<string, Grupo>();
  const epis = new Map<string, LinhaMatriz>();
  if (epi) for (const batch of data.batches) {
    const item = data.epi_items.find(entry => entry.id === batch.item_id);
    if (!item || !confere(`${item.name} ${item.code}`)) continue;
    const key = batch.worksite_id ?? "central";
    const grupo = lotes.get(key) ?? { nome: workName(batch.worksite_id), linhas: [] };
    const detalhe = `${batch.variant ?? "tamanho único"}${batch.ca_number ? ` · CA ${batch.ca_number}` : ""}`;
    grupo.linhas.push({ nome: `${item.name} · ${batch.variant ?? "única"}${batch.ca_number ? ` · CA ${batch.ca_number}` : ""}`, saldo: `${batch.quantity} ${item.unit}`, zero: batch.quantity <= 0 });
    lotes.set(key, grupo);
    const chave = `${item.id}|${batch.variant ?? ""}|${batch.ca_number ?? ""}`;
    const linha = epis.get(chave) ?? { id: chave, nome: item.name, detalhe, unit: item.unit, saldos: new Map<string, number>() };
    linha.saldos.set(key, (linha.saldos.get(key) ?? 0) + batch.quantity);
    epis.set(chave, linha);
  }
  const locaisEpi = [...lotes.entries()].filter(([id]) => !obraEscolhida || id === obraEscolhida)
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
  const colunasEpi = locaisEpi.map(([id, grupo]) => ({ id, nome: grupo.nome }));
  const linhasEpi = [...epis.values()].filter(linha => colunasEpi.some(coluna => linha.saldos.has(coluna.id)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.detalhe.localeCompare(b.detalhe, "pt-BR"));

  return <>
    <div className="filter-row">
      <label>Local<select value={local} onChange={event => setLocal(event.target.value)}><option value="">Todos os locais</option>
        {locais.map(([id, grupo]) => <option key={id} value={id}>{grupo.nome}</option>)}</select></label>
      <label>Procurar item<input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Nome ou código"/></label>
    </div>
    <section className="panel"><header className="panel-header"><div><h2>Materiais por local</h2><p>Saldo físico de cada obra ou local. Para lançar consumo, entrada ou transferência, use Lançar.</p></div></header>
      {visiveis.length === 0 ? <div className="panel-body"><p className="muted">Nenhum material encontrado.</p></div> : <>
        <Matriz className="so-computador" titulo="Material" colunas={colunas} linhas={linhasMateriais} />
        <div className="panel-body so-celular"><Cartoes grupos={visiveis.map(([id, grupo]) => [id, grupo])} /></div>
      </>}
    </section>
    {epi && <section className="panel"><header className="panel-header"><div><h2>EPIs por local</h2><p>Lotes disponíveis (tamanho e C.A.).</p></div></header>
      {locaisEpi.length === 0 ? <div className="panel-body"><p className="muted">Nenhum lote de EPI encontrado.</p></div> : <>
        <Matriz className="so-computador" titulo="EPI e fardamento" colunas={colunasEpi} linhas={linhasEpi} />
        <div className="panel-body so-celular"><Cartoes grupos={locaisEpi} /></div>
      </>}
    </section>}
  </>;
}

function Matriz({ className, titulo, colunas, linhas }: { className: string; titulo: string; colunas: Array<{ id: string; nome: string }>; linhas: LinhaMatriz[] }) {
  const comTotal = colunas.length > 1;
  return <div className={`data-table-wrap ${className}`}><table className="data-table estoque-matriz">
    <thead><tr><th>{titulo}</th>{colunas.map(coluna => <th key={coluna.id} className="numeric">{coluna.nome}</th>)}{comTotal && <th className="numeric">Total</th>}</tr></thead>
    <tbody>{linhas.map(linha => {
      const total = colunas.reduce((soma, coluna) => soma + (linha.saldos.get(coluna.id) ?? 0), 0);
      return <tr key={linha.id}>
        <td><span className="primary-cell">{linha.nome}</span><span className="secondary-cell">{linha.detalhe}</span></td>
        {colunas.map(coluna => { const valor = linha.saldos.get(coluna.id); return <td key={coluna.id} className={`numeric${valor !== undefined && valor <= 0 ? " zero" : ""}${valor === undefined ? " vazio" : ""}`}>{valor === undefined ? "—" : `${valor} ${linha.unit}`}</td>; })}
        {comTotal && <td className={`numeric total${total <= 0 ? " zero" : ""}`}>{total} {linha.unit}</td>}
      </tr>;
    })}</tbody>
  </table></div>;
}

function Cartoes({ grupos }: { grupos: Array<[string, Grupo]> }) {
  return <div className="stock-cards">{grupos.map(([id, grupo]) => <article className="stock-card" key={id}><h3>{grupo.nome}</h3>
    <ul>{grupo.linhas.map((linha, index) => <li key={index} className={linha.zero ? "zero" : undefined}><span>{linha.nome}</span><span>{linha.saldo}</span></li>)}</ul></article>)}</div>;
}
