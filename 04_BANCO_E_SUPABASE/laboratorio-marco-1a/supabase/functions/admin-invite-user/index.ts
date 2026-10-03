import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const jsonHeaders = { "Content-Type": "application/json" };

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return response(401, { error: "authentication_required" });

  const url = Deno.env.get("SUPABASE_URL");
  let secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const modernSecrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernSecrets) {
    try {
      const parsed = JSON.parse(modernSecrets);
      if (typeof parsed?.default === "string" && parsed.default.length > 0) secretKey = parsed.default;
    } catch (_) {
      // Keep legacy fallback.
    }
  }

  if (!url || !secretKey) return response(500, { error: "server_configuration_error" });

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  const caller = callerData.user;
  if (callerError || !caller) return response(401, { error: "invalid_session" });

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", caller.id)
    .single();

  if (profileError || !callerProfile || callerProfile.active !== true || callerProfile.role !== "admin") {
    return response(403, { error: "admin_required" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return response(400, { error: "invalid_json" });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "collaborator").trim();
  const teamIdRaw = body.team_id;
  const teamId = teamIdRaw == null || String(teamIdRaw).trim() === "" ? null : String(teamIdRaw).trim();
  const temporaryPasswordRaw = body.temporary_password;
  const temporaryPassword = temporaryPasswordRaw == null ? "" : String(temporaryPasswordRaw);

  if (!/^\S+@\S+\.\S+$/.test(email)) return response(400, { error: "invalid_email" });
  if (fullName.length < 2 || fullName.length > 120) return response(400, { error: "invalid_full_name" });
  if (!["admin", "leader", "collaborator"].includes(role)) return response(400, { error: "invalid_role" });
  if (temporaryPassword && temporaryPassword.length < 10) return response(400, { error: "temporary_password_too_short" });

  if (teamId) {
    const { data: team, error: teamError } = await admin
      .from("teams")
      .select("id,active")
      .eq("id", teamId)
      .single();
    if (teamError || !team || team.active !== true) return response(400, { error: "invalid_team" });
  }

  let createdUserId: string | null = null;
  let delivery: "temporary_password" | "email_invite";

  if (temporaryPassword) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) return response(400, { error: "user_creation_failed", message: error?.message ?? "unknown" });
    createdUserId = data.user.id;
    delivery = "temporary_password";
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (error || !data.user) return response(400, { error: "user_invite_failed", message: error?.message ?? "unknown" });
    createdUserId = data.user.id;
    delivery = "email_invite";
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, team_id: teamId, active: true })
    .eq("id", createdUserId);

  if (updateError) {
    try { await admin.auth.admin.deleteUser(createdUserId); } catch (_) { /* safe fallback: trigger-created profile remains inactive */ }
    return response(500, { error: "profile_activation_failed" });
  }

  return response(201, {
    ok: true,
    user_id: createdUserId,
    email,
    role,
    team_id: teamId,
    delivery,
  });
});
