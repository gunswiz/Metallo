// Exercita anexos de reparo com contas e veículo fictícios, somente no teste online.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const root = new URL("../../", import.meta.url);
const cred = JSON.parse(readFileSync(new URL("backups/credenciais-teste-online.json", root), "utf8"));
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(tok, fn, args = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify(args) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }


const FN = `${BASE}/functions/v1/fotos-frota-10b`, ORIGEM_APP = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev", ORIGEM_GESTAO = "https://metallo-teste-gestao.metallo-gunswiz.workers.dev";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
async function abrir(tok, id, origem = ORIGEM_GESTAO) {
  const r = await fetch(FN, { method: "POST", headers: { Authorization: `Bearer ${tok}`, apikey: KEY, Origin: origem, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "abrir", foto_id: id }) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

const gestor = await login(cred.gestao), motorista = await login(cred.colaborador.robo);
const placa = "OSM" + randomUUID().slice(0,4).toUpperCase();
const cadastro = { p_placa: placa, p_nome: "Teste comprovante " + placa, p_modelo: "Sintético", p_ano: 2020, p_km: 200 };
const veiculo = (await rpc(gestor,"admin_save_veiculo_10a",{...cadastro,p_id:null,p_ativo:true})).data;
assert.ok(Number.isSafeInteger(veiculo));
const ordens = [];
async function enviar(token, ordem, bytes = PNG, id = veiculo) {
  const corpo = new FormData();
  corpo.set("acao","comprovar_reparo"); corpo.set("veiculo_id",String(id)); corpo.set("ordem_id",String(ordem));
  corpo.set("arquivo",new Blob([bytes]),"sintetico.png");
  const r = await fetch(FN,{method:"POST",headers:{Authorization:`Bearer ${token}`,Origin:ORIGEM_GESTAO,apikey:KEY},body:corpo});
  return {status:r.status,data:await r.json()};
}
try {
  for (const descricao of ["Reparo sintético A","Reparo sintético B"]) {
    const os = (await rpc(gestor,"admin_abrir_manutencao_10a",{p_veiculo:veiculo,p_tipo:"corretiva",p_descricao:descricao,p_bloquear:false})).data;
    assert.ok(Number.isSafeInteger(os)); ordens.push(os);
  }
  assert.ok((await enviar(motorista,ordens[0])).status >= 400);
  assert.ok((await enviar(gestor,ordens[0],PNG,veiculo+100000)).status >= 400);
  assert.equal((await enviar(gestor,ordens[0],Buffer.from("texto"))).status,415);
  const foto = await enviar(gestor,ordens[0]);
  assert.equal(foto.status,201,JSON.stringify(foto.data));
  assert.equal((await enviar(gestor,ordens[0])).data.id,foto.data.id);
  assert.equal((await abrir(gestor,foto.data.id)).status,200);
  assert.ok((await abrir(motorista,foto.data.id,ORIGEM_APP)).status >= 400);
  assert.equal((await rpc(gestor,"admin_concluir_manutencao_10a",{p_id:ordens[0],p_km:200,p_custo:12,p_obs:"Reparo sintético com foto"})).status,204);
  ordens.shift();
  const lista = await rpc(gestor,"admin_comprovantes_os_10m",{p_veiculo:veiculo});
  assert.equal(lista.data.length,1); assert.equal(lista.data[0].foto,foto.data.id); assert.notEqual(lista.data[0].ordem,ordens[0]);
  assert.ok((await rpc(motorista,"admin_comprovantes_os_10m",{p_veiculo:veiculo})).status >= 400);
  console.log("OK: vínculo por OS, reenvio, persistência após conclusão, imagem inválida, veículo incorreto e acesso do motorista.");
} finally {
  for (const id of ordens) await rpc(gestor,"admin_cancelar_manutencao_10a",{p_id:id,p_motivo:"Fim da prova sintética"});
  const fim=await rpc(gestor,"admin_save_veiculo_10a",{...cadastro,p_id:veiculo,p_ativo:false});
  assert.ok(fim.status < 300);
}
