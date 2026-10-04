import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { LAB_SUPABASE_URL, TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_PONTO_4D, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { pointReceipt } from "./ponto-online";

const integrity = z.object({ ok: z.boolean(), total: z.number().int().nonnegative(), reason: z.string().nullable() }).strict();
const management = z.object({ events: z.array(pointReceipt.extend({ employee_name: z.string() })), integrity: integrity.optional() });
export type PointManagement = { events: z.infer<typeof management>["events"]; integrity: z.infer<typeof integrity> | null; online: boolean };

// Laboratório: servidor local 4A. Teste online (Marco 4D): Edge Function ponto-4d, que confere admin ativo e sessão.
export async function readPointManagement(): Promise<PointManagement> {
  const url = getSupabaseEnv().url;
  const lab = process.env.METALLO_LOCAL_PREVIEW === "1" && url === LAB_SUPABASE_URL;
  const online = url === TESTE_ONLINE_SUPABASE_URL;
  if (!lab && !online) throw new Error("Ponto disponível somente no laboratório e no teste online.");
  const client = await createClient(), session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw new Error("Sessão indisponível.");
  const target = online ? `${TESTE_ONLINE_PONTO_4D}/gestao` : "http://127.0.0.1:3106/lab-point/v4a/management";
  const origin = online ? TESTE_ONLINE_GESTAO_ORIGIN : "http://127.0.0.1:3102";
  const response = await fetch(target, { headers: { Authorization: `Bearer ${session.data.session.access_token}`, Origin: origin }, cache: "no-store", redirect: online ? "manual" : "error", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Leitura do ponto não autorizada ou indisponível.");
  const parsed = management.parse(await response.json());
  return { events: parsed.events, integrity: parsed.integrity ?? null, online };
}
