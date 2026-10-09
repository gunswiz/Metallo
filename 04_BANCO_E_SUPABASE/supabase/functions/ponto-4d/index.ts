// Marco 4D (TESTE ONLINE, dados fictícios): servidor do Meu Ponto. Mesmo contrato HTTP do servidor local 4A/4B
// (clock, begin, events, intent, list, last48, receipt, authorize), agora sobre o schema "ponto" do Postgres.
// Chamado SOMENTE pelo Worker do Colaborador de teste (rotas /api/ponto-online e /api/ponto-registros) e pela Gestão de teste.
// Não registra token, localização ou dado pessoal em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { Buffer } from "node:buffer";

const COLABORADOR = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const TZ = "America/Fortaleza";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Pooler em modo transação (Supavisor): o banco do plano grátis aceita só 60 conexões diretas.
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(Deno.env.get("SUPABASE_URL")!).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 3, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

class Falha extends Error { constructor(public status: number, public code: string) { super(code); } }
const STATUS: Record<string, number> = { SESSAO_INVALIDA: 401, SESSAO_ENCERRADA: 401, CONTEXTO_INATIVO: 403, ACESSO_NAO_AUTORIZADO: 403,
  INTENCAO_NAO_AUTORIZADA: 403, INTENCAO_CONFLITANTE: 409, INTENCAO_EXPIRADA: 409, PEDIDO_INVALIDO: 400, PERIODO_INVALIDO: 400,
  REGISTRO_NAO_ENCONTRADO: 404, SEM_REGISTROS_48H: 404, EXTRACAO_MUITO_EXTENSA: 413, ORIGINAL_IMUTAVEL: 409,
  CPF_NAO_CADASTRADO: 409, EMPREGADOR_NAO_CADASTRADO: 409 };
const q = <T>(tx: postgres.Sql | postgres.TransactionSql, text: string, params: (string | null)[] = []) =>
  tx.unsafe(text, params) as unknown as Promise<T[]>;

type Pessoa = { user: string; session: string };
async function pessoa(token: string): Promise<Pessoa> {
  if (!token || token.length > 8192) throw new Falha(401, "SESSAO_INVALIDA");
  const user = await auth.auth.getUser(token);
  if (user.error || !user.data.user?.id) throw new Falha(401, "SESSAO_INVALIDA");
  let claims: { sub?: string; session_id?: string };
  try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { throw new Falha(401, "SESSAO_INVALIDA"); }
  if (claims.sub !== user.data.user.id || !claims.session_id || !UUID.test(claims.session_id)) throw new Falha(401, "SESSAO_INVALIDA");
  return { user: user.data.user.id, session: claims.session_id };
}

// Localização: mesma normalização do 4A (navegador não expõe sinal confiável de GPS falso).
function normalizeLocation(value: unknown) {
  const empty = (status: string) => ({ status, latitude: null, longitude: null, accuracy_meters: null, captured_at: null, provider: "BROWSER_GEOLOCATION", mock_signal: "NOT_EXPOSED" });
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty("UNKNOWN");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["status", "latitude", "longitude", "accuracy_meters", "captured_at"].includes(k))) throw new Falha(400, "PEDIDO_INVALIDO");
  if (["DENIED", "UNAVAILABLE", "TIMEOUT", "UNKNOWN"].includes(v.status as string)) return empty(v.status as string);
  if (!["AVAILABLE", "LOW_ACCURACY"].includes(v.status as string)) return empty("UNKNOWN");
  const { latitude: lat, longitude: lon, accuracy_meters: acc, captured_at: at } = v;
  if (![lat, lon, acc].every(n => typeof n === "number" && Number.isFinite(n)) || Math.abs(lat as number) > 90 || Math.abs(lon as number) > 180 ||
    (acc as number) < 0 || typeof at !== "string" || !/^\d{4}-\d\d-\d\dT/.test(at) || !Number.isFinite(Date.parse(at))) return empty("UNKNOWN");
  return { ...empty((acc as number) > 100 ? "LOW_ACCURACY" : "AVAILABLE"), latitude: lat, longitude: lon, accuracy_meters: acc, captured_at: new Date(at).toISOString() };
}

