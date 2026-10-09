// Marco 4J (TESTE ONLINE): hora oficial comprovada.
// Chamado só pelo pg_cron (a cada 10 min), com o segredo do Vault no cabeçalho. Compara o relógio do banco — que carimba
// cada marcação — com o NTP.br (NIC.br), que distribui a Hora Legal Brasileira do Observatório Nacional.
// O ambiente das Edge Functions não permite NTP (UDP), então a conferência usa o cabeçalho "Date" do site do NTP.br por HTTPS,
// com a técnica da "virada do segundo" (htpdate): várias consultas marcadas para cair na troca de segundo do servidor
// estreitam a diferença até poucos centésimos. O limite legal é 30 s (Portaria 671, Anexo IX, item 2).
import postgres from "npm:postgres@3.4.5";

const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(Deno.env.get("SUPABASE_URL")!).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });

const FONTES = [{ nome: "NTP.br (NIC.br) · https://ntp.br", url: "https://ntp.br/" }, { nome: "Registro.br (NIC.br) · https://registro.br", url: "https://registro.br/" }];
const espera = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));
const igual = (a: string, b: string) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

type Medida = { diferenca: number; incerteza: number; amostras: number; rtt: number };
// θ = hora da fonte − relógio local. Cada resposta diz: o servidor carimbou "Date" (segundo inteiro) em algum instante entre o envio e a chegada.
async function medir(url: string): Promise<Medida> {
  let lo = -Infinity, hi = Infinity, amostras = 0, rttMin = Infinity;
  const amostra = async () => {
    const t0 = Date.now();
    const r = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(4000) });
    const t1 = Date.now();
    await r.body?.cancel();
    const d = Date.parse(r.headers.get("date") ?? "");
    if (!Number.isFinite(d)) throw new Error("sem_date");
    amostras++; rttMin = Math.min(rttMin, t1 - t0);
    lo = Math.max(lo, d - t1); hi = Math.min(hi, d + 1000 - t0);
  };
  await amostra(); await amostra(); // a 1ª inclui o aperto de mão TLS
  for (let i = 0; i < 9 && hi - lo > rttMin + 20; i++) {
    const meio = (lo + hi) / 2;
    // Próxima virada de segundo da fonte, vista no relógio local, mirando o meio da ida e volta.
    let alvo = Math.ceil((Date.now() + meio + rttMin / 2 + 30) / 1000) * 1000 - meio - rttMin / 2;
    if (alvo - Date.now() < 20) alvo += 1000;
    await espera(alvo - Date.now());
    await amostra();
  }
  if (!(hi >= lo)) throw new Error("medida_incoerente");
  return { diferenca: (lo + hi) / 2, incerteza: (hi - lo) / 2, amostras, rtt: rttMin };
}

async function conferir() {
  let usada: { nome: string; m: Medida } | null = null;
  const tentativas: Record<string, unknown>[] = [];
  for (const f of FONTES) {
    try { const m = await medir(f.url); tentativas.push({ fonte: f.nome, ok: true, amostras: m.amostras, rtt_ms: m.rtt }); usada = { nome: f.nome, m }; break; }
    catch (e) { tentativas.push({ fonte: f.nome, ok: false, erro: e instanceof Error ? e.message.slice(0, 80) : "falha" }); }
  }
  // Relógio do banco − relógio local (consulta curta medida dos dois lados).
  let banco = Infinity, bancoInc = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const [row] = await sql.unsafe("select (extract(epoch from clock_timestamp()) * 1000)::float8 agora") as unknown as { agora: number }[];
    const t1 = Date.now();
    if ((t1 - t0) / 2 < bancoInc) { bancoInc = (t1 - t0) / 2; banco = Number(row.agora) - (t0 + t1) / 2; }
  }
  // Banco − hora oficial = (banco − local) − (oficial − local).
  const dif = usada ? Math.round(banco - usada.m.diferenca) : null;
  const inc = usada ? Math.ceil(bancoInc + usada.m.incerteza) : null;
  const detalhe = { tentativas, banco_menos_funcao_ms: Math.round(banco), funcao_menos_oficial_ms: usada ? Math.round(-usada.m.diferenca) : null };
  const [c] = await sql.unsafe(`select situacao, diferenca_ms, incerteza_ms from ponto.registrar_conferencia_hora($1, $2::text::integer, $3::text::integer, $4::text::jsonb)`,
    [usada?.nome ?? "Nenhuma fonte respondeu", dif === null ? null : String(dif), inc === null ? null : String(inc), JSON.stringify(detalhe)]) as unknown as Record<string, unknown>[];
  return c;
}

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  try {
    if (req.method !== "POST") return json({ ok: false }, 405);
    const body = await req.json().catch(() => ({})) as { acao?: string };
    const [s] = await sql.unsafe(`select decrypted_secret from vault.decrypted_secrets where name = 'metallo_cron_ponto'`) as unknown as { decrypted_secret: string }[];
    const recebido = req.headers.get("x-metallo-cron") ?? "";
    if (!s?.decrypted_secret || !igual(recebido, s.decrypted_secret)) return json({ ok: false, error: "nao_autorizado" }, 401);
    if (body.acao !== "conferir") return json({ ok: false, error: "pedido_invalido" }, 400);
    return json({ ok: true, ...(await conferir()) });
  } catch {
    console.error("hora-oficial falhou");
    return json({ ok: false, error: "falha" }, 500);
  }
});
