// Marco 3F no TESTE ONLINE: confirmação de recebimento de EPI com biometria do celular (passkey/WebAuthn).
// Porte fiel de 01_WEB/03_FUNCOES_E_LOGICA/Assinatura/assinatura-servico-3f.ts + 05_ACESSO_A_DADOS/Assinatura/assinatura-local-3f.ts.
// Mesmas tabelas privadas, mesmas regras; só muda o endereço (RP) e o transporte (Edge Function em vez de rota local).
// Não registra token, desafio, resposta do autenticador ou dado do funcionário em log.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON, type AuthenticatorTransportFuture,
} from "npm:@simplewebauthn/server@14.0.2";
import { z } from "npm:zod@4.5.4";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { canonicalDelivery3f, type DeliverySnapshot3f } from "./canonico.ts";

const ORIGIN = "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const RP_ID = "metallo-teste-colaborador.metallo-gunswiz.workers.dev";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pooler em modo transação (Supavisor): o banco do plano grátis aceita só 60 conexões diretas.
const dbUrl = new URL(Deno.env.get("SUPABASE_DB_URL")!);
const ref = new URL(Deno.env.get("SUPABASE_URL")!).hostname.split(".")[0];
const sql = postgres({ host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}`, password: decodeURIComponent(dbUrl.password),
  database: "postgres", ssl: "require", prepare: false, max: 3, idle_timeout: 5, connect_timeout: 10, onnotice: () => {} });
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

type Tx = postgres.TransactionSql;
type Actor = { accountId: string; identityId: string; employeeId: string; employeeName: string };
type Credential = { credential_id: string; public_key: string; counter: string; device_type: string;
  backed_up: boolean; transports: string[]; created_at: Date; revoked_at: Date | null };
type Challenge = { id: string; challenge: string; purpose: string; credential_id: string | null; group_id: string | null;
  transaction_id: string; payload_canonical: string | null; payload_hash: string | null };

// Todos os parâmetros vão como texto e são convertidos no SQL: tipos explícitos, sem inferência do driver.
const q = <T>(tx: Tx, text: string, params: (string | null)[] = []) => tx.unsafe(text, params) as unknown as Promise<T[]>;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function withActor<T>(token: string, work: (tx: Tx, actor: Actor) => Promise<T>): Promise<T> {
  if (!token || token.length > 8192) throw new Error("Sessão inválida.");
  const user = await auth.auth.getUser(token);
  if (user.error || !user.data.user?.id) throw new Error("Sessão inválida.");
  let claims: { sub?: string; session_id?: string };
  try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); }
  catch { throw new Error("Sessão inválida."); }
  if (claims.sub !== user.data.user.id || !claims.session_id || !UUID_RE.test(claims.session_id)) throw new Error("Sessão inválida.");
  const userId = user.data.user.id;
  return await sql.begin(async tx => {
    await q(tx, "select pg_catalog.set_config('request.jwt.claim.sub',$1::text,true)", [userId]);
    const session = await q(tx, `select 1 from auth.sessions where id=$1::text::uuid and user_id=auth.uid()
      and (not_after is null or not_after>now()) for share`, [claims.session_id!]);
    if (session.length !== 1) throw new Error("Sessão encerrada.");
    const found = await q<{ account_id: string; identity_id: string; employee_id: string; employee_name: string }>(tx, `
      select a.auth_user_id::text account_id, i.id::text identity_id, e.id::text employee_id, e.full_name employee_name
      from private.employee_identity i
      join private.employee_portal_accounts a on a.auth_user_id=i.auth_user_id
      join public.profiles p on p.id=i.auth_user_id and not p.active
      join public.epi_employees e on e.id=i.employee_id and e.active
      where i.auth_user_id=auth.uid() and i.status='active'
      for share of i,a,p,e`);
    if (found.length !== 1 || found[0].account_id !== userId) throw new Error("Vínculo pessoal indisponível.");
    const row = found[0];
    return work(tx, { accountId: row.account_id, identityId: row.identity_id, employeeId: row.employee_id, employeeName: row.employee_name });
  }) as T;
}

const credentialColumns = `credential_id,public_key,counter::text counter,device_type,backed_up,transports,created_at,revoked_at`;
function credentials(tx: Tx, a: Actor) {
  return q<Credential>(tx, `select ${credentialColumns} from private.epi_signature_credentials_3f
    where account_id=$1::text::uuid and identity_id=$2::text::uuid and employee_id=$3::text::uuid
    order by created_at desc,credential_id`, [a.accountId, a.identityId, a.employeeId]);
}
const active = (rows: Credential[]) => rows.filter(row => row.revoked_at === null);
const transports = (items: string[]) => items as AuthenticatorTransportFuture[];

async function deliverySnapshot(tx: Tx, a: Actor, groupId: string): Promise<DeliverySnapshot3f> {
  const group = await q<{ employee_id: string; group_id: string; delivered_at: Date }>(tx, `
    select g.employee_id::text employee_id,g.id::text group_id,g.delivered_at from public.epi_delivery_groups_3d g
    where g.id=$1::text::uuid and g.employee_id=$2::text::uuid for share`, [groupId, a.employeeId]);
  if (group.length !== 1) throw new Error("Entrega indisponível.");
  const items = await q<DeliverySnapshot3f["items"][number]>(tx, `
    select d.id::text delivery_id,d.item_name_snapshot item_name,d.item_code_snapshot item_code,
      d.ca_snapshot ca,d.quantity,d.unit_snapshot unit,d.variant_snapshot size,
      d.lot_snapshot lot,d.brand_model_snapshot brand
    from public.epi_deliveries d where d.delivery_group_id=$1::text::uuid and d.employee_id=$2::text::uuid
    order by d.id for share`, [groupId, a.employeeId]);
  if (items.length < 1) throw new Error("Entrega sem itens.");
  const g = group[0];
  return { employee_id: g.employee_id, group_id: g.group_id, delivered_at: new Date(g.delivered_at).toISOString(),
    items: items.map(item => ({ ...item, quantity: Number(item.quantity) })) };
}

async function startChallenge(tx: Tx, a: Actor, v: { id: string; sessionHash: string; purpose: "register" | "sign"; challenge: string;
  credentialId?: string; groupId?: string; transactionId: string; canonical?: string; snapshot?: DeliverySnapshot3f; payloadHash?: string }) {
  await q(tx, `insert into private.epi_signature_challenges_3f
    (id,account_id,identity_id,employee_id,session_hash,purpose,challenge,credential_id,group_id,
      transaction_id,payload_canonical,payload_snapshot,payload_hash,expires_at)
    values($1::text::uuid,$2::text::uuid,$3::text::uuid,$4::text::uuid,$5::text,$6::text,$7::text,$8::text,$9::text::uuid,
      $10::text::uuid,$11::text,$12::text::jsonb,$13::text,
      now()+case when $6::text='sign' then interval '5 minutes' else interval '2 minutes' end)`,
    [v.id, a.accountId, a.identityId, a.employeeId, v.sessionHash, v.purpose, v.challenge, v.credentialId ?? null,
      v.groupId ?? null, v.transactionId, v.canonical ?? null, v.snapshot ? JSON.stringify(v.snapshot) : null, v.payloadHash ?? null]);
}

async function pendingChallenge(tx: Tx, a: Actor, id: string, sessionHash: string, purpose: "register" | "sign") {
  const found = await q<Challenge>(tx, `select id::text id,challenge,purpose,credential_id,group_id::text group_id,
    transaction_id::text transaction_id,payload_canonical,payload_hash
    from private.epi_signature_challenges_3f
    where id=$1::text::uuid and account_id=$2::text::uuid and identity_id=$3::text::uuid and employee_id=$4::text::uuid
      and session_hash=$5::text and purpose=$6::text and consumed_at is null and expires_at>now() for update`,
    [id, a.accountId, a.identityId, a.employeeId, sessionHash, purpose]);
  if (found.length !== 1) throw new Error("Verificação vencida ou indisponível.");
  return found[0];
}

async function lastFeedbackAllowsConfirmation(tx: Tx, groupId: string) {
  const last = await q<{ event_type: string }>(tx, `select event_type from public.epi_delivery_feedback_events_3d
    where group_id=$1::text::uuid order by id desc limit 1`, [groupId]);
  // Marco 3I: após RECUSA registrada pela Gestão, o funcionário ainda pode confirmar.
  return !last.length || ["RESOLVIDA", "RECUSA"].includes(last[0].event_type);
}

function state(token: string) {
  return withActor(token, async (tx, a) => {
    const rows = await credentials(tx, a);
    const events = await q<{ signature_event_id: string; group_id: string; verified_at: Date }>(tx, `
      select id::text signature_event_id,group_id::text group_id,verified_at from private.epi_signature_events_3f
      where account_id=$1::text::uuid and identity_id=$2::text::uuid and employee_id=$3::text::uuid order by verified_at desc`,
      [a.accountId, a.identityId, a.employeeId]);
    return { methods: rows.map(row => ({ id: row.credential_id, created_at: row.created_at, revoked_at: row.revoked_at, method: "Passkey" })),
      events: events.map(row => ({ signature_event_id: row.signature_event_id, group_id: row.group_id, verified_at: row.verified_at })) };
  });
}

function registerStart(token: string) {
  return withActor(token, async (tx, a) => {
    const registered = await credentials(tx, a);
    const options = await generateRegistrationOptions({
      rpName: "Metallo (teste online)", rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(a.accountId.replaceAll("-", ""), "hex")),
      userName: a.accountId, userDisplayName: a.employeeName,
      attestationType: "none", timeout: 120000,
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: registered.map(row => ({ id: row.credential_id, transports: transports(row.transports) })),
    });
    const challengeId = randomUUID();
    await startChallenge(tx, a, { id: challengeId, purpose: "register", sessionHash: tokenHash(token), challenge: options.challenge, transactionId: randomUUID() });
    return { challenge_id: challengeId, options };
  });
}

function registerFinish(token: string, challengeId: string, response: RegistrationResponseJSON) {
  return withActor(token, async (tx, a) => {
    const challenge = await pendingChallenge(tx, a, challengeId, tokenHash(token), "register");
    const check = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserPresence: true, requireUserVerification: true });
    if (!check.verified || !check.registrationInfo.userVerified) throw new Error("Não foi possível validar o método.");
    const info = check.registrationInfo;
    await q(tx, `insert into private.epi_signature_credentials_3f
      (credential_id,account_id,identity_id,employee_id,public_key,counter,device_type,backed_up,transports)
      values($1::text,$2::text::uuid,$3::text::uuid,$4::text::uuid,$5::text,$6::text::bigint,$7::text,$8::text::boolean,
        array(select jsonb_array_elements_text($9::text::jsonb)))`,
      [info.credential.id, a.accountId, a.identityId, a.employeeId, Buffer.from(info.credential.publicKey).toString("base64url"),
        String(info.credential.counter), info.credentialDeviceType, String(info.credentialBackedUp),
        JSON.stringify(response.response.transports ?? [])]);
    await q(tx, "update private.epi_signature_challenges_3f set consumed_at=now() where id=$1::text::uuid", [challenge.id]);
    return { saved: true };
  });
}

function signStart(token: string, groupId: string, selected?: string) {
  return withActor(token, async (tx, a) => {
    const methods = active(await credentials(tx, a));
    const credential = selected ? methods.find(row => row.credential_id === selected) : undefined;
    if (methods.length === 0 || (selected && !credential)) throw new Error("Ative sua proteção antes de confirmar com credencial.");
    const snapshot = await deliverySnapshot(tx, a, groupId);
    const already = await q(tx, "select 1 from private.epi_signature_events_3f where group_id=$1::text::uuid", [groupId]);
    if (already.length) throw new Error("Esta entrega já tem confirmação reforçada.");
    if (!(await lastFeedbackAllowsConfirmation(tx, groupId))) throw new Error("Entrega já respondida.");
    const transactionId = randomUUID();
    const { payload, canonical, hash } = canonicalDelivery3f(snapshot, transactionId);
    const options = await generateAuthenticationOptions({ rpID: RP_ID, timeout: 120000, userVerification: "required",
      allowCredentials: (credential ? [credential] : methods).map(row => ({ id: row.credential_id, transports: transports(row.transports) })) });
    const challengeId = randomUUID();
    await startChallenge(tx, a, { id: challengeId, purpose: "sign", sessionHash: tokenHash(token), challenge: options.challenge,
      transactionId, credentialId: credential?.credential_id, groupId, canonical, snapshot, payloadHash: hash });
    return { challenge_id: challengeId, options, payload };
  });
}

function signFinish(token: string, challengeId: string, response: AuthenticationResponseJSON) {
  return withActor(token, async (tx, a) => {
    const challenge = await pendingChallenge(tx, a, challengeId, tokenHash(token), "sign");
    if (challenge.credential_id && response.id !== challenge.credential_id) throw new Error("Método incorreto.");
    const found = await q<Credential>(tx, `select ${credentialColumns} from private.epi_signature_credentials_3f
      where credential_id=$1::text and account_id=$2::text::uuid and identity_id=$3::text::uuid and employee_id=$4::text::uuid
      and revoked_at is null for update`, [response.id, a.accountId, a.identityId, a.employeeId]);
    if (found.length !== 1) throw new Error("Método revogado ou indisponível.");
    const credential = found[0];
    const check = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN, expectedRPID: RP_ID,
      credential: { id: credential.credential_id, publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64url")),
        counter: Number(credential.counter), transports: transports(credential.transports) },
      requireUserVerification: true });
    if (!check.verified || !check.authenticationInfo.userVerified) throw new Error("Assinatura inválida.");
    const verifiedCounter = check.authenticationInfo.newCounter;
    if (!challenge.group_id || !challenge.payload_canonical || !challenge.payload_hash) throw new Error("Desafio incompleto.");
    await q(tx, "select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1::text,8033))", [challenge.group_id]);
    const projection = canonicalDelivery3f(await deliverySnapshot(tx, a, challenge.group_id), challenge.transaction_id);
    if (projection.canonical !== challenge.payload_canonical || projection.hash !== challenge.payload_hash) throw new Error("Entrega alterada. Confira novamente.");
    if (!(await lastFeedbackAllowsConfirmation(tx, challenge.group_id))) throw new Error("Entrega já respondida.");
    const stored = Number(credential.counter);
    if (verifiedCounter < stored || (stored !== 0 && verifiedCounter === stored)) throw new Error("Contador da credencial inválido.");
    const updated = await q(tx, `update private.epi_signature_credentials_3f set counter=$1::text::bigint
      where credential_id=$2::text and account_id=$3::text::uuid and revoked_at is null
        and (counter<$1::text::bigint or (counter=0 and $1::text::bigint=0)) returning 1`, [String(verifiedCounter), credential.credential_id, a.accountId]);
    if (updated.length !== 1) throw new Error("Credencial revogada ou reutilizada.");
    const feedback = await q<{ id: string }>(tx, `insert into public.epi_delivery_feedback_events_3d
      (group_id,event_type,actor_id,idempotency_key) values($1::text::uuid,'CONFIRMADO',$2::text::uuid,$3::text::uuid) returning id::text id`,
      [challenge.group_id, a.accountId, challenge.transaction_id]);
    const eventId = randomUUID();
    await q(tx, `insert into private.epi_signature_events_3f
      (id,challenge_id,account_id,identity_id,employee_id,credential_id,group_id,feedback_id,
        transaction_id,payload_version,payload_canonical,payload_hash,assertion,verified_counter)
      values($1::text::uuid,$2::text::uuid,$3::text::uuid,$4::text::uuid,$5::text::uuid,$6::text,$7::text::uuid,$8::text::bigint,
        $9::text::uuid,'3F-v1',$10::text,$11::text,$12::text::jsonb,$13::text::bigint)`,
      [eventId, challenge.id, a.accountId, a.identityId, a.employeeId, credential.credential_id, challenge.group_id, feedback[0].id,
        challenge.transaction_id, challenge.payload_canonical, challenge.payload_hash,
        JSON.stringify({ id: response.id, clientDataJSON: response.response.clientDataJSON,
          authenticatorData: response.response.authenticatorData, signature: response.response.signature }), String(verifiedCounter)]);
    await q(tx, "update private.epi_signature_challenges_3f set consumed_at=now() where id=$1::text::uuid", [challenge.id]);
    return { signature_event_id: eventId, feedback_id: feedback[0].id, code: challenge.payload_hash };
  });
}

function revoke(token: string, credentialId: string) {
  return withActor(token, async (tx, a) => {
    const changed = await q(tx, `update private.epi_signature_credentials_3f set revoked_at=now(),revoked_by=$1::text::uuid
      where credential_id=$2::text and account_id=$1::text::uuid and identity_id=$3::text::uuid and employee_id=$4::text::uuid
        and revoked_at is null returning 1`, [a.accountId, credentialId, a.identityId, a.employeeId]);
    if (changed.length !== 1) throw new Error("Método indisponível.");
    await q(tx, `insert into private.epi_signature_revocations_3f (credential_id,account_id,actor_id,reason)
      values($1::text,$2::text::uuid,$2::text::uuid,'owner')`, [credentialId, a.accountId]);
    return { revoked: true };
  });
}

// Marco 3J: confirmação com a SENHA da conta (para quem não usa digital ou está no aparelho do almoxarifado).
// A senha é conferida no Auth; a sessão criada para conferir é encerrada na hora. Limite: 5 erros em 15 minutos.
async function passwordConfirm(token: string, groupId: string, password: string, key: string) {
  const who = await withActor(token, async (tx, a) => {
    const [row] = await q<{ email: string }>(tx, "select email from auth.users where id=$1::text::uuid", [a.accountId]);
    const [fails] = await q<{ n: string }>(tx, `select count(*)::text n from private.epi_tentativa_senha_3j
      where account_id=$1::text::uuid and not ok and at>clock_timestamp()-interval '15 minutes'`, [a.accountId]);
    if (Number(fails.n) >= 5) throw new Error("muitas_tentativas");
    return { actor: a, email: row?.email ?? "" };
  });
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const check = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email: who.email, password }) });
  const ok = check.ok;
  if (ok) {
    const session = await check.json() as { access_token?: string };
    if (session.access_token) await fetch(`${url}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: anon, Authorization: `Bearer ${session.access_token}` } });
  } else await check.text();
  await q(sql as unknown as Tx, "insert into private.epi_tentativa_senha_3j(account_id,ok) values($1::text::uuid,$2::text::boolean)", [who.actor.accountId, String(ok)]);
  if (!ok) throw new Error("senha_incorreta");
  return withActor(token, async (tx, a) => {
    if (a.accountId !== who.actor.accountId) throw new Error("Sessão inválida.");
    await q(tx, "select pg_catalog.set_config('metallo.confirmacao_3j','ok',true)");
    // Código de verificação (3M): o mesmo resumo SHA-256 do formato 3F-v1, gravado na hora da confirmação.
    const projection = canonicalDelivery3f(await deliverySnapshot(tx, a, groupId), key);
    const [fb] = await q<{ id: string }>(tx, "select public.respond_epi_delivery_3d($1::text::uuid,'CONFIRMADO',null,null,null,$2::text::uuid)::text id", [groupId, key]);
    await q(tx, `insert into private.epi_confirmacao_senha_3j(group_id,feedback_id,account_id,employee_id,method,
        payload_version,payload_canonical,payload_hash)
      values($1::text::uuid,$2::text::bigint,$3::text::uuid,$4::text::uuid,'senha-reautenticacao','3F-v1',$5::text,$6::text)
      on conflict (group_id) do nothing`, [groupId, fb.id, a.accountId, a.employeeId, projection.canonical, projection.hash]);
    const [saved] = await q<{ payload_hash: string | null }>(tx,
      "select payload_hash from private.epi_confirmacao_senha_3j where group_id=$1::text::uuid", [groupId]);
    return { feedback_id: fb.id, method: "senha", code: saved?.payload_hash ?? null };
  });
}

