// Telemetria técnica opt-in, restrita à prévia local. Nunca registra conteúdo,
// token, body, cookie, querystring ou coordenadas e não altera o DTO/resposta.
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
import { channel } from "node:diagnostics_channel";

let observing = false;
function observeProcess() {
  if (observing) return;
  observing = true;
  const loop = monitorEventLoopDelay({ resolution: 20 }); loop.enable();
  const sockets = new WeakSet<object>(), queued = new WeakMap<object, number>(), connecting = new WeakMap<object, number>();
  let connections = 0, sends = 0, reused = 0, cpu = process.cpuUsage(), tick = performance.now();
  let dispatch: number[] = [], connect: number[] = [];
  const local = (origin: unknown) => /^http:\/\/127\.0\.0\.1:(3107|3108|54321)$/.test(String(origin));
  channel("undici:request:create").subscribe(value => { const m = value as { request: { origin: unknown } }; if (local(m.request.origin)) queued.set(m.request, performance.now()); });
  channel("undici:client:beforeConnect").subscribe(value => { const m = value as { connectParams: { hostname: string; port: string } }; if (m.connectParams.hostname === "127.0.0.1") connecting.set(m.connectParams, performance.now()); });
  channel("undici:client:connected").subscribe(value => { const m = value as { connectParams: { hostname: string }; socket: object }; if (m.connectParams.hostname === "127.0.0.1") { connections++; const at = connecting.get(m.connectParams); if (at !== undefined) connect.push(performance.now() - at); } });
  channel("undici:client:sendHeaders").subscribe(value => { const m = value as { request: { origin: unknown }; socket: object }; if (!local(m.request.origin)) return; sends++; if (sockets.has(m.socket)) reused++; sockets.add(m.socket); const at = queued.get(m.request); if (at !== undefined) dispatch.push(performance.now() - at); });
  const timer = setInterval(() => {
    const now = performance.now(), next = process.cpuUsage();
    console.log("METALLO_4C_RESOURCE " + JSON.stringify({ at: new Date().toISOString(), rss: process.memoryUsage().rss, heap_used: process.memoryUsage().heapUsed,
      cpu_one_core_percent: (next.user + next.system - cpu.user - cpu.system) / (now - tick) / 10,
      event_loop_mean_ms: loop.mean / 1e6, event_loop_p95_ms: loop.percentile(95) / 1e6, event_loop_max_ms: loop.max / 1e6,
      local_connections_created: connections, local_http_sends: sends, local_reused_socket_sends: reused,
      connection_ms: connect, dispatch_wait_ms: dispatch, note: "dispatch includes pool/socket/event loop; not exclusive pool acquisition" }));
    cpu = next; tick = now; loop.reset(); dispatch = []; connect = [];
  }, 1000); timer.unref();
}

export function labTiming(request: NextRequest, operation: string) {
  const enabled = process.env.METALLO_4C_TELEMETRY === "1" && process.env.METALLO_LOCAL_PREVIEW === "1" && process.env.METALLO_COLABORADOR_PREVIEW === "1";
  if (enabled) observeProcess();
  const supplied = request.headers.get("x-metallo-lab-request-id") ?? "";
  const id = enabled ? (/^[a-f0-9-]{36}$/i.test(supplied) ? supplied : randomUUID()) : "";
  const begin = performance.now(), spans: { name: string; ms: number; cpu_ms?: number }[] = [];
  let failure: unknown;
  const traceHeaders: Record<string, string> = enabled ? { "X-Metallo-Lab-Request-Id": id } : {};
  return {
    headers: traceHeaders,
    async measure<T>(name: string, work: () => Promise<T>): Promise<T> {
      if (!enabled) return work();
      const start = performance.now(), cpu = process.cpuUsage(); try { return await work(); } finally { const used = process.cpuUsage(cpu); spans.push({ name, ms: performance.now() - start, ...(enabled ? { cpu_ms: (used.user + used.system) / 1000 } : {}) }); }
    },
    failure(error: unknown) {
      if (!enabled) return;
      const safe = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : undefined;
      const e = error as { name?: unknown; code?: unknown; cause?: { name?: unknown; code?: unknown } };
      failure = { at: new Date().toISOString(), name: safe(e?.name), code: safe(e?.code), cause_name: safe(e?.cause?.name), cause_code: safe(e?.cause?.code) };
    },
    finish(status: number) {
      if (enabled) console.log("METALLO_4C_TRACE " + JSON.stringify({ request_id: id, operation, status, total_ms: performance.now() - begin,
        spans, failure, rss: process.memoryUsage().rss, heap_used: process.memoryUsage().heapUsed, boundary: "Next response prepared; client separately measures bytes received" }));
    },
  };
}
