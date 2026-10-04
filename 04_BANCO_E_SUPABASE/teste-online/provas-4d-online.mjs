// Marco 4D no TESTE ONLINE: provas do núcleo do ponto em Postgres (schema ponto) + Edge Function ponto-4d.
// Contas e marcações FICTÍCIAS. Não imprime senha, token ou coordenada.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/ponto-4d`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const token = readFileSync(new URL("tmp/token-migrador.txt", root), "utf8").trim();
const evidence = { at: new Date().toISOString(), scope: "Marco 4D no teste online (dados fictícios, sem valor oficial)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function sql(text) {
  const r = await fetch(`${BASE}/functions/v1/migrador-temporario`, { method: "POST", headers: { Authorization: `Bearer ${ANON_JWT}`, apikey: ANON_JWT, "x-metallo-token": token, "Content-Type": "text/plain" }, body: text });
  return r.json();
}
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function call(tok, method, path, body, origin = COLAB) {
  const r = await fetch(FN + path, { method, headers: { Origin: origin, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: r.status, data };
}
const loc = (extra = {}) => ({ status: "AVAILABLE", latitude: -3.73, longitude: -38.52, accuracy_meters: 12, captured_at: new Date().toISOString(), ...extra });
async function marcar(tok, location = loc()) { const key = randomUUID(); const b = await call(tok, "POST", "/v4a/begin", { idempotency_key: key }); const e = await call(tok, "POST", "/v4a/events", { idempotency_key: key, location }); return { key, b, e }; }

const joao = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), pedro = await login(cred.colaborador.pedro), gestor = await login(cred.gestao);
const antes = (await sql("select ultimo_nsr::text n from ponto.contador_nsr")).result[0].n;

const clock = await call(joao, "GET", "/v4a/clock");
check("relógio do servidor (não do aparelho)", clock.status === 200 && Math.abs(Date.parse(clock.data.server_at) - Date.now()) < 120000 && clock.data.timezone === "America/Fortaleza");
check("origem externa recusada", (await call(joao, "GET", "/v4a/clock", undefined, "https://evil.example")).status === 403);
check("sem login recusado", (await call(null, "GET", "/v4a/clock")).status === 401);
check("Gestão não usa rotas pessoais pela origem do Colaborador", (await call(gestor, "POST", "/v4a/begin", { idempotency_key: randomUUID() })).status === 403);

const k = randomUUID();
const b1 = await call(joao, "POST", "/v4a/begin", { idempotency_key: k });
await new Promise(r => setTimeout(r, 1200));
const b2 = await call(joao, "POST", "/v4a/begin", { idempotency_key: k });
check("intenção fixa a hora; repetir a mesma chave mantém a hora", b1.status === 200 && b1.data.marking_at === b2.data.marking_at);
check("outra pessoa não reaproveita a chave (início)", (await call(maria, "POST", "/v4a/begin", { idempotency_key: k })).status === 409);
check("outra pessoa não grava na intenção alheia", (await call(maria, "POST", "/v4a/events", { idempotency_key: k, location: loc() })).status === 403);
const L = loc();
const e1 = await call(joao, "POST", "/v4a/events", { idempotency_key: k, location: L });
check("marcação gravada com NSR e recibo", e1.status === 201 && /^TESTE-4D-\d+$/.test(e1.data.event.synthetic_reference) && e1.data.event.marking_at === b1.data.marking_at && e1.data.event.location_status === "AVAILABLE", JSON.stringify(e1.data));
const e2 = await call(joao, "POST", "/v4a/events", { idempotency_key: k, location: L });
check("reenvio da mesma marcação não duplica", e2.status === 200 && e2.data.duplicate === true && e2.data.event.event_id === e1.data.event.event_id);
check("reenvio com outra localização é conflito", (await call(joao, "POST", "/v4a/events", { idempotency_key: k, location: { status: "DENIED" } })).status === 409);
check("gravar sem intenção é recusado", (await call(joao, "POST", "/v4a/events", { idempotency_key: randomUUID(), location: loc() })).status === 403);
check("campo extra na localização é recusado", (await marcar(joao, loc({ altitude: 10 }))).e.status === 400);
const old = await marcar(joao, loc({ captured_at: new Date(Date.now() - 3600000).toISOString() }));
check("localização com hora antiga vira 'não comprovada'", old.e.status === 201 && old.e.data.event.location_status === "UNKNOWN");
check("localização negada não impede o registro", (await marcar(joao, { status: "DENIED" })).e.data?.event?.location_status === "DENIED");
check("recuperação pela intenção (resposta perdida)", (await call(joao, "GET", `/v4a/intent/${k}`)).data?.event?.event_id === e1.data.event.event_id);
check("intenção alheia não é revelada", (await call(maria, "GET", `/v4a/intent/${k}`)).status === 404);

const joaoEmp = (await call(joao, "GET", "/v4b/receipt/" + e1.data.event.event_id)).data;
check("comprovante pessoal com NSR e hash", joaoEmp.nsr > 0 && /^[0-9a-f]{64}$/.test(joaoEmp.payload_hash) && joaoEmp.employee_name === "Robô de Provas Automáticas");
check("Maria não vê comprovante do João", (await call(maria, "GET", "/v4b/receipt/" + e1.data.event.event_id)).status === 404);
const list = await call(joao, "POST", "/v4b/list", { period: "today", offset: 0 });
check("lista de hoje", list.status === 200 && list.data.events.some(e => e.event_id === e1.data.event.event_id));
check("últimas 48 h", (await call(joao, "GET", "/v4b/last48")).data?.events?.length >= 3);
check("filtro inválido recusado", (await call(joao, "POST", "/v4b/list", { period: "custom", from: "2026-01-01", to: "2028-01-01" })).status === 400);

// Intenção vencida (mais de 2 min sem confirmar).
const emp = (await sql(`select employee_id::text e from ponto.intencao where idempotency_key='${k}'`)).result[0].e;
const user = (await sql(`select auth_user_id::text u from ponto.intencao where idempotency_key='${k}'`)).result[0].u;
const velha = randomUUID();
await sql(`insert into ponto.intencao(idempotency_key,auth_user_id,employee_id,marking_at) values('${velha}','${user}','${emp}',clock_timestamp()-interval '5 minutes')`);
check("intenção vencida não grava (hora não pode ser reaproveitada)", (await call(joao, "POST", "/v4a/events", { idempotency_key: velha, location: loc() })).data.error === "INTENCAO_EXPIRADA");

// Sessão encerrada: token ainda válido, mas sessão revogada no Auth.
const extra = await login(cred.colaborador.robo);
await fetch(`${BASE}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${extra}` } });
const revog = await call(extra, "POST", "/v4a/begin", { idempotency_key: randomUUID() });
check("sessão encerrada não marca ponto", revog.status === 401, JSON.stringify(revog));

