import { pointLaboratoryFetch } from "@/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio";
import { NextRequest, NextResponse } from "next/server";
import { labTiming } from "@/03_FUNCOES_E_LOGICA/Ponto/telemetria-laboratorio-4c";
import { destinoPonto } from "@/05_ACESSO_A_DADOS/Ponto/destino-ponto";
export const dynamic = "force-dynamic";
async function forward(request: NextRequest, path: string[], timing: ReturnType<typeof labTiming>) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  const destino = destinoPonto();
  if (!destino) return fail("ROTA_NAO_ENCONTRADA", 404);
  if (destino === "INDISPONIVEL") return fail("SERVIDOR_INDISPONIVEL", 503);
  const endpoint = path.join("/");
  if (request.headers.get("host") !== destino.host || new URL(request.url).search || !/^(clock|begin|events|offline|intent\/[a-f0-9-]{36})$/i.test(endpoint) ||
    request.method === "POST" && (!["begin", "events", "offline"].includes(endpoint) || request.headers.get("origin") !== destino.origin)) return fail("PEDIDO_INVALIDO", 400);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization)) return fail("SESSAO_INVALIDA", 401);
  // Revisão 4C (03/10): recusa corpo grande antes de ler (o limite antigo só valia depois de ler tudo).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (request.method === "POST" && (!Number.isFinite(declared) || declared > 2048)) return fail("PEDIDO_INVALIDO", 400);
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body !== undefined && (body.length > 2048 || request.headers.get("content-type") !== "application/json")) return fail("PEDIDO_INVALIDO", 400);
  try {
    const response = await timing.measure("core_http", () => pointLaboratoryFetch(destino.base("v4a") + endpoint, { method: request.method, headers: { ...timing.headers, Authorization: authorization, Origin: destino.origin, "Content-Type": "application/json" }, body, cache: "no-store", redirect: destino.online ? "manual" : "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]) }));
    if (response.status >= 300 && response.status < 400) return fail("SERVIDOR_INDISPONIVEL", 503);
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { timing.failure(error); if (destino.online) console.error("ponto-online: falha no encaminhamento", error instanceof Error ? error.name + ": " + error.message : "erro"); return fail("SERVIDOR_INDISPONIVEL", 503); }
}
async function traced(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const timing = labTiming(request, "point"); const response = await forward(request, (await context.params).path, timing); timing.finish(response.status); return response;
}
export const GET = traced;
export const POST = traced;
