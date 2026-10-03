// Fluxo exclusivo de servidor: o service_role nunca deve chegar ao navegador/app.
// O banco corta o acesso pessoal antes do bloqueio de novas sessoes no Auth.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reasons = new Set(["employment_ended", "wrong_association", "account_replaced", "other"]);

export async function revokePortalAccountLocal({ apiUrl, serviceRoleKey, adminAccessToken, identityId, reason, fetchImpl = fetch }) {
  if (apiUrl !== "http://127.0.0.1:54321") throw new Error("Somente o laboratorio local e permitido.");
  if (!serviceRoleKey || !adminAccessToken || !UUID.test(identityId) || !reasons.has(reason)) {
    throw new Error("Parametros de revogacao invalidos.");
  }
  const revoked = await fetchImpl(`${apiUrl}/rest/v1/rpc/admin_revoke_employee_identity`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${adminAccessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_identity_id: identityId, p_reason: reason })
  });
  if (!revoked.ok) throw new Error(`Revogacao no banco falhou: HTTP ${revoked.status}.`);
  const authUserId = await revoked.json();
  if (!UUID.test(authUserId)) throw new Error("A revogacao no banco nao retornou o usuario Auth.");

  const banned = await fetchImpl(`${apiUrl}/auth/v1/admin/users/${authUserId}`, {
    method: "PUT",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ban_duration: "876000h" })
  });
  if (!banned.ok) {
    throw new Error(`Identidade revogada no banco; bloqueio Auth pendente para ${authUserId}: HTTP ${banned.status}.`);
  }
  return { authUserId, databaseRevoked: true, authBanned: true };
}
