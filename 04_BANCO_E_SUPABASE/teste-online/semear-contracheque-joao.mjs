// Coloca um contracheque de TESTE (PDF de verdade, valores fictícios) para o João em setembro/2026, substituindo o anterior.
import { readFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const tok = (await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: cred.gestao.email, password: cred.gestao.password }) })).json()).access_token;
const f = new FormData();
f.set("acao", "contracheque"); f.set("employee_id", "9d5eb6bc-eab7-42cb-964c-911187206b93"); f.set("competencia", "2026-09"); f.set("tipo_folha", "mensal");
f.set("arquivo", new Blob([readFileSync(new URL("arquivos-ficticios/contracheque-teste-joao-2026-09.pdf", import.meta.url))]), "contracheque.pdf");
const r = await fetch(`${BASE}/functions/v1/arquivos-6`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, Origin: GEST }, body: f });
console.log("contracheque", r.status, JSON.stringify(await r.json()));
