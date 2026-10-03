import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { pointReceipt } from "./ponto-online";
export async function readPointManagement() {
  if (process.env.METALLO_LOCAL_PREVIEW !== "1" || getSupabaseEnv().url !== "http://127.0.0.1:54321") throw new Error("Ponto 4A somente local.");
  const client = await createClient(), session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw new Error("Sessão indisponível.");
  const response = await fetch("http://127.0.0.1:3106/lab-point/v4a/management", { headers: { Authorization: `Bearer ${session.data.session.access_token}`, Origin: "http://127.0.0.1:3102" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Leitura do laboratório não autorizada ou indisponível.");
  return z.object({ events: z.array(pointReceipt.extend({ employee_name: z.string() })) }).parse(await response.json()).events;
}
