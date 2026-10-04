// Teste online: usuários curtos (gestor, joao, maria, pedro @teste.metallo) e senha simples comum às contas da demonstração.
// Só contas FICTÍCIAS do projeto de teste. O robô de provas mantém senha forte própria.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const root = new URL("../../", import.meta.url);
const token = readFileSync(new URL("tmp/token-migrador.txt", root), "utf8").trim();
const file = new URL("backups/credenciais-teste-online.json", root);
const cred = JSON.parse(readFileSync(file, "utf8"));
const SENHA = "12345678";
async function migrador(body, modo) {
  const r = await fetch(`${BASE}/functions/v1/migrador-temporario`, { method: "POST", headers: { Authorization: `Bearer ${ANON_JWT}`, "x-metallo-token": token, "x-metallo-modo": modo,
    "Content-Type": modo === "sql" ? "text/plain" : "application/json" }, body: modo === "sql" ? body : JSON.stringify(body) });
  const j = await r.json(); if (!j.ok) throw new Error(JSON.stringify(j).slice(0, 300)); return j.result;
}
const contas = [["gestor", cred.gestao], ["joao", cred.colaborador.joao], ["maria", cred.colaborador.maria], ["pedro", cred.colaborador.pedro]];
for (const [usuario, c] of contas) {
  const email = `${usuario}@teste.metallo`;
  const [row] = await migrador(`select id::text id from auth.users where email in ('${c.email}','${email}')`, "sql");
  assert.ok(row?.id, `conta ${usuario} não encontrada`);
  await migrador({ method: "PUT", path: `/admin/users/${row.id}`, body: { email, email_confirm: true, password: SENHA } }, "auth");
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: SENHA }) });
  assert.equal(r.status, 200, `login de ${usuario} falhou`);
  c.email = email; c.password = SENHA; c.usuario = usuario;
}
writeFileSync(file, JSON.stringify(cred, null, 2) + "\n", { mode: 0o600 });
console.log("Logins simplificados: gestor, joao, maria, pedro (mesma senha). Robô de provas inalterado.");
