import { pointLaboratoryFetch } from "@/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio";
import { NextRequest, NextResponse } from "next/server";
import { labTiming } from "@/03_FUNCOES_E_LOGICA/Ponto/telemetria-laboratorio-4c";
export const dynamic = "force-dynamic";
async function forward(request: NextRequest, path: string[], timing: ReturnType<typeof labTiming>) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (process.env.METALLO_LOCAL_PREVIEW !== "1" || process.env.METALLO_COLABORADOR_PREVIEW !== "1") return fail("ROTA_NAO_ENCONTRADA", 404);
  const corePort = process.env.METALLO_LOAD_TEST_CORE_PORT ?? "3106";
  if (!["3106", "3107"].includes(corePort)) return fail("SERVIDOR_INDISPONIVEL", 503);
  const endpoint = path.join("/");
  if (request.headers.get("host") !== "127.0.0.1:3101" || new URL(request.url).search || !/^(clock|begin|events|intent\/[a-f0-9-]{36})$/i.test(endpoint) ||
    request.method === "POST" && (!["begin", "events"].includes(endpoint) || request.headers.get("origin") !== "http://127.0.0.1:3101")) return fail("PEDIDO_INVALIDO", 400);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization)) return fail("SESSAO_INVALIDA", 401);
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body !== undefined && (body.length > 2048 || request.headers.get("content-type") !== "application/json")) return fail("PEDIDO_INVALIDO", 400);
  try {
    const response = await timing.measure("core_http", () => pointLaboratoryFetch(`http://127.0.0.1:${corePort}/lab-point/v4a/${endpoint}`, { method: request.method, headers: { ...timing.headers, Authorization: authorization, Origin: "http://127.0.0.1:3101", "Content-Type": "application/json" }, body, cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]) }));
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { timing.failure(error); return fail("SERVIDOR_INDISPONIVEL", 503); }
}
async function traced(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const timing = labTiming(request, "point"); const response = await forward(request, (await context.params).path, timing); timing.finish(response.status); return response;
}
export const GET = traced;
export const POST = traced;
