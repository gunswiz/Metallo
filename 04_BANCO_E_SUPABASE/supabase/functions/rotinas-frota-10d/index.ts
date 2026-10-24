// Marco 10D (TESTE ONLINE): rotinas da frota chamadas pelo pg_cron com o segredo do Vault no cabeçalho.
// "avisos": de manhã (seg–sáb), avisa a Gestão: caminhão sem checklist, documento e preventiva vencidos/vencendo.
// "limpeza": apaga fotos da frota pelos prazos combinados. DESLIGADA: não faz nada enquanto `ativo` for falso
// em private.frota_retencao_10d (e não há agendamento para ela até o engenheiro dizer os prazos).
// Chaves VAPID ficam no Vault; não registra endereço do aparelho, token nem dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import webpush from "npm:web-push@3.6.7";

const URL_SB = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(URL_SB).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const servidor = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";

type Assinatura = { id: string; endpoint: string; p256dh: string; auth: string };
const igual = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

async function segredos() {
  const rows = await sql.unsafe(`select name, decrypted_secret from vault.decrypted_secrets
    where name in ('metallo_vapid_privada','metallo_vapid_publica','metallo_cron_lembrete')`) as unknown as { name: string; decrypted_secret: string }[];
  const s = Object.fromEntries(rows.map(r => [r.name, r.decrypted_secret]));
  if (s.metallo_vapid_publica && s.metallo_vapid_privada) webpush.setVapidDetails(GESTAO, s.metallo_vapid_publica, s.metallo_vapid_privada);
  return s;
}

async function avisos() {
  const segunda = new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", weekday: "short" }).format(new Date()) === "Mon";
  // Sem ninguém com o celular ligado, não marca nada como avisado (quem ligar depois recebe).
  const lista = await sql.unsafe(`select id::text id, endpoint, p256dh, auth from private.destinos_alertas_5c()`) as unknown as Assinatura[];
  if (!lista.length) return { enviados: 0, falhas: 0, sem_aparelho: true };
  const [{ aviso }] = await sql.unsafe(`select private.aviso_frota_10d($1::text::boolean) aviso`, [String(segunda)]) as unknown as { aviso: { title: string; body: string; url: string } | null }[];
  if (!aviso) return { enviados: 0, falhas: 0, sem_novidade: true };
  let enviados = 0, falhas = 0;
  for (const a of lista) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(aviso), { TTL: 6 * 3600, urgency: "normal" });
      enviados++;
    } catch (e) {
      falhas++;
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) await sql.unsafe(`delete from private.push_subscriptions_3p where id = $1::text::bigint`, [a.id]);
    }
  }
  return { enviados, falhas };
}

async function limpeza() {
  const [cfg] = await sql.unsafe(`select ativo from private.frota_retencao_10d where singleton`) as unknown as { ativo: boolean }[];
  if (!cfg?.ativo) return { ativo: false, apagadas: 0 };
  const lista = await sql.unsafe(`select id::text id, caminho from private.fotos_expiradas_10d()`) as unknown as { id: string; caminho: string }[];
  let apagadas = 0, falhas = 0;
  for (const f of lista) {
    const r = await servidor.storage.from("frota-10b").remove([f.caminho]);
    if (r.error) { falhas++; continue; }
    await sql.unsafe(`select private.esquecer_foto_10d($1::text::uuid)`, [f.id]);
    apagadas++;
  }
  return { ativo: true, apagadas, falhas };
}

Deno.serve(async (req) => {
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST") return answer({ ok: false }, 405);
    const body = await req.json().catch(() => ({})) as { acao?: string };
    const s = await segredos();
    const recebido = req.headers.get("x-metallo-cron") ?? "";
    if (!s.metallo_cron_lembrete || !igual(recebido, s.metallo_cron_lembrete)) return answer({ ok: false, error: "nao_autorizado" }, 401);
    if (body.acao === "avisos") return answer({ ok: true, ...(await avisos()) });
    if (body.acao === "limpeza") return answer({ ok: true, ...(await limpeza()) });
    return answer({ ok: false, error: "pedido_invalido" }, 400);
  } catch {
    console.error("rotinas-frota-10d falhou");
    return answer({ ok: false, error: "falha" }, 500);
  }
});
