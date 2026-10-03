// Confere o teste online pela API pública, como o app faz (contas fictícias). Não imprime senhas nem tokens.
import { readFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(u) }); return (await r.json()).access_token; }
async function rpc(t, name, body = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; }
const out = {};
const joao = await login({ email: cred.colaborador.joao.email, password: cred.colaborador.joao.password });
for (const n of ["my_employee_profile", "my_current_work", "my_team_summary", "my_personal_epi", "my_epi_delivery_groups_3d", "my_personal_items_3g", "my_epi_awareness_3i"]) {
  const r = await rpc(joao, n); out[n] = r.status === 200 ? (Array.isArray(r.data) ? `${r.data.length} linha(s)` : typeof r.data) : `ERRO ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`;
}
const c = await rpc(joao, "my_communications_3h", { p_unread_only: false, p_limit: 20, p_offset: 0 }); out.my_communications_3h = c.status === 200 ? JSON.stringify(c.data).length + " bytes" : `ERRO ${c.status}`;
// Isolamento: João não lê dados da Gestão nem tabelas diretas.
const t = await fetch(`${BASE}/rest/v1/epi_employees?select=full_name`, { headers: { apikey: KEY, Authorization: `Bearer ${joao}` } }); out.joao_le_tabela_funcionarios = `${t.status} ${(await t.text()).slice(0, 60)}`;
const a = await rpc(joao, "admin_epi_delivery_feedback_3d"); out.joao_chama_rpc_admin = `${a.status} ${JSON.stringify(a.data).slice(0, 80)}`;
const anon = await fetch(`${BASE}/rest/v1/rpc/my_employee_profile`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: "{}" }); out.anonimo_perfil = `${anon.status}`;
const g = await login(cred.gestao); const d = await rpc(g, "admin_epi_delivery_feedback_3d"); out.gestao_feedback = d.status === 200 ? `${d.data.length} linha(s)` : `ERRO ${d.status}`;
console.log(JSON.stringify(out, null, 1));
