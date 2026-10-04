// Confere as telas da Gestão de TESTE (Worker metallo-teste-gestao) com sessão do gestor fictício.
// A sessão vai no cookie do @supabase/ssr, como o navegador faria. Não imprime senha nem token.
import { readFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const SITE = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(cred.gestao) });
const session = await r.json();
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const name = "sb-cvimwiqokkujfhwynhmt-auth-token";
const chunks = value.length <= 3180 ? [[name, value]] : value.match(/.{1,3180}/g).map((c, i) => [`${name}.${i}`, c]);
const cookie = chunks.map(([k, v]) => `${k}=${v}`).join("; ");
const pages = ["/dashboard", "/almoxarifado", "/materiais", "/equipamentos", "/equipes", "/funcionarios", "/epis", "/epis/entrega-em-lote", "/epis/solicitacoes",
  "/movimentacoes", "/consumo", "/relatorios", "/comunicados", "/usuarios", "/configuracoes", "/obras", "/ponto-laboratorio"];
const out = [];
for (const p of pages) {
  const res = await fetch(SITE + p, { headers: { cookie }, redirect: "manual" });
  const html = await res.text();
  const title = (html.match(/<title>(.*?)<\/title>/) ?? [])[1] ?? "";
  const erro = /Algo deu errado|Application error|Internal Server Error|somente no laboratório|Somente laboratório/i.test(html) ? " [AVISO/ERRO NA PÁGINA]" : "";
  const marcas = ["João Teste", "Gestor de Teste", "Almoxarifado Central", "Capacete", "Recusa", "Locadora Fictícia", "Bem-vindo ao Metallo"].filter(m => html.includes(m));
  out.push(`${res.status} ${p} ${res.headers.get("location") ?? ""} ${title}${erro} ${marcas.join(",")}`);
}
const joaoId = (await (await fetch(`${BASE}/rest/v1/epi_employees?select=id&full_name=eq.Jo%C3%A3o%20Teste%20da%20Silva`, { headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}` } })).json())[0].id;
for (const p of [`/funcionarios/${joaoId}`, `/funcionarios/${joaoId}/epi`, `/funcionarios/${joaoId}/itens`, `/funcionarios/${joaoId}/epi/pdf`]) {
  const res = await fetch(SITE + p, { headers: { cookie }, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("latin1");
  out.push(`${res.status} ${p.replace(joaoId, ":joao")} ${res.headers.get("content-type")} ${buf.length}B ${/%PDF/.test(text.slice(0, 8)) ? "[PDF]" : ""}${/Algo deu errado|somente no laborat/i.test(buf.toString("utf8")) ? " [AVISO/ERRO]" : ""}`);
  if (p.endsWith("/pdf") && /%PDF/.test(text.slice(0, 8))) (await import("node:fs")).writeFileSync(new URL("../../tmp/ficha-joao-online.pdf", import.meta.url), buf);
}
const pl = await (await fetch(SITE + "/ponto-laboratorio", { headers: { cookie } })).text();
out.push("ponto-laboratorio: " + (pl.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300));
console.log(out.join("\n"));
