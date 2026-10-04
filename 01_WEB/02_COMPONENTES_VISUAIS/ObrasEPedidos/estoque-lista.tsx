"use client";
import { useState } from "react";
import { can } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { siteFields } from "./campos";

// Marco 3K: "Estoque das obras" só para consultar (os lançamentos ficam em Lançar).
// Um cartão por local, com busca; funciona igual no celular e no computador.
export function EstoqueLista({ data, profile }: { data: SiteSnapshot; profile: SessionProfile }) {
  const { teamName, workName } = siteFields(data, profile);
  const [local, setLocal] = useState("");
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const nomeLocal = (teamId: string) => data.works.find(work => work.stock_team_id === teamId)?.name ?? teamName(teamId);
  const porLocal = new Map<string, { nome: string; linhas: { nome: string; saldo: string; zero: boolean }[] }>();
  for (const item of data.materials) for (const stock of item.stock) {
    if (termo && !`${item.name} ${item.code}`.toLocaleLowerCase("pt-BR").includes(termo)) continue;
    const grupo = porLocal.get(stock.team_id) ?? { nome: nomeLocal(stock.team_id), linhas: [] };
    grupo.linhas.push({ nome: item.name, saldo: `${stock.quantity} ${item.unit}`, zero: stock.quantity <= 0 });
    porLocal.set(stock.team_id, grupo);
  }
  const locais = [...porLocal.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt-BR"));
  const visiveis = locais.filter(([id]) => !local || id === local);
  const epi = can(profile, "epi:read");
  const obraEscolhida = data.works.find(work => work.stock_team_id === local)?.id;
  const lotes = new Map<string, { nome: string; linhas: { nome: string; saldo: string; zero: boolean }[] }>();
  if (epi) for (const batch of data.batches) {
    const item = data.epi_items.find(entry => entry.id === batch.item_id);
    if (!item || (termo && !`${item.name} ${item.code}`.toLocaleLowerCase("pt-BR").includes(termo))) continue;
    const key = batch.worksite_id ?? "central";
    const grupo = lotes.get(key) ?? { nome: workName(batch.worksite_id), linhas: [] };
    grupo.linhas.push({ nome: `${item.name} · ${batch.variant ?? "única"}${batch.ca_number ? ` · CA ${batch.ca_number}` : ""}`, saldo: `${batch.quantity} ${item.unit}`, zero: batch.quantity <= 0 });
    lotes.set(key, grupo);
  }
  return <>
    <div className="filter-row">
      <label>Local<select value={local} onChange={event => setLocal(event.target.value)}><option value="">Todos os locais</option>
        {locais.map(([id, grupo]) => <option key={id} value={id}>{grupo.nome}</option>)}</select></label>
      <label>Procurar item<input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Nome ou código"/></label>
    </div>
    <section className="panel"><header className="panel-header"><div><h2>Materiais por local</h2><p>Saldo físico de cada obra ou local. Para lançar consumo, entrada ou transferência, use Lançar.</p></div></header>
      <div className="panel-body">{visiveis.length === 0 ? <p className="muted">Nenhum material encontrado.</p> :
        <div className="stock-cards">{visiveis.map(([id, grupo]) => <article className="stock-card" key={id}><h3>{grupo.nome}</h3>
          <ul>{grupo.linhas.map((linha, index) => <li key={index} className={linha.zero ? "zero" : undefined}><span>{linha.nome}</span><span>{linha.saldo}</span></li>)}</ul></article>)}</div>}
      </div></section>
    {epi && <section className="panel"><header className="panel-header"><div><h2>EPIs por local</h2><p>Lotes disponíveis (tamanho e C.A.).</p></div></header>
      <div className="panel-body">{lotes.size === 0 ? <p className="muted">Nenhum lote de EPI encontrado.</p> :
        <div className="stock-cards">{[...lotes.entries()].filter(([id]) => !obraEscolhida || id === obraEscolhida).map(([id, grupo]) => <article className="stock-card" key={id}><h3>{grupo.nome}</h3>
          <ul>{grupo.linhas.map((linha, index) => <li key={index} className={linha.zero ? "zero" : undefined}><span>{linha.nome}</span><span>{linha.saldo}</span></li>)}</ul></article>)}</div>}
      </div></section>}
  </>;
}
