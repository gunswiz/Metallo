// Marco 3P (TESTE ONLINE): aviso no celular lembrando o consumo do dia.
// "agendado": chamado pelo pg_cron com o segredo do Vault no cabeçalho. "teste": a própria pessoa testa o aviso no aparelho.
// Chaves VAPID ficam no Vault; não registra endereço do aparelho, token nem dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import webpush from "npm:web-push@3.6.7";

const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(url).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";

type Assinatura = { id: string; endpoint: string; p256dh: string; auth: string; equipes?: string[] };
let segredos: Record<string, string> | null = null;
async function vault() {
  if (segredos) return segredos;
  const rows = await sql.unsafe(`select name, decrypted_secret from vault.decrypted_secrets
    where name in ('metallo_vapid_privada','metallo_vapid_publica','metallo_cron_lembrete')`) as unknown as { name: string; decrypted_secret: string }[];
  segredos = Object.fromEntries(rows.map(r => [r.name, r.decrypted_secret]));
  webpush.setVapidDetails(GESTAO, segredos.metallo_vapid_publica, segredos.metallo_vapid_privada);
  return segredos;
}
const igual = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

async function enviar(lista: Assinatura[], mensagem: (a: Assinatura) => { title: string; body: string; url: string }) {
  let ok = 0, falhas = 0;
  for (const a of lista) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(mensagem(a)), { TTL: 6 * 3600, urgency: "normal" });
      ok++;
      await sql.unsafe(`update private.push_subscriptions_3p set last_ok_at = now(), fail_count = 0 where id = $1::text::bigint`, [a.id]);
    } catch (e) {
      falhas++;
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql.unsafe(`delete from private.push_subscriptions_3p where id = $1::text::bigint`, [a.id]);
      else await sql.unsafe(`update private.push_subscriptions_3p set fail_count = fail_count + 1 where id = $1::text::bigint`, [a.id]);
    }
  }
  return { enviados: ok, falhas };
}

async function agendado() {
  const lista = await sql.unsafe(`
    select s.id::text id, s.endpoint, s.p256dh, s.auth, array_agg(e.team_name order by e.team_name) equipes
    from private.push_subscriptions_3p s
    join private.equipes_sem_consumo_hoje_3p() e on private.pode_lancar_consumo_3p(s.user_id, e.team_id)
    group by s.id`) as unknown as Assinatura[];
  return enviar(lista, a => ({ title: "Consumo de hoje",
    body: `Ainda falta lançar o consumo de hoje: ${(a.equipes ?? []).slice(0, 4).join(", ")}${(a.equipes ?? []).length > 4 ? " e outras" : ""}.`,
    url: "/lancar/consumo" }));
}

async function teste(token: string) {
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new Error("authentication_required");
  const lista = await sql.unsafe(`select id::text id, endpoint, p256dh, auth from private.push_subscriptions_3p where user_id = $1::text::uuid`,
    [data.user.id]) as unknown as Assinatura[];
  if (!lista.length) throw new Error("sem_aparelho");
  return enviar(lista, () => ({ title: "Metallo", body: "Pronto! Os avisos estão chegando neste aparelho.", url: "/dashboard" }));
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors: Record<string, string> = origin === GESTAO ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
  if (req.method === "OPTIONS") return new Response(null, { status: origin === GESTAO ? 204 : 403, headers: { ...cors,
    "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" } });
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST") return answer({ ok: false }, 405);
    const body = await req.json().catch(() => ({})) as { acao?: string };
    const s = await vault();
    if (body.acao === "agendado") {
      const recebido = req.headers.get("x-metallo-cron") ?? "";
      if (!s.metallo_cron_lembrete || !igual(recebido, s.metallo_cron_lembrete)) return answer({ ok: false, error: "nao_autorizado" }, 401);
      return answer({ ok: true, ...(await agendado()) });
    }
    if (body.acao === "teste") {
      const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
      return answer({ ok: true, ...(await teste(token)) });
    }
    return answer({ ok: false, error: "pedido_invalido" }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const code = ["authentication_required", "sem_aparelho"].includes(m) ? m : "falha";
    if (code === "falha") console.error("lembrete-consumo falhou");
    return answer({ ok: false, error: code }, code === "authentication_required" ? 401 : 400);
  }
});
