// Rodada 5, somente loopback. Não conserva socket ocioso entre render e reauth.
import { Agent, request } from "node:http";
import { performance } from "node:perf_hooks";
const writers = new Agent({ keepAlive: false, maxSockets: 16, maxTotalSockets: 16 });
const readers = new Agent({ keepAlive: false, maxSockets: 32, maxTotalSockets: 32 });
const socketIds = new WeakMap<object, number>(); let socketNumber = 0, requestNumber = 0;
export function pointLaboratoryFetch(input: string, options: RequestInit): Promise<Response> {
  // Somente comparações históricas selecionam o transporte anterior.
  // A prévia normal usa o vigente sem parâmetro de rodada.
  if (process.env.METALLO_LOCAL_PREVIEW !== "1" || process.env.METALLO_COLABORADOR_PREVIEW !== "1" || ["2", "3", "4"].includes(process.env.METALLO_4C_ROUND ?? "")) return fetch(input, options);
  const url = new URL(input);
  if (url.hostname !== "127.0.0.1" || !["3106", "3107"].includes(url.port) || url.protocol !== "http:" || url.username || url.password || url.search) return Promise.reject(new Error("ORIGEM_LOCAL_INVALIDA"));
  const writer = /^\/lab-point\/v4a\/(begin|events|intent\/)/.test(url.pathname);
  return new Promise((ok, fail) => {
    const agent = writer ? writers : readers, id = ++requestNumber, start = performance.now(); let socketId: number | undefined;
    const log = (event: string, extra: Record<string, unknown> = {}) => { if (process.env.METALLO_LOCAL_PREVIEW === "1" && process.env.METALLO_4C_TELEMETRY === "1") console.log("METALLO_4C_SOCKET " + JSON.stringify({ at: new Date().toISOString(), request_id: id, socket_id: socketId, endpoint: url.pathname.replace(/[a-f0-9-]{36}/ig, ":id"), operation: options.method ?? "GET", event, elapsed_ms: performance.now() - start, writer, connection_limit: agent.maxSockets, ...extra })); };
    const error = (event: string, e: Error) => { const details = e as Error & { code?: string }; const cause = e.cause as { code?: string } | undefined; log(event, { code: details.code ?? e.name, cause_code: cause?.code }); fail(e); };
    log("request"); const req = request(url, { agent, method: options.method ?? "GET", headers: Object.fromEntries(new Headers(options.headers)), signal: options.signal ?? undefined }, res => {
      log("headers", { status: res.statusCode });
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 8388608) res.destroy(new Error("RESPOSTA_LOCAL_EXCESSIVA")); else chunks.push(chunk); });
      res.on("error", e => error("response_error", e)); res.on("end", () => {
        log("body_drained", { bytes: size });
        if (!res.statusCode || res.statusCode >= 300 && res.statusCode < 400) { fail(new Error("REDIRECIONAMENTO_LOCAL_PROIBIDO")); return; }
        ok(new Response([204,205,304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers: res.headers as Record<string,string> }));
      });
    }); req.on("socket", socket => { socketId = socketIds.get(socket); if (!socketId) { socketId = ++socketNumber; socketIds.set(socket, socketId); } log("assigned", { reused: req.reusedSocket }); socket.once("connect", () => log("connected", { local_port: socket.localPort, remote_port: socket.remotePort })); socket.once("close", hadError => log("socket_closed", { had_error: hadError })); }); req.once("close", () => log("request_closed")); req.on("error", e => error("request_error", e)); req.end(options.body);
  });
}