type Marcacao = { nsr: string; event_id: string; employee_name: string; employee_code: string | null; employee_id: string;
  marking_at: Date; recorded_at: Date; timezone: string; collector: string; location: { status: string; accuracy_meters: number | null }; payload_hash: string };
const iso = (d: Date | string) => new Date(d).toISOString();
const recibo = (m: Marcacao) => ({ event_id: m.event_id, synthetic_reference: `TESTE-4D-${m.nsr}`, marking_at: iso(m.marking_at), recorded_at: iso(m.recorded_at),
  timezone: TZ, collector: "BROWSER", online: true, location_status: m.location.status, accuracy_meters: m.location.accuracy_meters ?? null });
const registro = (m: Marcacao) => ({ event_id: m.event_id, reference: `TESTE-4D-${m.nsr}`, marking_at: iso(m.marking_at), recorded_at: iso(m.recorded_at),
  timezone: TZ, historical_data: "LIMITED", source: "4D", nsr: Number(m.nsr), payload_hash: m.payload_hash,
  employee_name: m.employee_name, employee_code: m.employee_code });
const colunas = `nsr::text nsr,event_id::text event_id,employee_id::text employee_id,employee_name,employee_code,marking_at,recorded_at,timezone,collector,location,payload_hash`;

// Toda leitura/escrita pessoal confere o vínculo no começo E no fim da mesma transação.
function pessoal<T>(p: Pessoa, run: (tx: postgres.TransactionSql) => Promise<T>) {
  return sql.begin(async tx => {
    await q(tx, "select ponto.ator($1::text::uuid,$2::text::uuid)", [p.user, p.session]);
    const value = await run(tx);
    await q(tx, "select ponto.ator($1::text::uuid,$2::text::uuid)", [p.user, p.session]);
    return value;
  }) as Promise<T>;
}
function corpo(raw: string, keys: string[]) {
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { throw new Falha(400, "PEDIDO_INVALIDO"); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join() !== [...keys].sort().join()) throw new Falha(400, "PEDIDO_INVALIDO");
  return body;
}
async function janela(tx: postgres.TransactionSql, f: { period: string; from?: string; to?: string }) {
  const [{ now, today }] = await q<{ now: Date; today: string }>(tx, "select clock_timestamp() now,(clock_timestamp() at time zone 'America/Fortaleza')::date::text today");
  const end = iso(now);
  if (f.period === "48h") return { start: iso(new Date(new Date(now).getTime() - 48 * 3600000)), end };
  if (f.period === "custom") return { start: iso(`${f.from}T00:00:00-03:00`), end: iso(new Date(Date.parse(`${f.to}T00:00:00-03:00`) + 86400000 - 1)) };
  const back = f.period === "7d" ? 6 : f.period === "30d" ? 29 : f.period === "60d" ? 59 : 0;
  return { start: iso(new Date(Date.parse(`${today}T00:00:00-03:00`) - back * 86400000)), end };
}
function filtro(raw: string) {
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { throw new Falha(400, "PEDIDO_INVALIDO"); }
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !["period", "from", "to", "offset"].includes(k))) throw new Falha(400, "PEDIDO_INVALIDO");
  const offset = input.offset ?? 0;
  if (!["today", "48h", "7d", "30d", "60d", "custom"].includes(input.period as string) || !Number.isInteger(offset) || (offset as number) < 0 || (offset as number) > 100000) throw new Falha(400, "PEDIDO_INVALIDO");
  if (input.period === "custom") {
    for (const v of [input.from, input.to]) if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || iso(v).slice(0, 10) !== v) throw new Falha(400, "PERIODO_INVALIDO");
    const days = (Date.parse(input.to as string) - Date.parse(input.from as string)) / 86400000;
    if (days < 0 || days > 365) throw new Falha(400, "PERIODO_INVALIDO");
  } else if ("from" in input || "to" in input) throw new Falha(400, "PEDIDO_INVALIDO");
  return { period: input.period as string, from: input.from as string | undefined, to: input.to as string | undefined, offset: offset as number };
}

