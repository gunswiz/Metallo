import "server-only";
import { randomUUID } from "node:crypto";
import {
  generateAuthenticationOptions, generateRegistrationOptions,
  verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON,
  type AuthenticatorTransport,
} from "@simplewebauthn/server";
import {
  ORIGIN_3F, RP_ID_3F, withActor3f, tokenHash3f, credentials3f,
  deliverySnapshot3f, startChallenge3f, pendingChallenge3f, finishRegistration3f,
  finishSignature3f, revokeCredential3f, type Credential3f,
} from "@/05_ACESSO_A_DADOS/Assinatura/assinatura-local-3f";
import { canonicalDelivery3f } from "./epi-signature-3f";

function active(credentials: Credential3f[]) { return credentials.filter(item => item.revoked_at === null); }
const transports = (items: string[]) => items as AuthenticatorTransport[];

export async function signatureState3f(token: string) {
  return withActor3f(token, async (db, actor) => {
    const credentials = await credentials3f(db, actor);
    const events = await db.query<{ signature_event_id: string; group_id: string; verified_at: Date }>(`
      select id signature_event_id,group_id,verified_at from private.epi_signature_events_3f
      where account_id=$1 and identity_id=$2 and employee_id=$3 order by verified_at desc`,
      [actor.accountId,actor.identityId,actor.employeeId]);
    return { methods: credentials.map(row => ({ id: row.credential_id, created_at: row.created_at,
      revoked_at: row.revoked_at, method: "Passkey" })),
      events: events.rows.map(row => ({ signature_event_id: row.signature_event_id,
        group_id: row.group_id, verified_at: row.verified_at })) };
  });
}

export async function registrationStart3f(token: string) {
  return withActor3f(token, async (db, actor) => {
    const registered = await credentials3f(db, actor);
    const options = await generateRegistrationOptions({
      rpName: "Metallo Laboratório", rpID: RP_ID_3F,
      userID: new Uint8Array(Buffer.from(actor.accountId.replaceAll("-", ""), "hex")),
      userName: actor.accountId, userDisplayName: actor.employeeName,
      attestationType: "none", timeout: 120000,
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: registered.map(row => ({ id: row.credential_id, transports: row.transports })),
    });
    const challengeId = randomUUID();
    await startChallenge3f(db, actor, { id: challengeId, purpose: "register",
      sessionHash: tokenHash3f(token), challenge: options.challenge, transactionId: randomUUID() });
    return { challenge_id: challengeId, options };
  });
}

export async function registrationFinish3f(token: string, challengeId: string, response: RegistrationResponseJSON) {
  return withActor3f(token, async (db, actor) => {
    const challenge = await pendingChallenge3f(db, actor, challengeId, tokenHash3f(token), "register");
    const check = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge,
      expectedOrigin: ORIGIN_3F, expectedRPID: RP_ID_3F,
      requireUserPresence: true, requireUserVerification: true });
    if (!check.verified || !check.registrationInfo.userVerified) throw new Error("Não foi possível validar o método.");
    const info = check.registrationInfo;
    await finishRegistration3f(db, actor, challenge, {
      id: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
      counter: info.credential.counter, deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp, transports: response.response.transports ?? [],
    });
    return { saved: true };
  });
}

export async function signatureStart3f(token: string, groupId: string, selectedCredential?: string) {
  return withActor3f(token, async (db, actor) => {
    const methods = active(await credentials3f(db, actor));
    const credential = selectedCredential ? methods.find(row => row.credential_id === selectedCredential) : undefined;
    if (methods.length === 0 || (selectedCredential && !credential))
      throw new Error("Ative sua proteção antes de confirmar com credencial.");
    const snapshot = await deliverySnapshot3f(db, actor, groupId);
    const already = await db.query(`select 1 from private.epi_signature_events_3f where group_id=$1`, [groupId]);
    if (already.rows.length) throw new Error("Esta entrega já tem confirmação reforçada.");
    const last = await db.query<{ event_type: string }>(`select event_type from public.epi_delivery_feedback_events_3d
      where group_id=$1 order by id desc limit 1`, [groupId]);
    // Marco 3I: após RECUSA registrada pela Gestão, o funcionário ainda pode confirmar.
    if (last.rows.length && !["RESOLVIDA", "RECUSA"].includes(last.rows[0].event_type)) throw new Error("Entrega já respondida.");
    const transactionId = randomUUID();
    const { payload, canonical, hash } = canonicalDelivery3f(snapshot, transactionId);
    const options = await generateAuthenticationOptions({ rpID: RP_ID_3F, timeout: 120000,
      userVerification: "required", allowCredentials: (credential ? [credential] : methods)
        .map(row => ({ id: row.credential_id, transports: row.transports })) });
    const challengeId = randomUUID();
    await startChallenge3f(db, actor, { id: challengeId, purpose: "sign",
      sessionHash: tokenHash3f(token), challenge: options.challenge,
      transactionId, credentialId: credential?.credential_id, groupId,
      canonical, snapshot, payloadHash: hash });
    return { challenge_id: challengeId, options, payload };
  });
}

export async function signatureFinish3f(token: string, challengeId: string, response: AuthenticationResponseJSON) {
  return withActor3f(token, async (db, actor) => {
    const challenge = await pendingChallenge3f(db, actor, challengeId, tokenHash3f(token), "sign");
    if (challenge.credential_id && response.id !== challenge.credential_id) throw new Error("Método incorreto.");
    const found = await db.query<Credential3f>(`select credential_id,public_key,counter::text,device_type,
      backed_up,transports,created_at,revoked_at from private.epi_signature_credentials_3f
      where credential_id=$1 and account_id=$2 and identity_id=$3 and employee_id=$4
      and revoked_at is null for update`,
      [response.id,actor.accountId,actor.identityId,actor.employeeId]);
    if (found.rows.length !== 1) throw new Error("Método revogado ou indisponível.");
    const credential = found.rows[0];
    const check = await verifyAuthenticationResponse({ response,
      expectedChallenge: challenge.challenge, expectedOrigin: ORIGIN_3F, expectedRPID: RP_ID_3F,
      credential: { id: credential.credential_id,
        publicKey: new Uint8Array(Buffer.from(credential.public_key, "base64url")),
        counter: Number(credential.counter), transports: transports(credential.transports) },
      requireUserVerification: true });
    if (!check.verified || !check.authenticationInfo.userVerified) throw new Error("Assinatura inválida.");
    return finishSignature3f(db, actor, challenge, credential, check.authenticationInfo.newCounter, {
      id: response.id, clientDataJSON: response.response.clientDataJSON,
      authenticatorData: response.response.authenticatorData, signature: response.response.signature,
    });
  });
}

export async function signatureRevoke3f(token: string, credentialId: string) {
  return withActor3f(token, async (db, actor) => {
    await revokeCredential3f(db, actor, credentialId);
    return { revoked: true };
  });
}
