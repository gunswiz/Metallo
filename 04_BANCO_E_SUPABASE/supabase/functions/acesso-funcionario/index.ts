// Marco 3O (TESTE ONLINE): a Gestão cria e cuida do acesso do funcionário ao app.
// Só administrador ativo. Usa as mesmas regras do banco: ficha de provisionamento, conta própria do app
// (perfil inativo na Gestão), vínculo por conferência presencial e revogação com motivo.
// Não registra senha, token nem dado do funcionário em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { z } from "npm:zod@4.5.4";

const ORIGINS = new Set(["https://metallo-teste-gestao.metallo-gunswiz.workers.dev", "http://localhost:3100", "http://127.0.0.1:3100"]);
const DOMINIO = Deno.env.get("METALLO_DOMINIO_LOGIN") ?? "teste.metallo";
const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(url).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 2, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const id = z.uuid();
const usuario = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9.]{2,29}$/, "usuario_invalido").refine(v => !v.includes(".."), "usuario_invalido");
const senha = z.string().min(8, "senha_curta").max(72);
const corpo = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("listar") }).strict(),
  z.object({ acao: z.literal("criar"), employee_id: id, usuario, senha }).strict(),
  z.object({ acao: z.literal("nova_senha"), employee_id: id, senha }).strict(),
  z.object({ acao: z.literal("bloquear"), employee_id: id,
    motivo: z.enum(["employment_ended", "wrong_association", "account_replaced", "other"]) }).strict(),
]);

const publicos = new Set(["authentication_required", "admin_required", "usuario_invalido", "senha_curta", "senha_igual_usuario",
  "usuario_em_uso", "ja_tem_acesso", "sem_acesso", "funcionario_inativo", "matricula_obrigatoria", "pedido_invalido"]);

type Linha = { employee_id: string; nome: string; matricula: string | null; equipe: string | null; identity_id: string | null;
  status: string | null; email: string | null; criado_em: Date | null; ultimo_acesso: Date | null; banido: boolean | null };

async function lista(employeeId?: string) {
  return await sql.unsafe(`
    select e.id::text employee_id, e.full_name nome, e.registration_code matricula, t.name equipe,
      i.id::text identity_id, i.status, u.email, i.created_at criado_em, u.last_sign_in_at ultimo_acesso,
      (u.banned_until is not null and u.banned_until > now()) banido
    from public.epi_employees e
    left join public.teams t on t.id = e.team_id
    left join lateral (select * from private.employee_identity x where x.employee_id = e.id
      order by (x.status = 'active') desc, x.created_at desc limit 1) i on true
    left join auth.users u on u.id = i.auth_user_id
    where e.active ${employeeId ? "and e.id = $1::text::uuid" : ""}
    order by e.full_name`, employeeId ? [employeeId] : []) as unknown as Linha[];
}
const publico = (l: Linha) => ({ employee_id: l.employee_id, nome: l.nome, matricula: l.matricula, equipe: l.equipe,
  situacao: !l.identity_id ? "sem_acesso" : l.status === "active" && !l.banido ? "ativo" : "bloqueado",
  usuario: l.email?.endsWith(`@${DOMINIO}`) ? l.email.slice(0, -DOMINIO.length - 1) : l.email,
  criado_em: l.criado_em, ultimo_acesso: l.ultimo_acesso });