// Marco 4E (espelho de ponto): mês "AAAA-MM" no fuso de Fortaleza. Só leitura dos originais.
function mes(raw: string) {
  const month = corpo(raw, ["month"]).month;
  if (typeof month !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) throw new Falha(400, "PERIODO_INVALIDO");
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: iso(`${month}-01T00:00:00-03:00`), end: iso(`${next}-01T00:00:00-03:00`) };
}
const espelhoItem = (m: Marcacao) => ({ event_id: m.event_id, nsr: Number(m.nsr), employee_id: m.employee_id, employee_name: m.employee_name,
  employee_code: m.employee_code, marking_at: iso(m.marking_at), recorded_at: iso(m.recorded_at) });

async function gestorAtivo(tx: postgres.TransactionSql, p: Pessoa) {
  await q(tx, "select pg_catalog.set_config('request.jwt.claim.sub',$1::text,true)", [p.user]);
  const [ok] = await q<{ admin: boolean; sessao: boolean }>(tx, `select public.is_active_admin() admin,
    exists(select 1 from auth.sessions s where s.id=$1::text::uuid and s.user_id=$2::text::uuid and (s.not_after is null or s.not_after>now())) sessao`, [p.session, p.user]);
  if (!ok.admin || !ok.sessao) throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
}

