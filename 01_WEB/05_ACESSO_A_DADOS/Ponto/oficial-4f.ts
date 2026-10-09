import "server-only";
import { z } from "zod";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { TESTE_ONLINE_GESTAO_ORIGIN, TESTE_ONLINE_PONTO_4D, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marco 4F: empresa, CPF (sempre mascarado na tela) e AFD. Só teste online e só administrador (o banco confere).
export function oficialLiberado4f() { return getSupabaseEnv().url === TESTE_ONLINE_SUPABASE_URL; }
const empresa = z.array(z.object({ tipo_documento: z.number().int(), documento: z.string(), cno_caepf: z.string().nullable(), razao_social: z.string(),
  local_prestacao: z.string(), inpi: z.string().nullable(), desenvolvedor_documento: z.string().nullable(), updated_at: z.string() }));
const cpfs = z.array(z.object({ employee_id: z.string().uuid(), full_name: z.string(), registration_code: z.string().nullable(), cpf_mascarado: z.string().nullable() }));
export const afdResposta = z.object({ filename: z.string().regex(/^AFD\d{17}\d{14}REP_P\.txt$/), content: z.string().max(40_000_000),
  registros: z.number().int().nonnegative(), sem_cpf: z.number().int().nonnegative(), inpi_registrado: z.boolean() }).strict();

export async function lerEmpresa4f() {
  const r = await (await createClient()).rpc("admin_employer_4f" as never);
  if (r.error) throw new Error("Não foi possível ler a empresa.");
  return empresa.parse(r.data)[0] ?? null;
}
export async function lerCpfs4f() {
  const r = await (await createClient()).rpc("admin_employees_cpf_4f" as never);
  if (r.error) throw new Error("Não foi possível ler os funcionários.");
  return cpfs.parse(r.data);
}
export async function gerarAfd4f(from: string, to: string) {
  const client = await createClient(), session = await client.auth.getSession();
  if (session.error || !session.data.session?.access_token) throw new Error("SESSAO_INVALIDA");
  const response = await fetch(`${TESTE_ONLINE_PONTO_4D}/gestao/afd`, { method: "POST", body: JSON.stringify({ from, to }),
    headers: { Authorization: `Bearer ${session.data.session.access_token}`, Origin: TESTE_ONLINE_GESTAO_ORIGIN, "Content-Type": "application/json" },
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(30000) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.error === "string" ? body.error : "FALHOU"); }
  return afdResposta.parse(await response.json());
}
