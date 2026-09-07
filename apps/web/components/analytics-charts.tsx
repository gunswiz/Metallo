type Point = { label: string; value: number };

export function BarChart({ points, suffix = "" }: { points: Point[]; suffix?: string }) {
  const maximum = Math.max(1, ...points.map((point) => point.value));
  if (points.length === 0) return <p className="muted">Sem consumo no período selecionado.</p>;
  return <div className="bar-chart" role="img" aria-label="Gráfico de barras">{points.map((point) => <div className="bar-row" key={point.label}><span title={point.label}>{point.label}</span><div><i style={{ width: `${Math.max(2, (point.value / maximum) * 100)}%` }} /></div><strong>{formatNumber(point.value)} {suffix}</strong></div>)}</div>;
}

export function LineChart({ points }: { points: Point[] }) {
  if (points.length === 0) return <p className="muted">Sem consumo no período selecionado.</p>;
  const width = 720;
  const height = 220;
  const padding = 24;
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const step = points.length <= 1 ? 0 : (width - padding * 2) / (points.length - 1);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding + index * step,
    y: height - padding - (point.value / maximum) * (height - padding * 2),
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className="line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Consumo ao longo do tempo" preserveAspectRatio="none"><polyline points={line} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />{coordinates.map((point) => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="5"><title>{`${point.label}: ${formatNumber(point.value)}`}</title></circle>)}</svg><div className="line-labels">{points.map((point) => <span key={point.label}>{point.label}</span>)}</div></div>;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}
