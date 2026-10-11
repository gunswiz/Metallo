// Marcos 6A (contracheque) e 6B (atestado) no TESTE ONLINE. Contas e arquivos FICTÍCIOS. Não imprime senha, token nem link.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const COLAB = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", GEST = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const FN = `${BASE}/functions/v1/arquivos-6`;
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marcos 6A e 6B — contracheque e atestado pelo app (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function envia(tok, origin, campos, bytes, nome = "arquivo.pdf") {
  const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.set(k, String(v));
  if (bytes) f.set("arquivo", new Blob([bytes]), nome);
  const r = await fetch(FN, { method: "POST", headers: { apikey: KEY, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), Origin: origin }, body: f });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function abrir(tok, origin, id) { const r = await fetch(FN, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "abrir", arquivo_id: id }) }); return { status: r.status, data: await r.json().catch(() => null) }; }
const pdf = new TextEncoder().encode(`%PDF-1.4\n% Metallo prova automatica ${Date.now()}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const robo = await login(cred.colaborador.robo), joao = await login(cred.colaborador.joao), gestor = await login(cred.gestao);
const roboId = (await rpc(robo, "my_employee_profile")).data[0].employee_id;

// ---------- 6B: atestado ----------
const chave = randomUUID();
const a1 = await envia(robo, COLAB, { acao: "atestado", data_inicio: hoje, dias: 1, observacao: "prova automática", chave }, pdf, "atestado.pdf");
check("6B funcionário envia atestado em PDF pelo app", a1.status === 201 && a1.data?.ok && a1.data.id > 0, JSON.stringify(a1.data));
check("6B reenviar o mesmo (internet caiu) não duplica", (await envia(robo, COLAB, { acao: "atestado", data_inicio: hoje, dias: 1, chave }, pdf)).data?.duplicado === true);
check("6B arquivo que não é PDF/foto é recusado", (await envia(robo, COLAB, { acao: "atestado", data_inicio: hoje, dias: 1, chave: randomUUID() }, new TextEncoder().encode("<html>oi</html>"), "a.pdf")).status === 415);
check("6B sem arquivo é recusado", (await envia(robo, COLAB, { acao: "atestado", data_inicio: hoje, dias: 1, chave: randomUUID() }, null)).status === 400);
check("6B data muito antiga é recusada", (await envia(robo, COLAB, { acao: "atestado", data_inicio: "2026-01-01", dias: 1, chave: randomUUID() }, pdf)).data?.error === "data_invalida");
check("6B Gestão não envia atestado como funcionário", (await envia(gestor, GEST, { acao: "atestado", data_inicio: hoje, dias: 1, chave: randomUUID() }, pdf)).status >= 400);
check("6B sem login não envia", (await envia(null, COLAB, { acao: "atestado", data_inicio: hoje, dias: 1, chave: randomUUID() }, pdf)).status === 401);
check("6B site estranho é recusado", (await envia(robo, "https://exemplo.invalid", { acao: "atestado", data_inicio: hoje, dias: 1, chave: randomUUID() }, pdf)).status === 403);
const meus = await rpc(robo, "my_atestados_6b"), meu = meus.data?.find(a => a.id === a1.data.id);
check("6B funcionário acompanha o atestado (enviado)", meu?.status === "enviado");
const ab = await abrir(robo, COLAB, meu.arquivo_id);
const baixado = ab.data?.url ? new Uint8Array(await (await fetch(ab.data.url)).arrayBuffer()) : new Uint8Array();
check("6B funcionário abre o próprio atestado (link de 2 min, arquivo igual)", ab.status === 200 && baixado.length === pdf.length && baixado[0] === 0x25);
check("6B outro funcionário não abre o atestado do robô", (await abrir(joao, COLAB, meu.arquivo_id)).status === 403);
check("6B Gestão abre o atestado", (await abrir(gestor, GEST, meu.arquivo_id)).status === 200);
const lista = await rpc(gestor, "admin_atestados_6b");
check("6B Gestão vê o atestado para conferir", lista.data?.some(a => a.id === a1.data.id && a.status === "enviado" && a.funcionario));
check("6B funcionário não vê a lista da Gestão", (await rpc(robo, "admin_atestados_6b")).status >= 400);
check("6B recusar sem motivo não pode", (await rpc(gestor, "admin_decidir_atestado_6b", { p_id: a1.data.id, p_aceitar: false, p_motivo: "" })).status >= 400);
check("6B Gestão recusa com motivo", (await rpc(gestor, "admin_decidir_atestado_6b", { p_id: a1.data.id, p_aceitar: false, p_motivo: "Prova automática (recusa)" })).status === 200);
check("6B funcionário vê a recusa e o motivo", (await rpc(robo, "my_atestados_6b")).data.some(a => a.id === a1.data.id && a.status === "recusado" && a.motivo_recusa.includes("Prova")));
const a2 = await envia(robo, COLAB, { acao: "atestado", data_inicio: hoje, dias: 2, chave: randomUUID() }, jpg, "foto.jpg");
check("6B foto (JPEG) também é aceita", a2.status === 201);
check("6B funcionário cancela o atestado enviado", (await rpc(robo, "cancelar_atestado_6b", { p_id: a2.data.id })).status < 300);
check("6B não decide atestado cancelado", (await rpc(gestor, "admin_decidir_atestado_6b", { p_id: a2.data.id, p_aceitar: true, p_motivo: null })).status >= 400);

// ---------- 6A: contracheque ----------
const c1 = await envia(gestor, GEST, { acao: "contracheque", employee_id: roboId, competencia: "2026-09", tipo_folha: "mensal" }, pdf, "holerite.pdf");
check("6A Gestão publica contracheque em PDF", c1.status === 201 && c1.data?.id > 0, JSON.stringify(c1.data));
check("6A contracheque só em PDF (foto recusada)", (await envia(gestor, GEST, { acao: "contracheque", employee_id: roboId, competencia: "2026-09", tipo_folha: "mensal" }, jpg, "x.jpg")).status === 415);
check("6A funcionário não publica contracheque", (await envia(robo, COLAB, { acao: "contracheque", employee_id: roboId, competencia: "2026-09" }, pdf)).status >= 400
  && (await rpc(robo, "iniciar_contracheque_6a", { p_employee_id: roboId, p_competencia: "2026-09", p_tipo_folha: "mensal" })).status >= 400);
check("6A mês futuro é recusado", (await envia(gestor, GEST, { acao: "contracheque", employee_id: roboId, competencia: "2027-01" }, pdf)).data?.error === "competencia_invalida");
const c2 = await envia(gestor, GEST, { acao: "contracheque", employee_id: roboId, competencia: "2026-09", tipo_folha: "mensal" }, pdf, "holerite-corrigido.pdf");
const meusCc = (await rpc(robo, "my_contracheques_6a")).data.filter(c => c.competencia === "2026-09" && c.tipo_folha === "mensal");
check("6A enviar de novo substitui (fica um só no app)", c2.status === 201 && meusCc.length === 1 && meusCc[0].id === c2.data.id);
check("6A outro funcionário não abre o contracheque do robô", (await abrir(joao, COLAB, meusCc[0].arquivo_id)).status === 403);
check("6A funcionário abre o próprio contracheque", (await abrir(robo, COLAB, meusCc[0].arquivo_id)).data?.nome === "contracheque-2026-09.pdf");
check("6A Gestão vê que o funcionário abriu", (await rpc(gestor, "admin_contracheques_6a", { p_competencia: "2026-09" })).data.some(c => c.id === c2.data.id && c.visto_em));
check("6A Gestão remove (fica no histórico) e some do app", (await rpc(gestor, "admin_remover_contracheque_6a", { p_id: c2.data.id })).status < 300
  && (await rpc(robo, "my_contracheques_6a")).data.every(c => c.id !== c2.data.id));
check("6A arquivo removido não abre mais", (await abrir(robo, COLAB, meusCc[0].arquivo_id)).status === 403);

// ---------- Balde privado ----------
const lista6 = await fetch(`${BASE}/storage/v1/object/list/documentos-6`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${robo}`, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "atestado/" + roboId }) });
const itens = lista6.ok ? await lista6.json() : [];
check("arquivos não aparecem direto no Storage (só pela função)", Array.isArray(itens) && itens.length === 0);
check("conclusão do envio não é chamável de fora", (await rpc(gestor, "concluir_envio_6", {})).status >= 400);

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-6-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
