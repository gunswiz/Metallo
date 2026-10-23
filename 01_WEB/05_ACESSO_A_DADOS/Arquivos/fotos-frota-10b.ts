import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marco 10B: foto do defeito da frota. O arquivo passa SEMPRE pela Edge Function `fotos-frota-10b` (balde privado; o banco confere a permissão).
const FUNCAO = `${TESTE_ONLINE_SUPABASE_URL}/functions/v1/fotos-frota-10b`;
export async function linkFoto10b(fotoId: string) {
  const session = await (await createClient()).auth.getSession();
  const token = session.data.session?.access_token;
  if (session.error || !token) throw new Error("SESSAO_INVALIDA");
  const response = await fetch(FUNCAO, { method: "POST", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, Origin: TESTE_ONLINE_GESTAO_ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ acao: "abrir", foto_id: fotoId }) });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; url?: string };
  if (!response.ok || !data.ok) throw new Error("falha");
  const url = z.url().parse(data.url);
  if (!url.startsWith(`${TESTE_ONLINE_SUPABASE_URL}/storage/v1/object/sign/frota-10b/`)) throw new Error("falha");
  return url;
}
