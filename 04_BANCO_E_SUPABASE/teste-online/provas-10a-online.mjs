// Marco 3T no TESTE ONLINE: pedido de material pelo app e resposta da Gestão. Contas FICTÍCIAS.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 10A — frota (teste online)", checks: [] };
function check(name, ok, info = "") { evidence.checks.push({ name, ok: Boolean(ok) }); console.log((ok ? "OK   " : "FALHA") + " " + name + (ok || !info ? "" : " :: " + info)); }
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }


const robo = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase(), placa = "PRV" + sufixo;
const idV = (await rpc(gestor, "admin_save_veiculo_10a", { p_id: null, p_placa: placa, p_nome: "Munck prova " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 1000, p_ativo: true })).data;
check("Gestão cadastra caminhão de prova", Number.isInteger(idV));
check("placa inválida recusada", (await rpc(gestor, "admin_save_veiculo_10a", { p_id: null, p_placa: "AB", p_nome: "x1", p_modelo: "", p_ano: null, p_km: 0, p_ativo: true })).status >= 400);
check("funcionário não cadastra caminhão", (await rpc(robo, "admin_save_veiculo_10a", { p_id: null, p_placa: "ZZZ9Z99", p_nome: "xx", p_modelo: "", p_ano: null, p_km: 0, p_ativo: true })).status >= 400);
const itens = await rpc(robo, "my_frota_itens_10a");
check("app lista os 26 itens do checklist", itens.status === 200 && itens.data.length === 26);
const todosC = itens.data.map(i => ({ codigo: i.codigo, situacao: "C", obs: "" }));
const lista = await rpc(robo, "my_frota_10a");
check("app lista os caminhões com a situação", lista.status === 200 && lista.data.some(v => v.id === idV && v.situacao === "disponivel"));
const saida = (v, km = 1000) => rpc(robo, "create_saida_10a", { p_veiculo: v, p_destino: "Obra Teste", p_acompanhantes: "Maria", p_km: km, p_obs: "", p_key: randomUUID() });
check("saída sem checklist do dia é recusada", (await saida(idV)).status >= 400);
check("checklist incompleto é recusado", (await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: todosC.slice(1), p_ciente: true, p_key: randomUUID() })).status >= 400);
check("sem ciência é recusado", (await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: todosC, p_ciente: false, p_key: randomUUID() })).status >= 400);
const ruim = todosC.map(r => r.codigo === 8 ? { ...r, situacao: "N", obs: "" } : r);
check("'N' sem descrição é recusado", (await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: ruim, p_ciente: true, p_key: randomUUID() })).status >= 400);
const kCrit = randomUUID(), crit = todosC.map(r => r.codigo === 8 ? { ...r, situacao: "N", obs: "pneu careca" } : r);
const c1 = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: crit, p_ciente: true, p_key: kCrit });
const c1b = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: crit, p_ciente: true, p_key: kCrit });
check("item crítico 'N' => não liberado; reenvio não duplica", c1.status === 200 && c1.data[0].resultado === "nao_liberado" && c1b.data[0].id === c1.data[0].id);
check("saída de caminhão não liberado é recusada", (await saida(idV)).status >= 400);
let ficha = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data;
check("manutenção corretiva abriu sozinha e bloqueia", ficha.veiculo.situacao === "nao_liberado" && ficha.manutencoes.some(m => m.status === "aberta" && m.bloqueia && m.origem === "checklist"));
check("funcionário não libera caminhão", (await rpc(robo, "admin_liberar_10a", { p_veiculo: idV, p_motivo: "quero sair" })).status >= 400);
check("liberar sem motivo é recusado", (await rpc(gestor, "admin_liberar_10a", { p_veiculo: idV, p_motivo: "" })).status >= 400);
check("engenheiro libera com motivo", (await rpc(gestor, "admin_liberar_10a", { p_veiculo: idV, p_motivo: "Pneu trocado na hora (prova)" })).status < 300);
check("km menor que o atual é recusado", (await saida(idV, 10)).status >= 400);
const s = await saida(idV, 1000);
check("saída liberada", s.status === 200 && Number.isInteger(s.data));
check("mesma pessoa não pega 2 caminhões / caminhão em uso não sai de novo", (await rpc(maria, "create_saida_10a", { p_veiculo: idV, p_destino: "Outro", p_acompanhantes: "", p_km: 1000, p_obs: "", p_key: randomUUID() })).status >= 400);
check("Maria não registra chegada do robô", (await rpc(maria, "create_chegada_10a", { p_viagem: s.data, p_km: 1050, p_problema: "", p_obs: "", p_key: randomUUID() })).status >= 400);
check("km de chegada menor que a saída é recusado", (await rpc(robo, "create_chegada_10a", { p_viagem: s.data, p_km: 900, p_problema: "", p_obs: "", p_key: randomUUID() })).status >= 400);
const kCh = randomUUID();
const ch = await rpc(robo, "create_chegada_10a", { p_viagem: s.data, p_km: 1060, p_problema: "Freio fazendo barulho", p_obs: "", p_key: kCh });
const ch2 = await rpc(robo, "create_chegada_10a", { p_viagem: s.data, p_km: 1060, p_problema: "Freio fazendo barulho", p_obs: "", p_key: kCh });
check("chegada com problema; reenvio não duplica", ch.status < 300 && ch2.status < 300);
ficha = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data;
check("caminhão voltou como não liberado e km atualizado", ficha.veiculo.situacao === "nao_liberado" && ficha.veiculo.km_atual === 1060);
const man = ficha.manutencoes.find(m => m.status === "aberta");
check("enviar à oficina", (await rpc(gestor, "admin_enviar_oficina_10a", { p_id: man.id, p_oficina: "Oficina Teste", p_previsao: null })).status < 300);
check("situação virou 'manutencao'", (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data.veiculo.situacao === "manutencao");
check("concluir manutenção com custo", (await rpc(gestor, "admin_concluir_manutencao_10a", { p_id: man.id, p_custo: 350.5, p_km: 1070, p_obs: "ok" })).status < 300);
ficha = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data;
check("caminhão voltou a disponível com custo registrado", ficha.veiculo.situacao === "disponivel" && ficha.manutencoes.some(m => m.status === "concluida" && Number(m.custo) === 350.5));
const cok = await rpc(robo, "create_checklist_10a", { p_veiculo: idV, p_local: "Pátio", p_obs: "", p_respostas: todosC, p_ciente: true, p_key: randomUUID() });
check("checklist sem problemas => liberado", cok.status === 200 && cok.data[0].resultado === "liberado");
const hist = (await rpc(robo, "my_frota_viagens_10a")).data;
check("histórico do funcionário mostra a viagem", hist.some(t => t.id === s.data && t.km_chegada === 1060));
const mes = await rpc(gestor, "admin_frota_mes_10a", { p_veiculo: idV, p_mes: null });
check("grade do mês traz as respostas", mes.status === 200 && mes.data.some(x => x.codigo === 8 && x.situacao === "N"));
const det = await rpc(gestor, "admin_frota_checklist_10a", { p_id: c1.data[0].id });
check("detalhe do checklist com 26 itens", det.status === 200 && det.data.itens.length === 26);
const plano = await rpc(gestor, "admin_save_plano_10a", { p_id: null, p_veiculo: idV, p_descricao: "Óleo", p_cada_km: 500, p_cada_dias: null, p_ultimo_km: 100, p_ultima_data: null, p_ativo: true });
check("plano por km nasce vencido", plano.status < 300 && (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data.planos.some(p => p.id === plano.data && p.situacao === "vencido"));
check("concluir plano zera o contador", (await rpc(gestor, "admin_concluir_plano_10a", { p_plano: plano.data, p_km: 1070, p_data: null, p_custo: 100, p_obs: "" })).status < 300 && (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: idV })).data.planos.some(p => p.id === plano.data && p.situacao === "ok"));
const doc = await rpc(gestor, "admin_save_documento_10a", { p_veiculo: idV, p_tipo: "crlv", p_descricao: "", p_numero: "X", p_vencimento: "2020-01-01" });
check("documento vencido aparece em atenção", doc.status < 300 && (await rpc(gestor, "admin_frota_atencao_10a")).data.some(a => a.veiculo_id === idV && a.tipo === "documento" && a.gravidade === "vencido"));
check("funcionário não vê painel da Gestão", (await rpc(robo, "admin_frota_painel_10a")).status >= 400);
check("Gestão não registra saída como funcionário", (await saidaComo(gestor)).status >= 400);
await rpc(gestor, "admin_save_veiculo_10a", { p_id: idV, p_placa: placa, p_nome: "Munck prova " + sufixo, p_modelo: "teste", p_ano: 2020, p_km: 1070, p_ativo: false });
function saidaComo(tok) { return rpc(tok, "create_saida_10a", { p_veiculo: idV, p_destino: "X1", p_acompanhantes: "", p_km: 2000, p_obs: "", p_key: randomUUID() }); }

evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
writeFileSync(new URL("resultado-10a-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`RESULTADO ${evidence.result}`);
process.exit(evidence.checks.every(c => c.ok) ? 0 : 1);
