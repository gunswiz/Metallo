// Semeia o AMBIENTE DE TESTE ONLINE (projeto Supabase "metallo-teste") com dados 100% FICTÍCIOS.
// Usa o migrador temporário (função protegida por token local) para SQL e para criar contas no Auth.
// Nunca toca no projeto de produção (Almoxarifado Online). Credenciais vão para backups/ (ignorado pelo Git).
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co";
const KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aW13aXFva2t1amZod3luaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNTQ5MjAsImV4cCI6MjEwNjYzMDkyMH0.-NIxD8SJ8qMb9gx-4J7wBXGJ1diL7GRwhT5B8Zh7SRk";
const root = fileURLToPath(new URL("../..", import.meta.url));
const token = readFileSync(root + "tmp/token-migrador.txt", "utf8").trim();
const target = root + "backups/credenciais-teste-online.json";
assert.ok(!existsSync(target), "Teste online já semeado. Preserve as credenciais existentes.");

async function migrador(body, modo = "sql") {
  const r = await fetch(`${BASE}/functions/v1/migrador-temporario`, { method: "POST", headers: { Authorization: `Bearer ${ANON_JWT}`, apikey: ANON_JWT,
    "x-metallo-token": token, "x-metallo-modo": modo, "Content-Type": modo === "sql" ? "text/plain" : "application/json" },
    body: modo === "sql" ? body : JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${modo}: ${JSON.stringify(j).slice(0, 400)}`);
  return j.result;
}
const q = v => v === null ? "null" : `'${String(v).replaceAll("'", "''")}'`;
async function sql(text) { const rows = await migrador(text); const row = Array.isArray(rows) ? rows[0] : null; return row ? Object.values(row)[0] : null; }
async function api(path, bearer, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const login = async u => (await (await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) })).json()).access_token;
const senha = () => `Teste-${randomBytes(9).toString("base64url")}-9a`;

async function conta(nome, email, portal) {
  const password = senha(); const ticket = randomUUID();
  await sql(`select public.issue_user_provisioning_ticket(${q(email)}, ${q(ticket)})`);
  const user = await migrador({ method: "POST", path: "/admin/users", body: { email, password, email_confirm: true,
    user_metadata: { full_name: nome, metallo_provisioning_token: ticket },
    app_metadata: { metallo_provisioned: true, ...(portal ? { metallo_account_type: "employee_portal" } : {}) } } }, "auth");
  return { id: user.id, email, password, nome };
}

assert.equal(Number(await sql("select count(*) from public.profiles")), 0, "Projeto de teste já tem contas.");

// 1) Gestão
const gestor = await conta("Gestor de Teste (fictício)", "gestao.teste@example.com", false);
await sql(`update public.profiles set role='admin', active=true, full_name='Gestor de Teste (fictício)' where id=${q(gestor.id)}::uuid`);
const adm = await login(gestor); assert.ok(adm, "login do gestor falhou");
// Catálogo-base igual ao da produção (profissões, kits, itens, motivos), registrado em nome do gestor de teste.
await migrador(`select set_config('request.jwt.claim.sub', ${q(gestor.id)}, true);\n` + readFileSync(new URL("./catalogo-referencia.sql", import.meta.url), "utf8"));
const rpc = (name, body, bearer = adm) => api(`/rest/v1/rpc/${name}`, bearer, body);

// 2) Locais, equipes e obras
const central = await sql(`insert into public.teams(name,description,location_type,active) values('Almoxarifado Central','Estoque principal (fictício)','central',true) returning id`);
const solda = await sql(`insert into public.teams(name,description,location_type,active) values('Equipe Solda A','Equipe fictícia de solda','field',true) returning id`);
const montagem = await sql(`insert into public.teams(name,description,location_type,active) values('Equipe Montagem B','Equipe fictícia de montagem','field',true) returning id`);
const obraNorte = await sql(`insert into public.worksites(name,stock_team_id,created_by) values('Obra Fictícia · Galpão Norte',${q(solda)}::uuid,${q(gestor.id)}::uuid) returning id`);
const obraSul = await sql(`insert into public.worksites(name,stock_team_id,created_by) values('Obra Fictícia · Ponte Sul',${q(montagem)}::uuid,${q(gestor.id)}::uuid) returning id`);
await sql(`update public.teams set worksite_id=${q(obraNorte)}::uuid where id=${q(solda)}::uuid`);
await sql(`update public.teams set worksite_id=${q(obraSul)}::uuid where id=${q(montagem)}::uuid`);

// 3) Funcionários (fictícios) e contas do Colaborador
const funcionarios = [
  ["João Teste da Silva", "welder", solda, "joao.teste@example.com"],
  ["Maria Teste Souza", "assembler", montagem, "maria.teste@example.com"],
  ["Pedro Teste Lima", "welder", solda, "pedro.teste@example.com"],
  ["Ana Teste Rocha", "helper", montagem, null],
  ["Carlos Teste Melo", "painter", solda, null],
];
const contas = {};
const ids = {};
for (const [nome, profissao, equipe, email] of funcionarios) {
  const code = `TESTE-${String(Object.keys(ids).length + 1).padStart(3, "0")}`;
  const employeeId = await sql(`insert into public.epi_employees(full_name,registration_code,profession,team_id,created_by,shirt_size,pants_size,shoe_size)
    values(${q(nome)},${q(code)},${q(profissao)},${q(equipe)}::uuid,${q(gestor.id)}::uuid,'G','42','41') returning id`);
  ids[nome] = employeeId;
  if (!email) continue;
  const user = await conta(nome, email, true);
  await rpc("admin_register_portal_account", { p_auth_user_id: user.id });
  await rpc("admin_link_employee_identity", { p_auth_user_id: user.id, p_employee_id: employeeId, p_expected_employee_name: nome, p_expected_registration_code: code, p_verification_method: "in_person" });
  contas[nome.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()] = { ...user, employeeId };
}

// 4) Estoque dos EPIs do catálogo (CAs fictícios)
const epis = {};
for (const [codigo, ca] of [["EPI-CAP", "10001"], ["EPI-LUV-RASPA", "10002"], ["EPI-OCU", "10003"], ["EPI-AUR", "10004"], ["EPI-BOT", "10005"], ["EPI-MASC-SOLDA", "10006"], ["EPI-AVENTAL", "10007"]]) {
  const id = await sql(`update public.epi_items set ca_number=${q(ca)}, minimum_stock=5 where code=${q(codigo)} returning id`);
  assert.ok(id, `item ${codigo} ausente no catálogo`);
  const batch = await sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,created_by) values(${q(id)}::uuid,40,${q(ca)},${q(gestor.id)}::uuid) returning id`);
  epis[codigo] = { item_id: id, stock_batch_id: batch };
}
async function entrega(nome, itens) {
  const prep = await rpc("prepare_epi_kit_3d", { p_employee_id: ids[nome], p_lines: itens.map(i => ({ ...epis[i], quantity: 1 })), p_idempotency_key: randomUUID() });
  return rpc("register_epi_delivery_3d", { p_preparation_id: prep, p_idempotency_key: randomUUID() });
}
const joao = await login(contas.joao);
const confirmada = await entrega("João Teste da Silva", ["EPI-CAP", "EPI-BOT", "EPI-MASC-SOLDA"]);
await rpc("respond_epi_delivery_3d", { p_group_id: confirmada, p_action: "CONFIRMADO", p_delivery_id: null, p_category: null, p_details: null, p_idempotency_key: randomUUID() }, joao);
await entrega("João Teste da Silva", ["EPI-LUV-RASPA", "EPI-OCU"]); // pendente para o teste
const recusada = await entrega("João Teste da Silva", ["EPI-AUR"]);
await rpc("manage_epi_delivery_feedback_3d", { p_group_id: recusada, p_action: "RECUSA", p_public_message: "Recusou receber o protetor auricular nesta entrega (dado fictício).", p_internal_note: "Testemunha fictícia: encarregado da equipe", p_idempotency_key: randomUUID() });
await entrega("Maria Teste Souza", ["EPI-CAP", "EPI-LUV-RASPA", "EPI-BOT"]);
await entrega("Pedro Teste Lima", ["EPI-CAP", "EPI-AVENTAL", "EPI-MASC-SOLDA"]);

// 5) Itens pessoais de trabalho (3G)
for (const [nome, codigo] of [["João Teste da Silva", "PES-TRENA"], ["Maria Teste Souza", "PES-ESQ"]]) {
  const itemId = await sql(`select id from public.epi_items where code=${q(codigo)}`);
  const batch = await sql(`insert into public.epi_stock_batches(item_id,quantity,created_by) values(${q(itemId)}::uuid,10,${q(gestor.id)}::uuid) returning id`);
  await rpc("deliver_personal_item_3g", { p_employee_id: ids[nome], p_item_id: itemId, p_quantity: 1, p_variant: null, p_note: null, p_idempotency_key: randomUUID(),
    p_stock_origin: "STOCK_BATCH", p_stock_batch_id: batch, p_exception_reason: null, p_exception_confirmed: false });
}

// 6) Comunicados
async function aviso(titulo, mensagem, audience, alvo = null, pinned = false) {
  const id = await rpc("save_communication_3h", { p_id: null, p_title: titulo, p_message: mensagem, p_audience: audience,
    p_team_id: audience === "TEAM" ? alvo : null, p_work_id: audience === "WORK" ? alvo : null, p_pinned: pinned, p_expires_at: null,
    p_idempotency_key: randomUUID(), p_expected_version: null });
  await rpc("publish_communication_3h", { p_id: id, p_expected_version: 1 });
}
await aviso("Bem-vindo ao Metallo Colaborador (teste)", "Este é o ambiente de TESTE online, com dados fictícios.\nNada aqui tem valor oficial.", "ALL");
await aviso("Uso obrigatório de EPI", "Capacete, óculos e botina são obrigatórios em toda a área da obra (aviso fictício).", "ALL", null, true);
await aviso("DDS de segunda-feira", "Diálogo de segurança às 7h no canteiro da Equipe Solda A (aviso fictício).", "TEAM", solda);
await aviso("Obra Ponte Sul: acesso pelo portão 2", "Durante esta semana, entrada pelo portão 2 (aviso fictício).", "WORK", obraSul);

// 7) Almoxarifado da Gestão: materiais e equipamentos (próprio e alugado)
await rpc("create_material_for_team", { p_code: "MAT-001", p_name: "Eletrodo E6013 2,5 mm", p_description: "Caixa 5 kg (fictício)", p_category: "Solda", p_unit: "cx", p_minimum_stock: 4, p_team_id: central, p_quantity: 12 });
await rpc("create_material_for_team", { p_code: "MAT-002", p_name: "Disco de corte 7\"", p_description: null, p_category: "Abrasivos", p_unit: "un", p_minimum_stock: 20, p_team_id: central, p_quantity: 15 });
await rpc("create_equipment_for_team_v2", { p_code: "EQ-001", p_name: "Máquina de solda inversora", p_asset_code: "PAT-0001", p_serial_number: "SN-FICTICIO-01", p_description: null, p_category: "Solda", p_team_id: solda, p_user_notes: null, p_ownership_type: "owned", p_rental_company: null, p_rental_start_date: null, p_rental_end_date: null });
await rpc("create_equipment_for_team_v2", { p_code: "EQ-002", p_name: "Plataforma elevatória", p_asset_code: "LOC-0001", p_serial_number: null, p_description: null, p_category: "Elevação", p_team_id: montagem, p_user_notes: null, p_ownership_type: "rented", p_rental_company: "Locadora Fictícia Ltda", p_rental_start_date: new Date().toISOString().slice(0, 10), p_rental_end_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) });

mkdirSync(root + "backups", { recursive: true });
writeFileSync(target, JSON.stringify({ note: "TESTE ONLINE (metallo-teste). Contas FICTÍCIAS. Não usar dados reais.", created_at: new Date().toISOString(),
  gestao: { email: gestor.email, password: gestor.password },
  colaborador: Object.fromEntries(Object.entries(contas).map(([k, v]) => [k, { nome: v.nome, email: v.email, password: v.password }])) }, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify({ ok: true, contas: Object.keys(contas).length + 1, credenciais: "backups/credenciais-teste-online.json" }));
