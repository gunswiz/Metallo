// Marcos 4J (hora oficial), 4K (ponto sem internet) e 3U (avisos do funcionário) no TESTE ONLINE.
// Contas FICTÍCIAS. Não imprime senha, token, CPF nem endereço de aparelho.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev", COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/ponto-4d`, AVISOS = `${BASE}/functions/v1/avisos-funcionario`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marcos 4J, 4K e 3U — hora oficial, ponto sem internet e avisos do funcionário (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function call(tok, method, path, body, origin = COLAB) { const r = await fetch(FN + path, { method, headers: { Origin: origin, Authorization: `Bearer ${tok}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; }
const iso = ms => new Date(ms).toISOString();

const robo = await login(cred.colaborador.robo), gestor = await login(cred.gestao);
const perfil = await rpc(robo, "my_employee_profile"), roboId = perfil.data[0].employee_id;

// ---------- 4J: hora oficial ----------
const relogio = await call(robo, "GET", "/v4a/clock");
check("4J relógio do app informa que a hora foi conferida com a hora oficial", relogio.status === 200 && relogio.data.hlb_verified === true && relogio.data.hlb.checked_at, JSON.stringify(relogio.data.hlb));
check("4J diferença do servidor para a hora oficial abaixo de 2 s", Math.abs(relogio.data.hlb.difference_ms) + relogio.data.hlb.uncertainty_ms <= 2000);
check("4J conferência recente (menos de 30 min)", Date.now() - Date.parse(relogio.data.hlb.checked_at) < 30 * 60000);
const hist = await rpc(gestor, "admin_conferencias_hora_4j", { p_limite: 10 });
check("4J Gestão vê o histórico e a cadeia das conferências está íntegra", hist.status === 200 && hist.data.cadeia_ok === true && hist.data.total >= 2 && hist.data.lista.length >= 2);
check("4J funcionário não vê o histórico da Gestão", (await rpc(robo, "admin_conferencias_hora_4j", { p_limite: 10 })).status >= 400);
check("4J sem login não lê a hora oficial", (await rpc(null, "hora_oficial_4j")).status >= 400);
check("4J funcionário lê a situação atual", (await rpc(robo, "hora_oficial_4j")).data?.valida === true);

// ---------- 4K: ponto sem internet ----------
const sinc = await call(robo, "GET", "/v4a/clock"), servidor = Date.parse(sinc.data.server_at);
const prova = (marca, extra = {}) => ({ employee_id: roboId, metodo: "RELOGIO_DO_CELULAR", hora_aparelho: iso(marca), ajuste_ms: 0, sincronizado_em: iso(servidor - 60 * 60000), aparelho_agora: iso(Date.now()), ...extra });
const marca1 = servidor - 47 * 60000 - Math.floor(Math.random() * 60000), key1 = randomUUID();
const loc = { status: "DENIED" };
const r1 = await call(robo, "POST", "/v4a/offline", { idempotency_key: key1, marking_at: iso(marca1), location: loc, proof: prova(marca1) });
check("4K marcação feita sem internet é aceita quando a conexão volta", r1.status === 201 && r1.data.event.online === false && r1.data.review === false, JSON.stringify(r1.data));
check("4K mantém a hora em que o funcionário bateu (não a hora da chegada)", r1.data.event?.marking_at === iso(marca1) && Date.parse(r1.data.event.recorded_at) > marca1);
const r1b = await call(robo, "POST", "/v4a/offline", { idempotency_key: key1, marking_at: iso(marca1), location: loc, proof: prova(marca1) });
check("4K reenviar a mesma marcação não duplica", r1b.status === 200 && r1b.data.duplicate === true && r1b.data.event.event_id === r1.data.event.event_id);
const rep = await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(marca1 + 20000), location: loc, proof: prova(marca1 + 20000) });
check("4K duas batidas em menos de 1 minuto: a segunda é recusada", rep.status === 409 && rep.data.error === "MARCACAO_REPETIDA");
const velha = servidor - 8 * 86400000;
check("4K mais de 7 dias sem internet: recusada", (await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(velha), location: loc, proof: prova(velha) })).data.error === "MARCACAO_OFFLINE_ANTIGA");
const futura = servidor + 10 * 60000;
check("4K hora no futuro: recusada", (await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(futura), location: loc, proof: prova(futura) })).data.error === "MARCACAO_NO_FUTURO");
check("4K não envia marcação de outra pessoa", (await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(marca1 - 5 * 60000), location: loc,
  proof: prova(marca1 - 5 * 60000, { employee_id: randomUUID() }) })).data.error === "FUNCIONARIO_DIFERENTE");
check("4K prova com campo estranho é recusada", (await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(marca1 - 6 * 60000), location: loc,
  proof: { ...prova(marca1 - 6 * 60000), latitude: 1 } })).status === 400);
