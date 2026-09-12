import { consumptionQuantity, consumptionUnitLabel } from "@/03_FUNCOES_E_LOGICA/unidadesConsumo";

type Slice = { id: string; label: string; code: string; value: number };
const palette = ["#ffac6b", "#5edbb5", "#c6a0ff", "#64caff", "#ff8eab", "#e0d26d", "#8fa4b3"];

export function consumptionPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  const percent = value / total * 100;
  if (percent > 0 && percent < 0.1) return "< 0,1%";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(percent)}%`;
}

export function ConsumptionDonut({ materials, unit }: { materials: Slice[]; unit: string }) {
  const positive = materials.filter((material) => material.value > 0);
  const total = positive.reduce((sum, material) => sum + material.value, 0);
  if (total === 0) return <div className="consumption-chart-empty"><strong>Sem consumo em {consumptionUnitLabel(unit)}</strong><p>Escolha outro período ou outra unidade de medida.</p></div>;
  const slices = positive.length > 7 ? [
    ...positive.slice(0, 6),
    { id: "other-materials", label: `Demais ${positive.length - 6} materiais`, code: "Detalhados na tabela", value: positive.slice(6).reduce((sum, material) => sum + material.value, 0) },
  ] : positive;
  const segments = slices.map((slice, index) => ({
    ...slice,
    start: slices.slice(0, index).reduce((sum, previous) => sum + previous.value, 0) / total * 100,
    size: slice.value / total * 100,
    color: palette[index % palette.length],
  }));
  return <div className="consumption-donut-layout">
    <div className="consumption-donut-visual">
      <svg className="consumption-donut" viewBox="0 0 240 240" role="img" aria-label={`Consumo por material: ${consumptionQuantity(total, unit)}. Percentuais detalhados na legenda.`}>
        <circle cx="120" cy="120" r="91" fill="none" stroke="var(--panel-3)" strokeWidth="34" />
        {segments.map((slice) => <circle key={slice.id} cx="120" cy="120" r="91" fill="none" stroke={slice.color} strokeWidth="34" pathLength="100" strokeDasharray={`${slice.size} ${100 - slice.size}`} strokeDashoffset={-slice.start} transform="rotate(-90 120 120)">
          <title>{`${slice.label}: ${consumptionQuantity(slice.value, unit)} · ${consumptionPercent(slice.value, total)}`}</title>
        </circle>)}
      </svg>
      <div className="consumption-donut-center" aria-hidden="true"><span>Total consumido</span><strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(total)}</strong><span>{consumptionUnitLabel(unit, total)}</span></div>
    </div>
    <ul className="consumption-donut-legend">
      {segments.map((slice) => <li key={slice.id}>
        <i style={{ background: slice.color }} aria-hidden="true" />
        <div><strong>{slice.label}</strong><small>{slice.code}</small><span>{consumptionQuantity(slice.value, unit)}</span></div>
        <b>{consumptionPercent(slice.value, total)}</b>
      </li>)}
    </ul>
  </div>;
}
