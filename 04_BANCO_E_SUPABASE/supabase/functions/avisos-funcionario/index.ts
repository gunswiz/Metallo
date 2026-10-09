// Marco 3U (TESTE ONLINE): avisos no celular do FUNCIONÁRIO.
// "agendado": pg_cron a cada 5 min, com o segredo do Vault no cabeçalho — junta os avisos novos (comunicado, troca de EPI,
// pedido de material, entrega para confirmar), cria os lembretes da hora do ponto e envia o que pode sair agora
// (lembrete do ponto sempre; o resto só dentro do horário de trabalho). "teste": o próprio funcionário testa no aparelho.
// Chaves VAPID ficam no Vault; não registra endereço do aparelho, token nem dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(url).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const COLABORADOR = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";

let segredos: Record<string, string> | null = null;
async function vault() {
  if (segredos) return segredos;
  const rows = await sql.unsafe(`select name, decrypted_secret from vault.decrypted_secrets
    where name in ('metallo_vapid_privada','metallo_vapid_publica','metallo_cron_ponto')`) as unknown as { name: string; decrypted_secret: string }[];
  segredos = Object.fromEntries(rows.map(r => [r.name, r.decrypted_secret]));
  webpush.setVapidDetails(COLABORADOR, segredos.metallo_vapid_publica, segredos.metallo_vapid_privada);
  return segredos;
}
const igual = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
type Destino = { sub_id: string; endpoint: string; p256dh: string; auth: string };

async function mandar(d: Destino, msg: { title: string; body: string; url: string; tag: string }, urgente: boolean) {
  try {
    await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(msg),
      { TTL: urgente ? 3600 : 24 * 3600, urgency: urgente ? "high" : "normal" });
    await sql.unsafe(`update private.push_funcionario_3u set last_ok_at = now(), fail_count = 0 where id = $1::text::bigint`, [d.sub_id]);
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await sql.unsafe(`delete from private.push_funcionario_3u where id = $1::text::bigint`, [d.sub_id]);
    else await sql.unsafe(`update private.push_funcionario_3u set fail_count = fail_count + 1 where id = $1::text::bigint`, [d.sub_id]);
    return false;
  }
}

async function agendado() {
  const [{ novos }] = await sql.unsafe(`select private.coletar_avisos_3u() novos`) as unknown as { novos: number }[];
  const [{ lembretes }] = await sql.unsafe(`select private.lembretes_ponto_3u() lembretes`) as unknown as { lembretes: number }[];
  const lista = await sql.unsafe(`select aviso_id::text aviso_id, sub_id::text sub_id, endpoint, p256dh, auth, titulo, corpo, url, tipo
    from private.avisos_para_enviar_3u()`) as unknown as (Destino & { aviso_id: string; titulo: string; corpo: string; url: string; tipo: string })[];
  const resultado = new Map<string, boolean>();
  for (const a of lista) {
    const ok = await mandar(a, { title: a.titulo, body: a.corpo, url: a.url, tag: a.tipo === "PONTO" ? "metallo-ponto" : `metallo-${a.aviso_id}` }, a.tipo === "PONTO");
    resultado.set(a.aviso_id, (resultado.get(a.aviso_id) ?? false) || ok);
  }
  let enviados = 0, falhas = 0;
  for (const [id, ok] of resultado) {
    if (ok) { enviados++; await sql.unsafe(`update private.avisos_funcionario_3u set enviado_em = now() where id = $1::text::bigint`, [id]); }
    else { falhas++; await sql.unsafe(`update private.avisos_funcionario_3u set tentativas = tentativas + 1 where id = $1::text::bigint`, [id]); }
  }
  return { novos, lembretes, enviados, falhas };
}

async function teste(token: string) {
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new Error("authentication_required");
  const lista = await sql.unsafe(`select s.id::text sub_id, s.endpoint, s.p256dh, s.auth from private.push_funcionario_3u s
    join private.employee_identity i on i.auth_user_id = s.auth_user_id and i.employee_id = s.employee_id and i.status = 'active'
    where s.auth_user_id = $1::text::uuid`, [data.user.id]) as unknown as Destino[];
  if (!lista.length) throw new Error("sem_aparelho");
  let enviados = 0;
  for (const d of lista) if (await mandar(d, { title: "Metallo", body: "Pronto! Os avisos estão chegando neste celular.", url: "/colaborador/inicio", tag: "metallo-teste" }, true)) enviados++;
  return { enviados };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = origin === COLABORADOR ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
  if (req.method === "OPTIONS") return new Response(null, { status: origin === COLABORADOR ? 204 : 403, headers: { ...cors,
    "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" } });
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST") return answer({ ok: false }, 405);
    const body = await req.json().catch(() => ({})) as { acao?: string };
    const s = await vault();
    if (body.acao === "agendado") {
      const recebido = req.headers.get("x-metallo-cron") ?? "";
      if (!s.metallo_cron_ponto || !igual(recebido, s.metallo_cron_ponto)) return answer({ ok: false, error: "nao_autorizado" }, 401);
      return answer({ ok: true, ...(await agendado()) });
    }
    if (body.acao === "teste") {
      if (origin !== COLABORADOR) return answer({ ok: false, error: "origem_invalida" }, 403);
      const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
      return answer({ ok: true, ...(await teste(token)) });
    }
    return answer({ ok: false, error: "pedido_invalido" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const code = ["authentication_required", "sem_aparelho"].includes(m) ? m : "falha";
    if (code === "falha") console.error("avisos-funcionario falhou");
    return answer({ ok: false, error: code }, code === "authentication_required" ? 401 : 400);
  }
});
