// Marcos 6A (contracheque no app) e 6B (atestado pelo app) — TESTE ONLINE, dados fictícios.
// Única porta de entrada e saída dos arquivos. O balde `documentos-6` é PRIVADO.
// 1) A permissão é conferida no banco COMO A PRÓPRIA PESSOA (RPC com o token dela).
// 2) O arquivo é conferido aqui (tamanho e "assinatura" dos primeiros bytes: PDF, JPEG ou PNG — o tipo informado pelo celular é ignorado).
// 3) Só então é gravado com a chave do servidor, e o registro é concluído com um "bilhete" de uso único.
// Abrir: o banco confere de quem é; a resposta é um link que vale 2 minutos. Não registra nome de arquivo, token nem dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import webpush from "npm:web-push@3.6.7";

const URL_SB = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COLABORADOR = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const BALDE = "documentos-6", MAX = 6 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(URL_SB).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const servidor = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const comoPessoa = (token: string) => createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${token}` } } });

class Falha extends Error { constructor(public status: number, public code: string) { super(code); } }
// Erros do banco que podem voltar para a tela (o resto vira "falha").
const CONHECIDOS = ["admin_required", "portal_access_denied", "competencia_invalida", "employee_not_found", "data_invalida", "dias_invalidos",
  "muitos_envios", "arquivo_indisponivel", "pedido_invalido", "ja_enviado", "tipo_arquivo"];
function erroBanco(message: string | undefined) {
  const c = CONHECIDOS.find(k => (message ?? "").includes(k));
  return new Falha(c === "admin_required" || c === "portal_access_denied" || c === "arquivo_indisponivel" ? 403 : 400, c ?? "falha");
}

/** Tipo real do arquivo pelos primeiros bytes. */
export function tipoReal(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  return null;
}
const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } as const;
async function sha256(b: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map(x => x.toString(16).padStart(2, "0")).join(""); }

async function lerArquivo(form: FormData, aceitos: string[]) {
  const f = form.get("arquivo");
  if (!(f instanceof File) || f.size < 1) throw new Falha(400, "sem_arquivo");
  if (f.size > MAX) throw new Falha(413, "arquivo_grande");
  const bytes = new Uint8Array(await f.arrayBuffer());
  const mime = tipoReal(bytes);
  if (!mime || !aceitos.includes(mime)) throw new Falha(415, "tipo_arquivo");
  return { bytes, mime, sha: await sha256(bytes) };
}

async function gravar(ticket: string, employee: string, tipo: "contracheque" | "atestado", a: { bytes: Uint8Array; mime: keyof typeof EXT; sha: string }) {
  const caminho = `${tipo}/${employee}/${ticket}.${EXT[a.mime]}`;
  const up = await servidor.storage.from(BALDE).upload(caminho, a.bytes, { contentType: a.mime, upsert: false, cacheControl: "0" });
  if (up.error) throw new Falha(502, "falha_armazenar");
  try {
    const [r] = await sql.unsafe(`select private.concluir_envio_6($1::text::uuid, $2, $3, $4::text::int, $5) r`,
      [ticket, caminho, a.mime, String(a.bytes.length), a.sha]) as unknown as { r: Record<string, string> }[];
    return r.r;
  } catch (e) {
    await servidor.storage.from(BALDE).remove([caminho]).catch(() => undefined);
    throw erroBanco(e instanceof Error ? e.message : "");
  }
}

// Aviso no celular da Gestão quando chega atestado (mesma inscrição do 3P/5C). Sem nome de doença: só quem e quantos dias.
async function avisarGestao(nome: string, dias: string) {
  try {
    const rows = await sql.unsafe(`select name, decrypted_secret from vault.decrypted_secrets where name in ('metallo_vapid_privada','metallo_vapid_publica')`) as unknown as { name: string; decrypted_secret: string }[];
    const s = Object.fromEntries(rows.map(r => [r.name, r.decrypted_secret]));
    if (!s.metallo_vapid_publica || !s.metallo_vapid_privada) return;
    webpush.setVapidDetails(GESTAO, s.metallo_vapid_publica, s.metallo_vapid_privada);
    const lista = await sql.unsafe(`select id::text id, endpoint, p256dh, auth from private.destinos_alertas_5c()`) as unknown as { id: string; endpoint: string; p256dh: string; auth: string }[];
    const msg = JSON.stringify({ title: "Atestado recebido", body: `${nome.split(" ")[0]} enviou um atestado de ${dias} dia(s). Confira em Pedidos.`, url: "/pedidos#atestados" });
    for (const a of lista) {
      try { await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, msg, { TTL: 6 * 3600, urgency: "normal" }); }
      catch (e) {
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) await sql.unsafe(`delete from private.push_subscriptions_3p where id = $1::text::bigint`, [a.id]);
      }
    }
  } catch { console.error("arquivos-6: aviso para a Gestão falhou"); }
}

async function atestado(token: string, form: FormData) {
  const dataInicio = String(form.get("data_inicio") ?? ""), dias = Number(form.get("dias")), obs = String(form.get("observacao") ?? "").slice(0, 200), chave = String(form.get("chave") ?? "");
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(dataInicio) || !Number.isInteger(dias) || !UUID.test(chave)) throw new Falha(400, "pedido_invalido");
  const arquivo = await lerArquivo(form, ["application/pdf", "image/jpeg", "image/png"]);
  const ini = await comoPessoa(token).rpc("iniciar_atestado_6b", { p_data_inicio: dataInicio, p_dias: dias, p_observacao: obs, p_chave: chave });
  if (ini.error) throw erroBanco(ini.error.message);
  const t = (ini.data as { ticket: string | null; employee_id: string; duplicado: boolean }[])[0];
  if (!t) throw new Falha(400, "falha");
  if (t.duplicado) return { ok: true, duplicado: true };
  const r = await gravar(t.ticket!, t.employee_id, "atestado", arquivo);
  await avisarGestao(String(r.nome ?? "Funcionário"), String(r.dias ?? dias));
  return { ok: true, id: Number(r.id) };
}

async function contracheque(token: string, form: FormData) {
  const employee = String(form.get("employee_id") ?? ""), competencia = String(form.get("competencia") ?? ""), tipoFolha = String(form.get("tipo_folha") ?? "mensal");
  if (!UUID.test(employee) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Falha(400, "pedido_invalido");
  const arquivo = await lerArquivo(form, ["application/pdf"]);
  const ini = await comoPessoa(token).rpc("iniciar_contracheque_6a", { p_employee_id: employee, p_competencia: competencia, p_tipo_folha: tipoFolha });
  if (ini.error) throw erroBanco(ini.error.message);
  const r = await gravar(String(ini.data), employee, "contracheque", arquivo);
  return { ok: true, id: Number(r.id) };
}

async function abrir(token: string, arquivoId: string) {
  if (!UUID.test(arquivoId)) throw new Falha(400, "pedido_invalido");
  const r = await comoPessoa(token).rpc("abrir_arquivo_6", { p_id: arquivoId });
  if (r.error) throw erroBanco(r.error.message);
  const a = (r.data as { caminho: string; mime: string; nome: string }[])[0];
  if (!a) throw new Falha(403, "arquivo_indisponivel");
  const link = await servidor.storage.from(BALDE).createSignedUrl(a.caminho, 120, a.mime === "application/pdf" ? { download: a.nome } : undefined);
  if (link.error || !link.data?.signedUrl) throw new Falha(502, "falha_link");
  return { ok: true, url: link.data.signedUrl, mime: a.mime, nome: a.nome, expira_em_s: 120 };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = origin === COLABORADOR ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
  if (req.method === "OPTIONS") return new Response(null, { status: origin === COLABORADOR ? 204 : 403, headers: { ...cors,
    "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" } });
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST") throw new Falha(405, "metodo");
    if (origin !== COLABORADOR && origin !== GESTAO) throw new Falha(403, "origem_invalida");
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
    if (!token || token.length > 8192 || token.split(".").length !== 3) throw new Falha(401, "authentication_required");
    const tamanho = Number(req.headers.get("content-length") ?? "0");
    if (tamanho > MAX + 64 * 1024) throw new Falha(413, "arquivo_grande");
    const tipo = req.headers.get("content-type") ?? "";
    if (tipo.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const acao = String(form.get("acao") ?? "");
      if (acao === "atestado" && origin === COLABORADOR) return answer(await atestado(token, form), 201);
      if (acao === "contracheque" && origin === GESTAO) return answer(await contracheque(token, form), 201);
      throw new Falha(400, "pedido_invalido");
    }
    const body = await req.json().catch(() => ({})) as { acao?: string; arquivo_id?: string };
    if (body.acao === "abrir") return answer(await abrir(token, String(body.arquivo_id ?? "")));
    throw new Falha(400, "pedido_invalido");
  } catch (e) {
    const f = e instanceof Falha ? e : new Falha(500, "falha");
    if (f.code === "falha") console.error("arquivos-6 falhou");
    return answer({ ok: false, error: f.code }, f.status);
  }
});
