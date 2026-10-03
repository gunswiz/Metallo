import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { buildEpiReport3ePdf, epiReportFilename } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e-pdf";
import { epiReportFailure, projectEpiReport, resolveEpiPeriod, type EpiEventFilter, type EpiReportType } from "@/03_FUNCOES_E_LOGICA/Relatorios/epi-report-3e";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";

export const dynamic = "force-dynamic";
const filters: EpiEventFilter[] = ["all", "entrega", "confirmacao", "troca", "devolucao", "divergencia", "encerramento"];
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCapability("epi:write");
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response("Funcionário inválido", { status: 400 });
  const url = new URL(request.url);
  const type: EpiReportType = url.searchParams.get("type") === "history" ? "history" : "current";
  const event = url.searchParams.get("event") ?? "all";
  if (!filters.includes(event as EpiEventFilter)) return new Response("Filtro inválido", { status: 400 });
  let period;
  try {
    period = resolveEpiPeriod({ preset: url.searchParams.get("preset") ?? "all",
      from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  } catch { return new Response("Período inválido", { status: 400 }); }
  try {
    const raw = await (await getEpiOperations()).report3e(parsed.data);
    const report = projectEpiReport(raw, type, period, event as EpiEventFilter);
    const logo = await readFile(join(process.cwd(), "public", "metallo-logo.png"));
    const bytes = await buildEpiReport3ePdf(report, true, logo);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      { headers: { "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${epiReportFilename(report)}"`,
        "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
  } catch (cause) {
    const failure = epiReportFailure(cause);
    return new Response(failure.message, { status: failure.status,
      headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  }
}
