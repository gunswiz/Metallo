import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { createClient } from "@supabase/supabase-js";
import { canonicalDelivery3f, type DeliverySnapshot3f } from "@/03_FUNCOES_E_LOGICA/Assinatura/epi-signature-3f";

export const RP_ID_3F = "localhost";
export const ORIGIN_3F = "http://localhost:3101";
const ROOT = basename(process.cwd()) === "01_WEB" ? resolve(process.cwd(), "..") : process.cwd();
type LocalSettings = { API_URL: string; DB_URL: string; ANON_KEY: string };
let localSettings: LocalSettings | undefined;
let localPool: Pool | undefined;
function settings() {
  if (localSettings) return localSettings;
  const raw = execFileSync(process.execPath, [resolve(ROOT, "node_modules/supabase/dist/supabase.js"),
    "status", "--workdir", resolve(ROOT, "04_BANCO_E_SUPABASE/laboratorio-marco-1a"), "-o", "json"],
  { encoding: "utf8", windowsHide: true, timeout: 8000, env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" } });
  const value = JSON.parse(raw) as LocalSettings;
  const db = new URL(value.DB_URL);
  if (value.API_URL !== "http://127.0.0.1:54321" || db.hostname !== "127.0.0.1" || db.port !== "54322" ||
    !value.ANON_KEY || db.username !== "postgres") throw new Error("Laboratório local indisponível.");
  localSettings = value;
  return value;
}
function pool() {
  if (!localPool) localPool = new Pool({ connectionString: settings().DB_URL, max: 4,
    connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000 });
  return localPool;
}
export type Actor3f = { accountId: string; identityId: string; employeeId: string; employeeName: string };
export type Credential3f = { credential_id: string; public_key: string; counter: string;
  device_type: "singleDevice" | "multiDevice"; backed_up: boolean; transports: string[];
  created_at: string; revoked_at: string | null };
export type Challenge3f = { id: string; challenge: string; purpose: "register" | "sign";
  credential_id: string | null; group_id: string | null; transaction_id: string;
  payload_canonical: string | null; payload_hash: string | null };

export function tokenHash3f(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function withActor3f<T>(token: string, work: (db: PoolClient, actor: Actor3f) => Promise<T>): Promise<T> {
  if (!token || token.length > 8192) throw new Error("Sessão inválida.");
  const supabase = createClient(settings().API_URL, settings().ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const user = await supabase.auth.getUser(token);
  if (user.error || !user.data.user?.id) throw new Error("Sessão inválida.");
  let claims: { sub?: string; session_id?: string };
  try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); }
  catch { throw new Error("Sessão inválida."); }
  if (claims.sub !== user.data.user.id || !claims.session_id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id))
    throw new Error("Sessão inválida.");
  const db = await pool().connect();
  try {
    await db.query("begin");
    await db.query("select pg_catalog.set_config('request.jwt.claim.sub',$1,true)", [user.data.user.id]);
    const session = await db.query(`select 1 from auth.sessions
      where id=$1 and user_id=auth.uid() and (not_after is null or not_after>now()) for share`,
      [claims.session_id]);
    if (session.rows.length !== 1) throw new Error("Sessão encerrada.");
    const found = await db.query<{ account_id: string; identity_id: string; employee_id: string; employee_name: string }>(`
      select a.auth_user_id account_id, i.id identity_id, e.id employee_id, e.full_name employee_name
      from private.employee_identity i
      join private.employee_portal_accounts a on a.auth_user_id=i.auth_user_id
      join public.profiles p on p.id=i.auth_user_id and not p.active
      join public.epi_employees e on e.id=i.employee_id and e.active
      where i.auth_user_id=auth.uid() and i.status='active'
      for share of i,a,p,e`, []);
    if (found.rows.length !== 1 || found.rows[0].account_id !== user.data.user.id)
      throw new Error("Vínculo pessoal indisponível.");
    const row = found.rows[0];
    const result = await work(db, { accountId: row.account_id, identityId: row.identity_id,
      employeeId: row.employee_id, employeeName: row.employee_name });
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally { db.release(); }
}

export async function credentials3f(db: PoolClient, actor: Actor3f): Promise<Credential3f[]> {
  const rows = await db.query<Credential3f>(`select credential_id,public_key,counter::text,device_type,
    backed_up,transports,created_at,revoked_at from private.epi_signature_credentials_3f
    where account_id=$1 and identity_id=$2 and employee_id=$3 order by created_at desc,credential_id`,
    [actor.accountId, actor.identityId, actor.employeeId]);
  return rows.rows;
}

export async function deliverySnapshot3f(db: PoolClient, actor: Actor3f, groupId: string): Promise<DeliverySnapshot3f> {
  const group = await db.query<{ employee_id: string; group_id: string; delivered_at: Date }>(`
    select g.employee_id,g.id group_id,g.delivered_at from public.epi_delivery_groups_3d g
    where g.id=$1 and g.employee_id=$2 for share`, [groupId, actor.employeeId]);
  if (group.rows.length !== 1) throw new Error("Entrega indisponível.");
  const items = await db.query<{ delivery_id: string; item_name: string; item_code: string | null;
    ca: string | null; quantity: number; unit: string; size: string | null;
    lot: string | null; brand: string | null }>(`
    select d.id delivery_id,d.item_name_snapshot item_name,d.item_code_snapshot item_code,
      d.ca_snapshot ca,d.quantity,d.unit_snapshot unit,d.variant_snapshot size,
      d.lot_snapshot lot,d.brand_model_snapshot brand
    from public.epi_deliveries d where d.delivery_group_id=$1 and d.employee_id=$2
    order by d.id for share`, [groupId, actor.employeeId]);
  if (items.rows.length < 1) throw new Error("Entrega sem itens.");
  const g = group.rows[0];
  return { employee_id: g.employee_id, group_id: g.group_id,
    delivered_at: g.delivered_at.toISOString(), items: items.rows };
}

export async function startChallenge3f(db: PoolClient, actor: Actor3f, values: {
  id: string; sessionHash: string; purpose: "register" | "sign"; challenge: string;
  credentialId?: string; groupId?: string; transactionId: string;
  canonical?: string; snapshot?: DeliverySnapshot3f; payloadHash?: string;
}) {
  await db.query(`insert into private.epi_signature_challenges_3f
    (id,account_id,identity_id,employee_id,session_hash,purpose,challenge,credential_id,group_id,
      transaction_id,payload_canonical,payload_snapshot,payload_hash,expires_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
      now()+case when $6='sign' then interval '5 minutes' else interval '2 minutes' end)`,
    [values.id,actor.accountId,actor.identityId,actor.employeeId,values.sessionHash,
      values.purpose,values.challenge,values.credentialId ?? null,values.groupId ?? null,
      values.transactionId,values.canonical ?? null,values.snapshot ? JSON.stringify(values.snapshot) : null,
      values.payloadHash ?? null]);
}

export async function pendingChallenge3f(db: PoolClient, actor: Actor3f,
  id: string, sessionHash: string, purpose: "register" | "sign"): Promise<Challenge3f> {
  const found = await db.query<Challenge3f>(`select id,challenge,purpose,credential_id,group_id,
    transaction_id,payload_canonical,payload_hash
    from private.epi_signature_challenges_3f
    where id=$1 and account_id=$2 and identity_id=$3 and employee_id=$4
      and session_hash=$5 and purpose=$6 and consumed_at is null and expires_at>now() for update`,
    [id,actor.accountId,actor.identityId,actor.employeeId,sessionHash,purpose]);
  if (found.rows.length !== 1) throw new Error("Verificação vencida ou indisponível.");
  return found.rows[0];
}

export async function finishRegistration3f(db: PoolClient, actor: Actor3f, challenge: Challenge3f,
  credential: { id: string; publicKey: string; counter: number; deviceType: string;
    backedUp: boolean; transports: string[] }) {
  await db.query(`insert into private.epi_signature_credentials_3f
    (credential_id,account_id,identity_id,employee_id,public_key,counter,device_type,backed_up,transports)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [credential.id,actor.accountId,actor.identityId,actor.employeeId,credential.publicKey,
      credential.counter,credential.deviceType,credential.backedUp,credential.transports]);
  await db.query("update private.epi_signature_challenges_3f set consumed_at=now() where id=$1", [challenge.id]);
}

export async function finishSignature3f(db: PoolClient, actor: Actor3f, challenge: Challenge3f,
  credential: Credential3f, verifiedCounter: number, assertion: unknown) {
  if (!challenge.group_id || !challenge.payload_canonical || !challenge.payload_hash) throw new Error("Desafio incompleto.");
  await db.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1,8033))", [challenge.group_id]);
  const current = await deliverySnapshot3f(db, actor, challenge.group_id);
  const projection = canonicalDelivery3f(current, challenge.transaction_id);
  if (projection.canonical !== challenge.payload_canonical || projection.hash !== challenge.payload_hash)
    throw new Error("Entrega alterada. Confira novamente.");
  const last = await db.query<{ event_type: string }>(`select event_type from public.epi_delivery_feedback_events_3d
    where group_id=$1 order by id desc limit 1`, [challenge.group_id]);
  if (last.rows.length && last.rows[0].event_type !== "RESOLVIDA") throw new Error("Entrega já respondida.");
  if (verifiedCounter < Number(credential.counter) ||
    (Number(credential.counter) !== 0 && verifiedCounter === Number(credential.counter)))
    throw new Error("Contador da credencial inválido.");
  const updated = await db.query(`update private.epi_signature_credentials_3f
    set counter=$1 where credential_id=$2 and account_id=$3 and revoked_at is null
      and (counter<$1 or (counter=0 and $1=0))`, [verifiedCounter,credential.credential_id,actor.accountId]);
  if (updated.rowCount !== 1) throw new Error("Credencial revogada ou reutilizada.");
  const feedback = await db.query<{ id: string }>(`insert into public.epi_delivery_feedback_events_3d
    (group_id,event_type,actor_id,idempotency_key) values($1,'CONFIRMADO',$2,$3) returning id::text`,
    [challenge.group_id,actor.accountId,challenge.transaction_id]);
  const eventId = randomUUID();
  await db.query(`insert into private.epi_signature_events_3f
    (id,challenge_id,account_id,identity_id,employee_id,credential_id,group_id,feedback_id,
      transaction_id,payload_version,payload_canonical,payload_hash,assertion,verified_counter)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,'3F-v1',$10,$11,$12,$13)`,
    [eventId,challenge.id,actor.accountId,actor.identityId,actor.employeeId,credential.credential_id,
      challenge.group_id,feedback.rows[0].id,challenge.transaction_id,challenge.payload_canonical,
      challenge.payload_hash,JSON.stringify(assertion),verifiedCounter]);
  await db.query("update private.epi_signature_challenges_3f set consumed_at=now() where id=$1", [challenge.id]);
  return { signature_event_id: eventId, feedback_id: feedback.rows[0].id };
}

export async function revokeCredential3f(db: PoolClient, actor: Actor3f, credentialId: string,
  reason: "owner" | "lost_device" | "incident" | "termination" = "owner") {
  const changed = await db.query(`update private.epi_signature_credentials_3f
    set revoked_at=now(),revoked_by=$1 where credential_id=$2 and account_id=$1 and identity_id=$3
      and employee_id=$4 and revoked_at is null`, [actor.accountId,credentialId,actor.identityId,actor.employeeId]);
  if (changed.rowCount !== 1) throw new Error("Método indisponível.");
  await db.query(`insert into private.epi_signature_revocations_3f
    (credential_id,account_id,actor_id,reason) values($1,$2,$2,$3)`,
    [credentialId,actor.accountId,reason]);
}
