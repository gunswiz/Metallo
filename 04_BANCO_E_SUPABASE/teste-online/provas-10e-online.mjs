// R5: prova no servidor de TESTE com contas fictícias existentes; sem Docker.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co";
const KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), target: "metallo-teste", checks: [] };
function check(name, ok) { evidence.checks.push({ name, ok: Boolean(ok) }); console.log(`${ok ? "OK" : "FALHA"} ${name}`); assert.ok(ok, name); }
async function login(u) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) });
  assert.equal(r.status, 200, "Login fictício"); return (await r.json()).access_token;
}
async function rpc(token, name, args = {}) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const text = await r.text(); return { status: r.status, data: text ? JSON.parse(text) : null };
}
const [robo, maria, gestor] = await Promise.all([login(cred.colaborador.robo), login(cred.colaborador.maria), login(cred.gestao)]);
const suffix = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
const cadastro = { p_id: null, p_placa: `R5A${suffix}`, p_nome: `Auditoria R5 ${suffix}`, p_modelo: "Fictício", p_ano: 2020, p_km: 100, p_ativo: true };
let vehicle;
try {
  const created = await rpc(gestor, "admin_save_veiculo_10a", cadastro);
  check("veículo fictício exclusivo criado", created.status === 200 && typeof created.data === "number"); vehicle = created.data;
  const items = (await rpc(robo, "my_frota_itens_10a")).data;
  const clean = { p_veiculo: vehicle, p_local: "Prova R5", p_obs: "Fictício", p_respostas: items.map(i => ({ codigo: i.codigo, situacao: "C", obs: "" })), p_ciente: true, p_key: randomUUID() };
  const pair = await Promise.all([rpc(robo, "create_checklist_10a", clean), rpc(robo, "create_checklist_10a", clean)]);
  check("checklist simultâneo igual tem um único resultado", pair.every(r => r.status === 200) && pair[0].data[0].id === pair[1].data[0].id);
  for (const [field, value] of [["p_obs", "Corrigido"], ["p_ciente", false], ["p_veiculo", vehicle + 999999]]) {
    check(`mesma chave rejeita checklist alterado: ${field}`, (await rpc(robo, "create_checklist_10a", { ...clean, [field]: value })).data?.message === "idempotency_conflict");
  }
  const start = { p_veiculo: vehicle, p_destino: "Obra fictícia R5", p_acompanhantes: "", p_km: 100, p_obs: "", p_key: randomUUID() };
  const trip = await rpc(robo, "create_saida_10a", start);
  check("saída registrada", trip.status === 200);
  check("saída repetida mantém viagem", (await rpc(robo, "create_saida_10a", start)).data === trip.data);
  check("saída alterada rejeitada", (await rpc(robo, "create_saida_10a", { ...start, p_km: 101 })).data?.message === "idempotency_conflict");
  const arrival = { p_viagem: trip.data, p_km: 105, p_problema: "", p_obs: "", p_key: randomUUID() };
  check("chegada registrada", (await rpc(robo, "create_chegada_10a", arrival)).status < 300);
  check("chegada repetida aceita", (await rpc(robo, "create_chegada_10a", arrival)).status < 300);
  check("chegada alterada rejeitada", (await rpc(robo, "create_chegada_10a", { ...arrival, p_problema: "Freio antigo" })).data?.message === "idempotency_conflict");
  const payload = { tipo: "checklist", local: "Obra antiga", obs: "Relato recusado antes do conserto", respostas: [{ codigo: items[0].codigo, situacao: "N", obs: "Freio com defeito já consertado" }] };
  const request = { p_key: randomUUID(), p_veiculo: vehicle, p_relato: payload };
  const before = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: vehicle })).data;
  const receipt = await rpc(robo, "my_relato_recusado_10e", request);
  check("relato original recebido sem autorizar saída", receipt.status === 200 && receipt.data.conferido_em === null);
  check("recibo repetido preserva recebimento", (await rpc(robo, "my_relato_recusado_10e", request)).data.recebido_em === receipt.data.recebido_em);
  check("recibo rejeita conteúdo trocado", (await rpc(robo, "my_relato_recusado_10e", { ...request, p_relato: { ...payload, obs: "Mudou" } })).data?.message === "idempotency_conflict");
  check("funcionário não consulta relatos de Gestão", (await rpc(robo, "admin_relatos_recusados_10e", { p_veiculo: vehicle })).status >= 400);
  const listed = await rpc(gestor, "admin_relatos_recusados_10e", { p_veiculo: vehicle });
  check("Gestão lê o relato preservado", listed.status === 200 && listed.data[0].relato.respostas[0].obs === payload.respostas[0].obs);
  const ack = { p_veiculo: vehicle, p_employee: listed.data[0].employee_id, p_key: request.p_key, p_motivo: "Conserto fictício verificado pelo responsável" };
  check("funcionário não confirma conferência", (await rpc(robo, "admin_conferir_recusa_10e", ack)).status >= 400);
  check("Gestão confirma relato específico", (await rpc(gestor, "admin_conferir_recusa_10e", ack)).status < 300);
  check("reenvio da confirmação é seguro", (await rpc(gestor, "admin_conferir_recusa_10e", ack)).status < 300);
  check("motivo da confirmação é imutável", (await rpc(gestor, "admin_conferir_recusa_10e", { ...ack, p_motivo: "Outro motivo" })).data?.message === "idempotency_conflict");
  const proof = await rpc(robo, "my_relato_recusado_10e", request);
  check("motorista recebe prova vinculada ao conteúdo", proof.status === 200 && Boolean(proof.data.conferido_em) && proof.data.chave === request.p_key && proof.data.relato.obs === payload.obs);
  check("outra conta não herda conferência da chave", (await rpc(maria, "my_relato_recusado_10e", request)).data?.conferido_em === null);
  const after = (await rpc(gestor, "admin_frota_ficha_10a", { p_veiculo: vehicle })).data;
  check("conferência não duplica manutenção nem checklist", after.manutencoes.length === before.manutencoes.length && after.checklists.length === before.checklists.length && after.veiculo.situacao === "disponivel");
  const arrivalReceipt = await rpc(robo, "my_relato_recusado_10e", { p_key: randomUUID(), p_veiculo: vehicle, p_relato: { tipo: "chegada", viagem: trip.data, km: 105, obs: "", problema: "Relato antigo da chegada" } });
  check("relato de chegada encerrada também pode ser conferido", arrivalReceipt.status === 200);
  check("outra conta não vincula viagem alheia", (await rpc(maria, "my_relato_recusado_10e", { p_key: randomUUID(), p_veiculo: vehicle, p_relato: { tipo: "chegada", viagem: trip.data, km: 105, obs: "", problema: "Relato alheio" } })).status >= 400);
} finally {
  if (vehicle) {
    const cleanup = await rpc(gestor, "admin_save_veiculo_10a", { ...cadastro, p_id: vehicle, p_km: 105, p_ativo: false });
    evidence.fixtureDeactivated = cleanup.status === 200;
  }
  evidence.result = `${evidence.checks.filter(c => c.ok).length}/${evidence.checks.length}`;
  writeFileSync(new URL("resultado-10e-online.json", import.meta.url), JSON.stringify(evidence, null, 2));
  console.log(evidence.result);
}
