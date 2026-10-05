"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ConsumptionUnitReport } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { consumptionCategory } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { consumptionQuantity, consumptionUnitLabel } from "@/03_FUNCOES_E_LOGICA/unidadesConsumo";
import { formatNumber } from "./analytics-charts";
import { consumptionPercent } from "./consumption-donut";

// Marco 3L — painel de consumo "para o dono olhar": números grandes, evolução, rosca por material,
// ranking por equipe e categoria, e a tabela completa. Cores validadas para o fundo escuro
// (paleta categórica com ordem fixa; a cor segue o material, nunca a posição).
export const CORES_CONSUMO = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const COR_OUTROS = "#5f7280";

function teto(value: number) {
  if (value <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * base >= value) return step * base;
  return 10 * base;
}

function Variacao({ atual, anterior, texto }: { atual: number; anterior: number; texto: string }) {
  if (anterior <= 0) return <span className="cs-delta neutro"><Minus size={14} aria-hidden="true" />{atual > 0 ? "sem consumo antes" : "—"}</span>;
  const pct = ((atual - anterior) / anterior) * 100;
  const igual = Math.abs(pct) < 0.5;
  const Icone = igual ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`cs-delta ${igual ? "neutro" : pct > 0 ? "subiu" : "caiu"}`}>
    <Icone size={14} aria-hidden="true" />{igual ? "igual" : `${pct > 0 ? "+" : ""}${formatNumber(Math.round(pct * 10) / 10)}%`}{texto && <small> {texto}</small>}
  </span>;
}

function GraficoDias({ report }: { report: ConsumptionUnitReport }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const pontos = report.daily.points;
  const maior = teto(Math.max(0, ...pontos.map((ponto) => ponto.value)));
  const media = pontos.length ? report.total / pontos.length : 0;
  const passo = Math.max(1, Math.ceil(pontos.length / 6));
  const unidade = consumptionUnitLabel(report.unit);
  const ponto = ativo === null ? null : pontos[ativo];
  return <div className="cs-colunas" onMouseLeave={() => setAtivo(null)}>
    <div className="cs-colunas-area">
      {[1, 0.5, 0].map((fracao) => <div key={fracao} className="cs-grade" style={{ bottom: `${fracao * 100}%` }}><span>{formatNumber(maior * fracao)}</span></div>)}
      {media > 0 && <div className="cs-media" style={{ bottom: `${(media / maior) * 100}%` }}><span>média {formatNumber(Math.round(media * 10) / 10)} por {report.daily.bucket}</span></div>}
      <div className="cs-barras" role="list" aria-label={`Consumo por ${report.daily.bucket} em ${unidade}`}>
        {pontos.map((item, index) => <button type="button" role="listitem" key={item.start} className={`cs-barra${ativo === index ? " ativo" : ""}`}
          aria-label={`${item.fullLabel}: ${consumptionQuantity(item.value, report.unit)}`}
          onMouseEnter={() => setAtivo(index)} onFocus={() => setAtivo(index)} onBlur={() => setAtivo(null)}>
          <i style={{ height: item.value > 0 ? `max(3px, ${(item.value / maior) * 100}%)` : 0 }} />
        </button>)}
      </div>
      {ponto && ativo !== null && <div className={`cs-dica${(ativo + 0.5) / pontos.length < 0.2 ? " esq" : (ativo + 0.5) / pontos.length > 0.8 ? " dir" : ""}`} role="status" style={{ left: `${((ativo + 0.5) / pontos.length) * 100}%` }}>
        <span>{ponto.fullLabel}</span><strong>{consumptionQuantity(ponto.value, report.unit)}</strong>
      </div>}
    </div>
    <div className="cs-eixo" aria-hidden="true">{pontos.map((item, index) => <span key={item.start}>{index % passo === 0 ? item.label : ""}</span>)}</div>
  </div>;
}

type Fatia = { id: string; label: string; detalhe: string; value: number; cor: string };

