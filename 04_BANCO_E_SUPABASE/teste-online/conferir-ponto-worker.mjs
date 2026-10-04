// Ponta a ponta pelo SITE de teste (Worker), como o celular faria: marca ponto, lê registros, baixa comprovante e ZIP,
// e confere a tela "Ponto (teste)" da Gestão. Contas fictícias; não imprime senha nem token.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const login = async u => (await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) })).json());
const joao = (await login(cred.colaborador.robo)).access_token;
const h = (extra = {}) => ({ Authorization: `Bearer ${joao}`, Origin: COLAB, ...extra });
const out = [];
const key = randomUUID();
const b = await fetch(`${COLAB}/api/ponto-online/begin`, { method: "POST", headers: h({ "Content-Type": "application/json" }), body: JSON.stringify({ idempotency_key: key }) });
out.push(`begin ${b.status} ${(await b.text()).slice(0, 120)}`);
const e = await fetch(`${COLAB}/api/ponto-online/events`, { method: "POST", headers: h({ "Content-Type": "application/json" }), body: JSON.stringify({ idempotency_key: key, location: { status: "DENIED" } }) });
const ev = await e.json(); out.push(`events ${e.status} ${ev.event?.synthetic_reference ?? JSON.stringify(ev)}`);
const c = await fetch(`${COLAB}/api/ponto-online/clock`, { headers: h() }); out.push(`clock ${c.status}`);
const l = await fetch(`${COLAB}/api/ponto-registros/list`, { method: "POST", headers: h({ "Content-Type": "application/json" }), body: JSON.stringify({ period: "today", offset: 0 }) });
const list = await l.json(); out.push(`list ${l.status} ${list.events?.length} registros`);
if (ev.event) {
  const r = await fetch(`${COLAB}/api/ponto-registros/receipt/${ev.event.event_id}`, { headers: h() });
  const pdf = Buffer.from(await r.arrayBuffer()); out.push(`comprovante ${r.status} ${r.headers.get("content-disposition")} ${pdf.length}B`);
  if (r.ok) writeFileSync(new URL("../../tmp/comprovante-4d-exemplo.pdf", import.meta.url), pdf);
}
const z = await fetch(`${COLAB}/api/ponto-registros/last48`, { headers: h() }); out.push(`zip48 ${z.status} ${(await z.arrayBuffer()).byteLength}B`);
const outra = await fetch(`${COLAB}/api/ponto-online/clock`, { headers: { ...h(), Origin: "https://evil.example" } }); out.push(`GET com origem externa ${outra.status} (GET aceito pelo Worker; a Edge Function confere a origem enviada pelo Worker)`);
const post = await fetch(`${COLAB}/api/ponto-online/begin`, { method: "POST", headers: { ...h({ "Content-Type": "application/json" }), Origin: "https://evil.example" }, body: JSON.stringify({ idempotency_key: randomUUID() }) }); out.push(`POST com origem externa ${post.status}`);
// Gestão
const s = await login(cred.gestao);
const cookie = `sb-cvimwiqokkujfhwynhmt-auth-token=base64-${Buffer.from(JSON.stringify(s)).toString("base64url")}`;
const g = await fetch(`${GEST}/ponto-laboratorio`, { headers: { cookie } }); const html = await g.text();
out.push(`gestao ponto ${g.status} ${/Integridade conferida agora: \d+ marcações/.exec(html)?.[0] ?? "SEM LINHA DE INTEGRIDADE"} ${html.includes("João Teste") ? "[nomes ok]" : ""}`);
const pdfG = await fetch(`${GEST}/funcionarios/${list.events?.[0] ? "" : ""}`, { headers: { cookie } }); void pdfG;
console.log(out.join("\n"));
