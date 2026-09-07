import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const isStrongPassword = (password: string) =>
  password.length >= 12 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const publicErrors = new Set([
  "authentication_required",
  "admin_required",
  "invalid_employee_data",
  "invalid_role",
  "team_required",
  "user_already_exists",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) throw new Error("authentication_required");

    const admin = createClient(url, service);
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("role,active")
      .eq("id", userData.user.id)
      .single();
    if (profileErr || profile?.role !== "admin" || profile?.active !== true) {
      throw new Error("admin_required");
    }

    const body = await req.json();
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "collaborator");
    const teamId = body.team_id ? String(body.team_id) : null;

    if (!fullName || !email.includes("@") || !isStrongPassword(password)) {
      throw new Error("invalid_employee_data");
    }
    if (!["engineer", "leader", "collaborator"].includes(role)) {
      throw new Error("invalid_role");
    }
    if (["leader", "collaborator"].includes(role) && !teamId) {
      throw new Error("team_required");
    }

    const provisioningToken = crypto.randomUUID();
    const { error: ticketErr } = await admin.rpc(
      "issue_user_provisioning_ticket",
      {
        p_email: email,
        p_token: provisioningToken,
      },
    );
    if (ticketErr) throw ticketErr;

    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          metallo_provisioning_token: provisioningToken,
        },
        app_metadata: { metallo_provisioned: true },
      });
    if (createErr) {
      await admin.rpc("revoke_user_provisioning_ticket", {
        p_email: email,
        p_token: provisioningToken,
      });
      if (
        createErr.code === "email_exists" ||
        createErr.message.toLowerCase().includes("already")
      ) {
        throw new Error("user_already_exists");
      }
      throw new Error("employee_creation_failed");
    }
    if (!created.user) {
      await admin.rpc("revoke_user_provisioning_ticket", {
        p_email: email,
        p_token: provisioningToken,
      });
      throw new Error("employee_creation_failed");
    }

    const { error: metadataErr } = await admin.auth.admin.updateUserById(
      created.user.id,
      { user_metadata: { full_name: fullName } },
    );
    if (metadataErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw metadataErr;
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role,
        team_id: teamId,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", created.user.id);

    if (updateErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw updateErr;
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: created.user.id }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = publicErrors.has(message)
      ? message
      : "employee_creation_failed";
    const status = safeMessage === "authentication_required"
      ? 401
      : safeMessage === "admin_required"
      ? 403
      : 400;
    if (safeMessage === "employee_creation_failed") {
      console.error("create-employee failed", error);
    }
    return new Response(JSON.stringify({ ok: false, error: safeMessage }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status,
    });
  }
});