function Rosca({ fatias, total, unit }: { fatias: Fatia[]; total: number; unit: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const raio = 90; const espessura = 30; const gap = fatias.length > 1 ? 0.6 : 0; // 2px de respiro entre fatias
  const segmentos = fatias.map((fatia, index) => ({ ...fatia,
    inicio: fatias.slice(0, index).reduce((soma, anterior) => soma + anterior.value, 0) / total * 100,
    tamanho: (fatia.value / total) * 100 }));
  const destaque = ativo === null ? null : segmentos[ativo];
  return <div className="cs-rosca" onMouseLeave={() => setAtivo(null)}>
    <div className="cs-rosca-visual">
      <svg viewBox="0 0 240 240" role="img" aria-label={`Divisão do consumo por material, total ${consumptionQuantity(total, unit)}. Valores na legenda ao lado.`}>
        <circle cx="120" cy="120" r={raio} fill="none" stroke="var(--panel-2)" strokeWidth={espessura} />
        {segmentos.map((fatia, index) => <circle key={fatia.id} cx="120" cy="120" r={raio} fill="none" stroke={fatia.cor}
          strokeWidth={ativo === index ? espessura + 8 : espessura} pathLength="100"
          strokeDasharray={`${Math.max(0.01, fatia.tamanho - gap)} ${100 - Math.max(0.01, fatia.tamanho - gap)}`}
          strokeDashoffset={-fatia.inicio} transform="rotate(-90 120 120)" opacity={ativo === null || ativo === index ? 1 : 0.35}
          onMouseEnter={() => setAtivo(index)} />)}
      </svg>
      <div className="cs-rosca-centro" aria-hidden="true">
        {destaque ? <><span>{destaque.label}</span><strong>{formatNumber(destaque.value)}</strong><span>{consumptionPercent(destaque.value, total)} do total</span></>
          : <><span>Total</span><strong>{formatNumber(total)}</strong><span>{consumptionUnitLabel(unit, total)}</span></>}
      </div>
    </div>
    <ul className="cs-legenda">
      {segmentos.map((fatia, index) => <li key={fatia.id}>
        <button type="button" className={ativo === index ? "ativo" : undefined} onMouseEnter={() => setAtivo(index)} onFocus={() => setAtivo(index)} onBlur={() => setAtivo(null)}>
          <i style={{ background: fatia.cor }} aria-hidden="true" />
          <span><strong>{fatia.label}</strong><small>{fatia.detalhe}</small></span>
          <b>{consumptionPercent(fatia.value, total)}</b>
        </button>
      </li>)}
    </ul>
  </div>;
}

function Barras({ itens, total, unit }: { itens: Array<{ label: string; value: number }>; total: number; unit: string }) {
  if (itens.length === 0) return <p className="muted">Sem consumo no período.</p>;
  const maior = Math.max(1, ...itens.map((item) => item.value));
  return <ul className="cs-barras-h">{itens.map((item) => <li key={item.label}>
    <div className="cs-barras-h-topo"><span>{item.label}</span><strong>{consumptionQuantity(item.value, unit)} <small>{consumptionPercent(item.value, total)}</small></strong></div>
    <div className="cs-trilho" aria-hidden="true"><i style={{ width: `${Math.max(1.5, (item.value / maior) * 100)}%` }} /></div>
  </li>)}</ul>;
}

export function ConsumptionDashboard({ reports, periodLabel }: { reports: ConsumptionUnitReport[]; periodLabel: string }) {
  const comConsumo = reports.filter((entry) => entry.total > 0);
  const [selectedUnit, setSelectedUnit] = useState(() =>
    comConsumo.find((entry) => entry.unit === "un")?.unit ?? comConsumo[0]?.unit ?? reports[0]?.unit ?? "un");
  const report = reports.find((entry) => entry.unit === selectedUnit) ?? reports[0];
  if (!report || comConsumo.length === 0) return <section className="panel consumption-chart-empty"><strong>Nenhum consumo neste período</strong><p>Escolha outro período acima ou registre o consumo de hoje.</p><Link className="button primary" href="/lancar/consumo">Registrar consumo</Link></section>;

  const unidade = consumptionUnitLabel(report.unit);
  const total = report.total;
  // A cor acompanha o material (ordem do maior para o menor, fixa para o período); além de 6, vira "Outros".
  const principais = report.materials.filter((material) => material.value > 0);
  const corDe = new Map(principais.slice(0, principais.length > 7 ? 6 : 7).map((material, index) => [material.id, CORES_CONSUMO[index]]));
  const fatias: Fatia[] = principais.length > 7
    ? [...principais.slice(0, 6).map((m) => ({ id: m.id, label: m.label, detalhe: consumptionQuantity(m.value, report.unit), value: m.value, cor: corDe.get(m.id)! })),
      { id: "outros", label: `Outros (${principais.length - 6})`, detalhe: consumptionQuantity(principais.slice(6).reduce((s, m) => s + m.value, 0), report.unit), value: principais.slice(6).reduce((s, m) => s + m.value, 0), cor: COR_OUTROS }]
    : principais.map((m) => ({ id: m.id, label: m.label, detalhe: consumptionQuantity(m.value, report.unit), value: m.value, cor: corDe.get(m.id) ?? COR_OUTROS }));
  const equipe = report.teams[0];
  const material = report.materials[0];
  const mediaDia = report.activeDays ? total / report.activeDays : 0;

  return <>
    <nav className="cs-unidades" aria-label="Medida analisada">
      <span>Medida:</span>
      {reports.map((entry) => <button type="button" key={entry.unit} aria-pressed={entry.unit === report.unit} onClick={() => setSelectedUnit(entry.unit)} disabled={entry.total === 0}>
        <strong>{consumptionUnitLabel(entry.unit, 2)}</strong><small>{formatNumber(entry.total)}</small>
      </button>)}
      <p>Caixas, unidades, kg e litros não se somam: cada medida tem seu próprio painel.</p>
    </nav>

    <section className="cs-kpis" aria-label={`Resumo em ${unidade}`}>
      <article className="cs-kpi destaque">
        <span>Total consumido · {periodLabel}</span>
        <strong>{formatNumber(total)} <small>{consumptionUnitLabel(report.unit, total)}</small></strong>
        <Variacao atual={total} anterior={report.previousTotal} texto="vs. período anterior" />
      </article>
      <article className="cs-kpi">
        <span>Média por dia trabalhado</span>
        <strong>{formatNumber(Math.round(mediaDia * 10) / 10)} <small>{consumptionUnitLabel(report.unit, mediaDia)}</small></strong>
        <em>{report.activeDays} dia(s) com consumo</em>
      </article>
      <article className="cs-kpi">
        <span>Equipe que mais consumiu</span>
        <strong className="texto">{equipe?.label ?? "—"}</strong>
        <em>{equipe ? `${consumptionQuantity(equipe.value, report.unit)} · ${consumptionPercent(equipe.value, total)} do total` : ""}</em>
      </article>
      <article className="cs-kpi">
        <span>Material mais consumido</span>
        <strong className="texto">{material?.label ?? "—"}</strong>
        <em>{material ? `${consumptionQuantity(material.value, report.unit)} · ${consumptionPercent(material.value, total)} do total` : ""}</em>
      </article>
    </section>

    <section className="panel cs-painel">
      <header className="panel-header"><div><h2>Consumo {report.daily.bucket === "dia" ? "dia a dia" : "semana a semana"}</h2>
        <p>Em {unidade}. Passe o mouse (ou toque) numa barra para ver o valor. A linha tracejada é a média.</p></div></header>
      <div className="panel-body"><GraficoDias report={report} /></div>
    </section>

    <section className="panel cs-painel">
      <header className="panel-header"><div><h2>Para onde foi o consumo</h2><p>Participação de cada material no total em {unidade}. Passe o mouse na legenda para destacar.</p></div></header>
      <div className="panel-body"><Rosca fatias={fatias} total={total} unit={report.unit} /></div>
    </section>

    <div className="cs-grade-2">
      <section className="panel cs-painel">
        <header className="panel-header"><div><h2>Por equipe</h2><p>Quem consumiu, em {unidade}.</p></div></header>
        <div className="panel-body"><Barras itens={report.teams} total={total} unit={report.unit} /></div>
      </section>
      <section className="panel cs-painel">
        <header className="panel-header"><div><h2>Por categoria</h2><p>Tipo de material, em {unidade}.</p></div></header>
        <div className="panel-body"><Barras itens={report.categoryTotals} total={total} unit={report.unit} /></div>
      </section>
    </div>

    <section className="panel cs-painel">
      <header className="panel-header"><div><h2>Ranking de materiais</h2><p>Do mais consumido para o menos, comparando com o período anterior de mesmo tamanho.</p></div></header>
      <div className="data-table-wrap"><table className="data-table cs-ranking">
        <thead><tr><th>Material</th><th>Categoria</th><th>Consumo</th><th>Participação</th><th>Período anterior</th><th>Variação</th></tr></thead>
        <tbody>{report.materials.map((item) => <tr key={item.id}>
          <td><span className="cs-nome"><i style={{ background: corDe.get(item.id) ?? COR_OUTROS }} aria-hidden="true" /><span><span className="primary-cell">{item.label}</span><span className="secondary-cell">{item.code}</span></span></span></td>
          <td>{item.category}</td>
          <td className="numeric consumption-quantity">{consumptionQuantity(item.value, report.unit)}</td>
          <td><span className="cs-participacao"><span className="cs-trilho" aria-hidden="true"><i style={{ width: `${total ? (item.value / total) * 100 : 0}%` }} /></span>{consumptionPercent(item.value, total)}</span></td>
          <td className="numeric">{consumptionQuantity(item.previous, report.unit)}</td>
          <td><Variacao atual={item.value} anterior={item.previous} texto="" /></td>
        </tr>)}</tbody>
        <tfoot><tr><th>Total em {unidade}</th><td></td><td className="numeric consumption-quantity">{consumptionQuantity(total, report.unit)}</td><td>100%</td><td className="numeric">{consumptionQuantity(report.previousTotal, report.unit)}</td><td><Variacao atual={total} anterior={report.previousTotal} texto="" /></td></tr></tfoot>
      </table></div>
    </section>

    <details className="panel consumption-history-details"><summary>Ver lançamentos que formam os totais · {unidade}</summary>
      <div className="panel-header"><div><p>{report.rows.length > 100 ? `Exibindo os 100 mais recentes de ${report.rows.length} lançamentos. Os totais acima incluem todos.` : `${report.rows.length} lançamento(s) no período, em ${unidade}.`}</p></div></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data do consumo</th><th>Material</th><th>Equipe</th><th>Categoria</th><th>Quantidade</th></tr></thead>
        <tbody>{report.rows.slice().reverse().slice(0, 100).map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" })}</td><td><span className="primary-cell">{row.items?.name ?? "Material removido"}</span><span className="secondary-cell">{row.items?.code}</span></td><td>{row.origin?.name ?? "Sem equipe"}</td><td>{consumptionCategory(row)}</td><td className="numeric consumption-quantity">{consumptionQuantity(Number(row.quantity), report.unit)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}
