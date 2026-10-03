// SOMENTE ENSAIO LOCAL P3. Nunca implantar esta funcao.
// Auth/JWT e SQL reais; apenas o transporte PUT de ban falha artificialmente.
import { createRevocationHandler } from "../revoke-portal-account/handler.ts";
const apiUrl = Deno.env.get("SUPABASE_URL") ?? "";
// A CLI 2.117.0 injeta o alias interno kong, observado no runtime local.
if (!["http://kong:8000", "http://supabase_kong_laboratorio-marco-1a:8000"].includes(apiUrl)) {
  throw new Error("local_laboratory_required");
}
const injected: typeof fetch = async (input, init) => {
  const url = String(input);
  if (init?.method === "PUT" && url.startsWith(`${apiUrl}/auth/v1/admin/users/`)) {
    throw new TypeError("synthetic_auth_transport_failure_after_sql");
  }
  return fetch(input, init);
};
Deno.serve(createRevocationHandler(injected));
