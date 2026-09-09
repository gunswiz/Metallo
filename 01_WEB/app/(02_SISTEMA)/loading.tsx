export default function Loading() {
  return (
    <div aria-label="Carregando" className="metric-grid">
      {Array.from({ length: 4 }).map((_, index) => <div className="metric-card" key={index} style={{ opacity: .45 }} />)}
    </div>
  );
}
