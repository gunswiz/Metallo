import { z } from "zod";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  signatureState3f, registrationStart3f, registrationFinish3f,
  signatureStart3f, signatureFinish3f, signatureRevoke3f,
} from "@/03_FUNCOES_E_LOGICA/Assinatura/assinatura-servico-3f";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORIGIN = "http://localhost:3101";
const id = z.uuid();
const credential = z.string().regex(/^[A-Za-z0-9_-]{20,2048}$/);
const webauthn = z.object({ id: credential, rawId: credential, type: z.literal("public-key"),
  response: z.record(z.string(), z.unknown()), clientExtensionResults: z.record(z.string(), z.unknown()) }).passthrough();
const registrationResponse = webauthn.extend({ response: z.object({
  clientDataJSON: credential, attestationObject: credential,
  transports: z.array(z.string()).optional(),
}).passthrough() });
const authenticationResponse = webauthn.extend({ response: z.object({
  clientDataJSON: credential, authenticatorData: credential, signature: credential,
}).passthrough() });
const payload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("state") }).strict(),
  z.object({ action: z.literal("register_start") }).strict(),
  z.object({ action: z.literal("register_finish"), challenge_id: id, response: registrationResponse }).strict(),
  z.object({ action: z.literal("sign_start"), group_id: id, credential_id: credential.optional() }).strict(),
  z.object({ action: z.literal("sign_finish"), challenge_id: id, response: authenticationResponse }).strict(),
  z.object({ action: z.literal("revoke"), credential_id: credential }).strict(),
]);
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" };
function answer(body: object, status = 200) { return Response.json(body, { status, headers }); }

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (process.env.METALLO_COLABORADOR_PREVIEW !== "1" || process.env.METALLO_LOCAL_PREVIEW !== "1" ||
    url.origin !== ORIGIN || url.pathname !== "/api/laboratorio/assinatura-epi" || url.search ||
    request.headers.get("origin") !== ORIGIN ||
    ![null, "same-origin"].includes(request.headers.get("sec-fetch-site")))
    return answer({ error: "Disponível apenas no laboratório local." }, 403);
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]{20,8192})$/)?.[1];
  if (!token) return answer({ error: "Sessão inválida." }, 401);
  try {
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 50000) return answer({ error: "Pedido inválido." }, 413);
    const raw = await request.text();
    if (raw.length > 50000) return answer({ error: "Pedido inválido." }, 413);
    const body = payload.parse(JSON.parse(raw));
    let result: object;
    switch (body.action) {
      case "state": result = await signatureState3f(token); break;
      case "register_start": result = await registrationStart3f(token); break;
      case "register_finish": result = await registrationFinish3f(token, body.challenge_id,
        body.response as RegistrationResponseJSON); break;
      case "sign_start": result = await signatureStart3f(token, body.group_id, body.credential_id); break;
      case "sign_finish": result = await signatureFinish3f(token, body.challenge_id,
        body.response as AuthenticationResponseJSON); break;
      case "revoke": result = await signatureRevoke3f(token, body.credential_id); break;
    }
    return answer(result);
  } catch {
    // Não registrar token, challenge, resposta do autenticador ou dados do funcionário.
    return answer({ error: "Não foi possível validar esta ação. Atualize os dados e tente novamente." }, 400);
  }
}
