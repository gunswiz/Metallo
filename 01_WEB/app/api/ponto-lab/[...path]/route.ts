// Transporte da prévia local para a API sintética independente em loopback.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const target = "http://127.0.0.1:3105/lab-point/v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function forward(request: NextRequest, segments: string[]) {
  if (process.env.METALLO_LOCAL_PREVIEW !== "1" || process.env.METALLO_COLABORADOR_PREVIEW !== "1")
    return NextResponse.json({ error: "ROTA_NAO_ENCONTRADA" }, { status: 404 });
  const url = new URL(request.url);
  if (request.headers.get("host") !== "127.0.0.1:3101" || url.search ||
      !(segments.length === 1 && segments[0] === "events" || segments.length === 2 && segments[0] === "intent" && uuid.test(segments[1]) || segments.length === 2 && segments[0] === "session" && ["current", "global"].includes(segments[1])) ||
      (request.method === "POST" && !(segments.length === 1 && segments[0] === "events" || segments.length === 2 && segments[0] === "session" && ["current", "global"].includes(segments[1]))))
    return NextResponse.json({ error: "PEDIDO_INVALIDO" }, { status: 400 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization))
    return NextResponse.json({ error: "SESSAO_INVALIDA" }, { status: 401 });
  let body: string | undefined;
  if (request.method === "POST") {
    if (request.headers.get("content-type") !== "application/json")
      return NextResponse.json({ error: "PEDIDO_INVALIDO" }, { status: 415 });
    body = await request.text();
    if (body.length > 1024) return NextResponse.json({ error: "PEDIDO_INVALIDO" }, { status: 413 });
  }
  try {
    const response = await fetch(`${target}/${segments.join("/")}`, {
      method: request.method, headers: { Authorization: authorization, Origin: "http://127.0.0.1:3101", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(7000),
    });
    return new NextResponse(await response.text(), { status: response.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "LABORATORIO_INDISPONIVEL" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await context.params).path);
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await context.params).path);
}