// Funcionário inativo.
await sql(`update public.epi_employees set active=false where full_name='Pedro Teste Lima'`);
const inativo = await call(pedro, "POST", "/v4a/begin", { idempotency_key: randomUUID() });
await sql(`update public.epi_employees set active=true where full_name='Pedro Teste Lima'`);
check("funcionário inativo não marca ponto", inativo.status === 403 && inativo.data.error === "CONTEXTO_INATIVO", JSON.stringify(inativo));

// Pico: 30 marcações simultâneas (3 pessoas x 10).
const t0 = Date.now();
const pico = await Promise.all([...Array(30)].map(() => marcar(joao)));
const ms = Date.now() - t0;
check(`pico de 30 marcações simultâneas gravadas (${ms} ms)`, pico.every(p => p.e.status === 201), pico.filter(p => p.e.status !== 201).map(p => JSON.stringify(p.e.data)).slice(0, 3).join(" | "));

// Integridade no banco.
const ver = (await sql("select ok,total::text total,motivo from ponto.verificar()")).result[0];
const depois = (await sql("select ultimo_nsr::text n from ponto.contador_nsr")).result[0].n;
check("cadeia de hash e NSR sem buracos conferidos", ver.ok === true && Number(depois) === Number(ver.total), JSON.stringify(ver));
check("NSR avançou exatamente pelas marcações desta prova", Number(depois) - Number(antes) === 3 + 30, `${antes}->${depois}`);
for (const [nome, cmd] of [["alterar", "update ponto.marcacao set employee_name='X' where nsr=1"], ["apagar", "delete from ponto.marcacao where nsr=1"],
  ["truncar", "truncate ponto.marcacao cascade"], ["mexer no contador", "update ponto.contador_nsr set ultimo_nsr=ultimo_nsr+5"], ["apagar intenção", "delete from ponto.intencao"]]) {
  const r = await sql(cmd); check(`original imutável: ${nome} é bloqueado`, r.ok === false && /ORIGINAL_IMUTAVEL|CONTADOR_INVALIDO|violates foreign key/.test(r.message ?? ""), r.message);
}
const adult = await sql(`alter table ponto.marcacao disable trigger imutavel; update ponto.marcacao set employee_name=employee_name||' ' where nsr=(select max(nsr) from ponto.marcacao);
  do $$ declare v record; begin select * into v from ponto.verificar(); raise exception 'RESULTADO %|%', v.ok, v.motivo; end $$;`);
check("adulteração direta (com gatilho desligado) é detectada pela verificação", /RESULTADO (f|false)\|HASH_DIVERGENTE/.test(adult.message ?? ""), adult.message);
check("adulteração foi desfeita (transação revertida)", (await sql("select ok from ponto.verificar()")).result[0].ok === true);
check("schema do ponto fora da API pública", (await fetch(`${BASE}/rest/v1/marcacao?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${joao}`, "Accept-Profile": "ponto" } })).status >= 400);

const g = await call(gestor, "GET", "/gestao", undefined, GEST);
check("Gestão vê marcações e integridade", g.status === 200 && g.data.integrity.ok === true && g.data.events.length > 0 && g.data.events[0].employee_name);
check("funcionário não acessa a visão da Gestão", (await call(joao, "GET", "/gestao", undefined, GEST)).status === 403);

const failed = evidence.checks.filter(c => !c.ok).length;
evidence.result = failed ? `${failed} FALHA(S) de ${evidence.checks.length}` : `${evidence.checks.length}/${evidence.checks.length} OK`;
evidence.pico_30_ms = ms;
writeFileSync(new URL("./resultado-4d-online.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(evidence.result); process.exitCode = failed ? 1 : 0;
