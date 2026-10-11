// Marco 4L no TESTE ONLINE: fechamento do mês, confirmação do funcionário, trava e reabertura. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 4L — fechamento do mês (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, ...(tok ? { Authorization: `Bearer ${tok}` } : {}), "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
const erro = (r, txt) => r.status >= 400 && JSON.stringify(r.data).includes(txt);

const robo = await login(cred.colaborador.robo), joao = await login(cred.colaborador.joao), gestor = await login(cred.gestao);
const roboId = (await rpc(robo, "my_employee_profile")).data[0].employee_id;
const mes = "2026-09", dias = Array.from({ length: 30 }, (_, i) => ({ d: `2026-09-${String(i + 1).padStart(2, "0")}`, s: "seg", h: [], m: 0, b: null, o: "" }));
const resumo = (marcacoes) => ({ marcacoes, diasTrabalhados: 0, minutos: 0, extra50: 0, sabado: 0, domingoFeriado: 0, atrasos: 0, faltas: 0, minutosFalta: 0, abonos: 0, conferir: 0, diasAcima2h: 0, saldo: 0 });

// Se sobrou fechamento de rodada anterior, reabre (fica no histórico).
for (const f of (await rpc(gestor, "admin_fechamentos_4l", { p_mes: mes })).data ?? []) if (f.employee_id === roboId) await rpc(gestor, "admin_reabrir_mes_4l", { p_id: f.id, p_motivo: "Limpeza da prova automática" });

check("funcionário não fecha mês", (await rpc(robo, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(0), p_dias: dias })).status >= 400);
check("mês que não terminou não fecha", erro(await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: "2026-10", p_resumo: resumo(0), p_dias: dias }), "mes_nao_terminou"));
check("tela desatualizada (número de marcações diferente) não fecha", erro(await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(999), p_dias: dias }), "resumo_desatualizado"));
check("foto com dias demais é recusada", (await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(0), p_dias: [...dias, ...dias] })).status >= 400);
const f1 = await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(0), p_dias: dias });
check("Gestão fecha setembro do robô", f1.status === 200 && Number(f1.data) > 0, JSON.stringify(f1.data));
check("não fecha duas vezes", erro(await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(0), p_dias: dias }), "mes_ja_fechado"));
check("mês fechado trava ocorrência", erro(await rpc(gestor, "admin_set_ocorrencia_4h", { p_employee_id: roboId, p_data: "2026-09-10", p_tipo: "atestado", p_observacao: "" }), "mes_fechado"));
check("mês fechado trava feriado novo", erro(await rpc(gestor, "admin_set_feriado_4h", { p_data: "2026-09-15", p_nome: "Teste", p_tipo: "municipal" }), "mes_fechado"));
const meus = await rpc(robo, "my_fechamentos_4l");
check("funcionário vê o mês fechado com a foto dos dias", meus.status === 200 && meus.data.some(f => f.id === Number(f1.data) && f.dias.length === 30 && f.resposta === null));
check("outro funcionário não vê o fechamento do robô", (await rpc(joao, "my_fechamentos_4l")).data?.every(f => f.id !== Number(f1.data)));
check("João não responde pelo robô", erro(await rpc(joao, "responder_fechamento_4l", { p_id: Number(f1.data), p_resposta: "confirmado", p_comentario: "" }), "fechamento_indisponivel"));
check("“tem algo errado” sem explicar é recusado", erro(await rpc(robo, "responder_fechamento_4l", { p_id: Number(f1.data), p_resposta: "contestado", p_comentario: "" }), "comentario_obrigatorio"));
const resp = await rpc(robo, "responder_fechamento_4l", { p_id: Number(f1.data), p_resposta: "contestado", p_comentario: "Dia 12 saí às 18h (prova automática)" });
check("funcionário avisa que tem algo errado", resp.status === 200 && Number.isFinite(Date.parse(resp.data)));
check("responde uma vez só", erro(await rpc(robo, "responder_fechamento_4l", { p_id: Number(f1.data), p_resposta: "confirmado", p_comentario: "" }), "fechamento_indisponivel"));
const g = (await rpc(gestor, "admin_fechamentos_4l", { p_mes: mes })).data.find(f => f.id === Number(f1.data));
check("Gestão vê a resposta e o comentário", g?.resposta === "contestado" && g.comentario.includes("18h") && g.mudou === false);
check("funcionário não lê a lista da Gestão", (await rpc(robo, "admin_fechamentos_4l", { p_mes: mes })).status >= 400);
check("reabrir sem motivo é recusado", erro(await rpc(gestor, "admin_reabrir_mes_4l", { p_id: Number(f1.data), p_motivo: "x" }), "motivo_obrigatorio"));
check("Gestão reabre com motivo", (await rpc(gestor, "admin_reabrir_mes_4l", { p_id: Number(f1.data), p_motivo: "Conferir dia 12 com o encarregado" })).status < 300);
const oc = await rpc(gestor, "admin_set_ocorrencia_4h", { p_employee_id: roboId, p_data: "2026-09-10", p_tipo: "atestado", p_observacao: "" });
check("depois de reabrir, ocorrência volta a ser aceita", oc.status === 200);
if (oc.status === 200) await rpc(gestor, "admin_cancelar_ocorrencia_4h", { p_id: oc.data });
check("reaberto some do app (até fechar de novo)", (await rpc(robo, "my_fechamentos_4l")).data.every(f => f.id !== Number(f1.data)));
const f2 = await rpc(gestor, "admin_fechar_mes_4l", { p_employee_id: roboId, p_mes: mes, p_resumo: resumo(0), p_dias: dias });
const g2 = (await rpc(gestor, "admin_fechamentos_4l", { p_mes: mes })).data.find(f => f.id === Number(f2.data));
check("fecha de novo e a Gestão vê que já foi reaberto 1 vez", f2.status === 200 && g2?.reaberturas >= 1 && g2.resposta === null);
check("sem login não vê nada", (await rpc(null, "my_fechamentos_4l")).status >= 400 && (await rpc(null, "admin_fechamentos_4l", { p_mes: mes })).status >= 400);
await rpc(gestor, "admin_reabrir_mes_4l", { p_id: Number(f2.data), p_motivo: "Fim da prova automática" });

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-4l-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
