import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { LAB_SUPABASE_URL, TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_PONTO_4D, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { pointReceipt } from "./ponto-online";
import { mesValido, respostaEspelho } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";

const integrity = z.object({ ok: z.boolean(), total: z.number().int().nonnegative(), reason: z.string().nullable() }).strict();
// Marco 4J: situação da hora oficial. Marco 4K: marcação sem internet que precisa ser conferida.
export const horaOficialGestao = z.object({ conferido_em: z.string().nullable(), diferenca_ms: z.number().int().nullable(), incerteza_ms: z.number().int().nullable(),
  situacao: z.enum(["OK", "ATENCAO", "FORA_DO_LIMITE", "SEM_RESPOSTA"]), fonte: z.string().nullable(), valida: z.boolean() }).strict();
const management = z.object({ events: z.array(pointReceipt.extend({ employee_name: z.string(), review: z.boolean().optional(), review_reasons: z.array(z.string()).optional() })),
  integrity: integrity.optional(), official_time: horaOficialGestao.optional() });
export type PointManagement = { events: z.infer<typeof management>["events"]; integrity: z.infer<typeof integrity> | null; online: boolean; officialTime: z.infer<typeof horaOficialGestao> | null };

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
  return { events: parsed.events, integrity: parsed.integrity ?? null, online, officialTime: parsed.official_time ?? null };
}

// Marco 4E: espelho de ponto do mês (todas as pessoas). Só no teste online; a Edge Function confere admin ativo e sessão.
export async function readPointMirror(month: string) {
  if (getSupabaseEnv().url !== TESTE_ONLINE_SUPABASE_URL) throw new Error("Espelho disponível somente no teste online.");
  if (!mesValido(month)) throw new Error("Mês inválido.");
  const client = await createClient(), session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw new Error("Sessão indisponível.");
  const response = await fetch(`${TESTE_ONLINE_PONTO_4D}/gestao/espelho`, { method: "POST", body: JSON.stringify({ month }),
    headers: { Authorization: `Bearer ${session.data.session.access_token}`, Origin: TESTE_ONLINE_GESTAO_ORIGIN, "Content-Type": "application/json" },
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Leitura do espelho não autorizada ou indisponível.");
  return respostaEspelho.parse(await response.json()).events;
}

// Marco 4J: histórico das conferências da hora com a Hora Legal Brasileira (só administrador; o banco confere).
const conferencias = z.object({ atual: horaOficialGestao, cadeia_ok: z.boolean(), total: z.number().int(), fora_30d: z.number().int(), sem_resposta_30d: z.number().int(),
  lista: z.array(horaOficialGestao.omit({ valida: true })) });
export async function lerConferenciasHora4j() {
  if (getSupabaseEnv().url !== TESTE_ONLINE_SUPABASE_URL) return null;
  const r = await (await createClient()).rpc("admin_conferencias_hora_4j" as never, { p_limite: 36 } as never);
  if (r.error) throw new Error("Não foi possível ler a conferência da hora.");
  return conferencias.parse(r.data);
}