// Marco 4F — AFD (leiaute v004, REP-P), PRÉVIA sem valor oficial: falta registro no INPI e assinatura .p7s (CAdES ICP-Brasil).
function crc16Kermit(texto: string) {
  let crc = 0;
  // Bytes em ISO-8859-1 (como o arquivo é gravado); caractere fora da tabela vira "?".
  for (const ch of texto) { const code = ch.codePointAt(0)!; crc ^= code < 256 ? code : 63; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1; }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const A = (v: string | null | undefined, n: number) => [...(v ?? "")].map(c => (c.codePointAt(0)! < 256 ? c : "?")).join("").slice(0, n).padEnd(n, " ");
const N = (v: string | number | null | undefined, n: number) => String(v ?? "").replace(/\D/g, "").slice(-n).padStart(n, "0");
function dhAgora() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00-0300`;
}
function periodoAfd(raw: string) {
  const b = corpo(raw, ["from", "to"]);
  for (const v of [b.from, b.to]) if (typeof v !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(v) || iso(`${v}T12:00:00Z`).slice(0, 10) !== v) throw new Falha(400, "PERIODO_INVALIDO");
  const dias = (Date.parse(b.to as string) - Date.parse(b.from as string)) / 86400000;
  if (dias < 0 || dias > 366) throw new Falha(400, "PERIODO_INVALIDO");
  return { from: b.from as string, to: b.to as string, start: iso(`${b.from}T00:00:00-03:00`), end: iso(new Date(Date.parse(`${b.to}T00:00:00-03:00`) + 86400000)) };
}
type Empregador = { tipo_documento: number; documento: string; cno_caepf: string | null; razao_social: string; inpi: string | null; desenvolvedor_documento: string | null };
async function gerarAfd(tx: postgres.TransactionSql, w: ReturnType<typeof periodoAfd>) {
  const [emp] = await q<Empregador>(tx, "select tipo_documento,documento,cno_caepf,razao_social,inpi,desenvolvedor_documento from private.empregador_4f where singleton");
  if (!emp) throw new Falha(409, "EMPREGADOR_NAO_CADASTRADO");
  const linhas7 = await q<{ nsr: string; linha: string; afd_hash: string }>(tx, `select m.nsr::text nsr, ponto.afd_linha7(m) linha, m.afd_hash from ponto.marcacao m
    where m.afd_hash is not null and m.marking_at>=$1::text::timestamptz and m.marking_at<$2::text::timestamptz order by m.nsr limit 200001`, [w.start, w.end]);
  if (linhas7.length > 200000) throw new Falha(413, "EXTRACAO_MUITO_EXTENSA");
  const [semCpf] = await q<{ n: string }>(tx, `select count(*)::text n from ponto.marcacao where afd_hash is null and marking_at>=$1::text::timestamptz and marking_at<$2::text::timestamptz`, [w.start, w.end]);
  const dev = emp.desenvolvedor_documento ?? "";
  const cab = "000000000" + "1" + String(emp.tipo_documento) + A(emp.documento, 14) + (emp.cno_caepf ? N(emp.cno_caepf, 14) : A("", 14)) + A(emp.razao_social, 150)
    + N(emp.inpi ?? "", 17) + w.from + w.to + dhAgora() + "004" + (dev.length === 11 ? "2" : "1") + A(dev, 14) + A("", 30);
  // Marco 4I: cadastros da empresa (tipo 2) e dos funcionários (tipo 5) gravados no período, na mesma numeração.
  const cadastros = await q<{ nsr: string; tipo: number; linha: string; crc: string }>(tx, `select nsr::text nsr, tipo, linha, crc from ponto.evento_afd
    where recorded_at>=$1::text::timestamptz and recorded_at<$2::text::timestamptz order by nsr limit 200001`, [w.start, w.end]);
  const corpoAfd = [...cadastros.map(e => ({ nsr: Number(e.nsr), texto: e.linha + e.crc })), ...linhas7.map(l => ({ nsr: Number(l.nsr), texto: l.linha + l.afd_hash }))]
    .sort((a, b) => a.nsr - b.nsr).map(r => r.texto);
  const qt = (t: number) => N(cadastros.filter(e => Number(e.tipo) === t).length, 9);
  const linhas = [cab + crc16Kermit(cab), ...corpoAfd,
    "999999999" + qt(2) + N(0, 9) + N(0, 9) + qt(5) + N(0, 9) + N(linhas7.length, 9) + "9", "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S".padEnd(100, " ")];
  return { filename: `AFD${N(emp.inpi ?? "", 17)}${N(emp.documento, 14)}REP_P.txt`, content: linhas.join("\r\n") + "\r\n",
    registros: linhas7.length, cadastros: cadastros.length, sem_cpf: Number(semCpf.n), inpi_registrado: Boolean(emp.inpi) };
}

// Marco 4G — AEJ (leiaute v002), PRÉVIA: marcações com entrada/saída, horário contratual da empresa e identificação do programa.
// Registro 07 (Marco 4H): domingos (DSR), faltas não justificadas e folgas no lugar de feriado lançadas pela Gestão. Banco de horas ainda não.
const fmtFort = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
function partesFort(d: Date) { const p = fmtFort.formatToParts(d); const g = (t: string) => p.find(x => x.type === t)!.value;
  return { dia: `${g("year")}-${g("month")}-${g("day")}`, dh: `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00-0300`,
    semana: String(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday")) + 1) }; }
const campo = (v: string | number | null | undefined) => String(v ?? "").replace(/[|\r\n]/g, " ");
const linha = (...campos: (string | number | null | undefined)[]) => campos.map(campo).join("|");
async function gerarAej(tx: postgres.TransactionSql, w: ReturnType<typeof periodoAfd>) {
  const [emp] = await q<Empregador & { desenvolvedor_email: string | null }>(tx, "select tipo_documento,documento,cno_caepf,razao_social,inpi,desenvolvedor_documento,desenvolvedor_email from private.empregador_4f where singleton");
  if (!emp) throw new Falha(409, "EMPREGADOR_NAO_CADASTRADO");
  const [jor] = await q<{ dias: Record<string, string[]> }>(tx, "select dias from private.jornada_4g where singleton");
  const dias = jor?.dias ?? {};
  const marcas = await q<{ employee_id: string; employee_name: string; employee_cpf: string; marking_at: Date }>(tx, `select employee_id::text employee_id, employee_name, employee_cpf, marking_at
    from ponto.marcacao where afd_hash is not null and marking_at>=$1::text::timestamptz and marking_at<$2::text::timestamptz order by employee_name, employee_id, marking_at, nsr limit 200001`, [w.start, w.end]);
  if (marcas.length > 200000) throw new Falha(413, "EXTRACAO_MUITO_EXTENSA");
  // Horários contratuais: um código por horário diferente da semana (ex.: seg–qui e sexta).
  const codigos = new Map<string, string>(), reg04: string[] = [];
  const hhmm = (h: string) => h.replace(":", "");
  const codigoDoDia = (semana: string) => {
    const h = dias[semana] ?? [];
    const chave = h.length ? h.join(",") : "SEM_JORNADA";
    if (!codigos.has(chave)) {
      const cod = h.length ? `HC${codigos.size + 1}` : "SEM_JORNADA";
      codigos.set(chave, cod);
      let dur = 0; for (let i = 0; i + 1 < h.length; i += 2) dur += (Number(h[i + 1].slice(0, 2)) * 60 + Number(h[i + 1].slice(3))) - (Number(h[i].slice(0, 2)) * 60 + Number(h[i].slice(3)));
      reg04.push(linha("04", cod, dur, ...(h.length ? h.map(hhmm) : ["0000", "0000"])));
    }
    return codigos.get(chave)!;
  };
  for (let d = 1; d <= 7; d++) if ((dias[String(d)] ?? []).length) codigoDoDia(String(d));
  const vinculos = new Map<string, number>(), reg03: string[] = [], reg05: string[] = [], reg07: string[] = [];
  const vinculo = (id: string, cpf: string, nome: string) => { if (!vinculos.has(id)) { vinculos.set(id, vinculos.size + 1); reg03.push(linha("03", vinculos.size, cpf, nome)); } return vinculos.get(id)!; };
  const ocorr = await q<{ employee_id: string; full_name: string; cpf: string; data: string; tipo: string }>(tx, `select o.employee_id::text employee_id, e.full_name, c.cpf, o.data::text data, o.tipo
    from private.ocorrencias_ponto_4h o join public.epi_employees e on e.id = o.employee_id join private.employee_cpf_4f c on c.employee_id = o.employee_id
    where o.cancelled_at is null and o.data between $1::text::date and $2::text::date and o.tipo in ('falta', 'folga_feriado') order by e.full_name, o.data`, [w.from, w.to]);
  let atual = "", seqDia = 0;
  for (const m of marcas) {
    vinculo(m.employee_id, m.employee_cpf, m.employee_name);
    const p = partesFort(new Date(m.marking_at)), chave = `${m.employee_id}|${p.dia}`;
    if (chave !== atual) { atual = chave; seqDia = 0; }
    const tp = seqDia % 2 === 0 ? "E" : "S", seq = Math.floor(seqDia / 2) + 1;
    reg05.push(linha("05", vinculos.get(m.employee_id), p.dh, 1, tp, String(seq).padStart(3, "0"), "O", tp === "E" && seq === 1 ? codigoDoDia(p.semana) : "", ""));
    seqDia++;
  }
  for (const o of ocorr) vinculo(o.employee_id, o.cpf, o.full_name);
  // DSR: domingos do período, para cada vínculo. Depois as faltas (2) e folgas no lugar de feriado (4).
  const domingos: string[] = [];
  for (let t = Date.parse(`${w.from}T12:00:00Z`); t <= Date.parse(`${w.to}T12:00:00Z`); t += 86400000) if (new Date(t).getUTCDay() === 0) domingos.push(new Date(t).toISOString().slice(0, 10));
  for (const [id, n] of vinculos) {
    const eventos = [...domingos.map(d => ({ d, t: 1 })), ...ocorr.filter(o => o.employee_id === id).map(o => ({ d: o.data, t: o.tipo === "falta" ? 2 : 4 }))].sort((a, b) => a.d.localeCompare(b.d) || a.t - b.t);
    for (const e of eventos) reg07.push(linha("07", n, e.t, e.d, "", ""));
  }
  const cnoCaepf = emp.cno_caepf ?? "";
  const dev = emp.desenvolvedor_documento ?? "";
  const linhas = [
    linha("01", emp.tipo_documento, emp.documento, cnoCaepf.length === 14 ? cnoCaepf : "", cnoCaepf.length === 12 ? cnoCaepf : "", emp.razao_social, w.from, w.to, dhAgora(), "002"),
    linha("02", 1, 3, N(emp.inpi ?? "", 17)), ...reg03, ...reg04, ...reg05, ...reg07,
    linha("08", "Metallo - ponto (previa de teste)", "0.4G", dev.length === 11 ? 2 : 1, dev, dev && dev === emp.documento ? emp.razao_social : "Desenvolvedor nao informado", emp.desenvolvedor_email ?? ""),
    linha("99", 1, 1, reg03.length, reg04.length, reg05.length, 0, reg07.length, 1),
    "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S".padEnd(100, " "),
  ].map(l => [...l].map(c => (c.codePointAt(0)! < 256 ? c : "?")).join(""));
  return { filename: `AEJ_${N(emp.documento, 14)}_${w.from.replace(/-/g, "")}_${w.to.replace(/-/g, "")}.txt`, content: linhas.join("\r\n") + "\r\n",
    vinculos: reg03.length, marcacoes: reg05.length, ausencias: reg07.length };
}

async function rota(method: string, path: string, raw: string, token: string, origin: string | null) {
  if (path === "/gestao/aej") {
    if (origin !== GESTAO || method !== "POST") throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
    const w = periodoAfd(raw);
    const p = await pessoa(token);
    return sql.begin(async tx => { await gestorAtivo(tx, p); return { status: 200, body: await gerarAej(tx, w) }; });
  }
  if (path === "/gestao/afd") {
    if (origin !== GESTAO || method !== "POST") throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
    const w = periodoAfd(raw);
    const p = await pessoa(token);
    return sql.begin(async tx => { await gestorAtivo(tx, p); return { status: 200, body: await gerarAfd(tx, w) }; });
  }
  if (path === "/gestao/espelho") {
    if (origin !== GESTAO || method !== "POST") throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
    const w = mes(raw);
    const p = await pessoa(token);
    return sql.begin(async tx => {
      await gestorAtivo(tx, p);
      const rows = await q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where marking_at>=$1::text::timestamptz and marking_at<$2::text::timestamptz
        order by employee_name, marking_at, nsr limit 20001`, [w.start, w.end]);
      if (rows.length > 20000) throw new Falha(413, "EXTRACAO_MUITO_EXTENSA");
      return { status: 200, body: { events: rows.map(espelhoItem), window: w } };
    });
  }
  if (path === "/gestao") {
    if (origin !== GESTAO || method !== "GET") throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
    const p = await pessoa(token);
    return sql.begin(async tx => {
      await q(tx, "select pg_catalog.set_config('request.jwt.claim.sub',$1::text,true)", [p.user]);
      const [ok] = await q<{ admin: boolean; sessao: boolean }>(tx, `select public.is_active_admin() admin,
        exists(select 1 from auth.sessions s where s.id=$1::text::uuid and s.user_id=$2::text::uuid and (s.not_after is null or s.not_after>now())) sessao`, [p.session, p.user]);
      if (!ok.admin || !ok.sessao) throw new Falha(403, "ACESSO_NAO_AUTORIZADO");
      const rows = await q<Marcacao>(tx, `select ${colunas} from ponto.marcacao order by marking_at desc, nsr desc limit 100`);
      const [integridade] = await q<{ ok: boolean; total: string; motivo: string | null }>(tx, "select ok,total::text total,motivo from ponto.verificar()");
      return { status: 200, body: { events: rows.map(m => ({ ...recibo(m), employee_name: m.employee_name })), integrity: { ok: integridade.ok, total: Number(integridade.total), reason: integridade.motivo } } };
    });
  }
  if (origin !== COLABORADOR) throw new Falha(403, "ORIGEM_INVALIDA");
  const p = await pessoa(token);
  if (method === "GET" && path === "/v4a/clock") {
    const [row] = await q<{ at: Date }>(sql, "select clock_timestamp() at");
    return { status: 200, body: { server_at: iso(row.at), timezone: TZ, source: "SERVIDOR_TESTE_ONLINE", hlb_verified: false } };
  }
  if (method === "POST" && path === "/v4a/begin") {
    const key = corpo(raw, ["idempotency_key"]).idempotency_key as string;
    if (!UUID.test(key ?? "")) throw new Falha(400, "PEDIDO_INVALIDO");
    const [row] = await q<{ idempotency_key: string; marking_at: Date }>(sql,
      "select idempotency_key::text idempotency_key,marking_at from ponto.iniciar($1::text::uuid,$2::text::uuid,$3::text::uuid)", [p.user, p.session, key]);
    return { status: 200, body: { idempotency_key: row.idempotency_key, marking_at: iso(row.marking_at), timezone: TZ } };
  }
  if (method === "POST" && path === "/v4a/events") {
    const body = corpo(raw, ["idempotency_key", "location"]);
    if (!UUID.test((body.idempotency_key as string) ?? "")) throw new Falha(400, "PEDIDO_INVALIDO");
    const location = normalizeLocation(body.location);
    const [row] = await q<Marcacao & { duplicate: boolean }>(sql, `select (r.marcacao).nsr::text nsr,(r.marcacao).event_id::text event_id,(r.marcacao).employee_id::text employee_id,
      (r.marcacao).employee_name employee_name,(r.marcacao).employee_code employee_code,(r.marcacao).marking_at marking_at,(r.marcacao).recorded_at recorded_at,
      (r.marcacao).timezone timezone,(r.marcacao).collector collector,(r.marcacao).location location,(r.marcacao).payload_hash payload_hash,r.duplicate
      from ponto.registrar($1::text::uuid,$2::text::uuid,$3::text::uuid,$4::text::jsonb) r`, [p.user, p.session, body.idempotency_key as string, JSON.stringify(location)]);
    return { status: row.duplicate ? 200 : 201, body: { event: recibo(row), duplicate: row.duplicate } };
  }
  if (method === "GET" && path === "/v4a/events") {
    const rows = await pessoal(p, tx => q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where auth_user_id=$1::text::uuid order by marking_at desc limit 50`, [p.user]));
    return { status: 200, body: { events: rows.map(recibo) } };
  }
  const intent = path.match(/^\/v4a\/intent\/([0-9a-f-]{36})$/i);
  if (method === "GET" && intent) {
    if (!UUID.test(intent[1])) throw new Falha(400, "PEDIDO_INVALIDO");
    const rows = await pessoal(p, tx => q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where idempotency_key=$1::text::uuid and auth_user_id=$2::text::uuid`, [intent[1], p.user]));
    return rows[0] ? { status: 200, body: { event: recibo(rows[0]) } } : { status: 404, body: { status: "NAO_CONFIRMADO" } };
  }
  if (method === "POST" && path === "/v4b/list") {
    const f = filtro(raw);
    return pessoal(p, async tx => {
      const w = await janela(tx, f);
      const rows = await q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where auth_user_id=$1::text::uuid and marking_at>=$2::text::timestamptz and marking_at<=$3::text::timestamptz
        order by marking_at desc,event_id desc limit 21 offset $4::text::integer`, [p.user, w.start, w.end, String(f.offset)]);
      return { status: 200, body: { events: rows.slice(0, 20).map(registro), has_more: rows.length > 20, offset: f.offset, window: w } };
    });
  }
  if (method === "GET" && path === "/v4b/last48") {
    return pessoal(p, async tx => {
      const w = await janela(tx, { period: "48h" });
      const rows = await q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where auth_user_id=$1::text::uuid and marking_at>=$2::text::timestamptz and marking_at<=$3::text::timestamptz
        order by marking_at,event_id limit 501`, [p.user, w.start, w.end]);
      if (!rows.length) throw new Falha(404, "SEM_REGISTROS_48H");
      if (rows.length > 500) throw new Falha(413, "EXTRACAO_MUITO_EXTENSA");
      return { status: 200, body: { events: rows.map(registro), window: w } };
    });
  }
  const receipt = path.match(/^\/v4b\/receipt\/([0-9a-f-]{36})$/i);
  if (method === "GET" && receipt) {
    if (!UUID.test(receipt[1])) throw new Falha(400, "PEDIDO_INVALIDO");
    const rows = await pessoal(p, tx => q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where event_id=$1::text::uuid and auth_user_id=$2::text::uuid`, [receipt[1], p.user]));
    if (!rows[0]) throw new Falha(404, "REGISTRO_NAO_ENCONTRADO");
    return { status: 200, body: registro(rows[0]) };
  }
  if (method === "POST" && path === "/v4b/espelho") {
    const w = mes(raw);
    return pessoal(p, async tx => {
      const rows = await q<Marcacao>(tx, `select ${colunas} from ponto.marcacao where auth_user_id=$1::text::uuid and marking_at>=$2::text::timestamptz
        and marking_at<$3::text::timestamptz order by marking_at, nsr limit 1001`, [p.user, w.start, w.end]);
      if (rows.length > 1000) throw new Falha(413, "EXTRACAO_MUITO_EXTENSA");
      return { status: 200, body: { events: rows.map(espelhoItem), window: w } };
    });
  }
  if (method === "GET" && path === "/v4b/authorize") { await pessoal(p, async () => true); return { status: 200, body: { authorized: true } }; }
  throw new Falha(404, "ROTA_NAO_ENCONTRADA");
}

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
Deno.serve(async request => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/(functions\/v1\/)?ponto-4d/, "");
  try {
    if (url.search) throw new Falha(400, "PEDIDO_INVALIDO");
    const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
    if (!token) throw new Falha(401, "SESSAO_INVALIDA");
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (!Number.isFinite(declared) || declared > 2048) throw new Falha(413, "PEDIDO_INVALIDO");
    const raw = request.method === "POST" ? await request.text() : "";
    if (raw.length > 2048) throw new Falha(413, "PEDIDO_INVALIDO");
    if (request.method === "POST" && request.headers.get("content-type") !== "application/json") throw new Falha(415, "PEDIDO_INVALIDO");
    if (request.method === "GET" && raw) throw new Falha(400, "PEDIDO_INVALIDO");
    const result = await rota(request.method, path, raw, token, request.headers.get("origin"));
    return new Response(JSON.stringify(result.body), { status: result.status, headers });
  } catch (error) {
    let status = 503, code = "SERVIDOR_INDISPONIVEL";
    if (error instanceof Falha) { status = error.status; code = error.code; }
    else { const message = (error as { message?: string })?.message ?? ""; if (STATUS[message]) { status = STATUS[message]; code = message; } }
    return new Response(JSON.stringify({ error: code }), { status, headers });
  }
});