async function criar(caller: ReturnType<typeof createClient>, b: { employee_id: string; usuario: string; senha: string }) {
  if (b.senha.toLowerCase().includes(b.usuario)) throw new Error("senha_igual_usuario");
  const [l] = await lista(b.employee_id);
  if (!l) throw new Error("funcionario_inativo");
  if (l.identity_id && l.status === "active") throw new Error("ja_tem_acesso");
  if (!l.matricula?.trim()) throw new Error("matricula_obrigatoria");
  const email = `${b.usuario}@${DOMINIO}`;
  const existe = await sql.unsafe(`select 1 from auth.users where lower(email)=$1::text`, [email]);
  if (existe.length) throw new Error("usuario_em_uso");
  const ticket = crypto.randomUUID();
  const t = await admin.rpc("issue_user_provisioning_ticket", { p_email: email, p_token: ticket });
  if (t.error) throw new Error("falha");
  const created = await admin.auth.admin.createUser({ email, password: b.senha, email_confirm: true,
    user_metadata: { full_name: l.nome, metallo_provisioning_token: ticket },
    app_metadata: { metallo_provisioned: true, metallo_account_type: "employee_portal" } });
  if (created.error || !created.data.user) {
    await admin.rpc("revoke_user_provisioning_ticket", { p_email: email, p_token: ticket });
    const m = created.error?.message.toLowerCase() ?? "";
    throw new Error(created.error?.code === "email_exists" || m.includes("already") ? "usuario_em_uso" : "falha");
  }
  const userId = created.data.user.id;
  const desfazer = async () => { await admin.auth.admin.deleteUser(userId).catch(() => {}); };
  await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: l.nome } });
  const r1 = await caller.rpc("admin_register_portal_account", { p_auth_user_id: userId });
  if (r1.error) { await desfazer(); throw new Error("falha"); }
  const r2 = await caller.rpc("admin_link_employee_identity", { p_auth_user_id: userId, p_employee_id: b.employee_id,
    p_expected_employee_name: l.nome, p_expected_registration_code: l.matricula, p_verification_method: "in_person" });
  if (r2.error) throw new Error("falha"); // conta registrada fica no histórico; não se apaga registro de portal
  return publico((await lista(b.employee_id))[0]);
}

async function ativo(employeeId: string) {
  const [row] = await sql.unsafe(`select i.id::text identity_id, i.auth_user_id::text user_id from private.employee_identity i
    where i.employee_id=$1::text::uuid and i.status='active'`, [employeeId]) as unknown as { identity_id: string; user_id: string }[];
  if (!row) throw new Error("sem_acesso");
  return row;
}

async function novaSenha(b: { employee_id: string; senha: string }) {
  const a = await ativo(b.employee_id);
  const [u] = await sql.unsafe(`select email from auth.users where id=$1::text::uuid`, [a.user_id]) as unknown as { email: string }[];
  if (u?.email && b.senha.toLowerCase().includes(u.email.split("@")[0])) throw new Error("senha_igual_usuario");
  const r = await admin.auth.admin.updateUserById(a.user_id, { password: b.senha });
  if (r.error) throw new Error("falha");
  // Senha nova encerra as sessões abertas em outros aparelhos.
  await sql.unsafe(`delete from auth.sessions where user_id=$1::text::uuid`, [a.user_id]);
  return publico((await lista(b.employee_id))[0]);
}

async function bloquear(caller: ReturnType<typeof createClient>, b: { employee_id: string; motivo: string }) {
  const a = await ativo(b.employee_id);
  const r = await caller.rpc("admin_revoke_employee_identity", { p_identity_id: a.identity_id, p_reason: b.motivo });
  if (r.error) throw new Error("falha");
  await admin.auth.admin.updateUserById(a.user_id, { ban_duration: "876000h" });
  await sql.unsafe(`delete from auth.sessions where user_id=$1::text::uuid`, [a.user_id]);
  return publico((await lista(b.employee_id))[0]);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    ...(ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}) };
  if (req.method === "OPTIONS") return new Response(null, { status: ORIGINS.has(origin) ? 204 : 403, headers: { ...headers,
    "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info" } });
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  try {
    if (req.method !== "POST") return answer({ ok: false, error: "pedido_invalido" }, 405);
    const auth = req.headers.get("authorization") ?? "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: who, error } = await caller.auth.getUser();
    if (error || !who.user) throw new Error("authentication_required");
    const { data: p } = await admin.from("profiles").select("role,active").eq("id", who.user.id).single();
    if (p?.role !== "admin" || p?.active !== true) throw new Error("admin_required");
    const raw = await req.text();
    if (raw.length > 4000) throw new Error("pedido_invalido");
    const parsed = corpo.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message;
      throw new Error(publicos.has(msg) ? msg : "pedido_invalido");
    }
    const b = parsed.data;
    switch (b.acao) {
      case "listar": return answer({ ok: true, funcionarios: (await lista()).map(publico) });
      case "criar": return answer({ ok: true, funcionario: await criar(caller, b) });
      case "nova_senha": return answer({ ok: true, funcionario: await novaSenha(b) });
      case "bloquear": return answer({ ok: true, funcionario: await bloquear(caller, b) });
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const code = publicos.has(m) ? m : "falha";
    if (code === "falha") console.error("acesso-funcionario falhou");
    return answer({ ok: false, error: code }, code === "authentication_required" ? 401 : code === "admin_required" ? 403 : 400);
  }
});
