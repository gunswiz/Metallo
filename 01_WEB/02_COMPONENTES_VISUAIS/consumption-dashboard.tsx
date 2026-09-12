"use client";

import { useState } from "react";
import { Boxes, CalendarDays, Users } from "lucide-react";
import type { ConsumptionUnitReport } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { consumptionCategory } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { consumptionQuantity, consumptionUnitLabel } from "@/03_FUNCOES_E_LOGICA/unidadesConsumo";
import { BarChart, formatNumber, LineChart } from "./analytics-charts";
import { ConsumptionDonut, consumptionPercent } from "./consumption-donut";
import { MetricCard } from "./metric-card";

export function ConsumptionDashboard({ reports, periodLabel }: { reports: ConsumptionUnitReport[]; periodLabel: string }) {
  const [selectedUnit, setSelectedUnit] = useState(() =>
    reports.find((entry) => entry.unit === "un" && entry.total > 0)?.unit ??
    reports.find((entry) => entry.total > 0)?.unit ?? reports[0]?.unit ?? "un",
  );
  const report = reports.find((entry) => entry.unit === selectedUnit) ?? reports[0];
  if (!report) return <section className="panel consumption-chart-empty"><strong>Nenhum consumo encontrado</strong><p>Ajuste o período ou os filtros para consultar os lançamentos.</p></section>;
  const unitLabel = consumptionUnitLabel(report.unit);
  const previousChange = report.percentChange === null
    ? "Sem consumo anterior"
    : `${report.percentChange > 0 ? "+" : ""}${formatNumber(report.percentChange)}%`;

  return <>
    <section className="consumption-unit-section" aria-label="Consumo separado por unidade de medida">
      <div className="consumption-section-heading"><h2>Quanto foi consumido?</h2><p>{periodLabel} · Selecione a medida para ver sua distribuição.</p></div>
      <div className="consumption-unit-cards">
        {reports.map((entry) => <button type="button" className="consumption-unit-card" key={entry.unit} aria-pressed={entry.unit === report.unit} onClick={() => setSelectedUnit(entry.unit)}>
          <span className="consumption-unit-name">{consumptionUnitLabel(entry.unit)}</span>
          <strong>{formatNumber(entry.total)} <small>{consumptionUnitLabel(entry.unit, entry.total)}</small></strong>
          <span>Anterior: {consumptionQuantity(entry.previousTotal, entry.unit)}</span>
          <b>{entry.unit === report.unit ? "Exibindo nos gráficos" : "Ver distribuição →"}</b>
        </button>)}
      </div>
      <p className="consumption-unit-note">Caixas e unidades têm totais separados. A medida vem do cadastro do material; uma caixa não é convertida em peças sem a quantidade por embalagem.</p>
    </section>

    <div className="consumption-section-heading consumption-active-heading"><h2>Análise em {unitLabel}</h2><span className="consumption-unit-badge">{consumptionQuantity(report.total, report.unit)}</span></div>
    <section className="metric-grid consumption-context-metrics">
      <MetricCard label={`em relação ao período anterior · ${unitLabel}`} value={previousChange} icon={CalendarDays} />
      <MetricCard label={`materiais consumidos em ${unitLabel}`} value={report.materials.length} icon={Boxes} />
      <MetricCard label={`equipes com consumo em ${unitLabel}`} value={report.teams.length} icon={Users} />
    </section>

    <section className="panel consumption-share-panel">
      <header className="panel-header"><div><h2>Participação de cada material</h2><p>Percentual sobre {consumptionQuantity(report.total, report.unit)} no período. A soma das fatias representa 100% desse consumo.</p></div></header>
      <div className="panel-body"><ConsumptionDonut materials={report.materials} unit={report.unit} /></div>
    </section>

    <section className="panel consumption-material-panel">
      <header className="panel-header"><div><h2>Consumo detalhado por material</h2><p>Quantidades em {unitLabel}, sem misturar outras medidas.</p></div></header>
      <div className="data-table-wrap"><table className="data-table consumption-material-table">
        <thead><tr><th>Material</th><th>Consumo no período</th><th>Participação em {unitLabel}</th></tr></thead>
        <tbody>{report.materials.map((material) => <tr key={material.id}>
          <td><span className="primary-cell">{material.label}</span><span className="secondary-cell">{material.code}</span></td>
          <td className="numeric consumption-quantity">{consumptionQuantity(material.value, report.unit)}</td>
          <td className="numeric">{consumptionPercent(material.value, report.total)}</td>
        </tr>)}{report.materials.length === 0 && <tr><td colSpan={3}>Sem consumo nessa medida no período.</td></tr>}</tbody>
        <tfoot><tr><th>Total em {unitLabel}</th><td className="numeric consumption-quantity">{consumptionQuantity(report.total, report.unit)}</td><td className="numeric">{report.total > 0 ? "100%" : "—"}</td></tr></tfoot>
      </table></div>
    </section>

    <section className="analytics-grid">
      <article className="panel"><header className="panel-header"><div><h2>Consumo por equipe</h2><p>Quantidade consumida em {unitLabel} por equipe.</p></div></header><div className="panel-body"><BarChart points={report.teams} suffix={unitLabel} /></div></article>
      <article className="panel"><header className="panel-header"><div><h2>Consumo por categoria</h2><p>Somente materiais medidos em {unitLabel}.</p></div></header><div className="panel-body"><BarChart points={report.categoryTotals} suffix={unitLabel} /></div></article>
    </section>
    <details className="panel consumption-history-details"><summary>Evolução no tempo e lançamentos · {unitLabel}</summary>
      <div className="panel-body"><LineChart points={report.trend} suffix={unitLabel} /></div>
      <div className="panel-header"><div><h2>Lançamentos que formam os totais</h2><p>{report.rows.length > 100 ? `Exibindo os 100 mais recentes de ${report.rows.length} lançamentos. Os totais acima incluem todos os lançamentos carregados para o período.` : `${report.rows.length} lançamento(s) no período, em ${unitLabel}.`}</p></div></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Data do consumo</th><th>Material</th><th>Equipe</th><th>Categoria</th><th>Quantidade consumida</th></tr></thead>
        <tbody>{report.rows.slice().reverse().slice(0, 100).map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</td><td><span className="primary-cell">{row.items?.name ?? "Material removido"}</span><span className="secondary-cell">{row.items?.code}</span></td><td>{row.origin?.name ?? "Sem equipe"}</td><td>{consumptionCategory(row)}</td><td className="numeric consumption-quantity">{consumptionQuantity(Number(row.quantity), report.unit)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}
