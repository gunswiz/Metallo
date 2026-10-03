// Cerimônias WebAuthn sintéticas, com Auth/JWT/PostgREST reais no Docker local.
// A chave privada do autenticador de teste existe apenas na memória deste processo.
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createPreviewAccounts, base, anon, quote, sql } from "../laboratorio-marco-1a/criar-contas-previa-1b.mjs";

const source = fileURLToPath(new URL("../../01_WEB/node_modules/@simplewebauthn/server/script/index.js", import.meta.url));
const { encodeCBOR } = createRequire(realpathSync(source))("@levischuck/tiny-cbor");
const origin = "http://localhost:3101";
const evidence = { at: new Date().toISOString(), scope: "Marco 3F, somente laboratório sintético",
  checks: [] };
function check(name, condition) {
  const ok = Boolean(condition);
  evidence.checks.push({ name, ok });
  assert.ok(ok, name);
}
const b64 = value => Buffer.from(value).toString("base64url");
const hash = value => createHash("sha256").update(value).digest();
async function call(path, token, body, method = "POST") {
  const url = new URL(path, base);
  assert.equal(url.origin, base);
  const response = await fetch(url, { method, headers: { apikey: anon, Authorization: `Bearer ${token}`,
    "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
async function portal(token, body, options = {}) {
  const response = await fetch(`${origin}/api/laboratorio/assinatura-epi${options.query ?? ""}`, {
    method: "POST", headers: { Origin: options.origin ?? origin, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
const rpc = (name, token, body = {}) => call(`/rest/v1/rpc/${name}`, token, body);
async function login(account) {
  const response = await call("/auth/v1/token?grant_type=password", anon,
    { email: account.email, password: account.password });
  assert.equal(response.status, 200);
  return response.data.access_token;
}
function virtualAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = b64(randomBytes(32));
  const cose = encodeCBOR(new Map([[1, 2], [3, -7], [-1, 1],
    [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]));
  let counter = 0;
  const rpHash = hash("localhost");
  function client(type, challenge, usedOrigin = origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: usedOrigin }));
  }
  return {
    id: credentialId,
    register(challenge, usedOrigin = origin) {
      const id = Buffer.from(credentialId, "base64url");
      const idLength = Buffer.alloc(2); idLength.writeUInt16BE(id.length);
      const authData = Buffer.concat([rpHash, Buffer.from([0x45]), Buffer.alloc(4),
        Buffer.alloc(16), idLength, id, Buffer.from(cose)]);
      const attestation = encodeCBOR(new Map([["fmt", "none"], ["attStmt", new Map()],
        ["authData", authData]]));
      return { id: credentialId, rawId: credentialId, type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(client("webauthn.create", challenge, usedOrigin)),
          attestationObject: b64(attestation), transports: ["internal"] } };
    },
    assert(challenge, options = {}) {
      counter += 1;
      const count = Buffer.alloc(4); count.writeUInt32BE(counter);
      const authData = Buffer.concat([rpHash, Buffer.from([options.noPresence ? 0x04 : options.noVerification ? 0x01 : 0x05]), count]);
      const clientDataJSON = client("webauthn.get", challenge, options.origin ?? origin);
      const signature = sign("sha256", Buffer.concat([authData, hash(clientDataJSON)]), privateKey);
      return { id: credentialId, rawId: credentialId, type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData),
          signature: b64(signature) } };
    },
  };
}

check("baseline 3E e API locais preservadas", base === "http://127.0.0.1:54321");
const { accounts, adminAccessToken } = await createPreviewAccounts();
const joao = await login(accounts.joao), maria = await login(accounts.maria);
const inactive = await login(accounts.inativo);
const adminId = JSON.parse(Buffer.from(adminAccessToken.split(".")[1], "base64url")).sub;
const state = await portal(joao, { action: "state" });
check("A: cadastro voluntário; portal acessível sem credencial", state.status === 200 &&
  state.data.methods.length === 0 && state.data.events.length === 0);
check("R/T: funcionário inativo não inicia cadastro", (await portal(inactive,
  { action: "register_start" })).status >= 400);
check("Z: Gestão não cadastra método do funcionário", (await portal(adminAccessToken,
  { action: "register_start" })).status >= 400);
const revokedLogin = await call("/auth/v1/token?grant_type=password", anon,
  { email: accounts.revogada.email, password: accounts.revogada.password });
check("S: identidade revogada não cadastra método", revokedLogin.status >= 400 ||
  (await portal(revokedLogin.data.access_token, { action: "register_start" })).status >= 400);
check("origem externa bloqueada", (await portal(joao, { action: "state" },
  { origin: "http://127.0.0.1:3101" })).status === 403);
check("querystring não altera autorização", (await portal(joao, { action: "state" },
  { query: "?employee_id=" + accounts.maria.employeeId })).status === 403);
check("G/J: employee_id injetado no corpo é recusado", (await portal(joao,
  { action: "register_start", employee_id: accounts.maria.employeeId })).status >= 400);
check("G/J: delivery_id injetado no corpo é recusado", (await portal(joao,
  { action: "register_start", delivery_id: randomUUID() })).status >= 400);
check("RLS/grants: authenticated, anon e service_role não leem credenciais",
  sql(`select has_table_privilege('authenticated','private.epi_signature_credentials_3f','SELECT'),
    has_table_privilege('anon','private.epi_signature_credentials_3f','SELECT'),
    has_table_privilege('service_role','private.epi_signature_events_3f','SELECT')`) === "f|f|f");
check("RPC: nenhuma função pública 3F nova", sql(`select count(*) from pg_proc
  where pronamespace='public'::regnamespace and proname like '%_3f'`) === "0");
check("RLS: todas as quatro tabelas privadas estão protegidas", sql(`select count(*) from pg_class
  where relnamespace='private'::regnamespace and relname like 'epi_signature_%_3f' and relrowsecurity`) === "4");
check("AB/AC: colunas não contêm PIN, biometria ou chave privada", sql(`select count(*) from information_schema.columns
  where table_schema='private' and table_name like 'epi_signature_%_3f'
  and column_name ~* '(private_key|pin|biometr|fingerprint|face)'`) === "0");

const abandoned = await portal(joao, { action: "register_start" });
check("B: cancelamento deixa só challenge, sem credencial", abandoned.status === 200 &&
  sql(`select count(*) from private.epi_signature_credentials_3f where account_id=${quote(accounts.joao.id)}::uuid`) === "0");
const regStart = await portal(joao, { action: "register_start" });
assert.equal(regStart.status, 200);
const a1 = virtualAuthenticator();
const wrongOrigin = await portal(joao, { action: "register_finish", challenge_id: regStart.data.challenge_id,
  response: a1.register(regStart.data.options.challenge, "http://evil.invalid") });
check("D: origin inválido não cadastra", wrongOrigin.status >= 400);
check("G: Maria não consome challenge de João", (await portal(maria, { action: "register_finish",
  challenge_id: regStart.data.challenge_id, response: a1.register(regStart.data.options.challenge) })).status >= 400);
const registered = await portal(joao, { action: "register_finish", challenge_id: regStart.data.challenge_id,
  response: a1.register(regStart.data.options.challenge) });
check("C: registro WebAuthn real validado", registered.status === 200 && registered.data.saved === true);
check("F: challenge de cadastro é de uso único", (await portal(joao, { action: "register_finish",
  challenge_id: regStart.data.challenge_id, response: a1.register(regStart.data.options.challenge) })).status >= 400);
check("credencial pessoal não exposta pelo PostgREST", (await call(
  "/rest/v1/epi_signature_credentials_3f?select=*", joao, null, "GET")).status >= 400);
const registeredState = await portal(joao, { action: "state" });
check("método aparece só para seu titular", registeredState.data.methods.length === 1 &&
  registeredState.data.methods[0].id === a1.id &&
  (await portal(maria, { action: "state" })).data.methods.length === 0);
const secondJoaoSession = await login(accounts.joao);
const tiedToFirstSession = await portal(joao, { action: "register_start" });
check("U/V: challenge de uma sessão não serve na outra", (await portal(secondJoaoSession,
  { action: "register_finish", challenge_id: tiedToFirstSession.data.challenge_id,
    response: virtualAuthenticator().register(tiedToFirstSession.data.options.challenge) })).status >= 400);

const tag = Date.now();
async function seedGroup(employee, name, { unit = "par", ca = "CA-3F-123" } = {}) {
  const item = sql(`insert into public.epi_items(code,name,item_kind,unit,created_by)
    values(${quote(`3F-${tag}-${name}`)},${quote(name)},'epi',${quote(unit)},${quote(adminId)}::uuid) returning id`);
  const stock = sql(`insert into public.epi_stock_batches(item_id,quantity,ca_number,lot_number,brand_model,created_by)
    values(${quote(item)}::uuid,6,${quote(ca)},'L-3F','Marca de teste',${quote(adminId)}::uuid) returning id`);
  const prep = await rpc("prepare_epi_kit_3d", adminAccessToken, { p_employee_id: employee.employeeId,
    p_lines: [{ item_id: item, stock_batch_id: stock, quantity: 1 }], p_idempotency_key: randomUUID() });
  assert.equal(prep.status, 200);
  const delivery = await rpc("register_epi_delivery_3d", adminAccessToken,
    { p_preparation_id: prep.data, p_idempotency_key: randomUUID() });
  assert.equal(delivery.status, 200);
  return delivery.data;
}
const group1 = await seedGroup(accounts.joao, "Luva 3F primeira");
const groupMaria = await seedGroup(accounts.maria, "Luva 3F Maria");
check("G: João não inicia assinatura da entrega de Maria", (await portal(joao,
  { action: "sign_start", group_id: groupMaria })).status >= 400);
check("G: Maria não usa credential_id de João", (await portal(maria,
  { action: "sign_start", group_id: groupMaria, credential_id: a1.id })).status >= 400);
const start1 = await portal(joao, { action: "sign_start", group_id: group1 });
check("snapshot 3D é apresentado antes da confirmação", start1.status === 200 &&
  start1.data.payload.items[0].item_name === "Luva 3F primeira" &&
  start1.data.payload.items[0].ca === "CA-3F-123" && start1.data.payload.group_id === group1);
check("challenge aleatório é vinculado à transação e hash", sql(`select count(*) from private.epi_signature_challenges_3f
  where id=${quote(start1.data.challenge_id)}::uuid and group_id=${quote(group1)}::uuid
  and payload_hash is not null and transaction_id=${quote(start1.data.payload.transaction_id)}::uuid`) === "1");
check("D: challenge de assinatura errado é negado", (await portal(joao,
  { action: "sign_finish", challenge_id: start1.data.challenge_id,
    response: a1.assert(b64(randomBytes(32))) })).status >= 400);
const forged = virtualAuthenticator().assert(start1.data.options.challenge);
forged.id = a1.id; forged.rawId = a1.id;
check("Y/Z: servidor/Gestão sem chave privada não produz assinatura válida", (await portal(joao,
  { action: "sign_finish", challenge_id: start1.data.challenge_id,
    response: forged })).status >= 400);
check("UV obrigatória: sem verificação local não assina", (await portal(joao,
  { action: "sign_finish", challenge_id: start1.data.challenge_id,
    response: a1.assert(start1.data.options.challenge, { noVerification: true }) })).status >= 400);
check("UP obrigatória: sem presença local não assina", (await portal(joao,
  { action: "sign_finish", challenge_id: start1.data.challenge_id,
    response: a1.assert(start1.data.options.challenge, { noPresence: true }) })).status >= 400);
check("G: Maria não consome challenge de João", (await portal(maria,
  { action: "sign_finish", challenge_id: start1.data.challenge_id,
    response: a1.assert(start1.data.options.challenge) })).status >= 400);
check("L/F: duas abas, uma resposta válida no máximo", await (async () => {
  const answer = a1.assert(start1.data.options.challenge);
  const results = await Promise.all([portal(joao, { action: "sign_finish",
    challenge_id: start1.data.challenge_id, response: answer }), portal(joao,
    { action: "sign_finish", challenge_id: start1.data.challenge_id, response: answer })]);
  return results.filter(item => item.status === 200).length === 1 && results.filter(item => item.status >= 400).length === 1;
})());
check("K: único evento reforçado e confirmação 3D atômicos", sql(`select
  (select count(*) from private.epi_signature_events_3f where group_id=${quote(group1)}::uuid),
  (select count(*) from public.epi_delivery_feedback_events_3d where group_id=${quote(group1)}::uuid and event_type='CONFIRMADO')`) === "1|1");
check("M: novo desafio para grupo confirmado não duplica", (await portal(joao,
  { action: "sign_start", group_id: group1 })).status >= 400);
check("O: evento reforçado e confirmação 3D permanecem após nova leitura", (await portal(joao,
  { action: "state" })).data.events.some(event => event.group_id === group1));
const own3d = await rpc("my_epi_delivery_groups_3d", joao);
check("AE: regressão 3D mostra grupo confirmado ao titular", own3d.status === 200 &&
  own3d.data.some(group => group.group_id === group1 && group.feedback_status === "CONFIRMADO"));
const own3e = await rpc("my_epi_report_3e", joao);
check("AF: relatório 3E conserva entrega e evento de confirmação reais", own3e.status === 200 &&
  own3e.data.deliveries.some(item => item.group_id === group1) &&
  own3e.data.feedback.some(item => item.group_id === group1));
check("AA: snapshot posterior alterado é detectado por hash, sem reescrever evento", await (async () => {
  const event = sql(`select payload_hash from private.epi_signature_events_3f where group_id=${quote(group1)}::uuid`);
  const { payload } = start1.data;
  const changed = { ...payload, items: [{ ...payload.items[0], quantity: 2 }] };
  return event === createHash("sha256").update(JSON.stringify(payload)).digest("hex") &&
    event !== createHash("sha256").update(JSON.stringify(changed)).digest("hex");
})());
check("histórico append-only rejeita UPDATE", sql(`do $$ begin
  begin update private.epi_signature_events_3f set payload_hash=repeat('0',64)
    where group_id=${quote(group1)}::uuid;
    raise exception 'update_should_fail';
  exception when others then if SQLERRM='update_should_fail' then raise; end if; end;
end $$; select count(*) from private.epi_signature_events_3f where group_id=${quote(group1)}::uuid`) === "1");

const group2 = await seedGroup(accounts.joao, "Luva 3F segunda");
const preRevoke = await portal(joao, { action: "sign_start", group_id: group2 });
check("segundo grupo ainda pendente antes da revogação", preRevoke.status === 200);
check("N: titular revoga o próprio método", (await portal(joao,
  { action: "revoke", credential_id: a1.id })).status === 200);
check("H: Maria não revoga método de João", (await portal(maria,
  { action: "revoke", credential_id: a1.id })).status >= 400);
check("Z: Gestão não revoga por rota pessoal", (await portal(adminAccessToken,
  { action: "revoke", credential_id: a1.id })).status >= 400);
check("N: challenge emitido antes da revogação não assina depois", (await portal(joao,
  { action: "sign_finish", challenge_id: preRevoke.data.challenge_id,
    response: a1.assert(preRevoke.data.options.challenge) })).status >= 400);
check("O: evidência anterior sobrevive à revogação", sql(`select count(*) from private.epi_signature_events_3f
  where group_id=${quote(group1)}::uuid and credential_id=${quote(a1.id)}`) === "1");
check("N: revogada não inicia nova assinatura", (await portal(joao,
  { action: "sign_start", group_id: group2, credential_id: a1.id })).status >= 400);
const reg2 = await portal(joao, { action: "register_start" });
const a2 = virtualAuthenticator();
check("P: nova passkey distinta após perda/revogação", reg2.status === 200 &&
  (await portal(joao, { action: "register_finish", challenge_id: reg2.data.challenge_id,
    response: a2.register(reg2.data.options.challenge) })).status === 200 && a2.id !== a1.id);
const reg3 = await portal(joao, { action: "register_start" });
const a3 = virtualAuthenticator();
check("Q: múltiplos dispositivos pessoais", reg3.status === 200 &&
  (await portal(joao, { action: "register_finish", challenge_id: reg3.data.challenge_id,
    response: a3.register(reg3.data.options.challenge) })).status === 200 &&
  (await portal(joao, { action: "state" })).data.methods.filter(item => !item.revoked_at).length === 2);
const start2 = await portal(joao, { action: "sign_start", group_id: group2 });
check("Q: sem seleção explícita, desafio aceita os dois métodos ativos do titular",
  start2.status === 200 && start2.data.options.allowCredentials.length === 2 &&
  start2.data.options.allowCredentials.some(item => item.id === a2.id) &&
  start2.data.options.allowCredentials.some(item => item.id === a3.id));
check("P/Q: passkey antiga ainda assina nova entrega", start2.status === 200 &&
  (await portal(joao, { action: "sign_finish", challenge_id: start2.data.challenge_id,
    response: a2.assert(start2.data.options.challenge) })).status === 200);
const raceGroup = await seedGroup(accounts.joao, "Luva 3F concorrência");
const raceA = await portal(joao, { action: "sign_start", group_id: raceGroup, credential_id: a2.id });
const raceB = await portal(joao, { action: "sign_start", group_id: raceGroup, credential_id: a3.id });
check("I: snapshot registrado da entrega não muda durante desafio", sql(`do $$ begin
  begin update public.epi_deliveries set item_name_snapshot='Outro item'
    where delivery_group_id=${quote(raceGroup)}::uuid;
    raise exception 'mutation_should_fail';
  exception when others then if SQLERRM='mutation_should_fail' then raise; end if; end;
end $$; select count(*) from public.epi_deliveries where delivery_group_id=${quote(raceGroup)}::uuid
  and item_name_snapshot='Luva 3F concorrência'`) === "1");
check("L/concorrência: dois desafios em abas diferentes criam uma só assinatura", await (async () => {
  const results = await Promise.all([
    portal(joao, { action: "sign_finish", challenge_id: raceA.data.challenge_id,
      response: a2.assert(raceA.data.options.challenge) }),
    portal(joao, { action: "sign_finish", challenge_id: raceB.data.challenge_id,
      response: a3.assert(raceB.data.options.challenge) }),
  ]);
  return results.filter(result => result.status === 200).length === 1 &&
    sql(`select count(*) from private.epi_signature_events_3f
      where group_id=${quote(raceGroup)}::uuid`) === "1";
})());
const exp = await portal(joao, { action: "register_start" });
sql(`update private.epi_signature_challenges_3f
  set created_at=now()-interval '10 minutes',expires_at=now()-interval '9 minutes'
  where id=${quote(exp.data.challenge_id)}::uuid`);
check("E: challenge expirado não cadastra", (await portal(joao,
  { action: "register_finish", challenge_id: exp.data.challenge_id,
    response: virtualAuthenticator().register(exp.data.options.challenge) })).status >= 400);
const regMaria = await portal(maria, { action: "register_start" });
const mariaAuthenticator = virtualAuthenticator();
check("G: Maria só cadastra sua própria credencial", regMaria.status === 200 &&
  (await portal(maria, { action: "register_finish", challenge_id: regMaria.data.challenge_id,
    response: mariaAuthenticator.register(regMaria.data.options.challenge) })).status === 200);
const startMaria = await portal(maria, { action: "sign_start", group_id: groupMaria });
check("G: João não consome assinatura de Maria", startMaria.status === 200 &&
  (await portal(joao, { action: "sign_finish", challenge_id: startMaria.data.challenge_id,
    response: mariaAuthenticator.assert(startMaria.data.options.challenge) })).status >= 400);
const secondSessionState = await portal(secondJoaoSession, { action: "state" });
check("V: sessão independente do mesmo titular enxerga somente seus métodos", secondSessionState.status === 200 &&
  secondSessionState.data.methods.length === 3 &&
  secondSessionState.data.methods.every(item => [a1.id, a2.id, a3.id].includes(item.id)));
const logoutResponse = await call("/auth/v1/logout", secondJoaoSession, {});
check("U: logout invalida token da sessão anterior", logoutResponse.status < 300 &&
  (await portal(secondJoaoSession, { action: "state" })).status >= 400);
check("X: resposta do transporte pessoal proíbe cache", await (async () => {
  const response = await fetch(`${origin}/api/laboratorio/assinatura-epi`, { method: "POST",
    headers: { Origin: origin, Authorization: `Bearer ${maria}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "state" }) });
  return response.status === 200 && response.headers.get("cache-control")?.includes("no-store");
})());

// A conta manual nasce limpa; não reutilizar o ator do teste automatizado, que já cadastrou métodos.
const manualHelper = await import(`../laboratorio-marco-1a/criar-contas-previa-1b.mjs?manual=${randomUUID()}`);
const manualAccounts = (await manualHelper.createPreviewAccounts()).accounts;
const manualGroups = [await seedGroup(manualAccounts.joao, "Capacete 3F para avaliação",
  { unit: "unidade", ca: "31234" }),
  await seedGroup(manualAccounts.joao, "Luva 3F para avaliar nova credencial",
    { unit: "par", ca: "31235" })];
const manualDirectory = new URL("../../backups/", import.meta.url);
mkdirSync(manualDirectory, { recursive: true });
writeFileSync(new URL("credenciais-previa-assinatura-3f.json", manualDirectory), JSON.stringify({
  note: "Somente laboratório sintético local; não compartilhar nem incluir em ZIP.",
  portal: origin + "/colaborador/login",
  joao: { email: manualAccounts.joao.email, password: manualAccounts.joao.password,
    pending_delivery_groups: manualGroups },
  maria: { email: manualAccounts.maria.email, password: manualAccounts.maria.password },
}, null, 2) + "\n", { mode: 0o600 });
check("prévia manual possui duas entregas sintéticas pendentes", manualGroups.length === 2 &&
  manualGroups.every(groupId => sql(`select count(*) from public.epi_delivery_groups_3d
    where id=${quote(groupId)}::uuid and employee_id=${quote(manualAccounts.joao.employeeId)}::uuid`) === "1") &&
  sql(`select count(*) from private.epi_signature_credentials_3f
    where account_id=${quote(manualAccounts.joao.id)}::uuid`) === "0");

evidence.passed = evidence.checks.filter(item => item.ok).length;
evidence.total = evidence.checks.length;
writeFileSync(new URL("./resultado-3f.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.log(`Marco 3F laboratório: ${evidence.passed}/${evidence.total}`);
