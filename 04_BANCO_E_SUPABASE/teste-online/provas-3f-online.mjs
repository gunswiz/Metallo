// Marco 3F no TESTE ONLINE: cerimônias WebAuthn sintéticas contra a Edge Function assinatura-epi-3f.
// Autenticador virtual só na memória. Contas e entregas FICTÍCIAS. Não imprime senha nem token.
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../01_WEB/node_modules/@simplewebauthn/server/script/index.js", import.meta.url));
const { encodeCBOR } = createRequire(realpathSync(source))("@levischuck/tiny-cbor");
const BASE = "https://cvimwiqokkujfhwynhmt.supabase.co", KEY = "sb_publishable_TUkzAq8LJrn0lFWwmL4cng_lfjlbKgH";
const ORIGIN = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const RP = new URL(ORIGIN).hostname;
const FN = `${BASE}/functions/v1/assinatura-epi-3f`;
const cred = JSON.parse(readFileSync(new URL("../../backups/credenciais-teste-online.json", import.meta.url), "utf8"));
const evidence = { at: new Date().toISOString(), scope: "Marco 3F no teste online (dados fictícios)", checks: [] };
function check(name, condition) { evidence.checks.push({ name, ok: Boolean(condition) }); console.log((condition ? "OK   " : "FALHA") + " " + name); }
const b64 = v => Buffer.from(v).toString("base64url");
const hash = v => createHash("sha256").update(v).digest();
async function login(u) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: u.password }) }); assert.equal(r.status, 200); return (await r.json()).access_token; }
async function rpc(token, name, body = {}) { const r = await fetch(`${BASE}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const t = await r.text(); return { status: r.status, data: t ? JSON.parse(t) : null }; }
async function portal(token, body, opts = {}) {
  const r = await fetch(FN + (opts.query ?? ""), { method: "POST", headers: { Origin: opts.origin ?? ORIGIN, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data, cors: r.headers.get("access-control-allow-origin") };
}
function virtualAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = b64(randomBytes(32));
  const cose = encodeCBOR(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]));
  let counter = 0;
  const client = (type, challenge, o = ORIGIN) => Buffer.from(JSON.stringify({ type, challenge, origin: o }));
  return { id: credentialId,
    register(challenge, o = ORIGIN, rp = RP) {
      const id = Buffer.from(credentialId, "base64url"); const len = Buffer.alloc(2); len.writeUInt16BE(id.length);
      const authData = Buffer.concat([hash(rp), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), len, id, Buffer.from(cose)]);
      const att = encodeCBOR(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
      return { id: credentialId, rawId: credentialId, type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(client("webauthn.create", challenge, o)), attestationObject: b64(att), transports: ["internal"] } };
    },
    assert(challenge, o = {}) {
      counter += 1; const count = Buffer.alloc(4); count.writeUInt32BE(o.counter ?? counter);
      const authData = Buffer.concat([hash(RP), Buffer.from([o.noVerification ? 0x01 : 0x05]), count]);
      const cd = client("webauthn.get", challenge, o.origin ?? ORIGIN);
      const signature = sign("sha256", Buffer.concat([authData, hash(cd)]), privateKey);
      return { id: credentialId, rawId: credentialId, type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(cd), authenticatorData: b64(authData), signature: b64(signature) } };
    } };
}

const joao = await login(cred.colaborador.robo), maria = await login(cred.colaborador.maria), gestor = await login(cred.gestao);
const joaoId = (await rpc(joao, "my_employee_profile")).data[0].employee_id;
async function novaEntrega() {
  const items = (await rpc(gestor, "admin_epi_kit_suggestion_3d", { p_employee_id: joaoId }));
  // Usa um lote com saldo do catálogo de teste (capacete).
  const lote = await fetch(`${BASE}/rest/v1/epi_stock_batches?select=id,item_id,quantity,epi_items!inner(code)&epi_items.code=eq.EPI-CAP&quantity=gt.0&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${gestor}` } }).then(r => r.json());
  assert.ok(Array.isArray(lote) && lote.length === 1, "lote do capacete indisponível: " + JSON.stringify(lote).slice(0, 200) + JSON.stringify(items).slice(0, 80));
  const prep = await rpc(gestor, "prepare_epi_kit_3d", { p_employee_id: joaoId, p_lines: [{ item_id: lote[0].item_id, stock_batch_id: lote[0].id, quantity: 1 }], p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200, JSON.stringify(prep.data));
  const g = await rpc(gestor, "register_epi_delivery_3d", { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(g.status, 200, JSON.stringify(g.data)); return g.data;
}

const st = await portal(joao, { action: "state" });
check("estado acessível ao titular; CORS só para o Colaborador de teste", st.status === 200 && Array.isArray(st.data.methods) && st.cors === ORIGIN);
check("origem externa bloqueada", (await portal(joao, { action: "state" }, { origin: "https://evil.example" })).status === 403);
check("querystring recusada", (await portal(joao, { action: "state" }, { query: "?employee_id=x" })).status === 403);
check("sem login recusado", (await fetch(FN, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: "{}" })).status === 401);
check("Gestão não cadastra método de funcionário", (await portal(gestor, { action: "register_start" })).status >= 400);
check("campo extra no corpo recusado", (await portal(joao, { action: "register_start", employee_id: randomUUID() })).status >= 400);

const a1 = virtualAuthenticator();
const r1 = await portal(joao, { action: "register_start" });
check("início de cadastro", r1.status === 200 && r1.data.options.rp.id === RP);
check("origem errada na cerimônia não cadastra", (await portal(joao, { action: "register_finish", challenge_id: r1.data.challenge_id, response: a1.register(r1.data.options.challenge, "https://evil.example") })).status >= 400);
check("RP errado não cadastra", (await portal(joao, { action: "register_finish", challenge_id: r1.data.challenge_id, response: a1.register(r1.data.options.challenge, ORIGIN, "localhost") })).status >= 400);
check("Maria não usa desafio do João", (await portal(maria, { action: "register_finish", challenge_id: r1.data.challenge_id, response: a1.register(r1.data.options.challenge) })).status >= 400);
const saved = await portal(joao, { action: "register_finish", challenge_id: r1.data.challenge_id, response: a1.register(r1.data.options.challenge) });
check("cadastro WebAuthn real validado", saved.status === 200 && saved.data.saved === true);
check("desafio de cadastro é de uso único", (await portal(joao, { action: "register_finish", challenge_id: r1.data.challenge_id, response: a1.register(r1.data.options.challenge) })).status >= 400);
const st2 = await portal(joao, { action: "state" });
check("método aparece só para o titular", st2.data.methods.some(m => m.id === a1.id) && !(await portal(maria, { action: "state" })).data.methods.some(m => m.id === a1.id));

const group = await novaEntrega();
check("Maria não inicia assinatura da entrega do João", (await portal(maria, { action: "sign_start", group_id: group })).status >= 400);
const s1 = await portal(joao, { action: "sign_start", group_id: group });
check("início da assinatura com conteúdo da entrega", s1.status === 200 && s1.data.payload.version === "3F-v1" && s1.data.payload.group_id === group);
const canonical = JSON.stringify(s1.data.payload);
check("conteúdo assinado traz a entrega e os itens", canonical.includes(group) && s1.data.payload.items.length === 1);
check("sem verificação do usuário (sem biometria) é recusado", (await portal(joao, { action: "sign_finish", challenge_id: s1.data.challenge_id, response: a1.assert(s1.data.options.challenge, { noVerification: true }) })).status >= 400);
const s2 = await portal(joao, { action: "sign_start", group_id: group });
check("origem errada na assinatura recusada", (await portal(joao, { action: "sign_finish", challenge_id: s2.data.challenge_id, response: a1.assert(s2.data.options.challenge, { origin: "https://evil.example" }) })).status >= 400);
const s3 = await portal(joao, { action: "sign_start", group_id: group });
const done = await portal(joao, { action: "sign_finish", challenge_id: s3.data.challenge_id, response: a1.assert(s3.data.options.challenge) });
check("assinatura com biometria registrada", done.status === 200 && /^[0-9a-f-]{36}$/.test(done.data.signature_event_id));
check("desafio de assinatura é de uso único", (await portal(joao, { action: "sign_finish", challenge_id: s3.data.challenge_id, response: a1.assert(s3.data.options.challenge) })).status >= 400);
check("entrega assinada não aceita segunda assinatura", (await portal(joao, { action: "sign_start", group_id: group })).status >= 400);
const groups = (await rpc(joao, "my_epi_delivery_groups_3d")).data;
check("entrega aparece como CONFIRMADO para o funcionário", groups.find(g => g.group_id === group)?.feedback_status === "CONFIRMADO");
const st3 = await portal(joao, { action: "state" });
check("evento de assinatura listado ao titular", st3.data.events.some(e => e.group_id === group));
check("tabelas privadas não aparecem na API pública", (await fetch(`${BASE}/rest/v1/epi_signature_credentials_3f?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${joao}` } })).status >= 400);

const group2 = await novaEntrega();
const s4 = await portal(joao, { action: "sign_start", group_id: group2 });
check("contador repetido (clonagem) é recusado", (await portal(joao, { action: "sign_finish", challenge_id: s4.data.challenge_id, response: a1.assert(s4.data.options.challenge, { counter: 1 }) })).status >= 400);
check("revogação pelo titular", (await portal(joao, { action: "revoke", credential_id: a1.id })).status === 200);
check("método revogado não assina", (await portal(joao, { action: "sign_start", group_id: group2 })).status >= 400);
// A entrega 2 fica pendente para o teste manual (confirmar sem biometria ou após cadastrar a biometria do celular).

const failed = evidence.checks.filter(c => !c.ok).length;
evidence.result = failed ? `${failed} FALHA(S)` : `${evidence.checks.length}/${evidence.checks.length} OK`;
writeFileSync(new URL("./resultado-3f-online.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(evidence.result); process.exitCode = failed ? 1 : 0;
