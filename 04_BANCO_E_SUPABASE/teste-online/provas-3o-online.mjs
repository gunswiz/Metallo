// Marco 3O no TESTE ONLINE: Gestão cria, troca senha e bloqueia o acesso do funcionário ao app.
// Contas e funcionários FICTÍCIOS. Não imprime senha nem token.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const FN = `${BASE}/functions/v1/acesso-funcionario`;
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3O no teste online (dados fictícios)", checks: [] };
function check(name, condition) { evidence.checks.push({ name, ok: Boolean(condition) }); console.log((condition ? "OK   " : "FALHA") + " " + name); }
async function token(email, password) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); return r.status === 200 ? (await r.json()).access_token : null; }
async function fn(tk, body) { const r = await fetch(FN, { method: "POST", headers: { apikey: KEY, ...(tk ? { Authorization: `Bearer ${tk}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body) }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, data: d }; }
async function rpc(tk, name) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }, body: "{}" }); return { status: r.status, data: await r.json().catch(() => null) }; }

const gestor = await token(cred.gestao.email, cred.gestao.password);
const joao = await token(cred.colaborador.joao.email, cred.colaborador.joao.password);
const lista = await fn(gestor, { acao: "listar" });
check("Gestão lista funcionários e a situação do acesso", lista.status === 200 && lista.data.funcionarios.some(f => f.usuario === "joao" && f.situacao === "ativo"));
check("funcionário sem conta aparece como 'sem acesso'", lista.data.funcionarios.some(f => f.situacao === "sem_acesso"));
check("funcionário (João) não usa a função da Gestão", (await fn(joao, { acao: "listar" })).status === 403);
check("sem login recusado", (await fn(null, { acao: "listar" })).status === 401);
const alvo = lista.data.funcionarios.find(f => f.situacao === "sem_acesso" && f.matricula);
const usuario = `teste.${randomBytes(3).toString("hex")}`;
const senha1 = `Prova-${randomBytes(6).toString("hex")}`, senha2 = `Prova-${randomBytes(6).toString("hex")}`;
check("usuário com espaço ou acento é recusado", (await fn(gestor, { acao: "criar", employee_id: alvo.employee_id, usuario: "joão silva", senha: senha1 })).data?.error === "usuario_invalido");
check("senha curta é recusada", (await fn(gestor, { acao: "criar", employee_id: alvo.employee_id, usuario, senha: "1234" })).data?.error === "senha_curta");
check("usuário já usado é recusado", (await fn(gestor, { acao: "criar", employee_id: alvo.employee_id, usuario: "joao", senha: senha1 })).data?.error === "usuario_em_uso");
const criado = await fn(gestor, { acao: "criar", employee_id: alvo.employee_id, usuario, senha: senha1 });
check("Gestão cria o acesso do funcionário", criado.status === 200 && criado.data.funcionario.situacao === "ativo" && criado.data.funcionario.usuario === usuario);
check("não cria segundo acesso para a mesma pessoa", (await fn(gestor, { acao: "criar", employee_id: alvo.employee_id, usuario: usuario + "x", senha: senha1 })).data?.error === "ja_tem_acesso");
const novo = await token(`${usuario}@teste.metallo`, senha1);
const perfil = novo && await rpc(novo, "my_employee_profile");
check("funcionário entra no app e vê a própria ficha", perfil?.status === 200 && perfil.data?.[0]?.employee_id === alvo.employee_id);
check("a conta do app não entra como Gestão", (await fn(novo, { acao: "listar" })).status === 403);
const troca = await fn(gestor, { acao: "nova_senha", employee_id: alvo.employee_id, senha: senha2 });
check("Gestão define senha nova", troca.status === 200);
check("senha antiga deixa de valer", (await token(`${usuario}@teste.metallo`, senha1)) === null);
check("senha nova funciona", Boolean(await token(`${usuario}@teste.metallo`, senha2)));
const bloq = await fn(gestor, { acao: "bloquear", employee_id: alvo.employee_id, motivo: "other" });
check("Gestão bloqueia o acesso", bloq.status === 200 && bloq.data.funcionario.situacao === "bloqueado");
check("bloqueado não entra mais", (await token(`${usuario}@teste.metallo`, senha2)) === null);
check("senha nova em bloqueado é recusada", (await fn(gestor, { acao: "nova_senha", employee_id: alvo.employee_id, senha: senha1 })).data?.error === "sem_acesso");
writeFileSync(new URL("./resultado-3o-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
const failed = evidence.checks.filter(c => !c.ok).length;
console.log(`${evidence.checks.length - failed}/${evidence.checks.length}`); process.exit(failed ? 1 : 0);
