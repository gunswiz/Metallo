import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marcos 6A/6B: contracheques e atestados. Os arquivos passam SEMPRE pela Edge Function `arquivos-6`
// (balde privado; o banco confere a permissão como a própria pessoa). Só administrador ativo.
const FUNCAO = `${TESTE_ONLINE_SUPABASE_URL}/functions/v1/arquivos-6`;
async function token() {
  const client = await createClient(), session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw new Error("SESSAO_INVALIDA");
  return session.data.session.access_token;
}
async function chamar(body: BodyInit, json: boolean) {
  const response = await fetch(FUNCAO, { method: "POST", body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${await token()}`, Origin: TESTE_ONLINE_GESTAO_ORIGIN, ...(json ? { "Content-Type": "application/json" } : {}) } });
  const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; url?: string };
  if (!response.ok || !data.ok) throw new Error(typeof data.error === "string" ? data.error : "falha");
  return data;
}

export async function enviarContracheque6a(arquivo: File, employeeId: string, competencia: string, tipoFolha: string) {
  const form = new FormData();
  form.set("acao", "contracheque"); form.set("employee_id", employeeId); form.set("competencia", competencia); form.set("tipo_folha", tipoFolha);
  form.set("arquivo", arquivo, "contracheque.pdf");
  await chamar(form, false);
}
export async function linkArquivo6(arquivoId: string) {
  const data = await chamar(JSON.stringify({ acao: "abrir", arquivo_id: arquivoId }), true);
  const url = z.url().parse(data.url);
  if (!url.startsWith(`${TESTE_ONLINE_SUPABASE_URL}/storage/v1/object/sign/documentos-6/`)) throw new Error("falha");
  return url;
}

export const TIPOS_FOLHA = { mensal: "Mensal", adiantamento: "Adiantamento", ferias: "Férias", decimo_terceiro: "13º salário" } as const;
const contracheque = z.object({ id: z.coerce.number().int(), employee_id: z.uuid(), arquivo_id: z.uuid(), tipo_folha: z.enum(["mensal", "adiantamento", "ferias", "decimo_terceiro"]),
  publicado_em: z.string(), visto_em: z.string().nullable(), tamanho: z.number().int() });
export async function lerContracheques6a(competencia: string) {
  const r = await (await createClient()).rpc("admin_contracheques_6a" as never, { p_competencia: competencia } as never);
  if (r.error) throw new Error("Não foi possível ler os contracheques.");
  return z.array(contracheque).parse(r.data);
}
const atestado = z.object({ id: z.coerce.number().int(), employee_id: z.uuid(), funcionario: z.string(), matricula: z.string().nullable(), arquivo_id: z.uuid(),
  data_inicio: z.string(), dias: z.number().int(), observacao: z.string().nullable(), status: z.enum(["enviado", "aceito", "recusado", "cancelado"]),
  enviado_em: z.string(), decidido_em: z.string().nullable(), motivo_recusa: z.string().nullable(), dias_lancados: z.number().int().nullable() });
export type Atestado6b = z.infer<typeof atestado>;
export async function lerAtestados6b() {
  const r = await (await createClient()).rpc("admin_atestados_6b" as never);
  if (r.error) throw new Error("Não foi possível ler os atestados.");
  return z.array(atestado).parse(r.data);
}