check("4K Gestão não usa a rota do funcionário", (await call(robo, "POST", "/v4a/offline", { idempotency_key: randomUUID(), marking_at: iso(marca1), location: loc, proof: prova(marca1) }, GEST)).status === 403);
// Relógio do celular mudado: o celular diz que agora é 5 min antes do que é. A hora não muda, mas vai para conferir.
const marca2 = servidor - 23 * 60000 - Math.floor(Math.random() * 60000), key2 = randomUUID();
const r2 = await call(robo, "POST", "/v4a/offline", { idempotency_key: key2, marking_at: iso(marca2), location: loc, proof: prova(marca2, { aparelho_agora: iso(Date.now() - 5 * 60000) }) });
check("4K relógio do celular mudado: aceita SEM alterar a hora e marca para conferir", r2.status === 201 && r2.data.review === true && r2.data.event.marking_at === iso(marca2), JSON.stringify(r2.data));
// Marcação online continua igual.
const k3 = randomUUID();
await call(robo, "POST", "/v4a/begin", { idempotency_key: k3 });
const r3 = await call(robo, "POST", "/v4a/events", { idempotency_key: k3, location: loc });
check("4K marcação com internet continua igual (online)", r3.status === 201 && r3.data.event.online === true);
// AFD: posição 73 = "1" (off-line) nas marcações sem internet; "0" nas com internet.
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const ontem = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date(Date.now() - 86400000));
const afd = await call(gestor, "POST", "/gestao/afd", { from: ontem, to: hoje }, GEST);
const linha = ref => afd.data.content.split("\r\n").find(l => l.startsWith(String(ref.replace("TESTE-4D-", "")).padStart(9, "0") + "7"));
const l1 = linha(r1.data.event.synthetic_reference), l3 = linha(r3.data.event.synthetic_reference);
check("4K AFD: marcação sem internet sai com 1 na posição 73 e coletor 02", l1?.length === 137 && l1[72] === "1" && l1.slice(70, 72) === "02");
check("4K AFD: marcação com internet sai com 0 na posição 73", l3?.length === 137 && l3[72] === "0");
const g = await call(gestor, "GET", "/gestao", undefined, GEST);
const ev2 = g.data.events.find(e => e.event_id === r2.data.event.event_id);
check("4K Gestão vê a marcação para conferir e o motivo", ev2?.review === true && ev2.review_reasons.includes("RELOGIO_DO_CELULAR_MUDOU") && ev2.online === false);
check("4K Gestão vê a hora oficial no painel do ponto", g.data.official_time?.valida === true);
check("4K integridade do ponto continua íntegra (NSR e cadeia de hash)", g.data.integrity.ok === true, JSON.stringify(g.data.integrity));
const lista = await call(robo, "POST", "/v4b/list", { period: "today" });
check("4K histórico do funcionário mostra quais foram sem internet", lista.status === 200 && lista.data.events.some(e => e.online === false) && lista.data.events.some(e => e.online === true));

// ---------- 3U: avisos do funcionário ----------
const endpoint = `https://push.exemplo.invalid/metallo-prova-${randomUUID()}`;
check("3U Gestão (não é funcionário) não liga aviso de funcionário", (await rpc(gestor, "save_my_push_3u", { p_endpoint: endpoint, p_p256dh: "B".repeat(87), p_auth: "a".repeat(22) })).status >= 400);
check("3U endereço que não é https é recusado", (await rpc(robo, "save_my_push_3u", { p_endpoint: "http://x", p_p256dh: "B".repeat(87), p_auth: "a".repeat(22) })).status >= 400);
check("3U funcionário liga avisos neste aparelho", (await rpc(robo, "save_my_push_3u", { p_endpoint: endpoint, p_p256dh: "B".repeat(87), p_auth: "a".repeat(22) })).status < 300);
const est = await rpc(robo, "my_push_3u");
check("3U aparelho ligado e escolhas padrão (lembrete e outros avisos)", est.data?.aparelhos >= 1 && est.data.lembrete_ponto === true && est.data.outros_avisos === true, JSON.stringify(est.data));
await rpc(robo, "set_my_push_prefs_3u", { p_lembrete_ponto: false, p_outros_avisos: true });
check("3U funcionário escolhe não receber o lembrete do ponto", (await rpc(robo, "my_push_3u")).data.lembrete_ponto === false);
await rpc(robo, "set_my_push_prefs_3u", { p_lembrete_ponto: true, p_outros_avisos: true });
const teste = await fetch(AVISOS, { method: "POST", headers: { Origin: COLAB, Authorization: `Bearer ${robo}`, apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "teste" }) });
check("3U botão de teste chama o envio (aparelho de mentira não recebe)", teste.status === 200 && (await teste.json()).ok === true);
check("3U agendamento sem o segredo é recusado", (await fetch(AVISOS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "agendado" }) })).status === 401);
check("3U teste vindo de outro site é recusado", (await fetch(AVISOS, { method: "POST", headers: { Origin: GEST, Authorization: `Bearer ${robo}`, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "teste" }) })).status === 403);
await rpc(robo, "delete_my_push_3u", { p_endpoint: endpoint });
check("3U funcionário desliga avisos", (await rpc(robo, "my_push_3u")).data.aparelhos === est.data.aparelhos - 1);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4k-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