const id = z.uuid();
const credentialText = z.string().regex(/^[A-Za-z0-9_-]{20,2048}$/);
const webauthn = z.object({ id: credentialText, rawId: credentialText, type: z.literal("public-key"),
  response: z.record(z.string(), z.unknown()), clientExtensionResults: z.record(z.string(), z.unknown()) }).passthrough();
const registrationResponse = webauthn.extend({ response: z.object({ clientDataJSON: credentialText, attestationObject: credentialText,
  transports: z.array(z.string()).optional() }).passthrough() });
const authenticationResponse = webauthn.extend({ response: z.object({ clientDataJSON: credentialText,
  authenticatorData: credentialText, signature: credentialText }).passthrough() });
const payloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }).strict(),
  z.object({ action: z.literal("register_start") }).strict(),
  z.object({ action: z.literal("register_finish"), challenge_id: id, response: registrationResponse }).strict(),
  z.object({ action: z.literal("sign_start"), group_id: id, credential_id: credentialText.optional() }).strict(),
  z.object({ action: z.literal("sign_finish"), challenge_id: id, response: authenticationResponse }).strict(),
  z.object({ action: z.literal("revoke"), credential_id: credentialText }).strict(),
  z.object({ action: z.literal("password_confirm"), group_id: id, password: z.string().min(1).max(200), idempotency_key: id }).strict(),
]);

const baseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Origin": ORIGIN, "Vary": "Origin" };
const answer = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    if (request.headers.get("origin") !== ORIGIN) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: { ...baseHeaders, "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Max-Age": "600" } });
  }
  const url = new URL(request.url);
  if (request.method !== "POST" || request.headers.get("origin") !== ORIGIN || url.search)
    return answer({ error: "Disponível apenas no Colaborador de teste." }, 403);
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
  if (!token) return answer({ error: "Sessão inválida." }, 401);
  try {
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 50000) return answer({ error: "Pedido inválido." }, 413);
    const raw = await request.text();
    if (raw.length > 50000) return answer({ error: "Pedido inválido." }, 413);
    const body = payloadSchema.parse(JSON.parse(raw));
    switch (body.action) {
      case "state": return answer(await state(token));
      case "register_start": return answer(await registerStart(token));
      case "register_finish": return answer(await registerFinish(token, body.challenge_id, body.response as unknown as RegistrationResponseJSON));
      case "sign_start": return answer(await signStart(token, body.group_id, body.credential_id));
      case "sign_finish": return answer(await signFinish(token, body.challenge_id, body.response as unknown as AuthenticationResponseJSON));
      case "revoke": return answer(await revoke(token, body.credential_id));
      case "password_confirm": return answer(await passwordConfirm(token, body.group_id, body.password, body.idempotency_key));
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "senha_incorreta") return answer({ error: "Senha incorreta.", code }, 400);
    if (code === "muitas_tentativas") return answer({ error: "Muitas tentativas. Aguarde 15 minutos ou use a digital.", code }, 429);
    return answer({ error: "Não foi possível validar esta ação. Atualize os dados e tente novamente." }, 400);
  }
});
