import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { buildEpiMovementPdf, epiReportFilename } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-pdf";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await requireCapability("epi:read");
  const parameters = new URL(request.url).searchParams;
  const from = parameters.get("from") ?? undefined;
  const to = parameters.get("to") ?? undefined;
  const range = resolveConsumptionRange(from && to ? "custom" : "30", from, to);
  const service = await getMetalloService();
  const teams = await service.listTeams();
  const selectedTeam = teams.find((team) => team.id === parameters.get("team"));
  const report = await service.epiReportData({
    from: range.currentStart.toISOString(),
    to: range.currentEnd.toISOString(),
    teamId: selectedTeam?.id,
  });
  const toInclusive = new Date(range.currentEnd.getTime() - 86_400_000);
  const bytes = await buildEpiMovementPdf({
    deliveries: report.deliveries,
    actorNames: report.actorNames,
    from: range.currentStart,
    toInclusive,
    teamName: selectedTeam?.name ?? "Todas as equipes",
    generatedBy: profile.fullName,
    truncated: report.truncated,
  });
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="${epiReportFilename(range.currentStart, toInclusive)}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
