// Transporte injetavel apenas pelo servidor de ensaio; nenhuma flag do cliente.
const headers = { "Content-Type": "application/json" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons = new Set(["employment_ended", "wrong_association", "account_replaced", "other"]);
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });
export function createRevocationHandler(transport: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
    const authorization = req.headers.get("Authorization") ?? "";
    if (!/^Bearer\s+\S+$/.test(authorization)) return reply(401, { error: "authentication_required" });
    const apiUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiUrl || !serviceKey) return reply(500, { error: "server_configuration_error" });
    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return reply(400, { error: "invalid_json" }); }
    const identityId = input.identity_id;
    const reason = input.reason;
    if (typeof identityId !== "string" || !uuid.test(identityId) ||
        typeof reason !== "string" || !reasons.has(reason)) {
      return reply(400, { error: "invalid_revocation_request" });
    }
    // O JWT do solicitante chega a RPC, que exige administrador ativo.
    let revoked: Response;
    try {
      revoked = await transport(`${apiUrl}/rest/v1/rpc/admin_revoke_employee_identity`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ p_identity_id: identityId, p_reason: reason })
      });
    } catch { return reply(502, { error: "identity_revocation_unconfirmed" }); }
    if (!revoked.ok) return reply(revoked.status === 401 ? 401 : revoked.status === 403 ? 403 : 400,
      { error: "identity_revocation_denied" });
    const authUserId = await revoked.json();
    if (typeof authUserId !== "string" || !uuid.test(authUserId)) {
      return reply(500, { error: "identity_response_invalid" });
    }
    // SQL ja confirmou revogacao: falha HTTP OU de transporte exige retry.
    try {
      const banned = await transport(`${apiUrl}/auth/v1/admin/users/${authUserId}`, {
        method: "PUT",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ban_duration: "876000h" })
      });
      if (!banned.ok) return reply(502, { error: "auth_ban_pending" });
    } catch { return reply(502, { error: "auth_ban_pending" }); }
    return reply(200, { ok: true, auth_user_id: authUserId });
  };
}
