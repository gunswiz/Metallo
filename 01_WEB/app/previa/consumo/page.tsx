import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsumptionDashboard } from "@/02_COMPONENTES_VISUAIS/consumption-dashboard";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { analyzeConsumptionByUnit, resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import type { ConsumptionRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";

export default function ConsumptionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const range = resolveConsumptionRange("30", undefined, undefined);
  const catalog = [
    { id: "preview-disc", code: "MAT-001", name: "Disco de corte", unit: "un", category: "Abrasivos" },
    { id: "preview-flap", code: "MAT-002", name: "Disco flap", unit: "un", category: "Abrasivos" },
    { id: "preview-drill", code: "MAT-003", name: "Broca para metal", unit: "un", category: "Perfuração" },
    { id: "preview-electrode", code: "MAT-004", name: "Eletrodo 6013", unit: "caixa", category: "Soldagem" },
    { id: "preview-screw", code: "MAT-005", name: "Parafuso autobrocante", unit: "caixa", category: "Fixação" },
  ];
  const current = [90, 45, 15, 8, 4];
  const previous = [60, 30, 10, 6, 2];
  const rows: ConsumptionRow[] = catalog.flatMap((item, index) => [
    { id: `${item.id}-current`, item_id: item.id, origin_team_id: index % 2 ? "preview-b" : "preview-a", quantity: current[index], created_at: new Date(range.currentStart.getTime() + (index * 4 + 2) * 86_400_000 + 12 * 3_600_000).toISOString(), note: "Exemplo fictício para prévia visual", items: item, origin: { id: index % 2 ? "preview-b" : "preview-a", name: index % 2 ? "Equipe B" : "Equipe A" } },
    { id: `${item.id}-previous`, item_id: item.id, origin_team_id: "preview-a", quantity: previous[index], created_at: new Date(range.previousStart.getTime() + (index + 2) * 86_400_000 + 12 * 3_600_000).toISOString(), note: "Exemplo fictício para comparação", items: item, origin: { id: "preview-a", name: "Equipe A" } },
  ]);
  return <main className="page-content consumption-preview" data-module="consumo">
    <div className="consumption-preview-notice"><span><strong>Prévia local</strong> · Dados ilustrativos, sem alterar o estoque.</span><Link href="/consumo">Abrir consumo com meu acesso</Link></div>
    <PageHeader eyebrow="ANÁLISE VISUAL" title="Consumo" description="Selecione Caixas ou Unidades para analisar o consumo de cada material e sua participação no total." />
    <ConsumptionDashboard reports={analyzeConsumptionByUnit(rows, range)} periodLabel={range.label} />
  </main>;
}
