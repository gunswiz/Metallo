// Marco 10B (foto do defeito na frota) — TESTE ONLINE, dados fictícios.
// Única porta de entrada e saída das fotos. O balde `frota-10b` é PRIVADO.
// Enviar: o banco confere a pessoa (token dela) e dá o número da foto; aqui confere tamanho e tipo REAL (JPEG ou PNG, pelos primeiros bytes) e grava.
// Abrir: o banco confere (Gestão ou quem enviou) e a resposta é um link que vale 2 minutos. Nada de nome, token ou dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const URL_SB = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COLABORADOR = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const BALDE = "frota-10b", MAX = 6 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(URL_SB).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const servidor = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const comoPessoa = (token: string) => createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { Authorization: `Bearer ${token}` } } });

class Falha extends Error { constructor(public status: number, public code: string) { super(code); } }
const CONHECIDOS = ["portal_access_denied", "veiculo_invalido", "muitos_envios", "arquivo_indisponivel"];
function erroBanco(message: string | undefined) {
  const c = CONHECIDOS.find(k => (message ?? "").includes(k));
  return new Falha(c === "portal_access_denied" || c === "arquivo_indisponivel" ? 403 : 400, c ?? "falha");
}
function tipoReal(b: Uint8Array): "image/jpeg" | "image/png" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  return null;
}
async function sha256(b: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map(x => x.toString(16).padStart(2, "0")).join(""); }

async function enviar(token: string, form: FormData) {
  const veiculo = Number(form.get("veiculo_id"));
  const f = form.get("arquivo");
  if (!Number.isInteger(veiculo) || veiculo <= 0) throw new Falha(400, "pedido_invalido");
  if (!(f instanceof File) || f.size < 1) throw new Falha(400, "sem_arquivo");
  if (f.size > MAX) throw new Falha(413, "arquivo_grande");
  const bytes = new Uint8Array(await f.arrayBuffer());
  const mime = tipoReal(bytes);
  if (!mime) throw new Falha(415, "tipo_arquivo");
  const ini = await comoPessoa(token).rpc("iniciar_foto_frota_10b", { p_veiculo: veiculo });
  if (ini.error) throw erroBanco(ini.error.message);
  const id = String(ini.data);
  if (!UUID.test(id)) throw new Falha(500, "falha");
  const caminho = `${veiculo}/${id}.${mime === "image/png" ? "png" : "jpg"}`;
  const up = await servidor.storage.from(BALDE).upload(caminho, bytes, { contentType: mime, upsert: false, cacheControl: "0" });
  if (up.error) throw new Falha(502, "falha_armazenar");
  try {
    await sql.unsafe(`select private.concluir_foto_frota_10b($1::text::uuid, $2, $3, $4::text::int, $5)`, [id, caminho, mime, String(bytes.length), await sha256(bytes)]);
  } catch {
    await servidor.storage.from(BALDE).remove([caminho]).catch(() => undefined);
    throw new Falha(500, "falha");
  }
  return { ok: true, id };
}

async function abrir(token: string, fotoId: string) {
  if (!UUID.test(fotoId)) throw new Falha(400, "pedido_invalido");
  const r = await comoPessoa(token).rpc("abrir_foto_frota_10b", { p_id: fotoId });
  if (r.error) throw erroBanco(r.error.message);
  const a = (r.data as { caminho: string; mime: string }[])[0];
  if (!a) throw new Falha(403, "arquivo_indisponivel");
  const link = await servidor.storage.from(BALDE).createSignedUrl(a.caminho, 120);
  if (link.error || !link.data?.signedUrl) throw new Falha(502, "falha_link");
  return { ok: true, url: link.data.signedUrl, mime: a.mime, expira_em_s: 120 };
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
    if (Number(req.headers.get("content-length") ?? "0") > MAX + 64 * 1024) throw new Falha(413, "arquivo_grande");
    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await req.formData();
      if (String(form.get("acao") ?? "") === "enviar" && origin === COLABORADOR) return answer(await enviar(token, form), 201);
      throw new Falha(400, "pedido_invalido");
    }
    const body = await req.json().catch(() => ({})) as { acao?: string; foto_id?: string };
    if (body.acao === "abrir") return answer(await abrir(token, String(body.foto_id ?? "")));
    throw new Falha(400, "pedido_invalido");
  } catch (e) {
    const f = e instanceof Falha ? e : new Falha(500, "falha");
    if (f.code === "falha") console.error("fotos-frota-10b falhou");
    return answer({ ok: false, error: f.code }, f.status);
  }
});
