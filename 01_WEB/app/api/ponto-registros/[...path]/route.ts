import { pointLaboratoryFetch } from "@/05_ACESSO_A_DADOS/Ponto/transporte-laboratorio";
import { NextRequest, NextResponse } from "next/server";
import { anyRecord, recordPage, recordBatch } from "@/05_ACESSO_A_DADOS/Ponto/registros";
import { anyReceiptFilename, buildAnyReceipt, buildAnyReceiptZip } from "@/03_FUNCOES_E_LOGICA/Relatorios/ponto-comprovante-4d";
import { labTiming } from "@/03_FUNCOES_E_LOGICA/Ponto/telemetria-laboratorio-4c";
import { logoPdfBytes } from "@/03_FUNCOES_E_LOGICA/Relatorios/logo-pdf";
import { destinoPonto } from "@/05_ACESSO_A_DADOS/Ponto/destino-ponto";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
async function smallBody(request: NextRequest) {
  const reader = request.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 512) { await reader.cancel(); throw new Error("PEDIDO_INVALIDO"); } chunks.push(value); }
  return Buffer.concat(chunks).toString("utf8");
}
async function forward(request: NextRequest, path: string[], timing: ReturnType<typeof labTiming>) {
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  const destino = destinoPonto();
  if (!destino) return fail("ROTA_NAO_ENCONTRADA", 404);
  if (destino === "INDISPONIVEL") return fail("SERVIDOR_INDISPONIVEL", 503);
  const endpoint = path.join("/");
  if (request.headers.get("host") !== destino.host || new URL(request.url).search || !/^(list|last48|receipt\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(endpoint) ||
      request.method !== (endpoint === "list" ? "POST" : "GET") || request.method === "POST" && request.headers.get("origin") !== destino.origin) return fail("PEDIDO_INVALIDO", 400);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization)) return fail("SESSAO_INVALIDA", 401);
  let body: string | undefined;
  try { body = request.method === "POST" ? await smallBody(request) : undefined; } catch { return fail("PEDIDO_INVALIDO", 413); }
  if (body !== undefined && (body.length > 512 || request.headers.get("content-type") !== "application/json")) return fail("PEDIDO_INVALIDO", 400);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90000)]);
  const local = (suffix: string, content?: string) => timing.measure(suffix === "authorize" ? "final_authorization_http" : "core_http", () => pointLaboratoryFetch(destino.base("v4b") + suffix, {
    method: content === undefined ? "GET" : "POST", headers: { ...timing.headers, Authorization: authorization, Origin: destino.origin, "Content-Type": "application/json" }, body: content,
    cache: "no-store", redirect: destino.online ? "manual" : "error", signal,
  }));
  try {
    const response = await local(endpoint, body);
    if (response.status >= 300 && response.status < 400) return fail("SERVIDOR_INDISPONIVEL", 503);
    if (!response.ok) { const json = await response.json(); return fail(/^[A-Z0-9_]+$/.test(json.error ?? "") ? json.error : "SERVIDOR_INDISPONIVEL", response.status); }
    const payload = await response.json();
    if (endpoint === "list") return NextResponse.json(recordPage.parse(payload), { headers });
    const logo = logoPdfBytes();
    let bytes: Uint8Array, filename: string, type: string;
    if (endpoint === "last48") { bytes = await timing.measure("ZIP_PDF_generation", () => buildAnyReceiptZip(recordBatch.parse(payload).events, logo)); filename = destino.online ? "comprovantes-teste-ultimas-48h.zip" : "recibos-laboratorio-ultimas-48h.zip"; type = "application/zip"; }
    else { const event = anyRecord.parse(payload); bytes = await timing.measure("PDF_generation", () => buildAnyReceipt(event, logo)); filename = anyReceiptFilename(event); type = "application/pdf"; }
    // Revalida JWT, sessão, vínculo, versão da autorização e prontidão APÓS a geração.
    const final = await local("authorize");
    if (!final.ok) { const json = await final.json(); return fail(/^[A-Z0-9_]+$/.test(json.error ?? "") ? json.error : "ACESSO_NAO_AUTORIZADO", final.status); }
    signal.throwIfAborted();
    return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) { timing.failure(error); if (destino.online) console.error("ponto-registros: falha no encaminhamento", error instanceof Error ? error.name + ": " + error.message : "erro"); return fail("SERVIDOR_INDISPONIVEL", 503); }
}
async function traced(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const timing = labTiming(request, "records"); const response = await forward(request, (await context.params).path, timing); timing.finish(response.status); return response;
}
export const GET = traced;
export const POST = traced;
